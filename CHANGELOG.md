# Changelog

All notable changes to DesignOps-plugin live here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are in `YYYY-MM-DD`. Older commit history is in `git log`.

## [Unreleased]

### Changed — `/create-component` Step 6: granular scaffold (docs alignment)

- **10** machine slugs in [`scripts/merge-create-component-handoff.mjs`](scripts/merge-create-component-handoff.mjs) `SLUG_ORDER`: four first-class **`cc-doc-scaffold-*`** sub-slugs before **`cc-variants`**, then the existing doc ladder through **`cc-doc-finalize`**.
- Normative and operator docs updated for the new flow: [`skills/create-component/conventions/13-component-draw-orchestrator.md`](skills/create-component/conventions/13-component-draw-orchestrator.md), phase **04**, [`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md), [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md), [`README.md`](README.md) (min-template section), [`10-phased-payload-research.md`](skills/create-component/conventions/10-phased-payload-research.md), [`17-scaffold-sub-slice-states.md`](skills/create-component/conventions/17-scaffold-sub-slice-states.md), [`12-sigma-budget-mcp.md`](skills/create-component/conventions/12-sigma-budget-mcp.md), [`sync-design-system/phases/07-10-axes-BC.md`](skills/sync-design-system/phases/07-10-axes-BC.md). **`.claude/settings.json`** merge example step → `cc-doc-scaffold-shell`.

### Removed — redundant MCP research under `docs/research/`

- Deleted spin-off **closure report**, **large-payload phase log**, **Plan A pre-ship plan**, and the extra copy of the **solution architecture** that lived under `docs/research/`. **Single canonical write-up:** [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) (moved to `docs/`). Links updated in **`AGENTS.md`**, **`EXECUTOR`**, **[`08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md)**, [`docs/mcp-transport-cursor-fallback.md`](docs/mcp-transport-cursor-fallback.md).

### Removed — local Figma MCP file proxy (stdio package)

- **`tools/mcp-figma-file-proxy/`** — deleted (was optional stdio `use_figma_from_mcp_args_file` + HTTP forward to `mcp.figma.com`). **Reason:** Figma’s remote MCP expects **OAuth** in **catalog** clients; **PAT** is not valid for that endpoint; a standalone `node` process **does not** receive Cursor’s session. The supported large-payload path remains **parent `Read` of `mcp-*.json` + official `use_figma`**. Docs updated: **`AGENTS.md`**, **`EXECUTOR`**, **`08`**, **fallback**, **solution architecture §6.4**, **closure report**; removed **`mcp-figma-proxy-auth-spike.md`**. `npm run mcp:figma-proxy` removed from root **`package.json`**.

### Updated — MCP research compile + solution ideation (2026-04-27)

- **[`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md)** — Compiles 2026-04-27 spike: parent E2E at **5k / 10k** `code` (recorded `maxProvenSize` **10,279** B in sibling `figTest` draw dir), blockers for **25k** in one agent `call_mcp` (not Figma 50k cap), new **section 6 — Solution ideation** (tiers, decision matrix, next steps). Stakeholder row refreshed. *(2026-04-28: path moved to `docs/`; subsidiary research files under `docs/research/` later removed — see [Unreleased].)*
- **Earlier spin-off docs** (`mcp-transport-closure-report`, `mcp-large-payload-transport-2026`) — *removed 2026-04-28*; content consolidated into the solution architecture doc.

### Changed — `probe-parent-transport.mjs` (2026-04-27)

- **`--file-key`** — Optional Figma file key for emit mode; use a real file so the plugin can return `ok: true` with `observedCodeBytes`, not only transport-level errors with `PROBE_NO_FIGMA_FILE_REQUIRED`.

### Added — MCP transport solution architecture handoff (2026-04-27)

- **[`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md)** — Full research roll-up for SA: hypotheses, measured table, default architecture, pivot triggers, stakeholder matrix, 25k “last box” status (manual Composer capstone if agent cannot embed full args in one `call_mcp_tool`). *(Path was `docs/research/…` until 2026-04-28.)*

