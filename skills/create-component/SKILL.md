---
name: create-component
description: Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.
argument-hint: "[component...] — e.g. /create-component button input card. If omitted, the agent shows the full component list and prompts."
agent: general-purpose
---

# Skill: /create-component

Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.

## Entry — read [`EXECUTOR.md`](./EXECUTOR.md) first

**Mandatory:** Before any install, assembly, or `use_figma` call, `Read` [`EXECUTOR.md`](./EXECUTOR.md) in full (install through Step 6 transport, `check-payload`, session runbook). **`SKILL.md`** holds **§9** (pass/fail self-check), generated **supported components**, and shortcuts. **EXECUTOR** wins on assembly and MCP transport; **`conventions/`** wins cited geometry.

**Step 6 — five `use_figma` calls (aligned with style-guide canvas):** Build **`ctx`** once per component (full **CONFIG** + `activeFileKey` / `fileKey`, `registryComponents`, `usesComposes` — see [`EXECUTOR.md`](./EXECUTOR.md) §0). For each step, run **`assemble-component-use-figma-code.mjs`**, **`check-payload`**, then **prefer** **`Task` → [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md)** with `step=cc-scaffold` … `cc-usage` and `assembledCodePath` (see runner §2 / §6). **Fallback:** **parent** **`Read`** the same assembled file → **`call_mcp`**. Order: **`cc-scaffold`** → **`cc-properties`** → **`cc-component-*`** (per [`02-archetype-routing.md`](./conventions/02-archetype-routing.md)) → **`cc-matrix`** → **`cc-usage`**. Bundles: [`canvas-templates/bundles/`](./canvas-templates/bundles/). Rebuild: **`npm run bundle-component`**.

**Short-output / Composer-class hosts:** Same delegation + fallback as Steps 15a–c / 17 ([`create-design-system` / 16](../create-design-system/conventions/16-mcp-use-figma-workflow.md)). Writers may run assembly + `check-payload` only.

> **Conventions:** Start at [`conventions/00-overview.md`](./conventions/00-overview.md). Router for section IDs: [`CONVENTIONS.md`](./CONVENTIONS.md).

---

## Conventions load map (lazy)

| When | Open |
|------|------|
| Steps 1–3, 3b | Optional [`00-overview.md`](./conventions/00-overview.md) |
| Install, Mode A/B, tokens 4.7 | [`01-config-schema.md`](./conventions/01-config-schema.md), [`05-code-connect.md`](./conventions/05-code-connect.md), [`07-token-paths.md`](./conventions/07-token-paths.md) |
| Archetype / `composes` | [`02-archetype-routing.md`](./conventions/02-archetype-routing.md) |
| Step 6 draw / doc geometry | [`04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md), [`03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) |
| Closeout, §9 mapping | [`06-audit-checklist.md`](./conventions/06-audit-checklist.md), [`resolver/merge-registry.mjs`](./resolver/merge-registry.mjs) for registry upsert |

---

## Interactive input contract

When this skill needs designer input (component list, Figma file key, shadcn init choices, optional `/code-connect` chaining), use **AskUserQuestion** — **one question per tool call**, wait for each reply before the next. Do not dump multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **shadcn-compatible project** — Next.js, Vite, Remix, or any React framework supported by shadcn/ui. The project must have a `package.json` at its root.
- **`/create-design-system` run first** — Token variable bindings in Figma come from the `Theme`, `Layout`, and `Typography` collections. The CSS token file (`tokens.css`) written by `/create-design-system` must also exist in the local project — this is what components import for their CSS custom properties. If the file is absent, components are drawn to canvas with hardcoded fallback values and a warning is reported.
- **Active Figma file open** — The agent needs a target Figma file key. This is taken from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Figma MCP connector authenticated** — All canvas writes use `mcp__claude_ai_Figma__*` tools. No separate PAT setup required.
- **`use_figma` discipline** — Load **figma-use** before every `use_figma` call (workspace / connector rule). Prefer **committed canvas bundles** over reauthoring layout from memory; component doc pages share the same **resize / Hug / `textAutoResize`** footguns as style-guide tables — see **create-design-system `SKILL.md`** gotchas and [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) §10–10.2.

---

## Detailed procedural spec (Steps 1–8)

Narrative step table (resolve list → install → CONFIG → **five-call** draw → report): [`EXECUTOR.md`](./EXECUTOR.md) §0. **Component → page routing** and generated lists: this file (**Supported Components**) and `npm run build:docs` output where applicable.

**Conflict rule:** [`EXECUTOR.md`](./EXECUTOR.md) wins assembly and MCP transport; [`conventions/`](./conventions/00-overview.md) shards win cited geometry.

---

## Step 9 — Self-check before reporting a component "drawn"

> **Run these assertions against the JSON return from the `component-*` `use_figma` call** (variants + ComponentSet structure). If any assertion fails, the component is NOT drawn — mark it `failed` in Step 8, surface the failing assertion ID verbatim, and do not offer Code Connect chaining for that component.

Every assertion ID below (`S9.1` … `S9.9`) maps 1:1 to an audit-checklist item in [`conventions/06-audit-checklist.md` §14](./conventions/06-audit-checklist.md).

