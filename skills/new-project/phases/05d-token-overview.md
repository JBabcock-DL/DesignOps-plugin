# Phase 05d — Token Overview skeleton

## Runtime order
Runs **after** Phases 05c and 05b.

## Goal
Draw the Token Overview documentation skeleton on `↳ Token Overview` with `placeholder/{section}` nodes for **`/create-design-system` Step 17** (Token Overview population).

## Prerequisites
- Phases 05, 05c, and 05b complete per orchestrator order.

## Placeholders
None in the script.

## Instructions
Before editing this script or running `use_figma`, **`Read`** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§ A–H). Geometry must match § A; section surfaces, strokes, and doc text fills must follow the **token binding map** (§ C) and the **table hierarchy** (§ H): bind Theme **Light** and Primitives variables where those paths exist, with the script's hex values only as **resolved fallbacks** when a variable is missing. The platform-mapping table inside this page follows the **same § H hierarchy** as style-guide tables — no absolute `x`/`y` positioning.

Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
`_PageContent` with all sections from the phase script; amber placeholder strips present; platform-mapping table uses § H auto-layout hierarchy; every text node either carries `textStyleId` (when Doc/* styles exist) or a matching raw-font fallback that `/create-design-system` Step 17 can upgrade.

## Step 5d — Draw Token Overview Skeleton

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `↳ Token Overview` page. Wrap all Token Overview body sections in a `_PageContent` vertical auto-layout frame at `y = 360` (same pattern as Step 5c). Every section, table, row, and cell is auto-layout — no absolute positioning. Mark every placeholder element with an amber annotation text node named `placeholder/{section}` so that **Step 17** in `/create-design-system` knows which elements to replace with real token values.

```javascript
// Navigate to the Token Overview page
const overviewPage = figma.root.children.find(p => p.name === '↳ Token Overview');
await figma.setCurrentPageAsync(overviewPage);

// Load every font family we may need (includes Medium for Doc/Code fallback)
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
const DOC_SECTION   = { fontName: { family: 'Inter', style: 'Bold'      }, fontSize: 20, lineHeight: 28 };
const DOC_TOKENNAME = { fontName: { family: 'Inter', style: 'Semi Bold' }, fontSize: 16, lineHeight: 22 };
const DOC_CODE      = { fontName: { family: 'Inter', style: 'Medium'    }, fontSize: 13, lineHeight: 20 };
const DOC_CODE_UC   = { fontName: { family: 'Inter', style: 'Medium'    }, fontSize: 12, lineHeight: 18, letterSpacing: 4 };
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

// ── Page geometry (§ 3 — TOC + Token Overview share 1800 wide, 40 padding, inner 1720) ──
const PAGE_WIDTH     = 1800;
const PAGE_PADDING   = 40;
const SECTION_WIDTH  = PAGE_WIDTH - PAGE_PADDING * 2; // 1720
const SECTION_PAD    = 40;
const TABLE_WIDTH    = SECTION_WIDTH - SECTION_PAD * 2; // 1640 — matches style-guide table width

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
pageContent.itemSpacing   = 40;
bindThemeColor(pageContent, 'color/background/default', '#ffffff');
pageContent.x = 0;
pageContent.y = 360;
overviewPage.appendChild(pageContent);

async function sectionShell(name) {
  const s = figma.createFrame();
  s.name = name;
  s.layoutMode = 'VERTICAL';
  s.primaryAxisSizingMode = 'AUTO';
  s.counterAxisSizingMode = 'FIXED';
  s.resize(SECTION_WIDTH, 100);
  s.paddingTop = s.paddingBottom = 32;
  s.paddingLeft = s.paddingRight = SECTION_PAD;
  s.itemSpacing = 20;
  bindThemeColor(s, 'color/background/default', '#ffffff');
  s.cornerRadius = 16;
  bindThemeStroke(s, 'color/border/subtle', '#ededed', 1);
  await tryApplyEffectStyle(s, 'Effect/shadow-sm');
  s.layoutAlign = 'STRETCH';
  pageContent.appendChild(s);
  return s;
}

async function addSectionTitle(parent, title) {
  const t = figma.createText();
  t.characters = title;
  await applyDocStyle(t, 'Doc/Section', DOC_SECTION);
  bindThemeColor(t, 'color/background/content', '#0a0a0a');
  t.layoutAlign = 'STRETCH';
  parent.appendChild(t);
  return t;
}

async function addCaption(parent, text) {
  const t = figma.createText();
  t.characters = text;
  await applyDocStyle(t, 'Doc/Caption', DOC_CAPTION);
  bindThemeColor(t, 'color/background/content-muted', '#525252');
  t.layoutAlign = 'STRETCH';
  parent.appendChild(t);
  return t;
}

async function addPlaceholder(parent, sectionName) {
  const note = figma.createText();
  note.name       = `placeholder/${sectionName}`;
  note.fontName   = { family: 'Inter', style: 'Semi Bold' };
  note.fontSize   = 11;
  note.characters = `⚠ Placeholder — run /create-design-system to populate`;
  note.fills      = [{ type: 'SOLID', color: { r: 0.98, g: 0.72, b: 0.07 } }];
  note.layoutAlign = 'STRETCH';
  parent.appendChild(note);
}

// ────────────────────────────────────────────────────────────────
// Section 1: Architecture Overview
// ────────────────────────────────────────────────────────────────
const arch = await sectionShell('token-overview/architecture');
await addSectionTitle(arch, 'How the Token System Works');

const archBoxesRow = figma.createFrame();
archBoxesRow.name = 'arch-boxes-row';
archBoxesRow.layoutMode = 'HORIZONTAL';
archBoxesRow.primaryAxisSizingMode = 'AUTO';
archBoxesRow.counterAxisSizingMode = 'AUTO';
archBoxesRow.itemSpacing = 8;
archBoxesRow.counterAxisAlignItems = 'CENTER';
archBoxesRow.fills = [];
archBoxesRow.layoutAlign = 'STRETCH';
arch.appendChild(archBoxesRow);

// Box fills match /create-design-system Step 17 spec:
//   Primitives → color/primary/default  (brand)
//   Theme      → color/secondary/default (companion brand)
//   Typography / Layout / Effects → color/neutral/800 (muted)
const collectionBoxes = [
  { name: 'Primitives', note: 'Raw values',     bind: { kind: 'theme', path: 'color/primary/default',   fallback: '#2563eb' }, textOn: 'light' },
  { name: 'Theme',      note: 'Light / Dark',   bind: { kind: 'theme', path: 'color/secondary/default', fallback: '#7c3aed' }, textOn: 'light' },
  { name: 'Typography', note: '8 scale modes',  bind: { kind: 'prim',  path: 'color/neutral/800',        fallback: '#262626' }, textOn: 'light' },
  { name: 'Layout',     note: 'Space & Radius', bind: { kind: 'prim',  path: 'color/neutral/800',        fallback: '#262626' }, textOn: 'light' },
  { name: 'Effects',    note: 'Shadow & Blur',  bind: { kind: 'prim',  path: 'color/neutral/800',        fallback: '#262626' }, textOn: 'light' },
];

for (let i = 0; i < collectionBoxes.length; i++) {
  const col = collectionBoxes[i];

  const box = figma.createFrame();
  box.name = `arch-box/${col.name}`;
  box.layoutMode = 'VERTICAL';
  box.primaryAxisSizingMode = 'FIXED';
  box.counterAxisSizingMode = 'FIXED';
  box.resize(220, 120);
  box.paddingLeft = box.paddingRight = 16;
  box.paddingTop = box.paddingBottom = 20;
  box.itemSpacing = 6;
  box.primaryAxisAlignItems = 'CENTER';
  box.counterAxisAlignItems = 'MIN';
  box.cornerRadius = 12;
  if (col.bind.kind === 'theme') {
    bindThemeColor(box, col.bind.path, col.bind.fallback);
  } else {
    bindPrimColor(box, col.bind.path, col.bind.fallback);
  }
  archBoxesRow.appendChild(box);

  const colName = figma.createText();
  colName.characters = col.name;
  await applyDocStyle(colName, 'Doc/TokenName', DOC_TOKENNAME);
  // White-on-color: Primitives collection has neutral/50 — fallback to literal white otherwise.
  bindPrimColor(colName, 'color/neutral/50', '#ffffff');
  colName.layoutAlign = 'STRETCH';
  box.appendChild(colName);

  const colNote = figma.createText();
  colNote.characters = col.note;
  await applyDocStyle(colNote, 'Doc/Caption', DOC_CAPTION);
  bindPrimColor(colNote, 'color/neutral/200', '#e5e5e5');
  colNote.layoutAlign = 'STRETCH';
  box.appendChild(colNote);

  if (i < collectionBoxes.length - 1) {
    const arrow = figma.createText();
    arrow.fontName   = { family: 'Inter', style: 'Bold' };
    arrow.fontSize   = 20;
    arrow.characters = '→';
    bindThemeColor(arrow, 'color/background/content-muted', '#737373');
    archBoxesRow.appendChild(arrow);
  }
}

await addCaption(arch, 'Primitives hold raw values. All other collections alias into Primitives — change a Primitive, all semantic tokens update automatically.');

await addPlaceholder(arch, 'architecture');

// ────────────────────────────────────────────────────────────────
// Section 2: Platform Mapping — § H table hierarchy
// ────────────────────────────────────────────────────────────────
// Columns: TOKEN 400 · WEB 420 · ANDROID 340 · iOS 480 (sum 1640)
const PLATFORM_COLS = [
  { key: 'token',   label: 'TOKEN',   width: 400 },
  { key: 'web',     label: 'WEB',     width: 420 },
  { key: 'android', label: 'ANDROID', width: 340 },
  { key: 'ios',     label: 'iOS',     width: 480 },
];

// Placeholder rows — /create-design-system Step 17 overwrites cell text with live codeSyntax.
// Token paths MUST match variable names from Step 6 / Step 7 so Step 17 can look them up.
const platformRows = [
  { token: 'color/background/default',  web: 'var(--color-background-default)',   android: 'surface',                ios: '.Background.default'              },
  { token: 'color/background/content',  web: 'var(--color-background-content)',   android: 'on-surface',             ios: '.Foreground.default'              },
  { token: 'color/primary/default',     web: 'var(--color-primary-default)',      android: 'primary',                ios: '.Primary.default'                  },
  { token: 'color/border/default',      web: 'var(--color-border-default)',       android: 'outline',                ios: '.Border.default'                   },
  { token: 'color/error/default',       web: 'var(--color-danger-default)',       android: 'error',                  ios: '.Status.error'                     },
  { token: 'Headline/LG/font-size',     web: 'var(--headline-lg-font-size)',      android: 'headline-lg-font-size',  ios: '.Typography.headline.lg.font.size' },
  { token: 'Title/LG/font-size',        web: 'var(--title-lg-font-size)',         android: 'title-lg-font-size',     ios: '.Typography.title.lg.font.size'    },
  { token: 'typeface/display',          web: 'var(--typeface-display)',           android: 'typeface-display',       ios: '.Typeface.display'                 },
  { token: 'space/md',                  web: 'var(--space-md)',                   android: 'space-md',               ios: '.Layout.space.md'                  },
  { token: 'radius/md',                 web: 'var(--radius-md)',                  android: 'radius-md',              ios: '.Layout.radius.md'                 },
  { token: 'shadow/color',              web: 'var(--shadow-color)',               android: 'shadow',                 ios: '.Effect.shadow.color'              },
];

const platform = await sectionShell('token-overview/platform-mapping');
await addSectionTitle(platform, 'Platform Code Names (codeSyntax)');

async function buildPlatformTable(parent, slug, cols, rows) {
  const HEADER_HEIGHT  = 56;
  const ROW_MIN_HEIGHT = 64;

  // Outer table frame (§ 8 hierarchy, § 9 auto-layout rules)
  const table = figma.createFrame();
  table.name = `doc/table/${slug}`;
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'FIXED';
  table.layoutAlign = 'STRETCH';
  table.itemSpacing = 0;
  table.resizeWithoutConstraints(TABLE_WIDTH, 1);
  table.cornerRadius = 16;
  table.clipsContent = true;
  bindThemeColor(table, 'color/background/default', '#ffffff');
  bindThemeStroke(table, 'color/border/subtle', '#ededed', 1);
  await tryApplyEffectStyle(table, 'Effect/shadow-sm');
  parent.appendChild(table);

  // Header row
  const header = figma.createFrame();
  header.name = `doc/table/${slug}/header`;
  header.layoutMode = 'HORIZONTAL';
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'FIXED';
  header.counterAxisAlignItems = 'CENTER';
  header.layoutAlign = 'STRETCH';
  header.itemSpacing = 0;
  header.resize(TABLE_WIDTH, HEADER_HEIGHT);
  bindThemeColor(header, 'color/background/variant', '#f4f4f5');
  const headerStroke = {
    type: 'SOLID',
    color: hexToRgb('#ededed'),
  };
  const headerStrokeVar = getThemeColorVar('color/border/subtle');
  if (headerStrokeVar) {
    try { headerStroke.boundVariables = { color: figma.variables.createVariableAlias(headerStrokeVar) }; } catch (_) {}
  }
  header.strokes = [headerStroke];
  header.strokeWeight = 0;
  header.strokeTopWeight = 0;
  header.strokeLeftWeight = 0;
  header.strokeRightWeight = 0;
  header.strokeBottomWeight = 1;
  table.appendChild(header);

  for (const col of cols) {
    const cell = figma.createFrame();
    cell.name = `doc/table/${slug}/header/cell/${col.key}`;
    cell.layoutMode = 'HORIZONTAL';
    cell.primaryAxisSizingMode = 'FIXED';
    cell.counterAxisSizingMode = 'FIXED';
    cell.counterAxisAlignItems = 'CENTER';
    cell.itemSpacing = 0;
    cell.paddingLeft = cell.paddingRight = 20;
    cell.resize(col.width, HEADER_HEIGHT);
    cell.fills = [];
    header.appendChild(cell);

    const label = figma.createText();
    label.characters = col.label;
    await applyDocStyle(label, 'Doc/Code', DOC_CODE_UC);
    bindThemeColor(label, 'color/background/content-muted', '#525252');
    label.resize(Math.max(1, col.width - 40), 1);
    label.textAutoResize = 'HEIGHT';
    cell.appendChild(label);
  }

  // Body container
  const body = figma.createFrame();
  body.name = `doc/table/${slug}/body`;
  body.layoutMode = 'VERTICAL';
  body.primaryAxisSizingMode = 'AUTO';
  body.counterAxisSizingMode = 'FIXED';
  body.layoutAlign = 'STRETCH';
  body.itemSpacing = 0;
  body.resize(TABLE_WIDTH, 1);
  body.fills = [];
  table.appendChild(body);

  for (let ri = 0; ri < rows.length; ri++) {
    const rowData = rows[ri];
    const isLast = ri === rows.length - 1;

    const row = figma.createFrame();
    row.name = `doc/table/${slug}/row/${rowData.token}`;
    row.layoutMode = 'HORIZONTAL';
    row.primaryAxisSizingMode = 'FIXED';
    row.counterAxisSizingMode = 'AUTO';
    row.counterAxisAlignItems = 'CENTER';
    row.layoutAlign = 'STRETCH';
    row.itemSpacing = 0;
    row.paddingTop = row.paddingBottom = 16;
    row.paddingLeft = row.paddingRight = 0;
    row.resize(TABLE_WIDTH, 1);
    row.minHeight = ROW_MIN_HEIGHT;
    row.fills = [];
    // Bottom stroke (omit on last row so outer radius + clipsContent reads clean).
    if (!isLast) {
      const rowStrokePaint = { type: 'SOLID', color: hexToRgb('#ededed') };
      const rowStrokeVar = getThemeColorVar('color/border/subtle');
      if (rowStrokeVar) {
        try { rowStrokePaint.boundVariables = { color: figma.variables.createVariableAlias(rowStrokeVar) }; } catch (_) {}
      }
      row.strokes = [rowStrokePaint];
      row.strokeWeight = 0;
      row.strokeTopWeight = 0;
      row.strokeLeftWeight = 0;
      row.strokeRightWeight = 0;
      row.strokeBottomWeight = 1;
    } else {
      row.strokes = [];
    }
    body.appendChild(row);

    for (const col of cols) {
      const cell = figma.createFrame();
      cell.name = `doc/table/${slug}/row/${rowData.token}/cell/${col.key}`;
      cell.layoutMode = 'VERTICAL';
      cell.primaryAxisSizingMode = 'AUTO';
      cell.counterAxisSizingMode = 'FIXED';
      cell.primaryAxisAlignItems = 'CENTER';
      cell.counterAxisAlignItems = 'MIN';
      cell.itemSpacing = 4;
      cell.paddingLeft = cell.paddingRight = 20;
      cell.paddingTop = cell.paddingBottom = 4;
      cell.resize(col.width, 1);
      cell.fills = [];
      row.appendChild(cell);

      const text = figma.createText();
      text.characters = rowData[col.key] ?? '';
      const styleName = col.key === 'token' ? 'Doc/TokenName' : 'Doc/Code';
      const fallback  = col.key === 'token' ? DOC_TOKENNAME    : DOC_CODE;
      await applyDocStyle(text, styleName, fallback);
      bindThemeColor(text, 'color/background/content', '#171717');
      text.resize(Math.max(1, col.width - 40), 1);
      text.textAutoResize = 'HEIGHT';
      cell.appendChild(text);
    }
  }

  return table;
}

await buildPlatformTable(platform, 'token-overview/platform-mapping', PLATFORM_COLS, platformRows);
await addCaption(platform, 'Every variable carries codeSyntax for all 3 platforms. In Dev Mode, inspect any token and copy the platform value directly.');
await addPlaceholder(platform, 'platform-mapping');

// ────────────────────────────────────────────────────────────────
// Section 3: Dark Mode + Font Scale (2-column row of panels)
// ────────────────────────────────────────────────────────────────
const modeRow = figma.createFrame();
modeRow.name = 'token-overview/mode-row';
modeRow.layoutMode = 'HORIZONTAL';
modeRow.primaryAxisSizingMode = 'AUTO';
modeRow.counterAxisSizingMode = 'AUTO';
modeRow.itemSpacing = 40;
modeRow.fills = [];
modeRow.layoutAlign = 'STRETCH';
pageContent.appendChild(modeRow);

// ── Dark Mode panel ──
const PANEL_WIDTH = (SECTION_WIDTH - 40) / 2; // two panels fit inside 1720 minus 40 gap

const darkPanel = figma.createFrame();
darkPanel.name = 'dark-mode-panel';
darkPanel.layoutMode = 'VERTICAL';
darkPanel.primaryAxisSizingMode = 'AUTO';
darkPanel.counterAxisSizingMode = 'FIXED';
darkPanel.resize(PANEL_WIDTH, 100);
darkPanel.paddingTop = darkPanel.paddingBottom = 32;
darkPanel.paddingLeft = darkPanel.paddingRight = 32;
darkPanel.itemSpacing = 20;
bindThemeColor(darkPanel, 'color/background/default', '#ffffff');
darkPanel.cornerRadius = 16;
bindThemeStroke(darkPanel, 'color/border/subtle', '#e4e4e7', 1);
await tryApplyEffectStyle(darkPanel, 'Effect/shadow-sm');
modeRow.appendChild(darkPanel);

const darkTitle = figma.createText();
darkTitle.characters = 'Dark Mode';
await applyDocStyle(darkTitle, 'Doc/Section', DOC_SECTION);
bindThemeColor(darkTitle, 'color/background/content', '#000000');
darkTitle.layoutAlign = 'STRETCH';
darkPanel.appendChild(darkTitle);

// Phone preview row — two mode-scoped swatches stacked with labels (auto-layout)
const phoneRow = figma.createFrame();
phoneRow.name = 'dark-mode-phones';
phoneRow.layoutMode = 'HORIZONTAL';
phoneRow.primaryAxisSizingMode = 'AUTO';
phoneRow.counterAxisSizingMode = 'AUTO';
phoneRow.itemSpacing = 24;
phoneRow.fills = [];
phoneRow.layoutAlign = 'STRETCH';
darkPanel.appendChild(phoneRow);

const modes = [
  { label: 'Light', bind: { kind: 'theme', path: 'color/background/default', fallback: '#fafafa' } },
  { label: 'Dark',  bind: { kind: 'prim',  path: 'color/neutral/950',         fallback: '#0a0a0a' } },
];

for (const m of modes) {
  const phoneCell = figma.createFrame();
  phoneCell.name = `dark-mode-phone/${m.label.toLowerCase()}`;
  phoneCell.layoutMode = 'VERTICAL';
  phoneCell.primaryAxisSizingMode = 'AUTO';
  phoneCell.counterAxisSizingMode = 'AUTO';
  phoneCell.itemSpacing = 12;
  phoneCell.counterAxisAlignItems = 'CENTER';
  phoneCell.fills = [];
  phoneRow.appendChild(phoneCell);

  const frame = figma.createFrame();
  frame.name = `phone-frame/${m.label.toLowerCase()}`;
  frame.layoutMode = 'NONE';
  frame.resize(220, 150);
  if (m.bind.kind === 'theme') {
    bindThemeColor(frame, m.bind.path, m.bind.fallback);
  } else {
    bindPrimColor(frame, m.bind.path, m.bind.fallback);
  }
  frame.cornerRadius = 10;
  bindThemeStroke(frame, 'color/border/subtle', '#d4d4d8', 1);
  phoneCell.appendChild(frame);

  const lbl = figma.createText();
  lbl.characters = m.label;
  await applyDocStyle(lbl, 'Doc/Caption', DOC_CAPTION);
  bindThemeColor(lbl, 'color/background/content-muted', '#525252');
  phoneCell.appendChild(lbl);
}

await addPlaceholder(darkPanel, 'dark-mode');

// ── Typography Scale panel ──
const scalePanel = figma.createFrame();
scalePanel.name = 'font-scale-panel';
scalePanel.layoutMode = 'VERTICAL';
scalePanel.primaryAxisSizingMode = 'AUTO';
scalePanel.counterAxisSizingMode = 'FIXED';
scalePanel.resize(PANEL_WIDTH, 100);
scalePanel.paddingTop = scalePanel.paddingBottom = 32;
scalePanel.paddingLeft = scalePanel.paddingRight = 32;
scalePanel.itemSpacing = 20;
bindThemeColor(scalePanel, 'color/background/default', '#ffffff');
scalePanel.cornerRadius = 16;
bindThemeStroke(scalePanel, 'color/border/subtle', '#e4e4e7', 1);
await tryApplyEffectStyle(scalePanel, 'Effect/shadow-sm');
modeRow.appendChild(scalePanel);

const scaleTitle = figma.createText();
scaleTitle.characters = 'Typography Scale Modes';
await applyDocStyle(scaleTitle, 'Doc/Section', DOC_SECTION);
bindThemeColor(scaleTitle, 'color/background/content', '#000000');
scaleTitle.layoutAlign = 'STRETCH';
scalePanel.appendChild(scaleTitle);

// Auto-layout scale row — one VERTICAL cell per step, specimen on top, mode label below.
const scaleRow = figma.createFrame();
scaleRow.name = 'scale-row';
scaleRow.layoutMode = 'HORIZONTAL';
scaleRow.primaryAxisSizingMode = 'AUTO';
scaleRow.counterAxisSizingMode = 'AUTO';
scaleRow.itemSpacing = 8;
scaleRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
scaleRow.counterAxisAlignItems = 'CENTER';
scaleRow.layoutAlign = 'STRETCH';
scaleRow.fills = [];
scalePanel.appendChild(scaleRow);

// Must match Typography collection modes in /create-design-system (85 … 200)
const scaleSteps = [
  { mode: '85',  size: 14 },
  { mode: '100', size: 17 },
  { mode: '110', size: 19 },
  { mode: '120', size: 20 },
  { mode: '130', size: 22 },
  { mode: '150', size: 25 },
  { mode: '175', size: 29 },
  { mode: '200', size: 34 },
];

for (const step of scaleSteps) {
  const cell = figma.createFrame();
  cell.name = `scale-cell/${step.mode}`;
  cell.layoutMode = 'VERTICAL';
  cell.primaryAxisSizingMode = 'AUTO';
  cell.counterAxisSizingMode = 'AUTO';
  cell.itemSpacing = 12;
  cell.counterAxisAlignItems = 'CENTER';
  cell.fills = [];
  scaleRow.appendChild(cell);

  const specimen = figma.createText();
  specimen.fontName   = { family: 'Inter', style: 'Bold' };
  specimen.fontSize   = step.size;
  specimen.characters = 'Aa';
  bindThemeColor(specimen, 'color/background/content', '#0a0a0a');
  cell.appendChild(specimen);

  const modeLabel = figma.createText();
  modeLabel.characters = step.mode;
  await applyDocStyle(modeLabel, 'Doc/Caption', DOC_CAPTION);
  bindThemeColor(modeLabel, 'color/background/content-muted', '#737373');
  cell.appendChild(modeLabel);
}

await addPlaceholder(scalePanel, 'font-scale');

// ────────────────────────────────────────────────────────────────
// Section 4: How to Bind — 3 step cards
// ────────────────────────────────────────────────────────────────
const bindSection = await sectionShell('token-overview/how-to-bind');
await addSectionTitle(bindSection, 'Binding Tokens in Figma');

const bindCards = [
  {
    icon: '🪣',
    title: 'Apply a Color Token',
    body:  'Select a layer → Fill → click the variable icon → choose from Theme or Primitives. Always bind to Theme tokens, not Primitives, so dark mode switches automatically.',
  },
  {
    icon: 'T',
    title: 'Apply a Typography Token',
    body:  'Select a text layer → In the right panel, click the variable icon next to Font Size, Line Height, etc. → choose from Typography. The value updates across all 8 scale modes.',
  },
  {
    icon: '↔',
    title: 'Apply a Spacing Token',
    body:  'Select a frame → Auto Layout gap or padding → click the variable icon → choose from Layout (space/*) or Primitives (Space/*). Prefer Layout aliases.',
  },
];

const bindRow = figma.createFrame();
bindRow.name = 'bind-cards-row';
bindRow.layoutMode = 'HORIZONTAL';
bindRow.primaryAxisSizingMode = 'AUTO';
bindRow.counterAxisSizingMode = 'AUTO';
bindRow.itemSpacing = 20;
bindRow.fills = [];
bindRow.layoutAlign = 'STRETCH';
bindSection.appendChild(bindRow);

const BIND_CARD_W = Math.floor((TABLE_WIDTH - 20 * 2) / 3);

for (const card of bindCards) {
  const cardFrame = figma.createFrame();
  cardFrame.name = `bind-card/${card.title}`;
  cardFrame.layoutMode = 'VERTICAL';
  cardFrame.primaryAxisSizingMode = 'AUTO';
  cardFrame.counterAxisSizingMode = 'FIXED';
  cardFrame.resize(BIND_CARD_W, 100);
  cardFrame.paddingLeft = cardFrame.paddingRight = 20;
  cardFrame.paddingTop = cardFrame.paddingBottom = 20;
  cardFrame.itemSpacing = 10;
  bindThemeColor(cardFrame, 'color/background/variant', '#fafafa');
  cardFrame.cornerRadius = 12;
  bindThemeStroke(cardFrame, 'color/border/subtle', '#ededed', 1);
  bindRow.appendChild(cardFrame);

  const iconText = figma.createText();
  iconText.fontName   = { family: 'Inter', style: 'Bold' };
  iconText.fontSize   = 22;
  iconText.characters = card.icon;
  bindThemeColor(iconText, 'color/background/content', '#0a0a0a');
  iconText.layoutAlign = 'STRETCH';
  cardFrame.appendChild(iconText);

  const cardTitle = figma.createText();
  cardTitle.characters = card.title;
  await applyDocStyle(cardTitle, 'Doc/TokenName', DOC_TOKENNAME);
  bindThemeColor(cardTitle, 'color/background/content', '#000000');
  cardTitle.layoutAlign = 'STRETCH';
  cardFrame.appendChild(cardTitle);

  const cardBody = figma.createText();
  cardBody.characters = card.body;
  await applyDocStyle(cardBody, 'Doc/Caption', DOC_CAPTION);
  bindThemeColor(cardBody, 'color/background/content-muted', '#525252');
  cardBody.layoutAlign = 'STRETCH';
  cardBody.resize(BIND_CARD_W - 40, 1);
  cardBody.textAutoResize = 'HEIGHT';
  cardFrame.appendChild(cardBody);
}

// ────────────────────────────────────────────────────────────────
// Section 5: Claude command reference — dark 2×3 grid
// ────────────────────────────────────────────────────────────────
const claudeSection = figma.createFrame();
claudeSection.name = 'token-overview/claude-commands';
claudeSection.layoutMode = 'VERTICAL';
claudeSection.primaryAxisSizingMode = 'AUTO';
claudeSection.counterAxisSizingMode = 'FIXED';
claudeSection.resize(SECTION_WIDTH, 100);
claudeSection.paddingTop = claudeSection.paddingBottom = 32;
claudeSection.paddingLeft = claudeSection.paddingRight = SECTION_PAD;
claudeSection.itemSpacing = 24;
bindPrimColor(claudeSection, 'color/neutral/950', '#0a0a0a');
claudeSection.cornerRadius = 16;
claudeSection.layoutAlign = 'STRETCH';
await tryApplyEffectStyle(claudeSection, 'Effect/shadow-sm');
pageContent.appendChild(claudeSection);

const claudeTitle = figma.createText();
claudeTitle.characters = 'Maintaining Tokens with Claude';
await applyDocStyle(claudeTitle, 'Doc/Section', DOC_SECTION);
bindPrimColor(claudeTitle, 'color/neutral/50', '#fafafa');
claudeTitle.layoutAlign = 'STRETCH';
claudeSection.appendChild(claudeTitle);

const claudeIntro = figma.createText();
claudeIntro.characters = 'Each skill keeps tokens, components, and Code Connect mappings in sync. Run any command from Claude Code / Cursor at your project root.';
await applyDocStyle(claudeIntro, 'Doc/Caption', DOC_CAPTION);
bindPrimColor(claudeIntro, 'color/neutral/400', '#a3a3a3');
claudeIntro.layoutAlign = 'STRETCH';
claudeSection.appendChild(claudeIntro);

const commands = [
  { cmd: '/create-design-system', desc: 'Push new brand tokens to all 5 collections' },
  { cmd: '/sync-design-system',   desc: 'Sync changes between Figma and tokens.css' },
  { cmd: '/create-component',     desc: 'Install shadcn components + draw to canvas' },
  { cmd: '/code-connect',         desc: 'Wire Figma components to code counterparts' },
  { cmd: '/accessibility-check',  desc: 'WCAG AA audit + Dynamic Type simulation' },
  { cmd: '/new-language',         desc: 'Localize a frame to a new language' },
];

const CMD_INNER = SECTION_WIDTH - SECTION_PAD * 2; // 1640
const CMD_CARD_W = Math.floor((CMD_INNER - 24) / 2);

const cmdGrid = figma.createFrame();
cmdGrid.name = 'claude-command-grid';
cmdGrid.layoutMode = 'VERTICAL';
cmdGrid.primaryAxisSizingMode = 'AUTO';
cmdGrid.counterAxisSizingMode = 'AUTO';
cmdGrid.itemSpacing = 16;
cmdGrid.fills = [];
cmdGrid.layoutAlign = 'STRETCH';
claudeSection.appendChild(cmdGrid);

for (let r = 0; r < 3; r++) {
  const cmdRow = figma.createFrame();
  cmdRow.name = `cmd-row/${r}`;
  cmdRow.layoutMode = 'HORIZONTAL';
  cmdRow.primaryAxisSizingMode = 'AUTO';
  cmdRow.counterAxisSizingMode = 'AUTO';
  cmdRow.itemSpacing = 24;
  cmdRow.fills = [];
  cmdRow.layoutAlign = 'STRETCH';
  cmdGrid.appendChild(cmdRow);

  for (const item of commands.slice(r * 2, r * 2 + 2)) {
    const cmdCard = figma.createFrame();
    cmdCard.name = `cmd-card/${item.cmd}`;
    cmdCard.layoutMode = 'VERTICAL';
    cmdCard.primaryAxisSizingMode = 'AUTO';
    cmdCard.counterAxisSizingMode = 'FIXED';
    cmdCard.resize(CMD_CARD_W, 100);
    cmdCard.paddingLeft = cmdCard.paddingRight = 20;
    cmdCard.paddingTop = cmdCard.paddingBottom = 18;
    cmdCard.itemSpacing = 6;
    bindPrimColor(cmdCard, 'color/neutral/900', '#171717');
    cmdCard.cornerRadius = 12;
    cmdRow.appendChild(cmdCard);

    const cmdText = figma.createText();
    cmdText.characters = item.cmd;
    await applyDocStyle(cmdText, 'Doc/TokenName', DOC_TOKENNAME);
    bindPrimColor(cmdText, 'color/neutral/50', '#fafafa');
    cmdText.layoutAlign = 'STRETCH';
    cmdCard.appendChild(cmdText);

    const descText = figma.createText();
    descText.characters = item.desc;
    await applyDocStyle(descText, 'Doc/Caption', DOC_CAPTION);
    bindPrimColor(descText, 'color/neutral/400', '#a3a3a3');
    descText.layoutAlign = 'STRETCH';
    cmdCard.appendChild(descText);
  }
}

const footerNote = figma.createText();
footerNote.characters = 'All commands run from the terminal via Claude Code. The plugin reads SKILL.md files — no install required. See README.md in the plugin repo for setup.';
await applyDocStyle(footerNote, 'Doc/Caption', DOC_CAPTION);
bindPrimColor(footerNote, 'color/neutral/400', '#a3a3a3');
footerNote.layoutAlign = 'STRETCH';
claudeSection.appendChild(footerNote);
```
