# Phase 09 — Draw slice `cc-doc-finalize` (finalize + return payload)

**Maps to:** Orchestrator DAG **#6** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step5.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 6 of 6** (last MCP call for this component’s delegated draw).

**On `ok: true`:** The parent runs **[`SKILL.md` §9](../SKILL.md)** and registry prep for **5.2** on **this** slice’s return only — not on intermediate slices.

**If `ok: false`:** Do not claim the component “drawn”; do not run §9 as success. See [`10-closeout.md`](./10-closeout.md) only after a successful finalize.

**Next:** [`10-closeout.md`](./10-closeout.md)