| ID | Assertion (evaluate against **`component-*`** bundle return payload) | Failure action |
|----|-----------------------------------------------|----------------|
| **S9.1** | `pageName === CONFIG.pageName` and `docRootChildren >= 2` (at minimum `_Header` + `_PageContent`) | Re-run **scaffold** + doc build per bundles / `EXECUTOR` |
| **S9.2** | `compSetName === \`${CONFIG.title} — ComponentSet\`` | The naming convention was bypassed — fix CONFIG.title and re-run |
| **S9.3** | `compSetVariants === CONFIG.variants.length × max(CONFIG.sizes.length, 1)` (`compSetVariants` is the variant **count** from the payload) | Missing variants — inspect buildVariant call-site and `combineAsVariants` input |
| **S9.4** | `compSetParent` ends with `doc/component/{component}/component-set-group` (ComponentSet reparented into the doc frame, not parked off-canvas) | Component bundle reparent step did not run |
| **S9.5** | When `CONFIG.componentProps.label` is true: `compSetPropertyDefinitions.Label.type === 'TEXT'` and its `defaultValue` is a non-empty string | `addComponentProperty` threw or was skipped — inspect `propErrorsSample` |
| **S9.6** | When `CONFIG.componentProps.leadingIcon` is true: `compSetPropertyDefinitions['Leading icon'].type === 'BOOLEAN'`. Same for `trailingIcon` → `'Trailing icon'` | As above |
| **S9.7** | **Archetype-aware variant assembly check.** Use `returnPayload.layout` and, for **every** row in `returnPayload.compSetVariantRows`, the row’s `childNames` (same checks as below, applied per row). For the **primary** variant you may use `firstVariantChildren` (= first row’s `childNames`). Match `layout`: <br>• `'chip'` — for every row with `hasText === true` when `CONFIG` expects a label for that variant×size, `childNames` includes `icon-slot/leading`, a text node name, `icon-slot/trailing` **in that order** (when both `iconSlots.leading` and `iconSlots.trailing` are true). <br>• `'surface-stack'` — `childNames` contains `CardHeader` first; when `surface.contentSlot.enabled` (default true) also `CardContent`; when `surface.footerSlot.enabled` also `CardFooter`. <br>• `'field'` — `childNames` contains `field` (`Label` / `helper` when enabled in CONFIG). <br>• `'row-item'` — `childNames` contains `row/text-stack` and icon slots per CONFIG. <br>• `'tiny'` — validate first component width/height vs `CONFIG.tiny.width/height`. <br>• `'container'` — `AccordionTrigger` + `icon-slot/chevron` or `TabsList` + `TabsContent`. <br>• `'control'` — unchecked vs checked `childNames` per spec. <br>• `'composes'` / `__composes__` — at least one `slot/*` with `INSTANCE` in subtree. | Variant / composition assembly is broken — inspect `canvas-templates/cc-arch-*.js` for `layout` |
| **S9.8** | **Atoms:** for every `compSetVariantRows` row where `hasText === false` and CONFIG implies icon-only for that variant×size, `childNames` must include exactly one `icon-slot/center` and no other label frame. **Composites:** skip when `composedWith.length > 0` | Icon-only mode collapsed incorrectly |
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

Commands below are **invoked by the agent** from the DesignOps-plugin repo root when automating this skill (see [`AGENTS.md`](../../AGENTS.md) — *Agents run plugin CLI*). **Do not** instruct designers to manually run them unless automation is unavailable.

| Command | Purpose |
|---|---|
| `npx shadcn@latest init` | Initialize shadcn in the current project (creates `components.json`) |
| `npx shadcn@latest add [component]` | Install a single component into the project |
| `npx shadcn@latest add [c1] [c2] ...` | Install multiple components in one invocation |
| `npx shadcn@latest diff` | Show which installed components are out of date |
| `node …/resolver/validate-composes.mjs <shadcn-props.json> <component\|--all> [--project <root>]` | Validate `composes[]` (Step 4.5.g) |
| `node …/resolver/merge-registry.mjs <.designops-registry.json> <entry.json>` | Upsert one registry record after a successful draw (Step 5.2) |
| `npm run create-component-step6 -- --ctx-file <path>` (DesignOps-plugin root) | Batch Step 6 assemble + `check-payload` (+ optional `--check-mcp-args`, `--probe-first`); writes `create-component-step6-progress.json` — still five **sequential** `use_figma` ([`EXECUTOR.md`](./EXECUTOR.md) §0, [`scripts/create-component-step6-all.mjs`](../../scripts/create-component-step6-all.mjs)) |

---

## Notes

- **No manual Figma community kit import required.** Components are installed from the shadcn CLI into the local codebase, and the agent draws them directly to the Figma canvas as proper Figma components using `figma.createComponent()` and `figma.combineAsVariants()`. These are real Figma components with component keys — required for Code Connect to resolve mappings.
- **Matrix-default layout.** Every component renders into a 5-section documentation frame (header → properties table → live Component Set section → variant × state matrix → Do/Don't usage notes) at 1640px inner width on a 1800px `_PageContent`. This matches the canvas geometry used by `/create-design-system` style-guide pages so the entire file reads as one system. The `ComponentSet` is reparented **inline** into the doc frame as a horizontal-wrap auto-layout grid — designers edit variants in place, and every matrix instance below updates automatically from that source. See [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) §3.2 for the Component Set section layout, [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) §3.1 for the `CONFIG` schema, and [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) for the full audit checklist.
- **Labels use published text styles.** Inner variant labels bind to the Typography system's `Label/*` text styles (per-size via `CONFIG.labelStyle`), so every component label stays in sync with the type scale — no stray `fontSize: 14` overrides.
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent routes each component to its designated page per **CONFIG.pageName** / project scaffold using `figma.setCurrentPageAsync`. If the file was not scaffolded by `/new-project`, it falls back to the current active page with a warning.
- **Token bindings** are a best-effort match based on variable names in the `Theme`, `Layout`, and `Typography` collections created by `/create-design-system`. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.

