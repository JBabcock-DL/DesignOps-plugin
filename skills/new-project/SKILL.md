---
name: new-project
description: Scaffold a new Detroit Labs Foundations design system file via the Figma MCP, creating the file in Drafts with the full page hierarchy from the Detroit Labs Foundations template.
argument-hint: "Optional: --team \"Team Name\" --name \"Project Name\" --platform web|android|ios|all|skip. All arguments are optional — any that are omitted will be prompted interactively."
agent: general-purpose
---

# /new-project

You are scaffolding a new Detroit Labs Foundations design system file in Figma.

Your first action is to collect the required inputs using AskUserQuestion — do not output any text before the first AskUserQuestion call.

> **Platform note:** Figma's public REST API does not support creating project folders or moving files between projects. The file is created in Drafts via the Figma MCP connector and page structure is built automatically. The user receives a single move instruction at the end to place it into the correct project folder. Do not attempt any REST API calls for folder creation or file moves.

---

## Step 1 — Collect Project Details

Parse `$ARGUMENTS` for `--team`, `--name`, and `--platform`. For each value not already provided, call AskUserQuestion. Ask one at a time and wait for each reply before asking the next.

**If `--team` is missing**, call AskUserQuestion:
> "What is the name of the Figma team this project lives under? (Used for file titles.)"

**If `--name` is missing**, call AskUserQuestion:
> "What is the project name? (e.g. `Acme Mobile App`) This will appear in the title of every file created."

**If `--platform` is missing**, call AskUserQuestion:
> "What is the primary platform for this project?
> - **web** — Next.js / React (Tailwind token collection)
> - **android** — Android / Compose (Material 3 collection)
> - **ios** — iOS / SwiftUI (Apple HIG collection)
> - **all** — All platforms (web + android + ios)
> - **skip** — Set up the design system separately later"

Use the Project Name verbatim in all file titles — do not normalize or reformat it.

---

## Step 2 — Confirm the File

Before creating anything, show the user what will be created and ask for confirmation. Wait for their reply before proceeding.

> Here is what I will create for "\<Project Name\>" in the "\<Team Name\>" team:
>
> | File | Figma Type | Target Folder |
> |---|---|---|
> | \<Project Name\> — Foundations | Design | Design-Systems/ |
>
> The file will be created in your Drafts with the full Detroit Labs Foundations page hierarchy pre-built. You'll get a single move instruction at the end to place it in your Design-Systems/ project folder.
>
> Shall I proceed? (yes / no / edit)

If the designer responds `edit` or requests a change, update the plan and re-present. Only continue to Step 3 after receiving an explicit `yes`.

---

## Step 3 — Get Plan Key

Call `whoami` to retrieve the available plans. If the user has one plan, use its `key` field automatically. If multiple plans exist, call AskUserQuestion:
> "I found multiple Figma plans on your account. Which team or organization should I create the file under?"

Store the selected value as `PLAN_KEY`.

---

## Step 4 — Create the Foundations File

Call `create_new_file`:
```
fileName: "<Project Name> — Foundations"
editorType: "design"
planKey: PLAN_KEY
```

Capture the returned `fileKey`. This is the file you will scaffold in Step 5.

---

## Step 5 — Scaffold the Page Hierarchy

Immediately call `use_figma` with the `fileKey` from Step 4. This creates the full page hierarchy matching the Detroit Labs Foundations template exactly.

After Step 5 completes successfully, run **Steps 5b → 5e in order** — each step is its **own** `use_figma` invocation (plugin context resets between calls). Pass the same `fileKey` and inject the **Project Name** string anywhere a step shows `PROJECT_NAME`.

```javascript
const pages = [
  // ── Meta ──────────────────────────────────────────
  "Thumbnail",

  // ── Token & Style Docs ────────────────────────────
  "---",
  "📝 Table of Contents",
  "↳ Token Overview",
  "↳ MCP Tokens",

  // ── Style Guide ───────────────────────────────────
  "---",
  "🖍️ Style Guide",
  "↳ Primitives",
  "↳ Theme",
  "↳ Layout",
  "↳ Text Styles",
  "↳ Effects",

  // ── Brand ─────────────────────────────────────────
  "---",
  "🖼️ Brand Assets",
  "↳ Logo Marks",
  "↳ Vector Patterns",
  "↳ Icons",
  "↳ Imagery",
  "↳ Motion",

  // ── Atoms ─────────────────────────────────────────
  "---",
  "⚛️ Atoms",
  "↳ Typography",
  "↳ Text blocks",
  "↳ Label",
  "↳ Kbd",
  "↳ Dividers",
  "↳ Avatar",
  "↳ Badge",
  "↳ Chips",
  "↳ Tags",
  "↳ Counters",
  "↳ Aspect Ratio",

  // ── Buttons & Controls ────────────────────────────
  "---",
  "🔘 Buttons & Controls",
  "↳ Buttons",
  "↳ Button Group",
  "↳ Toggle",
  "↳ Toggle Group",
  "↳ Segmented Controller",

  // ── Inputs & Forms ────────────────────────────────
  "---",
  "📝 Inputs & Forms",
  "↳ Text Field",
  "↳ Textarea",
  "↳ Number Input",
  "↳ Input Group",
  "↳ Input OTP",
  "↳ Checkbox",
  "↳ Radio",
  "↳ Switch",
  "↳ Select",
  "↳ Native Select",
  "↳ Combobox",
  "↳ Slider",
  "↳ Keypad",
  "↳ Image Select",
  "↳ Calendar",
  "↳ Date Picker",
  "↳ Field",
  "↳ Form Composite Groups",

  // ── Feedback & Status ─────────────────────────────
  "---",
  "💬 Feedback & Status",
  "↳ Alerts",
  "↳ Toast",
  "↳ Sonner",
  "↳ Notifications",
  "↳ Progress Bar",
  "↳ Progress Dial",
  "↳ Loaders",
  "↳ Skeleton",
  "↳ Spinner",
  "↳ Blank states",
  "↳ Error States",

  // ── Overlays ──────────────────────────────────────
  "---",
  "🗂️ Overlays",
  "↳ Dialogue",
  "↳ Drawer",
  "↳ Sheets",
  "↳ Sheet Sockets",
  "↳ Popover",
  "↳ Hover Card",
  "↳ Tooltips",
  "↳ Context Menu",
  "↳ Dropdown Menu",
  "↳ Command",

  // ── Navigation ────────────────────────────────────
  "---",
  "🧭 Navigation",
  "↳ Top Navigation",
  "↳ Bottom Navigation",
  "↳ Tablet Navigation",
  "↳ Sidebar",
  "↳ Navigation Menu",
  "↳ Menubar",
  "↳ Action bars",
  "↳ Tabs bar",
  "↳ Breadcrumb",
  "↳ Pagination",
  "↳ Intra-app Navigation",

  // ── Data Display ──────────────────────────────────
  "---",
  "📊 Data Display",
  "↳ Data Table",
  "↳ Lists",
  "↳ Chart",
  "↳ Stat block",
  "↳ Widgets",
  "↳ Video player",

  // ── Content Containers ────────────────────────────
  "---",
  "🗃️ Content Containers",
  "↳ Cards",
  "↳ Tiles",
  "↳ Select Tile",
  "↳ Carousel",
  "↳ Scroll Area",
  "↳ Accordion",
  "↳ Collapsible",
  "↳ Resizable",

  // ── Native & Platform ─────────────────────────────
  "---",
  "📱 Native & Platform",
  "↳ Native Device Parts",

  // ── Utility ───────────────────────────────────────
  "---",
  "Documentation components",
  "Grids",
  "parking lot"
];

// Rename the default first page rather than deleting it
figma.root.children[0].name = pages[0];

// Create remaining pages in order
for (let i = 1; i < pages.length; i++) {
  const page = figma.createPage();
  page.name = pages[i];
}
```

