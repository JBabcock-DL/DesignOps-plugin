# Phase 04 — Draw slice `cc-variants` (variant plane)

**Maps to:** Orchestrator DAG **#1** [`13` §1](../conventions/13-component-draw-orchestrator.md); [`create-component-figma-slice-runner` §2](../../create-component-figma-slice-runner/SKILL.md) row `cc-variants` → `create-component-engine-<archetype>.step0.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 1 of 7** (same logical Step 6 as phases 05–10).

**Parent must:** Emit one `Task` → [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md) with `step=cc-variants`, same `configBlock` / `layout` / `fileKey` / `createComponentRoot` / **registry** as all later slices; **`handoffJson`:** omit or **`{}`** before this slice.

**After success:** Merge return into next `handoffJson` (at least `afterVariants` / phase-1 ids per [`13` §4](../conventions/13-component-draw-orchestrator.md) and slice **§3**).

**If `ok: false`:** **Stop** — do not start [`05-slice-cc-doc-scaffold.md`](./05-slice-cc-doc-scaffold.md).

**Also read:** [`09-mcp-multi-step-doc-pipeline.md`](../conventions/09-mcp-multi-step-doc-pipeline.md) **§1** (dependency order).

**Next:** [`05-slice-cc-doc-scaffold.md`](./05-slice-cc-doc-scaffold.md)
