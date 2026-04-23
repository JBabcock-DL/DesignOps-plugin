# Phase 07 — Draw slice `cc-doc-props` (fill **Properties** table from `CONFIG.properties`)

**Maps to:** Orchestrator DAG **#4** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step3.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 4/7** — finish this phase before [`08`](./08-slice-cc-doc-matrix.md).

**What you see in Figma after this call:** The same table structure as phase 04; each body row’s five cells now show **real** `PROPERTY` / `TYPE` / `DEFAULT` / `REQUIRED` / `DESCRIPTION` from `CONFIG.properties` (in-place text update only).

**Parent must:** Pass **`handoffJson`** with **`doc`** (including **`compSetId`** from **phase 06**) and **`afterVariants`** (from **phase 05**) — per [slice runner §3](../../create-component-figma-slice-runner/SKILL.md). Subagent bakes `__CREATE_COMPONENT_DOC_STEP__ = 3` via the min bundle.

**If `ok: false`:** Stop; do not continue to [`08-slice-cc-doc-matrix.md`](./08-slice-cc-doc-matrix.md).

**Next:** [`08-slice-cc-doc-matrix.md`](./08-slice-cc-doc-matrix.md)
