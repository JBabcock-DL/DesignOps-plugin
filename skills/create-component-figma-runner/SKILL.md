---
name: create-component-figma-runner
description: Run a single pre-assembled /create-component Figma draw — Read preamble + per-archetype engine, merge CONFIG and registry, call use_figma once, return compact JSON. Use ONLY inside a Task subagent (isolated context) so ~40K-char `code` and MCP assembly stay out of the parent thread — recommended for Cursor / Composer-class hosts. Parent owns shadcn install, CONFIG authoring, 4.7 token checks, and Step 5.2 registry; this subagent owns assembly + one use_figma only.
argument-hint: "fileKey=…, createComponentRoot=…, configJson=…, registry project path or pass activeFileKey + registryJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-runner`

You are a **single-purpose subagent**. Your job is to assemble the [`/create-component`](../create-component/SKILL.md) `use_figma` **code** string (CONFIG + [`preamble.figma.js`](../create-component/templates/preamble.figma.js) + one [`create-component-engine-{layout}.min.figma.js`](../create-component/templates/)), run preflight, call **`use_figma` once**, and return a **compact** JSON result to the parent. You run in an **isolated** context so the parent thread (especially short-output hosts) does not emit the full ~40K-character `code` in one assistant message.

**Parent threads** that invoke you must **not** paste the minified engine into their own `use_figma` call for that component — they hand off the structured inputs to you instead. Full orchestration, registry write-back, and `§9` assertions can stay in the parent; assembly + Figma call happen here. Rationale: same pattern as [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md), [`AGENTS.md`](../../AGENTS.md) § *Session runbook*.

---

## §0 — Inputs (from parent Task prompt)

The parent must supply **all** of the following in its `Task` prompt in a **parseable** form (JSON block or key=value lines).

| Field | Required | Description |
|--------|----------|-------------|
| `fileKey` | yes | Figma file key for `use_figma` |
| `configJson` | yes | A **JSON** string that parses to the same object shape as the `CONFIG` block in [`create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) (component metadata, `layout` archetype, token paths, etc.) — the parent builds this after CVA / routing, same as a direct `use_figma` run |
| `createComponentRoot` | yes | Path to the folder that contains `templates/preamble.figma.js` (e.g. repo `skills/create-component/`) so you can `Read` the preamble and the correct `create-component-engine-{layout}.min.figma.js` |
| `registry` | one of (a) or (b) | **(a)** Path to a `.designops-registry.json` at the **design project** repo root — `Read` it to fill `ACTIVE_FILE_KEY` and `REGISTRY_COMPONENTS` for the preamble, **or (b)** `activeFileKey` (string or null) + `registryComponentsJson` (stringified JSON object) inlined in the prompt if the file is not available |

**Optional:** `description` (string) for `use_figma`; `projectRootForShell` if `npm run check-payload` must be run with `cwd` (defaults to the workspace folder that contains `package.json` with `check-payload` — usually the DesignOps plugin root).

---

## §1 — Assembly (exact order, same as EXECUTOR)

1. `JSON.parse(configJson)` → validate early; use as the single in-scope **`CONFIG`** object. Emit **`const CONFIG = <parsed>;\n`** as the first part of the payload (the factory uses `const CONFIG` — the engine expects `CONFIG` in scope; JSON round-tripping preserves strings and numbers; if a field is invalid, fail fast in preflight or Figma will report).

2. **`Read`** [`../create-component/templates/preamble.figma.js`](../create-component/templates/preamble.figma.js) **via** `createComponentRoot` — path `join`: `{createComponentRoot}/templates/preamble.figma.js` **verbatim** text.

3. **Replace** in the preamble string **only** the two literals allowed by the preamble (see file header):
   - `const ACTIVE_FILE_KEY = null;` → `const ACTIVE_FILE_KEY = <JSON of string | null>;`
   - `const REGISTRY_COMPONENTS = {};` → `const REGISTRY_COMPONENTS = <JSON of object>;`  
   **Values** must come from the registry `Read` (field names per existing [`create-component` flow](../create-component/SKILL.md) Step 5.1) or from `activeFileKey` + `registryComponentsJson`.

4. **`Read`** one file only for the engine under `templates/`. Map `CONFIG.layout` to filename (must match [`EXECUTOR.md`](../create-component/EXECUTOR.md) per-archetype table):

| `CONFIG.layout` | `templates/` file |
|-----------------|-------------------|
| `chip` | `create-component-engine-chip.min.figma.js` |
| `surface-stack` | `create-component-engine-surface-stack.min.figma.js` |
| `field` | `create-component-engine-field.min.figma.js` |
| `row-item` | `create-component-engine-row-item.min.figma.js` |
| `tiny` | `create-component-engine-tiny.min.figma.js` |
| `control` | `create-component-engine-control.min.figma.js` |
| `container` | `create-component-engine-container.min.figma.js` |
| `__composes__` | `create-component-engine-composed.min.figma.js` |

5. **Concatenate** in order: **`const CONFIG = …;`** (from step 1) + newline + preamble (replaced) + minified engine string. **No** other text before/after. This is the `code` string for `use_figma`.

6. **Preflight** — in order:
   - Pipe the concatenated `code` to `node {pluginRoot}/scripts/check-payload.mjs` (stdin) **or** write **only** to a temp path **outside the repo** (e.g. OS temp) and pass the path — **do not** commit `*.mcp-*` or `*-payload.json` under the repo (see [`AGENTS.md`](../../AGENTS.md)).
   - If the plugin has [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs), build the object `{ "fileKey": "...", "code": "<full string>", "description": "...", "skillNames": "figma-use,create-component" }` and pipe it to that script, or use the host’s `call_mcp_tool` only after both gates pass.

7. **Call `use_figma`** with `fileKey`, `code` (full assembled string), `description`, and `skillNames: "figma-use,create-component-figma-runner"`.

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

---

## §2 — Hard prohibitions

- **Do not** `Read` the entire [`create-component/SKILL.md`](../create-component/SKILL.md) just to get CONFIG — the parent must supply `configJson`.
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
