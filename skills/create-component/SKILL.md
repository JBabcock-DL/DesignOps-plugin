---
name: create-component
description: Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.
argument-hint: "[component...] — e.g. /create-component button input card. If omitted, the agent shows the full component list and prompts."
agent: general-purpose
---

# Skill: /create-component

Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.

---

## Interactive input contract

When this skill needs designer input (component list, Figma file key, shadcn init choices, optional `/code-connect` chaining), use **AskUserQuestion** — **one question per tool call**, wait for each reply before the next. Do not dump multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **shadcn-compatible project** — Next.js, Vite, Remix, or any React framework supported by shadcn/ui. The project must have a `package.json` at its root.
- **`/create-design-system` run first** — Token variable bindings applied during canvas drawing come from the `Web` variable collection created by `/create-design-system`. If that collection does not exist in the target Figma file, components will be drawn without token bindings and a warning will be reported.
- **Active Figma file open** — The agent needs a target Figma file key. This is taken from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Figma MCP connector authenticated** — All canvas writes use `mcp__claude_ai_Figma__*` tools. No separate PAT setup required.

---

## Agent Instructions

### Step 1 — Resolve component list

Accept a list of shadcn/ui component names as the skill argument (e.g. `/create-component button input card dialog`).

- If one or more component names are provided, proceed to Step 2 with that list.
- If no components are provided, show the supported component list (see below), then call **AskUserQuestion**: "Which shadcn/ui components should I install? Enter one or more names separated by spaces."
- Validate each provided name against the supported component list. For any unrecognized name, call **AskUserQuestion**: "'{name}' is not a recognized shadcn/ui component. Skip it, or reply **try anyway** to attempt installation?"

### Step 2 — Check shadcn initialization

Check whether shadcn is already initialized in the project by looking for `components.json` in the project root.

- If `components.json` exists, proceed to Step 3.
- If `components.json` does not exist, call **AskUserQuestion**: "shadcn/ui is not initialized. May I run `npx shadcn@latest init`? (yes / no)" If **no**, stop. If **yes**, prefer **non-interactive** init flags if the CLI supports them in this environment; otherwise collect each init choice with **AskUserQuestion** (one question at a time: style, base color, CSS variables vs default, paths) **before** running the command so the terminal is not stuck waiting for stdin.
  2. Confirm that `components.json` was created before continuing.
  3. If init fails, stop and report the error — do not attempt component installation.

### Step 3 — Install components

For each component in the list:

1. Run `npx shadcn@latest add [component]` (e.g. `npx shadcn@latest add button`).
   - If a shadcn MCP tool is available in the current session, use it as an equivalent alternative.
2. Confirm that the component files were written to the project (typically under `components/ui/`).
3. Track install status per component: `installed`, `already_exists`, or `failed`.

If a component install fails, log the error, mark it `failed`, and continue to the next component — do not abort the entire run.

### Step 4 — Resolve the target Figma file key

1. Check `plugin/templates/agent-handoff.md` for the `active_file_key` field.
2. If set and valid, use it without prompting.
3. If not present, call **AskUserQuestion**: "What is the Figma file key for this project? (Segment after `figma.com/design/` in the URL.)"

### Step 5 — Draw components to Figma canvas

> **Critical rule:** Every component's page navigation, creation, and all variable bindings must happen inside a **single `use_figma` call**. Each call runs in an isolated plugin context — page state set in one call does NOT carry over to the next call.

For each successfully installed component, make **one `use_figma` call** using the complete template below.

**Component → Page routing** (resolve `TARGET_PAGE_NAME` before writing the code):

| Component(s) | Target Page |
|---|---|
| `button` | `↳ Buttons` |
| `toggle` | `↳ Toggle` |
| `toggle-group` | `↳ Toggle Group` |
| `input` | `↳ Text Field` |
| `textarea` | `↳ Textarea` |
| `checkbox` | `↳ Checkbox` |
| `radio-group` | `↳ Radio` |
| `select` | `↳ Select` |
| `switch` | `↳ Switch` |
| `slider` | `↳ Slider` |
| `form` | `↳ Form Composite Groups` |
| `label` | `↳ Label` |
| `input-otp` | `↳ Input OTP` |
| `calendar` | `↳ Calendar` |
| `date-picker` | `↳ Date Picker` |
| `card` | `↳ Cards` |
| `separator` | `↳ Dividers` |
| `aspect-ratio` | `↳ Aspect Ratio` |
| `scroll-area` | `↳ Scroll Area` |
| `resizable` | `↳ Resizable` |
| `dialog`, `alert-dialog` | `↳ Dialogue` |
| `drawer` | `↳ Drawer` |
| `sheet` | `↳ Sheets` |
| `popover` | `↳ Popover` |
| `tooltip` | `↳ Tooltips` |
| `hover-card` | `↳ Hover Card` |
| `context-menu` | `↳ Context Menu` |
| `dropdown-menu` | `↳ Dropdown Menu` |
| `command` | `↳ Command` |
| `navigation-menu` | `↳ Navigation Menu` |
| `menubar` | `↳ Menubar` |
| `tabs` | `↳ Tabs bar` |
| `breadcrumb` | `↳ Breadcrumb` |
| `pagination` | `↳ Pagination` |
| `alert` | `↳ Alerts` |
| `badge` | `↳ Badge` |
| `progress` | `↳ Progress Bar` |
| `skeleton` | `↳ Skeleton` |
| `sonner` | `↳ Sonner` |
| `toast` | `↳ Toast` |
| `table` | `↳ Data Table` |
| `accordion` | `↳ Accordion` |
| `collapsible` | `↳ Collapsible` |
| `avatar` | `↳ Avatar` |

