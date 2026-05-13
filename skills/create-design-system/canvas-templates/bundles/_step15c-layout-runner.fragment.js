// Concatenate after _lib.js + layout.js (phase 07). Resolves Layout rows in-plugin; ctx omits variableMap.
// Fully dynamic — discovers all Layout FLOAT variables grouped by first path segment.
// Handles any naming convention (space/xs, padding/md, radius/lg, border/sm, etc.).
const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const layoutColl = collections.find((c) => c.name === 'Layout');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!layoutColl) throw new Error('Layout collection missing');
const layoutModeId = layoutColl.modes[0].modeId;
const primModeId = primColl ? primColl.modes[0].modeId : layoutModeId;

async function resolvePx(varId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = v.variableCollectionId === layoutColl.id ? layoutModeId : primModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      if (next.variableCollectionId === layoutColl.id) m = layoutModeId;
      else if (primColl && next.variableCollectionId === primColl.id) m = primModeId;
      else m = (await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId)).modes[0].modeId;
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

// Group all Layout FLOAT variables by first path segment
const layoutVars = allVars.filter(
  (v) => v.variableCollectionId === layoutColl.id && v.resolvedType === 'FLOAT'
);
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

const layoutPage = figma.root.children.find((pg) => pg.name === '↳ Layout');
if (!layoutPage || layoutPage.type !== 'PAGE') {
  throw new Error('Page not found (expected ↳ Layout)');
}

const ctx = {
  pageId: layoutPage.id,
  docStyles,
  rows,
};
await build(ctx);
const tableGroups = layoutPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15c-layout', pageId: layoutPage.id, tableGroups, pageName: layoutPage.name };
