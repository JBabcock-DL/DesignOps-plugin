# DesignOps Plugin — Workflow Reference

## 1. Plugin Overview

The DesignOps Plugin is a set of Claude Code skill instruction files (SKILL.md) that enable Detroit Labs designers to run repeatable Figma design operations from the command line via Claude Code. There is no TypeScript code to compile, no install script to run, and no Figma sandbox involved — every skill is a plain-language instruction document that tells the Claude agent what steps to take.

**Who it is for:** Detroit Labs designers who work in Figma and want to automate recurring setup and maintenance tasks (project scaffolding, design system creation, token sync, component building, localization, and accessibility auditing) without leaving their terminal or switching to manual Figma workflows.

**How it works:**
1. The designer invokes a skill command in Claude Code (e.g. `/new-project`).
2. Claude Code loads the corresponding SKILL.md from `plugin/skills/<skill-name>/`.
3. The agent follows the SKILL.md instructions, calling Figma MCP tools (`mcp__claude_ai_Figma__*`) and reading the local filesystem as needed.
4. The agent reports results (created file links, diff summaries, audit reports) back to the designer inline.

---

## 2. Prerequisites

| Requirement | Notes |
|---|---|
| Claude Code (latest) | Install via `npm install -g @anthropic-ai/claude-code` |
| Figma MCP connector | Configured inside Claude Code — handles all Figma authentication for file creation and canvas operations. |
| Organization-tier Figma account | Required for the Figma Variables REST API write endpoint used by `/create-design-system` and `/sync-design-system`. |
| Git clone of this repo | Plugin files must be present locally so Claude Code can read SKILL.md files. |

**No PAT or environment variable is needed for `/new-project`.** File creation and page scaffolding use the Figma MCP connector exclusively. Other skills that call the Variables REST API (`/create-design-system`, `/sync-design-system`) also use the MCP connector's OAuth session.

---

## 3. Skill Overview

| Skill | Invocation | Description | Required Arguments |
|---|---|---|---|
| New Project | `/new-project` | Creates a `<Project Name> — Foundations` design file via the Figma MCP, scaffolds the full Detroit Labs page hierarchy (tokens, style guide, brand, atoms, all component groups), and provides a single bulk move instruction to place the file in the team's Design-Systems/ folder. | None (agent prompts interactively) |
| Create Design System | `/create-design-system` | Pushes brand tokens into the Primitives variable collection and the target platform alias collection in a Figma file. | `platform` — `web`, `android`, `ios`, or `all` |
| Sync Design System | `/sync-design-system` | Diffs a local token file against live Figma variable state and pushes changes in either direction. | None (reads `tokens.json` by default; path configurable in settings) |
| Create Component | `/create-component` | Installs shadcn/ui components locally, draws structure to the Figma canvas, binds token variables, and optionally links Code Connect. | `components` — list of shadcn component names |
| Code Connect | `/code-connect` | Maps Figma components to codebase counterparts using Figma Code Connect and publishes the mappings. | None |
| New Language | `/new-language` | Localizes a Figma frame into a new language by duplicating it, translating text inline via Claude, and writing strings back. | `locale` — BCP 47 code (e.g. `es`, `fr`, `ar`) |
| Accessibility Check | `/accessibility-check` | Runs a WCAG 2.1 AA audit: contrast ratios, text size minimums, iOS Dynamic Type simulation, Android font scaling simulation. | None |

---

## 4. Figma MCP Usage Conventions

All Figma operations in this plugin go through the official Figma MCP server (`mcp__claude_ai_Figma__*`). The connector is authenticated once at the Claude Code level — individual skills do not re-authenticate.

**Key MCP tools used across skills:**

| MCP Tool | Used By | Purpose |
|---|---|---|
| `create_new_file` | `/new-project` | Create blank Figma design files in Drafts |
| `get_metadata` | `/create-design-system` | Read team and project metadata before writes |
| `get_variable_defs` | `/create-design-system`, `/sync-design-system` | Read current variable collection state from a Figma file |
| `use_figma` | `/new-project`, `/create-design-system`, `/sync-design-system`, `/create-component`, `/new-language`, `/accessibility-check` | General-purpose Figma write/read operations (scaffold pages, create frames, update variables, write text nodes) |
| `get_code_connect_suggestions` | `/code-connect` | List Figma components not yet mapped to code |
| `get_context_for_code_connect` | `/code-connect` | Retrieve component context needed to generate a mapping |
| `send_code_connect_mappings` | `/code-connect` | Publish finalized Code Connect mappings |
| `get_design_context` | `/accessibility-check`, `/create-component` | Read frame/node layout and style data for processing |
| `get_screenshot` | `/accessibility-check` | Capture rendered frame for visual diff |

**Auth notes:**
- All MCP calls are authenticated by the Figma MCP connector configured in Claude Code. No per-skill token injection is needed.
- The connector requires an Organization-tier Figma account for write operations on variable collections.
- If a skill encounters an auth error, the designer should re-authenticate the Figma MCP connector in Claude Code settings before retrying.

---

## 5. Detroit Labs Figma Project Structure

The Detroit Labs standard folder hierarchy is below. `/new-project` currently scaffolds the Foundations file only — additional file types will be added to the skill in future iterations.

```
<Team Space>/
  Design-Systems/
    <ProjectName> — Foundations     (Design file, created via MCP + page-scaffolded)
```

