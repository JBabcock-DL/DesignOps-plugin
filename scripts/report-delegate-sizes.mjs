#!/usr/bin/env node
/**
 * Prints UTF-8 byte sizes for delegated create-component *.min.figma.js engines
 * (same mapping as delegate-legacy-min.mjs + archetype step0 set).
 *
 * Usage: node scripts/report-delegate-sizes.mjs
 *
 * Requires: npm run build:min already run (committed min files exist).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPL = join(ROOT, 'skills/create-component/templates');

const DOC_REL = [
  'create-component-engine-doc.step2.min.figma.js',
  'create-component-engine-doc.step3.min.figma.js',
  'create-component-engine-doc.step4.min.figma.js',
  'create-component-engine-doc.step5.min.figma.js',
  'create-component-engine-doc.step6.min.figma.js',
];

const ARCH = ['chip', 'surface-stack', 'field', 'row-item', 'tiny', 'control', 'container', 'composed'];

function bytes(rel) {
  const p = join(TEMPL, rel);
  if (!existsSync(p)) return null;
  return Buffer.byteLength(readFileSync(p, 'utf8'), 'utf8');
}

const rows = [];
for (const rel of DOC_REL) {
  const b = bytes(rel);
  rows.push({
    slugNote: rel.includes('step2')
      ? 'cc-doc-component'
      : rel.includes('step3')
        ? 'cc-doc-props-1/2'
        : rel.includes('step4')
          ? 'cc-doc-matrix'
          : rel.includes('step5')
            ? 'cc-doc-usage'
            : 'cc-doc-finalize',
    file: rel,
    bytes: b,
  });
}
for (const a of ARCH) {
  const rel = `create-component-engine-${a === 'composed' ? 'composed' : a}.step0.min.figma.js`;
  rows.push({
    slugNote: `cc-variants layout=${a === 'composed' ? '__composes__' : a}`,
    file: rel,
    bytes: bytes(rel),
  });
}

rows.sort((x, y) => (y.bytes ?? 0) - (x.bytes ?? 0));

console.log('Delegated min engines (skills/create-component/templates)\n');
for (const r of rows) {
  const label = r.bytes != null ? `${r.bytes}` : 'MISSING (run npm run build:min)';
  console.log(`${label}\t${r.slugNote}\t${r.file}`);
}
console.log('');
console.log(
  `op-interpreter.min.figma.js: ${bytes('op-interpreter.min.figma.js') ?? '?'} B (tuple runtime; compare qa:op-interpreter budgets)`,
);
process.exit(0);
