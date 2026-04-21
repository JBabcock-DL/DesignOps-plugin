// ═══════════════════════════════════════════════════════════════════════════
// new-project / phases / _shared-token-helpers.figma.js
// ═══════════════════════════════════════════════════════════════════════════
// Variable-binding helpers + Doc/* text-style helpers shared by the 05b / 05c /
// 05d phase scripts. Previously each phase redeclared these from scratch;
// keeping them in one file means a fix to `bindThemeColor` propagates to every
// doc-header / TOC / Token Overview phase without three-way manual syncing.
//
// How to use: agents running /new-project MUST `Read` this file in full (no
// `limit`) and inline it VERBATIM into the `use_figma` `code` payload for the
// owning phase IMMEDIATELY AFTER the `figma.setCurrentPageAsync(...)` call and
// BEFORE the first helper call-site. A runtime `typeof` assert at the top of
// each phase (`if (typeof bindPrimColor !== 'function') throw ...`) surfaces a
// clear error when the template is missed.
//
// Dependencies from the phase scaffold (already set up by the `.md`/`.figma.js`
// that inlines this file — do NOT re-declare):
//
//   figma                         — Figma Plugin API global
//   figma.loadFontAsync(...)      — fonts loaded at phase start
//
// What this file provides (hoisted to top-level so phase bodies can call them
// regardless of insertion order):
//
//   variableCollections           — cached `figma.variables.getLocalVariableCollections()`
//   allColorVars                  — cached `figma.variables.getLocalVariables('COLOR')`
//   themeCol, primCol             — Theme / Primitives collection handles (may be null)
//
//   getThemeColorVar(path)        — returns Theme variable by name, or null
//   getPrimColorVar(path)         — returns Primitives variable by name, or null
//   hexToRgb(hex)                 — '#rrggbb' → { r, g, b } 0..1 Plugin API Paint input
//   bindThemeColor(node, path, fallbackHex, target='fills')
//   bindPrimColor (node, path, fallbackHex, target='fills')
//   bindThemeStroke(node, path, fallbackHex, weight=1)
//
//   loadTextStylesOnce()          — async, cached `figma.getLocalTextStylesAsync()`
//   applyDocStyle(textNode, styleName, fallback)
//                                 — assigns a published Doc/* text style when
//                                   present; falls back to raw fontName/size/
//                                   lineHeight so Step 17 can upgrade later.
//   tryApplyEffectStyle(node, styleName)
//                                 — async, assigns published Effect/shadow-*
//                                   style when available; silent no-op when
//                                   not (avoids throws on fresh files).
//
// Constants shared across 05b / 05c / 05d:
//
//   DOC_SECTION / DOC_TOKENNAME / DOC_CODE / DOC_CAPTION
//
// Phase-specific DOC_*_UC variants (05c uses DOC_CAPTION_UC @ 8% spacing, 05d
// uses DOC_CODE_UC @ 4%) stay in their owning phase file.
//
// Scope boundary: do NOT also import the create-component `draw-engine.figma.js`
// `bindColor` / `bindNum` helpers here — those use a different signature
// convention (`bindColor(node, varPath, fallback, target)` vs. this file's
// `bindThemeColor(node, path, fallbackHex, target)`). Reconciling them requires
// a dedicated pass and is out of scope for the token-helpers extraction.
// ═══════════════════════════════════════════════════════════════════════════

// ── Variable collection lookup (create-design-system — Canvas documentation visual spec § C) ──
const variableCollections = figma.variables.getLocalVariableCollections();
const allColorVars = figma.variables.getLocalVariables('COLOR');
const themeCol = variableCollections.find(c => c.name === 'Theme');
const primCol  = variableCollections.find(c => c.name === 'Primitives');

function getThemeColorVar(path) {
  if (!themeCol) return null;
  return allColorVars.find(v => v.variableCollectionId === themeCol.id && v.name === path) ?? null;
}
function getPrimColorVar(path) {
  if (!primCol) return null;
  return allColorVars.find(v => v.variableCollectionId === primCol.id && v.name === path) ?? null;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}
function bindThemeColor(node, path, fallbackHex, target = 'fills') {
  const variable = getThemeColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try { paint.boundVariables = { color: figma.variables.createVariableAlias(variable) }; } catch (_) {}
  }
  node[target] = [paint];
}
function bindPrimColor(node, path, fallbackHex, target = 'fills') {
  const variable = getPrimColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try { paint.boundVariables = { color: figma.variables.createVariableAlias(variable) }; } catch (_) {}
  }
  node[target] = [paint];
}
function bindThemeStroke(node, path, fallbackHex, weight = 1) {
  const variable = getThemeColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try { paint.boundVariables = { color: figma.variables.createVariableAlias(variable) }; } catch (_) {}
  }
  node.strokes = [paint];
  node.strokeWeight = weight;
}

// ── Doc/* text-style helpers ──
// Tries to assign textStyleId; falls back to raw fontName/fontSize that Step 17 can upgrade.
let _textStylesCache = null;
async function loadTextStylesOnce() {
  if (_textStylesCache) return _textStylesCache;
  try { _textStylesCache = await figma.getLocalTextStylesAsync(); }
  catch (_) { _textStylesCache = []; }
  return _textStylesCache;
}
async function applyDocStyle(textNode, styleName, fallback) {
  const styles = await loadTextStylesOnce();
  const style = styles.find(s => s.name === styleName);
  if (style) {
    try { await textNode.setTextStyleIdAsync(style.id); return; } catch (_) {}
  }
  textNode.fontName = fallback.fontName;
  textNode.fontSize = fallback.fontSize;
  if (fallback.letterSpacing != null) {
    textNode.letterSpacing = { value: fallback.letterSpacing, unit: 'PERCENT' };
  }
  if (fallback.lineHeight != null) {
    textNode.lineHeight = { value: fallback.lineHeight, unit: 'PIXELS' };
  }
}

// Shared DOC_* constants used by 05b / 05c / 05d. Phase-specific uppercase
// variants (05c DOC_CAPTION_UC @ 8%, 05d DOC_CODE_UC @ 4%) live in the
// owning phase file since their letterSpacing differs.
const DOC_SECTION   = { fontName: { family: 'Inter', style: 'Bold'      }, fontSize: 20, lineHeight: 28 };
const DOC_TOKENNAME = { fontName: { family: 'Inter', style: 'Semi Bold' }, fontSize: 16, lineHeight: 22 };
const DOC_CODE      = { fontName: { family: 'Inter', style: 'Medium'    }, fontSize: 13, lineHeight: 20 };
const DOC_CAPTION   = { fontName: { family: 'Inter', style: 'Regular'   }, fontSize: 12, lineHeight: 18 };

// ── Effect/shadow helper (§ G Depth — optional, skipped when style not yet published) ──
let _effectStylesCache = null;
async function tryApplyEffectStyle(node, styleName) {
  try {
    if (!_effectStylesCache) _effectStylesCache = await figma.getLocalEffectStylesAsync();
    const style = _effectStylesCache.find(s => s.name === styleName);
    if (style) { try { node.effectStyleId = style.id; } catch (_) {} }
  } catch (_) {}
}

// ── Sanity check: assertion consumers in phase files can verify we loaded ──
if (typeof bindThemeColor !== 'function' || typeof bindPrimColor !== 'function') {
  throw new Error('[_shared-token-helpers] helpers did not hoist — verify inline placement');
}
