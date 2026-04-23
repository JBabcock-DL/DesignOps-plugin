---
name: create-component-figma-slice-runner
description: Run exactly one create-component Figma min slice (variant plane or doc step 1–5) — Read preamble + one committed *.min.figma.js, assemble with parent configBlock and handoffJson globals, check-payload, one use_figma, return compact JSON. Use ONLY inside an isolated Task (general-purpose) so minified engine text stays out of the parent thread. Parent runs the orchestration in [conventions/13](../create-component/conventions/13-component-draw-orchestrator.md); this subagent does not schedule other Tasks.
argument-hint: "step=<cc-variants|cc-doc-…>, fileKey, layout, createComponentRoot, configBlock, registry, handoffJson — see SKILL §0."
agent: general-purpose
---

# Skill — `create-component-figma-slice-runner`

You are a **single-purpose subagent** for **one** slice of the [component draw orchestrator](../create-component/conventions/13-component-draw-orchestrator.md) DAG. You **`Read`** [`preamble.figma.js`](../create-component/templates/preamble.figma.js) and **exactly one** committed `*.min.figma.js` from the **§2** map, **concatenate** with the parent’s **`configBlock`**, **phase / handoff globals** (§3), and patched preamble — same assembly order as [`create-component-figma-runner` §1](../create-component-figma-runner/SKILL.md) for that slice. You run **`check-payload`** (and `check-use-figma-mcp-args` if available), then **one** `use_figma`. You **never** `Read` a different min bundle than §2 for this `step`, and you **do not** spawn another `Task`.

**Parent** owns: Steps 1–5, 4.7, `SKILL.md` §9, registry 5.2, and **sequential** `Task` scheduling in DAG order. **This skill** owns: assembly + preflight + **one** MCP call + compact JSON return.

---

## §0 — Inputs (parent `Task` prompt, parseable)

