# Phase 05 — Draw slice `cc-doc-props` (page, header, Properties table)

**Maps to:** Orchestrator DAG **#2** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step1.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 2 of 6**.

**Parent must:** Pass **`handoffJson`** including **`afterVariants`** from phase 04 return; inject doc globals per [slice runner §3](../../create-component-figma-slice-runner/SKILL.md). Subagent assembles `__CREATE_COMPONENT_PHASE__ = 2` and phase-1 ids from `afterVariants`.

**If `ok: false`:** Stop; do not continue to [`06-slice-cc-doc-component.md`](./06-slice-cc-doc-component.md).

**Next:** [`06-slice-cc-doc-component.md`](./06-slice-cc-doc-component.md)
