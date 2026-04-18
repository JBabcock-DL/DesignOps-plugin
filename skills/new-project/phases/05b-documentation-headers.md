# Phase 05b — Documentation headers

## Runtime order
Runs **after** Phase 05c (TOC layout) in the orchestrator. Headers must exist before Step 5c-links can target `_Header` instances on each page.

## Goal
Create the shared `_Header` component (1800 × 320, `cornerRadius: 0`, VERTICAL auto-layout, black fill) and place instances on every page except `Thumbnail`. The seam between `_Header` bottom (y=320) and the page's `_PageContent` top (y=320) must be exactly zero — the square bottom on `_Header` is what lets `_PageContent` butt directly against it without a visible gap.

## Prerequisites
- Phase 05 (page list) complete.
- Phase 05c complete (TOC page has `_PageContent` at `y = 320` with literal `#FFFFFF` fill).

## Inputs
- **`fileKey`** — the Figma file key.
  - **Fresh run** inside `/new-project`: use the `fileKey` captured in Step 4.
  - **Re-run** outside the orchestrator (fix cycle, plugin-update test, replay): `Read` `templates/agent-handoff.md` for `active_file_key`. If the handoff doc is empty or missing, ask the user to paste the `fileKey` or the full Figma URL (extract the key from `figma.com/design/:fileKey/…`) before continuing.

## Placeholders
None.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

Before editing this script, **`Read`** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** § A and [`skills/create-design-system/CONVENTIONS.md`](../../create-design-system/CONVENTIONS.md) § 3 — both specify the current `_Header` geometry (1800 × 320, `cornerRadius: 0`, VERTICAL auto-layout, fill `color/neutral/950` bound with `#000000` fallback) and the zero-gap seam with `_PageContent` at `y = 320`.

## Re-running on a non-empty file (idempotency)
This script assumes the master `_Header` does not yet exist and that no page has an `_Header` instance. Before re-running on a file that already has headers (e.g. fixing the spec after an older run, or re-invoking after a plugin/skill update), first run a small wipe script with `use_figma` that removes every `_Header` component + instance and every obsolete `_Content` placeholder from older versions:

```javascript
const removedNodeIds = [];
for (const page of figma.root.children) {
  for (const child of [...page.children]) {
    if (child.name === '_Header' || child.name === '_Content') {
      removedNodeIds.push(child.id);
      child.remove();
    }
  }
}
return { removedNodeIds };
```

Leave every `_PageContent` in place — Phases 05c and 05d own those.

## Success criteria
- Master `_Header` component on `Documentation components` at `y: 0`, **1800 × 320**, **`cornerRadius: 0`**, `layoutMode: VERTICAL`, fill black (`color/neutral/950` bound when the variable exists, raw `#000000` fallback otherwise), `clipsContent: true`.
- An `_Header` **instance** at `x: 0, y: 0` on every page except `Thumbnail` (and not a second instance on `Documentation components` — the master already provides the header there).
- Each instance's `_title` text node carries the page's clean title and its `_description` text node carries the matching blurb from the `descriptions` map.
- **No `_Content` placeholder frames are created.** The TOC (Phase 05c), Token Overview (Phase 05d), Thumbnail `Cover` (Phase 05e), and style-guide pages (populated later by `/create-design-system`) each own their own `_PageContent` at `y = 320`. The old dashed cream `_Content` overlay at `y = 360` is obsolete — it visually overlapped the new `_PageContent` frames.

