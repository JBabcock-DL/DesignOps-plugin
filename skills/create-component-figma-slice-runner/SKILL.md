---
name: create-component-figma-slice-runner
description: Normative spec for assembling one create-component Figma min slice (variant plane or doc step) — CONFIG + varGlobals + preamble + tuple ops (scaffold sub-slugs) or one committed *.min.figma.js, check-payload, one use_figma, compact return. Default transport is PARENT (or design-repo script). Target **8–10 kB** per-slice `code` where practical ([`18-mcp-payload-budget.md`](../create-component/conventions/18-mcp-payload-budget.md)); more sub-slugs if needed. Optional Task use only if this host is proven. Parent orchestration in conventions/13; EXECUTOR.md §0.
argument-hint: "step=<cc-doc-scaffold-shell|…|cc-doc-finalize>, fileKey, layout, createComponentRoot, configBlock, registry, handoffJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-slice-runner`

This file defines the **one-slice** assembly contract and **handoff** shape for [`/create-component`](../create-component/SKILL.md) Step 6. It is the **authoritative spec** for what each `use_figma` payload contains (`configBlock` → `varGlobals` → patched preamble → tuple ops for scaffold sub-slugs **or** one engine from **§2**).

**Default transport (Composer-class / short-output hosts):** the **parent** (or a script in the **design repo**, e.g. `assemble-create-component-slice.mjs`) **assembles** per **§0.1**, runs **`check-payload`**, then the **parent** calls `use_figma` — **not** a `Task` subagent. **Prefer small `code` per call** (north star **8–10 kB**; [`../create-component/conventions/18-mcp-payload-budget.md`](../create-component/conventions/18-mcp-payload-budget.md)) so tool JSON is not near host limits. If a subagent cannot **emit** full args, the fix is **more sub-slugs** and **thinner** bundles in the **parent** — not a different MCP client. **Do not** default to `Task` for large **legacy** slices, and do **not** delegate the full draw **chain** to a subagent — a subagent may only **write** assembled `*.code.js` to disk for the parent. See [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) **§0** and [`../create-component/conventions/08-cursor-composer-mcp.md`](../create-component/conventions/08-cursor-composer-mcp.md).

**Optional:** A **subagent** may run this skill only when the host is **proven** to pass the **full** tool arguments from a subagent. If a subagent `call_mcp` **fails** or **truncates** on slice size, **abandon** `Task` for that draw; continue in the **parent** with the same bytes.

You **`Read`** [`preamble.figma.js`](../create-component/templates/preamble.figma.js) and **exactly one** committed `*.min.figma.js` from the **§2** map, **concatenate** with the parent’s **`configBlock`**, **phase / handoff globals** (§3), and patched preamble — order is **`configBlock` → `varGlobals` → preamble → engine** (§0.1). You run **`check-payload`** (and `check-use-figma-mcp-args` if available), then **one** `use_figma`. You **never** `Read` a different min bundle than §2 for this `step`, and you **do not** spawn another `Task` from inside this skill.

**Parent** owns: Steps 1–5, 4.7, `SKILL.md` §9, registry 5.2, and **strictly sequential** scheduling of **one** `use_figma` per machine slug in [`SLUG_ORDER`](../../scripts/merge-create-component-handoff.mjs) (base ladder has **12** + optional `.partN` extensions — see [orchestrator §1](../create-component/conventions/13-component-draw-orchestrator.md)) — **one at a time**, DAG order only, **no parallel slices**. The **first** draw call is **always** `cc-doc-scaffold-shell`; **`cc-variants` is always** immediately after `cc-doc-scaffold-placeholders` (sixth in the default ladder). Do not start `cc-doc-component` or later until **both** scaffold chain and variants have run and `handoffJson` has `doc` + `afterVariants`. Optional `Task` per slug **only** if viable — still **never** parallelize the ladder.

**Phase file:** Open the matching row in [`/create-component` `phases/`](../create-component/phases/00-index.md) for the current `step` — same slug order as [orchestrator §1](../create-component/conventions/13-component-draw-orchestrator.md).

