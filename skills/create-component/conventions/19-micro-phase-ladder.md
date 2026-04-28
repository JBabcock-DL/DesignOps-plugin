# Micro-granular create-component phase ladder (many small `use_figma` calls)

**Goal:** Shrink each MCP payload toward [`18-mcp-payload-budget.md`](./18-mcp-payload-budget.md) (≲ **8–10 kB** UTF-8) by **splitting** one logical “step” into **many** machine slugs, each doing **one** small, idempotent change on the canvas. Total **round trips** go up; **table width and auto-layout invariants** must not regress.

**Authority:** This file does not override [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) **§2.2–2.2.1** or [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) **§1.1** — it **refines** how to add slices without tripping them.

---

## 1. Non-negotiables (layout stays stable)

1. **1640px inner width, five section order** at end of draw: header → properties → component-set-group → matrix → usage — same as [`04`](./04-doc-pipeline-contract.md) **§1–2**.
2. **No empty table bodies, no 1px-tall headers** — same failure modes as style-guide tables ([`04`](./04-doc-pipeline-contract.md) **§2.1**; [`00-gotchas`](../create-design-system/conventions/00-gotchas.md) on the canvas side when agents improvise).
3. **Properties table:** `N = CONFIG.properties.length` is known **before** the first Figma call. The **shell** must create **N placeholder body rows** (correct row/cell auto-layout, `minHeight`, `textAutoResize: 'HEIGHT'`) before [`cc-doc-props-1`](../phases/07-slice-cc-doc-props-1.md) / [`cc-doc-props-2`](../phases/08-slice-cc-doc-props-2.md) (or any micro-fill) runs — [`04`](./04-doc-pipeline-contract.md) **§2.2.1 Path A**. **Do not** “grow” the body later by appending rows if you never reserved geometry (forbidden in **§2.2.1**).
4. **In-place only for fills:** after the shell exists, **Properties** and similar tables are updated by **overwriting** placeholder text in existing cells, not by deleting the table root. **No structural redraw** mid-ladder.
5. **Scaffold and dashed reserves** must stay ahead of `cc-variants` in [`13`](./13-component-draw-orchestrator.md) **§1** — the staging frame depends on a non-collapsed page.

If a proposed micro-slice would leave an intermediate state with **no** body rows, **no** `minHeight`, or **deleting** `doc/table/.../properties` to re-add it, that slice is **invalid** for this ladder.

---

## 2. Where to split (highest leverage)

| Area | What to make tiny | Safer pattern | Risk if wrong |
|------|-------------------|---------------|----------------|
| **Scaffold — table** | One MCP per **placeholder row** or per **row pair**, after header + 1640px table chrome exist | **Append** a row with the **same** cell recipe as production; keep header row in an earlier call | Body collapses to ~9px or columns drift |
| **Scaffold — header / shell** | Title only, then summary only, or keep current sub-slugs | Tuple ops + [`op-interpreter`](./17-scaffold-sub-slice-states.md) already head this direction | Low if geometry matches shipped scaffold |
| `cc-doc-props-1` / `cc-doc-props-2` | **Half** the property rows per call (shipped two-pass) | `__ccDocFillPropertiesFromConfig` with `__CC_PROPS_ROW_*__` + same table ids in `handoffJson.doc` | Must not change row count or reorder rows |
| **`cc-doc-matrix`** | Sub-grid: one **specimen row** or one **state column** per call | Reserves in earlier call must size the matrix frame; only **place instances** in cells that already exist | Clipped or fixed-height cells; see **§0.10** in [`00-gotchas`](../create-design-system/conventions/00-gotchas.md) |
| **`cc-doc-usage`** | Do block first, then Don’t, or one bullet at a time | HORIZONTAL frames need `counterAxisSizingMode: 'AUTO'`; don’t `resize` then leave AUTO broken | Clipped Do/Don’t columns |
| **`cc-variants` / `cc-doc-component`** | Usually one plane only — split only with strong handoff (ids) | Prefer thin step0 + doc steps over splitting variants unless op pipeline proves safe | Orphaned variant ids |

**Rule of thumb:** split **“fill”** and **“instance placement”** steps (many small) before splitting **“create shell”** steps — shells define column widths and body height; they must be **correct in one or few coherent calls** per [`04`](./04-doc-pipeline-contract.md) **§2.2** (phased multi-call rules).

