# Phase 05 — Scaffold page hierarchy

## Goal
Create every page in the Detroit Labs Foundations template via one `use_figma` invocation.

## Prerequisites
- Step 4 returned a `fileKey` for the new Foundations file.

## Placeholders
None in the script.

## Instructions
Load the **figma-use** skill before `use_figma` if your environment requires it. Call `use_figma` once with the `fileKey` from Step 4 and the script below.

## Success criteria
All pages in the `pages` array exist; the default first page is renamed to `Thumbnail`; remaining pages are created in order.

## Step 5 — Scaffold the Page Hierarchy

Immediately call `use_figma` with the `fileKey` from Step 4. This creates the full page hierarchy matching the Detroit Labs Foundations template exactly. (Orchestration for Steps 5c onward lives in the main `SKILL.md`.)

```javascript
const pages = [
  // ── Meta ──────────────────────────────────────────
  "Thumbnail",

  // ── Token & Style Docs ────────────────────────────
  "---",
  "📝 Table of Contents",
  "↳ Token Overview",

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
