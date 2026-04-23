---
name: create-component-figma-runner
description: Default /create-component Step 6 when Task exists — Prepend parent-authored configBlock (verbatim const CONFIG), read preamble + per-archetype engine from layout, patch registry, run check-payload, call use_figma (default two-phase §1b, optional six-step §1d via sixStepDraw, or single when twoPhaseDraw is false), return compact JSON. Parent must use Task (isolated context) so large engine strings stay out of the parent thread. Parent owns Steps 1–5, 4.7, §9 review, Step 5.2 registry; subagent owns assembly + preflight + use_figma.
argument-hint: "fileKey=…, layout=…, createComponentRoot=…, configBlock=… (verbatim const CONFIG = {…};), registry path or activeFileKey + registryJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-runner`

You are a **single-purpose subagent** and the **default** executor for [`/create-component`](../create-component/SKILL.md) **Step 6** whenever the parent host exposes **`Task`**. Your job is to assemble the `use_figma` **code** string (**`configBlock`** — parent-authored `const CONFIG = { … };` — then [`preamble.figma.js`](../create-component/templates/preamble.figma.js) + one [`create-component-engine-{layout}.min.figma.js`](../create-component/templates/) **or** the **`*.stepN.min.figma.js` ladder** per **§1d**), run **`check-payload`** (and optional full wrapper check), and call **`use_figma`**. **Default:** **twice** (§1b: phase 1 → ComponentSet; phase 2 → full doc). **`sixStepDraw: true`:** **six** calls — per-layout **`*.step0`** then shared **`create-component-engine-doc.step1`…`step5`** (see **§1d**). **`twoPhaseDraw: false`:** **one** call (legacy). Return a **compact** JSON result to the parent. You run in an **isolated** context so large `code` strings do not land in the parent thread.

**Parent threads** must **not** paste the minified engine into their own `use_figma` for that component when **`Task` is available** — they hand off structured inputs per **§0** instead. Full orchestration, **`SKILL.md` §9** assertions, and registry write-back stay in the parent; assembly + Figma call happen here. Same delegation pattern as [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md); see [`AGENTS.md`](../../AGENTS.md) § *Session runbook*.

---

## §0 — Inputs (from parent Task prompt)

The parent must supply **all** of the following in its `Task` prompt in a **parseable** form (JSON block or key=value lines).

