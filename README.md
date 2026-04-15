# Detroit Labs DesignOps Plugin

A Claude Code plugin that gives Detroit Labs designers seven skill-based commands for automating Figma design operations — scaffolding projects, building design systems, syncing tokens, adding components, linking code, localizing screens, and running accessibility audits.

All skill logic lives in `SKILL.md` instruction files. There is no TypeScript code, no bundler, and no install script. Everything runs through the Claude Code agent using the Figma MCP connector for authentication.

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
- [Figma Project Structure](#figma-project-structure)
- [Plugin File Structure](#plugin-file-structure)
- [Contributing](#contributing)

---

## How It Works

Each skill is an instruction file (`SKILL.md`) that tells the Claude Code agent exactly how to perform a design ops task. When you invoke a skill, Claude reads the instructions and executes the steps using:

- **Figma MCP connector** — all Figma file creation, canvas writes (pages, frames, variables, components), Code Connect, and read operations
- **Figma REST API** — variable write-back for `/create-design-system` and `/sync-design-system`
- **Filesystem access** — reading local token files (`tokens.json`, `tailwind.config.js`) for sync operations
- **Claude's built-in capabilities** — inline translation for localization, WCAG contrast calculations for accessibility

Skills pass context to each other through `templates/agent-handoff.md`, so you can chain `/new-project` → `/create-design-system` → `/create-component` → `/code-connect` without losing your place.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Claude Code** | CLI or desktop app — this is a Claude Code plugin, not a Figma plugin |
| **Figma MCP connector** | Must be active in Claude Code (Settings → MCP → Figma). Handles all Figma authentication — no personal access token needed for `/new-project` |
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

---

## Skills

### /new-project

Create and scaffold a `<Project Name> — Foundations` design system file using the Figma MCP connector. The file is created in Drafts, page structure is built automatically, and a single move instruction is provided at the end.

**Syntax**
```
/new-project
/new-project --team "Team Name" --name "Project Name" --platform web|android|ios|all|skip
```

**Arguments** (all optional — prompted interactively if omitted)

| Argument | Description |
|---|---|
| `--team` | Figma team display name — used in file titles |
| `--name` | Project name — appears in the file title |
| `--platform` | `web`, `android`, `ios`, `all`, or `skip` — determines which platform alias collections `/create-design-system` will generate when chained |

**What it creates**

| File | Target Folder | Method |
|---|---|---|
| `<Project Name> — Foundations` | `Design-Systems/` | Created via MCP `create_new_file`, pages scaffolded via `use_figma` |

The file lands in Drafts. At the end of the run Claude provides a one-step move instruction: right-click the file in Figma → Move to Project → Design-Systems/.

**Page hierarchy** — sourced from the Detroit Labs Foundations template and extended with shadcn/ui component pages, organized into atomic design groups:

- Token & Style Docs (Table of Contents, Token Overview, MCP Tokens)
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

After creating and scaffolding the file, Claude offers to chain into `/create-design-system`.

**File naming convention:** All titles use an em dash (`—`) with a space on each side: `<Project Name> — <File Type>`

---

### /create-design-system

Initialize a design system in a Figma file by pushing brand tokens into the `Primitives` variable collection and the appropriate platform alias collection.

**Syntax**
```
/create-design-system
/create-design-system web
/create-design-system android
/create-design-system ios
/create-design-system all
```

**Arguments**

| Argument | Description |
|---|---|
| `web` / `android` / `ios` | Target platform for the alias token collection (`Web`, `Android/M3`, or `iOS/HIG`). Prompted interactively if omitted. |
| `all` | Same file and token inputs; runs the web, android, and ios alias passes sequentially (shared `Primitives`). |

**What it does**

1. Checks `templates/agent-handoff.md` for an active file key before prompting for one
2. Collects brand tokens via interactive prompts (the skill instructs the agent to use **AskUserQuestion** one question at a time — primary color, secondary color, neutral color, body font, display font, base font size (default 16px), base spacing unit (default 4px), and border radius (default 4px))
3. Generates the `Primitives` collection: full color ramps (50–900 steps via Tailwind HSL interpolation), `Space/*`, `Corner/*`, `Typography/*`, `Shadow/*`
4. Creates or updates the platform alias collection:
   - **Web** → `Web` collection with `var(--*)` CSS custom property pattern
   - **Android** → `Android/M3` collection with `md/sys/*` Material 3 role naming
   - **iOS** → `iOS/HIG` collection with `ios/*` Apple HIG naming
5. Writes all variable collections to Figma via the Variables REST API
6. Verifies the write with a GET call and reports the final variable counts

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

- `tokens.json` — W3C Design Token Community Group (DTCG) format
- `tailwind.config.js` — Tailwind CSS configuration
- CSS custom properties (`:root { --color-primary: ... }`)

**What it does**

1. Reads the local token file from the filesystem
2. Reads the current Figma variable state via `GET /v1/files/:key/variables/local`
3. Computes a three-way diff: NEW (in code, not in Figma), MISSING (in Figma, not in code), CONFLICTS (different values)
4. Presents the diff to the designer and asks which action to take:
   - **Push to Figma** — write local token values to Figma variables
   - **Push to code** — write Figma variable values back to the local token file
   - **Push both** — sync in both directions (only available when there are no conflicts)
   - **Review manually** — show the full diff without making any changes

---

### /create-component

Install one or more shadcn/ui components via the shadcn CLI, draw the component structure onto the Figma canvas, and bind token variables.

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

1. Installs each component locally using `npx shadcn@latest add <component>`
2. Checks for an active Figma file in `agent-handoff.md` or prompts for a file key
3. Draws the component structure on the Figma canvas using Figma MCP write tools
4. Applies token variable bindings from the active design system
5. Offers to chain into `/code-connect` to link the new components to their code counterparts

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

1. Calls `get_code_connect_suggestions` to list components that have no current mapping
2. Calls `get_context_for_code_connect` for each unmapped component to gather props and variants
3. Generates Code Connect mapping configurations
4. Presents all proposed mappings to the designer for review
5. Publishes confirmed mappings via `send_code_connect_mappings`

**Important:** Claude will never publish Code Connect mappings without explicit designer confirmation.

**CLI fallback:** If the MCP path is unavailable, the `@figma/code-connect` CLI can be used manually with a PAT that has the `code_connect:write` scope.

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

1. Parses `locale` from the first argument token and `node_id` from a token matching `\d+:\d+`
2. Duplicates the selected frame to a new Figma page named for the locale (e.g. `es`, `fr`)
3. Extracts all text node strings from the duplicated frame
4. Translates all strings inline using Claude — no external translation API required
5. Writes translated strings back to the cloned text nodes via Figma MCP

**RTL warning:** For right-to-left locales (`ar`, `fa`, `he`, `ur`), Claude displays a prominent warning that the layout needs to be mirrored manually. RTL layout mirroring is not automatic.

**Supported locale examples:** `es` (Spanish), `fr` (French), `de` (German), `pt` (Portuguese), `ja` (Japanese), `ko` (Korean), `zh` (Chinese), `ar` (Arabic — RTL), `he` (Hebrew — RTL)

---

### /accessibility-check

Run a WCAG 2.1 AA accessibility audit on a selected Figma frame, including contrast ratios, minimum text sizes, iOS Dynamic Type simulation, and Android font scaling simulation.

**Syntax**
```
/accessibility-check
/accessibility-check 123:456
```

**Arguments**

| Argument | Description |
|---|---|
| `node_id` | Figma node ID of the frame to audit (e.g. `123:456`). Prompted interactively if omitted. |

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

A complete project setup from scratch through production-ready components:

```
# 1. Scaffold the Foundations design system file
/new-project --team "Client Team" --name "Acme Mobile App" --platform web

# 2. Populate the Foundations file with brand tokens
#    (can be chained automatically from /new-project, or run separately)
/create-design-system web

# 3. Sync if you have an existing token file in code
/sync-design-system

# 4. Add components to the Figma canvas
/create-component button input card dialog

# 5. Link components to their code counterparts
/code-connect

# 6. Create a Spanish localization of a screen
/new-language es 123:456

# 7. Run an accessibility audit before handoff
/accessibility-check 123:456
```

---

## Skill Chaining & Handoff Context

Skills pass context to each other through `templates/agent-handoff.md`. This file stores the current active Figma file, project name, and last skill run so that subsequent skills can pick up without being prompted for the same information again.

**Frontmatter fields:**

| Field | Description |
|---|---|
| `active_file_key` | The Figma file key currently being worked on |
| `active_project_name` | The project name as it appears in the Figma team space |
| `last_skill_run` | The last skill that was executed |
| `variable_slot_catalog_path` | Path to the variable slot catalog (populated after `/create-design-system`) |
| `open_items` | Notes and unresolved items for the next skill to address |

**To pass context manually**, include the handoff file in your prompt:

```
/create-design-system web
Context: see templates/agent-handoff.md
```

Skills that accept a `file_key` argument always check `active_file_key` in the handoff first before prompting.

---

## Token Architecture

The design system uses a two-layer Figma variable architecture:

```
Primitives collection
  ├── color/primary/50 → #EFF6FF
  ├── color/primary/500 → #3B82F6
  ├── color/primary/900 → #1E3A8A
  ├── color/neutral/50 → #F9FAFB
  ├── Space/100 → 4
  ├── Space/200 → 8
  ├── Corner/sm → 4
  └── Typography/body → 16

Platform alias collections (reference Primitives)
  ├── Web        → var(--color-primary), var(--space-100), ...
  ├── Android/M3 → md/sys/color/primary, md/sys/color/surface, ...
  └── iOS/HIG    → ios/color/primary, ios/spacing/base, ...
```

Color ramps are generated using Tailwind HSL interpolation (50–900 steps). The `Primitives` collection holds raw scale values; platform alias collections reference those slots for semantic role mapping. All three platform collections can coexist in the same Figma file.

---

## Figma Project Structure

Detroit Labs projects use a standardized three-folder hierarchy within each Figma team:

```
<Team Name>
  └── Design-Systems/
        └── <Project Name> — Foundations         (Design — created and page-scaffolded by /new-project)
```

`/new-project` currently scaffolds the Foundations file only. The file is created in Drafts via the Figma MCP and moved into the Design-Systems/ folder manually using Figma's right-click → Move to Project UI. Figma's public REST API does not expose a file placement endpoint, so programmatic folder placement is not possible.

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
│     ├── new-project/SKILL.md
│     ├── create-design-system/SKILL.md
│     ├── sync-design-system/SKILL.md
│     ├── create-component/SKILL.md
│     ├── code-connect/SKILL.md
│     ├── new-language/SKILL.md
│     └── accessibility-check/SKILL.md
├── templates/
│     ├── agent-handoff.md           # Skill-to-skill context transfer template
│     └── workflow.md                # Plugin-level agent context and conventions
└── README.md
```

**`settings.local.json` defaults:**

| Setting | Default | Description |
|---|---|---|
| `figma_mcp` | `"connector"` | Authentication method — always `connector` for this plugin |
| `token_schema_path` | `"tokens.json"` | Local token file path for `/sync-design-system` |
| `preferred_platform` | `"web"` | Default platform if not specified in skill arguments |
| `template_file_keys` | See below | Figma file keys for all four template sources |

**Template file keys** (configured in `settings.local.json`):

| Template | Key |
|---|---|
| Foundations Agent Kit | `rJQsr4aou5yjzUhaEM0I2f` |

The Workshop, Summary, and Master File keys (`hnCK8gpGtxzBoBakRX8QLn`, `8YBZtQLCnt7sbmlCKpMO1Y`, `C9C0XpIdj1WS3klOugVzGM`) are retained in `settings.local.json` for future use.

---

## Contributing

This plugin is distributed internally via this Git repository. To add or modify a skill:

1. Edit the corresponding `skills/<skill-name>/SKILL.md` file — the instructions are plain Markdown, no compilation required
2. If adding a new skill, add an entry to `.claude-plugin/plugin.json` with the skill `name`, `description`, `path`, and `arguments` schema
3. Update `templates/workflow.md` if the change affects plugin-wide conventions
4. Test with a live Figma file using the Figma MCP connector before committing

All Figma operations require the Figma MCP connector to be active and authenticated with an Organization-tier account. The Variables REST API write endpoint (`PUT /v1/files/:key/variables`) is the most common source of plan-tier errors — verify your account tier if `/create-design-system` or `/sync-design-system` fails with a `403`.
