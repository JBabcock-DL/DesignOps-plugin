---
name: create-component
description: Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.
argument-hint: "[component...] — e.g. /create-component button input card. If omitted, the agent shows the full component list and prompts."
agent: general-purpose
---

# Skill: /create-component

Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.

> **Before you draw anything, read** [`conventions/00-overview.md`](./conventions/00-overview.md) — the entry point to the topic-scoped convention shards (auto-layout enums, doc pipeline, code-connect, audit checklist) that agents (Sonnet, Haiku, future Claude versions) can load to match the house style on the first pass. The shards document canvas geometry, the matrix-default layout, the properties table, state / variant / size axes, the `Doc/*` text styles, and the audit checklist. Every rule in this SKILL should round-trip with those files; if they ever disagree, **this SKILL is authoritative** and the matching `conventions/*.md` shard must be updated. The legacy [`CONVENTIONS.md`](./CONVENTIONS.md) is now a thin router / legacy section-ID map — follow its links to the shard.

---

## §0 — Quickstart recipe for any agent

> **This section is the single canonical recipe.** Any agent (Opus, Sonnet, Haiku, future Claude) opening this skill cold can follow §0 end-to-end without reading the rest of the document first. Deeper context lives in the numbered sections linked below. If §0 and a deeper section ever disagree, §0 is authoritative.

