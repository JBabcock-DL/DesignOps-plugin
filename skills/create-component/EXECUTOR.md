# /create-component — EXECUTOR (canonical quickstart / former §0)

> **Repo vs marketplace:** If you edit this file under `skills/create-component/`, mirror the same file to the Claude plugin cache per [`AGENTS.md`](../../AGENTS.md) § *Skill edits — repo is canonical, marketplace cache is downstream* so local installs do not run stale instructions.

---

## §0 — Quickstart recipe for any agent

> **This file is the single canonical recipe for assembly, preflight, and MCP transport.** Any agent opening this skill cold should `Read` this file in full, then open [`SKILL.md`](./SKILL.md) for §9 + supported components and [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) when full Steps 1–8 prose is needed. If this file and narrative elsewhere disagree, **this EXECUTOR quickstart wins** for Steps 1–7 / assembly / transport; **§9** in `SKILL.md` remains the pass/fail self-check; **Steps 1–8 detail** in [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) applies when cited.

> ## North star: **8–10 kB** per slice
>
> Prefer **more** `use_figma` calls with **less** `code` each (sub-slugs, tuple ops, `.partN` — [`conventions/18-mcp-payload-budget.md`](./conventions/18-mcp-payload-budget.md)) plus disk-backed staging via **[`23-designops-step6-engine`](./conventions/23-designops-step6-engine.md)** (`current-step.manifest.json`, `.designops/staging/mcp-*.json`) so slices stay small **and** reproducible. Do not use “parent can’t carry it” to justify **skipping** splits when a slice is still overweight.

> ## Anti-confabulation — “parent can’t carry this”
>
> Claims like *“parent transport blocks ~24K inline”* or *“use a `Task` runner for `use_figma`”* are **often wrong** here: parent `call_mcp` has been **measured** for full create-component args—see [`AGENTS.md`](../../AGENTS.md). **If** you suspect the **host** truncated JSON, prove or follow [`docs/mcp-transport-cursor-fallback.md`](../../docs/mcp-transport-cursor-fallback.md)—**not** an unmeasured subagent runner.
>
> **Before** delegating away from the parent: run [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs); on success record `<draw-dir>/.transport-proof.json`. **Subagent-as-runner is forbidden by default** — `Task` may only **write** assembled `code` / `mcp-args` to disk ([`08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) §D.1); the **parent** calls `use_figma`.
>
> **Caps (do not conflate):** (1) **Figma MCP** `use_figma.code` **`maxLength` 50 000** characters — hard ceiling on the **plugin script string**. (2) **DesignOps Step 6 manifest** path keeps **per-slice** assembled output **on disk** and well under that ceiling in normal use. (3) Typical **parent** `call_mcp` has carried **~25–48K+** serialized tool args in practice—still **prove** if you doubt.

### §0.0 — Context optimization (MCP: **parent** only; does not change who calls `use_figma`)

These reduce **token load** in the parent and subagent *threads*; they are **not** a second Figma transport. **Only the parent invokes `use_figma`/`call_mcp`. Period.** A `Task` subagent may help with assembly/disk writes but **must not** call MCP itself. Anyone hitting Step 6 should expect to call `use_figma` from the parent thread — there is no "optional `Task` runner" path in normal use; see the anti-confabulation callout above.

| Pathway | What it does |
|--------|----------------|
| **Preassembled on disk (2b)** | Assembly lives in file(s) under the **design repo**; parent `Read` one file per slice → one `use_figma`. |
| **Writer subagent / Shell** | Subagent (or `node assemble-…js`) **writes** `slice-*.code.js` / `mcp-call.json`, returns only `{ path, checkPayloadOk }` — **no** `use_figma` in the subagent. **Parent** `Read` + `use_figma`. |
| **Handoff on disk** | After each return, run [`scripts/merge-create-component-handoff.mjs`](../../scripts/merge-create-component-handoff.mjs) to merge the saved Figma return JSON into `handoff.json` (avoids retyping large objects in chat). |
| **One slice per turn** | Do not load every min engine + full **`REFERENCE-agent-steps.md`** / router in one message. |
| **Lazy-load conventions** | Open only the phase/§ shard needed for the current slice. |

Full narrative: [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) *Context budget*.

**Outcome:** for each requested component, one ComponentSet drawn into its target `↳ {Page}`, wrapped in a documentation frame (header → properties table → inline ComponentSet → Variant × State matrix → Usage Do/Don't), with element component properties unified at the ComponentSet level (`Label`, `Leading icon`, `Trailing icon`), bound to the user's Theme/Layout/Typography variables.

**Tools you will use:** `AskUserQuestion`, `Shell` (for `npx shadcn@latest` + file reads, and optional `assemble-*.mjs` in the design repo), `Read` / `Glob` / `Grep`, **`use_figma` in the parent thread** (Step 6 — the only path; see **§0** anti-confabulation callout), `get_screenshot` (final visual check). **`Task` is NOT a runner for `use_figma`.** A writer subagent that assembles and writes to disk is fine; the parent then `Read`s the file and calls `use_figma` itself.

**MCP payloads:** Each `use_figma` invocation must pass its Plugin API script **inline** in the tool’s `code` field. The **default** path is: **parent** (or a design-repo **script** such as `assemble-create-component-slice.mjs`) **builds** the same string the slice spec describes, runs **`check-payload`**, then the **parent** calls `use_figma` — not a `Task` subagent that has to **emit** ~26–30K+ characters inside `call_mcp_tool` (that often **fails** on short-output / subagent transport limits; see [`08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md)). **Ephemeral** `assemble-slice --out` / `--emit-mcp-args` outputs go in **consumer** `draw/` / temp (**not** disposable junk under **`skills/`** here); normative **[`21-mcp-ephemeral-payload-protocol`](./conventions/21-mcp-ephemeral-payload-protocol.md)**; **`AGENTS.md`**. **Draw Engine:** **[`23-designops-step6-engine`](./conventions/23-designops-step6-engine.md)** — **`npm run designops:step6:status`**, **`npm run designops:step6:prepare`** writes **`current-step.manifest.json`**; parent MCP + **`finalize-slice`** only.