---

## Step 5b — Draw Documentation Headers

Call `use_figma` with the `fileKey` from Step 4. Loop over every page in the file and draw a `_Header` documentation frame at y=0 on each page. All page navigation and drawing happens inside a single `use_figma` call.

```javascript
const descriptions = {
  "---":                        "Visual divider between page groups in the left sidebar (no component canvas).",
  "Thumbnail":                  "File cover and thumbnail.",
  "📝 Table of Contents":       "Index of all pages in this design system with links to each section.",
  "↳ Token Overview":           "How the token architecture works and how to use it with Claude.",
  "↳ MCP Tokens":               "Machine-readable token manifest for agent and developer tooling.",
  "🖍️ Style Guide":             "Visual documentation of all design tokens in this system.",
  "↳ Primitives":               "Raw color ramps, spacing scale, corner radius scale, and elevation values.",
  "↳ Theme":                    "Semantic color tokens — light and dark mode aliases into Primitives.",
  "↳ Layout":                   "Space and radius semantic tokens wired to the spacing and corner scale.",
  "↳ Text Styles":              "Typography scale — 12 style slots across Display, Headline, Body, and Label.",
  "↳ Effects":                  "Shadow and elevation tokens — light and dark mode opacity variants.",
  "🖼️ Brand Assets":            "Brand identity elements — logos, patterns, icons, imagery, and motion.",
  "↳ Logo Marks":               "Primary and secondary logo lockups, usage rules, and clear space.",
  "↳ Vector Patterns":          "Decorative vector patterns and background motifs.",
  "↳ Icons":                    "Icon library — lucide-react or Material Icons reference set.",
  "↳ Imagery":                  "Photography style, illustration guidelines, and asset examples.",
  "↳ Motion":                   "Animation principles, duration tokens, and easing curves.",
  "⚛️ Atoms":                   "Base-level UI elements that form the foundation of all components.",
  "↳ Typography":               "Text component usage — headings, body, labels, and captions.",
  "↳ Text blocks":              "Multi-line text containers and rich text usage.",
  "↳ Label":                    "Form labels, field labels, and annotation text.",
  "↳ Kbd":                      "Keyboard shortcut indicators.",
  "↳ Dividers":                 "Horizontal and vertical separators.",
  "↳ Avatar":                   "User profile images and fallback initials.",
  "↳ Badge":                    "Status indicators and count badges.",
  "↳ Chips":                    "Compact selection and filter elements.",
  "↳ Tags":                     "Content categorization labels.",
  "↳ Counters":                 "Numeric indicators for counts and quantities.",
  "↳ Aspect Ratio":             "Constrained ratio containers for media.",
  "🔘 Buttons & Controls":      "Interactive trigger elements.",
  "↳ Buttons":                  "Primary, secondary, ghost, and destructive button variants.",
  "↳ Button Group":             "Grouped button sets for related actions.",
  "↳ Toggle":                   "Binary on/off controls.",
  "↳ Toggle Group":             "Grouped toggle sets for multi-select or single-select.",
  "↳ Segmented Controller":     "Tab-style exclusive selection control.",
  "📝 Inputs & Forms":          "Data entry components.",
  "↳ Text Field":               "Single-line text input.",
  "↳ Textarea":                 "Multi-line text input.",
  "↳ Number Input":             "Numeric stepper input.",
  "↳ Input Group":              "Compound inputs with prefix/suffix add-ons.",
  "↳ Input OTP":                "One-time password digit input.",
  "↳ Checkbox":                 "Multi-select boolean input.",
  "↳ Radio":                    "Single-select option input.",
  "↳ Switch":                   "Toggle switch for settings.",
  "↳ Select":                   "Dropdown single-select.",
  "↳ Native Select":            "Platform-native select element.",
  "↳ Combobox":                 "Searchable select with free-text input.",
  "↳ Slider":                   "Range value input.",
  "↳ Keypad":                   "Numeric keypad for PIN or dial entry.",
  "↳ Image Select":             "Visual media selection control.",
  "↳ Calendar":                 "Date grid picker.",
  "↳ Date Picker":              "Date input with calendar popover.",
  "↳ Field":                    "Form field wrapper with label, input, and helper text.",
  "↳ Form Composite Groups":    "Multi-field form sections and layouts.",
  "💬 Feedback & Status":       "System state communication components.",
  "↳ Alerts":                   "Inline contextual messages.",
  "↳ Toast":                    "Transient notification overlays.",
  "↳ Sonner":                   "Stacked toast notifications.",
  "↳ Notifications":            "Persistent notification items.",
  "↳ Progress Bar":             "Linear progress indicator.",
  "↳ Progress Dial":            "Circular progress indicator.",
  "↳ Loaders":                  "Indeterminate loading states.",
  "↳ Skeleton":                 "Content placeholder loading state.",
  "↳ Spinner":                  "Animated loading spinner.",
  "↳ Blank states":             "Empty state illustrations and copy.",
  "↳ Error States":             "Error page and inline error templates.",
  "🗂️ Overlays":               "Layered UI surfaces — modals, sheets, and menus.",
  "↳ Dialogue":                 "Modal dialog for confirmations and forms.",
  "↳ Drawer":                   "Side-anchored panel.",
  "↳ Sheets":                   "Bottom sheet overlay.",
  "↳ Sheet Sockets":            "Composable sheet content areas.",
  "↳ Popover":                  "Anchored contextual content bubble.",
  "↳ Hover Card":               "On-hover detail card.",
  "↳ Tooltips":                 "Short contextual labels on hover.",
  "↳ Context Menu":             "Right-click action menu.",
  "↳ Dropdown Menu":            "Button-anchored action list.",
  "↳ Command":                  "Keyboard-driven command palette.",
  "🧭 Navigation":              "Wayfinding and routing components.",
  "↳ Top Navigation":           "App header with branding and primary nav.",
  "↳ Bottom Navigation":        "Mobile bottom tab bar.",
  "↳ Tablet Navigation":        "Tablet-optimized navigation rail.",
  "↳ Sidebar":                  "Persistent side navigation panel.",
  "↳ Navigation Menu":          "Mega-menu and flyout navigation.",
  "↳ Menubar":                  "Desktop-style menu bar.",
  "↳ Action bars":              "Contextual action toolbars.",
  "↳ Tabs bar":                 "Horizontal tab navigation.",
  "↳ Breadcrumb":               "Hierarchical location indicator.",
  "↳ Pagination":               "Page navigation controls.",
  "↳ Intra-app Navigation":     "In-page anchor and section navigation.",
  "📊 Data Display":            "Data visualization and structured content.",
  "↳ Data Table":               "Sortable, filterable tabular data.",
  "↳ Lists":                    "Vertical item lists with optional icons and metadata.",
  "↳ Chart":                    "Data visualization charts.",
  "↳ Stat block":               "KPI and metric display blocks.",
  "↳ Widgets":                  "Dashboard widget cards.",
  "↳ Video player":             "Video playback controls and container.",
  "🗃️ Content Containers":     "Layout wrappers for content and media.",
  "↳ Cards":                    "Elevated content containers.",
  "↳ Tiles":                    "Grid-based content tiles.",
  "↳ Select Tile":              "Selectable card tiles.",
  "↳ Carousel":                 "Horizontally scrolling content panel.",
  "↳ Scroll Area":              "Custom scrollbar container.",
  "↳ Accordion":                "Expandable/collapsible content sections.",
  "↳ Collapsible":              "Single expandable section.",
  "↳ Resizable":                "User-resizable panel layout.",
  "📱 Native & Platform":       "Platform-specific UI patterns.",
  "↳ Native Device Parts":      "Status bars, home indicators, and device chrome.",
  "Documentation components":   "The doc header and section components used throughout this file.",
  "Grids":                      "Grid and layout overlay references.",
  "parking lot":                "Scratch space and work in progress.",
};

// Helper: strip leading emoji clusters, "↳ ", and "---" from a page name to get a clean title
function cleanTitle(name) {
  return name
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF} ]+/u, '')
    .replace(/^↳ /, '')
    .trim();
}

for (const page of figma.root.children) {
  // Thumbnail uses the full-bleed Cover (Step 5e) as the file thumbnail — skip doc chrome here to avoid stacking on the gradient.
  if (page.name === 'Thumbnail') continue;

  await figma.setCurrentPageAsync(page);

  const title = cleanTitle(page.name);
  const desc  = descriptions[page.name] || '';

  // ── Header frame (1440×320, black, cornerRadius 24) ──────────────
  const header = figma.createFrame();
  header.name        = '_Header';
  header.resize(1440, 320);
  header.x           = 0;
  header.y           = 0;
  header.fills       = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  header.cornerRadius = 24;
  page.appendChild(header);

  // ── DL logo: 40×40 white ellipse, top-left ────────────────────────
  const logoCircle = figma.createEllipse();
  logoCircle.resize(40, 40);
  logoCircle.x     = 40;
  logoCircle.y     = 40;
  logoCircle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  header.appendChild(logoCircle);

  const logoText = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  logoText.fontName    = { family: 'Inter', style: 'Bold' };
  logoText.fontSize    = 14;
  logoText.characters  = 'DL';
  logoText.fills       = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  logoText.textAlignHorizontal = 'CENTER';
  logoText.textAlignVertical   = 'CENTER';
  logoText.resize(40, 40);
  logoText.x = 40;
  logoText.y = 40;
  header.appendChild(logoText);

  // ── Wordmark: "DETROIT LABS", 12px 600, letterSpacing 2, white, right-aligned ──
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  const wordmark = figma.createText();
  wordmark.fontName        = { family: 'Inter', style: 'Semi Bold' };
  wordmark.fontSize        = 12;
  wordmark.letterSpacing   = { value: 2, unit: 'PIXELS' };
  wordmark.characters      = 'DETROIT LABS';
  wordmark.fills           = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  wordmark.textAlignHorizontal = 'RIGHT';
  wordmark.x = 1400 - wordmark.width;
  wordmark.y = 48;
  header.appendChild(wordmark);

  // ── Title: page name (cleaned), 64px bold white ───────────────────
  const titleNode = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  titleNode.fontName   = { family: 'Inter', style: 'Bold' };
  titleNode.fontSize   = 64;
  titleNode.characters = title;
  titleNode.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  titleNode.x = 40;
  titleNode.y = 140;
  header.appendChild(titleNode);

  // ── Description: 16px regular white at 70% opacity ───────────────
  if (desc) {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const descNode = figma.createText();
    descNode.fontName   = { family: 'Inter', style: 'Regular' };
    descNode.fontSize   = 16;
    descNode.characters = desc;
    descNode.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.7 }];
    descNode.x = 40;
    descNode.y = 240;
    header.appendChild(descNode);
  }

  // ── Content section: 1440×800 frame at y=360, #F7F7F7, dashed stroke ──
  const content = figma.createFrame();
  content.name        = '_Content';
  content.resize(1440, 800);
  content.x           = 0;
  content.y           = 360;
  content.fills       = [{ type: 'SOLID', color: { r: 0.969, g: 0.969, b: 0.969 } }];
  content.cornerRadius = 16;
  content.strokes     = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  content.strokeWeight = 1;
  content.dashPattern  = [8, 4];
  page.appendChild(content);
}
```