**Outcome:** for each requested component, one ComponentSet drawn into its target `↳ {Page}`, wrapped in a documentation frame (header → properties table → inline ComponentSet → Variant × State matrix → Usage Do/Don't), with element component properties unified at the ComponentSet level (`Label`, `Leading icon`, `Trailing icon`), bound to the user's Theme/Layout/Typography variables.

**Tools you will use:** `AskUserQuestion`, `Shell` (for `npx shadcn@latest` + file reads), `Read` / `Glob` / `Grep`, `use_figma` (one call per component), `get_screenshot` (final visual check).

**MCP payloads:** Each `use_figma` invocation must pass its Plugin API script **inline** in the tool’s `code` field (built from this SKILL + committed `templates/*.figma.js` where referenced). Do **not** add throwaway `.mcp-*` / `*-payload.json` / scratch copies under the repo to stage that script — see [`AGENTS.md`](../../AGENTS.md).

**🚨 Script-assembly order for Step 6 (`use_figma`):** The `code` payload MUST be assembled in this exact order or the run throws at `draw-engine.figma.js §6.2a`:

1. **§0 CONFIG object** — the per-component block below (the only per-component edit surface).
2. **`Read` and inline [`templates/create-component-engine.min.figma.js`](./templates/create-component-engine.min.figma.js) verbatim** — the **pre-bundled** engine: draw-engine top half (§§1–5.7), all seven archetype builders hoisted, draw-engine bottom half (§6.0 clear-page through §6.9a self-check). Paste immediately after the §0 CONFIG. This single file replaces the previous two-file inline (`draw-engine.min.figma.js` + `archetype-builders.min.figma.js`) — the build script splits draw-engine at the insertion marker and emits the correct ordering so agents don't have to find a split point inside already-minified output.
3. No further wrapping — §6.9a self-check is at the tail of the bundle and `return`s the payload.

The previous two-file workflow is **deprecated and broken**: minification strips the `↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` comment marker, so there is no reliable way to find where to splice `archetype-builders.min.figma.js` into `draw-engine.min.figma.js` at agent runtime. The two standalone `.min` files are retained only as debugging artifacts and for the chip-only fast path (Button, Badge, Toggle, Kbd, Switch) — but even for chip, the bundle works identically and uses only ~3 KB more than the standalone. **Always inline the bundle.**

Two runtime `typeof` asserts near the tail of the bundle (one for archetype builders, one for draw-engine functions) throw with actionable messages if the bundle was truncated mid-paste. The asserts name every required function (`buildSurfaceStackVariant`, `buildPropertiesTable`, etc.) — minification preserves identifier names, so the bundle satisfies the asserts identically to the source files. If you only see `CONFIG` in this SKILL (because your `Read` truncated the file), assume Step 2 is missing. Re-`Read` `templates/create-component-engine.min.figma.js` explicitly by path — do not trust a truncated SKILL.md.

> **Regenerating `.min` files.** Run `npm run build:min` after editing either source template (`draw-engine.figma.js` or `archetype-builders.figma.js`). The build emits three artifacts: the two standalones **and** the bundle. `scripts/verify-cache.sh` refuses to pass if any source is newer than any of its generated outputs. CI gate: `npm run verify` (runs `build:docs:check`, `build:min:check`, `verify-cache`).

**Nine steps. Do not skip any.**

| # | Step | Tool | Required inputs | Expected outcome |
|---|------|------|-----------------|------------------|
| 1 | Resolve component list | `AskUserQuestion` (if missing) | argument-hint list or designer reply | `components: string[]` of kebab-case shadcn names (`button`, `input`, …) |
| 2 | Locate `tokens.css` | `Read` / `Glob` | repo path | `TOKEN_CSS_PATH: string \| null` — absolute path or `null` if designer skipped |
| 3 | Initialize shadcn + wire tokens | `Shell` + `AskUserQuestion` | `components.json` presence check | `components.json` exists, `tokens.css` imported at top of `globals.css`, variable-declaration blocks removed |
| 3b | Icon-pack bootstrap (first-time-only) | `Read` (probe) → `AskUserQuestion` (only if missing) | `designops.config.json` presence check | `ICON_PACK: { npm, import, figmaIconLibraryKey, defaultIconRef } \| null` — persisted to `designops.config.json`; skipped silently on subsequent runs. Prompts accept Figma URLs, node-ids, or component keys — parser classifies the paste, `draw-engine.figma.js §5.6` resolves at draw time. |
| 4 | Install each component | `Shell` | `npx shadcn@latest add {component}` + `npm install {ICON_PACK.npm}` (when set, first run only) | Files written under `components/ui/`, per-component status `installed \| already_exists \| failed`; icon-pack dependency present in `package.json` |
| 4.4 | Icon-pack import rewrite (global) | `Read` / `StrReplace` (AST preferred) | `ICON_PACK.choice` + installed source files | `from 'lucide-react'` imports + JSX identifiers rewritten to match Step 3b choice (material-symbols mapped, custom specifier-swapped, lucide-react / none = no-op); pinned comment added for idempotence |
| 5 | Resolve Figma file key | handoff lookup → `AskUserQuestion` fallback | `templates/agent-handoff.md` frontmatter | `fileKey: string` |
| 6 | Draw component → Figma | `use_figma` (one call per component) | `fileKey`, `CONFIG` block per §6, optional `ICON_PACK.figmaIconLibraryKey` + `ICON_PACK.defaultIconRef` | Return payload with `{ compSetId, compSetVariants, compSetPropertyDefinitions, firstVariantChildren, iconVariantChildren, propErrorsCount, iconSlotMode: "placeholder" \| "instance-swap", iconPackResolution: "by-key" \| "by-node-id" \| "failed:*", … }` |
| 7 | Self-check the return payload | agent-side assertions per §9 | step 6's return JSON | Zero drift; if any assertion fails, stop and report — do not mark the component done |

### §0.1 — Decision tree for edge cases

- **No components provided** → step 1 prompts with the full supported list (see the routing table in §6).
- **`tokens.css` not found** → step 2 prompts; reply `skip` sets `TOKEN_CSS_PATH = null` and canvas uses hex fallbacks.
- **shadcn not initialized** → step 3 prompts to run `npx shadcn@latest init`; if declined, stop the skill.
- **`designops.config.json` already has an `iconPack` block** → step 3b is silent; `ICON_PACK` is read from disk and reused. Designer can edit the file by hand or pass `--re-ask-icon-pack` to force re-prompt.
- **`designops.config.json` missing or has no `iconPack` block** → step 3b prompts once; choice is written back so future runs skip this step.
- **Designer chose `none` for icon pack** → step 3b writes `{ "iconPack": { "choice": "none" } }` and subsequent runs treat it as done. Figma keeps empty 24×24 placeholder slots; no npm install. Step 4.4 **keeps** lucide-react imports but emits a build-time warning per installed file — shadcn components will fail to resolve icons until designer re-runs `/create-component --re-ask-icon-pack`.
- **Icon-pack choice ≠ lucide-react / none** → step 4.4 rewrites `from 'lucide-react'` imports + JSX usage sites per the dispatch table (material-symbols mapped, custom specifier-swapped). Unmapped specifiers stay on lucide-react with a warning; pinned comment makes the rewrite idempotent.
- **Designer re-ran with `--re-ask-icon-pack` and picked a different pack** → step 4.4 detects the mismatch via the pinned comment and prompts before re-rewriting; `keep-current` leaves existing imports alone for this component.
- **`iconPack.defaultIconRef` missing OR `kind === 'unknown'` OR resolution fails at `draw-engine.figma.js §5.6`** → step 6 skips INSTANCE_SWAP wiring and uses empty 24×24 dashed placeholders. Run report includes `iconPackResolution: "failed:<reason>"` (e.g. `failed:cross-file-needs-key`, `failed:node-not-found:417:9815`, `failed:url-missing-node-id`) so the designer knows exactly how to fix the config.
- **Designer pasted a URL for the default icon** → `draw-engine.figma.js §5.6` extracts the node-id and calls `getNodeByIdAsync` IF the URL's fileKey matches the active file; falls back to `failed:cross-file-needs-key` if it's a published-library URL from a different file. Recovery is to re-run with `--re-ask-icon-pack` and paste a component key (40-hex hash) instead of a URL — the parser accepts either.
- **`figma.fileKey !== ACTIVE_FILE_KEY` at draw time (registry gate)** → **warning only, never a throw.** `figma.fileKey` is unreliable across branch files, shared-library contexts, duplicated files, and some plugin execution contexts — a hard throw here blocks legitimate draws. The template's §5 gate now logs a `console.warn` and continues; the mismatch is surfaced in the return payload as `fileKeyMismatch: { expected, observed }` so the agent can include it in the run report. If registry-bound composes genuinely can't resolve, the downstream "no composes resolved" error will surface the real problem. **Do not** author agent-side scripts that re-introduce the throw.
- **Component install fails** → log, mark `failed`, **continue** to the next component.
- **`use_figma` throws** → **stop**, do not retry. Read the error, fix the CONFIG or the template, then resubmit one component at a time.

### §0.2 — Return payload assertions (abbreviated §9)

After step 6, the agent must verify the return JSON contains (values are required, not suggested):

```text
compSetName             === `${CONFIG.title} — ComponentSet`
compSetVariants.length  === CONFIG.variants.length × max(CONFIG.sizes.length, 1)
compSetPropertyDefinitions includes
  - "Label"         of type "TEXT"    (when CONFIG.componentProps.label)
  - "Leading icon"  of type "BOOLEAN" (when CONFIG.componentProps.leadingIcon)
  - "Trailing icon" of type "BOOLEAN" (when CONFIG.componentProps.trailingIcon)
firstVariantChildren    contains "icon-slot/leading", text, "icon-slot/trailing" in order
iconVariantChildren     contains exactly one "icon-slot/center"  (when icon-only size is declared)
propErrorsCount         === 0
```

If any row fails → surface the failure verbatim in the run report and do NOT claim the component "drawn". See §9 for the full self-check.

### §0.3 — Deep-section map

| Topic | Section |
|-------|---------|
| Interactive prompts | §1 Interactive input contract |
| Shadcn init + token wiring | §3 / §3a |
| Icon-pack bootstrap (first-time-only) | §3b |
| Install per component | §4 |
| Icon-pack import rewrite (lucide → chosen pack) | §4.4 |
| File-key resolution | §5 |
| The `use_figma` template (CONFIG + draw engine) | §6 |
| Reporting table | §8 |
| Self-check before reporting "drawn" | §9 |
| Icon slots + element properties spec | [`conventions/01-config-schema.md` §3.3](./conventions/01-config-schema.md) |
| State override policy | [`conventions/04-doc-pipeline-contract.md` §13.1](./conventions/04-doc-pipeline-contract.md) |
| Audit checklist | [`conventions/06-audit-checklist.md` §14](./conventions/06-audit-checklist.md) |

---

## Interactive input contract

When this skill needs designer input (component list, Figma file key, shadcn init choices, optional `/code-connect` chaining), use **AskUserQuestion** — **one question per tool call**, wait for each reply before the next. Do not dump multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **shadcn-compatible project** — Next.js, Vite, Remix, or any React framework supported by shadcn/ui. The project must have a `package.json` at its root.
- **`/create-design-system` run first** — Token variable bindings in Figma come from the `Theme`, `Layout`, and `Typography` collections. The CSS token file (`tokens.css`) written by `/create-design-system` must also exist in the local project — this is what components import for their CSS custom properties. If the file is absent, components are drawn to canvas with hardcoded fallback values and a warning is reported.
- **Active Figma file open** — The agent needs a target Figma file key. This is taken from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Figma MCP connector authenticated** — All canvas writes use `mcp__claude_ai_Figma__*` tools. No separate PAT setup required.
- **`use_figma` discipline** — Load **figma-use** before every `use_figma` call (workspace / connector rule). Prefer **editing the committed §6 template** over reauthoring layout from memory; component doc pages share the same **resize / Hug / `textAutoResize`** footguns as style-guide tables — see **create-design-system `SKILL.md` §0.1–§0.2** and [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md).

---

## Agent Instructions

### Step 1 — Resolve component list

Accept a list of shadcn/ui component names as the skill argument (e.g. `/create-component button input card dialog`).

- If one or more component names are provided, proceed to Step 2 with that list.
- If no components are provided, show the supported component list (see below), then call **AskUserQuestion**: "Which shadcn/ui components should I install? Enter one or more names separated by spaces."

> **Scoped sync entry point.** When invoked as `/create-component --components=<comma-separated-list>` (e.g. `/create-component --components=button,badge`), treat `--components` as the authoritative component list and skip the prompt above. This is the entry point used by `/sync-design-system` Axis B C-wins (Step 8.C) to redraw only the ComponentSets that have drifted without touching the rest of the canvas. In this mode, still run Steps 2–6 for the named subset only (same Mode A / Mode B decision tree); the rest of the installed library is untouched.

> **Migration entry point (Phase 6).** When invoked as `/create-component --migrate-to-instances [component ...] [--migrate-strategy=in-place|dual-page]`:
>
> - **Requires** an explicit component list (one or more composites that already declare `composes[]` in `shadcn-props.json`).
> - **Strategy `in-place` (default):** run Steps 2–5 and Step 4.5 (Mode A CONFIG required). **Skip** the default full-page §6 draw. Instead run the **§6.M** pre-migration audit, designer confirmation, then **one `use_figma`** using [`templates/migrate-composed-variants.figma.js`](./templates/migrate-composed-variants.figma.js) with `CONFIG`, `REGISTRY_COMPONENTS`, and `MIGRATE_COMP_SET_ID` injected. Rewrites **variant master `COMPONENT` nodes** inside the existing `COMPONENT_SET` so matrix instances update in place; `nodeId` stays stable.
> - **Strategy `dual-page`:** if audit detects the ComponentSet is on the wrong page or rename would collide, create `↳ {PageName} (v2)` per plan §7.2, add a deprecation note on the old page, and run the **full** §6 template on the v2 page (fresh draw) instead of §6.M.
> - After success: merge registry via Step 5.2 / [`resolver/merge-registry.mjs`](./resolver/merge-registry.mjs) (include updated `composedChildVersions` from the draw payload pattern in §6 return).
- Validate each provided name against the supported component list. For any unrecognized name, call **AskUserQuestion**: "'{name}' is not a recognized shadcn/ui component. Skip it, or reply **try anyway** to attempt installation?"

### Step 2 — Locate the CSS token file

Before touching shadcn, locate the `tokens.css` file written by `/create-design-system`.

1. Check `plugin/templates/agent-handoff.md` for a `token_css_path` field. If set and the file exists, use it.
2. Otherwise search the project for any file named `tokens.css` under `src/` or `app/`.
3. If still not found, call **AskUserQuestion**: "I couldn't find `tokens.css`. Paste the path to the token CSS file generated by `/create-design-system`, or reply **skip** to use shadcn's default variables instead." If the designer replies **skip**, set `TOKEN_CSS_PATH = null` and continue — all Figma canvas bindings will still apply, but the CSS won't be wired.

Store the resolved path as `TOKEN_CSS_PATH`.

### Step 3 — Check shadcn initialization

Check whether shadcn is already initialized in the project by looking for `components.json` in the project root.

- If `components.json` exists, proceed to Step 3a.
- If `components.json` does not exist, call **AskUserQuestion**: "shadcn/ui is not initialized. May I run `npx shadcn@latest init`? (yes / no)" If **no**, stop. If **yes**, prefer **non-interactive** init flags if the CLI supports them in this environment; otherwise collect each init choice with **AskUserQuestion** (one question at a time: style, base color, CSS variables vs default, paths) **before** running the command so the terminal is not stuck waiting for stdin.
  2. Confirm that `components.json` was created before continuing.
  3. If init fails, stop and report the error — do not attempt component installation.

#### Step 3a — Wire tokens.css into the project's global CSS

After shadcn is confirmed initialized (whether it was just run or already existed), wire `TOKEN_CSS_PATH` into the project's CSS entry point **if it is not already imported**.

1. Read `components.json` to find the `tailwind.css` path (the project's global CSS file, usually `src/app/globals.css`, `src/styles/globals.css`, or `app/globals.css`).
2. Read that file. Check if it already contains an `@import` referencing `tokens.css`. If it does, skip this step.
3. If not imported yet, do the following:

   **a. Remove CSS variable declaration blocks only.**
   shadcn generates one or more `@layer base` blocks. Remove **only** the blocks whose body contains CSS custom property declarations (lines of the form `--variable-name: value;`). These are the `:root { … }` and `.dark { … }` blocks that define HSL, oklch, or other color variable values.

   **Do NOT remove** `@layer base` blocks that contain only `@apply` directives or element selectors — for example:
   ```css
   /* KEEP this block — it wires shadcn utility classes */
   @layer base {
     * { @apply border-border outline-ring/50; }
     body { @apply bg-background text-foreground; }
   }
   ```

   If shadcn generated a combined `@layer base` block with both variable declarations AND `@apply` rules, remove only the `:root { … }` and `.dark { … }` sub-blocks inside it, leaving the `@apply` rules in place.

   Also remove any standalone `@theme inline { … }` block if present (Tailwind v4 / shadcn v3) — that block re-declares CSS variables that conflict with `tokens.css`.

   **b.** Insert `@import '{relative_path_to_tokens_css}';` at the **top** of the file, before any `@tailwind` or `@import "tailwindcss"` directive.
   The relative path must be computed from the globals CSS file's location to `TOKEN_CSS_PATH`.

4. Write the updated globals CSS file.
5. If `TOKEN_CSS_PATH` is null (designer skipped), leave globals.css unchanged.

**Example result** (Tailwind v3, tokens at `src/styles/tokens.css`, globals at `src/app/globals.css`):

```css
@import '../styles/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

**Example result** (Tailwind v4 / shadcn v3):

```css
@import '../styles/tokens.css';
@import "tailwindcss";

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

### Step 3b — Icon-pack bootstrap (first-time-only)

> **Goal:** Decide **once per project** which icon pack the component library should use, install its npm dependency, and optionally record a published Figma icon library so later draw/sync passes can bind `icon-slot/*` defaults. On subsequent `/create-component` runs the choice is read from disk and this step is silent.

This step runs after `components.json` / `tokens.css` wiring (Step 3a) and before the per-component install loop (Step 4). Output is assigned to `ICON_PACK` and consumed by Step 4 (install) and Step 6 (draw).

#### 3b.a — Probe for an existing choice

1. Look for `designops.config.json` at the project root.
2. If it exists **and** has a top-level `iconPack` key, parse it and assign to `ICON_PACK`. Skip the prompts below — emit a single line in the run report:

   ```text
   Using stored icon pack: <iconPack.choice> (npm: <iconPack.npm ?? "—">, figma: <iconPack.figmaIconLibraryKey ?? "—">).
   Re-run with --re-ask-icon-pack to change.
   ```

3. If the file is missing, unreadable, or has no `iconPack` key, continue to 3b.b.
4. If the designer passed `--re-ask-icon-pack` on the slash-command invocation, also continue to 3b.b (overwrites the existing block).

Do **not** run this step's prompts for every component — it's gated by disk state, not by the components list.

#### 3b.b — Ask which icon pack to use

Call **AskUserQuestion** with exactly these four options (one question, single-select):

> "Which icon pack should components in this project use? (This is asked once per project — your choice is saved to `designops.config.json` and reused on every future `/create-component` run.)
>
> - **lucide-react** — shadcn's default. Thin-stroke outline set. Installed as `lucide-react`.
> - **material-symbols** — Google Material 3 icon set. Installed as `@material-symbols/svg-400` (filled + outlined variants).
> - **custom** — you name the package / source. Follow-up prompt collects a free-form string (npm name, local path, CDN URL — whatever you use).
> - **none** — skip icon-pack install entirely. Figma keeps empty 24×24 placeholder slots and no npm dependency is added. You can re-run `/create-component --re-ask-icon-pack` later."

Map the reply to an `ICON_PACK` draft:

| Reply | `ICON_PACK.choice` | `ICON_PACK.npm` | `ICON_PACK.import` |
|---|---|---|---|
| `lucide-react` | `"lucide-react"` | `"lucide-react"` | `"lucide-react"` |
| `material-symbols` | `"material-symbols"` | `"@material-symbols/svg-400"` | `"@material-symbols/svg-400"` |
| `custom` | `"custom"` | _free-form reply from 3b.c_ | _same as `.npm`, unless designer provides a separate import specifier_ |
| `none` | `"none"` | `null` | `null` |

#### 3b.c — Custom pack follow-up (only when choice = `custom`)

Call **AskUserQuestion** as a free-form text prompt:

> "Paste the npm package, local path, or source identifier for your icon pack. This is opaque — the skill just records it and installs it if it looks like an npm spec (starts with a letter / `@`). Examples: `@tabler/icons-react`, `./src/icons`, `https://cdn.example.com/icons`."

Store the reply verbatim as `ICON_PACK.npm` (and mirror to `ICON_PACK.import`). If the string does **not** look like an npm spec (contains `/` that isn't `@scope/`, contains `://`, or starts with `.`), skip the `npm install` in Step 4 but keep the record — the designer wires it manually.

#### 3b.d — Figma icon library follow-up (only when choice ≠ `none`)

**Designer-friendly wording — do NOT ask for "component keys" or "file keys" directly.** Designers don't routinely touch those concepts; they know how to copy a Figma link. The prompts below accept whatever the designer actually has in hand (a Figma URL, via right-click → **Copy link to selection**) and the skill parses it. Keys are only mentioned as a fallback for advanced users.

**Prompt 1 (single-select, yes/no):**

> "Do you have a Figma icon library you'd like components to use as default icons? This can live **in this same file** (e.g. on an `↳ Icons` page) OR in a separately published team library that's linked here. If **no**, new components get empty 24×24 dashed placeholder slots that you fill in manually per instance."

- **no** → set `ICON_PACK.figmaIconLibraryKey = null` and `ICON_PACK.defaultIconRef = null`. Done with 3b.
- **yes** → continue with Prompt 2.

**Prompt 2 (free-form text — the library location):**

> "Paste a Figma link to **any page or any icon** inside that library. Right-click anything in the library on canvas → **Copy link to selection**, or grab the URL from your browser. Paste it here. (Advanced: if you already know the 22-char file key, paste that.)"

Parse the reply per the **Input parser** contract below. Store the parsed file key as `ICON_PACK.figmaIconLibraryKey`. If parsing fails, surface the failure verbatim, default to `null`, and emit a warning — do not block the run.

**Prompt 3 (free-form text — the default icon):**

> "Now pick **one specific icon** to be the default on every new component placeholder. Select that icon in Figma → right-click → **Copy link to selection** → paste here. Designers can swap to any other icon in the library per-instance later via the Figma right-panel dropdown — this is just the initial default that shows up when a fresh component is dropped on canvas. Reply `skip` to keep empty 24×24 dashed placeholders instead."

Parse the reply per the **Input parser** contract below. Store the result as a structured `ICON_PACK.defaultIconRef` object (schema below). If the designer replies `skip` or the parse fails, set `ICON_PACK.defaultIconRef = null` and slots stay as empty placeholders in Step 6.

**Input parser — paste classification.** Apply these rules in order; first match wins. The classification is intentionally coarse: Step 3b runs BEFORE `ACTIVE_FILE_KEY` is resolved (that happens at Step 5), so this step can't decide same-file vs cross-file yet. That comparison is deferred to Step 6's `draw-engine.figma.js §5.6` resolver, which has both keys in hand.

| Pattern | `kind` | Extract |
|---|---|---|
| `^skip$` (case-insensitive, default-icon prompt only) | `skip` | — (sets `defaultIconRef = null`) |
| `^https?://(www\.)?figma\.com/(design\|file\|board)/([A-Za-z0-9]{15,30})/[^?]*(\?.*node-id=([0-9A-Za-z:\-]+))?` | `url` | `fileKey` (group 3); `nodeId` if `node-id=` present — normalize `417-9815` → `417:9815` |
| `^[a-f0-9]{40}$` | `component-key` | 40-hex SHA-1 hash; set `componentKey` directly |
| `^[0-9]+:[0-9]+$` | `node-id` | `nodeId` verbatim |
| `^[A-Za-z0-9]{15,30}$` (Prompt 2 only — library location) | `file-key` | use as `fileKey` |
| Anything else | `unknown` | — (reject and re-ask once) |

Resulting `ICON_PACK.defaultIconRef` shape (written to config, consumed by Step 6):

```jsonc
{
  "rawInput": "<verbatim paste>",              // always stored for debug / manual edit
  "kind": "url" | "node-id" | "component-key" | "unknown",
  "fileKey": "<parsed fileKey>" | null,        // set for kind='url'; null otherwise. draw-engine.figma.js §5.6 compares against ACTIVE_FILE_KEY to decide resolution path.
  "nodeId": "417:9815" | null,                 // set for kind='url' (when URL has node-id) and kind='node-id'
  "componentKey": "<40-hex hash>" | null       // set for kind='component-key'; draw-engine.figma.js §5.6 prefers this over nodeId when present
}
```

**Library-location prompt (Prompt 2) notes.** If Prompt 2's paste is `url` or `file-key`, extract and store its `fileKey` as `ICON_PACK.figmaIconLibraryKey` (flat string, no wrapper). If Prompt 2's paste is `unknown`, reject and re-ask once; on second failure, persist `null` and warn. `node-id` and `component-key` classifications are invalid for Prompt 2 — reject with a wording hint ("That looks like a specific icon's link — this prompt needs a link to any page in the library file.") and re-ask.

**How Step 6's `draw-engine.figma.js §5.6` resolver uses each kind** (forward reference — see `draw-engine.figma.js §5.6` for the actual code):

| `defaultIconRef.kind` | Resolution attempt |
|---|---|
| `component-key` | `figma.importComponentByKeyAsync(componentKey)` — works for local AND cross-file published library components. Preferred path. |
| `url` with `fileKey === ACTIVE_FILE_KEY` | `figma.getNodeByIdAsync(nodeId)` in the current file. If the node is a COMPONENT_SET, use its first variant. |
| `url` with `fileKey !== ACTIVE_FILE_KEY` | **Cross-file** — `getNodeByIdAsync` can't see other files, and there's no componentKey. `draw-engine.figma.js §5.6` emits `'failed:cross-file-needs-key'`, slots fall back to empty placeholders, and the run report surfaces a recovery instruction (see below). |
| `node-id` | `figma.getNodeByIdAsync(nodeId)` — assumes current file. Identical behavior to same-file `url` path. |
| `unknown` / `null` | Skipped silently; empty placeholders (current behavior). |

**Cross-file recovery message** (emitted by `draw-engine.figma.js §5.6` when resolution returns `'failed:cross-file-needs-key'`):

> "Icon ref points to a different Figma file than the active one. To wire INSTANCE_SWAP the skill needs the component's 40-char hash key. Open the icon in Figma → right-click → **Inspect component** (Dev Mode required) → copy the **Component key** → re-run `/create-component --re-ask-icon-pack` and paste the hash at Prompt 3 instead of a URL. For now slots fall back to empty placeholders; the URL is still stored in `designops.config.json.iconPack.defaultIconRef.rawInput` so you can see what was intended."

**INSTANCE_SWAP wiring is gated** on `draw-engine.figma.js §5.6` producing a real `ComponentNode`. Any failure path → empty 24×24 dashed placeholders (current behavior) and the run report flags the exact failure code from `draw-engine.figma.js §5.6`'s `DEFAULT_ICON_RESOLUTION` field (e.g. `'failed:node-not-found:417:9815'`, `'failed:cross-file-needs-key'`).

#### 3b.e — Persist to `designops.config.json`

Write (or merge) the following shape at the project root:

```jsonc
{
  "iconPack": {
    "choice": "lucide-react" | "material-symbols" | "custom" | "none",
    "npm": "lucide-react" | "@material-symbols/svg-400" | "<free-form>" | null,
    "import": "lucide-react" | "@material-symbols/svg-400" | "<free-form>" | null,
    "figmaIconLibraryKey": "<fileKey>" | null,
    "defaultIconRef": {
      "rawInput": "<designer's verbatim paste>",
      "kind": "url" | "node-id" | "component-key" | "unknown",
      "fileKey": "<parsed fileKey>" | null,
      "nodeId": "417:9815" | null,
      "componentKey": "<40-hex hash>" | null
    } | null,
    "chosenAt": "<ISO-8601 timestamp>"
  }
}
```

**Backwards compatibility:** if a previous run wrote the flat `defaultIconKey: "<hash>"` field (old schema), Step 3b at probe time reads it and promotes it to `defaultIconRef: { rawInput: key, kind: 'component-key', fileKey: null, nodeId: null, componentKey: key }` in memory. The on-disk migration happens the next time `designops.config.json` is written (so a passive run leaves the old file untouched; an active run upgrades it).

Rules:
- If `designops.config.json` already exists with other top-level keys, preserve them — merge `iconPack` in, don't overwrite the file.
- Use 2-space indent and a trailing newline (LF).
- If the project has a `.gitignore` that excludes this filename, emit a one-line warning in the run report and still write the file — the designer decides whether to commit it.

#### 3b.f — Post-choice report line

After persistence, emit one line in the run report before Step 4 starts:

```text
Icon pack: <ICON_PACK.choice> (npm: <ICON_PACK.npm ?? "—">, figma library: <ICON_PACK.figmaIconLibraryKey ?? "—">, default icon: <default-icon-summary>).
```

Render `<default-icon-summary>` from `ICON_PACK.defaultIconRef` like this (pick the first match):

| Condition | Summary text |
|---|---|
| `defaultIconRef === null` | `"— (slots stay as empty placeholders)"` |
| `kind === 'component-key'` | `"key " + componentKey.slice(0, 8) + "…"` |
| `kind === 'url'` with `nodeId` | `"url → node " + nodeId + " in file " + fileKey.slice(0, 6) + "… (will resolve at draw time)"` |
| `kind === 'url'` without `nodeId` | `"url → file " + fileKey.slice(0, 6) + "… (no node-id in URL — can't resolve; edit config or re-run)"` |
| `kind === 'node-id'` | `"node " + nodeId + " (current file — will resolve at draw time)"` |
| `kind === 'unknown'` | `"unrecognized input '" + rawInput.slice(0, 40) + "…' — stored for reference only"` |

When `ICON_PACK.choice !== 'lucide-react'` and `ICON_PACK.choice !== 'none'`, also append:

```text
Global lucide-react → <ICON_PACK.choice> import rewrite will run at Step 4.4 after each component install.
```

The rewrite step is mandatory for non-lucide / non-none choices — the designer's Step 3b selection is the project-wide source of truth and shadcn's lucide-react defaults must be normalized to match. See Step 4.4 for the exact rewrite contract and fallback behavior.

### Step 4 — Install components

For each component in the list:

1. Run `npx shadcn@latest add [component]` (e.g. `npx shadcn@latest add button`).
   - If a shadcn MCP tool is available in the current session, use it as an equivalent alternative.
2. Confirm that the component files were written to the project (typically under `components/ui/`).
3. Track install status per component: `installed`, `already_exists`, or `failed`.

If a component install fails, log the error, mark it `failed`, and continue to the next component — do not abort the entire run.

**Icon-pack install (one-shot, runs once per session before the first component add):**

If Step 3b produced an `ICON_PACK` block where `ICON_PACK.npm` is a non-null, npm-shaped string (starts with a letter or `@`, no `://`, no leading `./`), and the package is not already listed as a `dependency` or `devDependency` in the project's `package.json`:

1. Run `npm install {ICON_PACK.npm}` (swap to `pnpm add` / `yarn add` / `bun add` if the project has the matching lockfile — `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`).
2. On failure, log it, mark the icon-pack install `failed` in the run report, and **continue** the component loop — a failed icon-pack install does not block shadcn component installs.
3. On success, record it (`installed` or `already_exists`) in the run report alongside the component rows.

If `ICON_PACK.npm` is null (choice = `none`) or non-npm-shaped (custom free-form path/URL), skip the install step silently — the config block is still persisted in `designops.config.json` for later reference.

### Step 4.4 — Icon-pack import rewrite (global)

> **Goal:** The designer's Step 3b choice is the project-wide source of truth. Shadcn-generated components ship with hardcoded `import { X, Check, ChevronDown, … } from 'lucide-react'` lines; when the designer picks a non-lucide pack, those imports are rewritten once per installed component so the project compiles against a single icon dependency. This is the "global replacement on creation" promise made at Step 3b.

This step runs **per just-installed component** immediately after Step 4 records its status, and **before** Step 4.5's CONFIG assembly. Only components whose install status in Step 4 was `installed` are touched — `already_exists` and `failed` are skipped (the first because the designer may have already hand-edited the file, the second because there's nothing to rewrite).

#### 4.4.a — Dispatch on `ICON_PACK.choice`

| `ICON_PACK.choice` | Behavior |
|---|---|
| `lucide-react` | Skip — shadcn's default matches the project choice. No rewrite. |
| `none` | Skip — but emit a one-line warning in the run report per component touched: `"Kept lucide-react imports in components/ui/<name>.tsx — icon-pack choice is 'none'. Shadcn icons will fail to resolve at build time until you run /create-component --re-ask-icon-pack and choose a pack."` |
| `material-symbols` | Run the mapping rewrite in 4.4.b. |
| `custom` | Run the specifier-only rewrite in 4.4.c. |

#### 4.4.b — `material-symbols` rewrite (mapping-based)

For each `installed` component's source file (typically `components/ui/<name>.tsx`):

1. **Find every `import` statement that ends in `from 'lucide-react'` or `from "lucide-react"`**. Use an AST walk if available (e.g. via `ts-morph` / `@babel/parser`); fall back to a line-level regex only if AST tooling is unavailable in the session. AST is strongly preferred because JSX usage sites like `<ChevronDown />` must be rewritten too — a pure specifier swap without renaming the JSX identifiers leaves dead references.
2. **Translate each imported specifier via the canonical mapping below.** Specifiers that map cleanly are renamed; specifiers without a mapping stay on a new `from 'lucide-react'` line (so the file still compiles — the designer sees a mixed-pack file and a warning in the run report rather than a broken build).
3. **Rewrite JSX usage sites** for every successfully-translated specifier: `<ChevronDown />` → `<ChevronRightRounded />` (or whatever the target identifier is). JSX attribute props (`size`, `className`) are preserved verbatim.
4. **Collapse duplicate imports** from the new pack into a single `import { … } from '<ICON_PACK.import>'` statement at the top of the existing import block.
5. **Append a single pinned comment** above the rewritten import: `// Icon imports rewritten from lucide-react → <ICON_PACK.import> by /create-component Step 4.4. Edit designops.config.json.iconPack.choice and re-run /create-component to change.`

Canonical lucide → material-symbols mapping (ship this as a const table inside the skill — extend as new shadcn components require new icons):

| lucide (shadcn ships these) | material-symbols/react equivalent |
|---|---|
| `X` | `CloseRounded` |
| `Check` | `CheckRounded` |
| `ChevronDown` | `ExpandMoreRounded` |
| `ChevronUp` | `ExpandLessRounded` |
| `ChevronLeft` | `ChevronLeftRounded` |
| `ChevronRight` | `ChevronRightRounded` |
| `ChevronsUpDown` | `UnfoldMoreRounded` |
| `ArrowLeft` | `ArrowBackRounded` |
| `ArrowRight` | `ArrowForwardRounded` |
| `ArrowUp` | `ArrowUpwardRounded` |
| `ArrowDown` | `ArrowDownwardRounded` |
| `Circle` | `CircleRounded` |
| `Dot` | `FiberManualRecordRounded` |
| `Search` | `SearchRounded` |
| `Plus` | `AddRounded` |
| `Minus` | `RemoveRounded` |
| `MoreHorizontal` | `MoreHorizRounded` |
| `MoreVertical` | `MoreVertRounded` |
| `GripVertical` | `DragIndicatorRounded` |
| `PanelLeft` | `ViewSidebarRounded` |
| `AlertCircle` | `ErrorOutlineRounded` |
| `AlertTriangle` | `WarningAmberRounded` |
| `Info` | `InfoOutlineRounded` |
| `CheckCircle` | `CheckCircleOutlineRounded` |
| `XCircle` | `CancelOutlineRounded` |
| `Calendar` | `CalendarMonthRounded` |
| `Clock` | `ScheduleRounded` |
| `Eye` | `VisibilityRounded` |
| `EyeOff` | `VisibilityOffRounded` |
| `Loader` / `Loader2` | `ProgressActivityRounded` |

Unmapped specifiers → stay on lucide-react with a warning. The run report summarizes per component: `"rewrote 4 / 5 icon imports in <file>; 1 unmapped (`CustomIcon`) kept on lucide-react. Extend the mapping table in /create-component Step 4.4.b to cover it."`

#### 4.4.c — `custom` rewrite (specifier-only + warning)

For custom packs the skill does not know the target identifier names, so it only swaps the `from` specifier and warns the designer:

1. Rewrite every `from 'lucide-react'` → `from '<ICON_PACK.import>'`. Do **not** touch the imported specifier list or JSX usage sites.
2. Emit a per-component warning in the run report: `"Rewrote import path only in components/ui/<name>.tsx: 'lucide-react' → '<ICON_PACK.import>'. Icon identifiers (X, Check, ChevronDown, …) were NOT renamed — if your pack uses different names, either alias them in the import (`{ Close as X }`) or extend the mapping table in Step 4.4.b and re-run /create-component."`
3. If the final file contains `from '<custom>'` but the custom package is non-npm-shaped (Step 4 skipped its install), also warn: `"Icon-pack is non-npm — no dependency was installed. Wire the import path manually or change designops.config.json.iconPack.npm to an npm-shaped spec."`

#### 4.4.d — Idempotence + re-run safety

- Before rewriting, check the top of the file for the pinned comment `// Icon imports rewritten from lucide-react → …`. If present **and** the recorded target matches the current `ICON_PACK.import`, skip the rewrite for that file (it's already been rewritten by a prior run).
- If the pinned comment is present but the target **differs** from the current `ICON_PACK.import`, emit a warning — the designer re-ran `/create-component --re-ask-icon-pack` and changed packs. Offer to continue with a fresh rewrite (prompt `AskUserQuestion`: "Re-rewrite imports to <new pack>? yes / keep-current / abort"). `keep-current` aborts Step 4.4 for this component only; `abort` aborts the whole run.
- If the pinned comment is absent and the file has no `from 'lucide-react'` imports at all, skip silently — nothing to rewrite.

### Step 4.5 — Extract source-of-truth CONFIG (Mode A)

> **Goal:** Make the **installed shadcn source file** authoritative for every component, so Figma cannot drift when the designer/developer customizes `components/ui/*.tsx`. See [`conventions/00-overview.md` §0](./conventions/00-overview.md) for the Mode A vs Mode B contract.

This step runs **per installed component** immediately after Step 4 and before Step 6's draw loop. Each component gets a `CONFIG` assembled from three inputs:

1. **cva variants** — extracted at runtime from the installed source file.
2. **Tailwind class tokens** — resolved against `tokens.css` to Figma variable paths.
3. **Prop surface / icon slots / page routing** — read from the curated per-component files under [`shadcn-props/`](./shadcn-props/). Prefer reading **one file per component** (`shadcn-props/{component}.json`, ~300 B – 3 KB each) over the monolithic [`shadcn-props.json`](./shadcn-props.json) (~65 KB) — agents that only need one entry should `Read` the single file to save context. The monolith is kept as a build artifact regenerated from the split directory by `scripts/build-shadcn-props.mjs`; both are always in sync. `shadcn-props/_index.json` lists every component's name, category, layout, pageName, and docsUrl in ~3 KB and is the right input for agents that only need to classify the full set (e.g. routing tables).

If any input is missing, Mode A is aborted for that component and the agent falls back to the synthetic CONFIG (Mode B) at Step 6 with `source: 'synthetic-fallback'` in the run report.

#### 4.5.a — Preconditions (probe, do not prompt)

| Check | Pass signal | Fail → behavior |
|---|---|---|
| `components.json` exists at project root | file present | Mode A unavailable for this run → Mode B for every component (`source: 'synthetic-no-shadcn'`) |
| Component source file exists (typically `components/ui/{component}.tsx`) | file present after Step 4 install | Mark component `source: 'synthetic-fallback'`, continue to Step 6 in Mode B |
| `tokens.css` exists at the path resolved in Step 2 | file present | Same as above |
| `shadcn-props.json` has an entry for `{component}` | key present | Same as above |

Do not ask the user any questions here — all four checks are deterministic file-system probes.

#### 4.5.b — Extract cva config

Run the extractor subprocess from the **user's project cwd** so TS paths and aliases resolve:

```bash
npx tsx <abs-path-to-this-skill>/resolver/extract-cva.mjs <abs-path-to>/components/ui/<component>.tsx
```

- **Success (exit 0):** stdout is JSON `{ source: "runtime" | "parsed", exportName, base, variants, defaultVariants, compoundVariants, displayName }`. Capture the object.
- **Failure (exit 1):** stdout is JSON `{ error, ... }`. Log the error into the run report, mark the component `source: 'synthetic-fallback'`, continue with Mode B.

The extractor runs a two-tier strategy automatically — runtime `await import()` first, then a source-text fallback that evaluates the cva() argument expressions in a `node:vm` sandbox. Agents never need to orchestrate the fallback themselves.

#### 4.5.c — Resolve classes per variant × size

For every `(variantKey, sizeKey)` in `variants.variant × variants.size`, concatenate the applicable class strings in shadcn's standard order and feed them to the resolver:

```
classString = [ base, variants.variant[variantKey], variants.size[sizeKey], ...compoundVariantClassesForPair ].join(' ')
```

Run the resolver subprocess **once per joined class string**. Pass the class string via stdin (`-` arg) to avoid shell-quoting issues with slashes:

```bash
echo "<classString>" | node <abs-path-to-this-skill>/resolver/resolve-classes.mjs <abs-path-to>/tokens.css -
```

The resolver returns a bucketed JSON payload (`fills`, `strokes`, `radii`, `spacing`, `typography`, `effects`, `layout`, `unresolved`) with a `state` field (`base`, `hover`, `focus-visible`, `disabled`, …) on every entry. See [`conventions/05-code-connect.md` §3.4](./conventions/05-code-connect.md) for the full resolution map.

#### 4.5.d — Assemble CONFIG

Merge the extractor output, the resolver output, and the `shadcn-props.json` entry into a CONFIG object that matches the schema the existing `use_figma` draw engine already consumes. The mapping is:

| CONFIG field | Source |
|---|---|
| `component`, `title`, `pageName`, `summary` | `shadcn-props.json[component]` + extractor `exportName` |
| `variants` | `Object.keys(cvaOutput.variants.variant)` |
| `sizes` | `Object.keys(cvaOutput.variants.size)` (or `[]` if no size axis) |
| `style[variant].fill` | first `base`-state `fills[]` entry for that `(variant, defaultSize)` → `.token` |
| `style[variant].labelVar` | first `base`-state `text-*` color binding → `.token` |
| `style[variant].strokeVar` | first `base`-state `strokes[]` entry → `.token` |
| `padH[size]` | `spacing[].tokenHint` where `property='px'` → else raw `px` |
| `radius` | first `radii[].token` (prefer `base` state) |
| `labelStyle[size]` | `typography[].token` where `state='base'` |
| `label`, `iconSlots`, `componentProps`, `properties`, `usageDo`, `usageDont`, `composes` | `shadcn-props.json[component]` (`composes` optional; see §4.5.g and [`conventions/02-archetype-routing.md §3.05`](./conventions/02-archetype-routing.md)) |
| `states`, `applyStateOverride` | `shadcn-props.json[component]` defaults (see §4.5.e) |
| `defaultVariant` | `cvaOutput.defaultVariants.variant` → feed to `draw-engine.figma.js §6.6D` as the ComponentSet default |
| `defaultSize` | `cvaOutput.defaultVariants.size` → feed to `draw-engine.figma.js §6.6D` |
| `iconPack` | the `ICON_PACK` block from Step 3b (or `null`). Surfaced in CONFIG so the draw engine / future `/code-connect` runs can read `iconPack.figmaIconLibraryKey` when wiring `icon-slot/*` default-swap targets. The current draw engine treats this field as advisory — if absent, slots remain empty 24×24 dashed placeholders (the existing behavior). |

Record every resolver `unresolved[]` entry in the run report under `unresolvedClasses` for the component. Do not abort on unresolved classes — the draw engine falls back to fallback hex and raw px where the token is null.

#### 4.5.e — State override policy in Mode A

The cva variant axes shadcn ships almost never include a `state` axis (pressed / hover are Tailwind pseudo-classes, not cva variants). Keep `CONFIG.states` from `shadcn-props.json` and the `applyStateOverride` default from [`conventions/04-doc-pipeline-contract.md` §13.1](./conventions/04-doc-pipeline-contract.md) — opacity is the authoritative mechanism, and the resolver's `hover:*` / `disabled:*` bindings are surfaced in the run report only for audit purposes (e.g. so you can confirm `hover` really is an opacity change on the default variant).

Exception: for components where `state` **is** a cva variant (checkbox `checked`, switch `checked`), promote it to a Figma variant property and drop it from `CONFIG.states`.

#### 4.5.f — Tag the CONFIG

Attach `CONFIG._source = 'shadcn-1:1'` so Step 8 can show it in the reporting table. If Mode A was skipped for this component, Step 6 falls back to the synthetic template and tags `CONFIG._source = 'synthetic-fallback'` (or `'synthetic-no-shadcn'` if `components.json` was absent at 4.5.a).

#### 4.5.g — Validate `composes[]` (atomic composition)

When `shadcn-props.json[component].composes` is present (non-empty array), run the shipped validator **before** Step 6 for that component:

```bash
node <abs-path-to-this-skill>/resolver/validate-composes.mjs \
  <abs-path-to-this-skill>/shadcn-props.json <component> \
  [--project <repo-root>]
```

- Pass `--project` pointing at the consuming repo root whenever `components/ui/*.tsx` exists so `defaultProps` keys are checked against each child's extracted cva axes (via `extract-cva.mjs`). If the child file is absent, the validator skips `defaultProps` checks with a warning — still exit 0 when graph rules pass.
- **Exit code ≠ 0** — abort Step 6 for this component; copy the validator stderr into the run report (missing compose target, cycle, duplicate `slot`, illegal `count`, bad `defaultProps` type, etc.).
- **Exit 0 with warnings** — continue; list warnings in Step 8 Notes.

**Dependency expansion (resolver preview).** If `composes[]` references a child that is not in the current run list **and** has no registry entry yet (`.designops-registry.json` — see Step 5.1), call **AskUserQuestion** once per composite explaining the child must be drawn first (offer to prepend that child to this run or cancel). This mirrors the plan's Phase 3 resolver UX; until the registry exists, prefer expanding the install+draw list over failing silently.

### Step 5 — Resolve the target Figma file key + registry gate

1. Check `plugin/templates/agent-handoff.md` for the `active_file_key` field.
2. If set and valid, use it without prompting.
3. If not present, call **AskUserQuestion**: "What is the Figma file key for this project? (Segment after `figma.com/design/` in the URL.)"

#### 5.1 — `.designops-registry.json` gate (Phase 2–3)

At repo root (same directory as `package.json` / `components.json`):

- **Read** `.designops-registry.json` if it exists. Schema: [`registry.schema.json`](./registry.schema.json).
- If the file's top-level `fileKey` is set and **does not equal** the active Figma file key from step 1–3 above, **stop** before any `use_figma` call and print: registry is bound to another file; delete or hand-edit `.designops-registry.json` to reset (prevents cross-file component-key pollution).
- **Prepare injection object** `REGISTRY_COMPONENTS` = parsed `components` map (may be empty on first run). You will paste these literals into the §6 template (`ACTIVE_FILE_KEY` + `REGISTRY_COMPONENTS`) immediately before each `use_figma` invocation.

#### 5.2 — Registry write-back (after Step 6 succeeds)

After each component's `use_figma` returns **and** §9 self-check passes, merge `returnPayload.registryEntry` into `.designops-registry.json`:

- Set top-level `fileKey` to the active file key.
- Upsert `components[CONFIG.component]` with `{ nodeId, key, pageName, publishedAt, version, cvaHash?, composedChildVersions? }` from the payload. Increment `version` on every redraw; use ISO-8601 UTC for `publishedAt`. When `composedWith` is non-empty, persist `composedChildVersions` (map of child kebab-name → that child's registry `version` at draw time) for `/sync-design-system` §3B.1 stale detection.
- Prefer the idempotent helper: `node skills/create-component/resolver/merge-registry.mjs <repo>/.designops-registry.json <tmp-entry.json>` where `tmp-entry.json` is one merged object `{ fileKey, component, ...fields }` exported from `returnPayload`.
- Commit this file with design-system PRs — it is the bridge between Figma component keys and the repo (Code Connect + composition use the same handles).

### Step 6 — Draw components to Figma canvas

> **Invoked by `/sync-design-system`.** When Axis B decides **code wins**, `/sync-design-system` calls this skill with `--components=<list>` to scope Step 4.5 extraction + Step 6 drawing to the named subset. The Mode branch below is unchanged in that invocation; only the component set is narrowed.

> **Mode branch (set per component at the start of this step):**
>
> 1. If Step 4.5 produced a Mode A CONFIG for `{component}` (attached as `CONFIG._source = 'shadcn-1:1'`), **use it verbatim** — do not edit the CONFIG object in the template below. Skip straight to the draw engine (§1 onward of the template).
> 2. Otherwise — shadcn not installed, source import failed, `tokens.css` missing, or no `shadcn-props.json` entry — **edit the Mode B synthetic CONFIG** in the template below, set `CONFIG._source = 'synthetic-no-shadcn'` if `components.json` was absent at Step 4.5.a or `CONFIG._source = 'synthetic-fallback'` otherwise, and carry on.
>
> Mode A and Mode B share the exact same draw engine below the CONFIG block — the only variable is who wrote CONFIG (the extractor vs the agent). Never hand-author a CONFIG in Mode A; if you feel the urge to, the extractor or the class resolver has a bug and the fix is to report the `unresolvedClasses` entries in Step 8, not to patch CONFIG by hand.
>
> **Critical rule:** Every component's page navigation, creation, and all variable bindings must happen inside a **single `use_figma` call**. Each call runs in an isolated plugin context — page state set in one call does NOT carry over to the next call.
>
> **Default layout = matrix.** Every component — single-state, single-variant, or full cross-product — renders into a **Variant × State specimen matrix** inside a documentation frame that also carries a properties/types table and Do/Don't usage notes. The flat wrapping "grid of variants" output from earlier revisions of this skill is **deprecated**. See [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) for the full spec and [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) for the audit checklist.
>
> **One component per page.** The page is already scaffolded by `/new-project` step 5b — do not create pages here. Delete every node other than `_Header`, then build `_PageContent` + the doc frame.

> **Migration (Phase 6 — opt-in):** rewriting legacy flat-shape composites to instance stacks in place (`--migrate-to-instances`) is specified in [`plans/create-component_atomic-composition.plan.md`](../../plans/create-component_atomic-composition.plan.md) §7. The §6 template below covers **new draws and full redraws**; run the migration flow only after that plan's pre-migration audit when a file already has inbound references.

For each successfully installed component, make **one `use_figma` call** using the complete template below.

**Component → Page routing** (pick the row for your component and use it as `CONFIG.pageName`):

> 🤖 The table below is regenerated by `scripts/build-create-component-docs.mjs` — the script reads `shadcn-props/*.json` (split, Phase 8) and falls back to the monolithic [`shadcn-props.json`](./shadcn-props.json) if the split directory is absent. Edit the per-component files and run `npm run build:docs` — do not hand-edit between the `<!-- GENERATED -->` markers.

<!-- GENERATED:page-routing-table START -->
| Component (kebab-case) | Layout archetype | Page name in the Foundations scaffold |
|---|---|---|
| `accordion` | `container` | ↳ Accordion |
| `alert` | `surface-stack` | ↳ Alerts |
| `alert-dialog` | `surface-stack` | ↳ Dialogue |
| `aspect-ratio` | `tiny` | ↳ Aspect Ratio |
| `avatar` | `tiny` | ↳ Avatar |
| `badge` | `chip` | ↳ Badge |
| `breadcrumb` | `row-item` | ↳ Breadcrumb |
| `button` | `chip` | ↳ Buttons |
| `button-group` | `chip` | ↳ Button Group |
| `calendar` | `surface-stack` | ↳ Calendar |
| `card` | `surface-stack` | ↳ Cards |
| `carousel` | `container` | ↳ Carousel |
| `chart` | `surface-stack` | ↳ Chart |
| `checkbox` | `control` | ↳ Checkbox |
| `collapsible` | `container` | ↳ Collapsible |
| `combobox` | `field` | ↳ Combobox |
| `command` | `row-item` | ↳ Command |
| `context-menu` | `row-item` | ↳ Context Menu |
| `date-picker` | `field` | ↳ Date Picker |
| `dialog` | `surface-stack` | ↳ Dialogue |
| `direction` | `chip` | ↳ Typography |
| `drawer` | `surface-stack` | ↳ Drawer |
| `dropdown-menu` | `row-item` | ↳ Dropdown Menu |
| `empty` | `surface-stack` | ↳ Blank states |
| `field` | `field` | ↳ Field |
| `form` | `field` | ↳ Form Composite Groups |
| `hover-card` | `surface-stack` | ↳ Hover Card |
| `input` | `field` | ↳ Text Field |
| `input-group` | `field` | ↳ Input Group |
| `input-otp` | `field` | ↳ Input OTP |
| `item` | `row-item` | ↳ Lists |
| `kbd` | `chip` | ↳ Kbd |
| `label` | `chip` | ↳ Label |
| `menubar` | `row-item` | ↳ Menubar |
| `native-select` | `field` | ↳ Native Select |
| `navigation-menu` | `row-item` | ↳ Navigation Menu |
| `pagination` | `chip` | ↳ Pagination |
| `popover` | `surface-stack` | ↳ Popover |
| `progress` | `tiny` | ↳ Progress Bar |
| `radio-group` | `control` | ↳ Radio |
| `resizable` | `container` | ↳ Resizable |
| `scroll-area` | `tiny` | ↳ Scroll Area |
| `select` | `field` | ↳ Select |
| `separator` | `tiny` | ↳ Dividers |
| `sheet` | `surface-stack` | ↳ Sheets |
| `sidebar` | `surface-stack` | ↳ Sidebar |
| `skeleton` | `tiny` | ↳ Skeleton |
| `slider` | `tiny` | ↳ Slider |
| `sonner` | `surface-stack` | ↳ Sonner |
| `spinner` | `tiny` | ↳ Spinner |
| `switch` | `control` | ↳ Switch |
| `table` | `surface-stack` | ↳ Data Table |
| `tabs` | `container` | ↳ Tabs bar |
| `textarea` | `field` | ↳ Textarea |
| `toast` | `surface-stack` | ↳ Toast |
| `toggle` | `chip` | ↳ Toggle |
| `toggle-group` | `chip` | ↳ Toggle Group |
| `tooltip` | `surface-stack` | ↳ Tooltips |
| `typography` | `chip` | ↳ Typography |
<!-- GENERATED:page-routing-table END -->

#### Step 6.0 — Layout archetype routing (pick before assembling CONFIG)

The draw engine dispatches on `CONFIG.layout` to pick the right variant shape. **Every component in Mode A or Mode B must set `CONFIG.layout` explicitly** (Mode A extractor also sets it based on the component name; Mode B agents pick from this table). Defaults to `'chip'` for back-compat with Button, but silent fallback is discouraged — always set it.

| `CONFIG.layout` | Shape produced per variant | shadcn components | Source |
|---|---|---|---|
| `'chip'` **(default)** | `[icon-slot/leading] · [label] · [icon-slot/trailing]` horizontal row, CENTER-CENTER aligned | `button`, `badge`, `toggle`, `kbd`, `switch`, `chip`, `sonner`, `toast` (row variant), `label` | Current `buildVariant` |
| `'surface-stack'` | Vertical surface: `CardHeader(title + description + optional action-slot) → CardContent(dashed content-slot) → CardFooter(dashed footer-slot)`. Matches [shadcn/ui Card](https://ui.shadcn.com/docs/components/radix/card) composition. | `card`, `alert-dialog`, `dialog`, `sheet`, `drawer`, `popover`, `hover-card`, `tooltip`, `empty`, `alert`, `sidebar` (section) | `buildSurfaceStackVariant` |
| `'field'` | Vertical: `Label → [field-chrome with placeholder glyph/text] → helper/error` | `input`, `textarea`, `select`, `combobox`, `date-picker`, `input-otp`, `input-group`, `field` | **Not yet implemented** — stub throws; falls through to `chip` with a warning if forced. Agents: coordinate with maintainer before using. |
| `'row-item'` | Horizontal: `[lead] · [title/description stacked] · [trail/chevron]` | `item`, `dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`, `breadcrumb`, `command` | **Not yet implemented** |
| `'tiny'` | Pure shape with correct size/color, no inner children | `separator`, `skeleton`, `spinner`, `progress`, `aspect-ratio`, `avatar`, `scroll-area` | **Not yet implemented** |

**Authoring tip.** If you can't find a row for your component, it is almost always **`surface-stack`** (for container-shaped components) or **`chip`** (for inline affordances). When in doubt, match the shadcn docs composition block — if the docs show `<Card><CardHeader/>...<CardContent/>...<CardFooter/></Card>` or similar, it's `surface-stack`.

**Sample copy rule.** For non-chip archetypes, seed every variant with real one-line sample copy so the designer sees a plausible shape — never leave a region blank. Title defaults to `CONFIG.title`; description defaults to the first sentence of `CONFIG.summary`. See `§0.surface` in the template for per-component overrides.

**Complete `use_figma` code template** (substitute component-specific values where indicated):

```js
// ═══════════════════════════════════════════════════════════════════════════
// STEP 0. COMPONENT CONFIG — the ONLY block you edit per component
// ═══════════════════════════════════════════════════════════════════════════
// This is the **Mode B synthetic template**. When Mode A extraction (Step 4.5)
// succeeds for a component, Step 6 **overwrites this entire CONFIG object at
// runtime** with the one assembled from the installed shadcn source file +
// tokens.css + shadcn-props.json. Edit this block only when Mode A is
// unavailable (shadcn declined, source import failed, tokens.css missing)
// or when customizing the synthetic placeholder for a component that has no
// shadcn counterpart.
//
// Schema: conventions/01-config-schema.md §3. Every subsequent section (§1 through §6) reads
// from CONFIG and never from Button-specific constants. If a new component
// needs behavior this schema doesn't model, extend the schema rather than
// hardcoding inline.

const CONFIG = {
  component: 'button',                // kebab-case, matches shadcn filename
  title:     'Button',                // display title (header, page references)
  pageName:  '↳ Buttons',             // target page; see routing table above
  summary:   'Trigger an action or navigate. Follows shadcn/ui defaults — six variants, four sizes.',

  // Layout archetype — routes the variant loop to the right builder.
  //   'chip'          : horizontal [lead] · [label] · [trail] (Button, Badge, Toggle, Kbd, Switch)
  //   'surface-stack' : vertical CardHeader → CardContent → CardFooter with
  //                     dashed content slots (Card, Alert, Dialog, Sheet,
  //                     Popover, Tooltip, Hover Card, Empty) — matches
  //                     shadcn/ui Card composition.
  //   'field'         : Label → field-chrome → helper (NOT YET IMPLEMENTED)
  //   'row-item'      : lead · stacked-text · trail (NOT YET IMPLEMENTED)
  //   'tiny'          : pure shape (NOT YET IMPLEMENTED)
  // See conventions/02-archetype-routing.md §3.1.1 routing table for the full shadcn → archetype
  // mapping. Default is 'chip' for back-compat; set explicitly for every new
  // component.
  layout: 'chip',

  // Required when layout === 'surface-stack'. Ignored otherwise.
  //   titleText           : string | ((size, variant) => string)   default CONFIG.title
  //   descriptionText     : string | ((size, variant) => string | null)  default first sentence of CONFIG.summary
  //   titleStyleName      : published Label/* style name for the title     default 'Label/LG'
  //   descriptionStyleName: published Label/* style for description        default 'Label/SM'
  //   headerPad           : token for header horizontal padding            default CONFIG.padH.default
  //   contentPad          : token for content horizontal padding           default CONFIG.padH.default
  //   footerPad           : token for footer horizontal padding            default CONFIG.padH.default
  //   sectionPadY         : token for vertical padding on Card itself      default CONFIG.padH.default
  //   gap                 : token for gap between header/content/footer    default 'space/lg'
  //   innerGap            : token for gap inside header (title/desc)       default 'space/xs'
  //   actionSlot          : { enabled: boolean, slotLabel?, width?, height? }  default { enabled: false }
  //   contentSlot         : { enabled: true, slotLabel: 'Content', minHeight: 64 }  always enabled
  //   footerSlot          : { enabled: boolean, slotLabel: 'Footer', align: 'start'|'end'|'between', minHeight: 40 }  default { enabled: false }
  // NOT present on Button — see the Card example block below this CONFIG for reference.
  surface: null,

  // Variant × Size cross-product becomes the ComponentSet.
  //   variants[]  → matrix rows (within each size group)
  //   sizes[]     → vertically-stacked size groups ([] = no size axis)
  variants: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
  sizes:    ['sm', 'default', 'lg', 'icon'],

  // Per-variant paint tokens — bound to Theme collection.
  style: {
    default:     { fill: 'color/primary/default',    fallback: '#1a1a1a', labelVar: 'color/primary/content',    strokeVar: null },
    destructive: { fill: 'color/error/default',      fallback: '#ef4444', labelVar: 'color/error/content',      strokeVar: null },
    outline:     { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: 'color/border/default' },
    secondary:   { fill: 'color/secondary/default',  fallback: '#6b7280', labelVar: 'color/secondary/content',  strokeVar: null },
    ghost:       { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: null },
    link:        { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/primary/default',    strokeVar: null },
  },

  // Per-size horizontal padding token. `default` is the fallback.
  padH:   { default: 'space/md', sm: 'space/xs', lg: 'space/lg', icon: 'space/xs' },
  radius: 'radius/md',                // radius token used on every variant

  // Per-size text style for the inner label. Keys map to PUBLISHED text
  // styles in the file (Label/XS, Label/SM, Label/MD, Label/LG). `default`
  // is the fallback. If the style doesn't exist, buildVariant falls back
  // to raw fontSize 14. Omit entirely to skip published styles for labels.
  labelStyle: { default: 'Label/MD', sm: 'Label/SM', lg: 'Label/LG', icon: 'Label/MD' },

  // (size, variant) → inner label. Return null (or '') to suppress the text
  // node entirely — buildVariant will collapse to a single centered icon
  // slot for that size, which is how shadcn's `size=icon` renders.
  label: (size, _variant) => size === 'icon' ? null : 'Button',

  // Icon slots — 24×24 placeholder frames that preserve space even when no
  // icon content is dropped in. Nodes are named `icon-slot/leading`,
  // `icon-slot/trailing`, and `icon-slot/center` so designers can find them
  // in the layers panel and drop SVG vectors in without detaching.
  //   leading  : render a slot before the label (e.g. `<Plus />` on "Add")
  //   trailing : render a slot after  the label (e.g. `<ChevronRight />`)
  //   size     : width/height in px — 24 is the system default; do not vary
  //              per-component without a token update.
  // When `label` returns null (icon-only sizes), both leading/trailing
  // settings are ignored and a single `icon-slot/center` is drawn instead.
  iconSlots: { leading: true, trailing: true, size: 24 },

  // Figma component properties exposed on the ComponentSet — designers
  // change these on instances without detaching.
  //   label        : TEXT property "Label" bound to the inner text node's
  //                  `characters`. Default value = `label(defaultSize)`.
  //   leadingIcon  : BOOLEAN property "Leading icon" bound to the visibility
  //                  of `icon-slot/leading` on every variant.
  //   trailingIcon : BOOLEAN property "Trailing icon" bound to the visibility
  //                  of `icon-slot/trailing` on every variant.
  // Set any flag to false to skip that property. BOOLEAN props require the
  // matching `iconSlots.<side>` to be enabled above.
  componentProps: { label: true, leadingIcon: true, trailingIcon: true },

  // Matrix state columns — group them as "default" (interactive cluster) or
  // "disabled" (right cluster). If every state has group 'default', the
  // two-tier header collapses to a single states row.
  states: [
    { key: 'default',  group: 'default'  },
    { key: 'hover',    group: 'default'  },
    { key: 'pressed',  group: 'default'  },
    { key: 'disabled', group: 'disabled' },
  ],

  // Applied to every matrix cell instance. If state IS a Figma variant prop
  // (e.g. checkbox, switch), call `instance.setProperties({...})` here
  // instead of mutating fills/opacity.
  applyStateOverride: (instance, stateKey) => {
    if (stateKey === 'hover')    instance.opacity = 0.92;
    if (stateKey === 'pressed')  instance.opacity = 0.85;
    if (stateKey === 'disabled') instance.opacity = 0.5;
  },

  // Properties + Types table rows. Columns: NAME | TYPE | DEFAULT | REQUIRED | DESCRIPTION.
  properties: [
    ['variant',   '"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"', '"default"', 'no', 'Visual style.'],
    ['size',      '"default" | "sm" | "lg" | "icon"',                                       '"default"', 'no', 'Overall height + padding preset.'],
    ['disabled',  'boolean',                                                                 'false',    'no', 'Disables pointer + keyboard interaction; adds visual dim.'],
    ['asChild',   'boolean',                                                                 'false',    'no', 'Renders styled classes onto the immediate child via Radix Slot.'],
    ['type',      '"button" | "submit" | "reset"',                                           '"button"', 'no', 'Native HTML button type.'],
    ['className', 'string',                                                                  '—',        'no', 'Tailwind class escape hatch.'],
  ],

  // Usage notes — left "Do" card, right "Don't" card. ≥3 bullets each.
  usageDo: [
    'Use `default` for the single primary action in a flow.',
    'Use `outline` or `ghost` for secondary actions that shouldn\'t pull focus.',
    'Pair `icon` size with an aria-label on the underlying button element.',
    'Drop a 24×24 vector into `icon-slot/leading` or `icon-slot/trailing` — or toggle the matching boolean property off — instead of detaching the instance.',
  ],
  usageDont: [
    'Don\'t stack two `default` buttons side-by-side — pick one primary.',
    'Don\'t use `destructive` for routine actions — reserve for irreversible ones.',
    'Don\'t override the size via className when a `size` variant exists.',
    'Don\'t resize the 24×24 icon slots — the token is fixed so every button aligns across the system.',
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'surface-stack'` CONFIG shape (for Card and friends)
// Mirror the shadcn/ui Card composition (CardHeader · CardContent · CardFooter).
// DELETE THIS BLOCK when composing a chip component; keep it when composing
// Card / Alert Dialog / Dialog / Sheet / Drawer / Popover / Tooltip / Empty.
//
// const CONFIG = {
//   component: 'card',
//   title:     'Card',
//   pageName:  '↳ Cards',
//   summary:   'Surface container with header, content, and footer slots. Use to group related content on a shared background.',
//   layout:    'surface-stack',
//   variants:  ['default'],
//   sizes:     ['sm', 'default'],                 // shadcn Card API: size="default" | "sm"
//   style: {
//     default: {
//       fill:      'color/background/default',   // Card surface bg
//       fallback:  '#ffffff',
//       labelVar:  'color/background/content',   // Title color
//       strokeVar: 'color/border/subtle',        // 1px border
//     },
//   },
//   padH:   { default: 'space/2xl', sm: 'space/lg' },   // shadcn: px-6 (24) / px-4 (16) inside header/content/footer
//   radius: 'radius/xl',                                 // shadcn: rounded-xl
//
//   // `surface` describes the vertical stack — consumed by buildSurfaceStackVariant.
//   surface: {
//     titleText:            (_size, _v) => 'Card title',
//     descriptionText:      (_size, _v) => 'A brief one-line description of what this card contains.',
//     titleStyleName:       'Label/LG',
//     descriptionStyleName: 'Label/SM',
//     sectionPadY:          'space/2xl',     // shadcn: py-6 on Card itself
//     gap:                  'space/2xl',     // shadcn: gap-6 between header/content/footer
//     innerGap:             'space/xs',      // shadcn: gap-1.5 inside header (title/description)
//     actionSlot:  { enabled: false, slotLabel: 'Action', width: 80, height: 32 },
//     contentSlot: { enabled: true,  slotLabel: 'Content', minHeight: 96 },
//     footerSlot:  { enabled: true,  slotLabel: 'Footer', align: 'end', minHeight: 44 },
//   },
//
//   // Cards don't have inline icons — leave iconSlots/componentProps off.
//   iconSlots:      { leading: false, trailing: false, size: 24 },
//   componentProps: { label: false, leadingIcon: false, trailingIcon: false },
//
//   // Single 'default' state for non-interactive surface — no hover/pressed/disabled.
//   states: [{ key: 'default', group: 'default' }],
//   applyStateOverride: () => {},
//
//   properties: [
//     ['size',      '"default" | "sm"', '"default"', 'no', 'Overall padding + spacing preset.'],
//     ['className', 'string',            '—',        'no', 'Tailwind class escape hatch.'],
//   ],
//   usageDo: [
//     'Use `Card` to group related content onto a single surface.',
//     'Compose with `CardHeader`, `CardContent`, and `CardFooter` sub-components.',
//     'Prefer `size="sm"` for dense grids; keep `default` for standalone cards.',
//   ],
//   usageDont: [
//     'Don\'t nest cards more than one level deep.',
//     'Don\'t use a card just to hold a single paragraph of plain text.',
//     'Don\'t override the background color inline — use the token variable.',
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'field'` CONFIG shape (Input, Textarea, Select)
// Matches https://ui.shadcn.com/docs/components/radix/input.
//
// const CONFIG = {
//   component: 'input',
//   title:     'Input',
//   pageName:  '↳ Text Field',
//   summary:   'Single-line text field with label, placeholder, and optional helper text.',
//   layout:    'field',
//   variants:  ['default', 'invalid', 'disabled'],
//   sizes:     ['sm', 'default', 'lg'],
//   style: {
//     default:  { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content',       strokeVar: 'color/border/default' },
//     invalid:  { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content',       strokeVar: 'color/error/default'  },
//     disabled: { fill: 'color/background/variant', fallback: '#f4f4f5', labelVar: 'color/background/content-muted', strokeVar: 'color/border/subtle'  },
//   },
//   padH:   { default: 'space/md', sm: 'space/sm', lg: 'space/md' },
//   radius: 'radius/md',
//   field: {
//     fieldType:       'input',            // 'input' | 'textarea' | 'select' | 'otp'
//     showLabel:       true,
//     labelText:       'Email',
//     labelStyleName:  'Label/SM',
//     placeholderText: 'you@example.com',
//     showHelper:      true,
//     helperText:      "We'll never share your email.",
//     leadingIcon:     false,              // show icon-slot/leading inside field
//     trailingIcon:    false,              // show icon-slot/trailing (Select auto-enables chevron)
//     width:           320,
//   },
//   componentProps: { label: true, placeholder: true, helper: true, leadingIcon: false, trailingIcon: false },
//   states: [
//     { key: 'default',  group: 'default'  },
//     { key: 'hover',    group: 'default'  },
//     { key: 'focus',    group: 'default'  },
//     { key: 'disabled', group: 'disabled' },
//   ],
//   applyStateOverride: (inst, st) => { if (st === 'disabled') inst.opacity = 0.5; },
//   properties: [
//     ['size',        '"default" | "sm" | "lg"',          '"default"', 'no', 'Height + text-size preset.'],
//     ['placeholder', 'string',                           '—',         'no', 'Placeholder text.'],
//     ['disabled',    'boolean',                          'false',     'no', 'Disables input.'],
//     ['className',   'string',                           '—',         'no', 'Tailwind class escape hatch.'],
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'row-item'` CONFIG shape (Dropdown Item, Menubar, Item)
// Matches https://ui.shadcn.com/docs/components/radix/dropdown-menu.
//
// const CONFIG = {
//   component: 'dropdown-menu-item',
//   title:     'Dropdown Menu Item',
//   pageName:  '↳ Dropdown Menu',
//   summary:   'A row inside a dropdown/context/command menu with icon, label, and optional shortcut.',
//   layout:    'row-item',
//   variants:  ['default', 'destructive'],
//   sizes:     [],
//   style: {
//     default:     { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: null },
//     destructive: { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/error/default',      strokeVar: null },
//   },
//   padH:   { default: 'space/sm' },
//   radius: 'radius/sm',
//   row: {
//     titleText:         'Profile',
//     descriptionText:   null,              // omit for compact menu items; set for the richer Item archetype
//     leadingIcon:       true,
//     trailingIcon:      false,
//     trailingIsChevron: false,
//     shortcut:          true,
//     shortcutText:      '⌘P',
//     titleStyleName:    'Label/SM',
//     width:             280,
//   },
//   componentProps: { title: true, description: false, shortcut: true, leadingIcon: true, trailingIcon: false },
//   states: [
//     { key: 'default',  group: 'default'  },
//     { key: 'hover',    group: 'default'  },
//     { key: 'disabled', group: 'disabled' },
//   ],
//   applyStateOverride: (inst, st) => {
//     if (st === 'hover')    inst.opacity = 0.92;
//     if (st === 'disabled') inst.opacity = 0.5;
//   },
//   properties: [
//     ['inset',    'boolean', 'false', 'no', 'Indents to align with items that have leading icons.'],
//     ['disabled', 'boolean', 'false', 'no', 'Disables interaction.'],
//     ['className','string',  '—',     'no', 'Tailwind class escape hatch.'],
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'tiny'` CONFIG shape (Separator, Skeleton, Spinner, Progress, Avatar)
// Matches https://ui.shadcn.com/docs/components/radix/separator,
//         https://ui.shadcn.com/docs/components/radix/skeleton,
//         https://ui.shadcn.com/docs/components/radix/avatar,
//         https://ui.shadcn.com/docs/components/radix/progress.
//
// const CONFIG = {
//   component: 'separator',
//   title:     'Separator',
//   pageName:  '↳ Dividers',
//   summary:   'A thin line that separates content — horizontal or vertical.',
//   layout:    'tiny',
//   variants:  ['horizontal', 'vertical'],
//   sizes:     [],
//   style: {
//     horizontal: { fill: 'color/border/default', fallback: '#e5e7eb', labelVar: 'color/background/content', strokeVar: 'color/border/default' },
//     vertical:   { fill: 'color/border/default', fallback: '#e5e7eb', labelVar: 'color/background/content', strokeVar: 'color/border/default' },
//   },
//   padH:   { default: 'space/none' },
//   radius: 'radius/none',
//   tiny: {
//     shape:       'separator',   // 'separator' | 'skeleton' | 'spinner' | 'progress' | 'avatar' | 'aspect-ratio' | 'scroll-area'
//     orientation: 'horizontal',  // separator-only
//     width:       240,
//     height:      1,
//     // per-shape extras:
//     // skeleton: { shape: 'skeleton', width: 200, height: 16 }
//     // spinner:  { shape: 'spinner',  size: 24 }
//     // progress: { shape: 'progress', width: 280, height: 8, filled: 0.4 }
//     // avatar:   { shape: 'avatar',   size: 40, initials: 'AB' }
//   },
//   states: [{ key: 'default', group: 'default' }],
//   applyStateOverride: () => {},
//   properties: [
//     ['orientation', '"horizontal" | "vertical"', '"horizontal"', 'no', 'Axis of the separator.'],
//     ['className',   'string',                    '—',            'no', 'Tailwind class escape hatch.'],
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'control'` CONFIG shape (Checkbox, Radio, Switch)
// Matches https://ui.shadcn.com/docs/components/radix/checkbox,
//         https://ui.shadcn.com/docs/components/radix/radio-group,
//         https://ui.shadcn.com/docs/components/radix/switch.
//
// Control components promote `checked` (or `pressed`) to a Figma variant
// property because the checked glyph IS the visual axis. The draw engine
// detects `checked=true`/`pressed=true`/`on` in the variant name to render
// the filled/indicator state.
//
// const CONFIG = {
//   component: 'checkbox',
//   title:     'Checkbox',
//   pageName:  '↳ Checkbox',
//   summary:   'Binary input. Checked state shows a checkmark glyph.',
//   layout:    'control',
//   variants:  ['unchecked', 'checked'],
//   sizes:     [],
//   style: {
//     unchecked: { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: 'color/border/default' },
//     checked:   { fill: 'color/primary/default',    fallback: '#1a1a1a', labelVar: 'color/primary/content',    strokeVar: 'color/primary/default' },
//   },
//   padH:   { default: 'space/none' },
//   radius: 'radius/sm',
//   control: {
//     shape:         'checkbox',   // 'checkbox' | 'radio' | 'switch'
//     size:          16,
//     indicatorVar:  'color/primary/content',
//     // switch-only:
//     // width: 36, height: 20,
//     // trackOnVar: 'color/primary/default', trackOffVar: 'color/background/variant', thumbVar: 'color/background/default',
//   },
//   states: [
//     { key: 'default',  group: 'default'  },
//     { key: 'hover',    group: 'default'  },
//     { key: 'disabled', group: 'disabled' },
//   ],
//   applyStateOverride: (inst, st) => {
//     if (st === 'hover')    inst.opacity = 0.92;
//     if (st === 'disabled') inst.opacity = 0.5;
//   },
//   properties: [
//     ['checked',  'boolean', 'false', 'no', 'Controlled checked state.'],
//     ['disabled', 'boolean', 'false', 'no', 'Disables interaction.'],
//     ['className','string',  '—',     'no', 'Tailwind class escape hatch.'],
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// REFERENCE — `layout: 'container'` CONFIG shape (Accordion, Tabs)
// Matches https://ui.shadcn.com/docs/components/radix/accordion,
//         https://ui.shadcn.com/docs/components/radix/tabs.
//
// const CONFIG = {
//   component: 'accordion',
//   title:     'Accordion',
//   pageName:  '↳ Accordion',
//   summary:   'Stack of collapsible panels. Expanded state reveals content.',
//   layout:    'container',
//   variants:  ['collapsed', 'expanded'],
//   sizes:     [],
//   style: {
//     collapsed: { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: 'color/border/subtle' },
//     expanded:  { fill: 'color/background/default', fallback: '#ffffff', labelVar: 'color/background/content', strokeVar: 'color/border/subtle' },
//   },
//   padH:   { default: 'space/none' },
//   radius: 'radius/none',
//   container: {
//     kind:      'accordion',    // 'accordion' | 'tabs'
//     width:     360,
//     titleText: 'Is it accessible?',
//     panelText: 'Yes. It adheres to the WAI-ARIA design pattern.',
//     // tabs-only:
//     // tabs: ['Account', 'Password', 'Notifications'], activeIndex: 0, panelMinHeight: 120,
//   },
//   componentProps: { title: true, content: true },
//   states: [{ key: 'default', group: 'default' }],
//   applyStateOverride: () => {},
//   properties: [
//     ['type',     '"single" | "multiple"', '"single"', 'no', 'Allow one or many open panels.'],
//     ['collapsible','boolean',              'false',   'no', 'Allow closing all panels when type="single".'],
//     ['className','string',                 '—',       'no', 'Tailwind class escape hatch.'],
//   ],
// };
// ─────────────────────────────────────────────────────────────────────────

// REGISTRY PREFILL (atomic composition — Step 5.1) — agent replaces literals
// after reading `.designops-registry.json` at repo root before each use_figma:
//   ACTIVE_FILE_KEY     string | null   — null skips the fileKey gate
//   REGISTRY_COMPONENTS Record<kebab, { nodeId, key, pageName, publishedAt?, version?, cvaHash? }>
const ACTIVE_FILE_KEY = null;
const REGISTRY_COMPONENTS = {};
const usesComposes = Array.isArray(CONFIG.composes) && CONFIG.composes.length > 0;

// fileKey gate — WARNING ONLY, NEVER THROW.
//
// `figma.fileKey` is unreliable as a file-identity check across several
// common Figma scenarios — a throw here blocks legitimate draws:
//   • Branch files — returns the branch's internal key, not the URL's.
//   • Shared-library / team-library context — returns the library key, not
//     the host file the designer is actually editing in.
//   • Duplicated / unpublished files — internal key differs from the URL
//     segment until the file is first published.
//   • Some plugin execution contexts where the field is stubbed / empty.
//
// The registry uses `ACTIVE_FILE_KEY` purely for the composition mapping
// in `REGISTRY_COMPONENTS` (Step 5.1). A mismatch is a soft warning — the
// draw still proceeds against the currently-open Figma page. If the agent
// was pointed at the wrong file, the mismatch warning + the "no composes
// resolved" error at draw time will surface the problem; it's safer than
// blocking every branch / duplicated / library-linked file outright.
//
// If you genuinely need a hard stop, change `logFileKeyMismatch` below.
function logFileKeyMismatch(expected, actual) {
  console.warn(
    `[create-component] fileKey mismatch — registry expects "${expected}" but ` +
      `figma.fileKey is "${actual || '(empty)'}". Continuing anyway; this is common ` +
      'in branch / shared-library / duplicated files where figma.fileKey returns a ' +
      'different value than the URL segment. If registry-bound composes fail to ' +
      'resolve, delete or reset `.designops-registry.json` or open the correct file.',
  );
}

const _fileKeyObserved = (typeof figma.fileKey === 'string' && figma.fileKey) || null;
const _fileKeyMismatch =
  ACTIVE_FILE_KEY && _fileKeyObserved && _fileKeyObserved !== ACTIVE_FILE_KEY;
if (_fileKeyMismatch) {
  logFileKeyMismatch(ACTIVE_FILE_KEY, _fileKeyObserved);
}

```

### §§1 – 6.9 — Draw engine + archetype builders (inlined from committed templates)

> See the **Script-assembly order** block at the top of this SKILL for the required Read/inline sequence — don't duplicate the instructions here.

For the archetype → component routing table, see [`conventions/02-archetype-routing.md §3.1.1`](./conventions/02-archetype-routing.md). For the doc-pipeline contract (inputs, outputs, forbidden forks), see [`conventions/04-doc-pipeline-contract.md §3.1.3`](./conventions/04-doc-pipeline-contract.md).


### §6.M — `use_figma` migration (`--migrate-to-instances`, Phase 6)

Use this **instead of** the default §6 draw block when Step 1 selected `--migrate-to-instances` with strategy **`in-place`**.

**Preflight audit (read-only, before any Figma write):**

1. Confirm `.designops-registry.json` has `components[{name}]` for the composite and every `composes[].component`.
2. Grep repo `**/*.figma.tsx` for `node-id=` / `nodeId=` matching the composite `nodeId` (URL-encoded). List hits — designer should know mappings may need URL refresh after migration.
3. If `get_metadata` (or equivalent) can count prototype reactions targeting the composite or its matrix, report the count; otherwise print `prototype impact: unknown — proceed with caution`.
4. **AskUserQuestion** once: summarize audit + strategy; require explicit **yes** before `use_figma`.

**Plugin run:** Copy [`templates/migrate-composed-variants.figma.js`](./templates/migrate-composed-variants.figma.js). Before execution, the agent must inject:

- Full **`CONFIG`** (Mode A merge — must include `composes[]`, `variants`, `sizes`, `style`, `padH`, `radius`, `pageName`).
- **`REGISTRY_COMPONENTS`** map (Step 5.1).
- **`MIGRATE_COMP_SET_ID`** string literal = `registry.components[CONFIG.component].nodeId`.

**Post-run:** Build `tmp-entry.json` = `{ fileKey, ...returnPayload.registryEntry }` (include `fileKey` from the active file) and run `node skills/create-component/resolver/merge-registry.mjs .designops-registry.json tmp-entry.json`. Re-run §9-style checks on returned `variantMastersUpdated`.

**`dual-page` strategy:** Do not use §6.M. Scaffold `↳ {CONFIG.pageName} (v2)` per plan §7.2, then run the **full** §6 template on that page as a normal draw (creates a new ComponentSet — designer accepts new `nodeId` / Code Connect URL churn).

**Stop-ship check — if what you see on canvas is a single horizontal strip of tiny variant components and nothing else, you stopped at `combineAsVariants`.** That is the deprecated output. The script REQUIRES you to continue through sections 6.5–6.9 and execute `buildPropertiesTable`, `buildMatrix`, and `buildUsageNotes` in the same `use_figma` call. The three helpers are defined in [`templates/draw-engine.figma.js`](./templates/draw-engine.figma.js) (§§6.5–6.9) and inlined into the runtime bundle at [`templates/create-component-engine.min.figma.js`](./templates/create-component-engine.min.figma.js) — `Read` the bundle in full and inline it verbatim per the script-assembly order at the top of this SKILL. Do not replace them with calls to a library that does not exist in the plugin context.

**Adapting this template to other components — edit ONLY the `CONFIG` object at §0.** The draw engine (§1–§6, now in `templates/draw-engine.figma.js`) is identical for every component. If you find yourself editing anything below `CONFIG`, stop — you are forking, not configuring.

| Change | Edit in `CONFIG` |
|---|---|
| Different component | Replace the whole `CONFIG` — `component`, `title`, `pageName`, `summary`, `variants`, `sizes`, `style`, `padH`, `radius`, `label`, `labelStyle`, `iconSlots`, `componentProps`, `states`, `applyStateOverride`, `properties`, `usageDo`, `usageDont`, optional `composes` (see [`conventions/02-archetype-routing.md §3.05`](./conventions/02-archetype-routing.md)). |
| Composite with `composes[]` | Declare `composes` in `shadcn-props.json`; run §4.5.g; ensure each child exists in `.designops-registry.json` before draw (Step 5.1 injection). Matrix cells contain real child instances under `slot/{slot}`. |
| No size axis (badge, alert) | `sizes: []` — matrix drops the 60px size-label column; ComponentSet variant names become `variant=X` only. |
| Single variant only (card, separator) | `variants: ['default']` — matrix draws one row. |
| Single state only (overlays, dialogs) | `states: [{ key: 'open', group: 'default' }]` — no DISABLED header group. |
| State IS a Figma variant prop (checkbox, switch) | In `applyStateOverride`, call `instance.setProperties({ disabled: stateKey === 'disabled' ? 'true' : 'false' })` instead of opacity overrides — no schema change needed. |
| Non-default padding/radius | Adjust `padH` per size and/or `radius`. |
| Icon-only slot inside a size | Have `label(size)` return `null` for that size — a single centered `icon-slot/center` is drawn, padding becomes square. (Legacy `'⬡'` glyph is deprecated.) |
| No leading / trailing icons | `iconSlots: { leading: false, trailing: false }` — slots are skipped entirely and the corresponding BOOLEAN component props aren't added. |
| Icons only on one side | `iconSlots: { leading: true, trailing: false }` (or vice versa) — only the enabled slot is rendered and only its matching BOOLEAN prop is added. |
| No designer-facing text/boolean props | `componentProps: { label: false, leadingIcon: false, trailingIcon: false }` — the ComponentSet still works, but designers have to detach to edit text. Not recommended for a production design system. |

**Variant properties in the ComponentSet** — keep these as Figma variant props (they appear in the Properties panel when an instance is selected):

| Component | Figma variant properties | Example variant name |
|---|---|---|
| `button` | `variant`(6) × `size`(4) = **24** | `variant=outline, size=sm` |
| `toggle`, `toggle-group` | `variant`(2) × `size`(3) × `pressed`(false/true) | `variant=default, size=sm, pressed=false` |
| `checkbox` | `checked`(false/true/indeterminate) × `disabled`(false/true) = **6** | `checked=true, disabled=false` |
| `radio-group`, `switch` | `checked`/`selected`(false/true) × `disabled`(false/true) = **4** | `checked=true, disabled=false` |
| `badge`, `alert` | `variant` only | `variant=destructive` |
| `input`, `textarea`, `select` | no Figma variants — use instance overrides for focus/error/disabled | `Component` (single root) |
| `dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `menubar`, `command`, `navigation-menu` | no Figma variants (only `open` state is visible) | `Component` |
| `card`, `separator`, `form`, `label`, `aspect-ratio`, `scroll-area`, `resizable`, `slider`, `input-otp`, `calendar`, `date-picker`, `sonner`, `toast`, `breadcrumb`, `pagination`, `table`, `accordion`, `collapsible`, `avatar`, `progress`, `skeleton`, `tabs` | no Figma variants | `Component` |

**Matrix state axis** — what columns the matrix draws, read from the component's category in [`conventions/04-doc-pipeline-contract.md § 7`](./conventions/04-doc-pipeline-contract.md):

| Category | Components | States (grouped DEFAULT \| DISABLED) |
|---|---|---|
| Button-like | `button`, `toggle`, `toggle-group` | `default` · `hover` · `pressed` \| `disabled` |
| Input-like | `input`, `textarea`, `select` | `default` · `focus` · `error` \| `disabled` |
| Checkable | `checkbox`, `radio-group`, `switch` | `unchecked` · `checked` · `indeterminate`† \| `disabled` |
| Tabs / segmented | `tabs`, `navigation-menu`, `menubar` | `inactive` · `hover` · `active` \| `disabled` |
| Link / nav | `breadcrumb`, `pagination` | `default` · `hover` · `active` \| `disabled` |
| Slider | `slider` | `default` · `hover` · `dragging` \| `disabled` |
| Anchored overlay | `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `command` | `open` (single column) |
| Modal overlay | `dialog`, `alert-dialog`, `drawer`, `sheet` | `open` (single column) |
| Display / status | `alert`, `badge`, `progress`, `skeleton`, `avatar`, `sonner`, `toast` | `default` (single column) |
| Structure | `card`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `accordion`, `collapsible`, `table`, `form`, `label`, `calendar`, `date-picker`, `input-otp` | `default` (single column) |

† `indeterminate` is checkbox-only; omit for radio / switch.

**State handling rule:** if a state maps to an existing Figma variant prop (e.g. `checkbox` disabled), populate the cell by calling `instance.setProperties({ disabled: 'true' })`. Otherwise, the state is a **visual overlay** applied to the instance (hover/pressed for buttons) — see the `applyStateOverride` callback in the template above and the decision tree in [`conventions/04-doc-pipeline-contract.md § 13.1`](./conventions/04-doc-pipeline-contract.md).

**Fill / padding guidance per shadcn variant** (same as earlier revisions; unchanged except that these feed `buildVariant` via the `fill`/`lv`/`stroke` keys, not a separate layout helper):

| Component | Variant | Fill variable |
|---|---|---|
| `badge` | default / secondary / destructive / outline | `color/primary/default` · `color/secondary/default` · `color/error/default` · `color/background/default` + stroke |
| `alert` | default / destructive | `color/background/variant` · `color/error/subtle` |
| `toggle` | default / outline | `color/background/default` (stroke on outline) |
| `avatar` | size sm / md / lg | `color/background/variant`; vary padH |
| `progress` | value 0 / 25 / 50 / 75 / 100 | track `color/background/variant`, indicator `color/primary/default` |

For cards, sheets, dialogs use `radiusVar: 'radius/lg'`. For compact items (label, separator) use `padH: 'space/xs'`.

If any collection is absent, `getColorVar` / `getLayoutVar` / `getTypoVar` return null and bindings fall back to the hardcoded hex / px fallbacks — no separate branch needed.

If the `use_figma` call throws, mark the component `draw_failed` and continue to the next.

### Step 7 — Offer Code Connect chaining

After all components have been processed, call **AskUserQuestion**: "Run `/code-connect` to map the Figma components you drew to the installed shadcn/ui source files? (yes / no)"

- If **yes**, invoke `/code-connect`.
- If **no**, skip and proceed to reporting.

### Step 8 — Report results

Output a summary table:

| Component | Installed | Source | Drawn to Canvas | Matrix (variants × states × sizes) | Icon slots | Element props | Notes |
|---|---|---|---|---|---|---|---|
| `button` | Yes | `shadcn-1:1` | Yes | 6 × 4 × 4 = 96 cells | leading + trailing | Label, Leading icon, Trailing icon | ComponentSet (24 nodes) inline in doc frame; 0 unresolved classes |
| `input` | Already existed | `shadcn-1:1` | Yes | 1 × 4 × 1 = 4 cells | leading + trailing | Label, Leading icon, Trailing icon | State via instance overrides |
| `card` | Yes | `synthetic-fallback` | Yes | 1 × 1 × 1 = 1 cell | — | — | Mode A cva extract failed: `buttonVariants.base undefined`; used synthetic template |
| `dialog` | Yes | `synthetic-no-shadcn` | Failed | — | — | — | components.json absent; Figma write error: … |

`source` column values:
- **`shadcn-1:1`** — CONFIG was built in Step 4.5 from the installed shadcn source file + tokens.css + `shadcn-props.json`. Figma is a live mirror of the code.
- **`synthetic-fallback`** — shadcn is installed but Step 4.5 could not extract a usable CONFIG (missing source file, cva import failure, tokens.css missing, no `shadcn-props.json` entry). The synthetic Mode B template was used; list the specific cause in Notes.
- **`synthetic-no-shadcn`** — `components.json` was absent at Step 4.5.a, so Mode A was never attempted. Mode B synthetic template used.

Follow with:
- Total installed: N
- Total drawn to canvas: N
- Skipped / failed: N (list names and reasons)
- Mode A coverage: N of M components drawn as `shadcn-1:1`
- Unresolved classes (Mode A only): flat list of `{ component, tailwindClass, reason }` from the resolver output for every component — zero is the target
- Token binding status: "Theme/Layout/Typography collections found — bindings applied" or list which collections were absent and that raw fallback values were used
- CSS token wiring: "Imported `{TOKEN_CSS_PATH}` into `{globals_css_path}`" or "tokens.css not found — shadcn default variables retained" if skipped
- **Registry (atomic composition):** for each component that passed §9, merge `returnPayload.registryEntry` into repo-root `.designops-registry.json` per Step 5.2 (fileKey + `components[kebab-name]`). List any merge errors.

---

### Step 9 — Self-check before reporting a component "drawn"

> **Run these assertions against the JSON return payload from each §6 `use_figma` call.** If any assertion fails, the component is NOT drawn — mark it `failed` in Step 8, surface the failing assertion ID verbatim, and do not offer Code Connect chaining for that component. A smaller model (Sonnet, Haiku) must be able to evaluate every assertion mechanically without extra inference.

Every assertion ID below (`S9.1` … `S9.9`) maps 1:1 to an audit-checklist item in [`conventions/06-audit-checklist.md` §14](./conventions/06-audit-checklist.md).

| ID | Assertion (evaluate against `draw-engine.figma.js §6` return payload) | Failure action |
|----|-----------------------------------------------|----------------|
| **S9.1** | `pageName === CONFIG.pageName` and `docRootChildren >= 2` (at minimum `_Header` + `_PageContent`) | Re-run `draw-engine.figma.js §6.0` page clear + `§6.3` doc frame build |
| **S9.2** | `compSetName === \`${CONFIG.title} — ComponentSet\`` | The naming convention was bypassed — fix CONFIG.title and re-run |
| **S9.3** | `compSetVariants.length === CONFIG.variants.length × max(CONFIG.sizes.length, 1)` | Missing variants — inspect buildVariant call-site and `combineAsVariants` input |
| **S9.4** | `compSetParent` ends with `doc/component/{component}/component-set-group` (ComponentSet reparented into the doc frame, not parked off-canvas) | `draw-engine.figma.js §6.4` reparent step did not run |
| **S9.5** | When `CONFIG.componentProps.label` is true: `compSetPropertyDefinitions.Label.type === 'TEXT'` and its `defaultValue` is a non-empty string | `addComponentProperty` threw or was skipped — inspect `propErrorsSample` |
| **S9.6** | When `CONFIG.componentProps.leadingIcon` is true: `compSetPropertyDefinitions['Leading icon'].type === 'BOOLEAN'`. Same for `trailingIcon` → `'Trailing icon'` | As above |
| **S9.7** | **Archetype-aware variant assembly check.** Match `returnPayload.layout`: <br>• `'chip'` — for every variant with a non-null label, `firstVariantChildren` contains `icon-slot/leading`, a text node, `icon-slot/trailing` **in that reading order** (when both `iconSlots.leading` and `iconSlots.trailing` are true). <br>• `'surface-stack'` — `firstVariantChildren` contains `CardHeader` as first child; when `surface.contentSlot.enabled` (default true) also contains `CardContent`; when `surface.footerSlot.enabled` also contains `CardFooter`. <br>• `'field'` — `firstVariantChildren` contains `field` (and `Label` before it when `field.showLabel` is true, and `helper` after when `field.showHelper` is true). <br>• `'row-item'` — `firstVariantChildren` contains `row/text-stack`; `icon-slot/leading` before it when `row.leadingIcon` is not false; `icon-slot/trailing` or `icon-slot/chevron` after when `row.trailingIcon` is not false. <br>• `'tiny'` — no children required; validate size/shape via `compSet.children[0]` width/height vs `CONFIG.tiny.width/height`. <br>• `'container'` — `firstVariantChildren` contains `AccordionTrigger` + `icon-slot/chevron` (accordion) or `TabsList` + `TabsContent` (tabs). <br>• `'control'` — no children required for unchecked state; checked state contains `radio/dot` or `checkbox/check` or `switch/thumb`. <br>• `'composes'` — `firstVariantChildren` includes at least one `slot/{name}` frame whose subtree contains an `INSTANCE` node. | Variant / composition assembly is broken — inspect the builder matching `returnPayload.layout` in `draw-engine.figma.js §6.2a` |
| **S9.8** | **Atoms:** for every variant where `CONFIG.label(size, variant) === null`, `iconVariantChildren` contains exactly one child named `icon-slot/center` and **no text node**. **Composites:** skip when `composedWith.length > 0` | Icon-only mode collapsed incorrectly |
| **S9.9** | `propErrorsCount === 0` | Surface `propErrorsSample` to the designer and STOP — do not report the component drawn |

If all nine assertions pass, the component is safe to mark **Drawn to Canvas = Yes** in the Step 8 table.

> **Optional visual check (recommended, not gating):** after S9.1–S9.9 pass, call `get_screenshot` on the `_PageContent` frame's node ID. Inspect the dashed icon-slot placeholders in the matrix rows, confirm opacity ramps across `default → hover → pressed → disabled`, and verify the inline ComponentSet at the top of the doc frame. This is a human-review safety net, not a mechanical assertion.

---

## Supported Components

The following shadcn/ui components are supported. Pass any of these names to the skill.

> 🤖 The grouped list below is regenerated by `scripts/build-create-component-docs.mjs` — the script reads `shadcn-props/*.json` (split, Phase 8) and falls back to the monolithic [`shadcn-props.json`](./shadcn-props.json) if the split directory is absent. Edit the per-component files (`category` field per entry) and run `npm run build:docs` — do not hand-edit between the `<!-- GENERATED -->` markers.

<!-- GENERATED:supported-components START -->
**Form & Input**
`button` `button-group` `checkbox` `combobox` `field` `form` `input` `input-group` `input-otp` `label` `native-select` `radio-group` `select` `slider` `switch` `textarea` `toggle` `toggle-group`

**Layout & Display**
`aspect-ratio` `card` `carousel` `resizable` `scroll-area` `separator` `sidebar`

**Overlay & Dialog**
`alert-dialog` `context-menu` `dialog` `drawer` `dropdown-menu` `hover-card` `menubar` `popover` `sheet` `tooltip`

**Navigation**
`breadcrumb` `command` `navigation-menu` `pagination` `tabs`

**Feedback & Status**
`alert` `badge` `empty` `progress` `skeleton` `sonner` `spinner` `toast`

**Data Display**
`accordion` `avatar` `calendar` `chart` `collapsible` `date-picker` `item` `table`

**Typography & platform**
`direction` `kbd` `typography`
<!-- GENERATED:supported-components END -->

---

## CLI Reference

| Command | Purpose |
|---|---|
| `npx shadcn@latest init` | Initialize shadcn in the current project (creates `components.json`) |
| `npx shadcn@latest add [component]` | Install a single component into the project |
| `npx shadcn@latest add [c1] [c2] ...` | Install multiple components in one invocation |
| `npx shadcn@latest diff` | Show which installed components are out of date |
| `node …/resolver/validate-composes.mjs <shadcn-props.json> <component\|--all> [--project <root>]` | Validate `composes[]` (Step 4.5.g) |
| `node …/resolver/merge-registry.mjs <.designops-registry.json> <entry.json>` | Upsert one registry record after a successful draw (Step 5.2) |

---

## Notes

- **No manual Figma community kit import required.** Components are installed from the shadcn CLI into the local codebase, and the agent draws them directly to the Figma canvas as proper Figma components using `figma.createComponent()` and `figma.combineAsVariants()`. These are real Figma components with component keys — required for Code Connect to resolve mappings.
- **Matrix-default layout.** Every component renders into a 5-section documentation frame (header → properties table → live Component Set section → variant × state matrix → Do/Don't usage notes) at 1640px inner width on a 1800px `_PageContent`. This matches the canvas geometry used by `/create-design-system` style-guide pages so the entire file reads as one system. The `ComponentSet` is reparented **inline** into the doc frame as a horizontal-wrap auto-layout grid — designers edit variants in place, and every matrix instance below updates automatically from that source. See [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) §3.2 for the Component Set section layout, [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) §3.1 for the `CONFIG` schema, and [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) for the full audit checklist.
- **Labels use published text styles.** Inner variant labels bind to the Typography system's `Label/*` text styles (per-size via `CONFIG.labelStyle`), so every component label stays in sync with the type scale — no stray `fontSize: 14` overrides.
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent routes each component to its designated page in the Detroit Labs Foundations scaffold (see Step 5 routing table) using `figma.setCurrentPageAsync`. If the file was not scaffolded by `/new-project`, it falls back to the current active page with a warning.
- **Token bindings** are a best-effort match based on variable names in the `Theme`, `Layout`, and `Typography` collections created by `/create-design-system`. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.
