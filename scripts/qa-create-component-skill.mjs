#!/usr/bin/env node
// Offline QA for /create-component shipped templates: every *.min.figma.js under
// skills/create-component/templates that is a runtime or ladder artifact must
// parse as an async function body and survive JSON.stringify transport (same
// gates as scripts/check-payload.mjs).
//
// Usage: npm run qa:create-component-skill
// Run after: npm run build:min

import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const TEMPLATES = resolve(REPO_ROOT, 'skills/create-component/templates');
const CHECK = resolve(REPO_ROOT, 'scripts/check-payload.mjs');

function main() {
  if (!existsSync(TEMPLATES)) {
    console.error(`qa-create-component-skill: missing ${TEMPLATES}`);
    process.exit(2);
  }
  const names = readdirSync(TEMPLATES).filter(
    f =>
      f.endsWith('.min.figma.js') &&
      (f.startsWith('create-component-engine') ||
        f === 'draw-engine.min.figma.js' ||
        f === 'archetype-builders.min.figma.js'),
  );
  names.sort();

  let failed = 0;
  console.log(`qa-create-component-skill: check-payload × ${names.length} min bundles\n`);
  for (const name of names) {
    const abs = resolve(TEMPLATES, name);
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
