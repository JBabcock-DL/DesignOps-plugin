// Concatenate after _lib.js + primitives.js (phase 07). Resolves rows in-plugin; ctx omits variableMap.
const RAMPS = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
const STOPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const allVars = await figma.variables.getLocalVariablesAsync();
const p = Object.fromEntries(allVars.map((v) => [v.name, v.id]));
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const primColl = collections.find((c) => c.name === 'Primitives');
if (!primColl) throw new Error('Primitives collection missing');
const primitivesModeId = primColl.modes[0].modeId;
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section: textStyles.find((s) => s.name === 'Doc/Section')?.id || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code: textStyles.find((s) => s.name === 'Doc/Code')?.id || null,
  Caption: textStyles.find((s) => s.name === 'Doc/Caption')?.id || null,
};
function colorToHex(val) {
  if (!val || val.type !== 'COLOR') return '#000000';
  const r = Math.round(val.r * 255);
  const g = Math.round(val.g * 255);
  const b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
async function floatAlias(vid, m) {
  let v = await figma.variables.getVariableByIdAsync(vid);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (!val || val.type !== 'VARIABLE_ALIAS') return val && val.type === 'FLOAT' ? val.value : 0;
    v = await figma.variables.getVariableByIdAsync(val.id);
  }
  return 0;
}
async function crow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const raw = v.valuesByMode[primitivesModeId];
  return { tokenPath: tp, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) };
}
const colorRamps = {};
for (const r of RAMPS) {
  colorRamps[r] = [];
  for (const s of STOPS) {
    const tp = 'color/' + r + '/' + s;
    if (p[tp]) colorRamps[r].push(await crow(tp));
  }
}
async function frow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const px = await floatAlias(v.id, primitivesModeId);
  return { tokenPath: tp, resolvedPx: px, codeSyntax: readCS(v) };
}
const space = [];
for (const n of allVars
  .map((v) => v.name)
  .filter((n) => n.startsWith('Space/'))
  .sort((a, b) => parseInt(a.split('/')[1], 10) - parseInt(b.split('/')[1], 10))) {
  space.push(await frow(n));
}
const radius = [];
for (const n of allVars.map((v) => v.name).filter((n) => n.startsWith('Corner/')).sort()) {
  radius.push(await frow(n));
}
const elevation = [];
for (const n of allVars.map((v) => v.name).filter((n) => n.startsWith('elevation/')).sort()) {
  const v = await figma.variables.getVariableByIdAsync(p[n]);
  const px = await floatAlias(v.id, primitivesModeId);
  elevation.push({ tokenPath: n, resolvedValue: String(px), codeSyntax: readCS(v) });
}
async function srow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const raw = v.valuesByMode[primitivesModeId];
  let rv = '\u2014';
  if (raw && raw.type === 'STRING') rv = raw.value;
  return { tokenPath: tp, resolvedValue: rv, codeSyntax: readCS(v) };
}
const typeface = [];
for (const tp of ['typeface/display', 'typeface/body']) {
  if (p[tp]) typeface.push(await srow(tp));
}
const fontWeight = [];
if (p['font/weight/medium']) {
  const v = await figma.variables.getVariableByIdAsync(p['font/weight/medium']);
  fontWeight.push({
    tokenPath: 'font/weight/medium',
    resolvedValue: String(await floatAlias(v.id, primitivesModeId)),
    codeSyntax: readCS(v),
  });
}
const primPage = figma.root.children.find((pg) => pg.name === '\u21B3 Primitives');
if (!primPage || primPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected \\u21B3 Primitives): ' +
      figma.root.children
        .filter((c) => c.type === 'PAGE')
        .map((c) => c.name)
        .join(' | '),
  );
}
const ctx = {
  pageId: primPage.id,
  primitivesModeId,
  docStyles,
  rows: { colorRamps, space, radius, elevation, typeface, fontWeight },
};
const hadVm = 'variableMap' in ctx;
await build(ctx);
const tableGroups = primPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true,
  step: '15a-primitives',
  pageId: primPage.id,
  hadVariableMapBeforeBuild: hadVm,
  variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
  tableGroups,
  pageName: primPage.name,
};
