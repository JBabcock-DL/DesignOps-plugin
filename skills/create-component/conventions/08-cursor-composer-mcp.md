# Cursor / Composer-class hosts — Step 6 MCP transport (short form)

**Canon:** [`AGENTS.md`](../../../AGENTS.md) (MCP payloads, session runbook), [`EXECUTOR.md`](../EXECUTOR.md) **§0**, [`13-component-draw-orchestrator`](./13-component-draw-orchestrator.md) (`SLUG_ORDER`), [`21-mcp-ephemeral-payload-protocol`](./21-mcp-ephemeral-payload-protocol.md), [`23-designops-step6-engine`](./23-designops-step6-engine.md) (disk-only manifest via `npm run designops:step6:prepare`).

**Rule:** **12** parent **`use_figma`** calls in merge order (currently **`SLUG_ORDER.length`** in [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs)) — **not** a `Task` subagent emitting full ~26–30K+ `call_mcp` JSON unless the host is **proven**.

**Writer pattern (D.1):** Subagent may **assemble + `check-payload` + write** to the **design repo**; **parent** **`Read`** → **one** `use_figma`. Do not use a subagent as the default **runner** for oversized inline tool args.

**Symptom ladder:** `Unexpected end of JSON` → truncation / invalid wrapper JSON (not Figma). `ok: false` from Figma → [`merge-create-component-handoff`](../../../scripts/merge-create-component-handoff.mjs) exit **19**; fix `why` / `remediation` before advancing `phase-state`.

**Cross-refs:** [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md); [`docs/mcp-transport-cursor-fallback.md`](../../../docs/mcp-transport-cursor-fallback.md).