### Added — MCP transport closure report (2026-04-27) — *file removed 2026-04-28*

- *Superseded; narrative in [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) **§4–5**, **§7**.*

### Added — `use_figma` transport research and fallbacks (2026-04-27) — *large-payload log removed 2026-04-28*

- ~~**`docs/research/mcp-large-payload-transport-2026.md`**~~ — *Phase log removed; measurements and decisions live in [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md).*
- **`docs/mcp-transport-cursor-fallback.md`** — What to do when model/host JSON fails before Figma.
- **`AGENTS.md`**, **`skills/create-component/EXECUTOR.md`**, **`skills/create-component/conventions/08-cursor-composer-mcp.md`** — Pointers to the research and fallback docs.

### Fixed — README matches full plugin surface (2026-04-22)

- **`README.md`** — Documents all **eight** user-facing slash commands (adds **`/dev-handoff`**), updates install copy, **Typical Workflow** step 8, and **Plugin File Structure** (`sync-design-system` shards, **`EXECUTOR.md`**, **`canvas-bundle-runner`**, **`shared/`**).

### Added / changed — Medium-reasoning agent instruction hardening (2026-04-22)

- **`skills/sync-design-system/SKILL.md`** — **Router** (~155 lines) with branch table, `plan` object, non-negotiables, lazy-read rule; step bodies moved to **`skills/sync-design-system/phases/*.md`** and **`reference/token-formats.md`**, **`reference/error-guidance.md`**.
- **`skills/create-component/EXECUTOR.md`** — Canonical **quickstart** (former §0): script assembly, `check-payload` / Step 5.5, MCP transport table, twelve-step table; repo vs marketplace mirror note in header.
- **`skills/create-component/SKILL.md`** — **Entry** block: mandatory `Read` of `EXECUTOR.md` first; conflict rule (EXECUTOR wins assembly/transport; SKILL wins CONFIG / deep §4–§9).
- **`skills/create-design-system/conventions/14-audit.md`** — **After canvas-bundle-runner (parent thread)** gate: explicit PASS/FAIL + minimum lites before “done.”
- **`skills/create-design-system/SKILL.md`** — Canvas subsection: after each `canvas-bundle-runner` Task, run §14 parent gate.
- **`AGENTS.md`** — `check-payload` ⊂ full MCP tool JSON; transport checklist → **EXECUTOR.md**; **Host matrix** (Claude Code vs Cursor).
- **`.cursor/rules/mcp-inline-payloads.mdc`** — Short must-rules + pointer to **`AGENTS.md`** for full policy.
- **`.cursor/rules/cursor-designops-skill-root.mdc`** — Pointer to **`AGENTS.md`** for MCP payload policy.
- **`scripts/check-payload.mjs`** — Header / messages reference **EXECUTOR.md**; documents that passing preflight does not prove wrapper JSON completeness.
- **`README.md`**, **`skills/create-design-system/CONVENTIONS.md`**, **`16-mcp-use-figma-workflow.md`**, create-component conventions — cross-links updated for router / EXECUTOR / §14 gate.
- **Deferred (pending further testing):** optional trim of duplicate long MCP/canvas prose inside **`skills/create-design-system/SKILL.md`** and **`16-mcp-use-figma-workflow.md`** (plan Workstream C *optional* follow-up only — self-contained phase reads preserved for now).

### Changed — Composer / short-context MCP hardening (2026-04-22)

- **`skills/create-component/SKILL.md`** — §0 *Short-context agents / MCP transport*: 50k cap, JSON completeness vs `check-payload`, no gzip/`DecompressionStream`, one-component-per-turn, long-line `Read` discipline, optional host probe; §4.7 intro stresses full variable enumeration when `get_variable_defs` is thin; §0.3 map row.
- **`skills/create-component/conventions/02-archetype-routing.md`** — control archetype: documents `variant=${v}` naming and `/checked=true|pressed=true|on/` heuristic; `indeterminate` / plain `checked` limitations.
- **`AGENTS.md`** — MCP transport bullets under `/create-component` with link to SKILL §0 transport subsection.
- **`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`** — cross-link to create-component §0 for large `use_figma.code` assemblies.
- **`scripts/check-payload.mjs`** — advisory stderr warning when payload JS string length exceeds 49,000 characters (MCP `maxLength` 50,000).