## Known Figma API gotchas this script must follow
- **`resize()` before sizing modes.** The header component, `topRow`, `logoMark`, and `titleStack` all use auto-layout. Call `resize(w, h)` **before** assigning `primaryAxisSizingMode` / `counterAxisSizingMode` — otherwise the axis silently resets to `'FIXED'` and children collapse.
- **Master component must be on its own page.** `figma.createComponent()` is scoped to the current page — you must call `figma.setCurrentPageAsync('Documentation components')` **before** `createComponent()`, or the master will land on the wrong page.
- **Square corners, not rounded.** `cornerRadius: 0` on the master component. The TOC and Token Overview phases anchor `_PageContent` at `y = 320` on the assumption of a zero-gap square seam — a 24px (or any non-zero) corner radius creates a visible gap under the header.
- **No absolute-positioned logo, no floating wordmark.** The header body is VERTICAL auto-layout with a `topRow` (HORIZONTAL, `SPACE_BETWEEN`) and a `titleStack` (VERTICAL). The only non-auto-layout sub-node is the 40×40 `logoMark` frame that stacks the white ellipse and the black "DL" text — those two nodes intentionally use absolute position inside a tiny fixed-size parent.

## Step 5b — Draw Documentation Headers (shared component)

Call `use_figma` with the `fileKey` from Step 4. **Phase A (once):** On the `Documentation components` page, create a single master `_Header` with `figma.createComponent()`. **Phase B:** Loop every page except `Thumbnail` and `Documentation components`; on each target page, append a `createInstance()` of that component at `(0, 0)` and override the `_title` / `_description` text nodes. **Phase C:** Override the master's own `_title` / `_description` for the `Documentation components` page. Do **not** create a duplicate instance on `Documentation components` — the master is the header for that page.

