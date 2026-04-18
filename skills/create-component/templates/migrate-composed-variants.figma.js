// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION — Rewrite existing ComponentSet variant masters to instance stacks
// (`--migrate-to-instances`). Paste into `use_figma` AFTER the agent sets the
// four literals below from Step 4.5 + registry + handoff (see SKILL.md §6.M).
//
// Preconditions:
//   • CONFIG is the full Mode A object (must include non-empty `composes[]`).
//   • REGISTRY_COMPONENTS includes every `composes[].component` + this composite.
//   • Composite was previously drawn as flat chrome (icon slots / label) OR
//     already composed — this script replaces ALL children of each variant COMPONENT.
//   • Recommended: `componentProps` all false for the composite (no TEXT bindings
//     on inner label nodes). If boolean/TEXT props exist, re-bind in Figma after run.
//
// Agent-set literals (replace before running):
//   MIGRATE_COMP_SET_ID — string, ComponentSet node id from registry[CONFIG.component].nodeId
// ═══════════════════════════════════════════════════════════════════════════

const MIGRATE_COMP_SET_ID = 'REPLACE_WITH_REGISTRY_NODE_ID';

// ── Paste variable helpers from main §6 template (bindColor, bindNum, collections)
// or include the same Theme/Layout resolution block as §2–§5 of create-component.

const collections = figma.variables.getLocalVariableCollections();
const allVars = figma.variables.getLocalVariables();
const themeCol = collections.find(c => c.name === 'Theme');
const themeVars = themeCol ? allVars.filter(v => v.variableCollectionId === themeCol.id) : [];
const getColorVar = name => themeVars.find(v => v.name === name) ?? null;
const layoutCol = collections.find(c => c.name === 'Layout');
const layoutVars = layoutCol ? allVars.filter(v => v.variableCollectionId === layoutCol.id) : [];
const getLayoutVar = name => layoutVars.find(v => v.name === name) ?? null;

function bindColor(node, varName, fallbackHex, target = 'fills') {
  const variable = getColorVar(varName);
  const hex = fallbackHex.replace('#', '');
  const paint = {
    type: 'SOLID',
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
  if (variable) {
    paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
  }
  node[target] = [paint];
}

function bindNum(node, field, varName, fallback) {
  node[field] = fallback;
  const variable = getLayoutVar(varName);
  if (variable) {
    try { node.setBoundVariable(field, variable); } catch (_) {}
  }
}

function parseVariantName(name) {
  return name.split(', ').reduce((acc, kv) => {
    const [k, val] = kv.split('=');
    if (k && val) acc[k.trim()] = val.trim();
    return acc;
  }, {});
}

const targetPage = figma.root.children.find(p => p.name === CONFIG.pageName) ?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);

const compSet = figma.getNodeById(MIGRATE_COMP_SET_ID);
if (!compSet || compSet.type !== 'COMPONENT_SET') {
  throw new Error(`Migration: COMPONENT_SET not found at id ${MIGRATE_COMP_SET_ID}`);
}
if (!Array.isArray(CONFIG.composes) || CONFIG.composes.length === 0) {
  throw new Error('Migration: CONFIG.composes is required');
}

const hasSizeAxis = CONFIG.sizes && CONFIG.sizes.length > 0;
const padFallback = CONFIG.padH?.default ?? 'space/md';
const radiusVar = CONFIG.radius ?? 'radius/md';

for (const variantNode of compSet.children) {
  if (variantNode.type !== 'COMPONENT') continue;

  const parts = parseVariantName(variantNode.name);
  const variantKey = parts.variant;
  const sizeTokenKey = hasSizeAxis ? parts.size : null;
  if (!variantKey || !CONFIG.style[variantKey]) {
    console.warn(`Skipping variant with unexpected name: ${variantNode.name}`);
    continue;
  }
  const st = CONFIG.style[variantKey];
  const padH = (sizeTokenKey && CONFIG.padH?.[sizeTokenKey]) || padFallback;

  while (variantNode.children.length > 0) {
    variantNode.children[0].remove();
  }

  variantNode.layoutMode = 'HORIZONTAL';
  variantNode.primaryAxisSizingMode = 'AUTO';
  variantNode.counterAxisSizingMode = 'AUTO';
  variantNode.primaryAxisAlignItems = 'CENTER';
  variantNode.counterAxisAlignItems = 'CENTER';

  bindNum(variantNode, 'paddingLeft',   padH, 16);
  bindNum(variantNode, 'paddingRight',  padH, 16);
  bindNum(variantNode, 'paddingTop',    'space/xs', 8);
  bindNum(variantNode, 'paddingBottom', 'space/xs', 8);
  bindNum(variantNode, 'itemSpacing',  'space/sm', 8);
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(variantNode, f, radiusVar, 6));
  bindColor(variantNode, st.fill, st.fallback, 'fills');
  if (st.strokeVar) {
    bindColor(variantNode, st.strokeVar, '#e5e7eb', 'strokes');
    variantNode.strokeWeight = 1;
  } else {
    variantNode.strokes = [];
    variantNode.strokeWeight = 0;
  }

  for (const spec of CONFIG.composes) {
    const slotFrame = figma.createFrame();
    slotFrame.name = `slot/${spec.slot}`;
    slotFrame.layoutMode = 'HORIZONTAL';
    slotFrame.primaryAxisSizingMode = 'AUTO';
    slotFrame.counterAxisSizingMode = 'AUTO';
    slotFrame.primaryAxisAlignItems = 'CENTER';
    slotFrame.counterAxisAlignItems = 'CENTER';
    bindNum(slotFrame, 'paddingLeft', 'space/none', 0);
    bindNum(slotFrame, 'paddingRight', 'space/none', 0);
    bindNum(slotFrame, 'paddingTop', 'space/none', 0);
    bindNum(slotFrame, 'paddingBottom', 'space/none', 0);
    bindNum(slotFrame, 'itemSpacing', 'space/sm', 8);

    const reg = REGISTRY_COMPONENTS[spec.component];
    if (!reg || !reg.nodeId) {
      throw new Error(`Migration: missing registry entry for composes child '${spec.component}'`);
    }
    const main = figma.getNodeById(reg.nodeId);
    if (!main || main.type !== 'COMPONENT_SET') {
      throw new Error(`Migration: '${spec.component}' registry node is not COMPONENT_SET`);
    }
    const n = spec.cardinality === 'many' ? (spec.count != null ? spec.count : 3) : 1;
    for (let i = 0; i < n; i++) {
      const inst = main.createInstance();
      if (spec.defaultProps && typeof spec.defaultProps === 'object') {
        try {
          inst.setProperties(spec.defaultProps);
        } catch (err) {
          console.warn('setProperties:', err && err.message ? err.message : err);
        }
      }
      slotFrame.appendChild(inst);
    }
    variantNode.appendChild(slotFrame);
  }
}

figma.viewport.scrollAndZoomIntoView([compSet]);

return {
  migrated: true,
  component: CONFIG.component,
  compSetId: compSet.id,
  variantMastersUpdated: compSet.children.filter(n => n.type === 'COMPONENT').length,
};