| Field | Required | Description |
|--------|----------|-------------|
| `step` | yes | Machine slug: `cc-variants` \| `cc-doc-props` \| `cc-doc-component` \| `cc-doc-matrix` \| `cc-doc-usage` \| `cc-doc-finalize` (see **§2**). Unknown → `{ ok: false, errors: ["unknown step"] }` — do not guess. |
| `fileKey` | yes | Figma `fileKey` for `use_figma`. |
| `layout` | yes | Must match `CONFIG.layout` inside `configBlock` (string: `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `__composes__`). |
| `configBlock` | yes | Verbatim `const CONFIG = { … };` (Markdown-fence stripped like [runner §1 step 1](../create-component-figma-runner/SKILL.md)). **Not** JSON — functions must survive. |
| `createComponentRoot` | yes | Folder containing `templates/preamble.figma.js` (typically `…/skills/create-component/`). |
| `registry` | yes | As [runner §0](../create-component-figma-runner/SKILL.md) — file path to `.designops-registry.json` or `activeFileKey` + `registryComponentsJson`. |
| `handoffJson` | **cc-variants: optional / `{}`**; **all doc slugs: required** | JSON object; **parent-maintained** state between slices — see **§3** for what to inject. Pass as a fenced `json` block or inline JSON. |
| `description` | no | `use_figma` description. |
| `projectRootForShell` | no | Cwd for `npm run check-payload` if needed (DesignOps plugin root). |

---

## §0.1 — Assembly order (identical to runner §1, one slice)

1. **Normalize `configBlock`** — trim, strip one Markdown fence, sanity-check `layout` appears; must define `const CONFIG`.
2. **`Read`** `{createComponentRoot}/templates/preamble.figma.js` **verbatim**.
3. **Patch preamble** only: `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS` — same as [runner §1 steps 2–3](../create-component-figma-runner/SKILL.md).
4. **Resolve** `archetypeFile` from `layout` for **`cc-variants` only**:
   - `__composes__` → `composed` in the **filename**; all other `layout` values use the same spelling as the committed file (e.g. `surface-stack` → `create-component-engine-surface-stack.step0.min.figma.js`).
5. **`Read` exactly one** engine file per **§2** for this `step` — **verbatim** min file text.
6. **Build** `varGlobals` per **§3** from `handoffJson` and `step`.
7. **Concatenate** (no other bytes): `configBlock` + newline + `varGlobals` + newline + **patched preamble** + min engine string.
8. **Preflight** — pipe `code` to `node scripts/check-payload.mjs` (stdin) from `projectRootForShell` or plugin root; then `check-use-figma-mcp-args` if present.
9. **Call** `use_figma` with `fileKey`, `code`, `description`, `skillNames: "figma-use,create-component-figma-slice-runner"`.
10. **Return** compact JSON (**§4**). Resolve Figma MCP id via one `mcps/**/SERVER_METADATA.json` if needed (same as [canvas-bundle-runner §1](../canvas-bundle-runner/SKILL.md)).

**Scratch files:** do **not** write `*.mcp-*` or `*-payload.json` under the repo — stdin or OS temp only ([`AGENTS.md`](../../AGENTS.md)).

---

## §2 — Bundle map (only `templates/` files you may `Read` for the engine)

Paths are under `{createComponentRoot}/templates/`. The **preamble** is always `preamble.figma.js` (not minified) — that is a **separate** `Read` from the table below (§0.1 allows preamble + one engine file).

| `step` | Engine file (one `Read`) |
|--------|--------------------------|
| `cc-variants` | `create-component-engine-<archetype>.step0.min.figma.js` where `<archetype>` = `chip` \| `surface-stack` \| `field` \| `row-item` \| `tiny` \| `control` \| `container` \| `composed` (use **`composed`** when `layout` is `__composes__`) |
| `cc-doc-props` | `create-component-engine-doc.step1.min.figma.js` |
| `cc-doc-component` | `create-component-engine-doc.step2.min.figma.js` |
| `cc-doc-matrix` | `create-component-engine-doc.step3.min.figma.js` |
| `cc-doc-usage` | `create-component-engine-doc.step4.min.figma.js` |
| `cc-doc-finalize` | `create-component-engine-doc.step5.min.figma.js` |

If `step` is not in the first column, return `{ ok: false, step, errors: ["unknown step"] }` **before** any `Read`.

**Do not** `Glob`, `Grep`, or enumerate `templates/` to pick a file — only the single path for this `step` + `layout` (for `cc-variants`).

---

## §3 — `varGlobals` injection (from `handoffJson`)

Parse `handoffJson` to an object. Use **safe JSON** for string/array/object literals when building lines (e.g. `JSON.stringify` for ids and arrays).

**Schema (parent):**

- `afterVariants` — from **`cc-variants`** return (phase 1 shape): at least `compSetId` (string), `propsAdded` (object), `unresolvedTokenMisses` (array). Optional mirror keys at top level for tooling.
- `doc` — after **`cc-doc-props`**, and **updated** after each subsequent doc step: `pageContentId`, `docRootId`, `compSetId` (and any other fields from [`draw-engine.figma.js` `__ccDocHandoffAfter`](../../create-component/templates/draw-engine.figma.js) — the parent should copy the **last** return’s ids into `doc` before the next `Task`).

**`cc-variants`**

```text
var __CREATE_COMPONENT_PHASE__ = 1;
```

**`cc-doc-props` through `cc-doc-finalize`**

Always include phase-2 variant telemetry from **`afterVariants`** (same as [runner §1b phase 2](../create-component-figma-runner/SKILL.md)):

```text
var __CREATE_COMPONENT_PHASE__ = 2;
var __PHASE_1_COMP_SET_ID__ = "<afterVariants.compSetId>";
var __CC_PHASE1_PROPS_ADDED__ = <JSON object>;
var __CC_PHASE1_UNRESOLVED__ = <JSON array>;
```

**`cc-doc-component`, `cc-doc-matrix`, `cc-doc-usage`, `cc-doc-finalize`**

Additionally require `handoffJson.doc` (or top-level if parent flattens — prefer nested `doc`):

```text
var __CC_HANDOFF_PAGE_CONTENT_ID__ = "<doc.pageContentId>";
var __CC_HANDOFF_DOC_ROOT_ID__ = "<doc.docRootId>";
var __CC_HANDOFF_COMP_SET_ID__ = "<doc.compSetId>";
```

Use the **most recent** `use_figma` return from the **prior** doc slice to populate `doc` — see orchestrator [§4](../create-component/conventions/13-component-draw-orchestrator.md#4--handoffjson-shape-between-tasks). If any required id is missing for step ≥ 2, return `{ ok: false, errors: ["handoff: missing __CC_HANDOFF_* id for doc step"] }` before `use_figma`.

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

- **Do not** call `use_figma` before the full `code` string is assembled and `check-payload` passes.
- **Do not** `Read` any engine file except **preamble** + the **one** path from **§2** for this `step`/`layout`.
- **Do not** minify, trim, or “fix” the engine or preamble.
- **Do not** use `preassembledCodePaths` here — that escape hatch is [runner §0.1](../create-component-figma-runner/SKILL.md), not this skill.
- **Do not** launch another `Task` — one level only.
- **Do not** use this skill for **canvas** style-guide bundles — use [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) only.

---

## §6 — Cross-references

| Topic | Where |
|--------|--------|
| Parent orchestrator DAG + aliases | [`../create-component/conventions/13-component-draw-orchestrator.md`](../create-component/conventions/13-component-draw-orchestrator.md) |
| Full runner (legacy single-Task six-step / two-phase) | [`../create-component-figma-runner/SKILL.md`](../create-component-figma-runner/SKILL.md) |
| `use_figma` workflow | [`../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| `check-payload` | [`../../scripts/check-payload.mjs`](../../scripts/check-payload.mjs) |
