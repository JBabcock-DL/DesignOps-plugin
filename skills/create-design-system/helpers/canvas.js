/**
 * Detroit Labs — shared `use_figma` helpers for style-guide + Token Overview steps.
 * The agent prepends this file’s contents (as a plain string) before phase scripts
 * that draw documentation tables (Steps 15a–17). Loaded by reference from
 * `skills/create-design-system/phases/07-steps15-17-canvas.md`.
 *
 * Environment: Figma Plugin API inside `use_figma` (see figma-use skill).
 */

function __dlResolveVariableByPath(path, cache) {
  const v = cache[path];
  if (!v) throw new Error("Missing variable in cache: " + path);
  return v;
}

function __dlBindFillToVariable(node, variable) {
  const paint = { type: "SOLID", color: { r: 1, g: 1, b: 1 } };
  const bound = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  node.fills = [bound];
}

function __dlBindStrokeToVariable(node, variable) {
  if (!node.strokes || node.strokes.length === 0) {
    node.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  }
  const p = JSON.parse(JSON.stringify(node.strokes[0]));
  const bound = figma.variables.setBoundVariableForPaint(p, "color", variable);
  node.strokes = [bound];
}

/** Theme semantic color on a solid fill (e.g. swatch chips). */
function bindThemeColor(node, themeVar, cache) {
  const v = __dlResolveVariableByPath(themeVar, cache);
  __dlBindFillToVariable(node, v);
}

/** Primitives ramp swatch — bind to the Primitive color variable for `path`. */
function bindPrimColor(node, primPath, cache) {
  const v = __dlResolveVariableByPath(primPath, cache);
  __dlBindFillToVariable(node, v);
}

/** Theme variable on stroke only (e.g. table chrome). */
function bindThemeStroke(node, themeVar, cache) {
  const v = __dlResolveVariableByPath(themeVar, cache);
  __dlBindStrokeToVariable(node, v);
}

/** Apply a published text style by name if found; returns boolean. */
function applyDocStyle(textNode, styleName) {
  const styles = figma.getLocalTextStyles();
  const found = styles.find((s) => s.name === styleName);
  if (!found) return false;
  textNode.textStyleId = found.id;
  return true;
}

/** Apply effect style by name when present (shadow-sm tiering). */
function tryApplyEffectStyle(node, effectStyleName) {
  const styles = figma.getLocalEffectStyles();
  const found = styles.find((s) => s.name === effectStyleName);
  if (!found) return false;
  node.effectStyleId = found.id;
  return true;
}
