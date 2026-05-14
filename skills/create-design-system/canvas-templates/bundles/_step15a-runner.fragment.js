// Concatenate after _lib.js + primitives.js (phase 07). Resolves rows in-plugin.
// Collection-scoped: finds the Primitives-like collection by fuzzy name match, then draws
// ONLY vars from that collection. Nothing is cross-collected from other collections.
// This means if a file stores space tokens in Primitives, they appear on ↳ Primitives.
// If they live in Layout, they appear on ↳ Layout (drawn by the layout runner instead).

const RAMP_ORDER = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];

// Name patterns used to categorise FLOAT vars within the matched collection
const SPACE_RE    = /^(space|size|spacing)(\/|$)/i;
const RADIUS_RE   = /^(corner|radius)(\/|$)/i;
const ELEV_RE     = /^(elevation|elev|shadow|blur)(\/|$)/i;
const WEIGHT_RE   = /weight/i;
const TYPEFACE_RE = /font|typeface|face/i;

const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();

// ── Find the Primitives-like collection (fuzzy) ───────────────────────────────
// Priority: registry id → exact "Primitives" → case-insensitive keyword → collection with most COLOR vars
function findPrimitivesCollection() {
  return resolveCollectionByLogicalKey('primitives', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Primitives');
  if (exact) return exact;
  const fuzzy = collections.find((c) => /primitiv|core|foundation|base/i.test(c.name));
  if (fuzzy) return fuzzy;
  // Last resort: the non-theme, non-text-styles collection with the most COLOR variables
  const colorCount = (c) => allVars.filter((v) => v.variableCollectionId === c.id && v.resolvedType === 'COLOR').length;
  const themed = new Set(
    collections
      .filter((c) => c.modes.some((m) => /^light/i.test(m.name)) && c.modes.some((m) => /^dark/i.test(m.name)))
      .map((c) => c.id)
  );
  const candidates = collections.filter((c) => !themed.has(c.id));
  return candidates.sort((a, b) => colorCount(b) - colorCount(a))[0] || null;
  });
}

const primColl = findPrimitivesCollection();
if (!primColl) {
  throw new Error(
    'No Primitives-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
  );
}

const collModeId = primColl.modes[0].modeId;

// All vars scoped to this collection only
const myVars = allVars.filter((v) => v.variableCollectionId === primColl.id);

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === '_Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === '_Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === '_Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === '_Doc/Caption')?.id   || null,
};

