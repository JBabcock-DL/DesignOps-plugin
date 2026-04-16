# DesignOps Plugin — Workflow Reference

## 1. Plugin Overview

The DesignOps Plugin is a set of Claude Code skill instruction files (SKILL.md) that enable Detroit Labs designers to run repeatable Figma design operations from the command line via Claude Code. There is no TypeScript code to compile, no install script to run, and no Figma sandbox involved — every skill is a plain-language instruction document that tells the Claude agent what steps to take.

**Who it is for:** Detroit Labs designers who work in Figma and want to automate recurring setup and maintenance tasks (project scaffolding, design system creation, token sync, component building, localization, and accessibility auditing) without leaving their terminal or switching to manual Figma workflows.

**How it works:**
1. The designer invokes a skill command in Claude Code (e.g. `/create-design-system`).
2. Claude Code loads the corresponding SKILL.md from `skills/<skill-name>/`.
3. The agent follows the SKILL.md instructions, calling Figma MCP tools (`mcp__claude_ai_Figma__*`), the Figma Variables REST API, and reading/writing the local filesystem as needed.
4. The agent reports results (created file links, diff summaries, audit reports) back to the designer inline.

---

## 2. Prerequisites

| Requirement | Notes |
|---|---|
| Claude Code (latest) | Install via `npm install -g @anthropic-ai/claude-code` |
| Figma MCP connector | Configured inside Claude Code — handles all Figma authentication for file creation and canvas operations |
| Organization-tier Figma account | Required for the Figma Variables REST API write endpoint used by `/create-design-system` and `/sync-design-system` |
| Git clone of this repo | Plugin files must be present locally so Claude Code can read SKILL.md files |

**No PAT or environment variable is needed for `/new-project`.** File creation and page scaffolding use the Figma MCP connector exclusively. Other skills that call the Variables REST API also use the MCP connector's OAuth session.

---

## 3. Skill Overview

| Skill | Invocation | Description |
|---|---|---|
| New Project | `/new-project` | Creates a `<Project Name> — Foundations` design file via the Figma MCP, scaffolds the full Detroit Labs page hierarchy, draws documentation UI on the canvas (headers, TOC, Token Overview skeleton, Thumbnail cover + file thumbnail), and provides a move instruction to the Design-Systems/ folder |
| Create Design System | `/create-design-system` | Pushes brand tokens into five Figma variable collections (Primitives, Theme, Typography, Layout, Effects), writes `tokens.css` to the local codebase, then refreshes Figma canvas docs (style guide pages, MCP token manifest, Token Overview content, brand-colored cover thumbnail) |
| Sync Design System | `/sync-design-system` | Diffs a local token file against live Figma variable state and pushes changes in either direction; after pushes to Figma, can redraw affected style guide pages and the MCP Tokens manifest so canvas matches variables |
| Create Component | `/create-component` | Installs shadcn/ui components, wires `tokens.css` into `globals.css`, draws components to the Figma canvas with token bindings, and optionally chains Code Connect |
| Code Connect | `/code-connect` | Maps Figma components to codebase counterparts using Figma Code Connect and publishes the mappings after designer review |
| New Language | `/new-language` | Localizes a Figma frame into a new language by duplicating it, translating text inline via Claude, and writing strings back |
| Accessibility Check | `/accessibility-check` | Runs a WCAG 2.1 AA audit: contrast ratios, text size minimums, iOS Dynamic Type simulation, Android font scaling simulation |

---

## 4. Figma MCP Usage Conventions

All Figma operations in this plugin go through the official Figma MCP server (`mcp__claude_ai_Figma__*`). The connector is authenticated once at the Claude Code level — individual skills do not re-authenticate.

**Key MCP tools used across skills:**

| MCP Tool | Used By | Purpose |
|---|---|---|
| `create_new_file` | `/new-project` | Create blank Figma design files in Drafts |
| `get_metadata` | `/create-design-system` | Read team and project metadata before writes |
| `get_variable_defs` | `/create-design-system`, `/sync-design-system` | Read current variable collection state from a Figma file |
| `use_figma` | `/new-project`, `/create-design-system`, `/sync-design-system`, `/create-component`, `/new-language`, `/accessibility-check` | General-purpose Figma write/read operations (scaffold pages, doc headers, style guide layouts, token manifest frames, components, text nodes). Load the **figma-use** skill before every `use_figma` call when your environment requires it. |
| `get_context_for_code_connect` | `/code-connect` | Retrieve component context (props, variants) for a specific node ID |
| `send_code_connect_mappings` | `/code-connect` | Publish finalized Code Connect mappings |
| `get_design_context` | `/code-connect`, `/accessibility-check`, `/create-component` | Enumerate component nodes for Code Connect discovery; read frame/node layout and style data for accessibility and component drawing |
| `get_screenshot` | `/accessibility-check` | Capture rendered frame for visual diff |

