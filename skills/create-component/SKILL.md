---
name: create-component
description: Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.
argument-hint: "[component...] — e.g. /create-component button input card. If omitted, the agent shows the full component list and prompts."
agent: general-purpose
---

# Skill: /create-component

Install shadcn/ui components into the local codebase and draw them onto the Figma canvas with token variable bindings.

## Entry — read [`EXECUTOR.md`](./EXECUTOR.md) first

**Composer-class agents (Cursor / short-output hosts):** read [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) and [`EXECUTOR.md`](./EXECUTOR.md) for Step 6 orchestration, then return here for §9 and supported components / registry cues. **All other models:** same — `EXECUTOR` first.

**Mandatory:** Before any install, assembly, or `use_figma` call, `Read` [`EXECUTOR.md`](./EXECUTOR.md) in full. It holds the canonical **§0** quickstart (script assembly order, `check-payload` gates, short-context / MCP transport table, session runbook, twelve-step table, §0.1–§0.3). **Procedure for Steps 1–8:** [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md). **`SKILL.md`** holds **§9** (pass/fail self-check), generated **supported components**, and shortcuts below. If `EXECUTOR.md` conflicts with narrative elsewhere on **assembly or transport**, **EXECUTOR.md** wins; **CONFIG schema / draw-engine** disputes defer to **`conventions/`** and [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) where cited.

