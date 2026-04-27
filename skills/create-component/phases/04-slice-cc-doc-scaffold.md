> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug` (default path: `dirname(handoff.json)/phase-state.json`). If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 04 — Draw slice `cc-doc-scaffold` (page, header, Properties table **shell** with placeholder rows)

**Maps to:** Orchestrator DAG **#1** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step1.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 1/7** — finish this phase before [`05-slice-cc-variants`](./05-slice-cc-variants.md).

**Order:** **Always** the **first** draw call. No variant `COMPONENT`s exist yet — the doc shell is laid down **before** `cc-variants` builds the staging frame. **`handoffJson`:** omit or **`{}`**. **Sequential only:** do not run `cc-variants` or later legs until this slice returns `ok` and `handoff.doc` is merged.

**What you see in Figma after this call:** **`_PageContent`** + `docRoot` with **header** (title, summary) and a **Properties** table at full **1640px** width. Body rows use **placeholder** copy (`…`) — one row per `CONFIG.properties.length` — with **no** table delete mid-ladder; **`cc-doc-props`** later **fills** cell `characters` in place only (see [04-doc-pipeline-contract](../conventions/04-doc-pipeline-contract.md) **§2.2.1** Path A). **Plus three dashed-outline frames** (`doc/scaffold-placeholder/…`) for **Component**, **matrix**, and **usage** — replaced when later legs run.

**Parent must:** Assemble payloads and call **`use_figma` in the parent** per [`EXECUTOR.md`](../EXECUTOR.md) **§0**. Inject globals per [slice runner §3](../../create-component-figma-slice-runner/SKILL.md) — **no** `afterVariants`, **no** `__PHASE_1_VARIANT_HOLDER_ID__` yet.

**If `ok: false`:** Stop; do not continue to [`05-slice-cc-variants.md`](./05-slice-cc-variants.md).

**Next:** [`05-slice-cc-variants.md`](./05-slice-cc-variants.md)