---

## Step 5c — Draw Table of Contents

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `📝 Table of Contents` page and draw a 2-column grid of section cards below the doc header, followed by a summary bar.

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
    pages: ['↳ Token Overview', '↳ MCP Tokens'],
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

// Content area starts at y=400 (320px header + 80px gap)
const CARD_WIDTH   = 680;
const COL_GAP      = 32;
const LEFT_MARGIN  = 40;
const START_Y      = 400;
const PADDING      = 24;
const ROW_HEIGHT   = 40;

let currentY = START_Y;
let totalPageCount = 0;

for (let i = 0; i < sections.length; i += 2) {
  const leftSection  = sections[i];
  const rightSection = sections[i + 1];
  const rowSections  = rightSection ? [leftSection, rightSection] : [leftSection];
  let maxCardHeight  = 0;

  rowSections.forEach((section, colIndex) => {
    const cardX = LEFT_MARGIN + colIndex * (CARD_WIDTH + COL_GAP);

    // Calculate card height: section title row (48px) + one row per page (40px) + padding
    const cardHeight = PADDING + 48 + section.pages.length * ROW_HEIGHT + PADDING;
    maxCardHeight = Math.max(maxCardHeight, cardHeight);
    totalPageCount += section.pages.length;

    // Card frame
    const card = figma.createFrame();
    card.name        = `toc-card/${section.title}`;
    card.resize(CARD_WIDTH, cardHeight);
    card.x           = cardX;
    card.y           = currentY;
    card.fills       = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
    card.cornerRadius = 16;
    card.strokes     = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    card.strokeWeight = 1;
    tocPage.appendChild(card);

    // Section title
    const sectionTitle = figma.createText();
    sectionTitle.fontName   = { family: 'Inter', style: 'Bold' };
    sectionTitle.fontSize   = 16;
    sectionTitle.characters = section.title;
    sectionTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    sectionTitle.x = PADDING;
    sectionTitle.y = PADDING;
    card.appendChild(sectionTitle);

    // Underline below section title
    const underline = figma.createLine();
    underline.resize(CARD_WIDTH - PADDING * 2, 0);
    underline.x = PADDING;
    underline.y = PADDING + 36;
    underline.strokes     = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
    underline.strokeWeight = 1;
    card.appendChild(underline);

    // Page link rows
    section.pages.forEach((pageName, rowIndex) => {
      const rowY = PADDING + 48 + rowIndex * ROW_HEIGHT;

      // Named frame for the link row (toc-link/{page-name} convention for agent navigation)
      const linkRow = figma.createFrame();
      linkRow.name        = `toc-link/${pageName}`;
      linkRow.resize(CARD_WIDTH - PADDING * 2, ROW_HEIGHT);
      linkRow.x           = PADDING;
      linkRow.y           = rowY;
      linkRow.fills       = [];
      card.appendChild(linkRow);

      // Page name text (strip ↳ for display; layer name keeps full page id)
      const displayName = pageName.replace(/^↳ /, '');

      const pageText = figma.createText();
      pageText.fontName   = { family: 'Inter', style: 'Regular' };
      pageText.fontSize   = 14;
      pageText.characters = displayName;
      pageText.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
      pageText.x = 0;
      pageText.y = (ROW_HEIGHT - 14) / 2;
      linkRow.appendChild(pageText);

      // Arrow indicator
      const arrow = figma.createText();
      arrow.fontName   = { family: 'Inter', style: 'Regular' };
      arrow.fontSize   = 14;
      arrow.characters = '→';
      arrow.fills      = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.7 } }];
      arrow.x = CARD_WIDTH - PADDING * 2 - 20;
      arrow.y = (ROW_HEIGHT - 14) / 2;
      linkRow.appendChild(arrow);

      // Row bottom border (except last row)
      if (rowIndex < section.pages.length - 1) {
        const rowBorder = figma.createLine();
        rowBorder.resize(CARD_WIDTH - PADDING * 2, 0);
        rowBorder.x = PADDING;
        rowBorder.y = rowY + ROW_HEIGHT;
        rowBorder.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
        rowBorder.strokeWeight = 1;
        card.appendChild(rowBorder);
      }
    });
  });

  currentY += maxCardHeight + COL_GAP;
}

