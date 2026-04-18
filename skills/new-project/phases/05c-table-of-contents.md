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

## Success criteria
TOC section cards, rows, and summary bar exist; no URL hyperlinks yet.

## Step 5c — Draw Table of Contents

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `📝 Table of Contents` page. Wrap all TOC body content in a `_PageContent` vertical auto-layout frame at `y = 360` (below the header once Step 5b runs). Each section card and each two-column row is auto-layout so card height **hugs** its rows — do not precompute `cardHeight` or a running `currentY`. **Do not** set hyperlinks here; Step **5c-links** runs after Steps 5b, 5d, and 5e.

```javascript
// Navigate to the Table of Contents page
const tocPage = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(tocPage);

// ── Section card data ─────────────────────────────────────────────
const sections = [
  {
    title: 'Meta',
    pages: ['Thumbnail'],
  },
  {
    title: '📝 Token & Style Docs',
    pages: ['↳ Token Overview'],
  },
  {
    title: '🖍️ Style Guide',
    pages: ['↳ Primitives', '↳ Theme', '↳ Layout', '↳ Text Styles', '↳ Effects'],
  },
  {
    title: '🖼️ Brand Assets',
    pages: ['↳ Logo Marks', '↳ Vector Patterns', '↳ Icons', '↳ Imagery', '↳ Motion'],
  },
  {
    title: '⚛️ Atoms',
    pages: ['↳ Typography', '↳ Text blocks', '↳ Label', '↳ Kbd', '↳ Dividers', '↳ Avatar', '↳ Badge', '↳ Chips', '↳ Tags', '↳ Counters', '↳ Aspect Ratio'],
  },
  {
    title: '🔘 Buttons & Controls',
    pages: ['↳ Buttons', '↳ Button Group', '↳ Toggle', '↳ Toggle Group', '↳ Segmented Controller'],
  },
  {
    title: '📝 Inputs & Forms',
    pages: ['↳ Text Field', '↳ Textarea', '↳ Number Input', '↳ Input Group', '↳ Input OTP', '↳ Checkbox', '↳ Radio', '↳ Switch', '↳ Select', '↳ Native Select', '↳ Combobox', '↳ Slider', '↳ Keypad', '↳ Image Select', '↳ Calendar', '↳ Date Picker', '↳ Field', '↳ Form Composite Groups'],
  },
  {
    title: '💬 Feedback & Status',
    pages: ['↳ Alerts', '↳ Toast', '↳ Sonner', '↳ Notifications', '↳ Progress Bar', '↳ Progress Dial', '↳ Loaders', '↳ Skeleton', '↳ Spinner', '↳ Blank states', '↳ Error States'],
  },
  {
    title: '🗂️ Overlays',
    pages: ['↳ Dialogue', '↳ Drawer', '↳ Sheets', '↳ Sheet Sockets', '↳ Popover', '↳ Hover Card', '↳ Tooltips', '↳ Context Menu', '↳ Dropdown Menu', '↳ Command'],
  },
  {
    title: '🧭 Navigation',
    pages: ['↳ Top Navigation', '↳ Bottom Navigation', '↳ Tablet Navigation', '↳ Sidebar', '↳ Navigation Menu', '↳ Menubar', '↳ Action bars', '↳ Tabs bar', '↳ Breadcrumb', '↳ Pagination', '↳ Intra-app Navigation'],
  },
  {
    title: '📊 Data Display',
    pages: ['↳ Data Table', '↳ Lists', '↳ Chart', '↳ Stat block', '↳ Widgets', '↳ Video player'],
  },
  {
    title: '🗃️ Content Containers',
    pages: ['↳ Cards', '↳ Tiles', '↳ Select Tile', '↳ Carousel', '↳ Scroll Area', '↳ Accordion', '↳ Collapsible', '↳ Resizable'],
  },
  {
    title: '📱 Native & Platform',
    pages: ['↳ Native Device Parts'],
  },
  {
    title: '🔧 Utility',
    pages: ['Documentation components', 'Grids', 'parking lot'],
  },
];

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

const COL_GAP    = 32;
const CARD_WIDTH = 844; // two cards + gap fit inside 1800 − 80px horizontal padding (1720 inner / 2 − 16 gap half)
const PADDING    = 24;
const ROW_HEIGHT = 40;

const pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.resize(1800, 100);
pageContent.paddingTop    = 40;
pageContent.paddingBottom = 80;
pageContent.paddingLeft   = 40;
pageContent.paddingRight  = 40;
pageContent.itemSpacing   = 40;
pageContent.fills = [];
pageContent.x = 0;
pageContent.y = 360;
tocPage.appendChild(pageContent);

let totalPageCount = 0;

for (let i = 0; i < sections.length; i += 2) {
  const leftSection  = sections[i];
  const rightSection = sections[i + 1];
  const rowSections  = rightSection ? [leftSection, rightSection] : [leftSection];

  const rowWrapper = figma.createFrame();
  rowWrapper.name = `toc-row/${i}`;
  rowWrapper.layoutMode = 'HORIZONTAL';
  rowWrapper.primaryAxisSizingMode = 'AUTO';
  rowWrapper.counterAxisSizingMode = 'AUTO';
  rowWrapper.itemSpacing = COL_GAP;
  rowWrapper.fills = [];
  rowWrapper.layoutAlign = 'STRETCH';
  pageContent.appendChild(rowWrapper);

  rowSections.forEach((section) => {
    totalPageCount += section.pages.length;

    const card = figma.createFrame();
    card.name = `toc-card/${section.title}`;
    card.layoutMode = 'VERTICAL';
    card.primaryAxisSizingMode = 'AUTO';
    card.counterAxisSizingMode = 'FIXED';
    card.resize(CARD_WIDTH, 100);
    card.paddingTop = card.paddingBottom = PADDING;
    card.paddingLeft = card.paddingRight = PADDING;
    card.itemSpacing = 0;
    card.fills       = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
    card.cornerRadius = 16;
    card.strokes     = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    card.strokeWeight = 1;
    rowWrapper.appendChild(card);

    const sectionTitle = figma.createText();
    sectionTitle.fontName   = { family: 'Inter', style: 'Bold' };
    sectionTitle.fontSize   = 16;
    sectionTitle.characters = section.title;
    sectionTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    sectionTitle.layoutAlign = 'STRETCH';
    card.appendChild(sectionTitle);

    const underline = figma.createRectangle();
    underline.resize(CARD_WIDTH - PADDING * 2, 1);
    underline.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    underline.layoutAlign = 'STRETCH';
    card.appendChild(underline);

    const titleGap = figma.createFrame();
    titleGap.name = 'toc-title-gap';
    titleGap.resize(1, 12);
    titleGap.fills = [];
    titleGap.layoutAlign = 'STRETCH';
    card.appendChild(titleGap);

    section.pages.forEach((pageName, rowIndex) => {
      const linkRow = figma.createFrame();
      linkRow.name = `toc-link/${pageName}`;
      linkRow.layoutMode = 'HORIZONTAL';
      linkRow.primaryAxisSizingMode = 'FIXED';
      linkRow.counterAxisSizingMode = 'FIXED';
      linkRow.resize(CARD_WIDTH - PADDING * 2, ROW_HEIGHT);
      linkRow.itemSpacing = 8;
      linkRow.primaryAxisAlignItems = 'CENTER';
      linkRow.counterAxisAlignItems = 'CENTER';
      linkRow.fills = [];
      linkRow.layoutAlign = 'STRETCH';
      card.appendChild(linkRow);

      const displayName = pageName.replace(/^↳ /, '');

      const pageText = figma.createText();
      pageText.fontName   = { family: 'Inter', style: 'Regular' };
      pageText.fontSize   = 14;
      pageText.characters = displayName;
      pageText.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
      pageText.layoutGrow = 1;
      linkRow.appendChild(pageText);

      const arrow = figma.createText();
      arrow.fontName   = { family: 'Inter', style: 'Regular' };
      arrow.fontSize   = 14;
      arrow.characters = '→';
      arrow.fills      = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.7 } }];
      linkRow.appendChild(arrow);

      if (rowIndex < section.pages.length - 1) {
        const rowBorder = figma.createRectangle();
        rowBorder.resize(CARD_WIDTH - PADDING * 2, 1);
        rowBorder.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
        rowBorder.layoutAlign = 'STRETCH';
        card.appendChild(rowBorder);
      }
    });
  });
}

const today = new Date().toISOString().slice(0, 10);
const summaryBar = figma.createFrame();
summaryBar.name = 'toc-summary-bar';
summaryBar.resize(1720, 72);
summaryBar.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
summaryBar.cornerRadius = 12;
summaryBar.layoutAlign = 'STRETCH';
pageContent.appendChild(summaryBar);

const summaryText = figma.createText();
summaryText.fontName   = { family: 'Inter', style: 'Regular' };
summaryText.fontSize   = 13;
summaryText.characters = `${totalPageCount} pages across ${sections.length} sections — generated by /new-project on ${today}`;
summaryText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
summaryText.textAlignHorizontal = 'CENTER';
summaryText.resize(1720, 72);
summaryText.layoutAlign = 'STRETCH';
summaryBar.appendChild(summaryText);
```
