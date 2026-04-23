---
name: create-component-figma-slice-runner
description: Normative spec for assembling one create-component Figma min slice (variant plane or doc step 1–6) — CONFIG + varGlobals + preamble + one committed *.min.figma.js, check-payload, one use_figma, compact return. Default transport is PARENT (or design-repo script) — not Task subagents, which often cannot emit full ~26–30K+ call_mcp payloads. Optional Task use only if this host is proven to pass full use_figma arguments from a subagent. Parent orchestration in conventions/13; EXECUTOR.md §0.
argument-hint: "step=<cc-variants|cc-doc-…>, fileKey, layout, createComponentRoot, configBlock, registry, handoffJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-slice-runner`

This file defines the **one-slice** assembly contract and **handoff** shape for [`/create-component`](../create-component/SKILL.md) Step 6. It is the **authoritative spec** for what each `use_figma` payload contains (`configBlock` → `varGlobals` → patched preamble → one engine from **§2**).

**Default transport (Composer-class / short-output hosts):** the **parent** (or a script in the **design repo**, e.g. `assemble-create-component-slice.mjs`) **assembles** per **§0.1**, runs **`check-payload`**, then the **parent** calls `use_figma` — **not** a `Task` subagent. Subagents often **cannot** materialize the full `use_figma` `arguments` JSON (including ~26–30K+ `code`) in one `call_mcp_tool` output. **Do not** default to `Task` → this skill for large slices, and do **not** delegate the **entire** seven-slice chain to a subagent when the contract is parent-owned MCP — a subagent may only **write** assembled `*.code.js` to disk for the parent to `Read` + `use_figma`. See [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md) **§0** and [`../create-component/conventions/08-cursor-composer-mcp.md`](../create-component/conventions/08-cursor-composer-mcp.md).

**Optional:** A **subagent** may run this skill only when the host is **proven** to pass the **full** tool arguments from a subagent. If a subagent `call_mcp` **fails** or **truncates** on slice size, **abandon** `Task` for that draw; continue in the **parent** with the same bytes.

You **`Read`** [`preamble.figma.js`](../create-component/templates/preamble.figma.js) and **exactly one** committed `*.min.figma.js` from the **§2** map, **concatenate** with the parent’s **`configBlock`**, **phase / handoff globals** (§3), and patched preamble — order is **`configBlock` → `varGlobals` → preamble → engine** (§0.1). You run **`check-payload`** (and `check-use-figma-mcp-args` if available), then **one** `use_figma`. You **never** `Read` a different min bundle than §2 for this `step`, and you **do not** spawn another `Task` from inside this skill.

**Parent** owns: Steps 1–5, 4.7, `SKILL.md` §9, registry 5.2, and **strictly sequential** scheduling of **seven** `use_figma` invocations — **one at a time**, DAG order only, **no parallel slices**. The **first** draw call is **always** `cc-doc-scaffold`; the **second** is **always** `cc-variants`. Do not start `cc-doc-component` or later until **both** have run and `handoffJson` has `doc` + `afterVariants`. Optional `Task` per slug **only** if viable — still **never** parallelize the ladder.

**Phase file:** Open the matching row in [`/create-component` `phases/`](../create-component/phases/00-index.md) for the current `step` — same slug order as [orchestrator §1](../create-component/conventions/13-component-draw-orchestrator.md).

| `step` | Read before slice |
|--------|---------------------|
| `cc-doc-scaffold` | [`phases/04-slice-cc-doc-scaffold.md`](../create-component/phases/04-slice-cc-doc-scaffold.md) |
| `cc-variants` | [`phases/05-slice-cc-variants.md`](../create-component/phases/05-slice-cc-variants.md) |
| `cc-doc-component` | [`phases/06-slice-cc-doc-component.md`](../create-component/phases/06-slice-cc-doc-component.md) |
| `cc-doc-props` | [`phases/07-slice-cc-doc-props.md`](../create-component/phases/07-slice-cc-doc-props.md) |
| `cc-doc-matrix` | [`phases/08-slice-cc-doc-matrix.md`](../create-component/phases/08-slice-cc-doc-matrix.md) |
| `cc-doc-usage` | [`phases/09-slice-cc-doc-usage.md`](../create-component/phases/09-slice-cc-doc-usage.md) |
| `cc-doc-finalize` | [`phases/10-slice-cc-doc-finalize.md`](../create-component/phases/10-slice-cc-doc-finalize.md) |