**Folder naming convention:** Folders use title case. File names follow the pattern `<ProjectName> — <FileType>` (em dash, not hyphen).

**File placement:** `/new-project` creates files in Drafts via `create_new_file` and scaffolds pages via `use_figma`. The designer moves the file to the correct project folder using Figma's right-click → Move to Project UI. The Figma REST API does not expose a public endpoint for programmatic file placement.

**Foundations template reference** (used to source the page hierarchy — not cloned at runtime):

| Template | File Key | Figma File Type |
|---|---|---|
| Foundations / Agent Kit | `rJQsr4aou5yjzUhaEM0I2f` | Design |

---

## 6. Token Architecture

Detroit Labs design systems use a two-layer token architecture implemented as Figma variable collections.

### Layer 1 — Primitives Collection

Raw, platform-agnostic values derived from the Tailwind CSS default scale. Every token in alias collections ultimately resolves to a Primitive.

Categories: `color`, `spacing`, `typography/font-size`, `typography/font-weight`, `typography/line-height`, `border-radius`, `shadow`, `z-index`

### Layer 2 — Platform Alias Collections

Semantic tokens that alias Primitives (or override them) for a specific platform's design conventions.

| Collection | Platform | Design Convention |
|---|---|---|
| `Web` | Web / React | Tailwind-derived semantic tokens (e.g. `color/surface`, `color/on-surface`) |
| `Android/M3` | Android | Material Design 3 role names (e.g. `md.sys.color.surface`, `md.sys.color.on-surface`) |
| `iOS/HIG` | iOS / SwiftUI | Apple Human Interface Guidelines semantic tokens (e.g. `systemBackground`, `label`) |

**How `/create-design-system` uses this architecture:**
1. Agent prompts for brand colors, typefaces, and spacing overrides.
2. Agent writes raw values into the `Primitives` collection.
3. Based on the `platform` argument, agent generates the corresponding alias collection (`Web`, `Android/M3`, or `iOS/HIG`) with semantic aliases pointing back to Primitives.
4. All collections are written to the target Figma file via the Figma Variables REST API.

---

## 7. Template File Keys Reference

| Key Name | File Key | Used By | Purpose |
|---|---|---|---|
| `foundations` | `rJQsr4aou5yjzUhaEM0I2f` | `/new-project`, `/create-design-system` | Page structure source for scaffolding; token variable reference |

The Workshop, Summary, and Master File keys are retained in `settings.local.json` for future use when those file types are added back to `/new-project`. They are not used at runtime today.

These keys are stored in `plugin/.claude/settings.local.json` under `template_file_keys`. Do not change these values unless the source template files in Figma have been replaced.

---

## User Guide

### Skill Invocation Reference

| Skill | Syntax | Arguments | Description |
|---|---|---|---|
| /new-project | `/new-project` | none (interactive) | Scaffolds a full DL Figma project |
| /create-design-system | `/create-design-system [platform]` | platform: web\|android\|ios\|all | Creates token collections in a Foundations file |
| /sync-design-system | `/sync-design-system` | none (interactive) | Diffs and syncs Figma variables with local tokens |
| /create-component | `/create-component [components...]` | components: shadcn component names | Installs shadcn components and draws them to canvas |
| /code-connect | `/code-connect` | none | Finds and publishes missing Code Connect mappings |
| /new-language | `/new-language [locale]` | locale: BCP 47 code (e.g. es, fr, ar) | Duplicates a frame for a new locale with translations |
| /accessibility-check | `/accessibility-check` | none (interactive) | Runs WCAG AA + Dynamic Type + Android font scale audit |

---

### Prerequisites

- Claude Code installed and configured
- Figma MCP connector configured in Claude Code (handles all Figma auth — no PAT needed)
- Organization-tier Figma account (required for REST Variables API write operations)
- For `/create-component`: a shadcn-compatible project (Next.js, Vite, Remix, etc.)
- For `/sync-design-system`: a local token file (`tokens.json` or `tailwind.config.js`)

---

### Typical Workflow

A complete new project setup runs the skills in this sequence:

1. Run `/new-project` → scaffolds all Figma files (Workshop, Summary, Foundations, Master Files) into the correct team folder hierarchy
2. Run `/create-design-system web` (or `/create-design-system all` for Web + Android/M3 + iOS/HIG aliases on the same file) → collects brand colors, typefaces, and spacing, then populates the Foundations file with Primitives and the platform alias collection(s)
3. Run `/create-component button input card` → installs the listed shadcn/ui components locally and draws them onto the Figma canvas with token variable bindings
4. Run `/code-connect` → lists unmapped Figma components, generates Code Connect mappings, confirms with the designer, and publishes via `send_code_connect_mappings`
5. Run `/accessibility-check` → audits the selected frame for WCAG 2.1 AA contrast, font size minimums, iOS Dynamic Type, and Android font scaling before handoff

---

### Skill Chaining

Many skills offer to chain into the next skill automatically at completion. For example:

- `/new-project` offers to run `/create-design-system` immediately after the four Figma files are created.
- `/create-component` offers to run `/code-connect` after drawing components to the canvas.

When a skill prompts to chain, you can accept to continue the workflow without re-invoking the next command manually. All chained skills share the same session context (active file key, project name) so you do not need to re-enter that information.
