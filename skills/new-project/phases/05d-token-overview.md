# Phase 05d — Token Overview skeleton

## Runtime order
Runs **after** Phases 05c and 05b.

## Goal
Draw the Token Overview documentation skeleton on `↳ Token Overview` with `placeholder/{section}` nodes for `/create-design-system` Step 18.

## Prerequisites
- Phases 05, 05c, and 05b complete per orchestrator order.

## Placeholders
None in the script.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
`_PageContent` with all sections from the phase script; amber placeholder strips present.

## Step 5d — Draw Token Overview Skeleton

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `↳ Token Overview` page. Wrap all Token Overview body sections in a `_PageContent` vertical auto-layout frame at `y = 360` (same pattern as Step 5c). Each major section is a vertical auto-layout frame that **hugs** height; stack the platform-mapping **table rows** inside a vertical auto-layout inner container so the section height follows row count — **no** `sectionY` / `tableHeight` accumulators. Mark every placeholder element with an amber annotation text node named `placeholder/{section}` so that Step 18 in `/create-design-system` knows which elements to replace with real token values.

```javascript
// Navigate to the Token Overview page
const overviewPage = figma.root.children.find(p => p.name === '↳ Token Overview');
await figma.setCurrentPageAsync(overviewPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

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
pageContent.fills = [];
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
  s.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  s.cornerRadius = 16;
  s.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
  s.strokeWeight = 1;
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
archTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
  box.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
  box.cornerRadius = 12;
  archBoxesRow.appendChild(box);

  const colName = figma.createText();
  colName.fontName   = { family: 'Inter', style: 'Bold' };
  colName.fontSize   = 14;
  colName.characters = col.name;
  colName.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  colName.layoutAlign = 'STRETCH';
  box.appendChild(colName);

  const colNote = figma.createText();
  colNote.fontName   = { family: 'Inter', style: 'Regular' };
  colNote.fontSize   = 11;
  colNote.characters = col.note;
  colNote.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, opacity: 0.6 } }];
  colNote.layoutAlign = 'STRETCH';
  box.appendChild(colNote);

  if (i < collections.length - 1) {
    const arrow = figma.createText();
    arrow.fontName   = { family: 'Inter', style: 'Bold' };
    arrow.fontSize   = 20;
    arrow.characters = '→';
    arrow.fills      = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
    archBoxesRow.appendChild(arrow);
  }
});

const archCaption = figma.createText();
archCaption.fontName   = { family: 'Inter', style: 'Regular' };
archCaption.fontSize   = 13;
archCaption.characters = 'Primitives hold raw values. All other collections alias into Primitives — change a Primitive, all semantic tokens update automatically.';
archCaption.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
archCaption.layoutAlign = 'STRETCH';
arch.appendChild(archCaption);

addPlaceholder(arch, 'architecture');

// ────────────────────────────────────────────────────────────────
// Section 2: Platform Mapping table
// ────────────────────────────────────────────────────────────────
const platformRows = [
  ['color/background/default',   'var(--color-background)',       'surface',               '.Back.default'],
  ['color/primary/default',      'var(--color-primary)',          'primary',               '.Primary.default'],
  ['color/border/default',       'var(--color-border)',           'outline',               '.Border.default'],
  ['color/status/error',         'var(--color-danger)',           'error',                 '.Status.error'],
  ['Headline/LG/font-size',      'var(--headline-lg-font-size)',  'headline-lg-font-size', '.Typography.headlineLg.fontSize'],
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
platTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
headerRow.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
headerRow.cornerRadius = 8;
headerRow.layoutAlign = 'STRETCH';
tableStack.appendChild(headerRow);

let colX = 0;
tableHeaders.forEach((h, ci) => {
  const hText = figma.createText();
  hText.fontName   = { family: 'Inter', style: 'Bold' };
  hText.fontSize   = 12;
  hText.characters = h;
  hText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  hText.x = colX + 12;
  hText.y = (TABLE_ROW_HEIGHT - 12) / 2;
  headerRow.appendChild(hText);
  colX += TABLE_COL_WIDTHS[ci];
});

platformRows.forEach((row, ri) => {
  const rowFill = ri % 2 === 0
    ? [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }]
    : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  const dataRow = figma.createFrame();
  dataRow.name  = `table-row/${ri}`;
  dataRow.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
  dataRow.fills = rowFill;
  dataRow.layoutAlign = 'STRETCH';
  tableStack.appendChild(dataRow);

  let cellX = 0;
  row.forEach((cell, ci) => {
    const cellText = figma.createText();
    cellText.fontName   = { family: 'Inter', style: ci === 0 ? 'Semi Bold' : 'Regular' };
    cellText.fontSize   = 12;
    cellText.characters = cell;
    cellText.fills      = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
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
platCaption.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
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
darkPanel.fills       = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
darkPanel.cornerRadius = 16;
darkPanel.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
darkPanel.strokeWeight = 1;
modeRow.appendChild(darkPanel);

const darkTitle = figma.createText();
darkTitle.fontName   = { family: 'Inter', style: 'Bold' };
darkTitle.fontSize   = 18;
darkTitle.characters = 'Dark Mode';
darkTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
darkTitle.x = 24;
darkTitle.y = 24;
darkPanel.appendChild(darkTitle);

[{ label: 'Light', fill: { r: 0.95, g: 0.95, b: 0.95 }, x: 40  },
 { label: 'Dark',  fill: { r: 0.1,  g: 0.1,  b: 0.1  }, x: 360 }].forEach(phone => {
  const frame = figma.createRectangle();
  frame.resize(200, 140);
  frame.x           = phone.x;
  frame.y           = 64;
  frame.fills       = [{ type: 'SOLID', color: phone.fill }];
  frame.cornerRadius = 8;
  frame.strokes     = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  frame.strokeWeight = 1;
  darkPanel.appendChild(frame);

  const lbl = figma.createText();
  lbl.fontName   = { family: 'Inter', style: 'Regular' };
  lbl.fontSize   = 12;
  lbl.characters = phone.label;
  lbl.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
  lbl.x = phone.x + 80;
  lbl.y = 212;
  darkPanel.appendChild(lbl);
});

addPlaceholder(darkPanel, 'dark-mode');

const scalePanel = figma.createFrame();
scalePanel.name = 'font-scale-panel';
scalePanel.resize(660, 360);
scalePanel.fills       = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
scalePanel.cornerRadius = 16;
scalePanel.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
scalePanel.strokeWeight = 1;
modeRow.appendChild(scalePanel);

const scaleTitle = figma.createText();
scaleTitle.fontName   = { family: 'Inter', style: 'Bold' };
scaleTitle.fontSize   = 18;
scaleTitle.characters = 'Typography Scale Modes';
scaleTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
  specimen.fills      = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
  specimen.x = 24 + si * modeColW;
  specimen.y = 72;
  scalePanel.appendChild(specimen);

  const modeLabel = figma.createText();
  modeLabel.fontName   = { family: 'Inter', style: 'Regular' };
  modeLabel.fontSize   = 10;
  modeLabel.characters = step.mode;
  modeLabel.fills      = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
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
bindTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
  cardFrame.fills       = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  cardFrame.cornerRadius = 12;
  bindRow.appendChild(cardFrame);

  const iconText = figma.createText();
  iconText.fontName   = { family: 'Inter', style: 'Bold' };
  iconText.fontSize   = 20;
  iconText.characters = card.icon;
  iconText.fills      = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
  iconText.layoutAlign = 'STRETCH';
  cardFrame.appendChild(iconText);

  const cardTitle = figma.createText();
  cardTitle.fontName   = { family: 'Inter', style: 'Bold' };
  cardTitle.fontSize   = 13;
  cardTitle.characters = card.title;
  cardTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  cardTitle.layoutAlign = 'STRETCH';
  cardFrame.appendChild(cardTitle);

  const cardBody = figma.createText();
  cardBody.fontName   = { family: 'Inter', style: 'Regular' };
  cardBody.fontSize   = 11;
  cardBody.characters = card.body;
  cardBody.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
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
claudeSection.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
claudeSection.cornerRadius = 16;
claudeSection.layoutAlign = 'STRETCH';
pageContent.appendChild(claudeSection);

const claudeTitle = figma.createText();
claudeTitle.fontName   = { family: 'Inter', style: 'Bold' };
claudeTitle.fontSize   = 20;
claudeTitle.characters = 'Maintaining Tokens with Claude';
claudeTitle.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
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
    cmdCard.fills       = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
    cmdCard.cornerRadius = 12;
    cmdRow.appendChild(cmdCard);

    const cmdText = figma.createText();
    cmdText.fontName   = { family: 'Inter', style: 'Bold' };
    cmdText.fontSize   = 14;
    cmdText.characters = item.cmd;
    cmdText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    cmdText.x = 16;
    cmdText.y = 16;
    cmdCard.appendChild(cmdText);

    const descText = figma.createText();
    descText.fontName   = { family: 'Inter', style: 'Regular' };
    descText.fontSize   = 12;
    descText.characters = item.desc;
    descText.fills      = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
    descText.x = 16;
    descText.y = 44;
    cmdCard.appendChild(descText);
  });
}

const footerNote = figma.createText();
footerNote.fontName   = { family: 'Inter', style: 'Regular' };
footerNote.fontSize   = 12;
footerNote.characters = 'All commands run from the terminal via Claude Code. The plugin reads SKILL.md files — no install required. See README.md in the plugin repo for setup.';
footerNote.fills      = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
footerNote.layoutAlign = 'STRETCH';
claudeSection.appendChild(footerNote);
```
