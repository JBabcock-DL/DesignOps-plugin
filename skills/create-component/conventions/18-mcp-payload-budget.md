# Per-call `use_figma` payload budget (8–10 kB north star)

**Intent:** Prefer **one small** plugin `code` string per `use_figma` so **parent** `Read` + `call_mcp` through the **IDE’s Figma MCP** stays under typical model/host JSON limits. Favor **many** fast rounds, each time adding **one** coherent chunk of structure or chrome on the canvas, over a single heavy call.

**Design target (not a Figma cap):** Assembled `code` for one slice, and the full MCP tool `arguments` object UTF-8 size, in the **8–10 kB** range per round trip where practical. Figma’s tool schema may allow up to **50 000** characters of `code`; the **8–10 kB** number is a **DesignOps** stability target, not a server maximum.

**How to move toward the target (in priority order):**

0. **`SLUG_ORDER` + split hot spots** — the shipped ladder (`merge-create-component-handoff.mjs`) is already granular (five scaffold sub-slugs before variants); when one step stays too large, add **`.partN`** sub-slugs (merge supports `.part*` when the base slug exists) — see **[`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md)** — or trim engines in **`build-min-templates.mjs`**.
1. **More machine work in the fixed DAG** — when a base step is still too large, add **sub-slugs** (e.g. `cc-doc-matrix.part2`) or split doc engines in [`build-min-templates.mjs`](../../../scripts/build-min-templates.mjs).
2. **Tuple / op pipeline** — [`scripts/generate-ops.mjs`](../../../scripts/generate-ops.mjs) + **[`templates/op-interpreter.figma.js`](../templates/op-interpreter.figma.js)**: small shared runtime + JSON ops instead of inlining a full `*.min.figma.js` for every scaffold sub-step.
3. **Engine partition (σ)** — shared `draw-engine` work split so the **sum** of bytes across calls does not each re-embed a full monolith; run [`npm run measure-sigma`](../../../package.json) and keep preamble once or thin bundles (σ policy: **[`AGENTS.md`](../../../AGENTS.md)** *MCP transport*).
4. **Row / cell granularity** — without breaking table geometry, per [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md) (shell + N placeholders first; in-place fills after).
5. **Single supported transport** — only **parent** `call_mcp` with official Figma MCP in the host. There is no separate “invoke from file” path in this repo; do not route `use_figma` through a custom Node client expecting Desktop OAuth parity with Cursor.

**Preflight (always):** [`scripts/check-payload.mjs`](../../../scripts/check-payload.mjs), [`scripts/check-use-figma-mcp-args.mjs`](../../../scripts/check-use-figma-mcp-args.mjs) on the exact bytes; [`npm run qa:step-bundles`](../../../package.json) for informational bundle sizes on CI.

**Related:** [`EXECUTOR.md`](../EXECUTOR.md) §0, [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md), [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md), [`08-cursor-composer-mcp.md`](./08-cursor-composer-mcp.md), [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md).
