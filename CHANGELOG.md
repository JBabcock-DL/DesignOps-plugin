# Changelog

All notable changes to DesignOps-plugin live here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are in `YYYY-MM-DD`. Older commit history is in `git log`.

## [Unreleased]

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

### Upcoming

Peak-optimization sweep is now complete end-to-end. All 8 phases shipped in a single pass per [`C:/Users/jbabc/.cursor/plans/peak-optimization-sweep_fdf2bc4f.plan.md`](file:///C:/Users/jbabc/.cursor/plans/peak-optimization-sweep_fdf2bc4f.plan.md). Future optimization work will be tracked in a new plan.
