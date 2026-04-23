# Phase 05 — Draw slice `cc-doc-scaffold` (page, header, Properties table **shell** with placeholder rows)

**Maps to:** Orchestrator DAG **#2** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step1.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 2 of 7** (same logical Step 6 as phases 05–10).

**What you see in Figma after this call:** `_PageContent` + `docRoot` with **header** (title, summary) and a **Properties** table at full **1640px** width. Body rows use **placeholder** copy (`…`) — one row per `CONFIG.properties.length` — with **no** table delete in the next slice; the following slice only **fills** cell `characters` in place (see [04](../conventions/04-doc-pipeline-contract.md) **§2.2.1** Path B).

**Parent must:** Pass **`handoffJson`** including **`afterVariants`** from phase 04 return; inject doc globals per [slice runner §3](../../create-component-figma-slice-runner/SKILL.md) (`__CREATE_COMPONENT_PHASE__ = 2` and phase-1 ids from `afterVariants` — no `__CC_HANDOFF_*` yet).

**If `ok: false`:** Stop; do not continue to [`06-slice-cc-doc-props.md`](./06-slice-cc-doc-props.md).

**Next:** [`06-slice-cc-doc-props.md`](./06-slice-cc-doc-props.md)
