---
name: create-component
description: Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.
argument-hint: "[component...] — e.g. /create-component button input card. If omitted, the agent shows the full component list and prompts."
agent: general-purpose
---

# Skill: /create-component

Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.

> **Before you draw anything, read** [`CONVENTIONS.md`](./CONVENTIONS.md) — the quick-reference guide that agents (Sonnet, Haiku, future Claude versions) can load to match the house style on the first pass. It documents the canvas geometry, the matrix-default layout, the properties table, state / variant / size axes, the `Doc/*` text styles, and the audit checklist. Every rule in this SKILL should round-trip with that file; if they ever disagree, **this SKILL is authoritative** and `CONVENTIONS.md` must be updated to match.

---

## §0 — Quickstart recipe for any agent

> **This section is the single canonical recipe.** Any agent (Opus, Sonnet, Haiku, future Claude) opening this skill cold can follow §0 end-to-end without reading the rest of the document first. Deeper context lives in the numbered sections linked below. If §0 and a deeper section ever disagree, §0 is authoritative.

**Outcome:** for each requested component, one ComponentSet drawn into its target `↳ {Page}`, wrapped in a documentation frame (header → properties table → inline ComponentSet → Variant × State matrix → Usage Do/Don't), with element component properties unified at the ComponentSet level (`Label`, `Leading icon`, `Trailing icon`), bound to the user's Theme/Layout/Typography variables.

**Tools you will use:** `AskUserQuestion`, `Shell` (for `npx shadcn@latest` + file reads), `Read` / `Glob` / `Grep`, `use_figma` (one call per component), `get_screenshot` (final visual check).

**Seven steps. Do not skip any.**

| # | Step | Tool | Required inputs | Expected outcome |
|---|------|------|-----------------|------------------|
| 1 | Resolve component list | `AskUserQuestion` (if missing) | argument-hint list or designer reply | `components: string[]` of kebab-case shadcn names (`button`, `input`, …) |
| 2 | Locate `tokens.css` | `Read` / `Glob` | repo path | `TOKEN_CSS_PATH: string \| null` — absolute path or `null` if designer skipped |
| 3 | Initialize shadcn + wire tokens | `Shell` + `AskUserQuestion` | `components.json` presence check | `components.json` exists, `tokens.css` imported at top of `globals.css`, variable-declaration blocks removed |
| 4 | Install each component | `Shell` | `npx shadcn@latest add {component}` | Files written under `components/ui/`, per-component status `installed \| already_exists \| failed` |
| 5 | Resolve Figma file key | handoff lookup → `AskUserQuestion` fallback | `templates/agent-handoff.md` frontmatter | `fileKey: string` |
| 6 | Draw component → Figma | `use_figma` (one call per component) | `fileKey`, `CONFIG` block per §6 | Return payload with `{ compSetId, compSetVariants, compSetPropertyDefinitions, firstVariantChildren, iconVariantChildren, propErrorsCount, … }` |
| 7 | Self-check the return payload | agent-side assertions per §9 | step 6's return JSON | Zero drift; if any assertion fails, stop and report — do not mark the component done |

### §0.1 — Decision tree for edge cases

- **No components provided** → step 1 prompts with the full supported list (see the routing table in §6).
- **`tokens.css` not found** → step 2 prompts; reply `skip` sets `TOKEN_CSS_PATH = null` and canvas uses hex fallbacks.
- **shadcn not initialized** → step 3 prompts to run `npx shadcn@latest init`; if declined, stop the skill.
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
| Install per component | §4 |
| File-key resolution | §5 |
| The `use_figma` template (CONFIG + draw engine) | §6 |
| Reporting table | §8 |
| Self-check before reporting "drawn" | §9 |
| Icon slots + element properties spec | [CONVENTIONS.md §3.3](./CONVENTIONS.md) |
| State override policy | [CONVENTIONS.md §13.1](./CONVENTIONS.md) |
| Audit checklist | [CONVENTIONS.md §14](./CONVENTIONS.md) |

---

## Interactive input contract

When this skill needs designer input (component list, Figma file key, shadcn init choices, optional `/code-connect` chaining), use **AskUserQuestion** — **one question per tool call**, wait for each reply before the next. Do not dump multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **shadcn-compatible project** — Next.js, Vite, Remix, or any React framework supported by shadcn/ui. The project must have a `package.json` at its root.
- **`/create-design-system` run first** — Token variable bindings in Figma come from the `Theme`, `Layout`, and `Typography` collections. The CSS token file (`tokens.css`) written by `/create-design-system` must also exist in the local project — this is what components import for their CSS custom properties. If the file is absent, components are drawn to canvas with hardcoded fallback values and a warning is reported.
- **Active Figma file open** — The agent needs a target Figma file key. This is taken from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Figma MCP connector authenticated** — All canvas writes use `mcp__claude_ai_Figma__*` tools. No separate PAT setup required.

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

### Step 4 — Install components

For each component in the list:

1. Run `npx shadcn@latest add [component]` (e.g. `npx shadcn@latest add button`).
   - If a shadcn MCP tool is available in the current session, use it as an equivalent alternative.
2. Confirm that the component files were written to the project (typically under `components/ui/`).
3. Track install status per component: `installed`, `already_exists`, or `failed`.

If a component install fails, log the error, mark it `failed`, and continue to the next component — do not abort the entire run.

### Step 4.5 — Extract source-of-truth CONFIG (Mode A)

> **Goal:** Make the **installed shadcn source file** authoritative for every component, so Figma cannot drift when the designer/developer customizes `components/ui/*.tsx`. See [CONVENTIONS.md §0](./CONVENTIONS.md) for the Mode A vs Mode B contract.

This step runs **per installed component** immediately after Step 4 and before Step 6's draw loop. Each component gets a `CONFIG` assembled from three inputs:

1. **cva variants** — extracted at runtime from the installed source file.
2. **Tailwind class tokens** — resolved against `tokens.css` to Figma variable paths.
3. **Prop surface / icon slots / page routing** — read from the curated map in [`shadcn-props.json`](./shadcn-props.json).

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

The resolver returns a bucketed JSON payload (`fills`, `strokes`, `radii`, `spacing`, `typography`, `effects`, `layout`, `unresolved`) with a `state` field (`base`, `hover`, `focus-visible`, `disabled`, …) on every entry. See [CONVENTIONS.md §3.4](./CONVENTIONS.md) for the full resolution map.

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
| `label`, `iconSlots`, `componentProps`, `properties`, `usageDo`, `usageDont`, `composes` | `shadcn-props.json[component]` (`composes` optional; see §4.5.g and [`CONVENTIONS.md`](./CONVENTIONS.md) §3.05) |
| `states`, `applyStateOverride` | `shadcn-props.json[component]` defaults (see §4.5.e) |
| `defaultVariant` | `cvaOutput.defaultVariants.variant` → feed to §6.6D as the ComponentSet default |
| `defaultSize` | `cvaOutput.defaultVariants.size` → feed to §6.6D |

Record every resolver `unresolved[]` entry in the run report under `unresolvedClasses` for the component. Do not abort on unresolved classes — the draw engine falls back to fallback hex and raw px where the token is null.

#### 4.5.e — State override policy in Mode A

The cva variant axes shadcn ships almost never include a `state` axis (pressed / hover are Tailwind pseudo-classes, not cva variants). Keep `CONFIG.states` from `shadcn-props.json` and the `applyStateOverride` default from [CONVENTIONS.md §13.1](./CONVENTIONS.md) — opacity is the authoritative mechanism, and the resolver's `hover:*` / `disabled:*` bindings are surfaced in the run report only for audit purposes (e.g. so you can confirm `hover` really is an opacity change on the default variant).

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
> **Default layout = matrix.** Every component — single-state, single-variant, or full cross-product — renders into a **Variant × State specimen matrix** inside a documentation frame that also carries a properties/types table and Do/Don't usage notes. The flat wrapping "grid of variants" output from earlier revisions of this skill is **deprecated**. See [`CONVENTIONS.md`](./CONVENTIONS.md) §§ 1–14 for the full spec.
>
> **One component per page.** The page is already scaffolded by `/new-project` step 5b — do not create pages here. Delete every node other than `_Header`, then build `_PageContent` + the doc frame.

> **Migration (Phase 6 — opt-in):** rewriting legacy flat-shape composites to instance stacks in place (`--migrate-to-instances`) is specified in [`plans/create-component_atomic-composition.plan.md`](../../plans/create-component_atomic-composition.plan.md) §7. The §6 template below covers **new draws and full redraws**; run the migration flow only after that plan's pre-migration audit when a file already has inbound references.

For each successfully installed component, make **one `use_figma` call** using the complete template below.

**Component → Page routing** (pick the row for your component and use it as `CONFIG.pageName`):

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
// Schema: CONVENTIONS.md §3. Every subsequent section (§1 through §6) reads
// from CONFIG and never from Button-specific constants. If a new component
// needs behavior this schema doesn't model, extend the schema rather than
// hardcoding inline.

const CONFIG = {
  component: 'button',                // kebab-case, matches shadcn filename
  title:     'Button',                // display title (header, page references)
  pageName:  '↳ Buttons',             // target page; see routing table above
  summary:   'Trigger an action or navigate. Follows shadcn/ui defaults — six variants, four sizes.',

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

// REGISTRY PREFILL (atomic composition — Step 5.1) — agent replaces literals
// after reading `.designops-registry.json` at repo root before each use_figma:
//   ACTIVE_FILE_KEY     string | null   — null skips the fileKey gate
//   REGISTRY_COMPONENTS Record<kebab, { nodeId, key, pageName, publishedAt?, version?, cvaHash? }>
const ACTIVE_FILE_KEY = null;
const REGISTRY_COMPONENTS = {};
const usesComposes = Array.isArray(CONFIG.composes) && CONFIG.composes.length > 0;

if (ACTIVE_FILE_KEY && typeof figma.fileKey === 'string' && figma.fileKey !== ACTIVE_FILE_KEY) {
  throw new Error(
    `designops-registry fileKey mismatch: registry is for "${ACTIVE_FILE_KEY}" but this file is "${figma.fileKey}". ` +
      'Delete or reset `.designops-registry.json`, or open the correct Figma file.',
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Everything below this line is IDENTICAL for every component.
// Do not edit per component.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Navigate to target page (must be in same call as creation) ──────
const targetPage = figma.root.children.find(p => p.name === CONFIG.pageName)
  ?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);

// ── 2. Resolve variable collections ─────────────────────────────────────
const collections = figma.variables.getLocalVariableCollections();
const allVars = figma.variables.getLocalVariables();

// Theme → color tokens  (color/primary/default, color/background/default, color/background/content, …)
const themeCol = collections.find(c => c.name === 'Theme');
const themeVars = themeCol ? allVars.filter(v => v.variableCollectionId === themeCol.id) : [];
const getColorVar = name => themeVars.find(v => v.name === name) ?? null;

// Layout → spacing and radius tokens  (space/xs, space/md, radius/md, …)
const layoutCol = collections.find(c => c.name === 'Layout');
const layoutVars = layoutCol ? allVars.filter(v => v.variableCollectionId === layoutCol.id) : [];
const getLayoutVar = name => layoutVars.find(v => v.name === name) ?? null;

// Typography → font-family STRING tokens  (Label/LG/font-family, Body/MD/font-family, …)
const typoCol = collections.find(c => c.name === 'Typography');
const typoVars = typoCol ? allVars.filter(v => v.variableCollectionId === typoCol.id) : [];
const getTypoVar = name => typoVars.find(v => v.name === name) ?? null;

// ── 3. Read font-family names from Typography collection ─────────────────
// We must know the actual font family name before calling loadFontAsync.
// Read the base mode ("100") value; fall back to "Inter" if absent.
function readTypoString(variable) {
  if (!variable || !typoCol) return null;
  const baseMode = typoCol.modes.find(m => m.name === '100');
  if (!baseMode) return null;
  const val = variable.valuesByMode[baseMode.modeId];
  return (typeof val === 'string' && val.length > 0) ? val : null;
}

const labelFontVar   = getTypoVar('Label/LG/font-family');
const displayFontVar = getTypoVar('Display/LG/font-family');
const labelFont   = readTypoString(labelFontVar)   ?? 'Inter';
const displayFont = readTypoString(displayFontVar) ?? labelFont;

// ── 4. Load fonts (must precede any text.characters assignment) ──────────
await figma.loadFontAsync({ family: labelFont,   style: 'Regular' });
await figma.loadFontAsync({ family: labelFont,   style: 'Medium'  });
if (displayFont !== labelFont) {
  await figma.loadFontAsync({ family: displayFont, style: 'Regular' });
  await figma.loadFontAsync({ family: displayFont, style: 'Medium'  });
}

// ── 5. Binding helpers ───────────────────────────────────────────────────

// Color binding: fills/strokes must use boundVariables on the paint object.
// varName is a Theme path e.g. 'color/primary', 'color/background'.
// Do NOT use setBoundVariable for color — that API is for numeric fields only.
function bindColor(node, varName, fallbackHex, target = 'fills') {
  const variable = getColorVar(varName);
  const hex = fallbackHex.replace('#', '');
  const paint = {
    type: 'SOLID',
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
  if (variable) {
    paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
  }
  node[target] = [paint];
}

// Spacing / radius binding: varName is a Layout path e.g. 'space/md', 'radius/md'.
// Always set the fallback number first so the node has a valid value even if
// the Layout collection is absent or setBoundVariable throws.
function bindNum(node, field, varName, fallback) {
  node[field] = fallback;
  const variable = getLayoutVar(varName);
  if (variable) {
    try { node.setBoundVariable(field, variable); } catch (_) {}
  }
}

// Build one fully complete ComponentNode — layout, spacing, radius, color,
// icon slots, text label, AND element component properties all applied
// and bound before this function returns. Call once per variant. Pass
// the `.component` values to combineAsVariants afterward.
//
// Children are appended in reading order:
//   [icon-slot/leading] → [text label] → [icon-slot/trailing]
// OR (when `label` is null AND at least one slot is enabled):
//   [icon-slot/center]
//
// Icon slots are 24×24 placeholder frames with no fill and a 1px dashed
// stroke bound to `color/border/default` (hex fallback #d4d4d8),
// cornerRadius 4, layoutMode NONE. The dashed outline is visible in the
// Figma editor so designers can locate drop targets on canvas, and sits
// behind any child the designer adds — final renders show the child, not
// the placeholder. Slots preserve their 24×24 footprint in auto-layout
// even while empty. See CONVENTIONS.md §3.3.1 for the authoritative spec.
//
// Per the Plugin API docs, element component properties (TEXT / BOOLEAN /
// INSTANCE_SWAP) MUST be added to each variant component BEFORE combining.
// After `combineAsVariants`, the ComponentSet merges identically-named
// properties across variants into a single ComponentSet-level property
// that designers see in the right panel.
//
// Return shape:
//   { component, slots: { leading?, trailing?, center?, label? }, propKeys }
//
// name:         Figma variant name — single-property 'variant=default' or
//               cross-product 'variant=default, size=sm' (comma+space separator)
// fillVar:      Theme path for background fill e.g. 'color/primary'
// fallbackFill: hex used when Theme collection is absent
// options:
//   label          — text inside the component; null / '' → icon-only mode
//   labelVar       — Theme path for label text color
//   strokeVar      — Theme path for stroke (null = no stroke)
//   radiusVar      — Layout path for corner radius
//   padH           — Layout path for horizontal padding
//   padV           — Layout path for vertical padding
//   labelStyleName — published text style e.g. 'Label/MD'
//   leadingSlot    — render icon-slot/leading before the label
//   trailingSlot   — render icon-slot/trailing after the label
//   iconSlotSize   — slot width/height in px (default 24)
//   addLabelProp   — add TEXT "Label" property bound to the text node
//   addLeadingProp — add BOOLEAN "Leading icon" property bound to leading slot visibility
//   addTrailingProp— add BOOLEAN "Trailing icon" property bound to trailing slot visibility
//   propLabelText  — default string for the TEXT "Label" property
function buildVariant(name, fillVar, fallbackFill, {
  label            = null,
  labelVar         = 'color/background/content',
  strokeVar        = null,
  radiusVar        = 'radius/md',
  padH             = 'space/md',
  padV             = 'space/xs',
  labelStyleName   = null,
  leadingSlot      = false,
  trailingSlot     = false,
  iconSlotSize     = 24,
  addLabelProp     = false,
  addLeadingProp   = false,
  addTrailingProp  = false,
  propLabelText    = 'Label',
} = {}) {
  const c = figma.createComponent();
  c.name = name;

  // Auto-layout
  c.layoutMode            = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  // Icon-only mode: no label → render a single centered slot, force square
  // padding so the component ends up square (matches shadcn `size=icon`).
  const hasLabel   = !!(label && String(label).length > 0);
  const anySlot    = leadingSlot || trailingSlot;
  const iconOnly   = !hasLabel && anySlot;
  const padHEff    = iconOnly ? padH : padH;      // same for both axes when icon-only
  const padVEff    = iconOnly ? padH : padV;      // square padding

  // Spacing — bind via Layout collection before combining
  bindNum(c, 'paddingLeft',   padHEff,     16);
  bindNum(c, 'paddingRight',  padHEff,     16);
  bindNum(c, 'paddingTop',    padVEff,      8);
  bindNum(c, 'paddingBottom', padVEff,      8);
  bindNum(c, 'itemSpacing',  'space/sm',    8);

  // Border radius — all four corners individually (Figma requires each separately)
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));

  // Fill
  bindColor(c, fillVar, fallbackFill, 'fills');

  // Optional stroke
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  // --- Helpers scoped to this variant -----------------------------------
  // 24×24 placeholder frame. Transparent fill + 1px dashed stroke bound
  // to `color/border/default` — invisible in renders, but discoverable
  // on the canvas and in the layers panel. Designers drop SVG content
  // into it later (stroke hides behind the child) or toggle the slot off
  // via the matching Boolean component property. `cornerRadius: 4` keeps
  // the placeholder visually distinct from the parent component chrome.
  function makeIconSlot(slotName) {
    const f = figma.createFrame();
    f.name          = slotName;
    f.layoutMode    = 'NONE';       // children, if any, are positioned manually
    f.resize(iconSlotSize, iconSlotSize);
    f.fills         = [];
    bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
    f.strokeWeight  = 1;
    f.dashPattern   = [4, 3];
    f.cornerRadius  = 4;
    f.clipsContent  = false;
    // Keep the slot from stretching with the auto-layout row
    f.layoutPositioning = 'AUTO';
    return f;
  }

  function makeLabel(text) {
    const txt = figma.createText();
    txt.fontName   = { family: labelFont, style: 'Medium' };
    txt.characters = text;
    // Prefer a published text style (Label/XS · Label/SM · Label/MD · Label/LG)
    // so every component label stays in sync with the Typography system.
    // Falls back to raw fontSize + bound font-family variable if the style
    // doesn't exist in the file yet.
    const ts = labelStyleName
      ? allTextStyles.find(s => s.name === labelStyleName)
      : null;
    if (ts) {
      txt.textStyleId = ts.id;
    } else {
      txt.fontSize = 14;
      if (labelFontVar) {
        try { txt.setBoundVariable('fontFamily', labelFontVar); } catch (_) {}
      }
    }
    bindColor(txt, labelVar, '#000000', 'fills');
    return txt;
  }

  // --- Assemble children -------------------------------------------------
  const slots = { leading: null, trailing: null, center: null, label: null };

  if (iconOnly) {
    slots.center = makeIconSlot('icon-slot/center');
    c.appendChild(slots.center);
  } else {
    if (leadingSlot) {
      slots.leading = makeIconSlot('icon-slot/leading');
      c.appendChild(slots.leading);
    }
    if (hasLabel) {
      slots.label = makeLabel(label);
      c.appendChild(slots.label);
    }
    if (trailingSlot) {
      slots.trailing = makeIconSlot('icon-slot/trailing');
      c.appendChild(slots.trailing);
    }
  }

  // --- Element component properties -------------------------------------
  // Added on THIS variant component BEFORE combineAsVariants (the API
  // contract — see figma-use/component-patterns.md). After combining,
  // the ComponentSet merges identically-named properties across variants
  // into a single set-level property that designers see in the Properties
  // panel. Each variant has its own key; we store them on `propKeys` only
  // for optional debugging / reporting downstream.
  const propKeys = {};
  try {
    if (addLabelProp && slots.label) {
      propKeys.label = c.addComponentProperty('Label', 'TEXT', String(propLabelText));
      slots.label.componentPropertyReferences = { characters: propKeys.label };
    }
    if (addLeadingProp && slots.leading) {
      propKeys.leadingIcon = c.addComponentProperty('Leading icon', 'BOOLEAN', true);
      slots.leading.componentPropertyReferences = { visible: propKeys.leadingIcon };
    }
    if (addTrailingProp && slots.trailing) {
      propKeys.trailingIcon = c.addComponentProperty('Trailing icon', 'BOOLEAN', false);
      slots.trailing.componentPropertyReferences = { visible: propKeys.trailingIcon };
    }
  } catch (err) {
    console.warn(`addComponentProperty failed on variant '${name}':`, err && err.message ? err.message : err);
  }

  // Append to current page before any combining
  figma.currentPage.appendChild(c);
  return { component: c, slots, propKeys };
}

// When CONFIG.composes is non-empty, each variant is an instance stack: outer
// chrome still comes from this composite's cva (same bindColor/bindNum as
// buildVariant); inner children are real InstanceNodes of published atoms
// resolved via REGISTRY_COMPONENTS (CONVENTIONS.md §3.05).
function buildComposedVariant(name, fillVar, fallbackFill, {
  labelVar         = 'color/background/content',
  strokeVar        = null,
  radiusVar        = 'radius/md',
  padH             = 'space/md',
  padV             = 'space/xs',
} = {}) {
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode            = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  bindNum(c, 'paddingLeft',   padH,     16);
  bindNum(c, 'paddingRight',  padH,     16);
  bindNum(c, 'paddingTop',    padV,      8);
  bindNum(c, 'paddingBottom', padV,      8);
  bindNum(c, 'itemSpacing',  'space/sm', 8);
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));
  bindColor(c, fillVar, fallbackFill, 'fills');
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  for (const spec of CONFIG.composes) {
    const slotFrame = figma.createFrame();
    slotFrame.name = `slot/${spec.slot}`;
    slotFrame.layoutMode = 'HORIZONTAL';
    slotFrame.primaryAxisSizingMode = 'AUTO';
    slotFrame.counterAxisSizingMode = 'AUTO';
    slotFrame.primaryAxisAlignItems = 'CENTER';
    slotFrame.counterAxisAlignItems = 'CENTER';
    bindNum(slotFrame, 'paddingLeft',   'space/none', 0);
    bindNum(slotFrame, 'paddingRight',  'space/none', 0);
    bindNum(slotFrame, 'paddingTop',    'space/none', 0);
    bindNum(slotFrame, 'paddingBottom', 'space/none', 0);
    bindNum(slotFrame, 'itemSpacing',  'space/sm', 8);

    const reg = REGISTRY_COMPONENTS[spec.component];
    if (!reg || !reg.nodeId) {
      throw new Error(
        `Composite '${CONFIG.component}' composes '${spec.component}' but registry is missing nodeId. ` +
          `Draw ${spec.component} first (updates .designops-registry.json), then re-run this composite.`,
      );
    }
    const main = figma.getNodeById(reg.nodeId);
    if (!main || main.type !== 'COMPONENT_SET') {
      throw new Error(
        `Registry node for '${spec.component}' must be a COMPONENT_SET (got ${main ? main.type : 'null'}).`,
      );
    }
    const n = spec.cardinality === 'many' ? (spec.count != null ? spec.count : 3) : 1;
    for (let i = 0; i < n; i++) {
      const inst = main.createInstance();
      if (spec.defaultProps && typeof spec.defaultProps === 'object') {
        try {
          inst.setProperties(spec.defaultProps);
        } catch (err) {
          console.warn(`setProperties on ${spec.component} instance:`, err && err.message ? err.message : err);
        }
      }
      slotFrame.appendChild(inst);
    }
    c.appendChild(slotFrame);
  }

  figma.currentPage.appendChild(c);
  return { component: c, slots: { leading: null, trailing: null, center: null, label: null }, propKeys: {} };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6. DEFAULT DRAW FLOW — matrix documentation frame (every component)
// ═══════════════════════════════════════════════════════════════════════════
// Every component renders the same 5-section doc frame per CONVENTIONS.md §1:
//   1. Header         — title + summary + source link
//   2. Properties     — Properties + Types table
//   3. Component Set  — live, editable ComponentSet (horizontal-wrap grid)
//   4. Matrix         — Variant × State specimen matrix (grouped by size)
//   5. Usage          — Do / Don't cards
//
// The ComponentSet is reparented INTO the doc frame as §3 (Component Set)
// so designers can see and edit the live variants in place — not parked
// off-canvas. The matrix below contains instances of it that update
// automatically when the designer edits the source ComponentSet.
//
// Every variant is assembled as:
//   [icon-slot/leading 24×24] → [text label] → [icon-slot/trailing 24×24]
// (OR a single `icon-slot/center 24×24` when `label()` returns null — the
//  icon-only mode used by shadcn's `size=icon`).
//
// Icon slots are 24×24 placeholder frames with no fill and a 1px dashed
// stroke bound to `color/border/default` (fallback #d4d4d8), cornerRadius
// 4, layoutMode NONE. The dashed outline is discoverable on canvas and in
// the layers panel; it sits behind any child the designer drops in, so
// final renders show the icon and not the placeholder. See CONVENTIONS.md
// §3.3.1 for the authoritative slot spec.
//
// The ComponentSet exposes three element component properties so
// designers edit instances WITHOUT DETACHING:
//   • TEXT     "Label"         → bound to every variant's text characters
//   • BOOLEAN  "Leading icon"  → bound to icon-slot/leading visibility
//   • BOOLEAN  "Trailing icon" → bound to icon-slot/trailing visibility
//
// Everything below reads from the CONFIG object defined at §0. No
// hardcoded component-specific constants are permitted past this point.

const DOC_FRAME_WIDTH  = 1640;
const GUTTER_W_SIZE    = 60;
const GUTTER_W_VARIANT = 160;

// --- 6.0  Clear page (except _Header) -----------------------------------
// Wipe EVERYTHING except _Header — orphan ComponentSets, half-drawn doc
// frames, abandoned variant components from a prior failed run.

for (const node of [...figma.currentPage.children]) {
  if (node.name !== '_Header') node.remove();
}

// --- 6.1  Resolve published Doc/* text styles + makeText ----------------
// CONVENTIONS.md §7 — every doc text node must assign textStyleId.

const allTextStyles = await figma.getLocalTextStylesAsync();
const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
  section:   getDocStyle('Doc/Section'),
  tokenName: getDocStyle('Doc/TokenName'),
  code:      getDocStyle('Doc/Code'),
  caption:   getDocStyle('Doc/Caption'),
};

