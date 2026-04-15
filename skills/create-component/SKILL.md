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

For each successfully installed component:

1. Call `mcp__claude_ai_Figma__get_design_context` with the file key to confirm the file is accessible and to read the page list.
2. **Resolve the target page** using the routing table below. Before drawing, call `use_figma` to navigate to the correct page:
   ```js
   const page = figma.root.children.find(p => p.name === "<target page name>");
   if (page) await figma.setCurrentPageAsync(page);
   ```
   If the target page does not exist (e.g. the file was not scaffolded by `/new-project`), fall back to the current active page and log a warning: "Page '↳ X' not found — drawing on current page."

   **Component → Page routing:**

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

3. Use `mcp__claude_ai_Figma__use_figma` to create a **Figma component** (not a plain frame) on the target page. Always use `figma.createComponent()` — never `figma.createFrame()`.

   **Single-state components** (no variants): create one component, set its name to PascalCase (e.g. `Separator`, `Label`).

   ```js
   const comp = figma.createComponent();
   comp.name = "Separator";
   // apply auto-layout, fills, etc.
   figma.currentPage.appendChild(comp);
   ```

   **Multi-variant components** (button, input, badge, etc.): create one `figma.createComponent()` per variant, name each using Figma's `property=value` convention, then combine into a component set with `figma.combineAsVariants()`. The component set name is the PascalCase component name.

   ```js
   const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"];
   const nodes = variants.map(v => {
     const c = figma.createComponent();
     c.name = `variant=${v}`;
     // apply fills, auto-layout, text per variant
     return c;
   });
   const compSet = figma.combineAsVariants(nodes, figma.currentPage);
   compSet.name = "Button";
   ```

   The component set **must** be appended to `figma.currentPage` (already set in step 2) — do not append to a different page node.

   **Variant definitions by component** (add only the properties the shadcn component actually exposes):

   | Component | Variant properties |
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
   | `breadcrumb`, `pagination`, `table`, `card`, `form`, `label`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `slider`, `input-otp`, `calendar`, `date-picker`, `sonner`, `toast` | single state (no variant property needed) |

   - **Token variable bindings:** Look up variables by name from the `Web` collection via `figma.variables.getLocalVariables()`. Bind **all** applicable design properties — not just color. Use `node.setBoundVariable(field, variable)` for each field listed below.

     **Color fields:**
     | `setBoundVariable` field | Web variable to bind |
     |---|---|
     | `fills` | `var(--primary)` (primary action), `var(--background)` (surface), `var(--muted)` (subtle fill) |
     | `strokes` | `var(--border-primary)` or `var(--border-secondary)` |
     | text node `fills` | `var(--foreground)`, `var(--primary-foreground)`, or `var(--muted-foreground)` |

     **Spacing fields** (padding and gap):
     | `setBoundVariable` field | Web variable to bind |
     |---|---|
     | `paddingLeft`, `paddingRight` | `var(--padding-md)` for standard components; `var(--p-xs)` for compact |
     | `paddingTop`, `paddingBottom` | `var(--p-xs)` for interactive components |
     | `itemSpacing` | `var(--gap-sm)` for tight layouts; `var(--gap-md)` for standard |

     **Border radius fields:**
     | `setBoundVariable` field | Web variable to bind |
     |---|---|
     | `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` | `var(--radius-md)` for standard components; `var(--radius-sm)` for compact; `var(--radius-lg)` for cards/sheets |

     Bind all four corner radius fields individually — Figma does not accept a single `borderRadius` variable binding.

     If the `Web` collection is not present, apply raw Tailwind hex/px values and log a warning.

   - **Layout:** Set `layoutMode = "HORIZONTAL"`, `primaryAxisSizingMode = "AUTO"`, `counterAxisSizingMode = "AUTO"` on every component. Do **not** set `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, or `itemSpacing` as hard-coded numbers — set them only via `setBoundVariable` so the variable binding is the source of truth. Adjust radius target variable for layout-only components (card → `var(--radius-lg)`; separator → no radius binding).

4. If the draw operation fails for a component, mark it `draw_failed` and continue.

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
