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

1. Call `mcp__claude_ai_Figma__get_design_context` with the file key to confirm the file is accessible and to read any existing component structure.
2. Use `mcp__claude_ai_Figma__use_figma` to create a component frame on the canvas with:
   - **Frame name:** Match the shadcn component name exactly (e.g. `Button`, `Input`, `Card`, `Dialog`). Use PascalCase.
   - **Variant structure:** Include at minimum a default state. Where the shadcn component has documented variants (e.g. Button has `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), create a variant property group with one frame per variant.
   - **Token variable bindings:** Bind fill, stroke, and text color properties to the corresponding variables from the active `Web` variable collection (e.g. `color/primary` for primary action fills, `color/surface` for card backgrounds, `color/foreground` for text). If the `Web` collection is not present, apply the raw Tailwind hex values from the shadcn defaults and log a warning.
   - **Layout:** Use auto-layout with sensible defaults (horizontal padding 16px, vertical padding 8px for interactive components; adjust for layout components like Card).
3. If the draw operation fails for a component, mark it `draw_failed` and continue.

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

- **No manual Figma community kit import required.** Components are installed from the shadcn CLI into the local codebase, and the agent draws the resulting structure directly to the Figma canvas using Figma MCP write tools.
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent targets the current page of the active Figma file unless the handoff context specifies a different page.
- **Token bindings** are a best-effort match based on variable names in the `Web` collection. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.
