import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} resolvedMcpJsonPath
 * @param {object} [opts]
 * @param {string} [opts.scriptPath] override check script
 * @param {string} [opts.nodeExec] default process.execPath
 */
export function runCheckUseFigmaMcpArgs(resolvedMcpJsonPath, opts = {}) {
  const node = opts.nodeExec || process.execPath;
  const scriptPath =
    opts.scriptPath ||
    (process.env.FIGMA_MCP_CHECK_SCRIPT &&
      String(process.env.FIGMA_MCP_CHECK_SCRIPT).trim()) ||
    path.join(__dirname, '../../../scripts/check-use-figma-mcp-args.mjs');
  const r = spawnSync(node, [scriptPath, resolvedMcpJsonPath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.error) {
    return { ok: false, code: 1, stderr: String(r.error.message) };
  }
  if (r.status !== 0) {
    return {
      ok: false,
      code: r.status || 1,
      stderr: (r.stderr || '') + (r.stdout || ''),
    };
  }
  return { ok: true, code: 0, stdout: r.stdout || '' };
}
