# Detroit Labs DesignOps Plugin

A Claude Code plugin that gives Detroit Labs designers seven skill-based commands for automating Figma design operations — scaffolding projects, building design systems, syncing tokens, adding components, linking code, localizing screens, and running accessibility audits.

All skill logic lives in `SKILL.md` instruction files. There is no TypeScript code, no bundler, and no install script. Everything runs through the Claude Code agent using the Figma MCP connector for authentication.

> **Ramping up a new agent (Claude Sonnet, Opus, future models)?** Read these two quick-reference guides before running any skill:
>
> - [`skills/create-design-system/CONVENTIONS.md`](skills/create-design-system/CONVENTIONS.md) — **router** to convention shards; **§0 gotchas** live in [`skills/create-design-system/SKILL.md`](skills/create-design-system/SKILL.md). For geometry + pages + naming, read [`skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md); for `codeSyntax` rules, [`skills/create-design-system/conventions/02-codesyntax.md`](skills/create-design-system/conventions/02-codesyntax.md). **Do not** load every shard at session start — follow each skill’s lazy-load instructions.
> - [`skills/create-component/CONVENTIONS.md`](skills/create-component/CONVENTIONS.md) — the **matrix-default** 5-section layout every component uses: header + properties table + **live Component Set section (inline, editable)** + variant × state specimen matrix + Do/Don't usage notes. Covers per-category state axes, per-component variant rows, instance-vs-component handling, the `CONFIG` schema (including `labelStyle` bindings to published `Label/*` text styles), and a Button reference `CONFIG`.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Skills](#skills)
  - [/new-project](#new-project)
  - [/create-design-system](#create-design-system)
  - [/sync-design-system](#sync-design-system)
  - [/create-component](#create-component)
  - [/code-connect](#code-connect)
  - [/new-language](#new-language)
  - [/accessibility-check](#accessibility-check)
- [Typical Workflow](#typical-workflow)
- [Skill Chaining & Handoff Context](#skill-chaining--handoff-context)
- [Token Architecture](#token-architecture)
- [Design System Conventions (Quick Reference)](#design-system-conventions-quick-reference)
- [Figma Project Structure](#figma-project-structure)
- [Plugin File Structure](#plugin-file-structure)
- [Contributing](#contributing)

---

## How It Works

Each skill is an instruction file (`SKILL.md`) that tells the Claude Code agent exactly how to perform a design ops task. When you invoke a skill, Claude reads the instructions and executes the steps using:

- **Agent policy (all skills)** — MCP payloads (e.g. Figma `use_figma` `code`) go **inline in each tool call**; do **not** add throwaway `.mcp-*`, `*-payload.json`, or scratch scripts to the repo to stage them. See **[`AGENTS.md`](AGENTS.md)** and Cursor rules **[`mcp-inline-payloads.mdc`](.cursor/rules/mcp-inline-payloads.mdc)** + **[`cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc)**.
- **Figma MCP connector** — all Figma file creation, canvas writes (pages, frames, variables, components), Code Connect, and read operations
- **Figma REST API** — variable write-back for `/create-design-system` and `/sync-design-system`
- **Filesystem access** — reading and writing local token files (`tokens.css`, `tokens.json`, `tailwind.config.js`) for sync and component wiring
- **Claude's built-in capabilities** — inline translation for localization, WCAG contrast calculations for accessibility

`/new-project` → `/create-design-system`: Step 7 **writes `templates/agent-handoff.md` locally** on that machine’s checkout (not shared unless you commit it), then invokes the next skill. If the file is not writable, use **`--file-key`** instead. Other skills still read or update handoff when present (e.g. `token_css_path` after `/create-design-system`) to reduce re-prompting.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Claude Code** | CLI or desktop app — this is a Claude Code plugin, not a Figma plugin |
| **Figma MCP connector** | Must be active in Claude Code (Settings → MCP → Figma). Handles all Figma authentication — no personal access token needed for `/new-project` |
| **Cursor (if you use it here)** | Enable the **Figma** MCP connector in Cursor and complete OAuth. Open **this repository** as the workspace (or add it via **Add Folder to Workspace**) so `skills/create-design-system/canvas-templates/bundles/*.min.mcp.js` resolves. Project rules under [`.cursor/rules/`](.cursor/rules/) apply automatically. Use the MCP **server** name Cursor shows for your project (see [`AGENTS.md`](AGENTS.md)) — not necessarily the string `figma`. |
| **Organization-tier Figma account** | Required for the Variables REST API (write) used by `/create-design-system` and `/sync-design-system` |
| **Node.js** (for `/create-component`) | Required to run `npx shadcn@latest add` locally |

---

## Installation

1. Clone this repository into your Claude Code plugins directory:

   ```
   git clone https://github.com/detroit-labs/DesignOps-plugin
   ```

2. In Claude Code, open **Settings → Plugins** and add the plugin from the cloned directory. Claude Code reads `plugin.json` and registers all seven skills automatically.

3. Connect the Figma MCP connector in **Settings → MCP → Figma** and complete the OAuth flow with your organization Figma account.

4. Verify the setup by running `/new-project` — Claude will prompt for team name and project name if no arguments are provided.

### Cursor (optional)

Cursor agents only see files under **workspace folders**. If you open **another** repository as your main project, **File → Add Folder to Workspace…** and add the **same DesignOps plugin root** Claude Code uses — the directory that contains `skills/create-design-system/` and `.claude-plugin/plugin.json` (often a versioned subfolder of `~/.claude/plugins/cache/` or `%USERPROFILE%\.claude\plugins\cache\`), or your local git clone of this repo. Otherwise canvas **`.min.mcp.js`** paths will not resolve. See **[`.cursor/rules/cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc)** and **[`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)** § *Source root — Cursor*.

---

## Skills

### /new-project

Create and scaffold a `<Project Name> — Foundations` design system file using the Figma MCP connector. The file is created in Drafts, the full page tree is created, **documentation canvas** is drawn (headers, table of contents, token overview skeleton, Thumbnail `Cover` frame), then a single move instruction is provided at the end. Heavy `use_figma` scripts live under `skills/new-project/phases/`; the agent **`Read`s one phase file per step** to keep context small. After page scaffolding completes, Claude **reposts a markdown progress checklist** in chat as each phase finishes so you can follow along.

**Syntax**
```
/new-project
/new-project --team "Team Name" --name "Project Name"
```

**What it creates**

| File | Target Folder | Method |
|---|---|---|
| `<Project Name> — Foundations` | `Design-Systems/` | Created via MCP `create_new_file`, pages and canvas via sequential `use_figma` calls |

The file lands in Drafts. At the end of the run Claude provides a one-step move instruction: right-click the file in Figma → Move to Project → Design-Systems/.

**Scaffold sequence** — orchestration and checklist rules in [`skills/new-project/SKILL.md`](skills/new-project/SKILL.md); scripts in [`skills/new-project/phases/`](skills/new-project/phases/).

| Step | What happens |
|---|---|
| 5 | Rename first page, create all pages from the Detroit Labs hierarchy (`phases/05-scaffold-pages.md`) |
| 5c | **Table of Contents** on `📝 Table of Contents` — single-column stacked list of full-width section cards grouped by system band; link rows named `toc-link/{exact Figma page name}` (no hyperlinks yet) |
| 5b | Doc `_Header` component (1800 × 320, `cornerRadius: 0`, VERTICAL auto-layout, black fill) on `Documentation components` + instances on **every page except `Thumbnail`** (cover is the meta surface for that page). No `_Content` placeholder — each downstream phase owns its own `_PageContent` at `y: 320`. |
| 5d | **Token Overview** skeleton on `↳ Token Overview` — architecture, mapping table, mode panels, binding tips, Claude commands; `placeholder/*` nodes cleared when `/create-design-system` runs |
| 5e | **Thumbnail** — full-bleed `Cover` (gradient, project title, chips, DL mark) |
| 5c-links | URL hyperlinks on TOC page-name text (after `Cover` and `_Header` exist) |
| 6–7 | Move instructions; optional chain to `/create-design-system` (local **`templates/agent-handoff.md`**, or **`--file-key`** if not writable) |

**Page hierarchy** — sourced from the Detroit Labs Foundations template and extended with shadcn/ui component pages, organized into atomic design groups:

- Token & Style Docs (Table of Contents, Token Overview)
- Style Guide (Primitives, Theme, Layout, Text Styles, Effects)
- Brand Assets (Logo Marks, Vector Patterns, Icons, Imagery, Motion)
- Atoms (Typography, Label, Kbd, Dividers, Avatar, Badge, Chips, Tags, Counters, Aspect Ratio)
- Buttons & Controls (Buttons, Button Group, Toggle, Toggle Group, Segmented Controller)
- Inputs & Forms (Text Field, Textarea, Input Group, Input OTP, Checkbox, Radio, Switch, Select, Combobox, Slider, Calendar, Date Picker, and more)
- Feedback & Status (Alerts, Toast, Sonner, Progress, Loaders, Skeleton, Blank states, Error States, and more)
- Overlays (Dialogue, Drawer, Sheets, Popover, Hover Card, Tooltips, Dropdown Menu, Command)
- Navigation (Top/Bottom/Tablet Nav, Sidebar, Menubar, Breadcrumb, Tabs bar, Pagination, and more)
- Data Display (Data Table, Lists, Chart, Stat block, Widgets, Video player)
- Content Containers (Cards, Tiles, Carousel, Accordion, Collapsible, Resizable, Scroll Area)
- Native & Platform (Native Device Parts)
- Utility (`Documentation components`, `Grids`, `parking lot`)

After creating and scaffolding the file, Claude offers to chain into `/create-design-system`.

**File naming convention:** All titles use an em dash (`—`) with a space on each side: `<Project Name> — <File Type>`

---

### /create-design-system

Initialize a design system in a Figma file by pushing brand tokens into five variable collections. **`tokens.css`** in the codebase is **optional** — after variables are verified in Figma, the skill asks explicitly before writing CSS (designers who only use Figma can decline). After **Step 4**, the skill shows a **“Building your design system”** checklist and **reposts** it as each row completes; during **Step 3** it sends short “Collected: …” lines between questions. See `skills/create-design-system/SKILL.md`.

**Syntax**
```
/create-design-system
/create-design-system --file-key <FigmaFileKey>
/create-design-system --theme baseline|brand --file-key <FigmaFileKey>
```

No platform argument — platform mapping (Web / Android / iOS) is encoded as `codeSyntax` on every variable rather than as separate alias collections. Use **`--file-key`** when you did not (or could not) write local handoff after `/new-project`.

**What it does**

1. Resolves the Figma file: **`--file-key` from arguments first**, then optional local `templates/agent-handoff.md`, then prompts
2. Collects brand tokens interactively (primary, secondary, neutral, tertiary, and error colors; body and display font families; base font size, spacing unit, and border radius)
3. Generates the `Primitives` collection: five full color ramps (primary, secondary, tertiary, error, neutral — 50–950 stops via Tailwind HSL interpolation), `Space/*` spacing scale, `Corner/*` radius scale, elevation floats, and **`typeface/display`** + **`typeface/body`** STRING primitives (single source for font family names)
4. Creates the `Theme` collection (Light / Dark modes): **54** semantic color aliases across **7** groups — `background/` (canvas + container ladder + content + inverse + scrim/shadow; WEB `--color-background*`; ANDROID/iOS codeSyntax still uses M3 **surface** roles), `border/` (`default` / `subtle`; WEB `--color-border*`), `primary/`, `secondary/`, `tertiary/` (each includes standard + **fixed** roles), `error/` (same 8-token shape as brand hues + **fixed** roles), and `component/` (shadcn: input, ring, sidebar) — all aliasing Primitives per mode
5. Creates the `Typography` collection (8 scale modes): **15** type style slots (Material 3 baseline: Display, Headline, **Title**, Body, Label — each in LG/MD/SM) × 4 properties (font-family, font-size, font-weight, line-height). Every **`*/font-family`** aliases **`typeface/display`** or **`typeface/body`** so families are edited once in Primitives. Font sizes scale across 8 modes modeled on Android's font-scale curve: 85%, 100% (default), 110%, 120%, 130%, 150%, 175%, 200%. Large text uses nonlinear scaling (Android 14 behaviour) at high multipliers.
6. Creates the `Layout` collection (Default mode): `space/*` and `radius/*` semantic aliases into Primitives
7. Creates the `Effects` collection (Light / Dark modes): shadow color (opacity changes per mode) and blur aliases into elevation Primitives
8. Writes all five collections to Figma via the Variables REST API with `codeSyntax` (WEB/ANDROID/iOS) on every variable
9. Verifies the write with a GET call and reports final variable counts
10. **Optionally writes `tokens.css`** — separate opt-in after Figma push (default path `src/styles/tokens.css` when accepted; see [Token Architecture](#token-architecture))
11. Updates `templates/agent-handoff.md` with `token_css_path` **only if** `tokens.css` was written and handoff exists and is writable; otherwise the Step 14 report states next steps for `/create-component`
12. **`use_figma` — Style guide (Steps 15a–15c)** — premium layout on a **1800px** canvas column (`_Header` + `_PageContent` both 1800 wide; inner content 1640; tables 1640 wide): **variable-bound** swatches (Dev Mode), **2-column** Theme cards with explicit **Light/Dark** previews, published **`Doc/*`** + **slot Text styles** + **`Effect/shadow-*`** effect styles, then `↳ Layout` / `↳ Text Styles` / `↳ Effects` (see **Canvas documentation visual spec § A–G** in the skill — auto-layout **hug**, **`textAutoResize`**, **`doc/...` row frames**, **§ G** premium polish)
13. **`use_figma` — Token Overview (Step 17)** — replaces skeleton data, rebinds doc chrome to Theme/Typography variables, updates tables from live variables, removes `placeholder/*` notes
14. **`use_figma` — Thumbnail (Step 18)** — updates `Cover` gradient stops from `color/primary/500` and `color/secondary/500`

**Requires:** Organization-tier Figma account for the Variables REST API write endpoint.

---

### /sync-design-system

Diff a local token file against the current Figma variable state and push changes in either direction.

**Syntax**
```
/sync-design-system
/sync-design-system <figma-file-key>
/sync-design-system https://www.figma.com/design/<file-key>/...
```

**Arguments**

| Argument | Description |
|---|---|
| `file_key` | Figma file URL or bare key. Falls back to `agent-handoff.md` context, then prompts interactively. |

**Supported local token formats**

- `tokens.css` — CSS custom properties (`:root`, `[data-theme="dark"]`, `[data-font-scale="N"]`)
- `tokens.json` — W3C Design Token Community Group (DTCG) format
- `tailwind.config.js` — Tailwind CSS configuration

**What it does**

1. Reads the local token file from the filesystem and flattens it to a `collection/mode/token-name → value` map
2. Reads the current Figma variable state via the Variables REST API, flattening each mode separately (Theme: Light/Dark, Typography: all 8 scale modes, Effects: Light/Dark)
3. Computes a three-way diff: NEW (in code, not in Figma), MISSING (in Figma, not in code), CONFLICTS (different values)
4. Presents the diff and asks which action to take:
   - **Push to Figma** — write local token values to Figma variables, writing all required modes
   - **Push to code** — write Figma variable values back to the local token file
   - **Push both** — sync in both directions (only available when there are no conflicts)
   - **Review manually** — resolve each conflict one at a time before pushing
5. Flags any legacy `Web`, `Android/M3`, or `iOS/HIG` collections as deprecated if found
6. **After a successful push to Figma** (options 1, 3, or confirmed manual push): runs **`use_figma`** in one skill run — **Step 9b** redraws affected style guide pages (one call per page batch, matching create-design-system **15a–15c** + **Doc/** / slot styles / effect styles, **1800** canvas + **1640** tables), **Step 9d** refreshes **`↳ Token Overview`**, **Step 9e** updates the Thumbnail **`Cover`** gradient — all following **Canvas documentation visual spec § A–G** like `/create-design-system`. Skipped when only pushing to code (option 2).

---

### /create-component

Install one or more shadcn/ui components, wire them to the project's CSS token file, draw them onto the Figma canvas with token variable bindings, and offer to chain into Code Connect.

**Syntax**
```
/create-component button
/create-component button input card dialog
```

**Arguments**

| Argument | Description |
|---|---|
| `[components...]` | One or more shadcn/ui component names. Prompted interactively if omitted. |

**What it does**

1. Locates `tokens.css` from `agent-handoff.md` (`token_css_path`) or by searching the project
2. Initializes shadcn/ui if not already set up (`npx shadcn@latest init`)
3. **Wires `tokens.css` into the project's global CSS** — removes shadcn's generated `@layer base` variable block and adds `@import 'tokens.css'` so all shadcn components resolve their CSS custom properties from the design system (both files use the same variable names)
4. Installs each component via `npx shadcn@latest add <component>`
5. Draws the component into a **documentation matrix** (default layout — see below) on the Figma canvas, routing each component to its designated page in the Foundations scaffold
6. Binds Figma variable tokens from the `Theme`, `Layout`, and `Typography` collections to each canvas component
7. Offers to chain into `/code-connect`

**Matrix-default canvas layout** — every component, regardless of shape (button-like, input-like, checkable, overlay, layout), renders into the same 5-section documentation frame at 1640 inner width:

1. **Header** — title + 1-line summary + shadcn source link.
2. **Properties table** — 5 columns (PROPERTY · TYPE · DEFAULT · REQUIRED · DESCRIPTION) summing to 1640, rows pulled from the `VariantProps<…>` union in the installed shadcn source.
3. **Component Set section** — the **live, editable `ComponentSet`** rendered inline as a horizontal-wrap auto-layout grid (every variant visible at a glance, dashed frame to signal "source of truth"). Designers edit variants here and every matrix instance below updates automatically — no more hunting for a ComponentSet parked off-canvas.
4. **Variant × State matrix** — rows = each variant for the component, columns = each state for the component's category (button-like uses `default · hover · pressed | disabled`; input-like uses `default · focus · error | disabled`; checkable uses `unchecked · checked · indeterminate | disabled`; overlays use a single `open` state; etc.), with size groups stacked vertically when the component has a size axis. Two-tier header groups interactive states under **DEFAULT** and inactive states under **DISABLED**. Cells contain **instances** of the ComponentSet above; states that aren't Figma variant props are applied as instance overrides.
5. **Usage notes** — 2-column Do / Don't grid with 3+ bullets each.

**Inner labels use published text styles.** The text inside each component variant is bound to the `Label/XS · Label/SM · Label/MD · Label/LG` text styles (driven per size via `CONFIG.labelStyle`) so labels stay in sync with the Typography system — no stray `fontSize: 14` overrides.

The `/create-component` script is structured as a single **`CONFIG`** object (the only part you edit per component — variants, sizes, style, states, labels, label text styles, properties, usage, state-override callback) + a generic draw engine (identical for every component). Full `CONFIG` schema, per-category state axes (button-like / input-like / checkable / overlay / layout), audit checklist, and a Button reference `CONFIG` live in [`skills/create-component/CONVENTIONS.md`](skills/create-component/CONVENTIONS.md).

Because `tokens.css` defines **canonical** Tailwind-friendly theme vars (`--color-background`, `--color-content`, `--color-border`, `--color-primary`, …) plus shadcn aliases (`--background` → `var(--color-background)`, `--foreground` → `var(--color-content)`, `--primary` → `var(--color-primary)`, …), Web and shadcn stay aligned without extra mapping.

**Note:** This skill uses the shadcn CLI and Figma MCP to draw components — it does not require manually importing a Figma community kit.

---

### /code-connect

Map Figma components to their codebase counterparts using Figma Code Connect.

**Syntax**
```
/code-connect
/code-connect <figma-file-key>
/code-connect https://www.figma.com/design/<file-key>/...
```

**Arguments**

| Argument | Description |
|---|---|
| `file_key` | Figma file URL or bare key. Falls back to `agent-handoff.md` context, then prompts interactively. |

**What it does**

1. Calls `get_design_context` to enumerate all `COMPONENT` and `COMPONENT_SET` nodes in the file
2. Calls `get_context_for_code_connect` on each component node to gather props and variants
3. Searches the local codebase for the matching source file for each component
4. Generates Code Connect mapping configurations and presents them for designer review
5. Publishes confirmed mappings via `send_code_connect_mappings`

**Important:** Claude will never publish Code Connect mappings without explicit designer confirmation.

**Note:** `get_code_connect_suggestions` is not used — it only surfaces components with pre-existing Code Connect metadata and returns empty for net-new components. `get_design_context` discovers all components regardless of prior Code Connect state.

**CLI fallback (Step 3b):** If the MCP path is unavailable, the skill automatically falls back to writing `.figma.tsx` files and publishing with `npx figma connect publish --token=<PAT>`. The PAT must have `code_connect:write` scope and is collected interactively — it is not needed up front.

---

### /new-language

Localize a Figma frame into a new language. Duplicates the frame to a new Figma page, extracts all text nodes, translates inline using Claude, and writes the translations back.

**Syntax**
```
/new-language
/new-language es
/new-language fr 123:456
```

**Arguments**

| Argument | Description |
|---|---|
| `locale` | BCP 47 locale code (e.g. `es`, `fr`, `de`, `ar`, `ja`). Prompted interactively with a reference table if omitted. |
| `node_id` | Figma node ID of the source frame (e.g. `123:456`). Prompted interactively if omitted. |

**What it does**

1. Duplicates the selected frame to a new Figma page named for the locale
2. Extracts all text node strings from the duplicated frame
3. Translates all strings inline using Claude — no external translation API required
4. Writes translated strings back to the cloned text nodes via Figma MCP

**RTL warning:** For right-to-left locales (`ar`, `fa`, `he`, `ur`), Claude displays a prominent warning that the layout needs to be mirrored manually.

---

### /accessibility-check

Run a WCAG 2.1 AA accessibility audit on a selected Figma frame, including contrast ratios, minimum text sizes, iOS Dynamic Type simulation, and Android font scaling simulation.

**Syntax**
```
/accessibility-check
/accessibility-check 123:456
```

**What it checks**

| Check | Standard | Threshold |
|---|---|---|
| Normal text contrast | WCAG 2.1 AA | 4.5:1 minimum |
| Large text contrast (≥24px regular or ≥18.67px bold) | WCAG 2.1 AA | 3:1 minimum |
| Minimum text size | WCAG 2.1 AA | 12px minimum recommended |
| iOS Dynamic Type simulation | Apple HIG — 12-step scale | Clones frame at all 12 multipliers (0.82× to 2.47×) |
| Android font scaling simulation | Material 3 / Android 14 | Clones frame at 100%, 130%, 150%, 200% |

**What it produces**

1. An inline pass/fail report in the Claude Code conversation
2. iOS Dynamic Type page — 12 frame clones arranged in 2 rows × 6 columns on a new Figma page
3. Android scaling page — 4 frame clones in a single row on a new Figma page
4. Optional report frame written to an `Accessibility` page in the Figma file

---

## Typical Workflow

A complete project setup from scratch through production-ready, code-connected components:

```
# 1. Scaffold the Foundations file in Figma (pages + doc UI + Thumbnail cover)
/new-project --team "Client Team" --name "Acme App"

# 2. Push variables + tokens.css, then refresh style guide + MCP manifest + Token Overview + cover
/create-design-system

# 3. Install shadcn/ui components, wire tokens.css into globals.css,
#    and draw components onto the Figma canvas with token bindings
/create-component button input card dialog

# 4. Map Figma components to their codebase counterparts
/code-connect

# 5. Sync if tokens drift between code and Figma
/sync-design-system

# 6. Localize a screen
/new-language es 123:456

# 7. Run an accessibility audit before handoff
/accessibility-check 123:456
```

---

## Skill Chaining & Handoff Context

**`/new-project` → `/create-design-system`:** Step 7 updates **local** `templates/agent-handoff.md` when possible, then runs the next skill. **`--file-key`** remains the fallback when handoff cannot be written.

**Handoff file:** `templates/agent-handoff.md` stores the active Figma file key, project name, CSS token file path, and last skill run **on that checkout** so later skills can pick up without re-prompting.

**Frontmatter fields:**

| Field | Description |
|---|---|
| `active_file_key` | The Figma file key currently being worked on |
| `active_project_name` | The project name as it appears in the Figma team space |
| `last_skill_run` | The last skill that was executed |
| `variable_slot_catalog_path` | Optional path to a variable slot catalog; usually empty unless your workflow uses one |
| `token_css_path` | Path to `tokens.css` written by `/create-design-system` — read by `/create-component` to wire the import into `globals.css` |
| `open_items` | Notes and unresolved items for the next skill to address |

**To pass context manually**, include the handoff file in your prompt:

```
/create-component button
Context: see templates/agent-handoff.md
```

Skills that accept a `file_key` argument typically check `active_file_key` in the handoff when present; `/create-design-system` also honors **`--file-key`** first.

---

## Token Architecture

The design system uses a five-layer variable architecture in Figma with a matching CSS file in the codebase.

### Figma variable collections

```
Primitives  (Default mode)
  ├── color/primary/50–950    raw hex ramp
  ├── color/secondary/50–950  raw hex ramp
  ├── color/tertiary/50–950   raw hex ramp
  ├── color/error/50–950      raw hex ramp
  ├── color/neutral/50–950    raw hex ramp
  ├── Space/100–2400          px scale (4px base)
  ├── Corner/None–Full        px scale
  └── elevation/100–1600      unitless floats

Theme  (Light mode / Dark mode)
  ├── color/background/*      → app canvas + tonal layers (WEB `--color-background*`; ANDROID/iOS still M3 **surface** roles)
  ├── color/border/*          → outline / outlineVariant (`--color-border`, `--color-border-subtle`)
  ├── color/primary/*         → primary + primary fixed roles
  ├── color/secondary/*       → secondary + fixed roles
  ├── color/tertiary/*        → tertiary + fixed roles
  ├── color/error/*           → error feedback (same shape as primary/)
  ├── color/component/*       → shadcn extensions (input, ring, sidebar)
  └── … 54 semantic tokens total (7 groups)

Typography  (8 scale modes: 85 · 100 · 110 · 120 · 130 · 150 · 175 · 200)
  ├── Display/LG–SM / font-family, font-size, font-weight, line-height
  ├── Headline/LG–SM / …
  ├── Title/LG–SM / …
  ├── Body/LG–SM / …
  └── Label/LG–SM / …   (60 variables; font-family → Primitives typeface; sizes scale per mode)

Layout  (Default mode)
  ├── space/xs–4xl    → Space/* aliases
  └── radius/none–full → Corner/* aliases

Effects  (Light mode / Dark mode)
  ├── shadow/color       #000 @ 10% | #000 @ 30%
  └── shadow/sm–2xl/blur → elevation/* aliases
```

Every variable carries `codeSyntax` for all three platforms. There are no separate Web, Android/M3, or iOS alias collections — platform naming lives inline on each token.

**ANDROID** `codeSyntax` strings use **kebab-case** aligned to Material 3 roles (e.g. `surface-container-high`, `on-primary`, `error-fixed`) — the same semantics as [Jetpack Compose `ColorScheme`](https://developer.android.com/jetpack/compose/designsystems/material3), not API camelCase. **iOS** `codeSyntax` strings use **dot-path semantics** (e.g. `.Background.default`, `.Background.high`, `.Primary.on`, `.Border.default`) for design-system / codegen references — not `UIColor` symbol names. See `/create-design-system` Step 6 for the full Theme table.

`/create-design-system` supports **`--theme baseline`** (M3 baseline seed hues for Primitives ramps) or **`--theme brand`** / wizard defaults; see the skill for Step 2.5.

| Token | WEB | ANDROID (M3 kebab) | iOS (semantic) |
|---|---|---|---|
| `color/background/default` | `var(--color-background)` | `surface` | `.Background.default` |
| `color/background/container-high` | `var(--color-background-container-high)` | `surface-container-high` | `.Background.high` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Background.variant` |
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/primary/subtle` | `var(--color-primary-subtle)` | `primary-container` | `.Primary.subtle` |
| `color/error/default` | `var(--color-danger)` | `error` | `.Status.error` |
| `Headline/LG/font-size` | `var(--headline-lg-font-size)` | `headline-lg-font-size` | `.Typography.headline.lg.font.size` |
| `Title/LG/font-size` | `var(--title-lg-font-size)` | `title-lg-font-size` | `.Typography.title.lg.font.size` |
| `typeface/display` | `var(--typeface-display)` | `typeface-display` | `.Typeface.display` |
| `space/md` | `var(--space-md)` | `space-md` | `.Layout.space.md` |

### tokens.css — local codebase file

If you opt in after the Figma push, `/create-design-system` writes `tokens.css` (default path: `src/styles/tokens.css`) so the codebase mirrors Figma variables as CSS custom properties:

```css
/* Primitives — raw values */
:root {
  --color-primary-500: #3b82f6;
  --space-400: 16px;
  --corner-medium: 12px;
}

/* Theme — Light (`--color-background*`, `--color-border*`, brand/status roles, shadcn aliases) */
:root, [data-theme="light"] {
  --color-background:                  var(--color-neutral-50);
  --color-background-container-highest: var(--color-neutral-50);
  --color-content:               var(--color-neutral-900);
  --color-border:                var(--color-neutral-200);
  --color-primary:               var(--color-primary-500);
  --color-on-primary:            var(--color-primary-50);
  --color-primary-subtle:          var(--color-primary-100);
  --color-danger:                var(--color-error-600);
  --color-accent-subtle:           var(--color-tertiary-100);
  /* …54 M3-aligned theme tokens as --color-* … */

  /* shadcn/ui compatibility aliases */
  --background:      var(--color-background);
  --foreground:      var(--color-content);
  --border:          var(--color-border);
  --destructive:     var(--color-danger);
  --accent:          var(--color-accent-subtle);
  /* …aliases… */
}

/* Theme — Dark */
[data-theme="dark"],
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }

