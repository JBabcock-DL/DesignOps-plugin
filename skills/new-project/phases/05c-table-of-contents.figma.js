// ═══════════════════════════════════════════════════════════════════════════
// new-project / phases / 05c-table-of-contents.figma.js
// ═══════════════════════════════════════════════════════════════════════════
// Table of Contents draw script for `/new-project` Phase 05c. Builds the
// `_PageContent` body on `📝 Table of Contents` as one `band-strip/{slug}` +
// `band-list/{slug}` pair per system band, each containing full-width
// `toc-card/{title}` section cards (no 2-column grid, all auto-layout).
//
// Agents running Phase 05c MUST Read this file in full (no `limit`) and
// inline it VERBATIM inside a single `use_figma` call. The markdown in
// `05c-table-of-contents.md` used to carry this body inline; while it was
// not at the same truncation threshold as 05d, it's extracted here for
// consistency with the create-component / 05d pattern.
//
// Preconditions (from 05c-table-of-contents.md):
//   - `📝 Table of Contents` page exists (Phase 05 scaffold).
//   - `fileKey` known (Step 4 handoff or caller prompt).
//
// Post-condition: TOC sections are drawn but NOT hyperlinked. Phase 05f
// (`toc-hyperlinks`) runs AFTER 05b / 05d / 05e and wires the prototype
// links across pages.
//
// Sanity-check: this file is only valid when inlined into a `use_figma`
// call; `figma.*` must be defined in the host runtime.
// ═══════════════════════════════════════════════════════════════════════════

if (typeof figma === 'undefined') {
  throw new Error(
    '[05c-table-of-contents.figma.js] `figma` global is not defined. This file must be ' +
    'inlined into a `use_figma` call, not executed directly.'
  );
}

// Navigate to the Table of Contents page
const tocPage = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(tocPage);

// Load every font family we may need (Medium used by Doc/Code fallback)
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

// ═══════════════════════════════════════════════════════════════════════════
// ↓↓↓  INLINE _shared-token-helpers.figma.js HERE  ↓↓↓
// ═══════════════════════════════════════════════════════════════════════════
// Agent action required: `Read` skills/new-project/phases/_shared-token-helpers.figma.js
// in full (no `limit`) and paste its contents verbatim between this marker
// and the matching ↑↑↑ marker below. That template defines the following
// helpers referenced throughout this script:
//
//   variableCollections, allColorVars, themeCol, primCol
//   getThemeColorVar, getPrimColorVar, hexToRgb
//   bindThemeColor, bindPrimColor, bindThemeStroke
//   loadTextStylesOnce, applyDocStyle, tryApplyEffectStyle
//   DOC_SECTION, DOC_TOKENNAME, DOC_CODE, DOC_CAPTION
//
// Do NOT re-declare them here. The assert below throws with an actionable
// message if the template was not inlined.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ↑↑↑  END _shared-token-helpers.figma.js insertion point  ↑↑↑
// ═══════════════════════════════════════════════════════════════════════════

if (typeof bindPrimColor !== 'function' || typeof applyDocStyle !== 'function') {
  throw new Error(
    '[05c-table-of-contents.figma.js] _shared-token-helpers.figma.js was not inlined. ' +
    'Read skills/new-project/phases/_shared-token-helpers.figma.js and paste its contents ' +
    'between the ↓↓↓ / ↑↑↑ markers above.'
  );
}

// 05c-specific uppercase caption variant — letterSpacing 8 differs from 05d's
// DOC_CODE_UC (4), so it stays in this phase file rather than the shared
// helper file. Defined after the shared helpers so it can extend the palette.
const DOC_CAPTION_UC = { fontName: { family: 'Inter', style: 'Medium' }, fontSize: 12, lineHeight: 18, letterSpacing: 8 };

