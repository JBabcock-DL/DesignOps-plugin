// ═══════════════════════════════════════════════════════════════════════════
// op-interpreter.figma.js — JSON op runtime for /create-component doc slices
// Minified to op-interpreter.runtime.min.figma.js (npm run build:min)
// Replaces per-step min engine bytes with: runtime + data ops (generate-ops.mjs)
// ═══════════════════════════════════════════════════════════════════════════
// Preamble + CONFIG are assembled upstream; this file runs after them.
// Expects: CONFIG, §0a identifiers from preamble (same as draw-engine).
// ═══════════════════════════════════════════════════════════════════════════

// ── Preamble gate (identical contract to draw-engine.figma.js §0a) ───────
{
  const preambleGate = {
    CONFIG:              typeof CONFIG,
    ACTIVE_FILE_KEY:     typeof ACTIVE_FILE_KEY,
    REGISTRY_COMPONENTS: typeof REGISTRY_COMPONENTS,
    usesComposes:        typeof usesComposes,
    logFileKeyMismatch:  typeof logFileKeyMismatch,
    _fileKeyObserved:     typeof _fileKeyObserved,
    _fileKeyMismatch:     typeof _fileKeyMismatch,
  };
  const missing = Object.entries(preambleGate)
    .filter(([, t]) => t === 'undefined')
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `[create-component] op-interpreter: missing [${missing.join(', ')}]. Inline preamble.figma.js before this bundle.`,
    );
  }
}

const targetPage = figma.root.children.find(p => p.name === CONFIG.pageName) ?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);

const collections = figma.variables.getLocalVariableCollections();
const allVars = figma.variables.getLocalVariables();
const themeCol = collections.find(c => c.name === 'Theme');
const themeVars = themeCol ? allVars.filter(v => v.variableCollectionId === themeCol.id) : [];
const getColorVar = name => themeVars.find(v => v.name === name) ?? null;
const layoutCol = collections.find(c => c.name === 'Layout');
const layoutVars = layoutCol ? allVars.filter(v => v.variableCollectionId === layoutCol.id) : [];
const getLayoutVar = name => layoutVars.find(v => v.name === name) ?? null;
const typoCol = collections.find(c => c.name === 'Typography');
const typoVars = typoCol ? allVars.filter(v => v.variableCollectionId === typoCol.id) : [];
const getTypoVar = name => typoVars.find(v => v.name === name) ?? null;

const _unresolvedTokenMisses = [];
if (typeof __CC_PHASE1_UNRESOLVED__ !== 'undefined' && Array.isArray(__CC_PHASE1_UNRESOLVED__)) {
  for (const m of __CC_PHASE1_UNRESOLVED__) _unresolvedTokenMisses.push(m);
}
function _recordUnresolved(kind, path, fallback, node) {
  _unresolvedTokenMisses.push({
    kind, path, fallback,
    nodeName: (node && typeof node.name === 'string') ? node.name : null,
  });
}

function readTypoString(variable) {
  if (!variable || !typoCol) return null;
  const baseMode = typoCol.modes.find(m => m.name === '100');
  if (!baseMode) return null;
  const val = variable.valuesByMode[baseMode.modeId];
  return (typeof val === 'string' && val.length > 0) ? val : null;
}

const labelFontVar   = getTypoVar('Label/LG/font-family');
const displayFontVar = getTypoVar('Display/LG/font-family');
const labelFont   = readTypoString(labelFontVar)   ?? 'Inter';
const displayFont = readTypoString(displayFontVar) ?? labelFont;

await figma.loadFontAsync({ family: labelFont,   style: 'Regular' });
await figma.loadFontAsync({ family: labelFont,   style: 'Medium'  });
if (displayFont !== labelFont) {
  await figma.loadFontAsync({ family: displayFont, style: 'Regular' });
  await figma.loadFontAsync({ family: displayFont, style: 'Medium'  });
}

const allTextStyles = await figma.getLocalTextStylesAsync();
const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
  section:   getDocStyle('Doc/Section'),
  tokenName: getDocStyle('Doc/TokenName'),
  code:      getDocStyle('Doc/Code'),
  caption:   getDocStyle('Doc/Caption'),
};

function bindColor(node, varName, fallbackHex, target = 'fills') {
  const variable = varName ? getColorVar(varName) : null;
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
  } else if (varName) {
    _recordUnresolved('color', varName, fallbackHex, node);
  }
  node[target] = [paint];
}

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

const DOC_FRAME_WIDTH = 1640;
const layoutKey = usesComposes ? '__composes__' : (CONFIG.layout || 'chip');

/**
 * @param {Record<string, import('@figma/plugin-typings').SceneNode>} refs
 * @param {string} parentKey '__page__' | node id
 */
