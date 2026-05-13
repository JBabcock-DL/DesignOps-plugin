// Concatenate after _lib.js + layout.js (phase 07). Resolves Layout rows in-plugin.
// Collection-scoped: finds the Layout-like collection by fuzzy name match, then draws
// ONLY FLOAT vars from that collection grouped by first path segment.
// Nothing is cross-collected — variables in other collections are untouched.

const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();

// ── Find the Layout-like collection (fuzzy) ───────────────────────────────────
// Priority: registry id → exact "Layout" → keyword match → FLOAT-dominant non-theme collection
function findLayoutCollection() {
  return resolveCollectionByLogicalKey('layout', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Layout');
  if (exact) return exact;
  const fuzzy = collections.find((c) => /layout|spacing|dimensional/i.test(c.name));
  if (fuzzy) return fuzzy;
  const themed = new Set(
    collections
      .filter((c) => c.modes.some((m) => /^light/i.test(m.name)) && c.modes.some((m) => /^dark/i.test(m.name)))
      .map((c) => c.id)
  );
  const floatDominant = collections
    .filter((c) => !themed.has(c.id))
    .map((c) => {
      const vars = allVars.filter((v) => v.variableCollectionId === c.id);
      const floats = vars.filter((v) => v.resolvedType === 'FLOAT').length;
      return { c, ratio: vars.length > 0 ? floats / vars.length : 0, total: vars.length };
    })
    .filter(({ ratio, total }) => ratio > 0.6 && total > 2)
    .sort((a, b) => b.ratio - a.ratio);
  return floatDominant[0]?.c || null;
  });
}

const layoutColl = findLayoutCollection();
if (!layoutColl) {
  throw new Error(
    'No Layout-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
  );
}

const layoutModeId = layoutColl.modes[0].modeId;

// All FLOAT vars scoped to this collection only
const layoutVars = allVars.filter(
  (v) => v.variableCollectionId === layoutColl.id && v.resolvedType === 'FLOAT'
);

async function resolvePx(varId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = layoutModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = collections.find((c) => c.id === next.variableCollectionId);
      m = nextColl ? nextColl.modes[0].modeId : Object.keys(next.valuesByMode)[0];
      v = next;
      continue;
    }
    if (typeof val === 'number') return val;
    return 0;
  }
  return 0;
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

function getAliasName(v) {
  const val = v.valuesByMode[layoutModeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const av = figma.variables.getVariableById(val.id);
    return av ? av.name : '';
  }
  return '';
}

// Group all FLOAT vars by first path segment
const groupMap = {};
const groupOrder = [];
for (const v of layoutVars) {
  const firstSeg = v.name.split('/')[0];
  if (!groupMap[firstSeg]) {
    groupMap[firstSeg] = [];
    groupOrder.push(firstSeg);
  }
  groupMap[firstSeg].push(v);
}

// Build rows for each group, sorted by resolved px value
const rows = {};
for (const group of groupOrder) {
  const groupRows = [];
  for (const v of groupMap[group]) {
    const px = await resolvePx(v.id);
    const isFullOrPill =
      v.name.toLowerCase().includes('full') || v.name.toLowerCase().includes('pill') || px >= 9999;
    groupRows.push({
      tokenPath: v.name,
      resolvedPx: isFullOrPill ? 9999 : px,
      aliasPath: getAliasName(v),
      codeSyntax: readCS(v),
    });
  }
  groupRows.sort((a, b) => a.resolvedPx - b.resolvedPx);
  rows[group] = groupRows;
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const layoutPage =
  findDesignOpsPage('layout', {
    legacyExact: ['↳ Layout'],
    legacyRegex: [/^↳?\s*layout/i],
  }) || null;
if (!layoutPage || layoutPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Layout / slug layout). Pages: ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}

const ctx = { pageId: layoutPage.id, docStyles, rows };
await build(ctx);
const tableGroups = layoutPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true, step: '15c-layout', pageId: layoutPage.id,
  collection: layoutColl.name,
  tableGroups, pageName: layoutPage.name,
};