// 4-arg makeText — the 4th arg is a Theme var path bound to the text fill.
// bindColor is defined at §5 above.
function makeText(chars, styleKey, fallbackSize = 13, fillVar = 'color/background/content') {
  const t = figma.createText();
  t.fontName = { family: labelFont, style: 'Regular' };
  t.characters = String(chars);
  if (DOC[styleKey]) t.textStyleId = DOC[styleKey].id;
  else t.fontSize = fallbackSize;
  t.textAutoResize = 'HEIGHT';   // CRITICAL — prevents 10px row collapse
  bindColor(t, fillVar, '#0a0a0a', 'fills');
  return t;
}

// --- 6.2  Build the ComponentSet (variant x size only — NOT state) ------
// State (hover/pressed/disabled) is an instance override in the matrix,
// not a Figma variant property. CONVENTIONS.md §13.1 explains why.

const hasSizeAxis = CONFIG.sizes && CONFIG.sizes.length > 0;
const sizeList    = hasSizeAxis ? CONFIG.sizes : [null];
const padFallback = CONFIG.padH?.default ?? 'space/md';
const radiusVar   = CONFIG.radius ?? 'radius/md';

const labelStyleFallback = CONFIG.labelStyle?.default ?? null;
const iconSlots          = CONFIG.iconSlots || {};
const iconSlotSize       = iconSlots.size ?? 24;
const leadingGlobal      = !!iconSlots.leading;
const trailingGlobal     = !!iconSlots.trailing;
const cp                 = CONFIG.componentProps || {};

