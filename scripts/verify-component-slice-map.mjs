#!/usr/bin/env node
/**
 * Ensure every create-component-figma-slice-runner §2 engine path exists on disk.
 * Mirrors the "unknown step = fail" idea from canvas-bundle-runner.
 *
 * Usage: node scripts/verify-component-slice-map.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const TEMPLATES = join(REPO_ROOT, 'skills/create-component/templates');

const ARCHETYPES = [
  'chip',
  'surface-stack',
  'field',
  'row-item',
  'tiny',
  'control',
  'container',
  'composed',
];

const DOC_STEPS = [1, 2, 3, 4, 5, 6];

function rel(p) {
  return p.slice(REPO_ROOT.length + 1);
}

let failed = false;
const missing = [];

for (const a of ARCHETYPES) {
  const f = join(TEMPLATES, `create-component-engine-${a}.step0.min.figma.js`);
  if (!existsSync(f)) {
    failed = true;
    missing.push(rel(f));
  }
}
for (const s of DOC_STEPS) {
  const f = join(TEMPLATES, `create-component-engine-doc.step${s}.min.figma.js`);
  if (!existsSync(f)) {
    failed = true;
    missing.push(rel(f));
  }
}

if (failed) {
  console.error('verify-component-slice-map: missing committed min files:');
  for (const m of missing) console.error(`  - ${m}`);
  console.error('  run: npm run build:min');
  process.exit(1);
}

console.log(
  `verify-component-slice-map: OK (${ARCHETYPES.length} step0 + ${DOC_STEPS.length} doc slices)`,
);
