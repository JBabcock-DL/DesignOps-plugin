> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 06 — Draw slice `cc-doc-component` (live ComponentSet in doc)

**Maps to:** Orchestrator DAG **#6** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step2.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 6/10** — finish this phase before [`07`](./07-slice-cc-doc-props.md).

**What this slice does:** Runs **`combineAsVariants`** from the phase-1 staging frame into the doc **Component** section (replacing the dashed placeholder). The merged return includes **`compSetId`** — parent must merge it into `handoff.doc` for props / matrix / usage / finalize slices.

**Parent must:** Pass **`handoffJson`** with **`doc`** (from **phase 04**) and **`afterVariants`** (from **phase 05**). Refresh **`handoffJson.doc`** from the **previous** slice’s return ([`13` §4](../conventions/13-component-draw-orchestrator.md)). Subagent bakes `__CREATE_COMPONENT_DOC_STEP__ = 2` via the min bundle.

**If `ok: false`:** Stop; do not continue to [`07-slice-cc-doc-props.md`](./07-slice-cc-doc-props.md).

**Next:** [`07-slice-cc-doc-props.md`](./07-slice-cc-doc-props.md)