function resolveParent(refs, parentKey) {
  if (parentKey === '__page__') return figma.currentPage;
  const n = refs[parentKey];
  if (!n) throw new Error(`[op] unknown parent ref '${parentKey}'`);
  return n;
}

/**
 * @param {import('@figma/plugin-typings').FrameNode} f
 * @param {object} p frame props (subset)
 */
function applyFrameProps(f, p) {
  if (p.name != null) f.name = p.name;
  if (p.layoutMode != null) f.layoutMode = p.layoutMode;
  if (p.width != null) f.resize(p.width, p.height != null ? p.height : 1);
  if (p.primaryAxisSizingMode != null) f.primaryAxisSizingMode = p.primaryAxisSizingMode;
  if (p.counterAxisSizingMode != null) f.counterAxisSizingMode = p.counterAxisSizingMode;
  if (p.layoutAlign != null) f.layoutAlign = p.layoutAlign;
  if (p.itemSpacing != null) f.itemSpacing = p.itemSpacing;
  if (p.paddingTop != null) f.paddingTop = p.paddingTop;
  if (p.paddingRight != null) f.paddingRight = p.paddingRight;
  if (p.paddingBottom != null) f.paddingBottom = p.paddingBottom;
  if (p.paddingLeft != null) f.paddingLeft = p.paddingLeft;
  if (p.primaryAxisAlignItems != null) f.primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems != null) f.counterAxisAlignItems = p.counterAxisAlignItems;
  if (p.clipsContent != null) f.clipsContent = p.clipsContent;
  if (p.minHeight != null) f.minHeight = p.minHeight;
  if (p.cornerRadius != null) f.cornerRadius = p.cornerRadius;
  if (p.visible != null) f.visible = p.visible;
  if (p.x != null) f.x = p.x;
  if (p.y != null) f.y = p.y;
  if (p.strokes) {
    f.strokes = p.strokes;
  } else if (p.clearStroke) {
    f.strokes = [];
  }
  if (p.strokeWeight != null) f.strokeWeight = p.strokeWeight;
  if (p.dashPattern) f.dashPattern = p.dashPattern;
  if (p.strokeTopWeight != null) f.strokeTopWeight = p.strokeTopWeight;
  if (p.strokeRightWeight != null) f.strokeRightWeight = p.strokeRightWeight;
  if (p.strokeBottomWeight != null) f.strokeBottomWeight = p.strokeBottomWeight;
  if (p.strokeLeftWeight != null) f.strokeLeftWeight = p.strokeLeftWeight;
  if (p.fills) {
    f.fills = p.fills;
  } else if (p.clearFill) {
    f.fills = [];
  } else if (p.fillVar || p.fillHex) {
    bindColor(f, p.fillVar, p.fillHex || '#ffffff', 'fills');
  }
  if (p.strokeVar) {
    bindColor(f, p.strokeVar, p.strokeHex || '#e5e7eb', 'strokes');
  }
}

/**
 * @param {import('@figma/plugin-typings').TextNode} t
 * @param {object} p
 */
function applyTextProps(t, p) {
  if (p.name != null) t.name = p.name;
  if (p.characters != null) t.characters = String(p.characters);
  if (p.fontSize != null && !t.textStyleId) t.fontSize = p.fontSize;
  if (p.textStyleId != null) t.textStyleId = p.textStyleId;
  if (p.textAutoResize != null) t.textAutoResize = p.textAutoResize;
  if (p.resizeW != null) t.resize(p.resizeW, 1);
  if (p.fillVar != null) bindColor(t, p.fillVar, p.fillHex || '#0a0a0a', 'fills');
}

function rS(x) {
  if (typeof x === 'number' && typeof __S !== 'undefined' && __S && __S[x] != null) {
    return __S[x];
  }
  return x;
}

/**
 * @param {Record<string, unknown>} p
 * @returns {object}
 */
