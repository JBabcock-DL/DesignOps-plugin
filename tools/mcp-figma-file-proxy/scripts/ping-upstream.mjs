#!/usr/bin/env node
/**
 * Connects to Figma remote MCP (Streamable HTTP) and lists tools.
 * Requires FIGMA_MCP_ACCESS_TOKEN (Bearer) for typical deployments.
 *
 *   FIGMA_MCP_ACCESS_TOKEN=... node tools/mcp-figma-file-proxy/scripts/ping-upstream.mjs
 *   node tools/mcp-figma-file-proxy/scripts/ping-upstream.mjs --url https://mcp.figma.com/mcp
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_UPSTREAM = 'https://mcp.figma.com/mcp';

const args = process.argv.slice(2);
let urlStr = process.env.FIGMA_MCP_UPSTREAM_URL || DEFAULT_UPSTREAM;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    urlStr = args[i + 1];
    i++;
  }
}

const token = (process.env.FIGMA_MCP_ACCESS_TOKEN || '').trim();
if (!token) {
  console.error(
    'ping-upstream: set FIGMA_MCP_ACCESS_TOKEN to a valid OAuth access token for the remote MCP (see docs/research/mcp-figma-proxy-auth-spike.md).'
  );
  process.exit(2);
}

const url = new URL(urlStr);
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});

const client = new Client(
  { name: 'designops-figma-proxy-ping', version: '1.0.0' },
  { capabilities: {} }
);

try {
  await client.connect(transport);
  const tools = await client.listTools({});
  const names = (tools.tools || []).map((t) => t.name).sort();
  console.log(
    JSON.stringify(
      { ok: true, upstream: urlStr, toolCount: names.length, tools: names },
      null,
      2
    )
  );
} catch (err) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        upstream: urlStr,
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  await client.close().catch(() => {});
}
