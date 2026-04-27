// Wire format for cc-doc-scaffold ops: shorter JSON keys + string table for token paths.
// Must stay in sync with wireExpand* in op-interpreter.figma.js

/** @param {string[]} acc */
function addStr(acc, s) {
  if (s == null || s === '') return -1;
  const i = acc.indexOf(s);
  if (i >= 0) return i;
  acc.push(s);
  return acc.length - 1;
}

/**
 * @param {object} p verbose frame props
 * @param {string[]} strPool
 * @returns {object}
 */
export function toWireFrameProps(p, strPool) {
  const o = {};
  if (p.name != null) o.n = p.name;
  if (p.layoutMode != null) o.L = p.layoutMode === 'HORIZONTAL' ? 1 : 0;
  if (p.width != null) o.w = p.width;
  if (p.height != null) o.H = p.height;
  if (p.primaryAxisSizingMode != null) o.P = p.primaryAxisSizingMode === 'FIXED' ? 1 : 0;
  if (p.counterAxisSizingMode != null) o.C = p.counterAxisSizingMode === 'FIXED' ? 0 : 1;
  if (p.layoutAlign === 'STRETCH') o.g = 1;
  if (p.itemSpacing != null) o.i = p.itemSpacing;
  if (p.paddingTop != null) o.t = p.paddingTop;
  if (p.paddingRight != null) o.r = p.paddingRight;
  if (p.paddingBottom != null) o.b = p.paddingBottom;
  if (p.paddingLeft != null) o.p = p.paddingLeft;
  if (p.primaryAxisAlignItems != null) o.a = p.primaryAxisAlignItems === 'CENTER' ? 1 : 0;
  if (p.counterAxisAlignItems != null) o.u = p.counterAxisAlignItems === 'CENTER' ? 1 : p.counterAxisAlignItems === 'MIN' ? 2 : 0;
  if (p.clipsContent != null) o.v = p.clipsContent ? 1 : 0;
  if (p.minHeight != null) o.m = p.minHeight;
  if (p.cornerRadius != null) o.R = p.cornerRadius;
  if (p.visible != null) o.V = p.visible ? 1 : 0;
  if (p.x != null) o.x = p.x;
  if (p.y != null) o.y = p.y;
  if (p.strokes) o.st = p.strokes;
  if (p.clearStroke) o.z = 1;
  if (p.strokeWeight != null) o.o = p.strokeWeight;
  if (p.dashPattern) o.Q = p.dashPattern;
  if (p.strokeTopWeight != null) o.k = p.strokeTopWeight;
  if (p.strokeRightWeight != null) o.q = p.strokeRightWeight;
  if (p.strokeBottomWeight != null) o.D = p.strokeBottomWeight;
  if (p.strokeLeftWeight != null) o.j = p.strokeLeftWeight;
  if (p.fills) {
    const f0 = p.fills[0];
    if (p.fills.length === 1 && f0 && f0.type === 'SOLID' && f0.color
      && f0.color.r === 1 && f0.color.g === 1 && f0.color.b === 1) {
      o.I = 0;
    } else {
      o.I = p.fills;
    }
  }
  if (p.clearFill) o.d = 1;
  if (p.fillVar != null) o.f = addStr(strPool, p.fillVar);
  if (p.fillHex != null) o.E = p.fillHex;
  if (p.strokeVar != null) o.s = addStr(strPool, p.strokeVar);
  if (p.strokeHex != null) o.e = p.strokeHex;
  return o;
}

const SKI = { section: 0, tokenName: 1, code: 2, caption: 3 };
export function toWireTextProps(styleKey, p, strPool) {
  const o = {};
  if (p.name != null) o.n = p.name;
  if (p.characters != null) o.c = p.characters;
  if (p.fontSize != null) o.F = p.fontSize;
  if (p.textAutoResize != null) o.T = p.textAutoResize === 'HEIGHT' ? 1 : 0;
  if (p.resizeW != null) o.W = p.resizeW;
  if (p.fillVar != null) o.f = addStr(strPool, p.fillVar);
  if (p.fillHex != null) o.E = p.fillHex;
  if (p.textStyleId != null) o.K = p.textStyleId;
  o.Y = SKI[styleKey] != null ? SKI[styleKey] : 3;
  return o;
}

/**
 * @param {import('./cc-doc-scaffold.mjs').buildScaffold1Ops extends (...args: any) => infer R ? R : never} verboseOps
 */
export function toWireScaffoldOps(verboseOps) {
  const strPool = [];
  const out = [];
  for (const raw of verboseOps) {
    if (!Array.isArray(raw) || raw.length < 1) {
      out.push(raw);
      continue;
    }
    const k = raw[0];
    if (k === 0) {
      out.push([0, raw[1], toWireFrameProps(raw[2] || {}, strPool)]);
    } else if (k === 1) {
      out.push([1, raw[1], 0, toWireTextProps(raw[2] || null, raw[3] || {}, strPool)]);
    } else {
      out.push(raw);
    }
  }
  return { wireOps: out, strings: strPool };
}
