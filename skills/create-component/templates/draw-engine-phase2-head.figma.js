// ═══════════════════════════════════════════════════════════════════════════
// create-component / draw-engine-phase2-head.figma.js
// ═══════════════════════════════════════════════════════════════════════════
// Spliced ONLY into the phase-2 min bundle (after draw-engine top + optional
// archetype builders from phase 1 — phase-2 bundle omits builders; see
// build-min-templates.mjs). Replaces the variant-build half of §6 so the MCP
// payload does not ship `combineAsVariants` + dispatch a second time.
//
// KEEP IN SYNC: logic must match draw-engine.figma.js §6 from DOC_FRAME_WIDTH
// through the end of the `if (_ccPhase === 2) { ... }` block (compSet load +
// variantByKey). When editing that region in draw-engine, mirror here.
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

// Phase 2: never clear the page — ComponentSet from phase 1 must remain.

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
let propsAdded;
const variantByKey = {};

const pid = typeof __PHASE_1_COMP_SET_ID__ !== 'undefined' ? __PHASE_1_COMP_SET_ID__ : null;
if (!pid) {
  throw new Error(
    '[create-component] phase 2 requires __PHASE_1_COMP_SET_ID__ (ComponentSet id from phase 1). ' +
      'See skills/create-component/EXECUTOR.md (two-phase draw).',
  );
}
const loaded = await figma.getNodeByIdAsync(pid);
if (!loaded || loaded.type !== 'COMPONENT_SET') {
  throw new Error(
    `[create-component] phase 2: node '${pid}' is not a COMPONENT_SET (got ${loaded ? loaded.type : 'null'})`,
  );
}
compSet = loaded;
if (
  typeof __CC_PHASE1_PROPS_ADDED__ === 'undefined' ||
  __CC_PHASE1_PROPS_ADDED__ === null ||
  typeof __CC_PHASE1_PROPS_ADDED__ !== 'object'
) {
  throw new Error(
    '[create-component] phase 2 requires __CC_PHASE1_PROPS_ADDED__ from phase 1 return payload',
  );
}
propsAdded = __CC_PHASE1_PROPS_ADDED__;
for (const node of compSet.children) {
  const parts = node.name.split(', ').reduce((acc, kv) => {
    const [k, val] = kv.split('=');
    acc[k] = val;
    return acc;
  }, {});
  const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
  variantByKey[key] = node;
}
