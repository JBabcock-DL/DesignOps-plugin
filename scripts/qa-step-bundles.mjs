#!/usr/bin/env node
// QA report for create-component MCP ladder bundles (*.step*.min.figma.js).
// Run after `npm run build:min`. Non-zero exit if any artifact is missing or
// exceeds the same budget as build-min-templates (50k − CONFIG_HEADROOM).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const TEMPLATES = resolve(REPO_ROOT, 'skills/create-component/templates');

const HARD_LIMIT = 50000;
const CONFIG_HEADROOM = 10000;
const BUDGET = HARD_LIMIT - CONFIG_HEADROOM;

const LAYOUTS = [
  'chip',
  'surface-stack',
  'field',
  'row-item',
  'tiny',
  'control',
  'container',
  'composed',
];

function main() {
  const rows = [];
  let maxBytes = 0;
  let maxFile = '';
  let failed = 0;

  for (const layout of LAYOUTS) {
    const name = `create-component-engine-${layout}.step0.min.figma.js`;
    const abs = resolve(TEMPLATES, name);
    if (!existsSync(abs)) {
      console.error(`missing: ${name}`);
      failed++;
      continue;
    }
    const n = readFileSync(abs).byteLength;
    if (n > maxBytes) {
      maxBytes = n;
      maxFile = name;
    }
    if (n > BUDGET) failed++;
    rows.push({ name, bytes: n, ok: n <= BUDGET });
  }

  for (let s = 1; s <= 5; s++) {
    const name = `create-component-engine-doc.step${s}.min.figma.js`;
    const abs = resolve(TEMPLATES, name);
    if (!existsSync(abs)) {
      console.error(`missing: ${name}`);
      failed++;
      continue;
    }
    const n = readFileSync(abs).byteLength;
    if (n > maxBytes) {
      maxBytes = n;
      maxFile = name;
    }
    if (n > BUDGET) failed++;
    rows.push({ name, bytes: n, ok: n <= BUDGET });
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  console.log(
    `qa-step-bundles: ${rows.length} artifacts · budget ${BUDGET} bytes (use_figma ${HARD_LIMIT} − ${CONFIG_HEADROOM} CONFIG headroom)`,
  );
  console.log('');
  console.log('largest (top 15):');
  for (const r of rows.slice(0, 15)) {
    const flag = r.ok ? '✓' : '✗ OVER';
    console.log(`  ${flag} ${String(r.bytes).padStart(5)}  ${r.name}`);
  }
  console.log('');
  console.log(`max: ${maxBytes} bytes (${maxFile})`);
  const docSteps = [1, 2, 3, 4, 5].map(s => ({
    s,
    row: rows.find(r => r.name === `create-component-engine-doc.step${s}.min.figma.js`),
  }));
  const s0chip = rows.find(r => r.name === 'create-component-engine-chip.step0.min.figma.js');
  if (docSteps.every(x => x.row) && s0chip) {
    const ladder = docSteps.map(({ s, row }) => `${s}:${row.bytes}`).join(' · ');
    console.log(`doc ladder (bytes): ${ladder}`);
    console.log(
      `step0 chip: ${s0chip.bytes} B · shared create-component-engine-doc.step1..5 (per-step sizes after terser unused strip)`,
    );
  }

  if (failed > 0) {
    console.error(`\nqa-step-bundles: FAILED (${failed} issue(s))`);
    process.exit(1);
  }
  console.log('\nqa-step-bundles: OK');
}

main();
