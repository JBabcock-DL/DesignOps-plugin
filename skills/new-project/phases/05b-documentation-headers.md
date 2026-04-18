# Phase 05b — Documentation headers

## Runtime order
Runs **after** Phase 05c (TOC layout) in the orchestrator. Headers must exist before Step 5c-links can target `_Header` instances on each page.

## Goal
Create the shared `_Header` component and place instances + `_Content` on every page except `Thumbnail`.

## Prerequisites
- Phase 05 (page list) complete.
- Phase 05c complete (TOC page has `_PageContent` at y=360).

## Placeholders
None.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
Master `_Header` on Documentation components; instances on other pages; `_Content` frame on every non-Thumbnail page.

## Step 5b — Draw Documentation Headers (shared component)

Call `use_figma` with the `fileKey` from Step 4. **Phase A (once):** On the `Documentation components` page, create a single master `_Header` with `figma.createComponent()` (components are scoped to their page — you must be on that page when creating it). **Phase B:** Loop all pages except `Thumbnail`; on each target page, append a `createInstance()` of that component at (0, 0) and override the `_title` / `_description` text nodes. **Phase C:** Append a plain `_Content` frame on every page (not a component instance). Skip placing a duplicate instance on `Documentation components` — the master component already provides the header there.

**Canvas width:** `_Header` is **1800px wide** with `cornerRadius: 0` so the downstream `_PageContent` (also 1800 wide) butts directly against its bottom edge. `/create-design-system` later rebuilds documentation chrome at the same 1800 width (tables 1640 wide inside 80px padding). See `skills/create-design-system/SKILL.md` § **Canvas documentation visual spec**.

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

// ── Phase A: master _Header component on Documentation components ──
const docComponentsPage = figma.root.children.find(p => p.name === 'Documentation components');
await figma.setCurrentPageAsync(docComponentsPage);

const headerComponent = figma.createComponent();
headerComponent.name         = '_Header';
headerComponent.resize(1800, 320);
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
wordmark.x = 1760 - wordmark.width;
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
descMaster.fills      = [
  { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.7 },
];
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
  content.resize(1800, 800);
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
