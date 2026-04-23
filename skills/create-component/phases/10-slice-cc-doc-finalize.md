# Phase 10 — Draw slice `cc-doc-finalize` (finalize + return payload)

**Maps to:** Orchestrator DAG **#7** [`13` §1](../conventions/13-component-draw-orchestrator.md); slice runner [**§2**](../../create-component-figma-slice-runner/SKILL.md) → `create-component-engine-doc.step6.min.figma.js`.

**EXECUTOR:** Step **6**, **slice 7 of 7** (last MCP call for this component’s delegated draw).

**On `ok: true`:** The parent runs **[`SKILL.md` §9](../SKILL.md)** and registry prep for **5.2** on **this** slice’s return only — not on intermediate slices.

**If `ok: false`:** Do not claim the component “drawn”; do not run §9 as success. See [`11-closeout.md`](./11-closeout.md) only after a successful finalize.

**Next:** [`11-closeout.md`](./11-closeout.md)