// ── Summary bar ───────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const summaryBar = figma.createFrame();
summaryBar.name        = 'toc-summary-bar';
summaryBar.resize(1360, 72);
summaryBar.x           = LEFT_MARGIN;
summaryBar.y           = currentY + 16;
summaryBar.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
summaryBar.cornerRadius = 12;
tocPage.appendChild(summaryBar);

const summaryText = figma.createText();
summaryText.fontName   = { family: 'Inter', style: 'Regular' };
summaryText.fontSize   = 13;
summaryText.characters = `${totalPageCount} pages across ${sections.length} sections — generated by /new-project on ${today}`;
summaryText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
summaryText.textAlignHorizontal = 'CENTER';
summaryText.resize(1360, 72);
summaryText.x = 0;
summaryText.y = (72 - 13) / 2;
summaryBar.appendChild(summaryText);
```

---

## Step 5d — Draw Token Overview Skeleton

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `↳ Token Overview` page and draw five informational sections below the doc header (starting at y=360). Mark every placeholder element with an amber annotation text node named `placeholder/{section}` so that Step 18 in `/create-design-system` knows which elements to replace with real token values.

```javascript
// Navigate to the Token Overview page
const overviewPage = figma.root.children.find(p => p.name === '↳ Token Overview');
await figma.setCurrentPageAsync(overviewPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });

