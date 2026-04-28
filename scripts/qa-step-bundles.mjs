#!/usr/bin/env node
// QA report for create-component MCP ladder bundles (*.step*.min.figma.js).
// Run after `npm run build:min`. Non-zero exit if any artifact is missing or
// exceeds the same max as build-min-templates (50k − CONFIG headroom on the
// naked `.min.figma.js` file).
//
// Also simulates a full `use_figma` wrapper JSON (fileKey + code + description +
// skillNames) from sample CONFIG + cc-doc-finalize varGlobals + preamble.runtime +
// each slice — for logging only; does not fail on host wrapper size.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const TEMPLATES = resolve(REPO_ROOT, 'skills/create-component/templates');
const SAMPLE_CONFIG = resolve(TEMPLATES, '__fixtures__/sample-config-block.js');
const PREAMBLE_RUNTIME = resolve(TEMPLATES, 'preamble.runtime.figma.js');
const PREAMBLE_HUMAN = resolve(TEMPLATES, 'preamble.figma.js');

const HARD_LIMIT = 50000;
const CONFIG_HEADROOM = 10000;
const MAX_RAW_SLICE_BYTES = HARD_LIMIT - CONFIG_HEADROOM;
const DUMMY_FILE_KEY = '00000000000000000000000000000000';

/** Synthetic `varGlobals` for cc-doc-finalize (worst header) when simulating each slice. */
function varGlobalsCcDocFinalize() {
  return [
    'var __CREATE_COMPONENT_PHASE__ = 2;',
    'var __PHASE_1_VARIANT_HOLDER_ID__ = "a";',
    'var __CC_PHASE1_PROPS_ADDED__ = {};',
    'var __CC_PHASE1_UNRESOLVED__ = [];',
    'var __CC_HANDOFF_PAGE_CONTENT_ID__ = "b";',
    'var __CC_HANDOFF_DOC_ROOT_ID__ = "c";',
    'var __CC_HANDOFF_COMP_SET_ID__ = "d";',
  ].join('\n');
}

/** Map a templates filename to the orchestrator step slug. */
function stepSlugForBundleFilename(name) {
  if (name.includes('.step0.min.figma.js')) return 'cc-variants';
  const m = name.match(/create-component-engine-doc\.step(\d)\.min\.figma\.js/);
  if (!m) return null;
  const d = m[1];
  const map = {
    1: 'cc-doc-scaffold-shell',
    2: 'cc-doc-component',
    3: 'cc-doc-props-1',
    4: 'cc-doc-matrix',
    5: 'cc-doc-usage',
    6: 'cc-doc-finalize',
  };
  return map[d] ?? null;
}

function patchPreamble(preambleSrc) {
  return preambleSrc
    .replace(
      /const ACTIVE_FILE_KEY\s*=\s*null;/,
      `const ACTIVE_FILE_KEY = ${JSON.stringify(DUMMY_FILE_KEY)};`,
    )
    .replace(
      /const REGISTRY_COMPONENTS\s*=\s*\{\s*\};/,
      'const REGISTRY_COMPONENTS = {};',
    );
}