| Field | Required | Description |
|--------|----------|-------------|
| `fileKey` | yes | Figma file key for `use_figma` |
| `layout` | yes | Archetype string that **must match** `CONFIG.layout` inside `configBlock` (`chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `__composes__`) — used only to pick which `create-component-engine-*.min.figma.js` to `Read` (the subagent does not `eval` `configBlock` to discover it). |
| `configBlock` | yes | **Verbatim JavaScript** for Step 6’s first segment: the full `const CONFIG = { … };` statement the parent would paste ahead of the preamble on the **inline** path — **byte-for-byte the same** as [`create-component/SKILL.md`](../create-component/SKILL.md) / [`EXECUTOR.md`](../create-component/EXECUTOR.md) after Mode A / B. Must include function-valued keys the engine needs (`applyStateOverride`, and `label` when it is a function). **`JSON.stringify(CONFIG)` is wrong here** — it **drops** functions and breaks matrix state behavior. Put `configBlock` in the Task prompt inside a Markdown fenced code block labeled `js`, or as another clearly delimited multiline string. |
| `createComponentRoot` | yes | Path to the folder that contains `templates/preamble.figma.js` (e.g. repo `skills/create-component/`) so you can `Read` the preamble and the correct `create-component-engine-{layout}.min.figma.js` |
| `registry` | one of (a) or (b) | **(a)** Path to a `.designops-registry.json` at the **design project** repo root — `Read` it to fill `ACTIVE_FILE_KEY` and `REGISTRY_COMPONENTS` for the preamble, **or (b)** `activeFileKey` (string or null) + `registryComponentsJson` (stringified JSON object) inlined in the prompt if the file is not available |
| `twoPhaseDraw` | no | **`true`** or **omitted** — run **two** `use_figma` calls (default): phase 1 builds the ComponentSet and returns early; phase 2 draws `_PageContent`, the doc frame, matrix, and usage (same min bundle both times; inject globals per **§1b**). **`false`** — legacy **one** `use_figma` with the full script in a single run. Ignored when **`sixStepDraw: true`**. |
| `sixStepDraw` | no | **`true`** — use **§1d**: `create-component-engine-{layout}.step0.min.figma.js` then **`create-component-engine-doc.step1`…`step5.min.figma.js`** (shared) with handoff globals between calls. **`false`** or **omitted** — use **§1b** / **`twoPhaseDraw`** as above. |

**Optional:** `description` (string) for `use_figma`; `projectRootForShell` if `npm run check-payload` must be run with `cwd` (defaults to the workspace folder that contains `package.json` with `check-payload` — usually the DesignOps plugin root).

**Legacy / avoid:** Older docs said `configJson` + `JSON.parse` in the subagent. That only works if `CONFIG` has **no** function-valued properties — not true for most real draws (`applyStateOverride`). Parents must pass **`configBlock`**, not a JSON-only transport, unless they are prototyping a tiny archetype with `applyStateOverride: () => {}` and no other functions in `CONFIG`.

---

## §1 — Assembly (exact order, same as EXECUTOR)

1. **Normalize `configBlock`** for assembly only (do not rewrite the object body):
   - Trim outer whitespace.
   - If the parent wrapped the block in a **Markdown fence**, remove the **first** line when it matches `/^```[a-zA-Z0-9_-]*$/` and the **last** line when it is **only** a closing triple-backtick fence — the final `code` string must not contain those lines (they are not valid JavaScript).
   - **Sanity-check `layout`:** the prompt’s **`layout`** value must appear in `configBlock` as a `layout` property (e.g. `layout: 'control'` or `layout: "control"`). If it cannot be found, **stop** and return `ok: false` with a clear mismatch error — do not `Read` the wrong engine file silently.
   - The result must define **`const CONFIG`** in scope — same as inline Step 6. Optionally assert the normalized block starts with `const CONFIG`. **Do not** reformat, minify, or `JSON.parse` the object literal.

2. **`Read`** [`../create-component/templates/preamble.figma.js`](../create-component/templates/preamble.figma.js) **via** `createComponentRoot` — path `join`: `{createComponentRoot}/templates/preamble.figma.js` **verbatim** text.

3. **Replace** in the preamble string **only** the two literals allowed by the preamble (see file header):
   - `const ACTIVE_FILE_KEY = null;` → `const ACTIVE_FILE_KEY = <JSON of string | null>;`
   - `const REGISTRY_COMPONENTS = {};` → `const REGISTRY_COMPONENTS = <JSON of object>;`  
   **Values** must come from the registry `Read` (field names per existing [`create-component` flow](../create-component/SKILL.md) Step 5.1) or from `activeFileKey` + `registryComponentsJson`.

4. **`Read`** the engine under `templates/`. Map the prompt’s **`layout`** field to the basename (must match [`EXECUTOR.md`](../create-component/EXECUTOR.md) and `configBlock.layout`):

| `layout` (prompt field) | `templates/` file (single-call / §1b phase 2) |
|-------------------------|-------------------|
| `chip` | `create-component-engine-chip.min.figma.js` |
| `surface-stack` | `create-component-engine-surface-stack.min.figma.js` |
| `field` | `create-component-engine-field.min.figma.js` |
| `row-item` | `create-component-engine-row-item.min.figma.js` |
| `tiny` | `create-component-engine-tiny.min.figma.js` |
| `control` | `create-component-engine-control.min.figma.js` |
| `container` | `create-component-engine-container.min.figma.js` |
| `__composes__` | `create-component-engine-composed.min.figma.js` |

When **`sixStepDraw: true`**, **`Read`** `create-component-engine-{layout}.step0.min.figma.js` then `create-component-engine-doc.step1.min.figma.js` … `create-component-engine-doc.step5.min.figma.js` — see **§1d**.

5. **Concatenate** in order: **`configBlock`** (from step 1) + newline + **phase / handoff globals** (see **§1b** or **§1d**) + preamble (replaced) + minified engine string. **No** other text before/after. This is the `code` string for `use_figma`. When **`twoPhaseDraw: false`**, omit phase globals entirely. When **`sixStepDraw: true`**, follow **§1d** per call (step 0 uses §1b phase-1 globals only; steps 1–5 use phase-2 + handoff ids).

6. **Preflight** — in order:
   - Pipe the concatenated `code` to `node {pluginRoot}/scripts/check-payload.mjs` (stdin) **or** write **only** to a temp path **outside the repo** (e.g. OS temp) and pass the path — **do not** commit `*.mcp-*` or `*-payload.json` under the repo (see [`AGENTS.md`](../../AGENTS.md)).
   - If the plugin has [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs), build the object `{ "fileKey": "...", "code": "<full string>", "description": "...", "skillNames": "figma-use,create-component" }` and pipe it to that script, or use the host’s `call_mcp_tool` only after both gates pass.

7. **Call `use_figma`** with `fileKey`, `code` (full assembled string), `description`, and `skillNames: "figma-use,create-component-figma-runner"`. **Unless `twoPhaseDraw: false`:** after phase 1 returns, assemble phase 2 `code` (step 5 with **§1b** phase-2 globals + same preamble + same engine), re-run step 6, then call `use_figma` again.

8. **Return** to the parent a **compact** JSON object (last message of the Task):

```json
{
  "ok": true,
  "component": "button",
  "compSetName": "…",
  "compSetId": "…",
  "fileKey": "…"
}
```

On failure:

```json
{
  "ok": false,
  "errors": ["first line of error or check-payload / MCP text"]
}
```

Pass through any useful keys from the `use_figma` return in `raw` if needed for parent `§9` checks.

When two-phase mode is active (**default**), the **final** return must match the shape above using the **phase 2** `use_figma` result (full `returnPayload`). You may include `phase1` (the phase 1 object) under `raw` for debugging. **`§9` in the parent** applies only to that phase-2 payload (`unresolvedTokenPaths`, `registryEntry`, etc.).

---

## §1b — Two-phase globals (default; skip entirely when `twoPhaseDraw: false`)

Insert **after** normalized `configBlock` and **before** the preamble, as **valid JavaScript** lines (not inside the CONFIG object).

**Phase 1** — force early return after the ComponentSet exists:

```js
var __CREATE_COMPONENT_PHASE__ = 1;
```

**Phase 2** — skip page clear and variant build; reload the ComponentSet and merge token-miss telemetry from phase 1:

```js
var __CREATE_COMPONENT_PHASE__ = 2;
var __PHASE_1_COMP_SET_ID__ = "<compSetId from phase 1>";
var __CC_PHASE1_PROPS_ADDED__ = <JSON.parse-compatible literal of propsAdded>;
var __CC_PHASE1_UNRESOLVED__ = <JSON.parse-compatible literal of unresolvedTokenMisses array>;
```

Build these literals with `JSON.stringify` in the subagent so quoting is safe. If phase 1 returned an empty `unresolvedTokenMisses`, use `[]`.

Parse phase 1’s tool return to obtain `compSetId`, `propsAdded`, and `unresolvedTokenMisses`. If the MCP wraps the payload, unwrap to the object the engine `return`ed.

---

## §1c — Target: multi-call doc ladder (small payload per `use_figma`)

**Goal:** Avoid shipping one **large** script per call. The **intended** runner flow (once `build-min-templates.mjs` emits step bundles) is **one MCP call per slice**, for example:

| Call | Slice (example names) | Payload focus |
|------|------------------------|---------------|
| **0** | Variant plane | Clear page, archetype builders, `combineAsVariants`, early return with `compSetId` / `propsAdded` / misses |
| **1** (shipped) | Page + header + properties table | `_PageContent`, `docRoot`, title/summary, full `buildPropertiesTable` — matches `draw-engine` §6.3–6.6 (header + table are one call, not two) |
| **2** | Component section | Reparent live ComponentSet into doc (`§6.6B`) |
| **3** | Variants × States | Matrix + `applyStateOverride` (`§6.7`) |
| **4** | Usage | Do / Don’t cards (`§6.8`) |
| **5** | Finalize | §6.9 checks + full `returnPayload` (no new frames) |

**Dependency:** Matrix (**3**) needs the ComponentSet from **0** and reparenting from **2** — see the DAG in [`conventions/09-mcp-multi-step-doc-pipeline.md`](../create-component/conventions/09-mcp-multi-step-doc-pipeline.md).

**Handoff:** Each call `return`s compact ids; the runner injects them into the next assembly — see **§1d**.

**Layout:** Multi-step runs must **not** ship empty table bodies or skip placeholder rows — that collapses auto-layout and breaks the 1640px doc contract. Follow [`conventions/09-mcp-multi-step-doc-pipeline.md`](../create-component/conventions/09-mcp-multi-step-doc-pipeline.md) §1.1 and [`04-doc-pipeline-contract.md`](../create-component/conventions/04-doc-pipeline-contract.md) §2.2.

**Bridge:** **§1b** two-phase (same full engine twice) and **`twoPhaseDraw: false`** remain supported for debugging and hosts that cannot sequence six calls. Prefer **§1d** when you need the smallest **first** MCP payload (`*.step0` ≈ 14–20 KB vs ~32 KB full).

---

## §1d — Six-call ladder (committed `*.stepN.min.figma.js`)

`npm run build:min` emits **step 0 per layout** and **one shared doc bundle per doc step**:

| Call | `Read` under `{createComponentRoot}/templates/` | Phase / globals (after `configBlock` + patched preamble) |
|------|--------------------------------------------------|-----------------------------------------------------------|
| **0** | `create-component-engine-{layout}.step0.min.figma.js` | `var __CREATE_COMPONENT_PHASE__ = 1;` (optional — bundle also returns when `_ccPhase === 0`); `return` includes `compSetId`, `propsAdded`, `unresolvedTokenMisses`. |
| **1** | `create-component-engine-doc.step1.min.figma.js` | **Layout-agnostic** slim phase-2 slice (smallest doc file — typically **~17 KB** committed; esbuild + terser unused strip) — no `buildVariant`, no archetype builders, no variant-build `else`. Baked `__CREATE_COMPONENT_PHASE__ = 2` **plus** inject §1b phase-2 literals: `__PHASE_1_COMP_SET_ID__`, `__CC_PHASE1_PROPS_ADDED__`, `__CC_PHASE1_UNRESOLVED__`. Handoff return: `pageContentId`, `docRootId`, `compSetId`, … |
| **2** | `create-component-engine-doc.step2.min.figma.js` | Same phase-2 literals **and** `__CC_HANDOFF_PAGE_CONTENT_ID__`, `__CC_HANDOFF_DOC_ROOT_ID__` (and `__PHASE_1_COMP_SET_ID__` or `__CC_HANDOFF_COMP_SET_ID__`). |
| **3** | `create-component-engine-doc.step3.min.figma.js` | Refresh handoff ids from step **2**’s return. |
| **4** | `create-component-engine-doc.step4.min.figma.js` | Refresh handoff ids from step **3**’s return. |
| **5** | `create-component-engine-doc.step5.min.figma.js` | Refresh handoff ids from step **4**’s return; final payload matches §9 / phase-2 shape. |

**Note:** `doc.step1`…`doc.step5` share the **same slim source shape** (no chip `buildVariant`, no archetype builders, no variant-build `else`); each file bakes a different `__ccDocStep` constant. After esbuild minify, **terser** removes functions only used from dead branches, so **step 1** is smaller than **steps 2–4**, and **step 5** (finalize + §9 payload) is the largest — see `npm run qa:step-bundles` for exact committed byte sizes.

**Optional parent field:** `sixStepDraw: true` — subagent uses **§1d** instead of default **§1b** (two calls). Omit or `false` keeps **§1b** default.

---

## §2 — Hard prohibitions

- **Do not** call `use_figma` with **`code: PLACEHOLDER`** (or any other stub token). Some hosts **structure the tool call before the payload is pasted**, which produces `ReferenceError: PLACEHOLDER is not defined` inside Figma. **`check-payload` now rejects** those stubs — only call `use_figma` **after** the full string is concatenated and stdin-check passes.
- **Do not** `Read` the entire [`create-component/SKILL.md`](../create-component/SKILL.md) just to get CONFIG — the parent must supply **`configBlock`** (finalized in the parent after Steps 1–5 / 4.7).
- **Do not** invent token paths, `applyStateOverride`, or variant keys in the subagent — those are authored only in the parent (Mode A extractor + resolver or Mode B synthetic), then copied into **`configBlock`**.
- **Do not** invent or re-type prose fields — parent must have copied from `shadcn-props` per [`EXECUTOR.md`](../create-component/EXECUTOR.md).
- **Do not** minify, trim, or “fix” the engine or preamble — `Read` **verbatim** only.
- **Do not** create scratch payload files **under the repo** for MCP staging; temp outside repo or stdin only.
- **Do not** use this skill for **canvas** style-guide bundles — those use [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) only.

---

## §3 — MCP server identifier

Read once `mcps/**/SERVER_METADATA.json` in the workspace → `serverIdentifier` (commonly `plugin-figma-figma` in Cursor). The bare name `figma` may not resolve.

---

## §4 — Cross-references

| Topic | Where |
|--------|--------|
| Full skill contract, `§9` return assertions | [`create-component/SKILL.md`](../create-component/SKILL.md) |
| Assembly order, 50k cap, Composer | [`create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) |
| Session phases (tables → components) | [`AGENTS.md`](../../AGENTS.md) |
| Figma `use_figma` workflow | [`create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| check-payload | [`scripts/check-payload.mjs`](../../scripts/check-payload.mjs) |
| Full tool-args JSON | [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs) |
| Multi-step MCP ladder (target) | [`conventions/09-mcp-multi-step-doc-pipeline.md`](../create-component/conventions/09-mcp-multi-step-doc-pipeline.md) |
