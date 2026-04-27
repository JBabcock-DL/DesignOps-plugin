> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug` (default path: `dirname(handoff.json)/phase-state.json`). If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 04 — Draw scaffold (four `use_figma` sub-slices: shell → header → table → placeholders)

**Maps to:** Orchestrator DAG **#1–4** in [`13` §1](../conventions/13-component-draw-orchestrator.md) — `cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders` — using tuple ops + [`op-interpreter.min.figma.js`](../templates/op-interpreter.min.figma.js) via `assemble-slice` (default) / [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md) **§0.1**. Intermediate Figma state after each sub-slice: [`17-scaffold-sub-slice-states`](../conventions/17-scaffold-sub-slice-states.md). Together these replace the legacy single `create-component-engine-doc.step1` min bundle.

**EXECUTOR:** Step **6**, **draw legs 1–4/10** — finish **all four** sub-slices before [`05-slice-cc-variants`](./05-slice-cc-variants.md).

**Per sub-slice order:** 1) `cc-doc-scaffold-shell` — **`handoffJson`:** omit or **`{}`**. 2) `cc-doc-scaffold-header` — handoff has `doc.pageContentId` + `docRootId` (merged after shell). 3) `cc-doc-scaffold-table` — same. 4) `cc-doc-scaffold-placeholders` — same. **Sequential only:** do not run `cc-variants` until **4** is merged and `nextSlug` is `cc-variants`.

**What you see in Figma after `cc-doc-scaffold-placeholders`:** Same as the legacy monolithic step1: **`_PageContent`** + `docRoot` with **header** (title, summary), **Properties** table at full **1640px** with placeholder body rows, and **three dashed-outline frames** for later legs — then [`cc-doc-props`](../conventions/04-doc-pipeline-contract.md) **§2.2.1** Path A.

**Parent must:** Assemble and call **`use_figma` in the parent** per [`EXECUTOR.md`](../EXECUTOR.md) **§0** four times, merging `handoff.json` after each. First slice: **no** `__CC_HANDOFF_*` globals; continuation slices: **`__CC_HANDOFF_PAGE_CONTENT_ID__`** + **`__CC_HANDOFF_DOC_ROOT_ID__`** (see [assemble-slice `buildVarGlobals`](../../../scripts/assemble-slice.mjs)).

**If any sub-slice returns `ok: false`:** Stop; do not continue.

**Next:** [`05-slice-cc-variants.md`](./05-slice-cc-variants.md)