function main() {
  const rows = [];
  let maxBytes = 0;
  let maxFile = '';
  let failed = 0;

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
    if (n > MAX_RAW_SLICE_BYTES) failed++;
    rows.push({ name, bytes: n, ok: n <= MAX_RAW_SLICE_BYTES });
  }

  for (let s = 1; s <= 6; s++) {
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
    if (n > MAX_RAW_SLICE_BYTES) failed++;
    rows.push({ name, bytes: n, ok: n <= MAX_RAW_SLICE_BYTES });
  }

  rows.sort((a, b) => b.bytes - a.bytes);
  console.log(
    `qa-step-bundles: ${rows.length} artifacts · max ${MAX_RAW_SLICE_BYTES} bytes per file (use_figma ${HARD_LIMIT} − ${CONFIG_HEADROOM} CONFIG headroom)`,
  );
  console.log('');
  console.log('largest (top 15):');
  for (const r of rows.slice(0, 15)) {
    const flag = r.ok ? '✓' : '✗ OVER';
    console.log(`  ${flag} ${String(r.bytes).padStart(5)}  ${r.name}`);
  }
  console.log('');
  console.log(`max: ${maxBytes} bytes (${maxFile})`);
  const docSteps = [1, 2, 3, 4, 5, 6].map(s => ({
    s,
    row: rows.find(r => r.name === `create-component-engine-doc.step${s}.min.figma.js`),
  }));
  const s0chip = rows.find(r => r.name === 'create-component-engine-chip.step0.min.figma.js');
  if (docSteps.every(x => x.row) && s0chip) {
    const ladder = docSteps.map(({ s, row }) => `${s}:${row.bytes}`).join(' · ');
    console.log(`doc ladder (bytes): ${ladder}`);
    console.log(
      `step0 chip: ${s0chip.bytes} B · shared create-component-engine-doc.step1..6 (per-step sizes after terser unused strip)`,
    );
  }

  if (failed > 0) {
    console.error(
      `\nqa-step-bundles: FAILED (${failed} issue(s)) — raw file over ${MAX_RAW_SLICE_BYTES} bytes`,
    );
    process.exit(1);
  }
  console.log('\nqa-step-bundles: raw min bundles OK');

  // —— MCP wrapper JSON (informational; not a pass/fail gate) ——
  if (!existsSync(SAMPLE_CONFIG)) {
    console.error(`\nqa-step-bundles: missing sample CONFIG: ${SAMPLE_CONFIG}`);
    process.exit(1);
  }
  if (!existsSync(PREAMBLE_RUNTIME)) {
    console.error(
      `\nqa-step-bundles: missing ${PREAMBLE_RUNTIME} — run: npm run build:min`,
    );
    process.exit(1);
  }

  const configBlock = readFileSync(SAMPLE_CONFIG, 'utf8').trim();
  const preambleRaw = readFileSync(PREAMBLE_RUNTIME, 'utf8');
  const patchedPreamble = patchPreamble(preambleRaw);
  const vgW = varGlobalsCcDocFinalize();
  let humanPreambleBytes = 0;
  if (existsSync(PREAMBLE_HUMAN)) {
    humanPreambleBytes = readFileSync(PREAMBLE_HUMAN).byteLength;
  }

  const wrapRows = [];
  let maxWrapper = 0;
  let maxWrapperFile = '';

  for (const r of rows) {
    const slug = stepSlugForBundleFilename(r.name);
    if (!slug) {
      console.error(`qa-step-bundles: unmapped step bundle: ${r.name}`);
      process.exit(1);
    }
    const abs = resolve(TEMPLATES, r.name);
    const engine = readFileSync(abs, 'utf8');
    const code = [configBlock, vgW, patchedPreamble, engine].join('\n');
    const codeBytes = Buffer.byteLength(code, 'utf8');
    const wrapperObj = {
      fileKey: DUMMY_FILE_KEY,
      code,
      description: 'qa',
      skillNames: 'qa',
    };
    const wrapperStr = JSON.stringify(wrapperObj);
    const wrapperBytes = Buffer.byteLength(wrapperStr, 'utf8');
    if (wrapperBytes > maxWrapper) {
      maxWrapper = wrapperBytes;
      maxWrapperFile = r.name;
    }
    wrapRows.push({ name: r.name, slug, codeBytes, wrapperBytes });
  }

  wrapRows.sort((a, b) => b.wrapperBytes - a.wrapperBytes);
  const rtBytes = readFileSync(PREAMBLE_RUNTIME).byteLength;
  console.log('');
  console.log(
    'MCP wrapper JSON (sim): sample CONFIG + cc-doc-finalize varGlobals + ' +
    'preamble.runtime + each *.step*.min.figma.js — sizes are informational only.',
  );
  console.log(
    `  preamble.figma.js (human) = ${humanPreambleBytes} B  ·  preamble.runtime.figma.js = ${rtBytes} B`,
  );
  console.log('');
  console.log('wrapper largest (all step bundles, top 15):');
  for (const w of wrapRows.slice(0, 15)) {
    console.log(
      `        wrapper=${String(w.wrapperBytes).padStart(5)}B  code=${String(w.codeBytes).padStart(5)}B  ` +
        `${w.slug}  ${w.name}`,
    );
  }
  console.log(`\nmax wrapper: ${maxWrapper} bytes (${maxWrapperFile})`);
  console.log('\nqa-step-bundles: OK (raw + wrapper sim)');
}

main();