// Pick a sensible default string for the TEXT "Label" property —
// first non-null label across sizes/variants, or fall back to CONFIG.title.
const defaultLabelText = (() => {
  if (typeof CONFIG.label !== 'function') return String(CONFIG.label ?? CONFIG.title ?? 'Label');
  for (const s of sizeList) {
    const l = CONFIG.label(s, CONFIG.variants[0]);
    if (l) return String(l);
  }
  return String(CONFIG.title ?? 'Label');
})();

const variantData = [];
for (const v of CONFIG.variants) {
  for (const s of sizeList) {
    const st = CONFIG.style[v];
    if (!st) throw new Error(`CONFIG.style missing entry for variant '${v}'`);
    const name = s === null ? `variant=${v}` : `variant=${v}, size=${s}`;
    const label = typeof CONFIG.label === 'function'
      ? CONFIG.label(s, v)
      : (CONFIG.label ?? CONFIG.title);
    const padH  = (s !== null && CONFIG.padH?.[s]) || padFallback;
    const labelStyleName = (s !== null && CONFIG.labelStyle?.[s]) || labelStyleFallback;
    if (usesComposes) {
      variantData.push(buildComposedVariant(
        name, st.fill, st.fallback,
        {
          labelVar:  st.labelVar,
          strokeVar: st.strokeVar,
          radiusVar,
          padH,
          padV: 'space/xs',
        },
      ));
    } else {
      variantData.push(buildVariant(
        name, st.fill, st.fallback,
        {
          label,
          labelVar:        st.labelVar,
          strokeVar:       st.strokeVar,
          radiusVar,
          padH,
          labelStyleName,
          leadingSlot:     leadingGlobal,
          trailingSlot:    trailingGlobal,
          iconSlotSize,
          addLabelProp:    !!cp.label,
          addLeadingProp:  !!cp.leadingIcon  && leadingGlobal,
          addTrailingProp: !!cp.trailingIcon && trailingGlobal,
          propLabelText:   defaultLabelText,
        }
      ));
    }
  }
}
// Pre-position so combineAsVariants doesn't stack at (0,0)
let cx = 0;
for (const d of variantData) { d.component.x = cx; d.component.y = 0; cx += (d.component.width || 120) + 16; }