function colorToHex(val) {
  if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
  const r = Math.round(val.r * 255), g = Math.round(val.g * 255), b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveRaw(vid, m) {
  let v = await figma.variables.getVariableByIdAsync(vid);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = collections.find((c) => c.id === next.variableCollectionId);
      m = nextColl ? nextColl.modes[0].modeId : Object.keys(next.valuesByMode)[0];
      v = next;
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

async function floatVal(vid) {
  const raw = await resolveRaw(vid, collModeId);
  return typeof raw === 'number' ? raw : 0;
}

// ── Color ramps: COLOR vars with numeric final stop ───────────────────────────
const discoveredRamps = {};
for (const v of myVars.filter((v) => v.resolvedType === 'COLOR')) {
  const parts = v.name.split('/');
  if (parts.length < 2) continue;
  const lastSeg = parts[parts.length - 1];
  if (!/^\d+$/.test(lastSeg)) continue;
  const rampParts = parts.length === 2 ? [parts[0]] : parts.slice(1, -1);
  const rampKey = rampParts.map((s) => s.toLowerCase()).join('/');
  if (!discoveredRamps[rampKey]) discoveredRamps[rampKey] = [];
  discoveredRamps[rampKey].push({ stop: lastSeg, tokenPath: v.name, vid: v.id });
}
const colorRamps = {};
const rampNames = Object.keys(discoveredRamps).sort((a, b) => {
  const ia = RAMP_ORDER.indexOf(a), ib = RAMP_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1; if (ib !== -1) return 1;
  return a.localeCompare(b);
});
for (const ramp of rampNames) {
  const stops = discoveredRamps[ramp].sort((a, b) => parseInt(a.stop, 10) - parseInt(b.stop, 10));
  colorRamps[ramp] = [];
  for (const s of stops) {
    const v = await figma.variables.getVariableByIdAsync(s.vid);
    let raw = await resolveRaw(s.vid, collModeId);
    if (!raw || typeof raw.r !== 'number') raw = await resolveRaw(s.vid, Object.keys(v.valuesByMode)[0]);
    colorRamps[ramp].push({ tokenPath: s.tokenPath, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) });
  }
}

// ── Categorise FLOAT vars in this collection ─────────────────────────────────
const floatVars = myVars.filter((v) => v.resolvedType === 'FLOAT');

const spaceArr = [], radiusArr = [], elevArr = [], weightArr = [], otherFloatArr = [];
for (const v of floatVars) {
  if (SPACE_RE.test(v.name))       spaceArr.push(v);
  else if (RADIUS_RE.test(v.name)) radiusArr.push(v);
  else if (ELEV_RE.test(v.name))   elevArr.push(v);
  else if (WEIGHT_RE.test(v.name)) weightArr.push(v);
  else                             otherFloatArr.push(v);
}

async function buildFloatRows(vars, sorted) {
  const rows = [];
  for (const v of vars) {
    const px = await floatVal(v.id);
    rows.push({ tokenPath: v.name, resolvedPx: px, resolvedValue: String(px), codeSyntax: readCS(v) });
  }
  if (sorted) rows.sort((a, b) => a.resolvedPx - b.resolvedPx);
  return rows;
}

const spaceRows  = await buildFloatRows(spaceArr,  true);
const radiusRows = (await buildFloatRows(radiusArr, true)).map((r) => ({
  ...r,
  resolvedPx: (r.tokenPath.toLowerCase().includes('full') || r.tokenPath.toLowerCase().includes('pill') || r.resolvedPx >= 9999) ? 9999 : r.resolvedPx,
}));
const elevRows   = await buildFloatRows(elevArr.sort((a, b) => a.name.localeCompare(b.name)), false);
const weightRows = await buildFloatRows(weightArr, false);
weightRows.sort((a, b) => parseFloat(a.resolvedValue) - parseFloat(b.resolvedValue));

// ── STRING vars: typeface / other ─────────────────────────────────────────────
const typefaceRows = [];
for (const v of myVars.filter((v) => v.resolvedType === 'STRING')) {
  if (!TYPEFACE_RE.test(v.name.toLowerCase())) continue;
  const raw = await resolveRaw(v.id, collModeId);
  typefaceRows.push({ tokenPath: v.name, resolvedValue: typeof raw === 'string' ? raw : '—', codeSyntax: readCS(v) });
}

// ── Page: slug + legacy match ─────────────────────────────────────────────────
const primPage =
  findDesignOpsPage('primitives', {
    legacyExact: ['↳ Primitives'],
    legacyRegex: [/primitives/i],
  }) || null;
if (!primPage) {
  throw new Error(
    'Page not found (expected ↳ Primitives / slug primitives). Pages: ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}

const ctx = {
  pageId: primPage.id,
  docStyles,
  rows: {
    colorRamps,
    ...(spaceRows.length  > 0 && { space:      spaceRows  }),
    ...(radiusRows.length > 0 && { radius:     radiusRows }),
    ...(elevRows.length   > 0 && { elevation:  elevRows   }),
    ...(typefaceRows.length > 0 && { typeface: typefaceRows }),
    ...(weightRows.length > 0 && { fontWeight: weightRows }),
  },
};
const hadVm = 'variableMap' in ctx;
await build(ctx);
const tableGroups = primPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true, step: '15a-primitives', pageId: primPage.id,
  collection: primColl.name,
  hadVariableMapBeforeBuild: hadVm,
  variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
  tableGroups, pageName: primPage.name,
};
