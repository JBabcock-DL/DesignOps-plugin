# Cursor — large `use_figma` transport fallback

When `call_mcp` / `use_figma` fails with **JSON parse / truncated** errors (or the model cannot materialize one full tool call), use this order. Full research: [`docs/research/mcp-large-payload-transport-2026.md`](research/mcp-large-payload-transport-2026.md).

1. **Validate on disk** — `npm run check-payload -- <assembled.js>` and `npm run check-use-figma-args -- <mcp-args.json>` (or pipe the exact JSON you will send). A passing check does not prove the **host** did not truncate the wrapper; it rules out obvious string/JSON errors.

2. **Parent path** — `Read` the committed or design-repo file (full file, no shell `cat` of huge blobs), one `use_figma` per slice. Do not add throwaway payload-only files under `skills/` per [`AGENTS.md`](../AGENTS.md).

2b. **Optional — local file-proxy path** — After writer + parent (or Composer) is exhausted, if the user has installed [`tools/mcp-figma-file-proxy`](../tools/mcp-figma-file-proxy/README.md) and configured `FIGMA_MCP_READ_ROOTS` + `FIGMA_MCP_ACCESS_TOKEN`, one **`use_figma_from_mcp_args_file`** call with `mcpArgsPath` to the on-disk `mcp-*.json` can pass the same bytes without pasting the full `code` in chat. This is a **separate** MCP from the IDE’s Figma connector.

3. **Probe** — `node scripts/probe-parent-transport.mjs --size 25000 --out <draw-dir>/probe-args.json` then parent `Read` + one `call_mcp` with the same object; on success, `node scripts/probe-parent-transport.mjs --record --size 25000 --observed-bytes <N> --target <draw-dir>`. Cite `maxProvenSize` in run reports; do not invent a parent limit below it.

4. **Escalation** — shorter context for the Figma **turn** only, new chat, or a longer-context model for the parent `use_figma` step (same bytes, different envelope budget).

5. **No gzip by default** — unless the Figma plugin environment is proven to run your decoder and [`AGENTS.md`](../AGENTS.md) is updated, do not add gzip+base64 to [`scripts/assemble-slice.mjs`](../scripts/assemble-slice.mjs) defaults.

6. **Optional** — the local file-reading MCP in [`tools/mcp-figma-file-proxy`](../tools/mcp-figma-file-proxy/README.md) (see **2b** above) forwards `use_figma` from disk; it is **not** wired to Cursor’s built-in Figma OAuth — supply your own bearer token to the proxy.

**Ownership:** MCP server entries stay in the developer’s `.cursor/mcp.json` (or project `.cursor/mcp.json`); do not commit tokens.