| `step` | Read before slice |
|--------|---------------------|
| `cc-doc-scaffold-shell` — `cc-doc-scaffold-placeholders` | [`phases/04-slice-cc-doc-scaffold.md`](../create-component/phases/04-slice-cc-doc-scaffold.md) (covers all scaffold sub-slugs) |
| `cc-variants` | [`phases/05-slice-cc-variants.md`](../create-component/phases/05-slice-cc-variants.md) |
| `cc-doc-component` | [`phases/06-slice-cc-doc-component.md`](../create-component/phases/06-slice-cc-doc-component.md) |
| `cc-doc-props-1` | [`phases/07-slice-cc-doc-props-1.md`](../create-component/phases/07-slice-cc-doc-props-1.md) |
| `cc-doc-props-2` | [`phases/08-slice-cc-doc-props-2.md`](../create-component/phases/08-slice-cc-doc-props-2.md) |
| `cc-doc-matrix` | [`phases/09-slice-cc-doc-matrix.md`](../create-component/phases/09-slice-cc-doc-matrix.md) |
| `cc-doc-usage` | [`phases/10-slice-cc-doc-usage.md`](../create-component/phases/10-slice-cc-doc-usage.md) |
| `cc-doc-finalize` | [`phases/11-slice-cc-doc-finalize.md`](../create-component/phases/11-slice-cc-doc-finalize.md) |

---

## §0 — Inputs (parent prompt or `Task` prompt, parseable)

