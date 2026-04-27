> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 08 — Draw slice `cc-doc-matrix` (Variants × States matrix)

**Maps to:** Orchestrator DAG **#8** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step4.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 8/10** — finish this phase before [`09`](./09-slice-cc-doc-usage.md).

**Parent must:** Keep `handoffJson` chain current per [`13` §4](../conventions/13-component-draw-orchestrator.md); see [`04-doc-pipeline-contract.md`](../conventions/04-doc-pipeline-contract.md) for matrix layout rules when debugging.

**If `ok: false`:** Stop.

**Next:** [`09-slice-cc-doc-usage.md`](./09-slice-cc-doc-usage.md)
