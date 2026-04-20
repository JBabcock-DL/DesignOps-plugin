#!/usr/bin/env node
/**
 * Regenerates committed MCP canvas bundles under canvas-templates/bundles/.
 *
 * Usage (from repo root):
 *   node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
 *
 * Step 15a: _lib.js + primitives.js + bundles/_step15a-runner.fragment.js
 *   → bundles/step-15a-primitives.mcp.js
 *
 * Esbuild / minify caveat (do NOT blindly esbuild the combined file):
 *   The Figma MCP script uses top-level `await` and top-level `return`.
 *   Esbuild may parse the output as ESM and reject top-level `return`.
 *   Prefer plain concatenation (this script) or strip-only minifiers that
 *   preserve script goal semantics; see bundles/README.md.
 *
 * Steps 15b / 15c self-contained bundles: add _step15b-runner.fragment.js
 * (and 15c fragments) plus cases below when row resolution is inlined.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.join(__dirname, '..');
const CT = path.join(skillRoot, 'canvas-templates');
const bundlesDir = path.join(CT, 'bundles');

function readUtf8(rel) {
  return fs.readFileSync(path.join(CT, rel), 'utf8');
}

function writeBundle(name, body) {
  fs.mkdirSync(bundlesDir, { recursive: true });
  const outPath = path.join(bundlesDir, name);
  fs.writeFileSync(outPath, body, 'utf8');
  console.log('Wrote', outPath, '—', body.length, 'chars');
}

// ── Step 15a ───────────────────────────────────────────────────────────────
const lib = readUtf8('_lib.js');
const prim = readUtf8('primitives.js');
const frag15a = readUtf8('bundles/_step15a-runner.fragment.js');
writeBundle('step-15a-primitives.mcp.js', lib + prim + frag15a);
