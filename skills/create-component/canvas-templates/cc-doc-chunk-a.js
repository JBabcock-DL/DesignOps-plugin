// --- 6.1  Resolve published Doc/* text styles + makeText ----------------
// conventions/04-doc-pipeline-contract.md §7 — every doc text node must assign textStyleId.
//
// REUSE — do NOT re-fetch. `allTextStyles` is already populated by §5.5
// (see that block's comment for why the await must live above buildVariant).
// Calling `figma.getLocalTextStylesAsync()` a second time here is safe but
// wasteful; inlining it inside any helper is a syntax error.

const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
  section:   getDocStyle('Doc/Section'),
  tokenName: getDocStyle('Doc/TokenName'),
  code:      getDocStyle('Doc/Code'),
  caption:   getDocStyle('Doc/Caption'),
};

// 4-arg makeText — the 4th arg is a Theme var path bound to the text fill.
// bindColor is defined at §5 above.
function makeText(chars, styleKey, fallbackSize = 13, fillVar = 'color/background/content') {
  const t = figma.createText();
  t.fontName = { family: labelFont, style: 'Regular' };
  t.characters = String(chars);
  if (DOC[styleKey]) t.textStyleId = DOC[styleKey].id;
  else t.fontSize = fallbackSize;
  t.textAutoResize = 'HEIGHT';   // CRITICAL — prevents 10px row collapse
  bindColor(t, fillVar, '#0a0a0a', 'fills');
  return t;
}