**Auth notes:**
- All MCP calls are authenticated by the Figma MCP connector configured in Claude Code. No per-skill token injection is needed.
- The connector requires an Organization-tier Figma account for write operations on variable collections.
- If a skill encounters an auth error, the designer should re-authenticate the Figma MCP connector in Claude Code settings before retrying.

---

## 5. Detroit Labs Figma Project Structure

```
<Team Space>/
  Design-Systems/
    <ProjectName> — Foundations     (Design file — created via MCP, page-scaffolded)
```

**Folder naming convention:** Folders use title case. File names follow the pattern `<ProjectName> — <FileType>` (em dash, not hyphen).

**File placement:** `/new-project` creates files in Drafts and scaffolds pages via `use_figma`. The designer moves the file to the correct project folder using Figma's right-click → Move to Project UI. The Figma REST API does not expose a public endpoint for programmatic file placement.

**Foundations template reference** (used to source the page hierarchy — not cloned at runtime):

| Template | File Key | Figma File Type |
|---|---|---|
| Foundations / Agent Kit | `rJQsr4aou5yjzUhaEM0I2f` | Design |

---

## 6. Token Architecture

Detroit Labs design systems use a five-collection Figma variable architecture paired with a single `tokens.css` file in the local codebase.

### Figma Variable Collections

| Collection | Modes | Contents |
|---|---|---|
| `Primitives` | Default | Raw color ramps (primary, secondary, tertiary, error, neutral — 50–950), Space scale, Corner scale, elevation floats |
| `Theme` | Light / Dark | 33 semantic color aliases in 7 groups (background/, surface/, primary/, secondary/, tertiary/, status/, component/) pointing to Primitives per mode |
| `Typography` | 85 · 100 · 110 · 120 · 130 · 150 · 175 · 200 | 12 type style slots × 4 properties; sizes scale per mode on Android's font-scale curve |
| `Layout` | Default | `space/*` and `radius/*` semantic aliases into Primitives |
| `Effects` | Light / Dark | Shadow color (opacity per mode) and blur aliases into elevation Primitives |

**Platform mapping** is encoded as `codeSyntax` on every variable — there are no separate Web, Android/M3, or iOS/HIG collections. Each token carries three code names inline.

**ANDROID** uses exact **Material Design 3** color role names. **iOS** uses **Apple HIG** system color names where a direct semantic equivalent exists.

| Token | WEB | ANDROID (M3) | iOS (HIG) |
|---|---|---|---|
| `color/background/bg` | `var(--background)` | `background` | `systemBackground` |
| `color/background/fg` | `var(--on-background)` | `onBackground` | `label` |
| `color/surface/border` | `var(--outline)` | `outline` | `separator` |
| `color/primary/tint` | `var(--primary-container)` | `primaryContainer` | `primaryContainer` |
| `color/status/error` | `var(--error)` | `error` | `systemRed` |
| `Headline/LG/font-size` | `var(--headline-lg-font-size)` | `headlineLgFontSize` | `headlineLgFontSize` |
| `space/md` | `var(--space-md)` | `spaceMd` | `spaceMd` |

### tokens.css — Local Codebase File

`/create-design-system` writes a `tokens.css` file (default path `src/styles/tokens.css`) that mirrors the Figma variable structure as CSS custom properties:

- **Primitives block** — raw hex and px values in `:root`
- **Layout block** — semantic `--space-*` and `--radius-*` aliases in `:root`
- **Theme Light block** — 33 M3 semantic tokens in `:root, [data-theme="light"]` using `var(--color-*)` references, plus shadcn/ui compatibility aliases (`--foreground`, `--border`, `--destructive`, `--accent`, etc.) that point back to the M3 primary vars
- **Theme Dark block** — same structure in `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`
- **Typography base block** — all 48 properties at 100% scale in `:root`
- **Typography scale blocks** — 8 `[data-font-scale="N"]` blocks (85, 100, 110, 120, 130, 150, 175, 200) with only font-size and line-height overrides

Primary CSS var names use M3 role conventions (`--on-background`, `--outline`, `--primary-container`, `--error`, etc.). shadcn/ui names (`--foreground`, `--border`, `--destructive`, `--accent`, etc.) are alias vars that resolve to the M3 primaries, so shadcn components resolve correctly with no additional mapping.

Dark mode toggle: `data-theme="dark"` on `<html>`.  
Font scaling toggle: `data-font-scale="130"` (or any of the 8 scale values) on `<html>`.

### How `/create-design-system` uses this architecture

