# Component draw orchestrator (parent thread)

This document is the **runbook** for **Step 6**: **seven** sequential `use_figma` calls in **parent** (default), one per machine slug, each assembled per [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md) **§0.1 / §2**. The **parent** owns scheduling, merges `handoffJson` between calls, returns for `SKILL.md` §9, and registry **5.2**. **Do not** default to `Task` subagents for slices whose **full** `code` the subagent cannot pass in `call_mcp` (common for ~26–30K+ payloads) — see [`../EXECUTOR.md`](../EXECUTOR.md) **§0**. The parent **may** `Read` min engines and preamble in the main thread for this path.

**Non-negotiables (imported, do not paraphrase away):** [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) **§1.1** and [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) **§2.2** — no empty table bodies, no “delete the whole table to add rows” mid-ladder, placeholder row geometry as needed so the 1640px table layout does not collapse. **Scaffold then fill:** the first doc slice places the **Properties** table with **placeholder** body rows; the next slice **fills** cell text in place only (see [04](./04-doc-pipeline-contract.md) **§2.2.1**).

---

## 1 — Fixed DAG (machine order)

Run **exactly** this sequence, **in order** — do not skip, reorder, or interleave with unrelated canvas `use_figma` in the same parent turn. On any `ok: false` from a slice, **stop**; do not start the next slug. **Agent phase chapter** for each row: [`phases/04-slice-cc-variants.md`](../phases/04-slice-cc-variants.md) through [`phases/10-slice-cc-doc-finalize.md`](../phases/10-slice-cc-doc-finalize.md) (one markdown file per slug).

1. `cc-variants` — variant plane (ComponentSet) — [`phases/04-slice-cc-variants.md`](../phases/04-slice-cc-variants.md)
2. `cc-doc-scaffold` — page, header, **Properties** table shell (placeholder body rows) — [`phases/05-slice-cc-doc-scaffold.md`](../phases/05-slice-cc-doc-scaffold.md)
3. `cc-doc-props` — **fill** Properties table from `CONFIG.properties` (in place) — [`phases/06-slice-cc-doc-props.md`](../phases/06-slice-cc-doc-props.md)
4. `cc-doc-component` — live ComponentSet into doc — [`phases/07-slice-cc-doc-component.md`](../phases/07-slice-cc-doc-component.md)
5. `cc-doc-matrix` — Variants × States matrix — [`phases/08-slice-cc-doc-matrix.md`](../phases/08-slice-cc-doc-matrix.md)
6. `cc-doc-usage` — Do / Don’t — [`phases/09-slice-cc-doc-usage.md`](../phases/09-slice-cc-doc-usage.md)
7. `cc-doc-finalize` — finalize + `returnPayload` for §9 — [`phases/10-slice-cc-doc-finalize.md`](../phases/10-slice-cc-doc-finalize.md)

**Seven** `use_figma` invocations for one component draw (parent default) — **one** for variants + **six** for doc (engine `create-component-engine-doc.step1` … `step6`). Optional **one** `Task` per slug only if the subagent can emit the full tool args; otherwise stay in the parent.

---

## 2 — Friendly aliases (UX / docs)

| Friendly alias (what humans say) | Machine slug (`step=` in assembly / `Task` prompt) |
|----------------------------------|----------------------------------------|
| Variant plane (ComponentSet) | `cc-variants` |
| Doc shell + table placeholders | `cc-doc-scaffold` |
| Properties table (fill from CONFIG) | `cc-doc-props` |
| Component section (reparent) | `cc-doc-component` |
| Variants × States matrix | `cc-doc-matrix` |
| Do / Don’t (usage) | `cc-doc-usage` |
| Finalize (full return) | `cc-doc-finalize` |

**Implementation note:** `cc-doc-scaffold` is `create-component-engine-doc.step1` (header + table with `…` placeholders). `cc-doc-props` is `step2` (in-place cell updates). `cc-doc-finalize` is `step6` — see [09](./09-mcp-multi-step-doc-pipeline.md) bundle table.

---

## 3 — Parent materializes per draw

Before the first slice, the parent (after Steps 1–5, 4.7) has:

- `fileKey`, `layout` (= `CONFIG.layout`), `createComponentRoot` (path to `skills/create-component/`), `configBlock` (verbatim `const CONFIG = { … };`), registry per [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) **§0**.

**`layout` filename mapping:** the committed step0 file uses `create-component-engine-<name>.step0.min.figma.js` where `<name>` is `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, or `composed` when `CONFIG.layout === '__composes__'`.

Each slice (parent assembly or optional `Task` prompt) must have: `step` (slug), `fileKey`, `layout`, `createComponentRoot`, `configBlock`, registry fields, and **`handoffJson`** (see §4) — a single JSON object string or fenced block, updated from the **previous** slice return.

---

## 4 — `handoffJson` shape (between slices)

`handoffJson` is **the parent’s** serialized state; the slice runner only **injects** it as globals. Start with the empty object **`{}` before** `cc-variants`.

**After `cc-variants` succeeds,** the parent must copy from the `use_figma` return (same fields the monolithic runner’s phase 1 uses) into `handoffJson.afterVariants` at minimum:

- `compSetId` (string) — for `__PHASE_1_COMP_SET_ID__` / handoff
- `propsAdded` (object) — for `__CC_PHASE1_PROPS_ADDED__`
- `unresolvedTokenMisses` (array) — for `__CC_PHASE1_UNRESOLVED__` (or `[]`)

**After `cc-doc-scaffold` and every subsequent doc slice,** add / refresh `handoffJson.doc` — at least `pageContentId`, `docRootId`, `compSetId` from the return payload. The **`cc-doc-props` (fill) slice and later** require the same `__CC_HANDOFF_*` doc anchors as before (from the prior return).

**Config slice:** the parent **does not** split `configBlock` per step in v1; the same verbatim `const CONFIG` is passed to every slice. If a future build introduces step-specific `CONFIG` trimming, that would be an explicit follow-up; until then, one block for all seven `use_figma` invocations.

---

## 5 — After the ladder

When `cc-doc-finalize` returns `ok: true`, run **`SKILL.md` §9** and **Step 5.2** registry on **that** return payload only (final slice; same assertions as a full inline two-phase or single-call run would surface on the last `use_figma` return).

---

## 6 — What this supersedes

- **Default** seven-slice transport: **seven** parent `use_figma` invocations (assembly per `create-component-figma-slice-runner` — this doc). **Optional** `Task` per slice only if subagent **call_mcp** can pass full `code`. Parent **inline** / **preassembled** full-engine work stays in [`EXECUTOR.md`](../EXECUTOR.md) **§0**; do **not** require `Task` when subagents cannot materialize the payload.

**Cross-refs:** [`16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) (canvas vs component slice), [`AGENTS.md`](../../../AGENTS.md) (session runbook).