// ── Page geometry (conventions/03-through-07 § 3 — TOC shares 1800 wide, 40 padding all sides, inner 1720 with Token Overview) ──
const PAGE_WIDTH     = 1800;
const PAGE_PADDING   = 40;
const SECTION_WIDTH  = PAGE_WIDTH - PAGE_PADDING * 2; // 1720
const CARD_PADDING   = 24;
const STRIP_HEIGHT   = 64;
const CARD_INNER     = SECTION_WIDTH - CARD_PADDING * 2; // 1672 — width available inside a full-width card

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
// conventions/03-through-07 § 3: y=320 (zero-gap seam below _Header), padding 40 all sides,
// fill LITERAL #FFFFFF (not token-bound — the color/background/default variable
// may resolve to an off-white in Theme · Light and break the match with other doc pages).
// resize() MUST come before sizing-mode assignments (figma-use gotcha).
const pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
pageContent.resize(PAGE_WIDTH, 100);
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.paddingTop    = PAGE_PADDING;
pageContent.paddingBottom = PAGE_PADDING;
pageContent.paddingLeft   = PAGE_PADDING;
pageContent.paddingRight  = PAGE_PADDING;
pageContent.itemSpacing   = 32;
pageContent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
pageContent.x = 0;
pageContent.y = 320;
tocPage.appendChild(pageContent);

// ── Band strip helper (64px color/background/variant strip with Doc/Caption title) ──
async function bandStrip(band) {
  const strip = figma.createFrame();
  strip.name = `band-strip/${band.slug}`;
  strip.layoutMode = 'HORIZONTAL';
  // resize() before sizing-mode assignments (figma-use gotcha).
  strip.resize(SECTION_WIDTH, STRIP_HEIGHT);
  strip.primaryAxisSizingMode = 'FIXED';
  strip.counterAxisSizingMode = 'FIXED';
  strip.counterAxisAlignItems = 'CENTER';
  strip.primaryAxisAlignItems = 'SPACE_BETWEEN';
  strip.layoutAlign = 'STRETCH';
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
  // After appendChild: hug the chip so §0.2-style full-width resize never sticks (~1672px rail). See create-design-system §0.8.
  count.textAutoResize = 'WIDTH_AND_HEIGHT';
  if ('layoutSizingHorizontal' in count) {
    count.layoutSizingHorizontal = 'HUG';
    count.layoutSizingVertical = 'HUG';
  }

  pageContent.appendChild(strip);
}

// ── Card helper — full-width (SECTION_WIDTH) stacked card, no columns ──
async function sectionCard(section) {
  const card = figma.createFrame();
  card.name = `toc-card/${section.title}`;
  card.layoutMode = 'VERTICAL';
  // resize() before sizing-mode assignments (figma-use gotcha).
  card.resize(SECTION_WIDTH, 100);
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.layoutAlign = 'STRETCH';
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

  // Underline stroke (1px, card-inner width)
  const underline = figma.createRectangle();
  underline.resize(CARD_INNER, 1);
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

  // Page rows — full card-inner width, 40 tall, name left + arrow right
  for (let ri = 0; ri < section.pages.length; ri++) {
    const pageName = section.pages[ri];
    const isLast = ri === section.pages.length - 1;

    const linkRow = figma.createFrame();
    linkRow.name = `toc-link/${pageName}`;
    linkRow.layoutMode = 'HORIZONTAL';
    // resize() before sizing-mode assignments (figma-use gotcha).
    linkRow.resize(CARD_INNER, 40);
    linkRow.primaryAxisSizingMode = 'FIXED';
    linkRow.counterAxisSizingMode = 'FIXED';
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
      rowBorder.resize(CARD_INNER, 1);
      bindThemeColor(rowBorder, 'color/border/subtle', '#ededed');
      rowBorder.layoutAlign = 'STRETCH';
      card.appendChild(rowBorder);
    }
  }

  return card;
}

// ── Render each band (strip + single-column full-width section-card stack) ──
for (const band of bands) {
  await bandStrip(band);

  const list = figma.createFrame();
  list.name = `band-list/${band.slug}`;
  list.layoutMode = 'VERTICAL';
  // resize() before sizing-mode assignments (figma-use gotcha).
  list.resize(SECTION_WIDTH, 1);
  list.primaryAxisSizingMode = 'AUTO';
  list.counterAxisSizingMode = 'FIXED';
  list.itemSpacing = 16;
  list.fills = [];
  list.layoutAlign = 'STRETCH';
  pageContent.appendChild(list);

  for (const section of band.sections) {
    const card = await sectionCard(section);
    list.appendChild(card);
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
