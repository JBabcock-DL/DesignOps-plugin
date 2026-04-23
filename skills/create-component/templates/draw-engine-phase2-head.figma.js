// ═══════════════════════════════════════════════════════════════════════════
// create-component / draw-engine-phase2-head.figma.js
// ═══════════════════════════════════════════════════════════════════════════
// Spliced ONLY into the phase-2 min bundle (after draw-engine top + optional
// archetype builders from phase 1 — phase-2 bundle omits builders; see
// build-min-templates.mjs). Replaces the variant-build half of §6 so the MCP
// payload does not ship `combineAsVariants` + dispatch a second time.
//
// KEEP IN SYNC: logic must match draw-engine.figma.js §6 from DOC_FRAME_WIDTH
// through the end of the `if (_ccPhase === 2) { ... }` block (holder / compSet
// load + variantByKey). When editing that region in draw-engine, mirror here.
// ═══════════════════════════════════════════════════════════════════════════

const DOC_FRAME_WIDTH = 1640;
const GUTTER_W_SIZE = 60;
const GUTTER_W_VARIANT = 160;

const _ccPhase = typeof __CREATE_COMPONENT_PHASE__ === 'undefined' ? 0 : __CREATE_COMPONENT_PHASE__;
if (_ccPhase !== 2) {
  throw new Error(
    `[create-component] phase-2 engine bundle requires __CREATE_COMPONENT_PHASE__ === 2; got ${_ccPhase}`,
  );
}

// Phase 2: never clear the page — variant staging frame or ComponentSet from prior slices must remain.

const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
  section: getDocStyle('Doc/Section'),
  tokenName: getDocStyle('Doc/TokenName'),
  code: getDocStyle('Doc/Code'),
  caption: getDocStyle('Doc/Caption'),
};

function makeText(chars, styleKey, fallbackSize = 13, fillVar = 'color/background/content') {
  const t = figma.createText();
  t.fontName = { family: labelFont, style: 'Regular' };
  t.characters = String(chars);
  if (DOC[styleKey]) t.textStyleId = DOC[styleKey].id;
  else t.fontSize = fallbackSize;
  t.textAutoResize = 'HEIGHT';
  bindColor(t, fillVar, '#0a0a0a', 'fills');
  return t;
}

const hasSizeAxis = CONFIG.sizes && CONFIG.sizes.length > 0;
const layoutKey = usesComposes ? '__composes__' : (CONFIG.layout || 'chip');

let compSet;
let variantBuildHolder = null;
let propsAdded;
const variantByKey = {};

const compSetHandoff =
  typeof __CC_HANDOFF_COMP_SET_ID__ !== 'undefined' ? __CC_HANDOFF_COMP_SET_ID__ : null;
const variantHid =
  typeof __PHASE_1_VARIANT_HOLDER_ID__ !== 'undefined' ? __PHASE_1_VARIANT_HOLDER_ID__ : null;
const docStepProbe =
  typeof __CREATE_COMPONENT_DOC_STEP__ === 'number' ? __CREATE_COMPONENT_DOC_STEP__ : null;

if (docStepProbe === 1 && !compSetHandoff && !variantHid) {
  propsAdded =
    typeof __CC_PHASE1_PROPS_ADDED__ !== 'undefined' &&
    __CC_PHASE1_PROPS_ADDED__ !== null &&
    typeof __CC_PHASE1_PROPS_ADDED__ === 'object'
      ? __CC_PHASE1_PROPS_ADDED__
      : {};
} else if (
  typeof __CC_PHASE1_PROPS_ADDED__ === 'undefined' ||
  __CC_PHASE1_PROPS_ADDED__ === null ||
  typeof __CC_PHASE1_PROPS_ADDED__ !== 'object'
) {
  throw new Error(
    '[create-component] phase 2 requires __CC_PHASE1_PROPS_ADDED__ from phase 1 return payload',
  );
} else {
  propsAdded = __CC_PHASE1_PROPS_ADDED__;
}

if (docStepProbe === 1 && !compSetHandoff && !variantHid) {
  compSet = null;
  variantBuildHolder = null;
} else if (compSetHandoff) {
  const loaded = await figma.getNodeByIdAsync(compSetHandoff);
  if (!loaded || loaded.type !== 'COMPONENT_SET') {
    throw new Error(
      `[create-component] phase 2: node '${compSetHandoff}' is not a COMPONENT_SET (got ${loaded ? loaded.type : 'null'})`,
    );
  }
  compSet = loaded;
  for (const node of compSet.children) {
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }
} else if (variantHid) {
  const holder = await figma.getNodeByIdAsync(variantHid);
  if (!holder || holder.type !== 'FRAME') {
    throw new Error(
      `[create-component] phase 2: variant holder '${variantHid}' missing or not a FRAME (got ${holder ? holder.type : 'null'})`,
    );
  }
  variantBuildHolder = holder;
  compSet = null;
  for (const node of holder.children) {
    if (node.type !== 'COMPONENT') continue;
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }
} else {
  throw new Error(
    '[create-component] phase 2 requires __CC_HANDOFF_COMP_SET_ID__ (after doc component step) or ' +
      '__PHASE_1_VARIANT_HOLDER_ID__ (staging frame from `cc-variants`), or doc step 1 with no variants yet.',
  );
}
