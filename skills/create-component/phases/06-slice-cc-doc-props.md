# Phase 06 — Draw slice `cc-doc-props` (fill **Properties** table from `CONFIG.properties`)

**Maps to:** Orchestrator DAG **#3** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step2.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 3 of 7**.

**What you see in Figma after this call:** The same table structure as phase 05; each body row’s five cells now show **real** `PROPERTY` / `TYPE` / `DEFAULT` / `REQUIRED` / `DESCRIPTION` from `CONFIG.properties` (in-place text update only).

**Parent must:** Pass **`handoffJson`** with **`afterVariants`** and **`doc`** (`pageContentId`, `docRootId`, `compSetId` from the **phase 05** return) per [slice runner §3](../../create-component-figma-slice-runner/SKILL.md). Subagent bakes `__CREATE_COMPONENT_DOC_STEP__ = 2` via the min bundle.

**If `ok: false`:** Stop; do not continue to [`07-slice-cc-doc-component.md`](./07-slice-cc-doc-component.md).

**Next:** [`07-slice-cc-doc-component.md`](./07-slice-cc-doc-component.md)
