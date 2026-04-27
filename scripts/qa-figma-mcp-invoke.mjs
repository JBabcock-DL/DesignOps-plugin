#!/usr/bin/env node
/**
 * CI: figma-mcp-invoke --dry-run with minimal valid JSON (no Figma, no network).
 */

import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const invoker = join(__dirname, 'figma-mcp-invoke-from-file.mjs');

const dir = mkdtempSync(join(tmpdir(), 'qa-figma-mcp-'));
const jsonPath = join(dir, 'args.json');
try {
  writeFileSync(
    jsonPath,
    JSON.stringify({
      fileKey: 'qa-file-key',
      code: 'async () => { return { ok: true }; }',
      description: 'qa-figma-mcp-invoke',
    }),
    'utf8',
  );

  const r = spawnSync(process.execPath, [invoker, '--dry-run', '--file', jsonPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (r.status !== 0) {
    console.error('qa-figma-mcp-invoke: dry-run failed');
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
  console.log('qa-figma-mcp-invoke: OK');
} finally {
  try {
    unlinkSync(jsonPath);
  } catch {
    /* noop */
  }
}