/* Typography — base scale */
:root {
  --headline-lg-font-size: 32px;
  --body-md-font-family: 'Inter', sans-serif;
  /* …48 properties… */
}

/* Typography — scale modes */
[data-font-scale="130"] { --headline-lg-font-size: 42px; … }
[data-font-scale="200"] { --headline-lg-font-size: 45px; … } /* nonlinear */

/* Layout */
:root { --space-md: var(--space-300); --radius-md: var(--corner-medium); }
```

**Primary CSS vars use M3 role names** (`--on-background`, `--outline`, `--primary-container`, `--error`, etc.). shadcn/ui compatibility aliases (`--foreground`, `--border`, `--destructive`, `--accent`, etc.) are defined as aliases pointing back to the M3 vars, so shadcn components resolve correctly with no additional mapping.

**Dark mode** is toggled by adding `data-theme="dark"` to the `<html>` element. **Font scaling** is toggled by adding `data-font-scale="130"` (or any of the 8 scale values) to `<html>`.

---

## Design System Conventions (Quick Reference)

Full details are split across [`skills/create-design-system/CONVENTIONS.md`](skills/create-design-system/CONVENTIONS.md) (index) and [`skills/create-design-system/conventions/`](skills/create-design-system/conventions/) (shards). The highlights every agent needs:

**Canvas geometry (style guide + sync redraws):**

| Layer | Width | Notes |
|---|---|---|
| Page canvas | **1800px** | `_Header` + `_PageContent` both span this column. |
| `_Header` | **1800 × 320** | `layoutMode: VERTICAL`, **`cornerRadius: 0`** (square seam against `_PageContent`). |
| `_PageContent` (style guide) | **1800** wide, padding **80** | `y: 320`, fill literal `#FFFFFF`, `itemSpacing: 48`. |
| `_PageContent` (TOC + Token Overview) | **1800** wide, padding **40** | Different padding — index pages keep the wider inner. |
| Inner content / tables | **1640** | Column widths in every table sum to **exactly 1640**. |