**Complete `use_figma` code template** (substitute component-specific values where indicated):

```js
// ── 1. Navigate to target page (must be in same call as creation) ──
const targetPage = figma.root.children.find(p => p.name === "TARGET_PAGE_NAME")
  ?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);

// ── 2. Load fonts (required before setting text.characters) ─────────
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });

// ── 3. Resolve Web variable collection ──────────────────────────────
const collections = figma.variables.getLocalVariableCollections();
const webCol = collections.find(c => c.name === 'Web');
const webVars = webCol
  ? figma.variables.getLocalVariables().filter(v => v.variableCollectionId === webCol.id)
  : [];
const getVar = name => webVars.find(v => v.name === name) ?? null;

// ── 4. Binding helpers ───────────────────────────────────────────────

// Color binding: fills/strokes use boundVariables on the paint object.
// Do NOT use setBoundVariable for color — that API is for numeric fields only.
function bindColor(node, varName, fallbackHex, target = 'fills') {
  const variable = getVar(varName);
  const hex = fallbackHex.replace('#','');
  const paint = {
    type: 'SOLID',
    color: {
      r: parseInt(hex.slice(0,2),16)/255,
      g: parseInt(hex.slice(2,4),16)/255,
      b: parseInt(hex.slice(4,6),16)/255
    }
  };
  if (variable) {
    paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
  }
  node[target] = [paint];
}

// Spacing/radius binding: always set the fallback number first so the node
// has a valid value even if the variable lookup or setBoundVariable fails.
function bindNum(node, field, varName, fallback) {
  node[field] = fallback;
  const variable = getVar(varName);
  if (variable) {
    try { node.setBoundVariable(field, variable); } catch(_) {}
  }
}

// Build a fully complete single ComponentNode — layout, spacing, radius,
// color, and label text all applied and bound before this function returns.
// Call this once per variant. Combine the results with combineAsVariants afterward.
//
// label:      text to show inside the component (pass null to skip)
// labelVar:   Web variable for the label text color
// strokeVar:  Web variable for stroke color (pass null for no stroke)
// radiusVar:  Web variable for corner radius
function buildVariant(name, fillVar, fallbackFill, {
  label = null,
  labelVar = 'var(--foreground)',
  strokeVar = null,
  radiusVar = 'var(--radius-md)'
} = {}) {
  const c = figma.createComponent();
  c.name = name;

  // Auto-layout
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  // Spacing — bound on the individual component before any combining
  bindNum(c, 'paddingLeft',   'var(--padding-md)', 16);
  bindNum(c, 'paddingRight',  'var(--padding-md)', 16);
  bindNum(c, 'paddingTop',    'var(--p-xs)',         8);
  bindNum(c, 'paddingBottom', 'var(--p-xs)',         8);
  bindNum(c, 'itemSpacing',   'var(--gap-sm)',        8);

  // Border radius — all four corners individually
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));

  // Fill
  bindColor(c, fillVar, fallbackFill, 'fills');

  // Optional stroke
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  // Optional text label (requires loadFontAsync to have run already)
  if (label) {
    const txt = figma.createText();
    txt.fontName = { family: "Inter", style: "Medium" };
    txt.characters = label;
    txt.fontSize = 14;
    bindColor(txt, labelVar, '#000000', 'fills');
    c.appendChild(txt);
  }

  // Append to current page before combining
  figma.currentPage.appendChild(c);
  return c;
}

// ── 5a. MULTI-VARIANT pattern (Button example) ──────────────────────
// Build each variant fully, then combine into a component set.
// Substitute the correct variant names, fills, labels, and options per component.

const nodes = [
  buildVariant('variant=default',     'var(--primary)',     '#000000', { label: 'Button',  labelVar: 'var(--primary-foreground)' }),
  buildVariant('variant=destructive', 'var(--primary)',     '#ef4444', { label: 'Button',  labelVar: 'var(--primary-foreground)' }),
  buildVariant('variant=outline',     'var(--background)', '#ffffff',  { label: 'Button',  labelVar: 'var(--foreground)', strokeVar: 'var(--border-secondary)' }),
  buildVariant('variant=secondary',   'var(--secondary)',  '#6b7280',  { label: 'Button',  labelVar: 'var(--foreground)' }),
  buildVariant('variant=ghost',       'var(--background)', '#ffffff',  { label: 'Button',  labelVar: 'var(--foreground)' }),
  buildVariant('variant=link',        'var(--background)', '#ffffff',  { label: 'Button',  labelVar: 'var(--primary)' }),
];

// Combine fully-built components into a variant set
const compSet = figma.combineAsVariants(nodes, figma.currentPage);
compSet.name = "Button"; // PascalCase component name

// ── 5b. SINGLE-STATE pattern ─────────────────────────────────────────
// For components with no variants (separator, label, card, etc.):
// build the one component fully — no combining needed.

const comp = buildVariant("COMPONENT_NAME", 'var(--background)', '#ffffff', { label: 'Label text' });
// comp is already appended to the page by buildVariant
```