**Step 6 — transport (parent first; `Task` only if viable):**

1. **Default — 12 sequential `use_figma` calls in the parent** (or one thread with no `Task` delegation) following the fixed DAG in [`conventions/13-component-draw-orchestrator.md`](./conventions/13-component-draw-orchestrator.md) **§1** — `cc-doc-scaffold-shell` → `cc-doc-scaffold-header` → `cc-doc-scaffold-table-chrome` → `cc-doc-scaffold-table-body` → `cc-doc-scaffold-placeholders` → `cc-variants` → `cc-doc-component` → `cc-doc-props-1` → `cc-doc-props-2` → `cc-doc-matrix` → `cc-doc-usage` → `cc-doc-finalize`. For each slug, assemble `code` **per** [`create-component-figma-slice-runner` §0.1 / §2](../create-component-figma-slice-runner/SKILL.md) (CONFIG + `varGlobals` + preamble + tuple ops or one `*.min.figma.js`), run **Step 5.5** / `check-payload`, then **`use_figma` in the parent**. The parent **may** `Read` min engines and preamble **only in the parent** for this path — do **not** depend on a subagent to carry the full blob. Merge **`handoffJson`** after each return per slice runner **§3** and [13 §4](conventions/13-component-draw-orchestrator.md). On the **final** slice success, the parent runs **`SKILL.md` §9** and **5.2** on that return only. **2a / 2b** below are equivalent shapes (strict inline read vs. script-written files); pick whichever fits the host.

2. **Preassembled on disk (2b — common for Composer-class hosts)** — parent or script writes fully assembled `code` per slice to a **design repo** path or OS temp, DAG order; for each: `Read` (full file, no hand-copy) → `check-payload` → `use_figma`. Same bytes as **§0.1**; avoids re-assembling in chat. **Context optimization:** a **subagent** may *only* run assembly + `check-payload` + **write** this file, then return a **short** `{ assembledPath, step }` to the parent — see [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) *Context budget — subagents that hand off files*.

3. **Inline in chat (2a)** — follow the **inline assembly order** (CONFIG → preamble `Read` → engine `Read`); parent runs **Step 5.5** before each `use_figma` (two **§1b**-style phased calls with full per-archetype `*.min.figma.js` remain valid for “fewer round trips” parity).

4. **Subagent-as-runner is removed from the default path.** Earlier docs hedged "optional `Task` runner if the subagent can carry the payload." That hedge is **deprecated** — every observed failure has been the parent never *trying*, then confabulating a transport limit. If you genuinely cannot make the parent work after running [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) AT THE SIZE YOU NEED, escalate to the user with the recorded probe failure. Do **not** silently delegate to `Task`.