**`codeSyntax` — every variable, three strings, set via REST API (Plugin API is read-only):**

- **WEB** — `var(--…)` CSS custom property (single `--color-*` namespace for Tailwind v4 `@theme`)
- **ANDROID** — kebab-case M3 role (`surface-container-high`, not `surfaceContainerHigh`)
- **iOS** — fully dot-separated lowercase path, **never camelCase**

  ```text
  correct: .Background.container.high · .Typography.headline.lg.font.size · .Corner.extra.small · .Status.on.error.fixed.muted
  wrong:   .Background.containerHigh · .Typography.headline.lg.fontSize · .Corner.extraSmall · .Status.onErrorFixedMuted
  ```

- **Theme codeSyntax is explicit per token** — read from the table in `skills/create-design-system/SKILL.md` § 6, never derive from the Figma path.

**Body text variants** — each Body size (LG/MD/SM) emits 5 slots grouped in `Body/{size}/`: `regular`, `emphasis` (weight 500), `italic`, `link` (underline), `strikethrough`. 3 sizes × 5 variants = 15 body slots.

**Pages that do not exist** — `↳ MCP Tokens` and the `[MCP] Token Manifest` frame were removed as redundant. Do not reintroduce them. Sync redraw runs Steps **9b / 9d / 9e** (style guide + Token Overview + Cover) — there is no Step 9c.

