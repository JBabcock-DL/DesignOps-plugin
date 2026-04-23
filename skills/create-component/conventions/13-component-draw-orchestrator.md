# Component draw orchestrator (parent thread)

This document is the **runbook** for **Step 6** when using the **canvas-bundle-style** pattern: one isolated `Task` per Figma call, each `Task` loading only [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md). The **parent** owns scheduling, merges returns for `SKILL.md` §9, registry **5.2**, and must **not** `Read` `*.min.figma.js` engines into the main thread for that draw.

**Non-negotiables (imported, do not paraphrase away):** [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) **§1.1** and [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) **§2.2** — no empty table bodies, no “delete the whole table to add rows” mid-ladder, placeholder row geometry as needed so the 1640px table layout does not collapse.

---

## 1 — Fixed DAG (machine order)

Run **exactly** this sequence, **in order** — do not skip, reorder, or interleave with unrelated canvas `use_figma` in the same parent turn. On any `ok: false` from a `Task`, **stop**; do not start the next slug. **Agent phase chapter** for each row: [`phases/04-slice-cc-variants.md`](../phases/04-slice-cc-variants.md) through [`phases/09-slice-cc-doc-finalize.md`](../phases/09-slice-cc-doc-finalize.md) (one markdown file per slug).

1. `cc-variants` — variant plane (ComponentSet) — [`phases/04-slice-cc-variants.md`](../phases/04-slice-cc-variants.md)
2. `cc-doc-props` — page, header, **Properties** table (09 merged step) — [`phases/05-slice-cc-doc-props.md`](../phases/05-slice-cc-doc-props.md)
3. `cc-doc-component` — live ComponentSet into doc — [`phases/06-slice-cc-doc-component.md`](../phases/06-slice-cc-doc-component.md)
4. `cc-doc-matrix` — Variants × States matrix — [`phases/07-slice-cc-doc-matrix.md`](../phases/07-slice-cc-doc-matrix.md)
5. `cc-doc-usage` — Do / Don’t — [`phases/08-slice-cc-doc-usage.md`](../phases/08-slice-cc-doc-usage.md)
6. `cc-doc-finalize` — finalize + `returnPayload` for §9 — [`phases/09-slice-cc-doc-finalize.md`](../phases/09-slice-cc-doc-finalize.md)

---

## 2 — Friendly aliases (UX / docs)

| Friendly alias (what humans say) | Machine slug (`step=` in `Task` prompt) |
|----------------------------------|----------------------------------------|
| Variant plane (ComponentSet) | `cc-variants` |
| Page + header + **Properties** table (create table scaffold) | `cc-doc-props` |
| Component section (reparent) | `cc-doc-component` |
| Variants × States matrix | `cc-doc-matrix` |
| Do / Don’t (usage) | `cc-doc-usage` |
| Finalize (full return) | `cc-doc-finalize` |

**Implementation note (v1):** `cc-doc-props` maps to **one** committed `doc.step1` bundle (header + table merged) — not split into “scaffold” vs “fill” unless the build is split; see [09](./09-mcp-multi-step-doc-pipeline.md).

---

## 3 — Parent materializes per draw

Before the first `Task`, the parent (after Steps 1–5, 4.7) has:

- `fileKey`, `layout` (= `CONFIG.layout`), `createComponentRoot` (path to `skills/create-component/`), `configBlock` (verbatim `const CONFIG = { … };`), registry per [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) **§0**.

**`layout` filename mapping:** the committed step0 file uses `create-component-engine-<name>.step0.min.figma.js` where `<name>` is `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, or `composed` when `CONFIG.layout === '__composes__'`.

Each `Task` prompt must include: `step` (slug), `fileKey`, `layout`, `createComponentRoot`, `configBlock`, registry fields, and **`handoffJson`** (see §4) — a single JSON object string or fenced block, updated from the **previous** slice return.

---

## 4 — `handoffJson` shape (between Tasks)

`handoffJson` is **the parent’s** serialized state; the slice runner only **injects** it as globals. Start with the empty object **`{}` before** `cc-variants`.

**After `cc-variants` succeeds,** the parent must copy from the `use_figma` return (same fields the monolithic runner’s phase 1 uses) into `handoffJson.afterVariants` at minimum:

- `compSetId` (string) — for `__PHASE_1_COMP_SET_ID__` / handoff
- `propsAdded` (object) — for `__CC_PHASE1_PROPS_ADDED__`
- `unresolvedTokenMisses` (array) — for `__CC_PHASE1_UNRESOLVED__` (or `[]`)

**After `cc-doc-props` (step 1),** add / refresh doc anchors the engine expects for subsequent doc steps, e.g. under `handoffJson.doc` (field names follow the return payload of each step; the slice runner maps them to `__CC_HANDOFF_*` — see [create-component-figma-slice-runner](../create-component-figma-slice-runner/SKILL.md) **§3**). Parent rule: **always pass the latest** ids from the **immediately previous** `Task` return, merged with the original `afterVariants` block until the ladder completes.

**Config slice:** the parent **does not** split `configBlock` per step in v1; the same verbatim `const CONFIG` is passed to every slice. If a future build introduces step-specific `CONFIG` trimming, that would be an explicit follow-up; until then, one block for all six Tasks.

---

## 5 — After the ladder

When `cc-doc-finalize` returns `ok: true`, run **`SKILL.md` §9** and **Step 5.2** registry on **that** return payload only (final slice of the six-call ladder; same assertions as a full inline two-phase or single-call run would surface on the last `use_figma` return).

---

## 6 — What this supersedes

- **Only** six-call delegated MCP transport: **six** `Task` invocations → `create-component-figma-slice-runner` (this doc), **not** one parent thread with six `Read`s of min bundles. Parent **inline** / **preassembled** full-engine work stays in [`EXECUTOR.md`](../EXECUTOR.md) **§0** when `Task` is not viable.

**Cross-refs:** [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) (canvas vs component slice), [`AGENTS.md`](../../../AGENTS.md) (session runbook).
