# Figma remote MCP — standalone Node auth (Phase 0 spike)

**Date:** 2026-04-27  
**Scope:** Whether `tools/mcp-figma-file-proxy` can act as a **local stdio MCP** that forwards to Figma’s **Streamable HTTP** endpoint at `https://mcp.figma.com/mcp` without chaining Cursor’s built-in connector.

## Summary

- **PATs (Personal Access Tokens)** are **not** a documented, supported way to call Figma’s **remote** MCP. Public guidance centers on **OAuth** (e.g. `mcp:connect` / approved clients) for the hosted MCP, not generic third-party “bring your own PAT.”
- **Cursor and other approved hosts** hold the user’s OAuth session; a **separate** Node process does **not** get that for free. Re-implementing OAuth against Figma’s IdP (dynamic client registration, scopes, refresh) is **non-trivial** and must stay aligned with Figma’s product terms and docs.
- **Practical v1 for this repo:** the proxy accepts a **Bearer** token in **`FIGMA_MCP_ACCESS_TOKEN`**. The user obtains a valid access token the same way they would for any other **standalone** Figma API / MCP client Figma supports (e.g. remote MCP setup in an **approved** environment, or future documented non-interactive flows). If no token is available, the proxy **does not** implement a second OAuth device flow in-tree; it returns a clear error and the primary workflow remains **writer + parent `Read` + official `use_figma`** per [`AGENTS.md`](../../AGENTS.md) and [`skills/create-component/EXECUTOR.md`](../../skills/create-component/EXECUTOR.md).

## References (external)

- Figma Help: [Guide to the Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)  
- Figma Help: [Figma remote MCP — setup](https://help.figma.com/hc/en-us/articles/35281350665623-Figma-MCP-collection-How-to-set-up-the-Figma-remote-MCP-server-preferred)  
- The `@modelcontextprotocol/sdk` `StreamableHTTPClientTransport` sends `Authorization: Bearer <access_token>` when configured via `requestInit.headers` (no built-in Figma client id in this repo).

## Ping script

[`tools/mcp-figma-file-proxy/scripts/ping-upstream.mjs`](../../tools/mcp-figma-file-proxy/scripts/ping-upstream.mjs) connects to the configured upstream URL, runs MCP **initialize** + **tools/list** (or reports HTTP/MCP errors). It requires a valid **`FIGMA_MCP_ACCESS_TOKEN`** for any environment that returns **401** without a bearer.

## Outcome

- **Not deferred:** the proxy **ships** with stdio, path allowlist, `check-use-figma-mcp-args`, and HTTP forward **when** a bearer token is supplied.  
- **Explicitly not in scope for v1:** duplicating Figma’s full OAuth UX inside this package; **no** “chain into Cursor’s MCP session” path.