### Changed — create-component Mode A / Mode B agent clarity (2026-04-22)

- **`skills/create-component/SKILL.md`** — new §4.5.0 (cva extraction contract, when `synthetic-fallback` is expected, verbatim JSON logging, Axis B vs create-component); §4.5.a/b and §8 reporting tightened; §0.3 deep-section map row.
- **`skills/create-component/conventions/00-overview.md`** — `synthetic-fallback` split into recoverable vs structural (curated-props-long-term).
- **`skills/create-component/conventions/05-code-connect.md`** — §2.5.5 expanded with exit-1 interpretation table, Axis B note, and future extractor `reason` codes pointer.
- **`skills/create-component/CONVENTIONS.md`** — `07-token-paths` in Files table; new “System audit — Mode A / Mode B” read-order table.
- **`skills/sync-design-system/SKILL.md`** — Axis B `unresolvable` clarified as diff-only; cross-link to create-component §4.5.0.
- **`AGENTS.md`** — `/create-component` Mode A vs Mode B primer with links to SKILL §4.5.0 and `05-code-connect` §2.5.5.
- **`skills/create-component/resolver/extract-cva.mjs`** — header comment points maintainers at optional future `reason` codes (no runtime change).

### Added — Peak-optimization sweep (2026-04-21)

- **`scripts/sync-cache.sh` + `scripts/verify-cache.sh`** — `skills/**` → `~/.claude/plugins/.../skills` mirror, with a pure-bash `rm -rf + cp -r` fallback for Windows / Git Bash where `rsync` is not on PATH. `verify-cache.sh` exits non-zero on any drift and (once Phase 7 lands) on stale minified-template mtimes.
- **`skills/new-project/phases/_shared-token-helpers.figma.js`** — single home for `bindThemeColor` / `bindPrimColor` / `bindThemeStroke` / `hexToRgb` / `getThemeColorVar` / `getPrimColorVar` / `bindThemeStrokeFallback` / `applyDocStyle` / `loadTextStylesOnce` / `tryApplyEffectStyle`. Phases `05b-documentation-headers.md`, `05c-table-of-contents.md`, and `05d-token-overview.md` now inline this helper file via an explicit `↓↓↓ INLINE _shared-token-helpers.figma.js HERE ↓↓↓` marker and assert `typeof bindThemeColor === 'function'` at startup.
- **`scripts/build-create-component-docs.mjs`** — single-source-of-truth generator. Seeds a `category` field on every entry in `skills/create-component/shadcn-props.json` (validated against the new enum in `shadcn-props.schema.json`), then regenerates the "Supported Components" grouped list and the "Component → Page routing" table inside `skills/create-component/SKILL.md` between `<!-- GENERATED:supported-components START/END -->` and `<!-- GENERATED:page-routing-table START/END -->` markers. Supports `--check` for CI.
- **`skills/create-component/conventions/`** — six topic-scoped convention shards (`00-overview.md` router, `01-config-schema.md`, `02-archetype-routing.md`, `03-auto-layout-invariants.md`, `04-doc-pipeline-contract.md`, `05-code-connect.md`, `06-audit-checklist.md`) replacing the monolithic `CONVENTIONS.md` (~940 lines). Legacy `CONVENTIONS.md` kept as a ~35-line router with a §→file map so every existing cross-link still resolves.
- **`skills/create-component/templates/README.md`** — enumerates every `.figma.js` template, the script-assembly insertion points, and the runtime `typeof` assertions each template depends on.

### Changed — Peak-optimization sweep (2026-04-21)

