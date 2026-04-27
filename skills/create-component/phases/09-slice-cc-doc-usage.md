> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 09 — Draw slice `cc-doc-usage` (Do / Don’t)

**Maps to:** Orchestrator DAG **#6** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step5.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 6/7** — finish this phase before [`10`](./10-slice-cc-doc-finalize.md).

**Parent must:** Same handoff rules as prior doc slices; no unrelated `use_figma` in the same parent turn ([`AGENTS.md`](../../../AGENTS.md) session runbook).

**If `ok: false`:** Stop.

**Next:** [`10-slice-cc-doc-finalize.md`](./10-slice-cc-doc-finalize.md)
