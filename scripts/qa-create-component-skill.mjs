#!/usr/bin/env node
// Offline QA: every *.min.mcp.js under skills/create-component/canvas-templates/bundles
// must parse as an async function body (same gate as scripts/check-payload.mjs).
//
// Usage: npm run qa:create-component-skill
// Run after: npm run bundle-component

import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BUNDLES = resolve(REPO_ROOT, 'skills/create-component/canvas-templates/bundles');
const CHECK = resolve(REPO_ROOT, 'scripts/check-payload.mjs');

function main() {
  if (!existsSync(BUNDLES)) {
    console.error(`qa-create-component-skill: missing ${BUNDLES}`);
    process.exit(2);
  }
  const names = readdirSync(BUNDLES).filter(f => f.endsWith('.min.mcp.js'));
  names.sort();

  let failed = 0;
  console.log(`qa-create-component-skill: check-payload × ${names.length} bundles\n`);
  for (const name of names) {
    const abs = resolve(BUNDLES, name);
    const r = spawnSync(process.execPath, [CHECK, abs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.status !== 0) {
      failed++;
      console.error(`FAIL  ${name}`);
      if (r.stderr) console.error(r.stderr);
    } else {
      const line = (r.stdout || '').trim().split('\n').pop();
      console.log(`OK    ${name}  ${line || ''}`);
    }
  }

  if (failed > 0) {
    console.error(`\nqa-create-component-skill: FAILED (${failed}/${names.length})`);
    process.exit(1);
  }
  console.log(`\nqa-create-component-skill: OK (${names.length} bundles)`);
}

main();