| Field | Required | Description |
|--------|----------|-------------|
| `step` | yes | Machine slug: see [`SLUG_ORDER`](../../scripts/merge-create-component-handoff.mjs) (scaffold: `cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`, then `cc-variants` … `cc-doc-finalize`). Unknown → `{ ok: false, errors: ["unknown step"] }` — do not guess. |
| `fileKey` | yes | Figma `fileKey` for `use_figma`. |
| `layout` | yes | Must match `CONFIG.layout` inside `configBlock` (string: `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `__composes__`). |
| `configBlock` | yes | Verbatim `const CONFIG = { … };` (Markdown-fence stripped per **§0.1**). **Not** JSON — functions must survive. |
| `createComponentRoot` | yes | Folder containing `templates/preamble.figma.js` (typically `…/skills/create-component/`). |
| `registry` | yes | **(a)** Path to project `.designops-registry.json` at the design repo root — `Read` to fill `ACTIVE_FILE_KEY` and `REGISTRY_COMPONENTS` in the preamble, **or (b)** `activeFileKey` (string or null) + `registryComponentsJson` (stringified object) if the file is unavailable. |
| `handoffJson` | **`cc-doc-scaffold-shell`: optional / `{}`** (first draw slice); **scaffold 2–4:** must include merged **`doc`** from prior merges; **`cc-variants`: required** — `doc` with ids; **`cc-doc-component` through `cc-doc-finalize`: required** — full `doc` + `afterVariants` (see **§3**) | JSON object; **parent-maintained** state between slices. Pass as a fenced `json` block or inline JSON. |
| `description` | no | `use_figma` description. |
| `projectRootForShell` | no | Cwd for `npm run check-payload` if needed (DesignOps plugin root). |

---

## §0.1 — Assembly order (identical to runner §1, one slice)

1. **Normalize `configBlock`** — trim, strip one Markdown fence, sanity-check `layout` appears; must define `const CONFIG`.
2. **`Read`** `{createComponentRoot}/templates/preamble.runtime.figma.js` **verbatim** (generated; ~1.3 kB — same identifiers as the human-edited `preamble.figma.js`). If missing, `npm run build:min` in the plugin root. For one-command assembly, run **`npm run assemble-slice`** from the plugin repo (concatenates config + `varGlobals` + patched preamble + engine, then `check-payload` / optional `check-use-figma-mcp-args` — see script header). When editing the preamble, change **`preamble.figma.js`** only; never hand-edit the runtime file.
3. **Patch preamble** only: `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS` (see `preamble.figma.js` header for the two replaceable literals).
4. **Resolve** `archetypeFile` from `layout` for **`cc-variants` only**:
   - `__composes__` → `composed` in the **filename**; all other `layout` values use the same spelling as the committed file (e.g. `surface-stack` → `create-component-engine-surface-stack.step0.min.figma.js`).
5. **`Read` exactly one** engine file per **§2** for this `step` — **verbatim** min file text.
6. **Build** `varGlobals` per **§3** from `handoffJson` and `step`.
7. **Concatenate** (no other bytes): `configBlock` + newline + `varGlobals` + newline + **patched preamble** + min engine string. **The concatenated string is the plugin code as-is.** Do **not** wrap it in `fetch`, base64, custom UTF-8 decode, `new AsyncFunction(code)()`, gzip bootstrap, or any other "loader." The Figma plugin host executes the `code` argument directly; the absence of `fetch` / `atob` / `TextDecoder` / `DecompressionStream` in the sandbox is **not** a problem to solve — those APIs are not needed on this path. See [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) **§0** *Gzip / base64 / `fetch` / `AsyncFunction` wrappers*.
8. **Preflight** — pipe `code` to `node scripts/check-payload.mjs` (stdin) from `projectRootForShell` or plugin root; then `check-use-figma-mcp-args` if present.
9. **Call** `use_figma` with `fileKey`, `code`, `description`, `skillNames: "figma-use,create-component-figma-slice-runner"` — `code` is the **verbatim** concatenated string from step 7, **not** a wrapper around it. **Parent** invokes MCP by default. If using a subagent, prefer a **writer** (assemble + `check-payload` + write `mcp-<slug>.json` / `slice-*.js` in the design repo, short return) and **parent** `Read` + `use_figma` — not a “runner” that burns tool rounds before `call_mcp`; see [`../create-component/conventions/08-cursor-composer-mcp.md`](../create-component/conventions/08-cursor-composer-mcp.md) **§D.1**.
10. **Return** compact JSON (**§4**). Resolve Figma MCP id via one `mcps/**/SERVER_METADATA.json` if needed (same as [canvas-bundle-runner §1](../canvas-bundle-runner/SKILL.md)).

**Scratch files:** do **not** write `*.mcp-*` or `*-payload.json` **under the DesignOps plugin repo** — stdin or OS temp only ([`AGENTS.md`](../../AGENTS.md)). Design consumer repos may use script output paths for parent `use_figma` per `EXECUTOR.md`. When using [`scripts/assemble-slice.mjs`](../../scripts/assemble-slice.mjs) **`--emit-mcp-args`**, the **canonical** filename is **`mcp-<step-slug>.json`** (same slug as `step`); do not invent other names in the same working directory.

---

## §2 — Bundle map (only `templates/` files you may `Read` for the engine)

Paths are under `{createComponentRoot}/templates/`. The **preamble** for MCP runs is `preamble.runtime.figma.js` (see §0.1); the table below lists **engine** `Read`s. Humans edit `preamble.figma.js`; `npm run build:min` emits the runtime file.

| `step` | Engine file (one `Read`) |
|--------|--------------------------|
| `cc-doc-scaffold-shell` | Tuple ops + `op-interpreter.min.figma.js` via `assemble-slice` / `generate-ops` (not the raw `create-component-engine-doc.step1.min.figma.js` file — that min remains in repo for legacy `--legacy-bundles` only) |
| `cc-doc-scaffold-header` | (same — continuation; handoff ids in `varGlobals`) |
| `cc-doc-scaffold-table-chrome` | (same) |
| `cc-doc-scaffold-table-body` | (same; requires `doc.propertiesTableId` from merged chrome return) |
| `cc-doc-scaffold-placeholders` | (same) |
| `cc-variants` | `create-component-engine-<archetype>.step0.min.figma.js` where `<archetype>` = `chip` \| `surface-stack` \| `field` \| `row-item` \| `tiny` \| `control` \| `container` \| `composed` (use **`composed`** when `layout` is `__composes__`) |
| `cc-doc-component` | `create-component-engine-doc.step2.min.figma.js` — live ComponentSet into doc (replace placeholder) |
| `cc-doc-props` | `create-component-engine-doc.step3.min.figma.js` — fill table cells (legacy one-shot; omits row-range globals) |
| `cc-doc-props-1` | (same min file — first half of rows; `assemble-slice` adds `__CC_PROPS_ROW_*__`) |
| `cc-doc-props-2` | (same — second half of rows) |
| `cc-doc-matrix` | `create-component-engine-doc.step4.min.figma.js` |
| `cc-doc-usage` | `create-component-engine-doc.step5.min.figma.js` |
| `cc-doc-finalize` | `create-component-engine-doc.step6.min.figma.js` |

If `step` is not in the first column, return `{ ok: false, step, errors: ["unknown step"] }` **before** any `Read`.

**Do not** `Glob`, `Grep`, or enumerate `templates/` to pick a file — only the single path for this `step` + `layout` (for `cc-variants`).

---

## §3 — `varGlobals` injection (from `handoffJson`)

Parse `handoffJson` to an object. Use **safe JSON** for string/array/object literals when building lines (e.g. `JSON.stringify` for ids and arrays).

**Schema (parent):**

- `doc` — from **`cc-doc-scaffold-shell` return** onward (merge after each slice that returns ids): `pageContentId`, `docRootId`, refreshed after each doc step; optional **`propertiesTableId`** after `cc-doc-scaffold-table-chrome` (for `cc-doc-scaffold-table-body` `varGlobals`); **`compSetId` only after `cc-doc-component`**. Merge script retains prior `doc` when a slice omits optional fields.
- `afterVariants` — from **`cc-variants`** return: at least `variantHolderId`, `propsAdded`, `unresolvedTokenMisses` (no `COMPONENT_SET` until `cc-doc-component`).

**`cc-doc-scaffold-shell`** (first draw slice — **no** handoff page/doc ids in globals yet)

**`cc-doc-scaffold-header` / `cc-doc-scaffold-table-chrome` / `cc-doc-scaffold-table-body` / `cc-doc-scaffold-placeholders`** (continuation — **`assemble-slice` injects** `__CC_HANDOFF_PAGE_CONTENT_ID__` and `__CC_HANDOFF_DOC_ROOT_ID__` from `handoff.doc`; **`cc-doc-scaffold-table-body` also** `__CC_HANDOFF_SCAFFOLD_TABLE_ID__` from `doc.propertiesTableId`; op-interpreter pre-seeds `refs` — see [`assemble-slice.mjs`](../../scripts/assemble-slice.mjs) `buildVarGlobals`)

**First slice only** — same as before:

```text
var __CREATE_COMPONENT_PHASE__ = 2;
var __CREATE_COMPONENT_DOC_STEP__ = 1;
```

Continuation scaffold slices add the two `__CC_HANDOFF_*` lines (see script). **Do not** inject `__PHASE_1_VARIANT_HOLDER_ID__` or `__CC_PHASE1_*` until after `cc-variants`.

**`cc-variants`** (sixth draw slice in the default ladder — **preserves** `_PageContent` from scaffold)

```text
var __CREATE_COMPONENT_PHASE__ = 1;
var __CC_HANDOFF_PAGE_CONTENT_ID__ = "<doc.pageContentId>";
var __CC_HANDOFF_DOC_ROOT_ID__ = "<doc.docRootId>";
```

**`cc-doc-component` through `cc-doc-finalize`**

Always include **`afterVariants`** telemetry **and** `handoffJson.doc`. Phase-1 globals (in addition to `__CREATE_COMPONENT_PHASE__ = 2` and the baked `__CREATE_COMPONENT_DOC_STEP__` from the min bundle):

```text
var __PHASE_1_VARIANT_HOLDER_ID__ = "<afterVariants.variantHolderId>";
var __CC_PHASE1_PROPS_ADDED__ = <JSON object>;
var __CC_PHASE1_UNRESOLVED__ = <JSON array>;
```

Handoff anchors:

```text
var __CC_HANDOFF_PAGE_CONTENT_ID__ = "<doc.pageContentId>";
var __CC_HANDOFF_DOC_ROOT_ID__ = "<doc.docRootId>";
```

**Only after `cc-doc-component`** does `handoff.doc.compSetId` exist — inject when present (matrix / usage / finalize require it):

```text
var __CC_HANDOFF_COMP_SET_ID__ = "<doc.compSetId>";
```

Use the **most recent** `use_figma` return from the **prior** slice to populate `doc` — see orchestrator [§4](../create-component/conventions/13-component-draw-orchestrator.md#4--handoffjson-shape-between-tasks). If `pageContentId` / `docRootId` are missing, return `{ ok: false, errors: ["handoff: missing __CC_HANDOFF_* id for doc step"] }` before `use_figma`. For **finalize / matrix / usage** doc steps **4–6** (engine steps 4–6), also require `doc.compSetId` / `__CC_HANDOFF_COMP_SET_ID__`. (**`cc-doc-props-1` / `cc-doc-props-2`**, engine step **3**, do not require `compSetId` for the table fill logic, but the parent should still merge **`cc-doc-component`** first so `handoff.doc` carries `compSetId` for a consistent chain.)

**Table safety:** the parent and engine enforce [09 §1.1](../create-component/conventions/09-mcp-multi-step-doc-pipeline.md) and [04](../create-component/conventions/04-doc-pipeline-contract.md) — you only inject handoffs; you do **not** edit table geometry.

---

## §4 — Return JSON (to parent)

**Success (typical):**

```json
{
  "ok": true,
  "step": "cc-doc-props-1",
  "fileKey": "…",
  "raw": { }
}
```

- **`raw`**: pass through the **`use_figma` result** (or the engine `return` payload) so the parent can merge `pageContentId` / `docRootId` / `compSetId` / `propsAdded` / `unresolvedTokenMisses` / `unresolvedTokenPaths` into the next `handoffJson` and for §9 after `cc-doc-finalize`.

**Failure:**

```json
{
  "ok": false,
  "step": "cc-variants",
  "errors": ["check-payload: …" ]
}
```

On transient MCP error, **one** retry with identical `code` (same as [canvas-bundle-runner §4](../canvas-bundle-runner/SKILL.md)).

---

## §5 — Hard prohibitions

- **Do not** run **multiple** create-component draw slices **in parallel** or **out of DAG order** — merge the prior return into `handoff.json`, then invoke the **next** slug only (**`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders` before `cc-variants`**, then the rest of the ladder in [`13` §1](../create-component/conventions/13-component-draw-orchestrator.md) order).
- **Do not** call `use_figma` before the full `code` string is assembled and `check-payload` passes.
- **Do not** `Read` any engine file except **preamble** + the **one** path from **§2** for this `step`/`layout`.
- **Do not** minify, trim, or “fix” the engine or preamble.
- **Do not** require **`Task`** for draws where the **subagent cannot emit** the full `use_figma` tool args — use **parent** + [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) **§0** instead.
- **Do not** launch another `Task` from inside this skill — one level only.
- **Do not** use this skill for **canvas** style-guide bundles — use [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) only.

---

## §6 — Cross-references

| Topic | Where |
|--------|--------|
| Parent orchestrator DAG + aliases | [`../create-component/conventions/13-component-draw-orchestrator.md`](../create-component/conventions/13-component-draw-orchestrator.md) |
| Parent inline / preassembled | [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) **§0** — **§0.0** context optimization (parent still sole `use_figma` caller) |
| `use_figma` workflow | [`../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| `check-payload` | [`../../scripts/check-payload.mjs`](../../scripts/check-payload.mjs) |
| Merge Figma return → `handoff.json` on disk (parent thread) | [`../../scripts/merge-create-component-handoff.mjs`](../../scripts/merge-create-component-handoff.mjs) |