---

## 3. Slugging and process wiring

**Two ways to add micro-slugs (pick one per product increment):**

1. **First-class slugs in [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs)** — insert new strings between existing steps (e.g. `cc-doc-props-a`, `cc-doc-props-b`, or more descriptive names). **Merge, `pred`, `phase-state`, and `return-<slug>.json` all work** today. **Cost:** the array grows; naming must stay consistent across [`assemble-slice.mjs`](../../../scripts/assemble-slice.mjs), [`generate-ops.mjs`](../../../scripts/generate-ops.mjs), and phase markdown files under [`phases/`](../phases/00-index.md).
2. **Replace** one base step with a **sequence** of `base.part1`, `base.part2`, … (same `base` as an existing `SLUG_ORDER` name). `pred` / `isValidStepSlug` already understand this shape for **schema** and tests; **merge of multipart returns in `mergeOne` is not fully wired** — the merge script may still **refuse** `.part` merges until the [implementation checklist **§5**](#5-implementation-checklist-repo) is done. Do not rely on `.part` in production handoff **until** that lands.

**Assembly:** every new slug must map to **one** engine path in [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) **§2** (tuple ops, a `*.min.figma.js` slice, or a generated op list). Keep [`check-payload`](../../../scripts/check-payload.mjs) and [`check-use-figma-mcp-args`](../../../scripts/check-use-figma-mcp-args.mjs) green per slice.

**Handoff:** `handoffJson` stays the same contract as [`13`](./13-component-draw-orchestrator.md) **§4** — each micro-slice still returns/merges `pageContentId`, `docRootId`, and `compSetId` when applicable. Smaller steps **must not** drop ids needed by the next slice.

---

## 4. Phases folder vs machine slugs

- **Phases 01–11** in [`phases/00-index.md`](../phases/00-index.md) are the **bookkeeping** time order (install, prep, draw…). **Draw work** is further subdivided by **machine `step=` slugs** (merge + assemble), not only by one file per “conceptual” block — the props fill uses **two** phase files (**07** + **08**) for **two** `use_figma` calls.
- A **single** phase file (e.g. [`04-slice-cc-doc-scaffold.md`](../phases/04-slice-cc-doc-scaffold.md)) may describe **four** (or more) `use_figma` sub-slugs; add a **“Micro (optional)”** subsection there when a new sub-slug is introduced, instead of duplicating a whole new phase for every row.

---

## 5. Implementation checklist (repo)

When you add micro-slugs for real, touch these in order:

1. **Contract** — confirm the split satisfies **§1** of this file and **§2.2.1** of [`04`](./04-doc-pipeline-contract.md); update [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) **§1** table if the public DAG string changes.
2. **`SLUG_ORDER` / `SLUG_REPLACEMENTS` (future)** — extend [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs); for `.part` chains, a **linearized ladder** (successor of each slug) is required for `nextSlug` / `completedSlugs` / merge (multipart merge is currently **guarded** in code; extend before using `.part` in real merges).
3. **`assemble-slice --step …`** — map new slugs to CONFIG + handoff + engine in [`scripts/assemble-slice.mjs`](../../../scripts/assemble-slice.mjs) and any [`generate-ops`](../../../scripts/generate-ops.mjs) json.
4. **Templates** — new or slivered `*.min.figma.js` / op tuples; run `npm run build:min` and keep `npm run verify` green.
5. **QA** — [`qa:merge-consistency`](../../../package.json), [`qa:step-bundles`](../../../package.json), [`qa:op-part-slugs`](../../../scripts/qa-op-part-slugs.mjs) after merge changes.
6. **Docs** — `COMPOSER.md`, this file, and [`12-sigma-budget-mcp.md`](./12-sigma-budget-mcp.md) if σ strategy shifts.

---

## 6. Related

- [`18-mcp-payload-budget.md`](./18-mcp-payload-budget.md) — 8–10 kB target  
- [`12-sigma-budget-mcp.md`](./12-sigma-budget-mcp.md) — total bytes across all calls (σ) when splitting engines  
- [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) — DAG, handoff, merge  
- [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) — table / matrix invariants