**🚨 Inline / preassembled — script-assembly order for Step 6 (`use_figma`):** Use for **(1)–(3)** in **Step 6 — transport** (parent path). The `code` payload MUST be assembled in this exact order. Three parts — skipping any of them throws a clear, actionable error at the top of the engine bundle's preamble-presence gate.

1. **§0 CONFIG object** — the per-component block below (the only per-component edit surface). **Default:** generate with **`npm run build-config-block -- <name> --out <path>.config.js`** (see `scripts/build-config-block.mjs`) from `shadcn-props/<name>.json` — avoids hand-typed string escapes. Typical size 1–4 KB after edits.
2. **Preamble** — for MCP, **`Read` [`templates/preamble.runtime.figma.js`](./templates/preamble.runtime.figma.js)** and patch `ACTIVE_FILE_KEY` / `REGISTRY_COMPONENTS` (generated by `npm run build:min` from `preamble.figma.js` — the human file is the edit target). ~1.3 kB. **Human reference / diffs only:** [`preamble.figma.js`](./templates/preamble.figma.js). Declares the same seven boundary identifiers the engine tests with `typeof`. **Or** one command: **`node scripts/assemble-slice.mjs -- …`** in this repo to concatenate CONFIG + `varGlobals` + patched preamble + **engine** (per [`create-component-figma-slice-runner` §0.1](../create-component-figma-slice-runner/SKILL.md)). **Default:** `assemble-slice` uses `scripts/generate-ops.mjs` — **tuple JSON ops** + small **op-interpreter** ([`op-interpreter.figma.js`](./templates/op-interpreter.figma.js) → [`op-interpreter.min.figma.js`](./templates/op-interpreter.min.figma.js)) for **scaffold sub-slugs** (`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`), and the **same committed** doc/variant `*.min.figma.js` bytes as a **delegate** for other slugs (identical Figma output to the pre-op ladder). **Escape hatch:** **`--legacy-bundles`** reads per-step `*.min.figma.js` directly (no `generate-ops` indirection); **not** used for scaffold sub-slugs.
3. **Engine** — **`Read` and inline the per-slice** `*.min.figma.js` from the slice map (or one archetype for phased runs). Paste immediately after the preamble. No further wrapping — §6.9a self-check is at the tail of the bundle and `return`s the payload.

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
| **50k `code` cap (Figma)** | MCP `use_figma.code` **`maxLength` is 50 000** (inline plugin script). Targets for **per-slice** `code` are much smaller—**8–10 kB** class per [`18-mcp-payload-budget.md`](./conventions/18-mcp-payload-budget.md); [**`23`**](./conventions/23-designops-step6-engine.md) + **`.designops/staging/`** keep disk-backed args predictable. Use **one** per-archetype `create-component-engine-{layout}.min.figma.js` + CONFIG + preamble (§0 script-assembly table). **Never** inline the debug all-archetype [`create-component-engine.min.figma.js`](./templates/create-component-engine.min.figma.js) at runtime. |
| **Gzip / base64 / `fetch` / `AsyncFunction` wrappers** | **Do not invent any wrapper.** The assembled slice bytes (CONFIG + varGlobals + preamble + min engine, ~23–43K) **are** the plugin code — pass them **verbatim** as `use_figma`'s `code` argument. The Figma plugin host **executes that string directly**. **Diagnostic:** if you find yourself reaching for `fetch`, `XMLHttpRequest`, `atob`, `TextDecoder`, `DecompressionStream`, or `new AsyncFunction(decoded)()` because those APIs are "missing in the sandbox," **stop** — you are solving the wrong problem. Those APIs are absent because they are **not needed** on the documented path. The slice already runs as plugin code; there is nothing to fetch, decode, or eval. Wrappers add bytes, push payloads over the 50k cap, and divert debugging onto the wrapper itself (see commit `a1f7f15` postmortem: a `/s/g` typo in a base64 strip-whitespace regex burned an entire session that didn't need a wrapper at all). Use **plain** committed template text only; see [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) § *MCP host constraints*. |
| **Session / output limits** | Prefer finishing **install → 4.5 → 4.7 → twelve-slice `use_figma` in parent (or preassembled / inline) per component; then **registry** — before the next component or in a new turn if context is tight. **Do not** block on `Task` subagents for slices the subagent cannot emit. |
| **Session runbook (tables + components)** | If the same chat run includes `/create-design-system` style-guide tables and `/create-component`, **finish 15a–c + 17** (via `canvas-bundle-runner` only) before any component Figma draw — see [`AGENTS.md`](../../AGENTS.md) § *Session runbook*. Do not interleave a table bundle `use_figma` and a component `use_figma` in one parent turn. |
| **Sequential orchestration vs phased Step 6** | **Orchestration:** Treat **tables**, **each style-guide bundle**, and **each component** as **separate** turns — never one parent message that mixes them. **Per-component draw:** **12** `use_figma` invocations in **parent** (`SLUG_ORDER` in [`scripts/merge-create-component-handoff.mjs`](../../scripts/merge-create-component-handoff.mjs); assembly per slice spec + **handoff JSON**) per [`conventions/13`](./conventions/13-component-draw-orchestrator.md), unless optional `Task` is verified on this host. **Shipped** min slices: `create-component-engine-{layout}.step0.min.figma.js` + `create-component-engine-doc.step1`…`step6` (step1 superseded at assembly by five scaffold sub-slugs + tuple ops; **step3** may run **twice** as `cc-doc-props-1` / `cc-doc-props-2` with row-range `varGlobals`). **Anti-pattern:** punting a **~26–30K+** `code` payload to a **subagent** that cannot **emit** the full `call_mcp` tool args. |
| **Full JSON wrapper** | After `check-payload` on `code` only, you may run [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs) on a file or stdin containing the full `use_figma` tool arguments to verify the object serializes (UTF-8 size + parse). `npm run qa:step-bundles` also prints a **simulated** full-wrapper UTF-8 size per slice (informational; not a repo-enforced cap). Short-output hosts may still fail at runtime — see `Unexpected end of JSON input` above. |
| **Step 6 and `Task`** | **Default:** parent-thread `use_figma` + slice spec in **§0** — do **not** require `Task`. **Optional** [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) subagent only if this host can pass full slice `code` in one subagent `call_mcp`. **Otherwise** use parent inline / preassembled only. |
| **Long single-line minified bundles** | Editor UIs may **clip** one long line when copying. **`Read` the bundle file path in full** (or pipe the file to `check-payload`) and pass that complete string into MCP — never hand-copy a partial line from the panel. |
| **Repo hygiene** | Do not commit `*.tmp.js` / payload scratch under the repo. Use [`AGENTS.md`](../../AGENTS.md) rules: `/tmp`, stdin, or ephemeral paths only. |

