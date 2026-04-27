import { readFile, stat } from 'node:fs/promises';
import crypto from 'node:crypto';
import { getAllowRootsFromEnv, resolveAllowedMcpArgsFile } from './read-roots.mjs';
import { runCheckUseFigmaMcpArgs } from './check-script.mjs';
import { forwardUseFigma } from './upstream-figma.mjs';

const debug = () =>
  process.env.DEBUG === 'figma-mcp-proxy' || process.env.DEBUG === '1';

function logDebug(msg, extra) {
  if (!debug()) return;
  const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
  // stderr only — stdio MCP uses stdout for JSON-RPC
  console.error(`[designops-figma-proxy] ${line}`);
}

/**
 * @param {{ mcpArgsPath: string }} input
 * @param {{ env?: import('node:process').Env; inject?: { create: () => Promise<unknown> } }} [options]
 */
export async function runUseFigmaFromMcpArgsFile(input, options = {}) {
  const env = options.env || process.env;
  const { inject } = options;

  const allowRoots = getAllowRootsFromEnv(env);
  let realPath;
  try {
    const resolved = await resolveAllowedMcpArgsFile(input.mcpArgsPath, { allowRoots });
    realPath = resolved.realPath;
  } catch (e) {
    return {
      content: [
        { type: 'text', text: (e && typeof e === 'object' && 'message' in e && e.message) || String(e) },
      ],
      isError: true,
    };
  }

  try {
    const s = await stat(realPath);
    const h = crypto.createHash('sha256').update(realPath).digest('hex').slice(0, 8);
    logDebug('mcp args file', { realPath, sizeBytes: s.size, pathHash8: h });
  } catch {
    // ignore
  }

  const check = runCheckUseFigmaMcpArgs(realPath, {});
  if (!check.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `check-use-figma-mcp-args failed (exit ${check.code}): ${(check.stderr && check.stderr.trim()) || 'unknown'}`,
        },
      ],
      isError: true,
    };
  }

  let parsed;
  try {
    const raw = await readFile(realPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      content: [
        { type: 'text', text: `Failed to read or parse JSON: ${e && e.message}` },
      ],
      isError: true,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      content: [
        {
          type: 'text',
          text: 'mcp args file must be a JSON object (fileKey, code, description, ...)',
        },
      ],
      isError: true,
    };
  }

  let useInject = inject;
  if (env.FIGMA_MCP_TEST_MOCK === '1' && !useInject) {
    const mod = await import('./figma-mock-stub.mjs');
    useInject = { create: mod.createMockFigmaClient };
  }

  try {
    return await forwardUseFigma(/** @type {Record<string, unknown>} */ (parsed), env, useInject);
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    return {
      content: [{ type: 'text', text: `Upstream Figma MCP error: ${msg}` }],
      isError: true,
    };
  }
}
