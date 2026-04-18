# Phase 05c — Table of Contents layout

## Runtime order
Runs **after** Phase 05 (pages exist) and **before** Phase 05b in the orchestrator.

## Goal
Draw the TOC body inside `_PageContent` on `📝 Table of Contents`. **Do not** set hyperlinks here (Phase 05f).

## Prerequisites
- Phase 05 complete.

## Placeholders
None.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

Before editing this script, **`Read`** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§ A–G). The TOC renders at the same 1720 inner width as `↳ Token Overview` and follows the same `Doc/*` text-style + shadow-sm rhythm as style-guide pages — so the four system "bands" each get a 64-tall strip (`color/background/variant`) above a 2-column card grid, cards use `color/background/default` + `color/border/subtle` + `Effect/shadow-sm`, and every text node either carries `textStyleId` (when Doc/* styles exist) or a raw-font fallback that `/create-design-system` Step 15c § 0 can upgrade.

## Success criteria
Four band strips (`band-strip/{slug}`) separating Foundations / Atoms / Components / Platform; each band has a 2-column card grid (`toc-card/{title}`) of section cards; summary bar at the bottom; no URL hyperlinks yet.

## Step 5c — Draw Table of Contents

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `📝 Table of Contents` page. Wrap all TOC body content in a `_PageContent` vertical auto-layout frame at `y = 360` (below the header once Step 5b runs). Section cards, rows, and strips are all auto-layout so heights hug content — do not precompute `cardHeight` or a running `currentY`. **Do not** set hyperlinks here; Step **5c-links** (phase 05f) runs after Steps 5b, 5d, and 5e.

```javascript
// Navigate to the Table of Contents page
const tocPage = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(tocPage);

// Load every font family we may need (Medium used by Doc/Code fallback)
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

// ── Variable helpers (create-design-system — Canvas documentation visual spec § C) ──
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

// ── Doc/* text-style helpers (§ 7) ──
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
const DOC_SECTION   = { fontName: { family: 'Inter', style: 'Bold'      }, fontSize: 20, lineHeight: 28 };
const DOC_TOKENNAME = { fontName: { family: 'Inter', style: 'Semi Bold' }, fontSize: 16, lineHeight: 22 };
const DOC_CODE      = { fontName: { family: 'Inter', style: 'Medium'    }, fontSize: 13, lineHeight: 20 };
const DOC_CAPTION   = { fontName: { family: 'Inter', style: 'Regular'   }, fontSize: 12, lineHeight: 18 };
const DOC_CAPTION_UC = { fontName: { family: 'Inter', style: 'Medium'   }, fontSize: 12, lineHeight: 18, letterSpacing: 8 };

// ── Effect/shadow helper (§ G Depth — optional, skipped when style not yet published) ──
let _effectStylesCache = null;
async function tryApplyEffectStyle(node, styleName) {
  try {
    if (!_effectStylesCache) _effectStylesCache = await figma.getLocalEffectStylesAsync();
    const style = _effectStylesCache.find(s => s.name === styleName);
    if (style) { try { node.effectStyleId = style.id; } catch (_) {} }
  } catch (_) {}
}

// ── Page geometry (§ 3 — TOC shares 1800 wide, 40 padding, inner 1720 with Token Overview) ──
const PAGE_WIDTH     = 1800;
const PAGE_PADDING   = 40;
const SECTION_WIDTH  = PAGE_WIDTH - PAGE_PADDING * 2; // 1720
const COL_GAP        = 24;
const CARD_WIDTH     = Math.floor((SECTION_WIDTH - COL_GAP) / 2); // 848
const CARD_PADDING   = 24;
const STRIP_HEIGHT   = 64;

// ── Band definitions (system areas, Figma file reading order) ──
const bands = [
  {
    slug: 'foundations',
    title: 'Foundations',
    caption: 'Tokens, brand primitives, and style guide references.',
    sections: [
      { title: 'Meta',                   pages: ['Thumbnail'] },
      { title: '📝 Token & Style Docs',  pages: ['↳ Token Overview'] },
      { title: '🖍️ Style Guide',          pages: ['↳ Primitives', '↳ Theme', '↳ Layout', '↳ Text Styles', '↳ Effects'] },
      { title: '🖼️ Brand Assets',         pages: ['↳ Logo Marks', '↳ Vector Patterns', '↳ Icons', '↳ Imagery', '↳ Motion'] },
    ],
  },
  {
    slug: 'atoms',
    title: 'Atoms',
    caption: 'Smallest reusable UI elements — typography, dividers, tags, badges.',
    sections: [
      { title: '⚛️ Atoms', pages: ['↳ Typography', '↳ Text blocks', '↳ Label', '↳ Kbd', '↳ Dividers', '↳ Avatar', '↳ Badge', '↳ Chips', '↳ Tags', '↳ Counters', '↳ Aspect Ratio'] },
    ],
  },
  {
    slug: 'components',
    title: 'Components',
    caption: 'Composable UI patterns — controls, forms, feedback, overlays, navigation, data display.',
    sections: [
      { title: '🔘 Buttons & Controls',  pages: ['↳ Buttons', '↳ Button Group', '↳ Toggle', '↳ Toggle Group', '↳ Segmented Controller'] },
      { title: '📝 Inputs & Forms',      pages: ['↳ Text Field', '↳ Textarea', '↳ Number Input', '↳ Input Group', '↳ Input OTP', '↳ Checkbox', '↳ Radio', '↳ Switch', '↳ Select', '↳ Native Select', '↳ Combobox', '↳ Slider', '↳ Keypad', '↳ Image Select', '↳ Calendar', '↳ Date Picker', '↳ Field', '↳ Form Composite Groups'] },
      { title: '💬 Feedback & Status',   pages: ['↳ Alerts', '↳ Toast', '↳ Sonner', '↳ Notifications', '↳ Progress Bar', '↳ Progress Dial', '↳ Loaders', '↳ Skeleton', '↳ Spinner', '↳ Blank states', '↳ Error States'] },
      { title: '🗂️ Overlays',            pages: ['↳ Dialogue', '↳ Drawer', '↳ Sheets', '↳ Sheet Sockets', '↳ Popover', '↳ Hover Card', '↳ Tooltips', '↳ Context Menu', '↳ Dropdown Menu', '↳ Command'] },
      { title: '🧭 Navigation',          pages: ['↳ Top Navigation', '↳ Bottom Navigation', '↳ Tablet Navigation', '↳ Sidebar', '↳ Navigation Menu', '↳ Menubar', '↳ Action bars', '↳ Tabs bar', '↳ Breadcrumb', '↳ Pagination', '↳ Intra-app Navigation'] },
      { title: '📊 Data Display',        pages: ['↳ Data Table', '↳ Lists', '↳ Chart', '↳ Stat block', '↳ Widgets', '↳ Video player'] },
      { title: '🗃️ Content Containers',  pages: ['↳ Cards', '↳ Tiles', '↳ Select Tile', '↳ Carousel', '↳ Scroll Area', '↳ Accordion', '↳ Collapsible', '↳ Resizable'] },
    ],
  },
  {
    slug: 'platform',
    title: 'Platform & Utility',
    caption: 'Native device elements, documentation scaffolding, and parking lot.',
    sections: [
      { title: '📱 Native & Platform', pages: ['↳ Native Device Parts'] },
      { title: '🔧 Utility',          pages: ['Documentation components', 'Grids', 'parking lot'] },
    ],
  },
];

let totalSectionCount = 0;
let totalPageCount    = 0;
bands.forEach(b => {
  totalSectionCount += b.sections.length;
  b.sections.forEach(s => { totalPageCount += s.pages.length; });
});

// ── _PageContent ──
const pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.resize(PAGE_WIDTH, 100);
pageContent.paddingTop    = PAGE_PADDING;
pageContent.paddingBottom = 80;
pageContent.paddingLeft   = PAGE_PADDING;
pageContent.paddingRight  = PAGE_PADDING;
pageContent.itemSpacing   = 32;
bindThemeColor(pageContent, 'color/background/default', '#ffffff');
pageContent.x = 0;
pageContent.y = 360;
tocPage.appendChild(pageContent);

// ── Band strip helper (64px color/background/variant strip with Doc/Caption title) ──
async function bandStrip(band) {
  const strip = figma.createFrame();
  strip.name = `band-strip/${band.slug}`;
  strip.layoutMode = 'HORIZONTAL';
  strip.primaryAxisSizingMode = 'FIXED';
  strip.counterAxisSizingMode = 'FIXED';
  strip.counterAxisAlignItems = 'CENTER';
  strip.primaryAxisAlignItems = 'SPACE_BETWEEN';
  strip.layoutAlign = 'STRETCH';
  strip.resize(SECTION_WIDTH, STRIP_HEIGHT);
  strip.paddingLeft = strip.paddingRight = 24;
  strip.paddingTop = strip.paddingBottom = 0;
  strip.itemSpacing = 16;
  bindThemeColor(strip, 'color/background/variant', '#f4f4f5');
  strip.cornerRadius = 12;

  // Left — uppercase caption title + caption subtitle stacked
  const leftStack = figma.createFrame();
  leftStack.name = `band-strip/${band.slug}/title-stack`;
  leftStack.layoutMode = 'VERTICAL';
  leftStack.primaryAxisSizingMode = 'AUTO';
  leftStack.counterAxisSizingMode = 'AUTO';
  leftStack.itemSpacing = 2;
  leftStack.fills = [];
  strip.appendChild(leftStack);

  const stripTitle = figma.createText();
  stripTitle.characters = band.title.toUpperCase();
  await applyDocStyle(stripTitle, 'Doc/Caption', DOC_CAPTION_UC);
  bindThemeColor(stripTitle, 'color/background/content', '#0a0a0a');
  leftStack.appendChild(stripTitle);

  const stripCaption = figma.createText();
  stripCaption.characters = band.caption;
  await applyDocStyle(stripCaption, 'Doc/Caption', DOC_CAPTION);
  bindThemeColor(stripCaption, 'color/background/content-muted', '#525252');
  leftStack.appendChild(stripCaption);

  // Right — page/section count chip (Doc/Code)
  const sectionCount = band.sections.length;
  const pageCount = band.sections.reduce((acc, s) => acc + s.pages.length, 0);
  const count = figma.createText();
  count.characters = `${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
  await applyDocStyle(count, 'Doc/Code', DOC_CODE);
  bindThemeColor(count, 'color/background/content-muted', '#525252');
  strip.appendChild(count);

  pageContent.appendChild(strip);
}

// ── Card helper ──
async function sectionCard(section) {
  const card = figma.createFrame();
  card.name = `toc-card/${section.title}`;
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.resize(CARD_WIDTH, 100);
  card.paddingTop = card.paddingBottom = CARD_PADDING;
  card.paddingLeft = card.paddingRight = CARD_PADDING;
  card.itemSpacing = 0;
  bindThemeColor(card, 'color/background/default', '#ffffff');
  card.cornerRadius = 16;
  bindThemeStroke(card, 'color/border/subtle', '#ededed', 1);
  await tryApplyEffectStyle(card, 'Effect/shadow-sm');

  // Title (Doc/Section)
  const sectionTitle = figma.createText();
  sectionTitle.characters = section.title;
  await applyDocStyle(sectionTitle, 'Doc/Section', DOC_SECTION);
  bindThemeColor(sectionTitle, 'color/background/content', '#000000');
  sectionTitle.layoutAlign = 'STRETCH';
  card.appendChild(sectionTitle);

  // Underline stroke
  const underline = figma.createRectangle();
  underline.resize(CARD_WIDTH - CARD_PADDING * 2, 1);
  bindThemeColor(underline, 'color/border/subtle', '#ededed');
  underline.layoutAlign = 'STRETCH';
  card.appendChild(underline);

  // Small vertical gap (12px)
  const titleGap = figma.createFrame();
  titleGap.name = 'toc-title-gap';
  titleGap.resize(1, 12);
  titleGap.fills = [];
  titleGap.layoutAlign = 'STRETCH';
  card.appendChild(titleGap);

  // Page rows
  for (let ri = 0; ri < section.pages.length; ri++) {
    const pageName = section.pages[ri];
    const isLast = ri === section.pages.length - 1;

    const linkRow = figma.createFrame();
    linkRow.name = `toc-link/${pageName}`;
    linkRow.layoutMode = 'HORIZONTAL';
    linkRow.primaryAxisSizingMode = 'FIXED';
    linkRow.counterAxisSizingMode = 'FIXED';
    linkRow.resize(CARD_WIDTH - CARD_PADDING * 2, 40);
    linkRow.itemSpacing = 8;
    linkRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
    linkRow.counterAxisAlignItems = 'CENTER';
    linkRow.paddingLeft = linkRow.paddingRight = 0;
    linkRow.fills = [];
    linkRow.layoutAlign = 'STRETCH';
    card.appendChild(linkRow);

    const displayName = pageName.replace(/^↳ /, '');

    const pageText = figma.createText();
    pageText.characters = displayName;
    await applyDocStyle(pageText, 'Doc/TokenName', DOC_TOKENNAME);
    bindThemeColor(pageText, 'color/background/content', '#171717');
    pageText.layoutGrow = 1;
    linkRow.appendChild(pageText);

    const arrow = figma.createText();
    arrow.characters = '→';
    await applyDocStyle(arrow, 'Doc/Caption', DOC_CAPTION);
    bindThemeColor(arrow, 'color/background/content-muted', '#737373');
    linkRow.appendChild(arrow);

    if (!isLast) {
      const rowBorder = figma.createRectangle();
      rowBorder.resize(CARD_WIDTH - CARD_PADDING * 2, 1);
      bindThemeColor(rowBorder, 'color/border/subtle', '#ededed');
      rowBorder.layoutAlign = 'STRETCH';
      card.appendChild(rowBorder);
    }
  }

  return card;
}

// ── Render each band (strip + 2-column grid) ──
for (const band of bands) {
  await bandStrip(band);

  const grid = figma.createFrame();
  grid.name = `band-grid/${band.slug}`;
  grid.layoutMode = 'VERTICAL';
  grid.primaryAxisSizingMode = 'AUTO';
  grid.counterAxisSizingMode = 'FIXED';
  grid.resize(SECTION_WIDTH, 100);
  grid.itemSpacing = 24;
  grid.fills = [];
  grid.layoutAlign = 'STRETCH';
  pageContent.appendChild(grid);

  for (let i = 0; i < band.sections.length; i += 2) {
    const leftSection  = band.sections[i];
    const rightSection = band.sections[i + 1];

    const rowWrapper = figma.createFrame();
    rowWrapper.name = `band-grid/${band.slug}/row/${i / 2}`;
    rowWrapper.layoutMode = 'HORIZONTAL';
    rowWrapper.primaryAxisSizingMode = 'FIXED';
    rowWrapper.counterAxisSizingMode = 'AUTO';
    rowWrapper.counterAxisAlignItems = 'MIN';
    rowWrapper.itemSpacing = COL_GAP;
    rowWrapper.fills = [];
    rowWrapper.layoutAlign = 'STRETCH';
    rowWrapper.resize(SECTION_WIDTH, 1);
    grid.appendChild(rowWrapper);

    const leftCard = await sectionCard(leftSection);
    rowWrapper.appendChild(leftCard);

    if (rightSection) {
      const rightCard = await sectionCard(rightSection);
      rowWrapper.appendChild(rightCard);
    } else {
      // Empty placeholder column so the single-card row keeps the two-column rhythm.
      const empty = figma.createFrame();
      empty.name = 'toc-card/_empty';
      empty.resize(CARD_WIDTH, 1);
      empty.fills = [];
      rowWrapper.appendChild(empty);
    }
  }
}

// ── Summary bar (dark neutral/950, white Doc/Caption) ──
const today = new Date().toISOString().slice(0, 10);

const summaryBar = figma.createFrame();
summaryBar.name = 'toc-summary-bar';
summaryBar.layoutMode = 'HORIZONTAL';
summaryBar.primaryAxisSizingMode = 'FIXED';
summaryBar.counterAxisSizingMode = 'FIXED';
summaryBar.primaryAxisAlignItems = 'CENTER';
summaryBar.counterAxisAlignItems = 'CENTER';
summaryBar.resize(SECTION_WIDTH, 72);
summaryBar.paddingLeft = summaryBar.paddingRight = 24;
bindPrimColor(summaryBar, 'color/neutral/950', '#0a0a0a');
summaryBar.cornerRadius = 12;
summaryBar.layoutAlign = 'STRETCH';
await tryApplyEffectStyle(summaryBar, 'Effect/shadow-sm');
pageContent.appendChild(summaryBar);

const summaryText = figma.createText();
summaryText.characters = `${totalPageCount} pages across ${totalSectionCount} sections · ${bands.length} bands — generated by /new-project on ${today}`;
await applyDocStyle(summaryText, 'Doc/Caption', DOC_CAPTION);
bindPrimColor(summaryText, 'color/neutral/50', '#ffffff');
summaryText.textAlignHorizontal = 'CENTER';
summaryBar.appendChild(summaryText);
```