const compSet = figma.combineAsVariants(variantData.map(d => d.component), figma.currentPage);
compSet.name = `${CONFIG.title} — ComponentSet`;

// Roll up the per-variant propKeys for the final reporting log.
const propsAdded = {
  label:        variantData.some(d => d.propKeys.label),
  leadingIcon:  variantData.some(d => d.propKeys.leadingIcon),
  trailingIcon: variantData.some(d => d.propKeys.trailingIcon),
};
// The ComponentSet is NOT parked off-canvas. It's reparented into the doc
// frame as its own section later (§6.5.5) so designers can see and edit
// the live variants in place, with all matrix instances updating from it.

// Index the variant components so the matrix can createInstance() per cell.
// Key shape: "variant|size" (or just "variant" when no size axis).
const variantByKey = {};
for (const node of compSet.children) {
  const parts = node.name.split(', ').reduce((acc, kv) => {
    const [k, val] = kv.split('=');
    acc[k] = val;
    return acc;
  }, {});
  const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
  variantByKey[key] = node;
}

// --- 6.3  _PageContent scaffold + doc frame root ------------------------
// _PageContent is the shared outer container used by EVERY style-guide and
// component page. Geometry matches /create-design-system CONVENTIONS §2:
// 1800 wide, 80 padding on all sides, 1640 inner, y=320 below _Header.

const pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
// resize FIRST so it doesn't reset the sizing modes we're about to set
pageContent.resize(1800, 1);
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.paddingTop    = 80;
pageContent.paddingBottom = 80;
pageContent.paddingLeft   = 80;
pageContent.paddingRight  = 80;
pageContent.itemSpacing   = 48;
pageContent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
pageContent.x = 0;
pageContent.y = 320;
figma.currentPage.appendChild(pageContent);

const docRoot = figma.createFrame();
docRoot.name = `doc/component/${CONFIG.component}`;
docRoot.layoutMode = 'VERTICAL';
docRoot.resize(DOC_FRAME_WIDTH, 1);
docRoot.primaryAxisSizingMode = 'AUTO';
docRoot.counterAxisSizingMode = 'FIXED';
docRoot.layoutAlign = 'STRETCH';
docRoot.itemSpacing = 48;
docRoot.fills = [];
pageContent.appendChild(docRoot);

// --- 6.4  Header (title + summary) -------------------------------------

const header = figma.createFrame();
header.name = `doc/component/${CONFIG.component}/header`;
header.layoutMode = 'VERTICAL';
header.resize(DOC_FRAME_WIDTH, 1);
header.primaryAxisSizingMode = 'AUTO';
header.counterAxisSizingMode = 'FIXED';
header.layoutAlign = 'STRETCH';
header.itemSpacing = 12;
header.fills = [];
docRoot.appendChild(header);

const title = makeText(CONFIG.title, 'section', 32);
bindColor(title, 'color/background/content', '#0a0a0a', 'fills');
header.appendChild(title);

const summary = makeText(CONFIG.summary, 'caption', 14);
bindColor(summary, 'color/background/content-muted', '#6b7280', 'fills');
header.appendChild(summary);

// --- 6.5  makeFrame helper + hexToRgb -----------------------------------
// Centralized frame factory — every doc frame uses this. Prevents the
// common 10px-collapse bug by forcing AUTO height on VERTICAL AUTO frames.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function makeFrame(name, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.layoutMode ?? 'VERTICAL';
  // CRITICAL: resize() resets sizing modes to FIXED — call it BEFORE
  // setting primary/counter sizing modes, or AUTO will silently reset.
  if (o.width != null) f.resize(o.width, o.height ?? 1);
  f.primaryAxisSizingMode = o.primary ?? 'AUTO';
  f.counterAxisSizingMode = o.counter ?? 'FIXED';
  f.paddingTop    = o.padT ?? 0;
  f.paddingRight  = o.padR ?? 0;
  f.paddingBottom = o.padB ?? 0;
  f.paddingLeft   = o.padL ?? 0;
  f.itemSpacing   = o.itemSpacing ?? 0;
  if (o.align)        f.layoutAlign           = o.align;
  if (o.primaryAlign) f.primaryAxisAlignItems = o.primaryAlign;
  if (o.counterAlign) f.counterAxisAlignItems = o.counterAlign;
  if (o.fillVar)      bindColor(f, o.fillVar, o.fillHex ?? '#ffffff', 'fills');
  else if (o.fillHex) f.fills = [{ type: 'SOLID', color: hexToRgb(o.fillHex) }];
  else                f.fills = [];
  if (o.strokeVar) {
    bindColor(f, o.strokeVar, '#e5e7eb', 'strokes');
    f.strokeWeight = o.strokeWeight ?? 1;
    if (o.dashed)      f.dashPattern = [6, 4];
    if (o.strokeSides) {
      f.strokeTopWeight    = o.strokeSides.top    ?? 0;
      f.strokeRightWeight  = o.strokeSides.right  ?? 0;
      f.strokeBottomWeight = o.strokeSides.bottom ?? 0;
      f.strokeLeftWeight   = o.strokeSides.left   ?? 0;
    }
  } else {
    f.strokes = [];
  }
  if (o.radius != null) f.cornerRadius = o.radius;
  return f;
}

// --- 6.6  Properties + Types table (CONVENTIONS.md §4) ------------------
// Cols sum to 1640: PROPERTY 240 · TYPE 380 · DEFAULT 160 · REQUIRED 120 · DESCRIPTION 740