---

## Figma Project Structure

Detroit Labs projects use a standardized three-folder hierarchy within each Figma team:

```
<Team Name>
  └── Design-Systems/
        └── <Project Name> — Foundations
```

`/new-project` scaffolds the Foundations file only. The file is created in Drafts via the Figma MCP and moved into the Design-Systems/ folder manually using Figma's right-click → Move to Project UI.

---

## Plugin File Structure

```
.
├── .claude/
│     └── settings.local.json        # Default plugin settings and template file keys
├── .claude-plugin/
│     ├── plugin.json                # Plugin manifest — skill registry and argument schemas
│     └── marketplace.json           # Marketplace listing metadata
├── skills/
│     ├── new-project/
│     │     ├── SKILL.md              # Orchestrator + progress checklist rules
│     │     └── phases/               # One markdown file per `use_figma` / wrap-up phase
│     ├── create-design-system/SKILL.md
│     ├── sync-design-system/SKILL.md
│     ├── create-component/SKILL.md
│     ├── code-connect/SKILL.md
│     ├── new-language/SKILL.md
│     └── accessibility-check/SKILL.md
├── templates/
│     ├── agent-handoff.md           # Skill-to-skill context transfer (file key, token CSS path, open items)
│     └── workflow.md                # Plugin-level agent context and conventions
└── README.md
```

