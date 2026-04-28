# Thin doc engine split (follow-on plan)

**Status:** planning only — execute after CONFIG projection ([`config-projection-map.json`](../../../scripts/config-projection-map.json)) and [`qa:assembled-size`](../../../package.json) baselines are stable.

**Goal ([`20-mcp-payload-shrink-solution`](./20-mcp-payload-shrink-solution.md) Tier 3):** separate **`build-min`** artifacts for doc-only steps (props matrix, usage, finalize) so **`STEP_ENGINE_MAP`** in [`assemble-slice`](../../../scripts/assemble-slice.mjs) can map slugs to smaller engines.

**Guards:** [`qa:step-bundles`](../../../package.json), [`qa:visual-diff`](../../../scripts/qa-visual-diff.mjs), one spot check per layout archetype before shipping.

**Non-goal:** merging canvas **`.min.mcp.js`** bundles with component engines — different release surfaces (see **`23-designops-step6-engine`** intro / AGENTS Alignment).
