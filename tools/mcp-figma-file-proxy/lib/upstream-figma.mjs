import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_UPSTREAM = 'https://mcp.figma.com/mcp';

let _client = null;

/** @param {import('node:process').Env} [env] */
export function getUpstreamConfig(env = process.env) {
  const urlStr = (env.FIGMA_MCP_UPSTREAM_URL || DEFAULT_UPSTREAM).trim();
  const token = (env.FIGMA_MCP_ACCESS_TOKEN || '').trim();
  return { url: new URL(urlStr), urlStr, token };
}

/**
 * @param {import('node:process').Env} [env]
 * @param {{ reset?: () => void; create?: () => Promise<import('@modelcontextprotocol/sdk/client/index.js').Client> }} [inject] tests only
 */
export async function getFigmaMcpClient(env = process.env, inject) {
  if (inject?.create) {
    return await inject.create();
  }
  if (_client) return _client;
  const { url, token } = getUpstreamConfig(env);
  if (!token) {
    const err = new Error(
      'FIGMA_MCP_ACCESS_TOKEN is not set — cannot forward to Figma remote MCP'
    );
    err.code = 'E_AUTH';
    throw err;
  }
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client(
    { name: 'designops-figma-file-proxy', version: '1.0.0' },
    { capabilities: {} }
  );
  await client.connect(transport);
  _client = client;
  return _client;
}

export function resetFigmaMcpClientForTests() {
  _client = null;
}

/**
 * @param {Record<string, unknown>} useFigmaArgs
 * @param {import('node:process').Env} [env]
 * @param {{ create?: () => Promise<import('@modelcontextprotocol/sdk/client/index.js').Client> }} [inject]
 */
export async function forwardUseFigma(useFigmaArgs, env, inject) {
  const client = await getFigmaMcpClient(env, inject);
  if (!client || typeof client.callTool !== 'function') {
    throw new Error('invalid upstream client');
  }
  return client.callTool({ name: 'use_figma', arguments: useFigmaArgs });
}