const SECTION_LEFT   = 40;
const SECTION_WIDTH  = 1360;
let sectionY         = 360;
const SECTION_GAP    = 40;

// ── Helper: amber placeholder annotation ─────────────────────────
function addPlaceholder(parent, sectionName, x, y) {
  const note = figma.createText();
  note.name       = `placeholder/${sectionName}`;
  note.fontName   = { family: 'Inter', style: 'Semi Bold' };
  note.fontSize   = 11;
  note.characters = `⚠ Placeholder — run /create-design-system to populate`;
  note.fills      = [{ type: 'SOLID', color: { r: 0.98, g: 0.72, b: 0.07 } }];
  note.x = x;
  note.y = y;
  parent.appendChild(note);
}

// ────────────────────────────────────────────────────────────────
// Section 1: Architecture Overview
// ────────────────────────────────────────────────────────────────
const arch = figma.createFrame();
arch.name        = 'token-overview/architecture';
arch.resize(SECTION_WIDTH, 340);
arch.x           = SECTION_LEFT;
arch.y           = sectionY;
arch.fills       = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
arch.cornerRadius = 16;
arch.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
arch.strokeWeight = 1;
overviewPage.appendChild(arch);

const archTitle = figma.createText();
archTitle.fontName   = { family: 'Inter', style: 'Bold' };
archTitle.fontSize   = 20;
archTitle.characters = 'How the Token System Works';
archTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
archTitle.x = 40;
archTitle.y = 32;
arch.appendChild(archTitle);

// Five collection boxes: Primitives → Theme, Typography, Layout, Effects
const collections = [
  { name: 'Primitives',   note: 'Raw values' },
  { name: 'Theme',        note: 'Light / Dark' },
  { name: 'Typography',   note: '8 scale modes' },
  { name: 'Layout',       note: 'Space & Radius' },
  { name: 'Effects',      note: 'Shadow & Blur' },
];

collections.forEach((col, i) => {
  const box = figma.createFrame();
  box.name        = `arch-box/${col.name}`;
  box.resize(200, 120);
  box.x           = 40 + i * 240;
  box.y           = 88;
  box.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
  box.cornerRadius = 12;
  arch.appendChild(box);

  const colName = figma.createText();
  colName.fontName   = { family: 'Inter', style: 'Bold' };
  colName.fontSize   = 14;
  colName.characters = col.name;
  colName.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  colName.x = 16;
  colName.y = 32;
  box.appendChild(colName);

  const colNote = figma.createText();
  colNote.fontName   = { family: 'Inter', style: 'Regular' };
  colNote.fontSize   = 11;
  colNote.characters = col.note;
  colNote.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, opacity: 0.6 } }];
  colNote.x = 16;
  colNote.y = 56;
  box.appendChild(colNote);

  // Arrow connector (except after last box)
  if (i < collections.length - 1) {
    const arrow = figma.createText();
    arrow.fontName   = { family: 'Inter', style: 'Bold' };
    arrow.fontSize   = 20;
    arrow.characters = '→';
    arrow.fills      = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
    arrow.x = 40 + i * 240 + 208;
    arrow.y = 134;
    arch.appendChild(arrow);
  }
});

const archCaption = figma.createText();
archCaption.fontName   = { family: 'Inter', style: 'Regular' };
archCaption.fontSize   = 13;
archCaption.characters = 'Primitives hold raw values. All other collections alias into Primitives — change a Primitive, all semantic tokens update automatically.';
archCaption.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
archCaption.x = 40;
archCaption.y = 232;
arch.appendChild(archCaption);

addPlaceholder(arch, 'architecture', 40, 272);

sectionY += 340 + SECTION_GAP;

// ────────────────────────────────────────────────────────────────
// Section 2: Platform Mapping table
// ────────────────────────────────────────────────────────────────
const platformRows = [
  ['color/background/bg',        'var(--background)',             'background',        'systemBackground'],
  ['color/primary/default',      'var(--primary)',                'primary',           'tintColor'],
  ['color/surface/border',       'var(--outline)',                'outline',           'separator'],
  ['color/status/error',         'var(--error)',                  'error',             'systemRed'],
  ['Headline/LG/font-size',      'var(--headline-lg-font-size)',  'headlineLgFontSize','headlineLgFontSize'],
  ['space/md',                   'var(--space-md)',               'spaceMd',           'spaceMd'],
  ['radius/md',                  'var(--radius-md)',              'radiusMd',          'radiusMd'],
  ['shadow/color',               'var(--shadow-color)',           'shadowColor',       'shadowColor'],
];

