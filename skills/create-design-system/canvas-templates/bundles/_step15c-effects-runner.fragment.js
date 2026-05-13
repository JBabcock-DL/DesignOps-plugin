// Concatenate after _lib.js + effects.js (phase 07). Resolves Effects rows in-plugin; ctx omits variableMap.
// Fully dynamic — discovers Effects FLOAT vars (shadow blur tiers) and COLOR vars (shadow colors).
// Maps FLOAT vars to shadow tier names sm/md/lg/xl/2xl by sort order, so any elevation naming works.
const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const effectsColl = collections.find((c) => c.name === 'Effects');
const primColl = collections.find((c) => c.name === 'Primitives');
const themeColl = collections.find((c) => c.name === 'Theme');
if (!effectsColl) throw new Error('Effects collection missing');

// Flexible mode detection: accepts "light", "Light", "Light mode", etc.
const effectsLightModeId = (
  effectsColl.modes.find((m) => /^light/i.test(m.name.trim())) || effectsColl.modes[0]
).modeId;
const effectsDarkModeId = (
  effectsColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
  effectsColl.modes[1] ||
  effectsColl.modes[0]
).modeId;
const primModeId = primColl ? primColl.modes[0].modeId : effectsLightModeId;
const themeLightModeId = themeColl
  ? (themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]).modeId
  : null;
const themeDarkModeId = themeColl
  ? (themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
     themeColl.modes[1] ||
     themeColl.modes[0]).modeId
  : null;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

async function resolvePx(varId, startModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = startModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      if (primColl && next.variableCollectionId === primColl.id) m = primModeId;
      else if (next.variableCollectionId === effectsColl.id) m = startModeId;
      else m = (await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId)).modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'number') return val;
    return 0;
  }
  return 0;
}

async function resolveColor(varId, modeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = modeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    if (!val) return { r: 0, g: 0, b: 0, a: 1 };
    if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      if (primColl && next.variableCollectionId === primColl.id) m = primModeId;
      else if (next.variableCollectionId === effectsColl.id) m = modeId;
      else m = (await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId)).modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'object' && typeof val.r === 'number') return val;
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

// Tier names in order for mapping FLOAT vars
const TIER_NAMES = ['sm', 'md', 'lg', 'xl', '2xl'];

// Discover FLOAT vars in Effects collection (elevation / blur steps) → shadow tiers
const effectsFloatVars = allVars
  .filter((v) => v.variableCollectionId === effectsColl.id && v.resolvedType === 'FLOAT')
  .sort((a, b) => a.name.localeCompare(b.name));

const shadows = [];
for (let i = 0; i < effectsFloatVars.length; i++) {
  const v = effectsFloatVars[i];
  const tier = TIER_NAMES[i] || `tier${i + 1}`;
  const blurPx = await resolvePx(v.id, effectsLightModeId);
  // Get the alias target name for display
  const modeVal = v.valuesByMode[effectsLightModeId] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
  let aliasPath = '';
  if (modeVal && typeof modeVal === 'object' && modeVal.type === 'VARIABLE_ALIAS') {
    const av = await figma.variables.getVariableByIdAsync(modeVal.id);
    if (av) aliasPath = av.name;
  }
  shadows.push({ tokenPath: v.name, tier, blurPx, aliasPath, codeSyntax: readCS(v) });
}

// Discover COLOR vars in Effects collection → shadow color entries
const effectsColorVars = allVars.filter(
  (v) => v.variableCollectionId === effectsColl.id && v.resolvedType === 'COLOR'
);
const shadowColor = [];
for (const v of effectsColorVars) {
  const lightC = await resolveColor(v.id, effectsLightModeId);
  const darkC = await resolveColor(v.id, effectsDarkModeId);
  const la = Math.round((lightC.a ?? 1) * 100) / 100;
  const da = Math.round((darkC.a ?? 1) * 100) / 100;
  shadowColor.push({
    tokenPath: v.name,
    themeVariableId: v.id,
    resolvedHexLight: colorToHex(lightC),
    resolvedHexDark: colorToHex(darkC),
    rgbaLight: `rgba(${Math.round(lightC.r * 255)},${Math.round(lightC.g * 255)},${Math.round(lightC.b * 255)},${la})`,
    rgbaDark: `rgba(${Math.round(darkC.r * 255)},${Math.round(darkC.g * 255)},${Math.round(darkC.b * 255)},${da})`,
    codeSyntax: readCS(v),
  });
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const effectsPage = figma.root.children.find((pg) => pg.name === '↳ Effects');
if (!effectsPage || effectsPage.type !== 'PAGE') {
  throw new Error('Page not found (expected ↳ Effects)');
}

const ctx = {
  pageId: effectsPage.id,
  docStyles,
  effectsCollectionId: effectsColl.id,
  effectsLightModeId,
  effectsDarkModeId,
  themeCollectionId: themeColl ? themeColl.id : null,
  themeLightModeId,
  themeDarkModeId,
  rows: { shadows, shadowColor },
};
await build(ctx);
const tableGroups = effectsPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15c-effects', pageId: effectsPage.id, tableGroups, pageName: effectsPage.name };