1. Agent prompts for brand colors (primary, secondary, neutral, tertiary, error), typefaces, and base spacing/radius values
2. Generates five color ramps via Tailwind HSL lightness interpolation
3. Writes all five collections to the target Figma file via the Variables REST API (`PUT` — not `use_figma`; `codeSyntax` must be set here)
4. Verifies the registry with a Variables GET, then writes `tokens.css` to the local codebase
5. Records `token_css_path` in `templates/agent-handoff.md` for downstream skills
6. Runs **`use_figma`** to draw or refresh **style guide** pages (`↳ Primitives`, `↳ Theme`, `↳ Layout`, `↳ Text Styles`, `↳ Effects`), the **`[MCP] Token Manifest`** on `↳ MCP Tokens`, **Token Overview** populated from live variables, and the **Thumbnail** `Cover` gradient from brand primaries + `setFileThumbnailNodeAsync`

### How `/new-project` prepares the Foundations file

1. **`create_new_file`** — new design file in Drafts
2. **`use_figma` Step 5** — full page list (Thumbnail, section dividers, style guide, brand, atoms, components, utilities)
3. **`use_figma` Step 5b** — `_Header` + `_Content` on every page **except** `Thumbnail` (cover-only meta page)
4. **`use_figma` Step 5c** — Table of Contents grid on `📝 Table of Contents` with `toc-link/{exact page name}` rows for agents
5. **`use_figma` Step 5d** — Token Overview skeleton on `↳ Token Overview` (`placeholder/*` nodes removed when `/create-design-system` runs)
6. **`use_figma` Step 5e** — `Cover` frame on `Thumbnail` and file thumbnail
7. **Step 6–7** — move instructions, optional chain to `/create-design-system` with handoff YAML

### How `/sync-design-system` updates canvas after a Figma push

When the designer pushes token changes **to Figma** (options 1, 3, or 4 with confirmed push), the skill also runs **`use_figma`** to **redraw affected style guide pages** (Step 9b) and **rebuild the MCP Tokens manifest** (Step 9c), using the same layout rules as `/create-design-system`. Pushes **to code only** (option 2) skip canvas redraws.

---

## 7. Template File Keys Reference

| Key Name | File Key | Used By | Purpose |
|---|---|---|---|
| `foundations` | `rJQsr4aou5yjzUhaEM0I2f` | `/new-project`, `/create-design-system` | Page structure source for scaffolding; token variable reference |

These keys are stored in `plugin/.claude/settings.local.json` under `template_file_keys`. Do not change these values unless the source template files in Figma have been replaced.

---

## User Guide

### Skill Invocation Reference

| Skill | Syntax | Arguments | Description |
|---|---|---|---|
| /new-project | `/new-project` | none (interactive) | Scaffolds a full DL Figma project with documentation canvas (headers, TOC, Token Overview skeleton, cover) |
| /create-design-system | `/create-design-system` | none | Creates five token collections, writes `tokens.css`, redraws style guide + MCP manifest + Token Overview + cover |
| /sync-design-system | `/sync-design-system` | none (interactive) | Diffs and syncs Figma variables with local tokens; redraws style pages + MCP manifest after pushes to Figma |
| /create-component | `/create-component [components...]` | components: shadcn component names | Installs components, wires tokens.css, draws to canvas |
| /code-connect | `/code-connect` | none | Finds and publishes missing Code Connect mappings |
| /new-language | `/new-language [locale] [node_id]` | locale: BCP 47 code, node_id: Figma node | Duplicates a frame for a new locale with inline translations |
| /accessibility-check | `/accessibility-check [node_id]` | node_id: Figma node | Runs WCAG AA + Dynamic Type + Android font scale audit |

---

### Typical Workflow

A complete new project setup runs the skills in this sequence:

1. `/new-project` → scaffolds the Foundations file with full page hierarchy, documentation headers, TOC, Token Overview skeleton, and Thumbnail cover in Figma
2. `/create-design-system` → collects brand tokens, writes five variable collections to Figma, writes `tokens.css` to the local codebase, then draws style guide + MCP manifest + updates Token Overview and cover
3. `/create-component button input card` → installs shadcn components, wires `tokens.css` into `globals.css`, draws components to canvas with token bindings
4. `/code-connect` → maps Figma components to code files, confirms with designer, publishes via `send_code_connect_mappings`
5. `/accessibility-check` → audits for WCAG 2.1 AA contrast, font size minimums, iOS Dynamic Type, and Android scaling before handoff

---

### Skill Chaining

Many skills offer to chain into the next skill automatically at completion:

- `/new-project` offers to run `/create-design-system` after the Foundations file is created
- `/create-design-system` offers to run `/create-component` after tokens are pushed and `tokens.css` is written
- `/create-component` offers to run `/code-connect` after drawing components to the canvas

When a skill prompts to chain, you can accept to continue the workflow without re-invoking the next command. All chained skills share session context via `templates/agent-handoff.md` (active file key, project name, token CSS path) — no information needs to be re-entered.