function wF(p) {
  if (!p || p.layoutMode != null) return p;
  if (typeof p.L !== 'number' && p.P == null && p.C == null && p.f == null) return p;
  const o = {};
  if (p.n != null) o.name = p.n;
  if (typeof p.L === 'number') o.layoutMode = p.L === 1 ? 'HORIZONTAL' : 'VERTICAL';
  if (p.w != null) o.width = p.w;
  if (p.H != null) o.height = p.H;
  if (p.P != null) o.primaryAxisSizingMode = p.P === 1 ? 'FIXED' : 'AUTO';
  if (p.C != null) o.counterAxisSizingMode = p.C === 0 ? 'FIXED' : 'AUTO';
  if (p.g === 1) o.layoutAlign = 'STRETCH';
  if (p.i != null) o.itemSpacing = p.i;
  if (p.t != null) o.paddingTop = p.t;
  if (p.r != null) o.paddingRight = p.r;
  if (p.b != null) o.paddingBottom = p.b;
  if (p.p != null) o.paddingLeft = p.p;
  if (p.a != null) o.primaryAxisAlignItems = p.a === 1 ? 'CENTER' : 'MIN';
  if (p.u != null) {
    o.counterAxisAlignItems = p.u === 1 ? 'CENTER' : p.u === 2 ? 'MIN' : 'MAX';
  }
  if (p.v != null) o.clipsContent = !!p.v;
  if (p.m != null) o.minHeight = p.m;
  if (p.R != null) o.cornerRadius = p.R;
  if (p.V != null) o.visible = !!p.V;
  if (p.x != null) o.x = p.x;
  if (p.y != null) o.y = p.y;
  if (p.st) o.strokes = p.st;
  if (p.z) o.clearStroke = true;
  if (p.o != null) o.strokeWeight = p.o;
  if (p.Q) o.dashPattern = p.Q;
  if (p.k != null) o.strokeTopWeight = p.k;
  if (p.q != null) o.strokeRightWeight = p.q;
  if (p.D != null) o.strokeBottomWeight = p.D;
  if (p.j != null) o.strokeLeftWeight = p.j;
  if (p.I != null) {
    if (p.I === 0) {
      o.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    } else {
      o.fills = p.I;
    }
  }
  if (p.d) o.clearFill = true;
  if (p.f != null) o.fillVar = rS(p.f);
  if (p.E != null) o.fillHex = p.E;
  if (p.s != null) o.strokeVar = rS(p.s);
  if (p.e != null) o.strokeHex = p.e;
  return o;
}

/**
 * @param {Record<string, unknown>} p
 * @returns {object}
 */
function wT(p) {
  if (!p || p.Y == null) return p;
  const o = {};
  if (p.n != null) o.name = p.n;
  if (p.c != null) o.characters = p.c;
  if (p.F != null) o.fontSize = p.F;
  if (p.T != null) o.textAutoResize = p.T === 1 ? 'HEIGHT' : 'WIDTH';
  if (p.W != null) o.resizeW = p.W;
  if (p.f != null) o.fillVar = rS(p.f);
  if (p.E != null) o.fillHex = p.E;
  if (p.K != null) o.textStyleId = p.K;
  return o;
}

const WIRE_SK = ['section', 'tokenName', 'code', 'caption'];

/**
 * @param {unknown} raw
 * @returns {{ op: string, id?: string, parent?: string, child?: string, props?: object, styleKey?: string }}
 */
function normalizeOp(raw) {
  if (Array.isArray(raw) && raw.length >= 1) {
    const k = raw[0];
    if (k === 0) {
      const pr = raw[2] || {};
      return { op: 'frame', id: raw[1], props: wF(pr) };
    }
    if (k === 1) {
      if (raw.length >= 4 && raw[2] === 0) {
        const wp = /** @type {Record<string, unknown>} */ (raw[3] || {});
        const yi = /** @type {number} */ (wp.Y);
        const sk = WIRE_SK[yi] != null ? WIRE_SK[yi] : 'caption';
        return { op: 'text', id: raw[1], styleKey: sk, props: wT(wp) };
      }
      return { op: 'text', id: raw[1], styleKey: raw[2], props: raw[3] || {} };
    }
    if (k === 2) {
      return { op: 'append', parent: raw[1], child: raw[2] };
    }
  }
  if (raw && typeof raw === 'object' && raw.op) {
    return /** @type {any} */ (raw);
  }
  return { op: '' };
}

/**
 * @param {Array<unknown>} ops
 */
