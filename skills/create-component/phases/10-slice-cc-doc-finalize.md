> **Resume from `phase-state.json`:** read [`13` §4](../conventions/13-component-draw-orchestrator.md); use on-disk `handoff.json` and `nextSlug`. If using `Task` for Step 6, **one `Task` per machine slug** only; the **parent** merges `handoff.json` between tasks ([`13` §5.1](../conventions/13-component-draw-orchestrator.md)).

# Phase 10 — Finalize draw + closeout (last `use_figma`, then §9 / registry / reporting)

**Rule:** Complete **Part A** (the MCP slice) to `ok: true` and merge handoff if needed, **then** complete **Part B** in the same phase — do not start another component or skip to reporting until both parts are done.

---

## Part A — Draw slice `cc-doc-finalize`

**Maps to:** Orchestrator DAG **#7** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step6.min.figma.js`.

**EXECUTOR:** Step **6**, **leg 7 of 7** (last MCP call for this component’s delegated draw).

**On `ok: true`:** Continue to **Part B** below on **this** slice’s return only — not on intermediate slices.

**If `ok: false`:** Do not claim the component “drawn”; do not run §9 as success.

**Previous draw leg:** [`09-slice-cc-doc-usage.md`](./09-slice-cc-doc-usage.md)

---

## Part B — Closeout (EXECUTOR step 7)

**Maps to:** [`EXECUTOR.md`](../EXECUTOR.md) step **7**; [`SKILL.md`](../SKILL.md) **§9**, **5.2**, **§8** reporting table.

**Authority:** `SKILL.md` §9 for full assertions; [`EXECUTOR.md`](../EXECUTOR.md) **§0.2** for abbreviated self-check; [`resolver/merge-registry.mjs`](../resolver/merge-registry.mjs) for **5.2** merge pattern.

**You are here when:** Part A returned `ok: true` and you have the final return payload.

**Exit when:** §9 checks pass; `.designops-registry.json` updated per 5.2 where applicable; run summary table in SKILL **§8** is filled honestly.

**Inline / preassembled only:** If the draw never used seven slice `Task`s, closeout still applies the same **§9** / **5.2** / **§8** rules to the final successful `use_figma` return — see [`EXECUTOR.md`](../EXECUTOR.md) **§0** fallbacks 2a / 2b.

**`phase-state.json` and merge integrity:** Set **`nextSlug: null`** and a **full** `completedSlugs` list **only** if [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs) ran successfully for **all seven** machine slugs in DAG order. If intermediate merges were skipped, **do not** manually mark a complete ladder; **do not** hand-fill `lastCodeSha256` with a placeholder to “look done.” A truthful record shows `nextSlug` at the first missing merge or a partial `completedSlugs`. The merge script (not prose) is the source of `lastCodeSha256` for each step.

**Done:** This component’s phased run is complete.