- **`README.md`** — new "Development" section documents the cache sync/verify scripts and the `build-create-component-docs.mjs` generator; "Contributing" updated with the now-required commands. `create-component` bullets in the intro point at the new `conventions/` shard set.
- **`skills/create-component/SKILL.md`** — every `CONVENTIONS.md §X.Y.Z` cross-reference rewritten to point at the corresponding `conventions/*.md` shard. `§6.2a` / `§6.9a` runtime `typeof` assertions now name-check every function imported from `archetype-builders.figma.js` and `draw-engine.figma.js`, so a truncated script-assembly path surfaces as a precise error instead of silently falling back to `buildVariant` (chip).
- **`skills/create-component/templates/archetype-builders.figma.js`** and **`draw-engine.figma.js`** — section banners (`§6.2a`, `§6.6`, `§6.7`, `§6.8`, etc.) rewritten to reference the new shard paths; `draw-engine.figma.js` cross-references `conventions/04-doc-pipeline-contract.md` / `conventions/01-config-schema.md` instead of the legacy monolith.
- **`templates/workflow.md`**, **`skills/new-project/SKILL.md`**, **`skills/code-connect/SKILL.md`** — cross-plugin references to `create-component/CONVENTIONS.md` rewritten to the correct new shard path.

### Fixed — Truncation audit (2026-04-21)

- **`skills/create-component/SKILL.md` archetype-builder truncation** (`3905 lines → ~1400`). The seven archetype builders and their shared drawing helpers were being silently truncated mid-file, causing `/create-component` to fall back to the default `buildVariant` (chip) for every non-chip component. Extracted into `templates/archetype-builders.figma.js` behind an explicit `↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` marker with a runtime `typeof buildSurfaceStackVariant === 'function'` assertion at `§6.2a` so future truncations throw a named error instead of regressing silently.
- **`skills/create-component/SKILL.md` draw-engine truncation** (~1989-line inline JS block). Extracted the full `§0 CONFIG + §§1-6.9a` draw engine into `templates/draw-engine.figma.js`; SKILL.md now holds only the §0 CONFIG shape and a pointer. Added matching `typeof buildPropertiesTable === 'function'` etc. assertions at `§6.9a`.
- **`skills/new-project/phases/05c-table-of-contents.md` + `05d-token-overview.md` truncation** (372- and 781-line inline JS blocks). Extracted into `05c-table-of-contents.figma.js` and `05d-token-overview.figma.js` behind the same inline-marker pattern, with `typeof figma` sanity checks so an unassembled script fails fast.
- **`counterAxisAlignItems = 'STRETCH'` crash** in `buildSurfaceStackVariant` (Card / surface-stack archetype). `'STRETCH'` is only valid on `layoutAlign` (child-side); replaced with `'MIN'` and added the **Figma Auto-Layout Enum Guardrail** block to `archetype-builders.figma.js` + the authoritative section in `conventions/03-auto-layout-invariants.md`.
- **Card documentation regression** — `buildSurfaceStackVariant` was silently forking the doc frame (properties table, ComponentSet tile, usage notes) instead of calling the shared canonical pipeline. Added the "archetype builders must not touch the doc pipeline" contract to `conventions/04-doc-pipeline-contract.md §3.1.3`, plus regression-fingerprint self-checks at `SKILL.md §6.2a` / `§6.6` that throw when a build accidentally reintroduces the custom table.

### Deprecated

- **`skills/create-component/CONVENTIONS.md`** as an authored file. It is now a thin router; all edits should target the appropriate shard in `skills/create-component/conventions/`.

### Added — Minified templates (Phase 7, 2026-04-21)

