---
name: create-component-figma-runner
description: Default /create-component Step 6 when Task exists — Prepend parent-authored configBlock (verbatim const CONFIG), read preamble + per-archetype engine from layout, patch registry, run check-payload, call use_figma twice by default (phased variant build then doc pipeline) or once when twoPhaseDraw is false, return compact JSON. Parent must use Task (isolated context) so ~40K-char engine never lands in the parent thread. Parent owns Steps 1–5, 4.7, §9 review, Step 5.2 registry; subagent owns assembly + preflight + use_figma.
argument-hint: "fileKey=…, layout=…, createComponentRoot=…, configBlock=… (verbatim const CONFIG = {…};), registry path or activeFileKey + registryJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-runner`

You are a **single-purpose subagent** and the **default** executor for [`/create-component`](../create-component/SKILL.md) **Step 6** whenever the parent host exposes **`Task`**. Your job is to assemble the `use_figma` **code** string (**`configBlock`** — parent-authored `const CONFIG = { … };` — then [`preamble.figma.js`](../create-component/templates/preamble.figma.js) + one [`create-component-engine-{layout}.min.figma.js`](../create-component/templates/)), run **`check-payload`** (and optional full wrapper check), and call **`use_figma`** **twice by default** (phase 1 → ComponentSet; phase 2 → doc frame, matrix, usage — see **§1b**). If the parent sets **`twoPhaseDraw: false`**, use **one** `use_figma` (legacy single script). Return a **compact** JSON result to the parent. You run in an **isolated** context so the parent thread never emits the full ~40K-character `code` in its own message.

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
| `twoPhaseDraw` | no | **`true`** or **omitted** — run **two** `use_figma` calls (default): phase 1 builds the ComponentSet and returns early; phase 2 draws `_PageContent`, the doc frame, matrix, and usage (same min bundle both times; inject globals per **§1b**). **`false`** — legacy **one** `use_figma` with the full script in a single run. Parents rarely need to pass this field unless forcing single-call for debugging. |

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

4. **`Read`** one file only for the engine under `templates/`. Map the prompt’s **`layout`** field to filename (must match [`EXECUTOR.md`](../create-component/EXECUTOR.md) per-archetype table and the `layout` property inside `configBlock`):

| `layout` (prompt field) | `templates/` file |
|-------------------------|-------------------|
| `chip` | `create-component-engine-chip.min.figma.js` |
| `surface-stack` | `create-component-engine-surface-stack.min.figma.js` |
| `field` | `create-component-engine-field.min.figma.js` |
| `row-item` | `create-component-engine-row-item.min.figma.js` |
| `tiny` | `create-component-engine-tiny.min.figma.js` |
| `control` | `create-component-engine-control.min.figma.js` |
| `container` | `create-component-engine-container.min.figma.js` |
| `__composes__` | `create-component-engine-composed.min.figma.js` |

5. **Concatenate** in order: **`configBlock`** (from step 1) + newline + **phase globals** when two-phase is active (see **§1b** — default) + preamble (replaced) + minified engine string. **No** other text before/after. This is the `code` string for `use_figma`. When **`twoPhaseDraw: false`**, omit phase globals entirely.

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
