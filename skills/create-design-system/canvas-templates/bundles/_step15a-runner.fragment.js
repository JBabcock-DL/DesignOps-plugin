// Concatenate after _lib.js + primitives.js (phase 07). Resolves rows in-plugin; ctx omits variableMap.
// Fully dynamic — discovers color ramps, space, radius, elevation, typeface, and font-weight from
// whatever variable naming convention the file uses. No hardcoded paths required.
const RAMP_ORDER = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
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
  if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
  const r = Math.round(val.r * 255);
  const g = Math.round(val.g * 255);
  const b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function resolveRaw(vid, m) {
  let v = await figma.variables.getVariableByIdAsync(vid);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      v = await figma.variables.getVariableByIdAsync(val.id);
      continue;
    }
    return val;
  }
  return null;
}
function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
async function floatAlias(vid, m) {
  const raw = await resolveRaw(vid, m);
  return typeof raw === 'number' ? raw : 0;
}

// ── Color ramp discovery ──────────────────────────────────────────────────────
// Finds all COLOR variables across ALL collections.
// Groups by "all path segments except the last numeric stop, minus a leading
// collection-prefix segment when the path has 3+ segments".
// e.g.  Color/blue/100      → ramp "blue",         stop "100"
//       Color/opacity/dark/100 → ramp "opacity/dark", stop "100"
//       color/primary/500   → ramp "primary",       stop "500"
//       primary/500         → ramp "primary",       stop "500"
const discoveredRamps = {};
for (const v of allVars) {
  if (v.resolvedType !== 'COLOR') continue;
  const parts = v.name.split('/');
  if (parts.length < 2) continue;
  const lastSeg = parts[parts.length - 1];
  if (!/^\d+$/.test(lastSeg)) continue;
  let rampParts;
  if (parts.length === 2) {
    rampParts = [parts[0]];
  } else {
    // Strip first "collection prefix" segment (e.g. "Color"), keep middle segments as ramp
    rampParts = parts.slice(1, -1);
  }
  const rampKey = rampParts.map((s) => s.toLowerCase()).join('/');
  if (!discoveredRamps[rampKey]) discoveredRamps[rampKey] = [];
  discoveredRamps[rampKey].push({ stop: lastSeg, tokenPath: v.name, vid: v.id });
}
const colorRamps = {};
const rampNames = Object.keys(discoveredRamps).sort((a, b) => {
  const ia = RAMP_ORDER.indexOf(a); const ib = RAMP_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1; if (ib !== -1) return 1;
  return a.localeCompare(b);
});
for (const ramp of rampNames) {
  const stops = discoveredRamps[ramp].sort((a, b) => parseInt(a.stop, 10) - parseInt(b.stop, 10));
  colorRamps[ramp] = [];
  for (const s of stops) {
    const v = await figma.variables.getVariableByIdAsync(s.vid);
    let raw = await resolveRaw(s.vid, primitivesModeId);
    if (!raw || typeof raw.r !== 'number') {
      const firstMode = Object.keys(v.valuesByMode)[0];
      raw = await resolveRaw(s.vid, firstMode);
    }
    colorRamps[ramp].push({ tokenPath: s.tokenPath, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) });
  }
}

// ── Space discovery ───────────────────────────────────────────────────────────
// Accepts Space/, Size/, space/, size/, spacing/, Spacing/ prefixes from any collection
const SPACE_PREFIXES = ['space/', 'Space/', 'size/', 'Size/', 'spacing/', 'Spacing/'];
const spaceVarObjs = allVars.filter((v) =>
  v.resolvedType === 'FLOAT' && SPACE_PREFIXES.some((pfx) => v.name.startsWith(pfx))
);
const spaceSorted = [];
for (const v of spaceVarObjs) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  spaceSorted.push({ v, px });
}
spaceSorted.sort((a, b) => a.px - b.px);
const space = spaceSorted.map(({ v, px }) => ({ tokenPath: v.name, resolvedPx: px, codeSyntax: readCS(v) }));

// ── Radius discovery ──────────────────────────────────────────────────────────
// Accepts Corner/, corner/, radius/, Radius/ prefixes from any collection
const RADIUS_PREFIXES = ['corner/', 'Corner/', 'radius/', 'Radius/'];
const radiusVarObjs = allVars.filter((v) =>
  v.resolvedType === 'FLOAT' && RADIUS_PREFIXES.some((pfx) => v.name.startsWith(pfx))
);
const radiusSorted = [];
for (const v of radiusVarObjs) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  radiusSorted.push({ v, px });
}
radiusSorted.sort((a, b) => a.px - b.px);
const radius = radiusSorted.map(({ v, px }) => {
  const isFullOrPill =
    v.name.toLowerCase().includes('full') || v.name.toLowerCase().includes('pill') || px >= 9999;
  return { tokenPath: v.name, resolvedPx: isFullOrPill ? 9999 : px, codeSyntax: readCS(v) };
});

// ── Elevation discovery ───────────────────────────────────────────────────────
// Accepts elevation/, Elevation/, elev/ prefixes from any collection
const ELEV_PREFIXES = ['elevation/', 'Elevation/', 'elev/'];
const elevation = [];
for (const v of allVars
  .filter((v) => v.resolvedType === 'FLOAT' && ELEV_PREFIXES.some((pfx) => v.name.startsWith(pfx)))
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  elevation.push({ tokenPath: v.name, resolvedValue: String(px), codeSyntax: readCS(v) });
}

// ── Typeface discovery ────────────────────────────────────────────────────────
// Finds all STRING variables whose name contains 'font', 'typeface', or 'face'
const typeface = [];
for (const v of allVars) {
  if (v.resolvedType !== 'STRING') continue;
  const lower = v.name.toLowerCase();
  if (!lower.includes('font') && !lower.includes('typeface') && !lower.includes('face')) continue;
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const raw = await resolveRaw(v.id, m);
  typeface.push({ tokenPath: v.name, resolvedValue: typeof raw === 'string' ? raw : '—', codeSyntax: readCS(v) });
}

// ── Font-weight discovery ─────────────────────────────────────────────────────
// Finds all FLOAT variables whose name contains 'weight', from any collection
const fontWeightVars = allVars.filter(
  (v) => v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('weight')
);
const fontWeight = [];
for (const v of fontWeightVars) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  fontWeight.push({ tokenPath: v.name, resolvedValue: String(px), codeSyntax: readCS(v) });
}
fontWeight.sort((a, b) => parseFloat(a.resolvedValue) - parseFloat(b.resolvedValue));

// ── Page ──────────────────────────────────────────────────────────────────────
const primPage = figma.root.children.find((pg) => pg.name === '↳ Primitives');
if (!primPage || primPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Primitives): ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
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
