#!/usr/bin/env node
// QA: op-interpreter min size + tuple op list size for scaffold sub-slugs + full concat (dev slug)
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScaffold1Ops } from './op-generators/cc-doc-scaffold.mjs';
import { assembleOpsBody } from './generate-ops.mjs';
import { SCAFFOLD_SUB_SLUGS } from './merge-create-component-handoff.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OP_MIN = join(REPO_ROOT, 'skills/create-component/templates/op-interpreter.min.figma.js');
const BUDGET_RUNTIME = 11000;
const BUDGET_ASSEMBLE_FULL = 18200;
const BUDGET_PER_SCAFFOLD_SUB = 16000;

if (!existsSync(OP_MIN)) {
  console.error('qa-op-interpreter: run npm run build:min first');
  process.exit(1);
}
const minBytes = Buffer.byteLength(readFileSync(OP_MIN, 'utf8'), 'utf8');
if (minBytes > BUDGET_RUNTIME) {
  console.error(`qa-op-interpreter: op-interpreter.runtime.min.figma.js is ${minBytes}B (max ${BUDGET_RUNTIME})`);
  process.exit(1);
}

const sampleCfg = {
  component: 'qa-widget',
  title: 'T',
  summary: 'S',
  layout: 'control',
  properties: Array.from({ length: 3 }, () => ['a', 'b', 'c', 'd', 'e']),
  variants: ['x'],
  style: { x: { fill: 'color/background/default', labelVar: 'color/background/content' } },
};

const bodyFull = assembleOpsBody({ slug: 'cc-doc-scaffold-full-qa', config: sampleCfg, pluginRoot: REPO_ROOT });
const abFull = Buffer.byteLength(bodyFull, 'utf8');
if (abFull > BUDGET_ASSEMBLE_FULL) {
  console.error(
    `qa-op-interpreter: assembled full ops+runtime is ${abFull}B (max ${BUDGET_ASSEMBLE_FULL} until tuple+prop compression full)`,
  );
  process.exit(1);
}

for (const slug of SCAFFOLD_SUB_SLUGS) {
  const b = assembleOpsBody({ slug, config: sampleCfg, pluginRoot: REPO_ROOT });
  const n = Buffer.byteLength(b, 'utf8');
  if (n > BUDGET_PER_SCAFFOLD_SUB) {
    console.error(`qa-op-interpreter: sub-slice ${slug} assembled body ${n}B (max ${BUDGET_PER_SCAFFOLD_SUB})`);
    process.exit(1);
  }
}

const ops = buildScaffold1Ops(sampleCfg);
if (!Array.isArray(ops[0]) || ops[0][0] !== 0) {
  console.error('qa-op-interpreter: expected tuple ops [0,...]');
  process.exit(1);
}

console.log(
  `qa-op-interpreter: OK  runtimeMin=${minBytes}B<=${BUDGET_RUNTIME}  ` +
    `scaffoldFullAssembled=${abFull}B<=${BUDGET_ASSEMBLE_FULL}  ` +
    `perSub<=${BUDGET_PER_SCAFFOLD_SUB}B  tupleOps=${ops.length}`,
);
process.exit(0);
