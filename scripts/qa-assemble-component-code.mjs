#!/usr/bin/env node
// Offline QA: ctx + bundle concatenation for every create-component step parses (check-payload).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CC_STEP_TO_BUNDLE, assembleComponentUseFigmaCode } from './assemble-component-use-figma-code.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CTX = path.join(REPO_ROOT, 'scripts/test-fixtures/min-component-ctx.js');
const CHECK = path.join(REPO_ROOT, 'scripts/check-payload.mjs');

function main() {
  if (!existsSync(CTX)) {
    console.error('qa-assemble-component-code: missing', CTX);
    process.exit(2);
  }
  const steps = Object.keys(CC_STEP_TO_BUNDLE).sort();
  const tempBase = mkdtempSync(path.join(tmpdir(), 'cc-assemble-qa-'));
  let failed = 0;
  console.log(`qa-assemble-component-code: ${steps.length} steps × check-payload\n`);

  try {
    for (const step of steps) {
      const outFile = path.join(tempBase, `${step}.mjs`);
      try {
        assembleComponentUseFigmaCode({
          step,
          ctxFile: CTX,
          outPath: outFile,
          repoRoot: REPO_ROOT,
        });
      } catch (e) {
        failed++;
        console.error(`FAIL  ${step} assemble: ${e.message}`);
        continue;
      }
      const r = spawnSync(process.execPath, [CHECK, outFile], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (r.status !== 0) {
        failed++;
        console.error(`FAIL  ${step} check-payload`);
        if (r.stderr) console.error(r.stderr);
      } else {
        const line = (r.stdout || '').trim().split('\n').pop();
        console.log(`OK    ${step}  ${line || ''}`);
      }
    }
  } finally {
    rmSync(tempBase, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`\nqa-assemble-component-code: FAILED (${failed}/${steps.length})`);
    process.exit(1);
  }
  console.log(`\nqa-assemble-component-code: OK (${steps.length})`);
}

main();