function buildPropertiesTable(rows) {
  const COLS = [
    { header: 'PROPERTY',    width: 240, style: 'tokenName' },
    { header: 'TYPE',        width: 380, style: 'code'      },
    { header: 'DEFAULT',     width: 160, style: 'code'      },
    { header: 'REQUIRED',    width: 120, style: 'code'      },
    { header: 'DESCRIPTION', width: 740, style: 'caption'   },
  ];

  const group = makeFrame(`doc/table-group/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Properties', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const table = makeFrame(`doc/table/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillVar: 'color/background/default', fillHex: '#ffffff',
    strokeVar: 'color/border/subtle',    strokeWeight: 1, radius: 16,
  });
  table.clipsContent = true;
  group.appendChild(table);

  // Header row
  const headerRow = makeFrame('header', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 56, counterAlign: 'CENTER',
    fillVar: 'color/background/variant', fillHex: '#f4f4f5',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  table.appendChild(headerRow);
  for (const col of COLS) {
    const cell = makeFrame(`header/${col.header.toLowerCase()}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: col.width, height: 56, padL: 20, padR: 20, counterAlign: 'CENTER',
    });
    headerRow.appendChild(cell);
    const t = makeText(col.header, 'code', 12, 'color/background/content-muted');
    t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
    cell.appendChild(t);
  }

  // Body rows
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isLast = i === rows.length - 1;
    const row = makeFrame(`row/${r[0]}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
      width: 1640, align: 'STRETCH', padT: 16, padB: 16,
      counterAlign: 'CENTER',
      strokeVar: isLast ? null : 'color/border/subtle',
      strokeWeight: isLast ? 0 : 1,
      strokeSides: isLast ? undefined : { bottom: 1 },
    });
    row.minHeight = 64;
    table.appendChild(row);

    for (let j = 0; j < COLS.length; j++) {
      const col = COLS[j];
      const cell = makeFrame(`cell/${col.header.toLowerCase()}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: col.width, padL: 20, padR: 20, padT: 4, padB: 4,
        primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(cell);
      const fillVar = (j === 3 || j === 4) ? 'color/background/content-muted' : 'color/background/content';
      const t = makeText(r[j], col.style, 13, fillVar);
      t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
      cell.appendChild(t);
    }
  }
  return group;
}

docRoot.appendChild(buildPropertiesTable(CONFIG.properties));

// --- 6.6B  Component Set section — the LIVE, editable ComponentSet ------
// Designers need the raw ComponentSet somewhere visible inside the doc
// layout — not parked off-canvas, not crammed above the header. It gets
// its own 1640-wide section between the Properties table and the Matrix:
//
//   doc/component/{name}/component-set
//   ├── title     "Component"
//   ├── caption   "Live ComponentSet — edit here, matrix instances update."
//   └── [ComponentSetNode — horizontal wrap grid of every variant]
//
// The ComponentSet itself is reparented (not copied) so Figma still
// recognizes it as the canonical source for Code Connect + the Assets
// panel. Every cell in the matrix below is an instance of a child of
// this ComponentSet, so a single edit here propagates everywhere.

function buildComponentSetSection() {
  const section = makeFrame(`doc/component/${CONFIG.component}/component-set-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: DOC_FRAME_WIDTH,
    itemSpacing: 12, align: 'STRETCH',
  });

  const stitle = makeText('Component', 'section', 24, 'color/background/content');
  stitle.resize(DOC_FRAME_WIDTH, 1); stitle.textAutoResize = 'HEIGHT';
  section.appendChild(stitle);

  const scap = makeText(
    'Live ComponentSet — this is the source of truth. Edit any variant here and every instance in the matrix below updates automatically.',
    'caption', 13, 'color/background/content-muted',
  );
  scap.resize(DOC_FRAME_WIDTH, 1); scap.textAutoResize = 'HEIGHT';
  section.appendChild(scap);

  // Configure the ComponentSet itself as a horizontal-WRAP auto-layout
  // grid so every variant is visible at a glance and the group
  // re-flows as variants are added/removed.
  //
  // CRITICAL order (same gotcha as every other frame):
  //   1. layoutMode / layoutWrap
  //   2. resize(w, 1)                (silently resets sizing modes)
  //   3. primaryAxisSizingMode / counterAxisSizingMode   ← must be AFTER resize
  compSet.layoutMode  = 'HORIZONTAL';
  compSet.layoutWrap  = 'WRAP';
  compSet.resize(DOC_FRAME_WIDTH, 1);
  compSet.primaryAxisSizingMode = 'FIXED';        // fixed width triggers wrap
  compSet.counterAxisSizingMode = 'AUTO';          // grows vertically with rows
  compSet.paddingTop    = 32;
  compSet.paddingBottom = 32;
  compSet.paddingLeft   = 32;
  compSet.paddingRight  = 32;
  compSet.itemSpacing        = 24;                 // gap between variants in a row
  compSet.counterAxisSpacing = 24;                 // gap between wrapped rows
  compSet.primaryAxisAlignItems = 'MIN';
  compSet.counterAxisAlignItems = 'CENTER';
  compSet.layoutAlign = 'STRETCH';
  bindColor(compSet, 'color/background/variant', '#fafafa', 'fills');
  bindColor(compSet, 'color/border/subtle',      '#e5e7eb', 'strokes');
  compSet.strokeWeight = 1;
  compSet.dashPattern  = [6, 4];
  compSet.cornerRadius = 16;

  // Reparent from figma.currentPage into this section (preserves node identity)
  section.appendChild(compSet);
  return section;
}
docRoot.appendChild(buildComponentSetSection());

// --- 6.7  Variant × State matrix (CONVENTIONS.md §5) --------------------
// Rows = variants, Columns = states, vertically stacked by size.
// Reads CONFIG.variants, CONFIG.sizes, CONFIG.states, CONFIG.applyStateOverride.

