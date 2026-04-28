#!/usr/bin/env node
// qa-assembled-size.mjs — Tier 0 assembled payload size report (no MCP).
// Loops SLUG_ORDER; each slice runs assemble-slice against the same paths.
// Slugs whose handoff preconditions fail will exit non-zero for that iteration — captured in JSON.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { SLUG_ORDER } from './merge-create-component-handoff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const k = x.slice(2);
      a[k] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    }
  }
  return a;
}

function usage(ec) {
  console.error(
    `Usage: node scripts/qa-assembled-size.mjs \\\n` +
      `  --draw-dir <dir> --layout <layout> \\\n` +
      `  --config-block <path> --registry <path|{}> --file-key <k> [--plugin-root <path>]`,
  );
  process.exit(ec);
}

const raw = parseArgs(process.argv.slice(2));
const drawDir = resolve(raw['draw-dir'] || '');
const layout = raw.layout || '';
const cfgPath = raw['config-block'] ? resolve(raw['config-block']) : '';
const registryArg = raw.registry !== undefined ? String(raw.registry) : '';
const fileKey = raw['file-key'] || '';
const pluginRoot = resolve(raw['plugin-root'] || REPO_ROOT);

if (!drawDir || !layout || !cfgPath || !existsSync(join(drawDir, 'handoff.json'))) {
  usage(2);
}

const assemble = resolve(REPO_ROOT, 'scripts', 'assemble-slice.mjs');
const staging = join(drawDir, '.designops', 'qa-size-report');
mkdirSync(staging, { recursive: true });

const results = [];

for (const slug of SLUG_ORDER) {
  const outJs = join(staging, `${slug}.code.js`);
  const mcpJson = join(staging, `mcp-${slug}.json`);

  /** @type {string[]} */
  const argv = [
    process.execPath,
    assemble,
    '--step',
    slug,
    '--layout',
    layout,
    '--config-block',
    cfgPath,
    '--registry',
    registryArg || '{}',
    '--handoff',
    join(drawDir, 'handoff.json'),
    '--file-key',
    fileKey || 'qa-assembled-size',
    '--plugin-root',
    pluginRoot,
    '--out',
    outJs,
    '--emit-mcp-args',
    mcpJson,
  ];

  const r = spawnSync(argv[0], argv.slice(1), {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let codeBytes = null;
  let mcpWrapperBytes = null;
  if (existsSync(outJs)) {
    codeBytes = Buffer.byteLength(readFileSync(outJs, 'utf8'), 'utf8');
  }
  if (existsSync(mcpJson)) {
    mcpWrapperBytes = Buffer.byteLength(readFileSync(mcpJson, 'utf8'), 'utf8');
  }
  results.push({
    slug,
    exitCode: r.status ?? 1,
    codeBytes,
    mcpWrapperBytes,
    stderrSnippet: r.status !== 0 ? String(r.stderr || r.stdout || '').slice(0, 400) : undefined,
  });
}

console.log(JSON.stringify({ ok: true, drawDir, layout, staging, results }, null, 2));
