> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 08 — Draw slice `cc-doc-props-2` (second half of Properties table fill)

**Maps to:** Orchestrator DAG **#9** in [`13` §1](../conventions/13-component-draw-orchestrator.md); **same** `create-component-engine-doc.step3.min.figma.js` as phase **07** — `assemble-slice` sets row-range globals for the **second** half of rows.

**EXECUTOR:** Step **6**, **draw leg 9/12** — run **`cc-doc-props-2`**, merge, then continue to [`09-slice-cc-doc-matrix.md`](./09-slice-cc-doc-matrix.md).

**What you see in Figma after this slice:** Every body row’s five cells show **real** `PROPERTY` / `TYPE` / `DEFAULT` / `REQUIRED` / `DESCRIPTION` from `CONFIG.properties` (in-place text only; no new rows).

**Legacy:** `assemble-slice --step cc-doc-props` (not in default [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs)) omits row-range globals and fills **all** rows in one `use_figma`.

**If `ok: false`:** Stop; do not continue to [`09-slice-cc-doc-matrix.md`](./09-slice-cc-doc-matrix.md).

**Next:** [`09-slice-cc-doc-matrix.md`](./09-slice-cc-doc-matrix.md)
