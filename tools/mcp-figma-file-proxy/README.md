# `designops-figma-proxy` (local stdio MCP)

**Optional** local Model Context Protocol server: one tool, **`use_figma_from_mcp_args_file`**, that accepts a **path** to a JSON file, validates with [`../../scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs), and forwards the parsed object to Figma’s **remote** Streamable HTTP MCP (`use_figma`).

This is a **separate** MCP from Cursor’s (or any IDE’s) built-in Figma connector. It does **not** chain into Cursor’s OAuth session; you must supply a **Bearer** token the proxy can use against `https://mcp.figma.com/mcp` (see [`../../docs/research/mcp-figma-proxy-auth-spike.md`](../../docs/research/mcp-figma-proxy-auth-spike.md)).

## When to use

- The **default** path remains **parent** (or design-repo script) → inline official `use_figma` on the Figma MCP your IDE already loads — per [`AGENTS.md`](../../AGENTS.md) and [`skills/create-component/EXECUTOR.md`](../../skills/create-component/EXECUTOR.md).
- Use this proxy when the model must pass only a **short** tool argument (a filesystem path) while the **full** `mcp-*.json` from `assemble-slice --emit-mcp-args` already exists on an **allowed** path (typically the **design / consumer** repo).

## Install (Cursor / Claude Code)

1. `npm install` inside `tools/mcp-figma-file-proxy/` (this folder is its own small package).
2. Register the server in the host’s MCP config. Example (Cursor) — project `.cursor/mcp.json` (paths must be **absolute** on your machine):

```json
{
  "mcpServers": {
    "designops-figma-proxy": {
      "command": "node",
      "args": [
        "C:/path/to/DesignOps-plugin/tools/mcp-figma-file-proxy/src/server.mjs"
      ],
      "env": {
        "FIGMA_MCP_ACCESS_TOKEN": "",
        "FIGMA_MCP_READ_ROOTS": "C:/path/to/your-design-repo;C:/path/to/DesignOps-plugin",
        "FIGMA_MCP_WORKSPACE_ROOT": "C:/path/to/your-design-repo"
      }
    }
  }
}
```

- **`FIGMA_MCP_ACCESS_TOKEN`** — required for upstream; obtain per Figma’s remote MCP / OAuth story (spike doc above). Do **not** commit real values; use env or host secret storage.
- **`FIGMA_MCP_READ_ROOTS`** — list of allowed directories (use `;` on Windows, `:` on macOS/Linux — same as `path.delimiter`).
- **`FIGMA_MCP_WORKSPACE_ROOT`** — optional extra root (always allowed in addition to `READ_ROOTS`).

**Coexistence:** Keep the **official** Figma MCP (e.g. `plugin-figma-figma` in this repo’s `mcps/`) for small inline `code` calls. This proxy only implements **`use_figma` forwarding** — not `get_metadata`, Code Connect, etc.

## Tool contract

- **`use_figma_from_mcp_args_file`**
  - **`mcpArgsPath`** (string): path to JSON whose **top-level** shape is the `use_figma` **arguments** object (`fileKey`, `code`, `description`, optional `skillNames`), e.g. output of `--emit-mcp-args`.

The file must pass `check-use-figma-mcp-args` and resolve under the configured roots (symlinks resolved; path traversal outside roots rejected).

## Scripts

- **`npm run start`** (or `npm run mcp:figma-proxy` from the **DesignOps repo root**) — run the stdio server.
- **`npm run ping-upstream`** — `scripts/ping-upstream.mjs` — verify token + `tools/list` against the upstream URL.
- **`npm test`** — unit tests (paths + mock forward).

## Security

- The proxy can read any path under the allowlist and POST to Figma. Run **locally**, restrict roots, and never commit tokens.
- Debug logging: set `DEBUG=figma-mcp-proxy` to log path hash (8 hex chars) and file size on stderr — not file contents.

## Limitations

- **No** gzip/base64 or `DecompressionStream` handling here — the forwarded JSON is the same as inline `use_figma` would receive.
- **No** “use Cursor’s Figma session” — standalone token only.

## Related

- [`../../docs/mcp-transport-cursor-fallback.md`](../../docs/mcp-transport-cursor-fallback.md)
- [`../../docs/research/mcp-transport-solution-architecture-2026.md`](../../docs/research/mcp-transport-solution-architecture-2026.md) (Tier 4)
- [`../../AGENTS.md`](../../AGENTS.md)
