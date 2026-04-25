> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`.

# Phase 05 — Draw slice `cc-variants` (variant plane)

**Maps to:** Orchestrator DAG **#2** [`13` §1](../conventions/13-component-draw-orchestrator.md); [`create-component-figma-slice-runner` §2](../../create-component-figma-slice-runner/SKILL.md) row `cc-variants` → `create-component-engine-<archetype>.step0.min.figma.js`.

**EXECUTOR:** Step **6**, **draw leg 2/7** — finish this phase before [`06-slice-cc-doc-component`](./06-slice-cc-doc-component.md).

**Order:** Run **only after** [`04-slice-cc-doc-scaffold`](./04-slice-cc-doc-scaffold.md) succeeds and `handoffJson.doc` has `pageContentId` / `docRootId`. The engine **preserves** `_PageContent` while clearing stray top-level nodes and adds the hidden **`_ccVariantBuild/{component}`** staging frame. **Sequential only.**

**Parent must:** `step=cc-variants`, same `configBlock` / `layout` / `fileKey` / `createComponentRoot` / **registry** as all other slices; **`handoffJson`:** must include **`doc`** from the phase 04 merge.

**After success:** Merge return into `handoffJson` **`afterVariants`** (see [`13` §4](../conventions/13-component-draw-orchestrator.md) and slice runner **§3**).

**If `ok: false`:** **Stop** — do not start [`06-slice-cc-doc-component.md`](./06-slice-cc-doc-component.md).

**Also read:** [`09-mcp-multi-step-doc-pipeline.md`](../conventions/09-mcp-multi-step-doc-pipeline.md) **§1** (dependency order).

**Next:** [`06-slice-cc-doc-component.md`](./06-slice-cc-doc-component.md)