---

## §0 — Inputs (parent prompt or `Task` prompt, parseable)

| Field | Required | Description |
|--------|----------|-------------|
| `step` | yes | Machine slug: `cc-variants` \| `cc-doc-scaffold` \| `cc-doc-props` \| `cc-doc-component` \| `cc-doc-matrix` \| `cc-doc-usage` \| `cc-doc-finalize` (see **§2**). Unknown → `{ ok: false, errors: ["unknown step"] }` — do not guess. |
| `fileKey` | yes | Figma `fileKey` for `use_figma`. |
| `layout` | yes | Must match `CONFIG.layout` inside `configBlock` (string: `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `__composes__`). |
| `configBlock` | yes | Verbatim `const CONFIG = { … };` (Markdown-fence stripped per **§0.1**). **Not** JSON — functions must survive. |
| `createComponentRoot` | yes | Folder containing `templates/preamble.figma.js` (typically `…/skills/create-component/`). |
| `registry` | yes | **(a)** Path to project `.designops-registry.json` at the design repo root — `Read` to fill `ACTIVE_FILE_KEY` and `REGISTRY_COMPONENTS` in the preamble, **or (b)** `activeFileKey` (string or null) + `registryComponentsJson` (stringified object) if the file is unavailable. |
| `handoffJson` | **`cc-doc-scaffold`: optional / `{}`** (first draw slice); **`cc-variants`: required** — must include merged **`doc`** (`pageContentId`, `docRootId`) from scaffold; **`cc-doc-component` through `cc-doc-finalize`: required** — full `doc` + `afterVariants` (see **§3**) | JSON object; **parent-maintained** state between slices. Pass as a fenced `json` block or inline JSON. |
| `description` | no | `use_figma` description. |
| `projectRootForShell` | no | Cwd for `npm run check-payload` if needed (DesignOps plugin root). |

---

## §0.1 — Assembly order (identical to runner §1, one slice)

1. **Normalize `configBlock`** — trim, strip one Markdown fence, sanity-check `layout` appears; must define `const CONFIG`.
2. **`Read`** `{createComponentRoot}/templates/preamble.figma.js` **verbatim**.
3. **Patch preamble** only: `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS` (see `preamble.figma.js` header for the two replaceable literals).
4. **Resolve** `archetypeFile` from `layout` for **`cc-variants` only**:
   - `__composes__` → `composed` in the **filename**; all other `layout` values use the same spelling as the committed file (e.g. `surface-stack` → `create-component-engine-surface-stack.step0.min.figma.js`).
5. **`Read` exactly one** engine file per **§2** for this `step` — **verbatim** min file text.
6. **Build** `varGlobals` per **§3** from `handoffJson` and `step`.
7. **Concatenate** (no other bytes): `configBlock` + newline + `varGlobals` + newline + **patched preamble** + min engine string.
8. **Preflight** — pipe `code` to `node scripts/check-payload.mjs` (stdin) from `projectRootForShell` or plugin root; then `check-use-figma-mcp-args` if present.
9. **Call** `use_figma` with `fileKey`, `code`, `description`, `skillNames: "figma-use,create-component-figma-slice-runner"`.
10. **Return** compact JSON (**§4**). Resolve Figma MCP id via one `mcps/**/SERVER_METADATA.json` if needed (same as [canvas-bundle-runner §1](../canvas-bundle-runner/SKILL.md)).

**Scratch files:** do **not** write `*.mcp-*` or `*-payload.json` **under the DesignOps plugin repo** — stdin or OS temp only ([`AGENTS.md`](../../AGENTS.md)). Design consumer repos may use script output paths for parent `use_figma` per `EXECUTOR.md`.

---

## §2 — Bundle map (only `templates/` files you may `Read` for the engine)

Paths are under `{createComponentRoot}/templates/`. The **preamble** is always `preamble.figma.js` (not minified) — that is a **separate** `Read` from the table below (§0.1 allows preamble + one engine file).

| `step` | Engine file (one `Read`) |
|--------|--------------------------|
| `cc-doc-scaffold` | `create-component-engine-doc.step1.min.figma.js` — page + header + Properties table (placeholder body rows) |
| `cc-variants` | `create-component-engine-<archetype>.step0.min.figma.js` where `<archetype>` = `chip` \| `surface-stack` \| `field` \| `row-item` \| `tiny` \| `control` \| `container` \| `composed` (use **`composed`** when `layout` is `__composes__`) |
| `cc-doc-component` | `create-component-engine-doc.step2.min.figma.js` — live ComponentSet into doc (replace placeholder) |
| `cc-doc-props` | `create-component-engine-doc.step3.min.figma.js` — fill table cells in place from `CONFIG.properties` |
| `cc-doc-matrix` | `create-component-engine-doc.step4.min.figma.js` |
| `cc-doc-usage` | `create-component-engine-doc.step5.min.figma.js` |
| `cc-doc-finalize` | `create-component-engine-doc.step6.min.figma.js` |

If `step` is not in the first column, return `{ ok: false, step, errors: ["unknown step"] }` **before** any `Read`.

**Do not** `Glob`, `Grep`, or enumerate `templates/` to pick a file — only the single path for this `step` + `layout` (for `cc-variants`).

---

## §3 — `varGlobals` injection (from `handoffJson`)

Parse `handoffJson` to an object. Use **safe JSON** for string/array/object literals when building lines (e.g. `JSON.stringify` for ids and arrays).

**Schema (parent):**

- `doc` — from **`cc-doc-scaffold`** onward: `pageContentId`, `docRootId`, refreshed after each doc step; **`compSetId` only after `cc-doc-component`**. Merge script retains prior `doc` when a slice omits `compSetId`.
- `afterVariants` — from **`cc-variants`** return: at least `variantHolderId`, `propsAdded`, `unresolvedTokenMisses` (no `COMPONENT_SET` until `cc-doc-component`).

**`cc-doc-scaffold`** (first draw slice — **no** variants, **no** `afterVariants` yet)

```text
var __CREATE_COMPONENT_PHASE__ = 2;
var __CREATE_COMPONENT_DOC_STEP__ = 1;
```

The min bundle already sets `__CREATE_COMPONENT_DOC_STEP__`; if assembling by hand, include it. **Do not** inject `__PHASE_1_VARIANT_HOLDER_ID__` or `__CC_PHASE1_*` for this slice.

**`cc-variants`** (second draw slice — **preserves** `_PageContent` from scaffold)

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

Use the **most recent** `use_figma` return from the **prior** slice to populate `doc` — see orchestrator [§4](../create-component/conventions/13-component-draw-orchestrator.md#4--handoffjson-shape-between-tasks). If `pageContentId` / `docRootId` are missing, return `{ ok: false, errors: ["handoff: missing __CC_HANDOFF_* id for doc step"] }` before `use_figma`. For **finalize / matrix / usage** doc steps **4–6**, also require `doc.compSetId` / `__CC_HANDOFF_COMP_SET_ID__`. (**`cc-doc-props`**, doc step **3**, does not require `compSetId` for the table fill, but the parent should still merge it after **`cc-doc-component`** so later slices inherit a full `doc`.)

**Table safety:** the parent and engine enforce [09 §1.1](../create-component/conventions/09-mcp-multi-step-doc-pipeline.md) and [04](../create-component/conventions/04-doc-pipeline-contract.md) — you only inject handoffs; you do **not** edit table geometry.

---

## §4 — Return JSON (to parent)

**Success (typical):**

```json
{
  "ok": true,
  "step": "cc-doc-props",
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

- **Do not** run **multiple** create-component draw slices **in parallel** or **out of DAG order** — merge the prior return into `handoff.json`, then invoke the **next** slug only (**`cc-doc-scaffold` before `cc-variants`**).
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
