#!/usr/bin/env node
/**
 * Print byte sizes relevant to the "σ = sum of all use_figma code in one draw" budget.
 * Committed paths under skills/create-component/templates/ — no assembly of CONFIG.
 *
 * Usage: node scripts/measure-sigma.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const T = resolve(ROOT, 'skills/create-component/templates');
const PREAMBLE = resolve(T, 'preamble.figma.js');

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

function b(p) {
  return readFileSync(p).byteLength;
}

const pBytes = b(PREAMBLE);
console.log('create-component / σ (total code bytes) — reference measurements\n');
console.log(`preamble.figma.js: ${pBytes} bytes\n`);

for (const layout of LAYOUTS) {
  const name = `create-component-engine-${layout}.min.figma.js`;
  const path = resolve(T, name);
  if (!existsSync(path)) continue;
  const full = b(path);
  const one = full + pBytes;
  const twoPhase = 2 * (full + pBytes);
  const step0 = resolve(T, `create-component-engine-${layout === 'composed' ? 'composed' : layout}.step0.min.figma.js`);
  const s0 = existsSync(step0) ? b(step0) : 0;
  const doc = [1, 2, 3, 4, 5, 6].map(n => b(resolve(T, `create-component-engine-doc.step${n}.min.figma.js`)));
  const ladderEng = s0 + doc.reduce((a, x) => a + x, 0);
  const ladderNaive = ladderEng + 7 * pBytes;
  console.log(`layout: ${layout}`);
  console.log(`  full min:           ${full}`);
  console.log(`  1 call (+premble):  ${one}  (add CONFIG — single-call σ)`);
  console.log(`  2 call naive 2x:    ${twoPhase}  (§1b-style full x2 + premble x2 — not realistic if phase2 is smaller, but upper bound if both ship full min)`);
  console.log(`  7-slice engines sum: ${ladderEng}  (step0 + doc step1..6)`);
  console.log(`  7-slice +7 premble:  ${ladderNaive}  (naive σ if full preamble each time)`);
  console.log('');
}

const TARGET = 45000;
console.log(
  `---\n` +
    `Target σ ~${TARGET}: naive step0+doc1..6 above is NOT a byte partition of one monolith — ` +
    `build recompiles overlapping draw-engine; see skills/create-component/conventions/18-mcp-payload-budget.md and AGENTS.md (MCP transport, σ) ` +
    `(partitioned entries + thin preamble 2–7 can approach monolith total).\n`,
);
