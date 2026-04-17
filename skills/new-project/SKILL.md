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

After Step 5 completes successfully, run **Steps 5c → 5b → 5d → 5e → 5c-links in order** — each step is its **own** `use_figma` invocation (plugin context resets between calls). Pass the same `fileKey`. Inject the **Project Name** string anywhere a step shows `PROJECT_NAME`, and inject the **file key** string anywhere a step shows `FILE_KEY` (same literal pattern as `PROJECT_NAME` in Step 5e).

**Why this order:** Step 5c draws the Table of Contents layout (no links). Step 5b creates the shared `_Header` component and places instances on every page (link targets for all doc pages). Steps 5d and 5e build Token Overview and the Thumbnail `Cover`. Step **5c-links runs last** so the `Thumbnail` row can link to the `Cover` frame (it does not exist until Step 5e) and every other row links to that page’s `_Header`.

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

## Step 5b — Draw Documentation Headers (shared component)

Call `use_figma` with the `fileKey` from Step 4. **Phase A (once):** On the `Documentation components` page, create a single master `_Header` with `figma.createComponent()` (components are scoped to their page — you must be on that page when creating it). **Phase B:** Loop all pages except `Thumbnail`; on each target page, append a `createInstance()` of that component at (0, 0) and override the `_title` / `_description` text nodes. **Phase C:** Append a plain `_Content` frame on every page (not a component instance). Skip placing a duplicate instance on `Documentation components` — the master component already provides the header there.

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

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

// ── Phase A: master _Header component on Documentation components ──
const docComponentsPage = figma.root.children.find(p => p.name === 'Documentation components');
await figma.setCurrentPageAsync(docComponentsPage);

const headerComponent = figma.createComponent();
headerComponent.name         = '_Header';
headerComponent.resize(1440, 320);
headerComponent.x            = 0;
headerComponent.y            = 0;
headerComponent.fills        = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
headerComponent.cornerRadius = 24;
docComponentsPage.appendChild(headerComponent);

const logoCircle = figma.createEllipse();
logoCircle.resize(40, 40);
logoCircle.x     = 40;
logoCircle.y     = 40;
logoCircle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
headerComponent.appendChild(logoCircle);

const logoText = figma.createText();
logoText.fontName    = { family: 'Inter', style: 'Bold' };
logoText.fontSize    = 14;
logoText.characters  = 'DL';
logoText.fills       = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
logoText.textAlignHorizontal = 'CENTER';
logoText.textAlignVertical   = 'CENTER';
logoText.resize(40, 40);
logoText.x = 40;
logoText.y = 40;
headerComponent.appendChild(logoText);

const wordmark = figma.createText();
wordmark.fontName        = { family: 'Inter', style: 'Semi Bold' };
wordmark.fontSize        = 12;
wordmark.letterSpacing   = { value: 2, unit: 'PIXELS' };
wordmark.characters      = 'DETROIT LABS';
wordmark.fills           = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
wordmark.textAlignHorizontal = 'RIGHT';
wordmark.x = 1400 - wordmark.width;
wordmark.y = 48;
headerComponent.appendChild(wordmark);

const titleMaster = figma.createText();
titleMaster.name       = '_title';
titleMaster.fontName   = { family: 'Inter', style: 'Bold' };
titleMaster.fontSize   = 64;
titleMaster.characters = 'Page Title';
titleMaster.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
titleMaster.x = 40;
titleMaster.y = 140;
headerComponent.appendChild(titleMaster);

const descMaster = figma.createText();
descMaster.name       = '_description';
descMaster.fontName   = { family: 'Inter', style: 'Regular' };
descMaster.fontSize   = 16;
descMaster.characters = 'Page description.';
descMaster.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.7 }];
descMaster.x = 40;
descMaster.y = 240;
headerComponent.appendChild(descMaster);