**Variant definitions** — use these as the `buildVariant` calls for each component:

| Component | Variant properties and values |
|---|---|
| `button` | `variant` = default, destructive, outline, secondary, ghost, link; `size` = default, sm, lg, icon |
| `badge` | `variant` = default, secondary, destructive, outline |
| `input` | `state` = default, focus, disabled, error |
| `textarea` | `state` = default, focus, disabled, error |
| `checkbox` | `checked` = false, true, indeterminate; `disabled` = false, true |
| `radio-group` | `selected` = false, true; `disabled` = false, true |
| `switch` | `checked` = false, true; `disabled` = false, true |
| `select` | `state` = default, open, disabled |
| `alert` | `variant` = default, destructive |
| `avatar` | `size` = sm, md, lg |
| `progress` | `value` = 0, 25, 50, 75, 100 |
| `skeleton` | `shape` = line, circle, rect |
| `tabs` | `state` = active, inactive |
| `dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`, `tooltip`, `hover-card`, `command`, `context-menu`, `dropdown-menu`, `menubar`, `navigation-menu` | `state` = open, closed |
| `accordion`, `collapsible` | `state` = open, closed |
| `toggle`, `toggle-group` | `pressed` = false, true |
| `breadcrumb`, `pagination`, `table`, `card`, `form`, `label`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `slider`, `input-otp`, `calendar`, `date-picker`, `sonner`, `toast` | single state — use pattern 4b |

If the `Web` collection is not present (`webCol` is null), `getVar` returns null and all bindings fall back to hardcoded hex/px values automatically — no separate branch needed.

If the `use_figma` call throws, mark the component `draw_failed` and continue to the next.

### Step 6 — Offer Code Connect chaining

After all components have been processed, call **AskUserQuestion**: "Run `/code-connect` to map the Figma components you drew to the installed shadcn/ui source files? (yes / no)"

- If **yes**, invoke `/code-connect`.
- If **no**, skip and proceed to reporting.

### Step 7 — Report results

Output a summary table:

| Component | Installed | Drawn to Canvas | Notes |
|---|---|---|---|
| `button` | Yes | Yes | 6 variants created |
| `input` | Already existed | Yes | Default state only |
| `card` | Yes | Yes | Token bindings applied |
| `dialog` | Yes | Failed | Figma write error: ... |

Follow with:
- Total installed: N
- Total drawn to canvas: N
- Skipped / failed: N (list names and reasons)
- Token binding status: "Web collection found — bindings applied" or "Web collection not found — raw hex values used"

---

## Supported Components

The following shadcn/ui components are supported. Pass any of these names to the skill.

**Form & Input**
`button` `input` `textarea` `checkbox` `radio-group` `select` `switch` `slider` `toggle` `toggle-group` `form` `label` `input-otp`

**Layout & Display**
`card` `separator` `aspect-ratio` `scroll-area` `resizable`

**Overlay & Dialog**
`dialog` `drawer` `sheet` `popover` `tooltip` `hover-card` `alert-dialog` `context-menu` `dropdown-menu` `menubar`

**Navigation**
`navigation-menu` `tabs` `breadcrumb` `pagination` `command`

**Feedback & Status**
`alert` `badge` `progress` `skeleton` `sonner` `toast`

**Data Display**
`table` `accordion` `collapsible` `calendar` `date-picker` `avatar`

---

## CLI Reference

| Command | Purpose |
|---|---|
| `npx shadcn@latest init` | Initialize shadcn in the current project (creates `components.json`) |
| `npx shadcn@latest add [component]` | Install a single component into the project |
| `npx shadcn@latest add [c1] [c2] ...` | Install multiple components in one invocation |
| `npx shadcn@latest diff` | Show which installed components are out of date |

---

## Notes

- **No manual Figma community kit import required.** Components are installed from the shadcn CLI into the local codebase, and the agent draws them directly to the Figma canvas as proper Figma components using `figma.createComponent()` and `figma.combineAsVariants()`. These are real Figma components with component keys — required for Code Connect to resolve mappings.
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent routes each component to its designated page in the Detroit Labs Foundations scaffold (see Step 5 routing table) using `figma.setCurrentPageAsync`. If the file was not scaffolded by `/new-project`, it falls back to the current active page with a warning.
- **Token bindings** are a best-effort match based on variable names in the `Web` collection. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.