**`settings.local.json` defaults:**

| Setting | Default | Description |
|---|---|---|
| `figma_mcp` | `"connector"` | Authentication method — always `connector` for this plugin |
| `token_schema_path` | `"src/styles/tokens.css"` | Local token file path for `/sync-design-system` |
| `template_file_keys` | See below | Figma file keys for all template sources |

**Template file keys** (configured in `settings.local.json`):

| Template | Key |
|---|---|
| Foundations Agent Kit | `rJQsr4aou5yjzUhaEM0I2f` |

---

## Contributing

This plugin is distributed internally via this Git repository. To add or modify a skill:

1. Edit the corresponding `skills/<skill-name>/SKILL.md` file — the instructions are plain Markdown, no compilation required
2. If adding a new skill, add an entry to `.claude-plugin/plugin.json` with the skill `name`, `description`, `path`, and `arguments` schema
3. Update `templates/workflow.md` and this `README.md` if the change affects designer-facing behavior or conventions
4. Test with a live Figma file using the Figma MCP connector before committing

All Figma operations require the Figma MCP connector to be active and authenticated with an Organization-tier account. The Variables REST API write endpoint (`PUT /v1/files/:key/variables`) is the most common source of plan-tier errors — verify your account tier if `/create-design-system` or `/sync-design-system` fails with a `403`.