const TABLE_COL_WIDTHS = [320, 320, 320, 320];
const TABLE_ROW_HEIGHT = 40;
const tableHeight = 48 + platformRows.length * TABLE_ROW_HEIGHT + 80;

const platform = figma.createFrame();
platform.name        = 'token-overview/platform-mapping';
platform.resize(SECTION_WIDTH, tableHeight);
platform.x           = SECTION_LEFT;
platform.y           = sectionY;
platform.fills       = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
platform.cornerRadius = 16;
platform.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
platform.strokeWeight = 1;
overviewPage.appendChild(platform);

const platTitle = figma.createText();
platTitle.fontName   = { family: 'Inter', style: 'Bold' };
platTitle.fontSize   = 20;
platTitle.characters = 'Platform Code Names (codeSyntax)';
platTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
platTitle.x = 40;
platTitle.y = 24;
platform.appendChild(platTitle);

// Table header row
const tableHeaders = ['Token', 'WEB', 'ANDROID (M3)', 'iOS (HIG)'];
const headerRow = figma.createFrame();
headerRow.name        = 'table-header';
headerRow.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
headerRow.x           = 40;
headerRow.y           = 64;
headerRow.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
headerRow.cornerRadius = 8;
platform.appendChild(headerRow);

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

// Data rows
platformRows.forEach((row, ri) => {
  const rowFill = ri % 2 === 0
    ? [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }]
    : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  const dataRow = figma.createFrame();
  dataRow.name        = `table-row/${ri}`;
  dataRow.resize(SECTION_WIDTH - 80, TABLE_ROW_HEIGHT);
  dataRow.x           = 40;
  dataRow.y           = 64 + TABLE_ROW_HEIGHT + ri * TABLE_ROW_HEIGHT;
  dataRow.fills       = rowFill;
  platform.appendChild(dataRow);

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
platCaption.x = 40;
platCaption.y = 64 + TABLE_ROW_HEIGHT + platformRows.length * TABLE_ROW_HEIGHT + 12;
platform.appendChild(platCaption);

addPlaceholder(platform, 'platform-mapping', 40, tableHeight - 32);

sectionY += tableHeight + SECTION_GAP;

// ────────────────────────────────────────────────────────────────
// Section 3: Dark Mode + Font Scale (2-column row)
// ────────────────────────────────────────────────────────────────
const modeRow = figma.createFrame();
modeRow.name        = 'token-overview/mode-row';
modeRow.resize(SECTION_WIDTH, 360);
modeRow.x           = SECTION_LEFT;
modeRow.y           = sectionY;
modeRow.fills       = [];
overviewPage.appendChild(modeRow);

// Left: Dark Mode panel
const darkPanel = figma.createFrame();
darkPanel.name        = 'dark-mode-panel';
darkPanel.resize(660, 360);
darkPanel.x           = 0;
darkPanel.y           = 0;
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

// Phone silhouettes: light and dark
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

addPlaceholder(darkPanel, 'dark-mode', 24, 300);

// Right: Font Scale panel
const scalePanel = figma.createFrame();
scalePanel.name        = 'font-scale-panel';
scalePanel.resize(660, 360);
scalePanel.x           = 700;
scalePanel.y           = 0;
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

// Scale ramp specimens
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

const modeColW = 74; // 8 modes across 660px-wide panel
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

addPlaceholder(scalePanel, 'font-scale', 24, 300);

sectionY += 360 + SECTION_GAP;

// ────────────────────────────────────────────────────────────────
// Section 4: How to Bind — 3 step cards
// ────────────────────────────────────────────────────────────────
const bindSection = figma.createFrame();
bindSection.name        = 'token-overview/how-to-bind';
bindSection.resize(SECTION_WIDTH, 240);
bindSection.x           = SECTION_LEFT;
bindSection.y           = sectionY;
bindSection.fills       = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
bindSection.cornerRadius = 16;
bindSection.strokes     = [{ type: 'SOLID', color: { r: 0.93, g: 0.93, b: 0.93 } }];
bindSection.strokeWeight = 1;
overviewPage.appendChild(bindSection);

const bindTitle = figma.createText();
bindTitle.fontName   = { family: 'Inter', style: 'Bold' };
bindTitle.fontSize   = 20;
bindTitle.characters = 'Binding Tokens in Figma';
bindTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
bindTitle.x = 40;
bindTitle.y = 24;
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

bindCards.forEach((card, ci) => {
  const cardFrame = figma.createFrame();
  cardFrame.name        = `bind-card/${card.title}`;
  cardFrame.resize(BIND_CARD_W, 140);
  cardFrame.x           = 40 + ci * (BIND_CARD_W + 32);
  cardFrame.y           = 72;
  cardFrame.fills       = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  cardFrame.cornerRadius = 12;
  bindSection.appendChild(cardFrame);

  const iconText = figma.createText();
  iconText.fontName   = { family: 'Inter', style: 'Bold' };
  iconText.fontSize   = 20;
  iconText.characters = card.icon;
  iconText.fills      = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
  iconText.x = 16;
  iconText.y = 16;
  cardFrame.appendChild(iconText);

  const cardTitle = figma.createText();
  cardTitle.fontName   = { family: 'Inter', style: 'Bold' };
  cardTitle.fontSize   = 13;
  cardTitle.characters = card.title;
  cardTitle.fills      = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  cardTitle.x = 16;
  cardTitle.y = 48;
  cardFrame.appendChild(cardTitle);

  const cardBody = figma.createText();
  cardBody.fontName   = { family: 'Inter', style: 'Regular' };
  cardBody.fontSize   = 11;
  cardBody.characters = card.body;
  cardBody.fills      = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
  cardBody.x = 16;
  cardBody.y = 72;
  cardBody.resize(BIND_CARD_W - 32, 60);
  cardFrame.appendChild(cardBody);
});

sectionY += 240 + SECTION_GAP;

// ────────────────────────────────────────────────────────────────
// Section 5: Claude command reference — dark 2×3 grid of 6 cards
// ────────────────────────────────────────────────────────────────
const claudeSection = figma.createFrame();
claudeSection.name        = 'token-overview/claude-commands';
claudeSection.resize(SECTION_WIDTH, 380);
claudeSection.x           = SECTION_LEFT;
claudeSection.y           = sectionY;
claudeSection.fills       = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
claudeSection.cornerRadius = 16;
overviewPage.appendChild(claudeSection);

const claudeTitle = figma.createText();
claudeTitle.fontName   = { family: 'Inter', style: 'Bold' };
claudeTitle.fontSize   = 20;
claudeTitle.characters = 'Maintaining Tokens with Claude';
claudeTitle.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
claudeTitle.x = 40;
claudeTitle.y = 32;
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

commands.forEach((item, ci) => {
  const col = ci % 2;
  const row = Math.floor(ci / 2);
  const cmdCard = figma.createFrame();
  cmdCard.name        = `cmd-card/${item.cmd}`;
  cmdCard.resize(CMD_CARD_W, CMD_CARD_H);
  cmdCard.x           = 40 + col * (CMD_CARD_W + 32);
  cmdCard.y           = 88 + row * (CMD_CARD_H + 16);
  cmdCard.fills       = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
  cmdCard.cornerRadius = 12;
  claudeSection.appendChild(cmdCard);

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

const footerNote = figma.createText();
footerNote.fontName   = { family: 'Inter', style: 'Regular' };
footerNote.fontSize   = 12;
footerNote.characters = 'All commands run from the terminal via Claude Code. The plugin reads SKILL.md files — no install required. See README.md in the plugin repo for setup.';
footerNote.fills      = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
footerNote.x = 40;
footerNote.y = 336;
claudeSection.appendChild(footerNote);
```

---

## Step 5e — Draw Cover and Set File Thumbnail

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `Thumbnail` page, draw a `Cover` frame with a diagonal blue-to-green gradient, and set it as the Figma file thumbnail.

```javascript
// Navigate to the Thumbnail page
const thumbPage = figma.root.children.find(p => p.name === 'Thumbnail');
await figma.setCurrentPageAsync(thumbPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

// ── Cover frame: 1920×1080, diagonal gradient ────────────────────
const coverFrame = figma.createFrame();
coverFrame.name   = 'Cover';
coverFrame.resize(1920, 1080);
coverFrame.x      = 0;
coverFrame.y      = 0;
coverFrame.cornerRadius = 0;

// GRADIENT_LINEAR: top-left (#3B82F6) → bottom-right (#22C55E)
coverFrame.fills = [{
  type: 'GRADIENT_LINEAR',
  gradientTransform: [[0.707, -0.707, 0.147], [0.707, 0.707, -0.147]],
  gradientStops: [
    { position: 0.0, color: { r: 0.231, g: 0.510, b: 0.965, a: 1 } },  // #3B82F6
    { position: 1.0, color: { r: 0.133, g: 0.773, b: 0.369, a: 1 } },  // #22C55E
  ],
}];
thumbPage.appendChild(coverFrame);

// ── DL icon: 2×2 grid of four 18×18 white rectangles, x=60, y=1002 ──
const icon = figma.createFrame();
icon.name   = 'dl-icon';
icon.resize(38, 38);  // 2×18 + 2px gap
icon.x      = 60;
icon.y      = 1002;
icon.fills  = [];
coverFrame.appendChild(icon);

const squareSize = 18, gap = 2;
[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([col, row]) => {
  const sq = figma.createRectangle();
  sq.resize(squareSize, squareSize);
  sq.x      = col * (squareSize + gap);
  sq.y      = row * (squareSize + gap);
  sq.fills  = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  sq.cornerRadius = 2;
  icon.appendChild(sq);
});

// ── Project name title: 120px bold white, x=100, y=420 ───────────
const titleText = figma.createText();
titleText.fontName   = { family: 'Inter', style: 'Bold' };
titleText.fontSize   = 120;
titleText.characters = PROJECT_NAME;   // bound from Step 1 collected value
titleText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
titleText.resize(1400, titleText.height);
titleText.x = 100;
titleText.y = 420;
coverFrame.appendChild(titleText);

// ── Two frosted-glass pill chips at y=600, x=100, gap=16 ─────────
const chipLabels = ['Design Tokens', 'Component Library'];
let chipX = 100;

for (const label of chipLabels) {
  const chip = figma.createFrame();
  chip.name         = `chip/${label}`;
  chip.cornerRadius = 999;
  chip.fills        = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.15 }];
  chip.strokes      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.4 }];
  chip.strokeWeight  = 1;
  chip.paddingLeft   = 24;
  chip.paddingRight  = 24;
  chip.paddingTop    = 12;
  chip.paddingBottom = 12;

  const chipText = figma.createText();
  chipText.fontName   = { family: 'Inter', style: 'Medium' };
  chipText.fontSize   = 16;
  chipText.characters = label;
  chipText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  chip.appendChild(chipText);

  // Size the chip frame to wrap the text
  chip.resize(chipText.width + 48, 48);
  chip.x = chipX;
  chip.y = 600;
  coverFrame.appendChild(chip);

  chipX += chip.width + 16;
}