- **`package.json` + `scripts/build-min-templates.mjs`** — esbuild-driven minifier (whitespace + syntax only; identifier renaming disabled) that writes committed `draw-engine.min.figma.js` (−58%, 77 KB → 32 KB) and `archetype-builders.min.figma.js` (−42%, 53 KB → 30 KB) siblings. Templates are wrapped in an `(async()=>{…})()` IIFE before minification so esbuild can parse the top-level `await` + `return` the Figma plugin sandbox expects, then unwrapped — emitted `.min` files are bare script bodies that /create-component can inline verbatim.
- **`/create-component` script-assembly order** now points at the `*.min.figma.js` variants as the canonical runtime inlines. Non-min source files remain the edit surface; agents only `Read` them for debugging. `draw-engine.figma.js §6.2a` / `§6.9a` `typeof` assertions continue to work because identifier names are preserved.
- **`npm run verify`** — combined CI gate (`build:docs:check` + `build:min:check` + `verify-cache`). `scripts/verify-cache.sh` already fails when any `*.figma.js` is newer than its `.min` sibling, so a commit that forgets `npm run build:min` is caught.
- **`.gitignore`** — seeded with `node_modules/`, `.DS_Store`, and the `.mcp-*` / `*-payload.json` scratch patterns [`AGENTS.md`](AGENTS.md) bans.

### Added — shadcn-props split (Phase 8, 2026-04-21)

- **`skills/create-component/shadcn-props/`** — 59 per-component JSON files (`accordion.json` … `typography.json`) + `_index.json` (~3 KB manifest listing `{name, category, layout, pageName, docsUrl, file}` for every component). Agents can `Read` a single `{component}.json` (~300 B – 3 KB) to load Mode A metadata instead of pulling the 65 KB monolith.
- **`scripts/split-shadcn-props.mjs`** — one-time migration that explodes the monolithic `shadcn-props.json` into the per-component layout. Idempotent; kept for disaster-recovery.
- **`scripts/build-shadcn-props.mjs`** — rebuilds the monolithic `shadcn-props.json` + `_index.json` from `shadcn-props/*.json`. `--check` fails on drift. `npm run verify` now runs `build:props:check` before `build:docs:check` so a forgotten `npm run build:props` is caught by CI.
- **`scripts/build-create-component-docs.mjs`** now prefers `shadcn-props/` when it exists, and `persistPropsAfterMigration` writes category seeds back to the split directory *and* regenerates the monolith in one step. Falls back to the monolith-only path on a fresh clone before the split exists.
- **`skills/create-component/SKILL.md`** — Mode A Step 4.5 guidance now points agents at `shadcn-props/{component}.json` + `shadcn-props/_index.json` as the preferred reads; the monolith is labelled a build artifact.

### Fixed — Phase 7 post-mortem: minified templates were not agent-runnable (2026-04-21)

- **Root cause.** The two-file inline workflow shipped in Phase 7 required agents to splice `archetype-builders.min.figma.js` into `draw-engine.min.figma.js` at the comment marker `// ↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` between §5.7 and §6.0. Minification strips all comments, so in the emitted `draw-engine.min.figma.js` the marker is gone — there is no reliable, machine-findable split point. Agents trying to reconstruct the insertion by hand would either (a) paste `archetype-builders` before `draw-engine` (→ `buildVariant` / `bindColor` / `labelFont` are not yet declared; `typeof` probe is safe but helpers referenced by the archetype builders only resolve at call time through closure, which actually works for function decls — but see (b)), (b) paste after `draw-engine` (→ the §6.2a dispatch throws before archetype-builders defines anything), or (c) attempt to find the split point by pattern-matching on `buildVariant`'s closing brace in the minified blob, which is fragile.
- **Fix.** `scripts/build-min-templates.mjs` now emits a third, committed artifact — [`skills/create-component/templates/create-component-engine.min.figma.js`](skills/create-component/templates/create-component-engine.min.figma.js) — which is the pre-bundled draw-engine with archetype-builders already inlined at the correct split point. The build does the splice from the **source** files before minification (where the marker still exists), then minifies the three resulting fragments independently and concatenates them. Agents now inline **one** file after the §0 CONFIG preamble; the two standalone `.min` siblings are kept as debugging artifacts only.
- **Runtime assertion update.** The error thrown from `draw-engine.figma.js §6.2a` when an archetype builder is missing now points agents at `create-component-engine.min.figma.js` first, with a note that the legacy two-file path is broken by design. The assertion still fires correctly for the bundle path (it cannot trigger there, because archetype-builders are guaranteed-present), so it remains a belt-and-suspenders guard for future refactors.
- **CI gate.** `scripts/verify-cache.sh` now has an explicit bundle-freshness check — the bundle stales if **either** `draw-engine.figma.js` **or** `archetype-builders.figma.js` is newer than `create-component-engine.min.figma.js`. `build-min-templates.mjs --check` tracks the bundle as two drift rows (one per source) so `--check` surfaces the actually-stale input.
- **Docs.** `skills/create-component/SKILL.md` Script-assembly order rewritten from three steps (CONFIG + 2 files) to two (CONFIG + bundle). `skills/create-component/templates/README.md` now leads with the bundle and labels the standalone `.min` siblings as debugging-only. Repo `README.md` "Regenerating minified templates" section updated with the new three-artifact emission list and the reason the bundle is canonical.

