// Concatenate after _lib.js + theme.js (phase 07). Resolves Theme rows in-plugin; ctx omits variableMap.
// Fully dynamic — discovers all Theme COLOR variables grouped by first path segment.
// Accepts any mode name: "Light", "Light mode", "light", "Dark", "Dark mode", etc.
const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const themeColl = collections.find((c) => c.name === 'Theme');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!themeColl) throw new Error('Theme collection missing');
if (!primColl) throw new Error('Primitives collection missing');

// Flexible mode detection: accept "Light", "Light mode", "light" etc.
const themeLightModeId = (
  themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]
).modeId;
const themeDarkModeId = (
  themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
  themeColl.modes[1] ||
  themeColl.modes[0]
).modeId;
const primModeId = primColl.modes[0].modeId;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveHex(varId, themeModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = themeModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return '#000000';
    if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId);
      if (nextColl.id === primColl.id) m = primModeId;
      else if (nextColl.id === themeColl.id) m = themeModeId;
      else m = nextColl.modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'object' && typeof val.r === 'number') return colorToHex(val);
    return '#000000';
  }
  return '#000000';
}

async function resolveFirstAlias(varId, themeModeId) {
  const v = await figma.variables.getVariableByIdAsync(varId);
  const val = v.valuesByMode[themeModeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    try {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      return next && next.name ? next.name : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

// Discover ALL Theme COLOR variables, group by first path segment
const themeVars = allVars.filter(
  (v) => v.variableCollectionId === themeColl.id && v.resolvedType === 'COLOR'
);
const groupOrder = [];
const groupMap = {};
for (const v of themeVars) {
  const firstSeg = v.name.split('/')[0];
  if (!groupMap[firstSeg]) {
    groupMap[firstSeg] = [];
    groupOrder.push(firstSeg);
  }
  groupMap[firstSeg].push(v);
}

const allRows = {};
for (const group of groupOrder) {
  allRows[group] = [];
  for (const v of groupMap[group]) {
    const light = await resolveHex(v.id, themeLightModeId);
    const dark = await resolveHex(v.id, themeDarkModeId);
    const aliasLightLive = await resolveFirstAlias(v.id, themeLightModeId);
    const aliasDarkLive = await resolveFirstAlias(v.id, themeDarkModeId);
    allRows[group].push({
      tokenPath: v.name,
      resolvedHexLight: light,
      resolvedHexDark: dark,
      aliasLight: aliasLightLive,
      aliasDark: aliasDarkLive,
      codeSyntax: readCS(v),
    });
  }
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section: textStyles.find((s) => s.name === 'Doc/Section')?.id || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code: textStyles.find((s) => s.name === 'Doc/Code')?.id || null,
  Caption: textStyles.find((s) => s.name === 'Doc/Caption')?.id || null,
};

const themePage = figma.root.children.find((pg) => pg.name === '↳ Theme');
if (!themePage || themePage.type !== 'PAGE') {
  throw new Error('Page not found (expected ↳ Theme)');
}

const ctx = {
  pageId: themePage.id,
  docStyles,
  themeCollectionId: themeColl.id,
  themeLightModeId,
  themeDarkModeId,
  rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15b-theme', pageId: themePage.id, tableGroups, pageName: themePage.name };
