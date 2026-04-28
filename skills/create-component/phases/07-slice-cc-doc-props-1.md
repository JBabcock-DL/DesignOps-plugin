> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 07 — Draw slice `cc-doc-props-1` (first half of Properties table fill)

**Maps to:** Orchestrator DAG **#8** in [`13` §1](../conventions/13-component-draw-orchestrator.md); **same** min file as `cc-doc-props-2` — [`create-component-engine-doc.step3.min.figma.js`](../templates/create-component-engine-doc.step3.min.figma.js). `assemble-slice` sets **`__CC_PROPS_ROW_START__` / `__CC_PROPS_ROW_END__`** to the first half of `CONFIG.properties` rows.

**EXECUTOR:** Step **6**, **draw leg 8/12** — run **`cc-doc-props-1`**, merge `handoff.json`, then continue to [`08-slice-cc-doc-props-2.md`](./08-slice-cc-doc-props-2.md).

**What you see in Figma after this slice:** The same table as phase 04; **roughly the first half** of body rows now show real `CONFIG.properties` cell text (in-place updates only).

**Parent must:** Pass **`handoffJson`** with **`doc`** (including **`compSetId`** from **phase 06**). The committed min bundle uses **`__CREATE_COMPONENT_DOC_STEP__ = 3`**.

**If `ok: false`:** Stop; do not run **`cc-doc-props-2`** or open [`08`](./08-slice-cc-doc-props-2.md).

**Next:** [`08-slice-cc-doc-props-2.md`](./08-slice-cc-doc-props-2.md)
