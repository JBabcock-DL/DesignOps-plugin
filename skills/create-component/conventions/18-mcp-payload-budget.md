# Per-call `use_figma` payload budget (8–10 kB north star)

**Intent:** Prefer **one small** plugin `code` string per `use_figma` so **parent** `Read` + `call_mcp` through the **IDE’s Figma MCP** stays under typical model/host JSON limits. Favor **many** fast rounds, each time adding **one** coherent chunk of structure or chrome on the canvas, over a single heavy call.

**Design target (not a Figma cap):** Assembled `code` for one slice, and the full MCP tool `arguments` object UTF-8 size, in the **8–10 kB** range per round trip where practical. Figma’s tool schema may allow up to **50 000** characters of `code`; the **8–10 kB** number is a **DesignOps** stability target, not a server maximum.

**How to move toward the target (in priority order):**

0. **Execution plan** — [`20-mcp-payload-shrink-solution.md`](./20-mcp-payload-shrink-solution.md) (tiers: baselines, CONFIG projection, engine split, ops, registry). Deeper key analysis: [`10-phased-payload-research.md`](./10-phased-payload-research.md).
1. **More machine work in the fixed DAG** — the ladder already includes five scaffold sub-slugs before variants; when a base step is still too large, add **sub-slugs** (e.g. `cc-doc-matrix.part2` — see [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) and merge’s `.partN` support) or split doc engines in [`build-min-templates.mjs`](../../../scripts/build-min-templates.mjs) so each compile stays thin.
2. **Tuple / op pipeline** for scaffold (and any future steps that fit) — [`generate-ops` / `op-interpreter`](./17-scaffold-sub-slice-states.md): small shared runtime + JSON ops instead of inlining a full `*.min.figma.js` for every sub-step.
3. **True engine partition** — shared `draw-engine` work split so **sum of bytes ≈ one monolith** across calls, not six near-full doc bundles; see [`12-sigma-budget-mcp.md`](./12-sigma-budget-mcp.md) (preamble once or thin, disjoint bundles).
4. **Row / cell granularity** — without breaking table geometry, per [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md) (shell + N placeholders first; in-place fills after).
5. **Single supported transport** — only **parent** `call_mcp` with official Figma MCP in the host. There is no separate “invoke from file” path in this repo; do not route `use_figma` through a custom Node client expecting Desktop OAuth parity with Cursor.

**Preflight (always):** [`scripts/check-payload.mjs`](../../../scripts/check-payload.mjs), [`scripts/check-use-figma-mcp-args.mjs`](../../../scripts/check-use-figma-mcp-args.mjs) on the exact bytes; [`npm run qa:step-bundles`](../../../package.json) for informational bundle sizes on CI.

**Related:** [`EXECUTOR.md`](../EXECUTOR.md) §0, [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md), [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md), [`08-cursor-composer-mcp.md`](./08-cursor-composer-mcp.md), [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md), [`20-mcp-payload-shrink-solution.md`](./20-mcp-payload-shrink-solution.md).