### Fixed — Phase 7 post-mortem²: bundle exceeded `use_figma.code` limit (2026-04-21)

- **Root cause.** The `use_figma` MCP tool descriptor caps the `code` argument at `maxLength: 50000` characters ([`mcps/plugin-figma-figma/tools/use_figma.json`](mcps/plugin-figma-figma/tools/use_figma.json) line 13). The single bundled `create-component-engine.min.figma.js` shipped in the first Phase 7 post-mortem weighed ~63 KB with identifier names preserved — the MCP would reject it before it reached Figma. Even with identifier mangling the full bundle lands at ~49.4 KB, leaving no room for the agent's §0 CONFIG preamble (typically 1–4 KB).
- **Fix — per-archetype pre-bundles.** `scripts/build-min-templates.mjs` now emits **eight** pre-bundles, one per `CONFIG.layout` value (`chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `composed`). Each bundle contains draw-engine + the one archetype builder it needs (+ shared helpers), minified as a single compilation unit with identifier mangling enabled. Sizes land at 26–32 KB, leaving 17–23 KB of CONFIG headroom. The build refuses to write any per-archetype bundle larger than 40 000 bytes (`HARD_LIMIT - CONFIG_HEADROOM`) so a source-growth regression is caught at build time. The full 7-archetype bundle is still emitted but is explicitly labelled debug-only (~50 KB, unusable at runtime).
- **Why identifier mangling is safe now.** Single-unit minification renames declarations and references in lockstep, so `typeof buildSurfaceStackVariant === 'function'` at `draw-engine.figma.js §6.2a` still evaluates correctly (both sides get the same mangled name). The four boundary identifiers declared by the agent's §0 CONFIG preamble (`CONFIG`, `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS`, `usesComposes`) appear in the templates as *referenced but undeclared* symbols, which esbuild treats as free variables and leaves un-renamed.
- **Agent routing.** `skills/create-component/SKILL.md`'s Script-assembly order now leads with a `CONFIG.layout → bundle file` table. Agents inline exactly one of the eight per-archetype `create-component-engine-{layout}.min.figma.js` files after the §0 CONFIG block. The runtime error at `draw-engine.figma.js §6.2a` was updated to name the specific per-archetype bundle the agent should have inlined, instead of pointing at the full bundle.
- **CI gate.** `scripts/verify-cache.sh` now tracks all eight per-archetype bundles plus the full debug bundle (nine bundle artifacts total) against both source `.figma.js` files, so editing either source without rebuilding surfaces as nine rows of stale-output warnings in one pass.
- **Docs.** [`skills/create-component/templates/README.md`](skills/create-component/templates/README.md) leads with the routing table, explains why mangling is safe in the single-compilation-unit model, and flags the three debug-only siblings. The repo [`README.md`](README.md) "Regenerating minified templates" section was rewritten to enumerate all 11 emitted artifacts.

### Upcoming

Peak-optimization sweep is now complete end-to-end. All 8 phases shipped in a single pass per [`C:/Users/jbabc/.cursor/plans/peak-optimization-sweep_fdf2bc4f.plan.md`](file:///C:/Users/jbabc/.cursor/plans/peak-optimization-sweep_fdf2bc4f.plan.md). Future optimization work will be tracked in a new plan.
