// Concatenate after _lib.js + theme.js (phase 07). Resolves Theme rows in-plugin.
// Collection-scoped: finds the Theme-like collection by fuzzy name match (or Light/Dark mode
// detection), then draws ONLY COLOR vars from that collection grouped by first path segment.

const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();

// ── Find the Theme-like collection (fuzzy) ────────────────────────────────────
// Priority: registry id → exact "Theme" → keyword match → any collection with both Light AND Dark modes
function findThemeCollection() {
  return resolveCollectionByLogicalKey('theme', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Theme');
  if (exact) return exact;
  const fuzzy = collections.find((c) => /theme|semantic/i.test(c.name));
  if (fuzzy) return fuzzy;
  return (
    collections.find(
      (c) =>
        c.modes.some((m) => /^light/i.test(m.name.trim())) &&
        c.modes.some((m) => /^dark/i.test(m.name.trim()))
    ) || null
  );
  });
}

// ── Find the base/primitives collection for alias resolution ──────────────────
function findPrimitivesCollection(themeCollId) {
  return resolveCollectionByLogicalKey('primitives', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Primitives' && c.id !== themeCollId);
  if (exact) return exact;
  const fuzzy = collections.find((c) =>
    /primitiv|core|foundation|base/i.test(c.name) && c.id !== themeCollId
  );
  if (fuzzy) return fuzzy;
  const candidates = collections
    .filter((c) => c.id !== themeCollId && c.modes.length === 1)
    .map((c) => ({
      c,
      colorCount: allVars.filter((v) => v.variableCollectionId === c.id && v.resolvedType === 'COLOR').length,
    }))
    .sort((a, b) => b.colorCount - a.colorCount);
  return candidates[0]?.c || null;
  });
}

const themeColl = findThemeCollection();
if (!themeColl) {
  throw new Error(
    'No Theme-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
  );
}
const primColl = findPrimitivesCollection(themeColl.id);

const themeLightModeId = (
  themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]
).modeId;
const themeDarkModeId = (
  themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
  themeColl.modes[1] ||
  themeColl.modes[0]
).modeId;
const primModeId = primColl ? primColl.modes[0].modeId : themeLightModeId;

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
      const nextColl = collections.find((c) => c.id === next.variableCollectionId);
      if (nextColl?.id === primColl?.id) m = primModeId;
      else if (nextColl?.id === themeColl.id) m = themeModeId;
      else m = nextColl ? nextColl.modes[0].modeId : m;
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
      return next?.name || null;
    } catch (_) { return null; }
  }
  return null;
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

// All COLOR vars from this collection only, grouped by first path segment
const themeVars = allVars.filter(
  (v) => v.variableCollectionId === themeColl.id && v.resolvedType === 'COLOR'
);
const groupOrder = [];
const groupMap = {};
for (const v of themeVars) {
  const firstSeg = v.name.split('/')[0];
  if (!groupMap[firstSeg]) { groupMap[firstSeg] = []; groupOrder.push(firstSeg); }
  groupMap[firstSeg].push(v);
}

const allRows = {};
for (const group of groupOrder) {
  allRows[group] = [];
  for (const v of groupMap[group]) {
    const light = await resolveHex(v.id, themeLightModeId);
    const dark  = await resolveHex(v.id, themeDarkModeId);
    const aliasLight = await resolveFirstAlias(v.id, themeLightModeId);
    const aliasDark  = await resolveFirstAlias(v.id, themeDarkModeId);
    allRows[group].push({
      tokenPath: v.name,
      resolvedHexLight: light, resolvedHexDark: dark,
      aliasLight, aliasDark,
      codeSyntax: readCS(v),
    });
  }
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const themePage =
  findDesignOpsPage('theme', {
    legacyExact: ['↳ Theme'],
    legacyRegex: [/^↳?\s*theme/i],
  }) || null;
if (!themePage || themePage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Theme / slug theme). Pages: ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}

const ctx = {
  pageId: themePage.id, docStyles,
  themeCollectionId: themeColl.id,
  themeLightModeId, themeDarkModeId,
  rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true, step: '15b-theme', pageId: themePage.id,
  collection: themeColl.name, tableGroups, pageName: themePage.name,
};
