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
Before editing this script or running `use_figma`, **`Read`** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§ A–C). Geometry must match § A; section surfaces, strokes, and doc text fills must follow the **token binding map** (§ C): bind Theme **Light** and Primitives variables where those paths exist, with the script’s hex values only as **resolved fallbacks** when a variable is missing.

Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
`_PageContent` with all sections from the phase script; amber placeholder strips present.

## Step 5d — Draw Token Overview Skeleton

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `↳ Token Overview` page. Wrap all Token Overview body sections in a `_PageContent` vertical auto-layout frame at `y = 360` (same pattern as Step 5c). Each major section is a vertical auto-layout frame that **hugs** height; stack the platform-mapping **table rows** inside a vertical auto-layout inner container so the section height follows row count — **no** `sectionY` / `tableHeight` accumulators. Mark every placeholder element with an amber annotation text node named `placeholder/{section}` so that **Step 17** in `/create-design-system` knows which elements to replace with real token values.

```javascript
// Navigate to the Token Overview page
const overviewPage = figma.root.children.find(p => p.name === '↳ Token Overview');
await figma.setCurrentPageAsync(overviewPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

// Token-bound doc chrome (create-design-system — Canvas documentation visual spec § C)
const collections = figma.variables.getLocalVariableCollections();
const allColorVars = figma.variables.getLocalVariables('COLOR');
const themeCol = collections.find(c => c.name === 'Theme');
const primCol = collections.find(c => c.name === 'Primitives');
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
    try {
      paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
    } catch (_) {}
  }
  node[target] = [paint];
}
function bindPrimColor(node, path, fallbackHex, target = 'fills') {
  const variable = getPrimColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try {
      paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
    } catch (_) {}
  }
  node[target] = [paint];
}
function bindThemeStroke(node, path, fallbackHex, weight = 1) {
  const variable = getThemeColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try {
      paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
    } catch (_) {}
  }
  node.strokes = [paint];
  node.strokeWeight = weight;
}

const SECTION_WIDTH = 1360;

const pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.resize(1440, 100);
pageContent.paddingTop    = 40;
pageContent.paddingBottom = 80;
pageContent.paddingLeft   = 40;
pageContent.paddingRight  = 40;
pageContent.itemSpacing   = 40;
bindThemeColor(pageContent, 'color/background/default', '#ffffff');
pageContent.x = 0;
pageContent.y = 360;
overviewPage.appendChild(pageContent);

function sectionShell(name) {
  const s = figma.createFrame();
  s.name = name;
  s.layoutMode = 'VERTICAL';
  s.primaryAxisSizingMode = 'AUTO';
  s.counterAxisSizingMode = 'FIXED';
  s.resize(SECTION_WIDTH, 100);
  s.paddingTop = s.paddingBottom = 32;
  s.paddingLeft = s.paddingRight = 40;
  s.itemSpacing = 16;
  bindThemeColor(s, 'color/background/variant', '#ffffff');
  s.cornerRadius = 16;
  bindThemeStroke(s, 'color/border/subtle', '#ededed', 1);
  s.layoutAlign = 'STRETCH';
  pageContent.appendChild(s);
  return s;
}

function addPlaceholder(parent, sectionName) {
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
const arch = sectionShell('token-overview/architecture');

const archTitle = figma.createText();
archTitle.fontName   = { family: 'Inter', style: 'Bold' };
archTitle.fontSize   = 20;
archTitle.characters = 'How the Token System Works';
bindThemeColor(archTitle, 'color/background/content', '#000000');
archTitle.layoutAlign = 'STRETCH';
arch.appendChild(archTitle);

const archBoxesRow = figma.createFrame();
archBoxesRow.name = 'arch-boxes-row';
archBoxesRow.layoutMode = 'HORIZONTAL';
archBoxesRow.primaryAxisSizingMode = 'AUTO';
archBoxesRow.counterAxisSizingMode = 'AUTO';
archBoxesRow.itemSpacing = 8;
archBoxesRow.fills = [];
archBoxesRow.layoutAlign = 'STRETCH';
arch.appendChild(archBoxesRow);

const collections = [
  { name: 'Primitives',   note: 'Raw values' },
  { name: 'Theme',        note: 'Light / Dark' },
  { name: 'Typography',   note: '8 scale modes' },
  { name: 'Layout',       note: 'Space & Radius' },
  { name: 'Effects',      note: 'Shadow & Blur' },
];

collections.forEach((col, i) => {
  const box = figma.createFrame();
  box.name = `arch-box/${col.name}`;
  box.layoutMode = 'VERTICAL';
  box.primaryAxisSizingMode = 'AUTO';
  box.counterAxisSizingMode = 'FIXED';
  box.resize(200, 120);
  box.paddingLeft = box.paddingRight = 16;
  box.paddingTop = 32;
  box.itemSpacing = 8;
  bindThemeColor(box, 'color/primary/subtle', '#dbeafe');
  box.cornerRadius = 12;
  archBoxesRow.appendChild(box);

  const colName = figma.createText();
  colName.fontName   = { family: 'Inter', style: 'Bold' };
  colName.fontSize   = 14;
  colName.characters = col.name;
  bindThemeColor(colName, 'color/background/content', '#0a0a0a');
  colName.layoutAlign = 'STRETCH';
  box.appendChild(colName);

  const colNote = figma.createText();
  colNote.fontName   = { family: 'Inter', style: 'Regular' };
  colNote.fontSize   = 11;
  colNote.characters = col.note;
  bindThemeColor(colNote, 'color/background/content-muted', '#525252');
  colNote.layoutAlign = 'STRETCH';
  box.appendChild(colNote);

  if (i < collections.length - 1) {
    const arrow = figma.createText();
    arrow.fontName   = { family: 'Inter', style: 'Bold' };
    arrow.fontSize   = 20;
    arrow.characters = '→';
    bindThemeColor(arrow, 'color/background/content-muted', '#737373');
    archBoxesRow.appendChild(arrow);
  }
});

const archCaption = figma.createText();
archCaption.fontName   = { family: 'Inter', style: 'Regular' };
archCaption.fontSize   = 13;
archCaption.characters = 'Primitives hold raw values. All other collections alias into Primitives — change a Primitive, all semantic tokens update automatically.';
bindThemeColor(archCaption, 'color/background/content-muted', '#525252');
archCaption.layoutAlign = 'STRETCH';
arch.appendChild(archCaption);

addPlaceholder(arch, 'architecture');

// ────────────────────────────────────────────────────────────────
// Section 2: Platform Mapping table
// ────────────────────────────────────────────────────────────────
const platformRows = [
  ['color/background/default',   'var(--color-background)',       'surface',               '.Background.default'],
  ['color/primary/default',      'var(--color-primary)',          'primary',               '.Primary.default'],
  ['color/border/default',       'var(--color-border)',           'outline',               '.Border.default'],
  ['color/error/default',         'var(--color-danger)',           'error',                 '.Status.error'],
  ['Headline/LG/font-size',      'var(--headline-lg-font-size)',  'headline-lg-font-size', '.Typography.headline.lg.fontSize'],
  ['Title/LG/font-size',         'var(--title-lg-font-size)',     'title-lg-font-size',    '.Typography.title.lg.fontSize'],
  ['typeface/display',           'var(--typeface-display)',       'typeface-display',      '.Typeface.display'],
  ['space/md',                   'var(--space-md)',               'space-md',              '.Layout.space.md'],
  ['radius/md',                  'var(--radius-md)',              'radius-md',             '.Layout.radius.md'],
  ['shadow/color',               'var(--shadow-color)',           'shadow',                '.Effect.shadow.color'],
];

const TABLE_COL_WIDTHS = [320, 320, 320, 320];
const TABLE_ROW_HEIGHT = 40;

const platform = sectionShell('token-overview/platform-mapping');

const platTitle = figma.createText();
platTitle.fontName   = { family: 'Inter', style: 'Bold' };
platTitle.fontSize   = 20;
platTitle.characters = 'Platform Code Names (codeSyntax)';
bindThemeColor(platTitle, 'color/background/content', '#000000');
platTitle.layoutAlign = 'STRETCH';
platform.appendChild(platTitle);

const tableStack = figma.createFrame();
tableStack.name = 'platform-table-stack';
tableStack.layoutMode = 'VERTICAL';
tableStack.primaryAxisSizingMode = 'AUTO';
tableStack.counterAxisSizingMode = 'FIXED';
tableStack.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
tableStack.itemSpacing = 0;
tableStack.fills = [];
tableStack.layoutAlign = 'STRETCH';
platform.appendChild(tableStack);

const tableHeaders = ['Token', 'WEB', 'ANDROID (M3 kebab)', 'iOS (semantic)'];
const headerRow = figma.createFrame();
headerRow.name = 'table-header';
headerRow.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
bindThemeColor(headerRow, 'color/background/variant', '#f4f4f5');
headerRow.cornerRadius = 8;
headerRow.layoutAlign = 'STRETCH';
tableStack.appendChild(headerRow);

let colX = 0;
tableHeaders.forEach((h, ci) => {
  const hText = figma.createText();
  hText.fontName   = { family: 'Inter', style: 'Bold' };
  hText.fontSize   = 12;
  hText.characters = h;
  bindThemeColor(hText, 'color/background/content', '#09090b');
  hText.x = colX + 12;
  hText.y = (TABLE_ROW_HEIGHT - 12) / 2;
  headerRow.appendChild(hText);
  colX += TABLE_COL_WIDTHS[ci];
});

platformRows.forEach((row, ri) => {
  const dataRow = figma.createFrame();
  dataRow.name  = `table-row/${ri}`;
  dataRow.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
  bindThemeColor(
    dataRow,
    ri % 2 === 0 ? 'color/background/default' : 'color/background/variant',
    ri % 2 === 0 ? '#fafafa' : '#ffffff',
  );
  dataRow.layoutAlign = 'STRETCH';
  tableStack.appendChild(dataRow);

  let cellX = 0;
  row.forEach((cell, ci) => {
    const cellText = figma.createText();
    cellText.fontName   = { family: 'Inter', style: ci === 0 ? 'Semi Bold' : 'Regular' };
    cellText.fontSize   = 12;
    cellText.characters = cell;
    bindThemeColor(cellText, 'color/background/content', '#171717');
    cellText.x = cellX + 12;
    cellText.y = (TABLE_ROW_HEIGHT - 12) / 2;
    dataRow.appendChild(cellText);
    cellX += TABLE_COL_WIDTHS[ci];
  });
});

const platCaption = figma.createText();
platCaption.fontName   = { family: 'Inter', style: 'Regular' };
platCaption.fontSize   = 13;
platCaption.characters = 'Every variable carries codeSyntax for all 3 platforms. In Dev Mode, inspect any token and copy the platform value directly.';
bindThemeColor(platCaption, 'color/background/content-muted', '#525252');
platCaption.layoutAlign = 'STRETCH';
platform.appendChild(platCaption);

addPlaceholder(platform, 'platform-mapping');

// ────────────────────────────────────────────────────────────────
// Section 3: Dark Mode + Font Scale (2-column row)
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

const darkPanel = figma.createFrame();
darkPanel.name = 'dark-mode-panel';
darkPanel.resize(660, 360);
bindThemeColor(darkPanel, 'color/background/variant', '#ffffff');
darkPanel.cornerRadius = 16;
bindThemeStroke(darkPanel, 'color/border/subtle', '#e4e4e7', 1);
modeRow.appendChild(darkPanel);

const darkTitle = figma.createText();
darkTitle.fontName   = { family: 'Inter', style: 'Bold' };
darkTitle.fontSize   = 18;
darkTitle.characters = 'Dark Mode';
bindThemeColor(darkTitle, 'color/background/content', '#000000');
darkTitle.x = 24;
darkTitle.y = 24;
darkPanel.appendChild(darkTitle);

[{ label: 'Light', x: 40 },
 { label: 'Dark',  x: 360 }].forEach(phone => {
  const frame = figma.createRectangle();
  frame.resize(200, 140);
  frame.x           = phone.x;
  frame.y           = 64;
  if (phone.label === 'Light') {
    bindThemeColor(frame, 'color/background/default', '#f4f4f5');
  } else {
    bindPrimColor(frame, 'color/neutral/950', '#0a0a0a');
  }
  frame.cornerRadius = 8;
  bindThemeStroke(frame, 'color/border/subtle', '#d4d4d8', 1);
  darkPanel.appendChild(frame);

  const lbl = figma.createText();
  lbl.fontName   = { family: 'Inter', style: 'Regular' };
  lbl.fontSize   = 12;
  lbl.characters = phone.label;
  bindThemeColor(lbl, 'color/background/content-muted', '#525252');
  lbl.x = phone.x + 80;
  lbl.y = 212;
  darkPanel.appendChild(lbl);
});

addPlaceholder(darkPanel, 'dark-mode');

const scalePanel = figma.createFrame();
scalePanel.name = 'font-scale-panel';
scalePanel.resize(660, 360);
bindThemeColor(scalePanel, 'color/background/variant', '#ffffff');
scalePanel.cornerRadius = 16;
bindThemeStroke(scalePanel, 'color/border/subtle', '#e4e4e7', 1);
modeRow.appendChild(scalePanel);

const scaleTitle = figma.createText();
scaleTitle.fontName   = { family: 'Inter', style: 'Bold' };
scaleTitle.fontSize   = 18;
scaleTitle.characters = 'Typography Scale Modes';
bindThemeColor(scaleTitle, 'color/background/content', '#000000');
scaleTitle.x = 24;
scaleTitle.y = 24;
scalePanel.appendChild(scaleTitle);

// Must match Typography collection modes in /create-design-system (85 … 200)
const scaleSteps = [
  { mode: '85',  size: 10 },
  { mode: '100', size: 13 },
  { mode: '110', size: 14 },
  { mode: '120', size: 15 },
  { mode: '130', size: 17 },
  { mode: '150', size: 20 },
  { mode: '175', size: 23 },
  { mode: '200', size: 26 },
];

const modeColW = 74;
scaleSteps.forEach((step, si) => {
  const specimen = figma.createText();
  specimen.fontName   = { family: 'Inter', style: 'Bold' };
  specimen.fontSize   = step.size;
  specimen.characters = 'Aa';
  bindThemeColor(specimen, 'color/background/content', '#0a0a0a');
  specimen.x = 24 + si * modeColW;
  specimen.y = 72;
  scalePanel.appendChild(specimen);

  const modeLabel = figma.createText();
  modeLabel.fontName   = { family: 'Inter', style: 'Regular' };
  modeLabel.fontSize   = 10;
  modeLabel.characters = step.mode;
  bindThemeColor(modeLabel, 'color/background/content-muted', '#737373');
  modeLabel.x = 24 + si * modeColW;
  modeLabel.y = 120;
  scalePanel.appendChild(modeLabel);
});

addPlaceholder(scalePanel, 'font-scale');

// ────────────────────────────────────────────────────────────────
// Section 4: How to Bind — 3 step cards
// ────────────────────────────────────────────────────────────────
const bindSection = sectionShell('token-overview/how-to-bind');

const bindTitle = figma.createText();
bindTitle.fontName   = { family: 'Inter', style: 'Bold' };
bindTitle.fontSize   = 20;
bindTitle.characters = 'Binding Tokens in Figma';
bindThemeColor(bindTitle, 'color/background/content', '#000000');
bindTitle.layoutAlign = 'STRETCH';
bindSection.appendChild(bindTitle);

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

const BIND_CARD_W = (SECTION_WIDTH - 80 - 32 * 2) / 3;

const bindRow = figma.createFrame();
bindRow.name = 'bind-cards-row';
bindRow.layoutMode = 'HORIZONTAL';
bindRow.primaryAxisSizingMode = 'AUTO';
bindRow.counterAxisSizingMode = 'AUTO';
bindRow.itemSpacing = 32;
bindRow.fills = [];
bindRow.layoutAlign = 'STRETCH';
bindSection.appendChild(bindRow);

bindCards.forEach((card) => {
  const cardFrame = figma.createFrame();
  cardFrame.name = `bind-card/${card.title}`;
  cardFrame.layoutMode = 'VERTICAL';
  cardFrame.primaryAxisSizingMode = 'AUTO';
  cardFrame.counterAxisSizingMode = 'FIXED';
  cardFrame.resize(BIND_CARD_W, 100);
  cardFrame.paddingLeft = cardFrame.paddingRight = 16;
  cardFrame.paddingTop = cardFrame.paddingBottom = 16;
  cardFrame.itemSpacing = 8;
  bindThemeColor(cardFrame, 'color/background/default', '#fafafa');
  cardFrame.cornerRadius = 12;
  bindRow.appendChild(cardFrame);

  const iconText = figma.createText();
  iconText.fontName   = { family: 'Inter', style: 'Bold' };
  iconText.fontSize   = 20;
  iconText.characters = card.icon;
  bindThemeColor(iconText, 'color/background/content', '#0a0a0a');
  iconText.layoutAlign = 'STRETCH';
  cardFrame.appendChild(iconText);

  const cardTitle = figma.createText();
  cardTitle.fontName   = { family: 'Inter', style: 'Bold' };
  cardTitle.fontSize   = 13;
  cardTitle.characters = card.title;
  bindThemeColor(cardTitle, 'color/background/content', '#000000');
  cardTitle.layoutAlign = 'STRETCH';
  cardFrame.appendChild(cardTitle);

  const cardBody = figma.createText();
  cardBody.fontName   = { family: 'Inter', style: 'Regular' };
  cardBody.fontSize   = 11;
  cardBody.characters = card.body;
  bindThemeColor(cardBody, 'color/background/content-muted', '#525252');
  cardBody.textAutoResize = 'HEIGHT';
  cardBody.resize(BIND_CARD_W - 32, 120);
  cardBody.layoutAlign = 'STRETCH';
  cardFrame.appendChild(cardBody);
});

// ────────────────────────────────────────────────────────────────
// Section 5: Claude command reference — dark 2×3 grid of 6 cards
// ────────────────────────────────────────────────────────────────
const claudeSection = figma.createFrame();
claudeSection.name = 'token-overview/claude-commands';
claudeSection.layoutMode = 'VERTICAL';
claudeSection.primaryAxisSizingMode = 'AUTO';
claudeSection.counterAxisSizingMode = 'FIXED';
claudeSection.resize(SECTION_WIDTH, 100);
claudeSection.paddingTop = claudeSection.paddingBottom = 32;
claudeSection.paddingLeft = claudeSection.paddingRight = 40;
claudeSection.itemSpacing = 24;
bindPrimColor(claudeSection, 'color/neutral/950', '#0a0a0a');
claudeSection.cornerRadius = 16;
claudeSection.layoutAlign = 'STRETCH';
pageContent.appendChild(claudeSection);

const claudeTitle = figma.createText();
claudeTitle.fontName   = { family: 'Inter', style: 'Bold' };
claudeTitle.fontSize   = 20;
claudeTitle.characters = 'Maintaining Tokens with Claude';
bindPrimColor(claudeTitle, 'color/neutral/50', '#fafafa');
claudeTitle.layoutAlign = 'STRETCH';
claudeSection.appendChild(claudeTitle);

const commands = [
  { cmd: '/create-design-system', desc: 'Push new brand tokens to all 5 collections' },
  { cmd: '/sync-design-system',   desc: 'Sync changes between Figma and tokens.css' },
  { cmd: '/create-component',     desc: 'Install shadcn components + draw to canvas' },
  { cmd: '/code-connect',         desc: 'Wire Figma components to code counterparts' },
  { cmd: '/accessibility-check',  desc: 'WCAG AA audit + Dynamic Type simulation' },
  { cmd: '/new-language',         desc: 'Localize a frame to a new language' },
];

const CMD_CARD_W = (SECTION_WIDTH - 80 - 32) / 2;
const CMD_CARD_H = 96;

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
  cmdRow.itemSpacing = 32;
  cmdRow.fills = [];
  cmdRow.layoutAlign = 'STRETCH';
  cmdGrid.appendChild(cmdRow);

  commands.slice(r * 2, r * 2 + 2).forEach((item) => {
    const cmdCard = figma.createFrame();
    cmdCard.name = `cmd-card/${item.cmd}`;
    cmdCard.resize(CMD_CARD_W, CMD_CARD_H);
    bindPrimColor(cmdCard, 'color/neutral/900', '#171717');
    cmdCard.cornerRadius = 12;
    cmdRow.appendChild(cmdCard);

    const cmdText = figma.createText();
    cmdText.fontName   = { family: 'Inter', style: 'Bold' };
    cmdText.fontSize   = 14;
    cmdText.characters = item.cmd;
    bindPrimColor(cmdText, 'color/neutral/50', '#fafafa');
    cmdText.x = 16;
    cmdText.y = 16;
    cmdCard.appendChild(cmdText);

    const descText = figma.createText();
    descText.fontName   = { family: 'Inter', style: 'Regular' };
    descText.fontSize   = 12;
    descText.characters = item.desc;
    bindPrimColor(descText, 'color/neutral/400', '#a3a3a3');
    descText.x = 16;
    descText.y = 44;
    cmdCard.appendChild(descText);
  });
}

const footerNote = figma.createText();
footerNote.fontName   = { family: 'Inter', style: 'Regular' };
footerNote.fontSize   = 12;
footerNote.characters = 'All commands run from the terminal via Claude Code. The plugin reads SKILL.md files — no install required. See README.md in the plugin repo for setup.';
bindPrimColor(footerNote, 'color/neutral/400', '#a3a3a3');
footerNote.layoutAlign = 'STRETCH';
claudeSection.appendChild(footerNote);
```
