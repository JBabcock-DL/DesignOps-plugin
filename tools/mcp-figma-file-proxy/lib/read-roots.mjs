import path from 'node:path';
import { realpath } from 'node:fs/promises';

/**
 * @param {string | undefined} raw
 * @param {string} [delimiter]
 * @returns {string[]}
 */
export function parseRootsList(raw, delimiter = path.delimiter) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(delimiter)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} resolvedAbs must be path.resolve output
 * @param {string[]} allowRealPrefixes realpath of each allow root, no trailing sep except for roots
 * @returns {boolean}
 */
export function isPathUnderAnyRoot(resolvedAbs, allowRealPrefixes) {
  const norm = path.normalize(resolvedAbs);
  for (const p of allowRealPrefixes) {
    const root = p.endsWith(path.sep) ? p.slice(0, -1) : p;
    if (norm === root || norm.startsWith(root + path.sep)) return true;
  }
  return false;
}

/**
 * @param {string} userPath
 * @param {object} opts
 * @param {string[]} opts.allowRoots
 * @param {string} [opts.cwd] default process.cwd()
 * @param {(p: string) => Promise<string>} [opts.realpathFn]
 * @returns {Promise<{ realPath: string; displayPath: string }>}
 */
export async function resolveAllowedMcpArgsFile(userPath, opts) {
  const cwd = opts.cwd || process.cwd();
  const { allowRoots, realpathFn = realpath } = opts;
  if (!userPath || typeof userPath !== 'string' || !userPath.trim()) {
    const err = new Error('mcpArgsPath is required');
    err.code = 'E_ARGS';
    throw err;
  }
  if (!allowRoots.length) {
    const err = new Error(
      'No read roots: set FIGMA_MCP_READ_ROOTS and/or FIGMA_MCP_WORKSPACE_ROOT'
    );
    err.code = 'E_CONFIG';
    throw err;
  }

  const first = userPath.trim();
  const asInput = path.isAbsolute(first) ? first : path.resolve(cwd, first);
  if (asInput.includes('\0')) {
    const err = new Error('invalid path');
    err.code = 'E_ARGS';
    throw err;
  }

  const realFile = await realpathFn(asInput);
  const allowReal = await Promise.all(allowRoots.map((r) => realpathFn(path.resolve(r))));

  if (!isPathUnderAnyRoot(realFile, allowReal)) {
    const err = new Error(
      `Path not under allowed roots: ${realFile} (allow: ${allowReal.join(', ')})`
    );
    err.code = 'E_ALLOW';
    throw err;
  }

  return { realPath: realFile, displayPath: asInput };
}

/**
 * @param {string} repoRoot
 */
export function getAllowRootsFromEnv(env = process.env) {
  const fromList = parseRootsList(env.FIGMA_MCP_READ_ROOTS);
  const workspace = (env.FIGMA_MCP_WORKSPACE_ROOT || '').trim();
  const roots = [...fromList];
  if (workspace) roots.push(workspace);
  return roots;
}