async function __ccRunOps(ops) {
  const refs = Object.create(null);
  // Fresh scaffold shell (no handoff yet): mirror draw-engine §6.0 — keep `_Header` only.
  // Without this, `/new-project` pages already have `_PageContent` at y=320; shell would
  // append a *second* `_PageContent` and `findOne('_PageContent')` would return the *template*
  // frame (wrong ids / overlap with the black `_Header`). Continuation slices always set
  // __CC_HANDOFF_DOC_ROOT_ID__ from the prior merge.
  const hasHandoffDocRoot =
    typeof __CC_HANDOFF_DOC_ROOT_ID__ === 'string' && __CC_HANDOFF_DOC_ROOT_ID__.length > 0;
  if (!hasHandoffDocRoot) {
    for (const node of [...figma.currentPage.children]) {
      if (node.name === '_Header') continue;
      node.remove();
    }
  }
  // Continuation scaffold sub-slices: parent ids from merge handoff (same symbolic keys 'pc' / 'dr' as first slice)
  if (typeof __CC_HANDOFF_DOC_ROOT_ID__ === 'string' && __CC_HANDOFF_DOC_ROOT_ID__.length) {
    const dr = await figma.getNodeByIdAsync(__CC_HANDOFF_DOC_ROOT_ID__);
    if (dr && 'appendChild' in dr) refs.dr = dr;
    if (typeof __CC_HANDOFF_PAGE_CONTENT_ID__ === 'string' && __CC_HANDOFF_PAGE_CONTENT_ID__.length) {
      const pc = await figma.getNodeByIdAsync(__CC_HANDOFF_PAGE_CONTENT_ID__);
      if (pc && 'appendChild' in pc) refs.pc = pc;
    }
  }
  if (typeof __CC_HANDOFF_SCAFFOLD_TABLE_ID__ === 'string' && __CC_HANDOFF_SCAFFOLD_TABLE_ID__.length) {
    const tb = await figma.getNodeByIdAsync(__CC_HANDOFF_SCAFFOLD_TABLE_ID__);
    if (tb && 'appendChild' in tb) refs.table = tb;
  }
  for (const raw of ops) {
    const o = normalizeOp(raw);
    if (!o || !o.op) continue;
    if (o.op === 'frame') {
      const f = figma.createFrame();
      applyFrameProps(f, o.props || {});
      if (o.id) refs[o.id] = f;
    } else if (o.op === 'text') {
      const t = figma.createText();
      t.fontName = { family: labelFont, style: 'Regular' };
      if (o.styleKey && DOC[o.styleKey]) {
        t.textStyleId = DOC[o.styleKey].id;
      } else if (o.props && o.props.fontSize != null) {
        t.fontSize = o.props.fontSize;
      }
      if (o.props) applyTextProps(t, o.props);
      if (o.id) refs[o.id] = t;
    } else if (o.op === 'append') {
      const parent = resolveParent(refs, o.parent);
      const child = refs[o.child];
      if (!child) throw new Error(`[op] append: missing child ref '${o.child}'`);
      parent.appendChild(child);
    } else {
      throw new Error(`[op] unknown op '${o.op}'`);
    }
  }
  return refs;
}

// Export name used by generate-ops assembly (unminified / mangled: keep string in assemble)
async function runCreateComponentOpList(userOps) {
  return __ccRunOps(userOps);
}

/**
 * @param {import('@figma/plugin-typings').FrameNode} pageContent
 * @param {import('@figma/plugin-typings').FrameNode} docRoot
 * @param {number} docStep
 * @param {Awaited<ReturnType<typeof runCreateComponentOpList>> | undefined} scaffoldRefs
 */
function __ccHandoffAfter(pageContent, docRoot, docStep, scaffoldRefs) {
  const o = {
    ok: true,
    docStep,
    pageContentId: pageContent.id,
    docRootId: docRoot.id,
    propsAdded:
      typeof __CC_PHASE1_PROPS_ADDED__ !== 'undefined' &&
      __CC_PHASE1_PROPS_ADDED__ !== null &&
      typeof __CC_PHASE1_PROPS_ADDED__ === 'object'
        ? __CC_PHASE1_PROPS_ADDED__
        : {},
    unresolvedTokenMisses: _unresolvedTokenMisses.slice(),
    layout: layoutKey === '__composes__' ? 'composes' : (CONFIG.layout || 'chip'),
  };
  if (scaffoldRefs && scaffoldRefs.table && 'id' in scaffoldRefs.table) {
    o.propertiesTableId = scaffoldRefs.table.id;
  }
  return o;
}

// ── cc-doc-scaffold: execute op list, then return handoff (step 1) ──────
// Assembly appends: return await runScaffold1();  which closes over __OPS
async function runScaffold1FromOps(__OPS) {
  const scaffoldRefs = await __ccRunOps(__OPS);
  const pageContent = /** @type {import('@figma/plugin-typings').FrameNode} */ (figma.currentPage.findOne(
    n => n.name === '_PageContent',
  ));
  const docRoot = /** @type {import('@figma/plugin-typings').FrameNode} */ (figma.currentPage.findOne(
    n => n.name === `doc/component/${CONFIG.component}`,
  ));
  if (!pageContent || pageContent.type !== 'FRAME') {
    throw new Error('[op] scaffold: _PageContent missing');
  }
  if (!docRoot || docRoot.type !== 'FRAME') {
    throw new Error(`[op] scaffold: doc/component/${CONFIG.component} missing`);
  }
  return __ccHandoffAfter(pageContent, docRoot, 1, scaffoldRefs);
}

// generate-ops prepends: const __OP_LIST__ = [...];
// Phase 5: optional — cache variable/style maps in clientStorage (loadVarContext at slice start, clear at finalize)
async function __ccLoadVarContext() {
  if (typeof figma.clientStorage === 'undefined') return;
  // Non-fatal no-op when disabled; real implementation: key cc:ctx:<component>:<fileKey>
}
async function __ccClearVarContext() {
  if (typeof figma.clientStorage === 'undefined') return;
}
return await runScaffold1FromOps(__OP_LIST__);
