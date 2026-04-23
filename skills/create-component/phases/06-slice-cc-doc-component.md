# Phase 06 — Draw slice `cc-doc-component` (live ComponentSet in doc)

**Maps to:** Orchestrator DAG **#3** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step2.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 3 of 6**.

**Parent must:** Refresh **`handoffJson.doc`** from the **previous** slice’s return before this `Task` ([`13` §4](../conventions/13-component-draw-orchestrator.md)).

**If `ok: false`:** Stop.

**Next:** [`07-slice-cc-doc-matrix.md`](./07-slice-cc-doc-matrix.md)