**Step 6 — orchestrated slice draw:** The **default** path is the **parent-owned DAG** in [`conventions/13-component-draw-orchestrator.md`](./conventions/13-component-draw-orchestrator.md): **12** sequential `use_figma` invocations, each assembled per [`../create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md) (`cc-doc-scaffold-shell` → … → `cc-doc-scaffold-placeholders` → `cc-variants` → `cc-doc-component` → … → `cc-doc-finalize`), the same **`configBlock`** and registry each time, and **`handoffJson`** updated from the prior return. The parent **may** `Read` minified engines in the main thread. **Do not** default to **`Task` → slice runner** for slices the subagent cannot emit in `call_mcp` (common). **`EXECUTOR.md`** §0 *Step 6 — transport* is authoritative.

**Alternatives:** Phased two-call **or** one-shot full engine **`use_figma` in the parent** per **`EXECUTOR.md`** when the designer wants fewer Figma round trips; the parent always runs **Step 5.5** locally. Optional **`Task`** per slice only if the host is **proven** to pass full slice `code` from a subagent.

> **Before you draw anything, read** [`conventions/00-overview.md`](./conventions/00-overview.md) — the entry point to the topic-scoped convention shards (auto-layout enums, doc pipeline, code-connect, audit checklist) that agents (Sonnet, Haiku, future Claude versions) can load to match the house style on the first pass. The shards document canvas geometry, the matrix-default layout, the properties table, state / variant / size axes, the `Doc/*` text styles, and the audit checklist. Every rule in this SKILL should round-trip with those files; if they ever disagree, **this SKILL is authoritative** and the matching `conventions/*.md` shard must be updated. The legacy [`CONVENTIONS.md`](./CONVENTIONS.md) is now a thin router / legacy section-ID map — follow its links to the shard.

**Time order vs rules vs step IDs:** The **chronological** run is [`phases/`](./phases/) (start at [`phases/00-index.md`](./phases/00-index.md)). **Domain rules** live in `conventions/`. **Canonical step numbers and MCP transport** are in [`EXECUTOR.md`](./EXECUTOR.md). If a `phases/*.md` file disagrees with `EXECUTOR.md` or a convention shard, **EXECUTOR + conventions win** — phase files orchestrate *when* and *what to open*, not canvas geometry.

---

## Conventions load map (lazy — required)

`Read` **only** the convention files for the phase you are executing. For the **draw phases (04–11)** — **scaffold** (`04`, **five** machine sub-slices) **then** **variants** (`05`) + **six** doc-sequence machine legs (`cc-doc-component` through `cc-doc-finalize`, including **two** props-fill phases **07** + **08**) — the standing set is [`13`](./conventions/13-component-draw-orchestrator.md) (DAG + `SLUG_ORDER`), and [slice runner §2](../create-component-figma-slice-runner/SKILL.md) (which min file each `step` uses). When **editing CONFIG** or **debugging layout**, also open [`01-config-schema.md`](./conventions/01-config-schema.md) and/or [`04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md).

| Phase | When | Convention files to open |
|------|------|---------------------------|
| 01 | Steps 1–3, 3b | **None** required · optional [`00-overview.md`](./conventions/00-overview.md) |
| 02 | Steps 4, 4.3, 4.4, 4.7; §4.5 | [`01-config-schema.md`](./conventions/01-config-schema.md), [`05-code-connect.md`](./conventions/05-code-connect.md) (Mode A/B), [`07-token-paths.md`](./conventions/07-token-paths.md) (4.7) |
| 03 | Step 5; registry / `composes` | [`02-archetype-routing.md`](./conventions/02-archetype-routing.md) when `composes` is in play |
| 04 | Step 6 — scaffold sub-slices (`cc-doc-scaffold-shell` …) | [`13` §1](./conventions/13-component-draw-orchestrator.md), [slice runner §2](../create-component-figma-slice-runner/SKILL.md) + optional [`04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) if debugging |
| 05 | Step 6 — slice `cc-variants` | same as 04 |
| 06 | Step 6 — slice `cc-doc-component` | same as 04 + optional `04` if debugging |
| 07 | Step 6 — slice `cc-doc-props-1` | same as 04 + optional `04` if debugging |
| 08 | Step 6 — slice `cc-doc-props-2` | same as 04 + optional `04` if debugging |
| 09 | Step 6 — slice `cc-doc-matrix` | same as 04 + optional `04` if debugging |
| 10 | Step 6 — slice `cc-doc-usage` | same as 04 + optional `04` if debugging |
| 11 | Step 6 — slice `cc-doc-finalize` **then** Step 7 closeout (same phase file) | Part A: same as 04 · Part B: [`06-audit-checklist.md`](./conventions/06-audit-checklist.md) · [`resolver/merge-registry.mjs`](./resolver/merge-registry.mjs) for 5.2 |

---

## Phase execution (orchestration — required order)

**Eleven phases (01–11), strictly sequential:** finish phase **N** completely before starting **N+1**. **Steps 1–5** and **4.7** map to **01–03**; **Step 6** is **12** `use_figma` machine slugs, documented as **phases 04–11 Part A** — **scaffold (five sub-slices) before variants** — then component through finalize (parent default, one `use_figma` per machine slug); **Step 7** is **11 Part B** (§9, 5.2, §8) — read [`phases/11-slice-cc-doc-finalize.md`](./phases/11-slice-cc-doc-finalize.md) in full for both. `EXECUTOR` phasing / preassembled: [`EXECUTOR.md`](./EXECUTOR.md) §0.

| Phase | Scope | Read path |
|------|--------|------------|
| 00 | Master list + flow | [`phases/00-index.md`](./phases/00-index.md) |
| 01 | Steps 1–3, 3b | [`phases/01-setup.md`](./phases/01-setup.md) |
| 02 | Steps 4, 4.3, 4.4, 4.7; §4.5 | [`phases/02-install.md`](./phases/02-install.md) |
| 03 | Step 5; Figma prep | [`phases/03-figma-prep.md`](./phases/03-figma-prep.md) |
| 04 | Step 6, machine slugs 1–5/12 — `cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders` | [`phases/04-slice-cc-doc-scaffold.md`](./phases/04-slice-cc-doc-scaffold.md) |
| 05 | Step 6, machine slug 6/12 — `cc-variants` | [`phases/05-slice-cc-variants.md`](./phases/05-slice-cc-variants.md) |
| 06 | Step 6, machine slug 7/12 — `cc-doc-component` | [`phases/06-slice-cc-doc-component.md`](./phases/06-slice-cc-doc-component.md) |
| 07 | Step 6, machine slug 8/12 — `cc-doc-props-1` | [`phases/07-slice-cc-doc-props-1.md`](./phases/07-slice-cc-doc-props-1.md) |
| 08 | Step 6, machine slug 9/12 — `cc-doc-props-2` | [`phases/08-slice-cc-doc-props-2.md`](./phases/08-slice-cc-doc-props-2.md) |
| 09 | Step 6, machine slug 10/12 — `cc-doc-matrix` | [`phases/09-slice-cc-doc-matrix.md`](./phases/09-slice-cc-doc-matrix.md) |
| 10 | Step 6, machine slug 11/12 — `cc-doc-usage` | [`phases/10-slice-cc-doc-usage.md`](./phases/10-slice-cc-doc-usage.md) |
| 11 | Step 6, machine slug 12/12 — `cc-doc-finalize` **+** Step 7 closeout | [`phases/11-slice-cc-doc-finalize.md`](./phases/11-slice-cc-doc-finalize.md) |

---

## Interactive input contract

When this skill needs designer input (component list, Figma file key, shadcn init choices, optional `/code-connect` chaining), use **AskUserQuestion** — **one question per tool call**, wait for each reply before the next. Do not dump multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **shadcn-compatible project** — Next.js, Vite, Remix, or any React framework supported by shadcn/ui. The project must have a `package.json` at its root.
- **`/create-design-system` run first** — Token variable bindings in Figma come from the `Theme`, `Layout`, and `Typography` collections. The CSS token file (`tokens.css`) written by `/create-design-system` must also exist in the local project — this is what components import for their CSS custom properties. If the file is absent, components are drawn to canvas with hardcoded fallback values and a warning is reported.
- **Active Figma file open** — The agent needs a target Figma file key. This is taken from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Figma MCP connector authenticated** — All canvas writes use `mcp__claude_ai_Figma__*` tools. No separate PAT setup required.
- **`use_figma` discipline** — Load **figma-use** before every `use_figma` call (workspace / connector rule). Prefer **editing the committed §6 template** over reauthoring layout from memory; component doc pages share the same **resize / Hug / `textAutoResize`** footguns as style-guide tables — see **create-design-system `SKILL.md` §0.1–§0.2** and **§0.10** (`resize` resets modes; `usage` row; matrix cells) and [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) §10–10.2.

---

## Detailed procedural spec (Steps 1–8)

Steps **1–8** — resolve list, tokens, shadcn, icon pack, install, Mode A/B CONFIG, registry, **Step 6** ladder (`use_figma` template incl. CONFIG shape, migration **§6.M**, reporting table) — live in **[REFERENCE-agent-steps.md](./REFERENCE-agent-steps.md)**. The **component → page routing** table (generated by `npm run build:docs`) is maintained there inside Step 6.B.

**Conflict rule (unchanged):** [`EXECUTOR.md`](./EXECUTOR.md) wins assembly and MCP transport; [`conventions/`](./conventions/00-overview.md) shards win cited geometry.

---

## Step 9 — Self-check before reporting a component "drawn"

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
- **Canvas placement** uses `use_figma` for general frame and variant creation. The agent routes each component to its designated page in the Detroit Labs Foundations scaffold ([`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) Step **6.B** routing table) using `figma.setCurrentPageAsync`. If the file was not scaffolded by `/new-project`, it falls back to the current active page with a warning.
- **Token bindings** are a best-effort match based on variable names in the `Theme`, `Layout`, and `Typography` collections created by `/create-design-system`. Review bindings in Figma after the skill completes and adjust any that do not match your intended semantic mapping.
- **shadcn/ui version:** Always installs the latest release via `npx shadcn@latest`. To pin a version, the designer should configure the shadcn version in `package.json` before invoking this skill.