// ── Set as file thumbnail ─────────────────────────────────────────
await figma.setFileThumbnailNodeAsync(coverFrame);
```

> **Note:** Replace `PROJECT_NAME` in the code above with the actual project name string collected in Step 1 before passing the code to `use_figma`.

---

## Step 6 — Report Result and Move Instruction

Present the result and move instruction:

```
✅ Foundations file created for "<Project Name>".

| File | Target Folder | URL |
|---|---|---|
| <Project Name> — Foundations | Design-Systems/ | https://www.figma.com/design/<fileKey>/ |

**One last step — move the file into your team project folder:**

1. Open Figma and go to your Drafts
2. Right-click **<Project Name> — Foundations** → Move to Project
3. Select your team's **Design-Systems/** project
   (If Design-Systems/ doesn't exist yet, right-click your team → New Project → name it "Design-Systems" first)
```

---

## Step 7 — Offer Design System Initialization

After presenting the result, call AskUserQuestion:

> "Would you like to run /create-design-system now to populate the Foundations file with your brand tokens? (yes / no)"

Wait for the reply. If the designer responds **yes**:

1. **Write the handoff file first** — populate `plugin/templates/agent-handoff.md` with the fields below before invoking the next skill. This ensures `create-design-system` picks up the correct file and does not prompt for a new key.

   ```yaml
   ---
   active_file_key: "<Foundations file key>"
   active_project_name: "<Project Name>"
   last_skill_run: "new-project"
   variable_slot_catalog_path: ""
   token_css_path: ""
   open_items:
     - "Foundations file is ready for /create-design-system — file key: <key>"
     - "File is in Drafts — user needs to move it to Design-Systems/ in their team."
   ---
   ```

2. **Invoke `/create-design-system`** — no arguments needed. The skill reads `active_file_key` from the handoff and will ask "Use this file?" — the designer should confirm with **yes**.

If the designer responds **no**, conclude the skill run. Remind them they can run `/create-design-system` at any time — it will read the file key from the handoff automatically.

---

## Error Handling

| Error | Likely Cause | What to Say |
|---|---|---|
| `create_new_file` fails | MCP connector session expired or no active plan found. | "File creation failed. Please ensure the Figma MCP connector is active (Settings → MCP → Figma → Reconnect) and re-run `/new-project`." |
| `use_figma` page scaffold fails (Step 5) | File not yet accessible after creation. | "Page scaffolding failed. The file was created — open it in Figma and the pages can be added manually. File URL: https://www.figma.com/design/<fileKey>/" |
| `use_figma` doc headers fail (Step 5b) | Font loading error or page navigation issue. | "Header drawing failed on one or more pages. The file and pages were created successfully — headers can be added manually or by re-running Step 5b." |
| `use_figma` TOC fails (Step 5c) | Page not found or text node creation error. | "Table of Contents drawing failed. The page exists — content can be added manually or by re-running Step 5c." |
| `use_figma` token overview fails (Step 5d) | Frame or text creation error. | "Token Overview skeleton drawing failed. The page exists — content can be added manually or by re-running Step 5d." |
| `use_figma` cover/thumbnail fails (Step 5e) | `setFileThumbnailNodeAsync` not supported in current Figma plan, or font load error. | "Cover drawing failed or thumbnail could not be set. The Thumbnail page was created — draw the cover manually and right-click → Set as Thumbnail." |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured and authenticated | Required for `create_new_file` and `use_figma`. Re-authenticate at: Settings → MCP → Figma → Reconnect. |
| Team and Design-Systems/ project folder exist in Figma | The move instruction in Step 6 guides the user to create the folder if needed. |

---

## Page Structure Reference

The following pages are sourced directly from the Detroit Labs Foundations template (`rJQsr4aou5yjzUhaEM0I2f`) and hardcoded in Step 5. To update them, run `use_figma` on the template file with `figma.root.children.map(p => p.name)` and replace the array in Step 5.

**Sections:**
- Thumbnail
- Table of Contents (Token Overview, MCP Tokens)
- Style Guide (Primitives, Theme, Layout, Text Styles, Effects)
- Brand Assets (Logo Marks, Vector Patterns, Icons, Imagery, Motion)
- Atoms (Typography, Text blocks, Label, Kbd, Dividers, Avatar, Badge, Chips, Tags, Counters, Aspect Ratio)
- Buttons & Controls (Buttons, Button Group, Toggle, Toggle Group, Segmented Controller)
- Inputs & Forms (Text Field, Textarea, Number Input, Input Group, Input OTP, Checkbox, Radio, Switch, Select, Native Select, Combobox, Slider, Keypad, Image Select, Calendar, Date Picker, Field, Form Composite Groups)
- Feedback & Status (Alerts, Toast, Sonner, Notifications, Progress Bar, Progress Dial, Loaders, Skeleton, Spinner, Blank states, Error States)
- Overlays (Dialogue, Drawer, Sheets, Sheet Sockets, Popover, Hover Card, Tooltips, Context Menu, Dropdown Menu, Command)
- Navigation (Top Navigation, Bottom Navigation, Tablet Navigation, Sidebar, Navigation Menu, Menubar, Action bars, Tabs bar, Breadcrumb, Pagination, Intra-app Navigation)
- Data Display (Data Table, Lists, Chart, Stat block, Widgets, Video player)
- Content Containers (Cards, Tiles, Select Tile, Carousel, Scroll Area, Accordion, Collapsible, Resizable)
- Native & Platform (Native Device Parts)
- Documentation components, Grids, parking lot

---

## File Naming Convention

All file titles follow this pattern: `<Project Name> — <File Type>`

The separator is an **em dash** (`—`, Unicode U+2014) with a single space on each side — not a hyphen or double-dash.

---

## Handoff

The handoff file is written in Step 7 **before** chaining to `/create-design-system`. See Step 7 for the exact YAML block. Writing it there (rather than at the very end) ensures it is present even if the designer declines the chaining offer and runs `/create-design-system` manually later.
