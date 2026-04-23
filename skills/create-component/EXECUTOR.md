# /create-component — EXECUTOR (canonical quickstart / former §0)

> **Repo vs marketplace:** If you edit this file under `skills/create-component/`, mirror the same file to the Claude plugin cache per [`AGENTS.md`](../../AGENTS.md) § *Skill edits — repo is canonical, marketplace cache is downstream* so local installs do not run stale instructions.

---

## §0 — Quickstart recipe for any agent

> **This file is the single canonical recipe for assembly, preflight, and MCP transport.** Any agent opening this skill cold should `Read` this file in full before deeper sections in [`SKILL.md`](./SKILL.md). If this file and a deeper `SKILL.md` section ever disagree, **this EXECUTOR quickstart wins** for Steps 1–7 / assembly / transport; `SKILL.md` remains authoritative for long-form §4–§9 edge cases when explicitly cited.

**Outcome:** for each requested component, one ComponentSet drawn into its target `↳ {Page}`, wrapped in a documentation frame (header → properties table → inline ComponentSet → Variant × State matrix → Usage Do/Don't), with element component properties unified at the ComponentSet level (`Label`, `Leading icon`, `Trailing icon`), bound to the user's Theme/Layout/Typography variables.

**Tools you will use:** `AskUserQuestion`, `Shell` (for `npx shadcn@latest` + file reads), `Read` / `Glob` / `Grep`, **`Task` → [`create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md) (default Step 6 — six sequential Tasks for the min-slice ladder)** or **`Task` → [`create-component-figma-runner/SKILL.md`](../create-component-figma-runner/SKILL.md) (legacy single-Task: two-phase / six internal steps / one-shot)**, `use_figma` (fallback inline path only), `get_screenshot` (final visual check).

**MCP payloads:** Each `use_figma` invocation must pass its Plugin API script **inline** in the tool’s `code` field. In the **default** path the **subagent** builds that string; in the **fallback** path the **parent** builds it from [`SKILL.md`](./SKILL.md) + committed `templates/*.figma.js`. Do **not** add throwaway `.mcp-*` / `*-payload.json` / scratch copies under the repo to stage scripts — see [`AGENTS.md`](../../AGENTS.md).

**Step 6 — transport (slice-runner first, same as canvas-bundle style):**

1. **Default — six sequential `Task`s → [`create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md)** whenever the host exposes **`Task`**. The parent completes Steps **1–5** and **4.7**, then runs the fixed DAG in [`conventions/13-component-draw-orchestrator.md`](./conventions/13-component-draw-orchestrator.md) **§1** — `cc-variants` → `cc-doc-props` → `cc-doc-component` → `cc-doc-matrix` → `cc-doc-usage` → `cc-doc-finalize` — **one `Task` per slug**. Each prompt passes the same **`configBlock`** (verbatim `const CONFIG = { … };`), **`layout`**, **`fileKey`**, **`createComponentRoot`**, **registry** (as [slice runner §0](../create-component-figma-slice-runner/SKILL.md)), and **`handoffJson`** built from the **previous** slice return (first slice: `{}`). The parent **must not** `Read` `*.min.figma.js` engines into the main thread. **Step 5.5** / `check-payload` runs **inside** each subagent. On the **final** slice (`cc-doc-finalize`) success, the parent runs **`SKILL.md` §9** and **5.2** on that return only.

2. **Legacy — one `Task` → [`create-component-figma-runner/SKILL.md`](../create-component-figma-runner/SKILL.md)** when the parent prefers a **single** subagent for all `use_figma` calls: **default `twoPhaseDraw`** (two calls), or **`sixStepDraw: true`** (six internal calls, same min paths as the slice runner), or **`twoPhaseDraw: false`** (one full script), or **`preassembledCodePaths`** per runner **§0.1**. Same `configBlock` / registry as **§0** of that skill.

3. **Fallback — inline `use_figma` in the parent** only when **`Task` / subagent is unavailable** or the designer **explicitly** requests a single-thread draw. Follow the **inline assembly order** below; the parent runs **Step 5.5** before submitting `use_figma`.

**🚨 Inline fallback — script-assembly order for Step 6 (`use_figma`):** Use **only** when **not** delegating to **`create-component-figma-slice-runner`** (six-`Task` chain) or **`create-component-figma-runner`** (legacy single-`Task`). The `code` payload MUST be assembled in this exact order. Three steps — skipping any of them throws a clear, actionable error at the top of the engine bundle's preamble-presence gate.

1. **§0 CONFIG object** — the per-component block below (the only per-component edit surface). Typical size 1–4 KB.
2. **`Read` [`templates/preamble.figma.js`](./templates/preamble.figma.js) and inline it verbatim.** ~2 KB. Declares the seven boundary identifiers the engine bundle expects already in scope: `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS`, `usesComposes`, `logFileKeyMismatch`, `_fileKeyObserved`, `_fileKeyMismatch` — plus the soft fileKey-mismatch warning side-effect (see `SKILL.md` Step 5.1). Agent replaces the `ACTIVE_FILE_KEY` and `REGISTRY_COMPONENTS` literals with data from `.designops-registry.json` before submitting.
3. **`Read` and inline the per-archetype engine bundle that matches `CONFIG.layout`** (table below). Paste immediately after the preamble. No further wrapping — §6.9a self-check is at the tail of the bundle and `return`s the payload.

| `CONFIG.layout` | Inline this file | Approximate size |
|---|---|---|
| `chip` | [`templates/create-component-engine-chip.min.figma.js`](./templates/create-component-engine-chip.min.figma.js) | ~26 KB |
| `surface-stack` | [`templates/create-component-engine-surface-stack.min.figma.js`](./templates/create-component-engine-surface-stack.min.figma.js) | ~32 KB |
| `field` | [`templates/create-component-engine-field.min.figma.js`](./templates/create-component-engine-field.min.figma.js) | ~32 KB |
| `row-item` | [`templates/create-component-engine-row-item.min.figma.js`](./templates/create-component-engine-row-item.min.figma.js) | ~31 KB |
| `tiny` | [`templates/create-component-engine-tiny.min.figma.js`](./templates/create-component-engine-tiny.min.figma.js) | ~32 KB |
| `control` | [`templates/create-component-engine-control.min.figma.js`](./templates/create-component-engine-control.min.figma.js) | ~31 KB |
| `container` | [`templates/create-component-engine-container.min.figma.js`](./templates/create-component-engine-container.min.figma.js) | ~32 KB |
| `__composes__` | [`templates/create-component-engine-composed.min.figma.js`](./templates/create-component-engine-composed.min.figma.js) | ~31 KB |

Each bundle is pre-assembled from `draw-engine.figma.js` + the one archetype builder it needs (plus shared helpers). The full 7-archetype bundle ([`create-component-engine.min.figma.js`](./templates/create-component-engine.min.figma.js)) is committed too but is **debug-only**: it lands at ~50 KB, which is exactly the `use_figma.code` `maxLength` ceiling — no room left for CONFIG + preamble. **Never inline the full bundle at runtime.** Per-archetype bundles have 17–23 KB of CONFIG + preamble headroom each.

**Why per-archetype?** The MCP tool descriptor caps `use_figma.code` at 50 000 characters. A single bundle containing all seven archetype builders minifies to ~49.4 KB — technically under the limit but too tight once the agent prepends CONFIG + preamble, so submissions get rejected before they reach Figma. Each component only needs ONE archetype builder (picked by `CONFIG.layout`), so the build script emits one bundle per archetype with only that one builder inlined.

Three runtime `typeof` asserts at the top and tail of every bundle catch the most common payload-assembly mistakes:

| Assert | Location | Catches |
|---|---|---|
| **Preamble-presence gate** | top of bundle (draw-engine §0a) | missing preamble.figma.js — lists which of the 7 boundary identifiers are undefined |
| **Archetype builder gate** | mid-bundle (§6.2a dispatch) | wrong bundle inlined for `CONFIG.layout` (e.g. `field` bundle inlined for a `surface-stack` draw) |
| **Doc-pipeline gate** | mid-bundle (§6.2a) | truncated bundle — draw-engine missing one of `makeFrame` / `makeText` / `buildVariant` / `buildPropertiesTable` / `buildComponentSetSection` / `buildMatrix` / `buildUsageNotes` |

Minification uses identifier mangling but renames declarations and references together in the same compilation unit, so the asserts evaluate against the mangled names correctly. The seven "boundary" identifiers that cross into the bundle from step 1 (CONFIG) and step 2 (preamble.figma.js) are *referenced but never declared* inside the engine templates, so esbuild treats them as free variables and leaves their names intact automatically.

If your `Read` of this file or [`SKILL.md`](./SKILL.md) truncates before the assembly table, assume Steps 2 and 3 are missing. Re-`Read` [`templates/preamble.figma.js`](./templates/preamble.figma.js) **and** the per-archetype `create-component-engine-{layout}.min.figma.js` file explicitly by path — do not trust a truncated panel.

**🚨 Before you submit, run a local syntax + JSON-transport preflight (Step 5.5).** Every `use_figma` call MUST pass TWO gates locally: (1) the payload parses cleanly as an async function body, and (2) it round-trips through `JSON.stringify` → `JSON.parse` losslessly with no `\xHH` hex escapes. Pipe the assembled payload through [`scripts/check-payload.mjs`](../../scripts/check-payload.mjs) (or `npm run check-payload -- <path>`) **after** assembly but **before** the `use_figma` invocation. The script runs offline in ~1 second, reports either failure with actionable diagnostics, and costs zero Figma round-trips. Skip this and one of the two classic failure modes will burn a full tool call to surface the same error with worse diagnostics:

- **Gate 1 (JS parse):** a hand-retyped `summary` / `usageDo` / `description` string with an unescaped apostrophe → `SyntaxError: expecting ')'`. Angle brackets (`<label>`) in strings are a red herring — do not chase them.
- **Gate 2 (JSON transport):** a `\xHH` hex escape somewhere in the payload (valid JS, invalid JSON) → `Bad escaped character in JSON at position N` when MCP serializes `use_figma.code` over stdio. The committed `*.min.figma.js` bundles pin esbuild to `charset: 'utf8'` to avoid this at build time; if you see `\xHH` in a fresh bundle, the flag was dropped — restore it in `scripts/build-min-templates.mjs` per [`templates/README.md`](./templates/README.md). Hand-authored CONFIG? Use literal characters (`§`, `×`, `·`, `¬`) or `\u00HH` — never `\xHH`.

**Short-context agents / MCP transport (Composer-class hosts).** The skill contract is the same across products; **orchestration and transport** differ. Short output limits or fragile tool plumbing cause failures that are **not** Figma API bugs.

| Topic | Guidance |
|--------|-----------|
| **`Unexpected end of JSON input` (or empty tool args) on `use_figma`** | The MCP request body was **truncated, incomplete, or not valid JSON**. After assembly, verify the **entire** tool-arguments object serializes: `JSON.stringify` → `JSON.parse` with no throw. `check-payload.mjs` validates the `code` **string** only — it does not prove the **wrapper** JSON is complete. |
| **50k `code` cap** | MCP `use_figma.code` **`maxLength` is 50 000** characters. Use **one** per-archetype `create-component-engine-{layout}.min.figma.js` + CONFIG + preamble (table above). **Never** inline the full debug [`create-component-engine.min.figma.js`](./templates/create-component-engine.min.figma.js) at runtime. Typical assembled payloads are ~40–43K — inside the cap when **one** string is passed whole. |
| **Gzip / base64 bootstrap** | **Do not use** as the default path. Figma MCP plugin sandboxes often lack **`DecompressionStream`** and other browser APIs — a gzip-decode wrapper **fails at runtime**. Use **plain** committed template text only; see [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) § *MCP host constraints*. |
| **Session / output limits** | Prefer finishing **install → 4.5 → 4.7 → six `Task`s (slice runner, default) or one legacy `Task` (figma-runner) or inline** per component; then **registry** — before the next component or in a new turn if context is tight. |
| **Session runbook (tables + components)** | If the same chat run includes `/create-design-system` style-guide tables and `/create-component`, **finish 15a–c + 17** (via `canvas-bundle-runner` only) before any component Figma draw — see [`AGENTS.md`](../../AGENTS.md) § *Session runbook*. Do not interleave a table bundle `use_figma` and a component `use_figma` in one parent turn. |
| **Sequential orchestration vs phased Step 6** | **Orchestration:** Treat **tables**, **each style-guide bundle**, and **each component** as **separate** Tasks / turns — never one parent message that mixes them. **Per-component draw — default:** **six** `Task`s → [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) with **handoff JSON** per [`conventions/13-component-draw-orchestrator.md`](./conventions/13-component-draw-orchestrator.md) and [`conventions/09-mcp-multi-step-doc-pipeline.md`](./conventions/09-mcp-multi-step-doc-pipeline.md). **Legacy:** one `Task` → [`create-component-figma-runner`](../create-component-figma-runner/SKILL.md) (**§1b** / **`sixStepDraw: true`** / **`twoPhaseDraw: false`**). **Shipped** min slices: `create-component-engine-{layout}.step0.min.figma.js` + `create-component-engine-doc.step1`…`step5`. **Anti-pattern:** `Read`ing min engines into the parent thread. |
| **Full JSON wrapper** | After `check-payload` on `code` only, you may run [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs) on a JSON file or stdin containing the full `use_figma` tool arguments to verify the host can serialize the whole object (UTF-8 size + parse). |
| **Step 6 default — slice runner + orchestrator** | When **`Task` exists**, **prefer** six sequential delegations to [`../create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md) per [§13](./conventions/13-component-draw-orchestrator.md). **Legacy** single-Task: [`../create-component-figma-runner/SKILL.md`](../create-component-figma-runner/SKILL.md). **Fallback:** inline only when `Task` is unavailable. |
| **Long single-line minified bundles** | Editor UIs may **clip** one long line when copying. **`Read` the bundle file path in full** (or pipe the file to `check-payload`) and pass that complete string into MCP — never hand-copy a partial line from the panel. |
| **Repo hygiene** | Do not commit `*.tmp.js` / payload scratch under the repo. Use [`AGENTS.md`](../../AGENTS.md) rules: `/tmp`, stdin, or ephemeral paths only. |

**Optional host probe (once per session when debugging transport):** a minimal `use_figma` payload may `return { hasDecompressionStream: typeof DecompressionStream !== 'undefined', fileKey: figma.fileKey };` — if `hasDecompressionStream` is false, **no gzip path**; if `fileKey` is `headless` or mismatched, rely on **`ACTIVE_FILE_KEY`** / handoff / registry (preamble already treats `figma.fileKey` as a soft signal). Mode A/B (`SKILL.md` §4.5.0) is unrelated to these transport issues.

**CONFIG-authoring rules — non-negotiable:**

- **Do NOT hand-retype `summary`, `properties`, `usageDo`, `usageDont`, or any other string field from [`shadcn-props/<component>.json`](./shadcn-props/).** `Read` the JSON file and inline the entry as a JS object literal (JSON is a strict subset of JavaScript, so every field is already correctly escaped). Re-typing prose is the #1 source of `SyntaxError: expecting ')'` / `Unexpected token` crashes — apostrophes in text (`doesn't`, `you're`) collide with single-quote delimiters, backticks collide with template literals, and the agent often misdiagnoses the crash as a `<label>`-HTML-tag issue and re-spirals (see the anti-pattern note at [`conventions/07-token-paths.md` § red-herrings](./conventions/07-token-paths.md) and below).
- **Angle brackets (`<`, `>`) inside JS string literals are valid.** A `summary` field like `'Native <label> associated with a form control via htmlFor.'` is not a syntax error — do not chase it. The error is elsewhere. Run `check-payload.mjs` to find the real position.
- **For string-field edits that can't come from shadcn-props** (variant-specific copy, custom `usageDo` beyond the defaults), prefer **double-quoted** or **template-literal** delimiters — most authored prose contains apostrophes, few contain backticks, almost none contain both.

> **Regenerating bundles.** Run `npm run build:min` after editing either source template (`draw-engine.figma.js` or `archetype-builders.figma.js`). The build emits eleven artifacts: 8 per-archetype runtime bundles, the full debug bundle, and 2 standalone debug `.min.figma.js` files. The build refuses to write any per-archetype bundle larger than `HARD_LIMIT - CONFIG_HEADROOM` (40 000 bytes) so a growth regression in the source is caught at build time, not at agent run time. `scripts/verify-cache.sh` refuses to pass if any source is newer than any of its generated outputs. CI gate: `npm run verify` (runs `build:docs:check`, `build:min:check`, `verify-cache`).

**Twelve steps. Do not skip any.** (Step 4.3 — peer-dep audit — catches shadcn CLI gaps like missing `class-variance-authority`; Step 4.7 — pre-flight token verification — silently falls back to hex if you skip it; Step 5.5 — local syntax preflight — burns a `use_figma` round-trip on a syntax error you could have caught in 1 second locally.)

| # | Step | Tool | Required inputs | Expected outcome |
|---|------|------|-----------------|------------------|
| 1 | Resolve component list | `AskUserQuestion` (if missing) | argument-hint list or designer reply | `components: string[]` of kebab-case shadcn names (`button`, `input`, …) |
| 2 | Locate `tokens.css` | `Read` / `Glob` | repo path | `TOKEN_CSS_PATH: string \| null` — absolute path or `null` if designer skipped |
| 3 | Initialize shadcn + wire tokens | `Shell` + `AskUserQuestion` | `components.json` presence check | `components.json` exists, `tokens.css` imported at top of `globals.css`, variable-declaration blocks removed |
| 3b | Icon-pack bootstrap (first-time-only) | `Read` (probe) → `AskUserQuestion` (only if missing) | `designops.config.json` presence check | `ICON_PACK: { npm, import, figmaIconLibraryKey, defaultIconRef } \| null` — persisted to `designops.config.json`; skipped silently on subsequent runs. Prompts accept Figma URLs, node-ids, or component keys — parser classifies the paste, `draw-engine.figma.js §5.6` resolves at draw time. |
| 4 | Install each component | `Shell` | `npx shadcn@latest add {component}` + `npm install {ICON_PACK.npm}` (when set, first run only) | Files written under `components/ui/`, per-component status `installed \| already_exists \| failed`; icon-pack dependency present in `package.json` |
| 4.3 | Peer-dep audit (shadcn CLI gap guard) | `Read` + `Shell` | Just-installed component's source file + `package.json` | Any `class-variance-authority` / `clsx` / `tailwind-merge` / `@radix-ui/react-*` / `cmdk` / etc. that the component imports but `package.json` is missing gets `npm install`-ed in one batched command. Prevents `Cannot find module 'class-variance-authority'` at compile time. |
| 4.4 | Icon-pack import rewrite (global) | `Read` / `StrReplace` (AST preferred) | `ICON_PACK.choice` + installed source files | `from 'lucide-react'` imports + JSX identifiers rewritten to match Step 3b choice (material-symbols mapped, custom specifier-swapped, lucide-react / none = no-op); pinned comment added for idempotence |
| 4.7 | Pre-flight token-path verification | `get_variable_defs` OR `use_figma` probe | Active fileKey + staged `CONFIG` | `AVAILABLE_TOKEN_PATHS: Set<string>`; every `CONFIG.*Var` / `CONFIG.style[*].fill` / `padH` / `radius` value confirmed present. Misses → **AskUserQuestion** (never silent hex fallback). See [`conventions/07-token-paths.md`](./conventions/07-token-paths.md). |
| 5 | Resolve Figma file key | handoff lookup → `AskUserQuestion` fallback | `templates/agent-handoff.md` frontmatter | `fileKey: string` |
| 5.5 | Local syntax + full-code preflight | [`scripts/check-payload.mjs`](../../scripts/check-payload.mjs) (or `npm run check-payload`) | **Subagent path:** each slice- or legacy-runner `Task` runs this on the assembled `code` (same assembly contract as [runner §1](../create-component-figma-runner/SKILL.md) / [slice runner §0.1](../create-component-figma-slice-runner/SKILL.md)). **Inline path:** parent runs on CONFIG + preamble + engine (full `code` string). Script exits 0 with `OK …`; if it exits 1, **never** submit. |
| 6 | Draw component → Figma | **`Task` → `create-component-figma-slice-runner` ×6 (default)** or **`Task` → `create-component-figma-runner` (legacy)** or **`use_figma`** (fallback) | **Slice chain:** per [`conventions/13`](./conventions/13-component-draw-orchestrator.md) + slice runner **§0**. **Legacy runner:** runner **§0**. **Inline:** `fileKey`, assembled `code` per §6 template below. | **Slice path:** last slice return for §9. **Runner path:** phase 2 or final step return. |
| 7 | Self-check the return payload | agent-side assertions per `SKILL.md` §9 | step 6's return JSON | Zero drift; if any assertion fails, stop and report — do not mark the component done |

### §0.1 — Decision tree for edge cases

- **No components provided** → step 1 prompts with the full supported list (see the routing table in `SKILL.md` §6).
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
unresolvedTokenPaths.total === 0   (any miss means Step 4.7 was skipped or a path is wrong — see conventions/07-token-paths.md)
```

If any row fails → surface the failure verbatim in the run report and do NOT claim the component "drawn". See `SKILL.md` §9 for the full self-check.

### §0.3 — Deep-section map

| Topic | Section |
|-------|---------|
| Interactive prompts | `SKILL.md` §1 Interactive input contract |
| Shadcn init + token wiring | `SKILL.md` §3 / §3a |
| Icon-pack bootstrap (first-time-only) | `SKILL.md` §3b |
| Install per component | `SKILL.md` §4 |
| Icon-pack import rewrite (lucide → chosen pack) | `SKILL.md` §4.4 |
| Mode A contract · when Mode B is normal · extractor exit-1 discipline | `SKILL.md` §4.5.0 |
| File-key resolution | `SKILL.md` §5 |
| The `use_figma` template (CONFIG + draw engine) | `SKILL.md` §6 |
| Reporting table | `SKILL.md` §8 |
| Self-check before reporting "drawn" | `SKILL.md` §9 |
| Icon slots + element properties spec | [`conventions/01-config-schema.md` §3.3](./conventions/01-config-schema.md) |
| State override policy | [`conventions/04-doc-pipeline-contract.md` §13.1](./conventions/04-doc-pipeline-contract.md) |
| Audit checklist | [`conventions/06-audit-checklist.md` §14](./conventions/06-audit-checklist.md) |
| Token-path canonicals + pre-flight + banned strategies | [`conventions/07-token-paths.md`](./conventions/07-token-paths.md) |
| Short-context / MCP transport (50k cap, no gzip, JSON completeness) | This file §0 *Short-context agents / MCP transport* |