// ── Phase B + C: instances + _Content on every page except Thumbnail ──
for (const page of figma.root.children) {
  if (page.name === 'Thumbnail') continue;

  await figma.setCurrentPageAsync(page);

  const title = cleanTitle(page.name);
  const desc  = descriptions[page.name] || '';

  if (page.name !== 'Documentation components') {
    const instance = headerComponent.createInstance();
    instance.x = 0;
    instance.y = 0;
    page.appendChild(instance);

    const titleNode = instance.findOne(n => n.name === '_title' && n.type === 'TEXT');
    if (titleNode) titleNode.characters = title;

    const descNode = instance.findOne(n => n.name === '_description' && n.type === 'TEXT');
    if (descNode) descNode.characters = desc || '';
  } else {
    titleMaster.characters = title;
    descMaster.characters = desc || '';
  }

  const content = figma.createFrame();
  content.name         = '_Content';
  content.resize(1440, 800);
  content.x            = 0;
  content.y            = 360;
  content.fills        = [{ type: 'SOLID', color: { r: 0.969, g: 0.969, b: 0.969 } }];
  content.cornerRadius = 16;
  content.strokes      = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  content.strokeWeight = 1;
  content.dashPattern  = [8, 4];
  page.appendChild(content);
}
```

---

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

const COL_GAP    = 32;
const CARD_WIDTH = 664; // two cards + gap fit inside 1440 − 80px horizontal padding
const PADDING    = 24;
const ROW_HEIGHT = 40;

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
summaryBar.resize(1360, 72);
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
summaryText.resize(1360, 72);
summaryText.layoutAlign = 'STRETCH';
summaryBar.appendChild(summaryText);
```

---

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
  ['color/background/default',   'var(--color-background)',       'surface',           'systemBackground'],
  ['color/primary/default',      'var(--color-primary)',          'primary',           'tintColor'],
  ['color/border/default',       'var(--color-border)',           'outline',           'separator'],
  ['color/status/error',         'var(--color-danger)',           'error',             'systemRed'],
  ['Headline/LG/font-size',      'var(--headline-lg-font-size)',  'headlineLgFontSize','headlineLgFontSize'],
  ['space/md',                   'var(--space-md)',               'spaceMd',           'spaceMd'],
  ['radius/md',                  'var(--radius-md)',              'radiusMd',          'radiusMd'],
  ['shadow/color',               'var(--shadow-color)',           'shadowColor',       'shadowColor'],
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

const tableHeaders = ['Token', 'WEB', 'ANDROID (M3)', 'iOS (HIG)'];
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

## Step 5c-links — Wire TOC URL hyperlinks

Call `use_figma` with the `fileKey` from Step 4 **after** Steps 5b and 5e so every destination page has a `_Header` (or the component master on `Documentation components`) and the `Thumbnail` page has a `Cover` frame. This step **only** sets **URL hyperlinks** on the page-name text inside each `toc-link/{pageName}` row — designers use **Cmd+click (Mac)** or **Ctrl+click (Windows)** on the linked text in the canvas to jump to the target frame in this file. **Do not** add prototype `reactions`; presentation mode is not the primary workflow here.

Replace `FILE_KEY` in the snippet below with the same literal `fileKey` string from Step 4 before invoking `use_figma`.

**Caveats:** Hyperlinks are on the **page-name text** only (not the arrow or the whole row). If a page is renamed after scaffolding, links no longer match — re-run `/new-project` to rebuild.

```javascript
const tocPage = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(tocPage);

const linkRows = tocPage.findAll(n => n.name.startsWith('toc-link/'));

for (const linkRow of linkRows) {
  const pageName = linkRow.name.replace('toc-link/', '');
  const targetPage = figma.root.children.find(p => p.name === pageName);
  if (!targetPage) continue;

  const targetNode =
    pageName === 'Thumbnail'
      ? targetPage.findOne(n => n.name === 'Cover') || targetPage.children[0]
      : targetPage.children.find(n => n.name === '_Header') || targetPage.children[0];
  if (!targetNode) continue;

  const textNode = linkRow.findOne(
    n => n.type === 'TEXT' && n.characters !== '→'
  );
  if (!textNode) continue;

  const nodeId = targetNode.id.replace(':', '-');
  textNode.hyperlink = {
    type: 'URL',
    value: `https://www.figma.com/design/FILE_KEY?node-id=${nodeId}`,
  };
}
```

> **Note:** Replace `FILE_KEY` in the URL with the actual file key from Step 4 before passing the code to `use_figma`.

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
| `use_figma` TOC links fail (Step 5c-links) | Missing `FILE_KEY` in the URL, hyperlink rejected on a text node, or no `_Header` / `Cover` target on a page. | "TOC hyperlinks failed — confirm `FILE_KEY` was substituted, then re-run Step 5c-links after Steps 5b and 5e." |
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