function buildMatrix() {
  const variants       = CONFIG.variants;
  const sizes          = CONFIG.sizes ?? [];
  const states         = CONFIG.states;
  const hasSizeAxis    = sizes.length > 0;
  const gutterSizeW    = hasSizeAxis ? GUTTER_W_SIZE : 0;
  const gutterVariantW = GUTTER_W_VARIANT;
  const gutter         = gutterSizeW + gutterVariantW;
  const cellW          = Math.floor((DOC_FRAME_WIDTH - gutter) / states.length);
  const defaultStates  = states.filter(s => s.group === 'default');
  const disabledStates = states.filter(s => s.group === 'disabled');

  const group = makeFrame(`doc/component/${CONFIG.component}/matrix-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Variants × States', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const matrix = makeFrame(`doc/component/${CONFIG.component}/matrix`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillHex: '#ffffff',
    strokeVar: 'color/border/subtle', strokeWeight: 1, dashed: true, radius: 16,
  });
  group.appendChild(matrix);

  // Header-groups row (DEFAULT | DISABLED)
  if (disabledStates.length > 0) {
    const hg = makeFrame('matrix/header-groups', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: 1640, height: 44, counterAlign: 'CENTER',
      strokeVar: 'color/border/subtle', strokeWeight: 1,
      strokeSides: { bottom: 1 },
    });
    matrix.appendChild(hg);
    hg.appendChild(makeFrame('gutter', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: gutter, height: 44,
    }));
    const dc = makeFrame('cell/default-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * defaultStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(dc);
    dc.appendChild(makeText('DEFAULT', 'code', 12, 'color/background/content-muted'));
    const uc = makeFrame('cell/disabled-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * disabledStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(uc);
    uc.appendChild(makeText('DISABLED', 'code', 12, 'color/background/content-muted'));
  }

  // State-labels row
  const hs = makeFrame('matrix/header-states', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 40, counterAlign: 'CENTER',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  matrix.appendChild(hs);
  hs.appendChild(makeFrame('gutter', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: gutter, height: 40,
  }));
  for (const st of states) {
    const cell = makeFrame(`cell/${st.key}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW, height: 40, primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hs.appendChild(cell);
    cell.appendChild(makeText(st.key, 'caption', 12, 'color/background/content-muted'));
  }

  // Size groups
  const groupList = hasSizeAxis ? sizes : [null];
  for (let si = 0; si < groupList.length; si++) {
    const size = groupList[si];
    const sg = makeFrame(`matrix/size-group/${size ?? 'single'}`, {
      layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    matrix.appendChild(sg);

    if (hasSizeAxis) {
      const sLabel = makeFrame(`size-label/${size}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: gutterSizeW, primaryAlign: 'CENTER', counterAlign: 'CENTER',
        strokeVar: 'color/border/subtle', strokeWeight: 1,
        strokeSides: { right: 1 },
      });
      sg.appendChild(sLabel);
      sLabel.appendChild(makeText(size, 'tokenName', 14, 'color/background/content'));
    }

    const rowsStack = makeFrame('variant-rows', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    sg.appendChild(rowsStack);

    for (let vi = 0; vi < variants.length; vi++) {
      const variant = variants[vi];
      const isLastVariantRow = (si === groupList.length - 1) && (vi === variants.length - 1);
      const row = makeFrame(`row/${variant}`, {
        layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
        counterAlign: 'CENTER',
        strokeVar: isLastVariantRow ? null : 'color/border/subtle',
        strokeWeight: isLastVariantRow ? 0 : 1,
        strokeSides: isLastVariantRow ? undefined : { bottom: 1 },
      });
      row.minHeight = 72;
      rowsStack.appendChild(row);

      const vLabel = makeFrame(`row/${variant}/label`, {
        layoutMode: 'VERTICAL', primary: 'FIXED', counter: 'FIXED',
        width: gutterVariantW, height: 72,
        padL: 20, padR: 20, primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(vLabel);
      const prettyVariant = variant.charAt(0).toUpperCase() + variant.slice(1);
      vLabel.appendChild(makeText(prettyVariant, 'caption', 13, 'color/background/content-muted'));

      for (const st of states) {
        const cell = makeFrame(`cell/${variant}/${st.key}`, {
          layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
          width: cellW, height: 72,
          padL: 16, padR: 16, padT: 16, padB: 16,
          primaryAlign: 'CENTER', counterAlign: 'CENTER',
        });
        row.appendChild(cell);
        const key = hasSizeAxis ? `${variant}|${size}` : variant;
        const componentNode = variantByKey[key];
        if (componentNode) {
          const instance = componentNode.createInstance();
          if (typeof CONFIG.applyStateOverride === 'function') {
            CONFIG.applyStateOverride(instance, st.key, { variant, size, componentNode });
          }
          cell.appendChild(instance);
        }
      }
    }
  }
  return group;
}
docRoot.appendChild(buildMatrix());

// --- 6.8  Usage notes — Do / Don't cards (CONVENTIONS.md §6) ------------
// Reads CONFIG.usageDo and CONFIG.usageDont.

function buildUsageNotes() {
  const row = makeFrame(`doc/component/${CONFIG.component}/usage`, {
    layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 30, align: 'STRETCH',
  });
  function card(titleText, glyph, bullets) {
    const c = makeFrame(`usage/${titleText.toLowerCase().replace(/[^a-z]/g, '')}`, {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805,
      padL: 28, padR: 28, padT: 28, padB: 28, itemSpacing: 16,
      fillVar: 'color/background/variant', fillHex: '#f4f4f5', radius: 16,
    });
    c.appendChild(makeText(`${glyph}  ${titleText}`, 'tokenName', 18, 'color/background/content'));
    const list = makeFrame('bullets', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805 - 56,
      itemSpacing: 12, align: 'STRETCH',
    });
    c.appendChild(list);
    for (const b of bullets) {
      const bt = makeText(`·  ${b}`, 'caption', 13, 'color/background/content');
      bt.resize(805 - 56, 1); bt.textAutoResize = 'HEIGHT';
      list.appendChild(bt);
    }
    return c;
  }
  row.appendChild(card('Do',    '✓', CONFIG.usageDo));
  row.appendChild(card("Don't", '✕', CONFIG.usageDont));
  return row;
}
docRoot.appendChild(buildUsageNotes());

// --- 6.9  Self-validate + reveal ---------------------------------------

if (docRoot.children.length < 5) {
  throw new Error(`Matrix draw incomplete: docRoot has ${docRoot.children.length} children, expected 5 (header, properties, component-set, matrix, usage).`);
}
if (pageContent.height < 500) {
  throw new Error(`_PageContent collapsed to height ${pageContent.height}. Likely a text node is missing textAutoResize = 'HEIGHT'.`);
}
// Sanity-check that the ComponentSet ended up inside the doc frame and not
// orphaned on the page — prior versions of this script parked it at y=-2000.
if (!compSet.parent || compSet.parent === figma.currentPage) {
  throw new Error('ComponentSet was not reparented into the doc frame. §6.6B did not run.');
}
// If iconSlots were requested, every variant must contain the named slot
// frames — otherwise designers won't have the drop targets they expect.
// Composed variants use `slot/*` instance stacks instead — skip this check.
{
  const needLeading  = !usesComposes && !!CONFIG.iconSlots?.leading;
  const needTrailing = !usesComposes && !!CONFIG.iconSlots?.trailing;
  if (needLeading || needTrailing) {
    for (const variant of compSet.children) {
      const hasLabelChild   = variant.children.some(n => n.type === 'TEXT');
      const hasCenter       = !!variant.findOne(n => n.name === 'icon-slot/center');
      // Variants without a label are icon-only → must have center slot.
      if (!hasLabelChild && !hasCenter) {
        throw new Error(`Variant '${variant.name}' has neither a label nor an icon-slot/center frame.`);
      }
      if (hasLabelChild) {
        if (needLeading && !variant.findOne(n => n.name === 'icon-slot/leading')) {
          throw new Error(`Variant '${variant.name}' is missing icon-slot/leading.`);
        }
        if (needTrailing && !variant.findOne(n => n.name === 'icon-slot/trailing')) {
          throw new Error(`Variant '${variant.name}' is missing icon-slot/trailing.`);
        }
      }
    }
  }
}

if (usesComposes) {
  const v0 = compSet.children[0];
  if (!v0) throw new Error('ComponentSet has no variants after compose draw.');
  const slotFrame = v0.children.find(n => n.type === 'FRAME' && String(n.name).startsWith('slot/'));
  if (!slotFrame) {
    throw new Error(`Composed variant '${v0.name}' is missing a slot/* frame.`);
  }
  const instCount = slotFrame.findAll(n => n.type === 'INSTANCE').length;
  if (instCount < 1) {
    throw new Error(`Composed variant '${v0.name}' has no INSTANCE children under ${slotFrame.name}.`);
  }
}

figma.viewport.scrollAndZoomIntoView([pageContent]);

const firstVariant = compSet.children[0];
const firstVariantChildren = firstVariant ? firstVariant.children.map(n => n.name) : [];
const iconOnlySize = (CONFIG.sizes || []).find(sz => {
  const lab = typeof CONFIG.label === 'function' ? CONFIG.label(sz, CONFIG.variants[0]) : CONFIG.label;
  return !lab;
});
let iconVariantChildren = [];
if (iconOnlySize != null) {
  const key = hasSizeAxis ? `${CONFIG.variants[0]}|${iconOnlySize}` : CONFIG.variants[0];
  const vn = variantByKey[key];
  if (vn) iconVariantChildren = vn.children.map(n => n.name);
}

function simpleCvaHash() {
  try {
    return JSON.stringify({ v: CONFIG.variants, s: CONFIG.sizes, st: CONFIG.style });
  } catch (_) {
    return null;
  }
}

const nowIso = new Date().toISOString();
const prevReg = REGISTRY_COMPONENTS[CONFIG.component];
const nextVersion = prevReg && typeof prevReg.version === 'number' ? prevReg.version + 1 : 1;

const returnPayload = {
  pageName: CONFIG.pageName,
  docRootChildren: docRoot.children.length,
  compSetName: compSet.name,
  compSetId: compSet.id,
  compSetKey: compSet.key,
  compSetVariants: compSet.children.map(c => c.name),
  compSetParent: compSet.parent ? compSet.parent.name : '',
  compSetPropertyDefinitions: compSet.componentPropertyDefinitions,
  firstVariantChildren,
  iconVariantChildren,
  propErrorsCount: 0,
  propErrorsSample: [],
  composedWith: usesComposes ? CONFIG.composes.map(r => r.component) : [],
  registryEntry: (() => {
    const base = {
      component: CONFIG.component,
      nodeId: compSet.id,
      key: compSet.key,
      pageName: CONFIG.pageName,
      publishedAt: nowIso,
      version: nextVersion,
      cvaHash: CONFIG._source === 'shadcn-1:1' ? simpleCvaHash() : null,
    };
    if (usesComposes) {
      const composedChildVersions = {};
      for (const spec of CONFIG.composes) {
        const cr = REGISTRY_COMPONENTS[spec.component];
        composedChildVersions[spec.component] = cr && typeof cr.version === 'number' ? cr.version : null;
      }
      base.composedChildVersions = composedChildVersions;
    }
    return base;
  })(),
};

{
  const vN = CONFIG.variants.length;
  const sN = CONFIG.states.length;
  const zN = Math.max((CONFIG.sizes ?? []).length, 1);
  const props = Object.keys(propsAdded).filter(k => propsAdded[k]);
  console.log(
    `${CONFIG.component} drawn: ${vN}v × ${sN}s × ${zN}sz = ${vN * sN * zN} matrix cells; ` +
    `ComponentSet lives inline in doc frame; ` +
    `element props: ${props.length ? props.join(', ') : '(none)'}; ` +
    `composed: ${usesComposes ? returnPayload.composedWith.join('+') : '—'}.`,
  );
}

return returnPayload;
```

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

**Stop-ship check — if what you see on canvas is a single horizontal strip of tiny variant components and nothing else, you stopped at `combineAsVariants`.** That is the deprecated output. The script above REQUIRES you to continue through sections 6.5–6.9 and execute `buildPropertiesTable`, `buildMatrix`, and `buildUsageNotes` in the same `use_figma` call. The three helpers are fully defined above — copy them into your script verbatim. Do not replace them with calls to a library that does not exist in the plugin context.

**Adapting this template to other components — edit ONLY the `CONFIG` object at §0.** The draw engine (§1–§6) is identical for every component. If you find yourself editing anything below `CONFIG`, stop — you are forking, not configuring.

| Change | Edit in `CONFIG` |
|---|---|
| Different component | Replace the whole `CONFIG` — `component`, `title`, `pageName`, `summary`, `variants`, `sizes`, `style`, `padH`, `radius`, `label`, `labelStyle`, `iconSlots`, `componentProps`, `states`, `applyStateOverride`, `properties`, `usageDo`, `usageDont`, optional `composes` (see [`CONVENTIONS.md`](./CONVENTIONS.md) §3.05). |
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

**Matrix state axis** — what columns the matrix draws, read from the component's category in [`CONVENTIONS.md` § 7](./CONVENTIONS.md):

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

**State handling rule:** if a state maps to an existing Figma variant prop (e.g. `checkbox` disabled), populate the cell by calling `instance.setProperties({ disabled: 'true' })`. Otherwise, the state is a **visual overlay** applied to the instance (hover/pressed for buttons) — see the `applyStateOverride` callback in the template above and the decision tree in [`CONVENTIONS.md` § 13.1](./CONVENTIONS.md).

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

Every assertion ID below (`S9.1` … `S9.9`) maps 1:1 to an audit-checklist item in [CONVENTIONS.md §14](./CONVENTIONS.md).

| ID | Assertion (evaluate against §6 return payload) | Failure action |
|----|-----------------------------------------------|----------------|
| **S9.1** | `pageName === CONFIG.pageName` and `docRootChildren >= 2` (at minimum `_Header` + `_PageContent`) | Re-run §6.0 page clear + §6.3 doc frame build |
| **S9.2** | `compSetName === \`${CONFIG.title} — ComponentSet\`` | The naming convention was bypassed — fix CONFIG.title and re-run |
| **S9.3** | `compSetVariants.length === CONFIG.variants.length × max(CONFIG.sizes.length, 1)` | Missing variants — inspect buildVariant call-site and `combineAsVariants` input |
| **S9.4** | `compSetParent` ends with `doc/component/{component}/component-set-group` (ComponentSet reparented into the doc frame, not parked off-canvas) | §6.4 reparent step did not run |
| **S9.5** | When `CONFIG.componentProps.label` is true: `compSetPropertyDefinitions.Label.type === 'TEXT'` and its `defaultValue` is a non-empty string | `addComponentProperty` threw or was skipped — inspect `propErrorsSample` |
| **S9.6** | When `CONFIG.componentProps.leadingIcon` is true: `compSetPropertyDefinitions['Leading icon'].type === 'BOOLEAN'`. Same for `trailingIcon` → `'Trailing icon'` | As above |
| **S9.7** | **Atoms (no `composes`):** for every variant with a non-null label, `firstVariantChildren` contains `icon-slot/leading`, a text node, `icon-slot/trailing` **in that reading order** (when both `iconSlots.leading` and `iconSlots.trailing` are true). **Composites (`composedWith.length > 0`):** `firstVariantChildren` includes at least one `slot/{name}` frame whose subtree contains an `INSTANCE` node | Variant / composition assembly is broken — inspect `buildVariant` vs `buildComposedVariant` |
| **S9.8** | **Atoms:** for every variant where `CONFIG.label(size, variant) === null`, `iconVariantChildren` contains exactly one child named `icon-slot/center` and **no text node**. **Composites:** skip when `composedWith.length > 0` | Icon-only mode collapsed incorrectly |
| **S9.9** | `propErrorsCount === 0` | Surface `propErrorsSample` to the designer and STOP — do not report the component drawn |

If all nine assertions pass, the component is safe to mark **Drawn to Canvas = Yes** in the Step 8 table.

> **Optional visual check (recommended, not gating):** after S9.1–S9.9 pass, call `get_screenshot` on the `_PageContent` frame's node ID. Inspect the dashed icon-slot placeholders in the matrix rows, confirm opacity ramps across `default → hover → pressed → disabled`, and verify the inline ComponentSet at the top of the doc frame. This is a human-review safety net, not a mechanical assertion.

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
| `node …/resolver/validate-composes.mjs <shadcn-props.json> <component\|--all> [--project <root>]` | Validate `composes[]` (Step 4.5.g) |
| `node …/resolver/merge-registry.mjs <.designops-registry.json> <entry.json>` | Upsert one registry record after a successful draw (Step 5.2) |

---

## Notes

- **No manual Figma community kit import required.** Components are installed from the shadcn CLI into the local codebase, and the agent draws them directly to the Figma canvas as proper Figma components using `figma.createComponent()` and `figma.combineAsVariants()`. These are real Figma components with component keys — required for Code Connect to resolve mappings.
- **Matrix-default layout.** Every component renders into a 5-section documentation frame (header → properties table → live Component Set section → variant × state matrix → Do/Don't usage notes) at 1640px inner width on a 1800px `_PageContent`. This matches the canvas geometry used by `/create-design-system` style-guide pages so the entire file reads as one system. The `ComponentSet` is reparented **inline** into the doc frame as a horizontal-wrap auto-layout grid — designers edit variants in place, and every matrix instance below updates automatically from that source. See [`CONVENTIONS.md`](./CONVENTIONS.md) §3.2 for the Component Set section layout, §3.1 for the `CONFIG` schema, and the full audit checklist.
- **Labels use published text styles.** Inner variant labels bind to the Typography system's `Label/*` text styles (per-size via `CONFIG.labelStyle`), so every component label stays in sync with the type scale — no stray `fontSize: 14` overrides.
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent routes each component to its designated page in the Detroit Labs Foundations scaffold (see Step 5 routing table) using `figma.setCurrentPageAsync`. If the file was not scaffolded by `/new-project`, it falls back to the current active page with a warning.
- **Token bindings** are a best-effort match based on variable names in the `Theme`, `Layout`, and `Typography` collections created by `/create-design-system`. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.