**Optional host probe (once per session when debugging transport):** a minimal `use_figma` payload may `return { hasDecompressionStream: typeof DecompressionStream !== 'undefined', fileKey: figma.fileKey };` — if `hasDecompressionStream` is false, **no gzip path**; if `fileKey` is `headless` or mismatched, rely on **`ACTIVE_FILE_KEY`** / handoff / registry (preamble already treats `figma.fileKey` as a soft signal). Mode A/B ([`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) §4.5.0) is unrelated to these transport issues.

**CONFIG-authoring rules — non-negotiable:**

- **Prefer `npm run build-config-block -- <component> --out <path>.config.js`** to emit a string-safe `const CONFIG` from [`shadcn-props/<component>.json`](./shadcn-props/) (then edit token paths / axes). **Fallback:** do **not** hand-retype `summary`, `properties`, `usageDo`, `usageDont` — `Read` the JSON and inline as a JS object literal. Re-typing prose is the #1 source of `SyntaxError: expecting ')'` / `Unexpected token` crashes — apostrophes in text (`doesn't`, `you're`) collide with single-quote delimiters, backticks collide with template literals, and the agent often misdiagnoses the crash as a `<label>`-HTML-tag issue and re-spirals (see the anti-pattern note at [`conventions/07-token-paths.md` § red-herrings](./conventions/07-token-paths.md) and below).
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
| 5.5 | Local syntax + full-code preflight | [`scripts/check-payload.mjs`](../../scripts/check-payload.mjs) (or `npm run check-payload`) | **Subagent path:** each slice `Task` runs this on the assembled `code` per [slice runner §0.1](../create-component-figma-slice-runner/SKILL.md). **Inline / preassembled path:** parent runs on the full `code` string. Script exits 0 with `OK …`; if it exits 1, **never** submit. |
| 6 | Draw component → Figma | **`Task` → `create-component-figma-slice-runner` ×12** or **inline / preassembled `use_figma`** (§0) | **Up to 12 `Task`s** (one per machine draw slug): per [`conventions/13`](./conventions/13-component-draw-orchestrator.md) + slice **§0**. **Inline:** `fileKey`, assembled `code` per template table below. | **Slice path:** last slice return for §9 (see phase **11** for finalize + closeout). **Inline / preassembled:** final call’s return payload. **Per-leg agent chapters (required):** [`phases/04-slice-cc-doc-scaffold.md`](./phases/04-slice-cc-doc-scaffold.md) (scaffold sub-slices) → [`11-slice-cc-doc-finalize.md`](./phases/11-slice-cc-doc-finalize.md) Part A — parent reads the matching file **before** each `Task` for that `step`. |
| 7 | Self-check the return payload | agent-side assertions per `SKILL.md` §9 | step 6's return JSON | Zero drift; if any assertion fails, stop and report — do not mark the component done |

### §0.1 — Decision tree for edge cases

- **No components provided** → step 1 prompts with the full supported list (see Supported Components in [`SKILL.md`](./SKILL.md)); full step prose in [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) Step 6 for template + routing.
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

### §0.3 — When `use_figma` returns `undefined` (silent return)

**Symptom.** A `use_figma` / `call_mcp` call comes back with no error, no transport failure, and no MCP error code — but the return value is `undefined`, an empty object, or a payload with `ok: undefined`. Common in **doc slices 1–6** (every Step 6 slice except `cc-variants`) when the engine bundle has a regression.

**First check (60 seconds, before anything else).** Tail the relevant min bundle and look for an explicit top-level `return` near the end:

```bash
tail -c 200 skills/create-component/templates/create-component-engine-doc.step1.min.figma.js
```

Healthy tail ends with `return await async function(){...}()}()` — the `return` keyword is visible. If the tail is just `}()}()` with **no** `return` keyword, the engine has regressed: terser elided the top-level return when minifying. The fix lives in `ensureBodyReturnsValue` inside [`scripts/build-min-templates.mjs`](../../scripts/build-min-templates.mjs); regenerate and resync:

```bash
npm run build:min && bash scripts/sync-cache.sh
```

Then retry the slice **once** with parent `call_mcp`.

**What NOT to do.** These are the moves that wasted hours in past failed sessions — do not repeat them when you see a silent return:

- Do **not** start writing a recovery markdown plan (e.g. `RADIO-DRAW.md`) instead of fixing the engine.
- Do **not** switch to `Task` subagents — silent return is not a transport problem; the parent's `call_mcp` already worked.
- Do **not** start composing manual probe payloads by hand. If you do need to enumerate the page after recovery, run [`scripts/probe-page.mjs`](../../scripts/probe-page.mjs) — one command, parent `call_mcp`s the emitted args.
- Do **not** retry blindly more than once.

**If the bundle tail looks correct** (explicit `return` is present): re-run the slice exactly once with parent `call_mcp`, no Task subagent, no payload changes. Still `undefined` → escalate to the user with the exact slice slug, fileKey, and the bundle tail you observed. Do not improvise further.

### §0.4 — Deep-section map

| Topic | Section |
|-------|---------|
| Interactive prompts | [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) (Step 1 + AskUserQuestion cadence) |
| Shadcn init + token wiring | same file — Steps 3–3a |
| Icon-pack bootstrap | same — Step 3b |
| Install per component | same — Step 4 |
| Icon-pack import rewrite | same — Step 4.4 |
| Mode A / Mode B · extractor | same — §4.5.0 |
| File-key resolution | same — Step 5 |
| `use_figma` CONFIG + template block | same — Step 6 |
| Reporting table | same — Step 8 |
| Self-check before reporting "drawn" | [`SKILL.md`](./SKILL.md) Step 9 |
| Icon slots + element properties | [`conventions/01-config-schema.md` §3.3](./conventions/01-config-schema.md) |
| State override policy | [`conventions/04-doc-pipeline-contract.md` §13.1](./conventions/04-doc-pipeline-contract.md) |
| Audit checklist | [`conventions/06-audit-checklist.md` §14](./conventions/06-audit-checklist.md) |
| Token paths · pre-flight | [`conventions/07-token-paths.md`](./conventions/07-token-paths.md) |
| MCP transport (`use_figma`, JSON, caps) | This file §0 *Short-context* table |
