# Buildable path: large `use_figma` without embedding `code` in the agent

You do **not** have to wait for Figma to add `codeFile` to the shipping `use_figma` schema or for Cursor to hydrate tool args — **if** you can send MCP messages from **your own Node process** that reads the payload from disk. That moves the huge string out of the **model message** and off the **IDE `call_mcp` path**.

## What blocks “any random script → Figma”

- **Remote MCP** (`https://mcp.figma.com/mcp`): uses **OAuth**. Figma’s docs currently position **catalog clients** (Cursor, Claude Code, VS Code, …) for that flow; custom clients may need their **own** OAuth registration ([waitlist language](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) as of 2026). A bare `fetch` with a **PAT** is **not** a drop-in substitute for the remote MCP `use_figma` path.
- **This repo’s removed proxy** (`tools/mcp-figma-file-proxy`): forwarded to remote MCP without Cursor’s session → **no token**.

So: **remote** “we built it ourselves” usually means **Figma-approved OAuth for your app** — still vendor coordination, but **your** client, not “wait for `codeFile`”.

## What you can ship today: **Figma Desktop MCP URL**

[Figma Desktop can run a local MCP server](https://help.figma.com/hc/en-us/articles/35281186390679-Desktop-Figma-MCP-server-installation) (Dev Mode → enable MCP → **copy URL**). That URL is meant for editors, but it is still **HTTP MCP** on your machine.

**DesignOps ships:** [`scripts/figma-mcp-invoke-from-file.mjs`](../scripts/figma-mcp-invoke-from-file.mjs) (`npm run figma:mcp-invoke`) — `--dry-run`, `--help`, optional `--tool-name`; reads JSON from disk and calls `use_figma` via [`@modelcontextprotocol/sdk` Streamable HTTP client](https://www.npmjs.com/package/@modelcontextprotocol/sdk). CI: `npm run qa:figma-mcp-invoke`.

### Operator flow

1. **Figma Desktop** — open file, Dev Mode, **enable MCP**, copy server URL.
2. **Assemble** (as today) — `assemble-slice ... --emit-mcp-args draw/mcp-<slug>.json` (canonical name); validate with `npm run check-use-figma-args` if needed.
3. **Preflight (optional, no Figma open):** `npm run figma:mcp-invoke -- --dry-run --file path/to/mcp-cc-doc-props.json` — runs `check-use-figma-mcp-args` on the same bytes you would send.
4. **Invoke (short shell line — no giant chat payload):**
   ```bash
   npm run figma:mcp-invoke -- --help
   FIGMA_DESKTOP_MCP_URL="paste-url-here" npm run figma:mcp-invoke -- --file path/to/mcp-cc-doc-props.json
   ```
5. An **agent** can be instructed to run **only** that command (argv stays short); the **process** reads the full `code`.

### Caveats (read before relying on it)

- **Org / plan:** Desktop MCP is described for **some org and enterprise** setups; remote MCP is the default recommendation. Confirm your seat/plan exposes the local server.
- **Auth / transport:** If connect fails, the desktop URL may require headers or a transport variant your Figma version documents — treat this as a **supported spike**, not a guaranteed matrix.
- **Tool name:** Defaults to `use_figma`; override with `--tool-name` if your MCP catalog names it differently.
- **Remote URL in env:** Pointing the same script at `https://mcp.figma.com/mcp` will typically fail until you wire an **OAuth client provider** (SDK supports `authProvider` on `StreamableHTTPClientTransport`).

## Fully in-repo (no Figma MCP at all)

- **Smaller `code` per call:** op-interpreter, tuple compression, more granular slices — see [`mcp-transport-solution-architecture-2026.md`](mcp-transport-solution-architecture-2026.md) section 6.0.
- **Writer + parent `Read` + `use_figma`:** still uses the IDE tool for the final hop, but avoids subagent emission bugs — [`AGENTS.md`](../AGENTS.md), [`08`](../skills/create-component/conventions/08-cursor-composer-mcp.md) D.1.

## Summary

| Approach | Waits on Figma/Cursor schema? | Who reads the big `code` string? |
|----------|------------------------------|-----------------------------------|
| Desktop MCP URL + **`figma:mcp-invoke`** | No (uses shipped desktop server) | Node (this script) |
| Remote MCP + custom OAuth client | Figma OAuth / catalog policy | Your app |
| Smaller slices / op pipeline | No | Same as today |

Canonical policy and anti-spiral rules: [`memory.md`](../memory.md), [`AGENTS.md`](../AGENTS.md). Transport research: [`mcp-transport-solution-architecture-2026.md`](mcp-transport-solution-architecture-2026.md) sections 6.7–6.8.