```javascript
const descriptions = {
  "---":                        "Visual divider between page groups in the left sidebar (no component canvas).",
  "Thumbnail":                  "File cover frame (`Cover`) on the Thumbnail page.",
  "📝 Table of Contents":       "Index of all pages in this design system with links to each section.",
  "↳ Token Overview":           "How the token architecture works and how to use it with Claude.",
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

// ── Variable helpers — binds to color/neutral/950 (Primitives) when available,
//    falls back to raw #000000 on a fresh file where /create-design-system has not run yet.
const variableCollections = figma.variables.getLocalVariableCollections();
const allColorVars = figma.variables.getLocalVariables('COLOR');
const primCol  = variableCollections.find(c => c.name === 'Primitives');

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
function bindPrimColor(node, path, fallbackHex, target = 'fills') {
  const variable = getPrimColorVar(path);
  const paint = { type: 'SOLID', color: hexToRgb(fallbackHex) };
  if (variable) {
    try { paint.boundVariables = { color: figma.variables.createVariableAlias(variable) }; } catch (_) {}
  }
  node[target] = [paint];
}

// ── Phase A: master _Header component on Documentation components ──
// Geometry (SKILL.md § A + CONVENTIONS.md § 3):
//   1800 wide, 320 tall, cornerRadius 0, layoutMode VERTICAL,
//   padding top 40 / bottom 61 / left 40 / right 40, itemSpacing 60, clipsContent true.
//   Structure:
//     ├── topRow (HORIZONTAL, 40 tall, STRETCH, SPACE_BETWEEN, CENTER)
//     │   ├── logoMark (40×40, non-auto-layout: white ellipse + black "DL" centered)
//     │   └── wordmark (TEXT "DETROIT LABS", Inter Semi Bold 12, white, tracking 2px)
//     └── titleStack (VERTICAL, AUTO h, STRETCH w, itemSpacing 23)
//         ├── _title (TEXT Inter Bold 64, white, STRETCH)
//         └── _description (TEXT Inter Regular 16, white @ 70%, STRETCH)
const docComponentsPage = figma.root.children.find(p => p.name === 'Documentation components');
await figma.setCurrentPageAsync(docComponentsPage);

const headerComponent = figma.createComponent();
headerComponent.name = '_Header';
// resize() BEFORE sizing-mode assignments — figma-use gotcha.
headerComponent.resize(1800, 320);
headerComponent.layoutMode         = 'VERTICAL';
headerComponent.primaryAxisSizingMode = 'FIXED';
headerComponent.counterAxisSizingMode = 'FIXED';
headerComponent.paddingTop    = 40;
headerComponent.paddingBottom = 61;
headerComponent.paddingLeft   = 40;
headerComponent.paddingRight  = 40;
headerComponent.itemSpacing   = 60;
headerComponent.cornerRadius  = 0;
headerComponent.clipsContent  = true;
headerComponent.x = 0;
headerComponent.y = 0;
bindPrimColor(headerComponent, 'color/neutral/950', '#000000');
docComponentsPage.appendChild(headerComponent);

// topRow — brand + wordmark
const topRow = figma.createFrame();
topRow.name = 'topRow';
topRow.layoutMode = 'HORIZONTAL';
// resize() BEFORE sizing-mode assignments.
topRow.resize(1720, 40);
topRow.primaryAxisSizingMode = 'FIXED';
topRow.counterAxisSizingMode = 'FIXED';
topRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
topRow.counterAxisAlignItems = 'CENTER';
topRow.layoutAlign = 'STRETCH';
topRow.itemSpacing = 16;
topRow.clipsContent = true;
topRow.fills = [];
headerComponent.appendChild(topRow);

// logoMark — 40×40 non-auto-layout so the white ellipse and "DL" text can overlap.
const logoMark = figma.createFrame();
logoMark.name = 'logo';
logoMark.resize(40, 40);
logoMark.fills = [];
logoMark.clipsContent = false;
topRow.appendChild(logoMark);

const logoCircle = figma.createEllipse();
logoCircle.name = 'Ellipse';
logoCircle.resize(40, 40);
logoCircle.x = 0;
logoCircle.y = 0;
logoCircle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
logoMark.appendChild(logoCircle);

const logoText = figma.createText();
logoText.fontName    = { family: 'Inter', style: 'Bold' };
logoText.fontSize    = 14;
logoText.characters  = 'DL';
logoText.fills       = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
logoText.textAlignHorizontal = 'CENTER';
logoText.textAlignVertical   = 'CENTER';
logoText.resize(40, 40);
logoText.x = 0;
logoText.y = 0;
logoMark.appendChild(logoText);

const wordmark = figma.createText();
wordmark.fontName        = { family: 'Inter', style: 'Semi Bold' };
wordmark.fontSize        = 12;
wordmark.letterSpacing   = { value: 2, unit: 'PIXELS' };
wordmark.characters      = 'DETROIT LABS';
wordmark.fills           = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
wordmark.textAlignHorizontal = 'RIGHT';
topRow.appendChild(wordmark);

// titleStack — page title + description
const titleStack = figma.createFrame();
titleStack.name = 'titleStack';
titleStack.layoutMode = 'VERTICAL';
// resize() BEFORE sizing-mode assignments.
titleStack.resize(1720, 1);
titleStack.primaryAxisSizingMode = 'AUTO';
titleStack.counterAxisSizingMode = 'FIXED';
titleStack.layoutAlign = 'STRETCH';
titleStack.itemSpacing = 23;
titleStack.clipsContent = true;
titleStack.fills = [];
headerComponent.appendChild(titleStack);

const titleMaster = figma.createText();
titleMaster.name       = '_title';
titleMaster.fontName   = { family: 'Inter', style: 'Bold' };
titleMaster.fontSize   = 64;
titleMaster.characters = 'Page Title';
titleMaster.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
titleMaster.layoutAlign = 'STRETCH';
titleStack.appendChild(titleMaster);

const descMaster = figma.createText();
descMaster.name       = '_description';
descMaster.fontName   = { family: 'Inter', style: 'Regular' };
descMaster.fontSize   = 16;
descMaster.characters = 'Page description.';
descMaster.fills      = [
  { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.7 },
];
descMaster.layoutAlign = 'STRETCH';
titleStack.appendChild(descMaster);

// ── Phase B + C: instances on every page except Thumbnail; master override on Documentation components ──
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
    // Master lives on this page — override its own _title / _description directly.
    titleMaster.characters = title;
    descMaster.characters = desc || '';
  }
}
```
