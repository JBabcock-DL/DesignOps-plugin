#!/usr/bin/env node
// Rebuild the monolithic skills/create-component/shadcn-props.json from the
// per-component files under skills/create-component/shadcn-props/*.json.
//
// After the Phase 8 migration (scripts/split-shadcn-props.mjs), the split
// directory is the source of truth. The monolith is kept for two reasons:
//   1. Backwards-compat — create-component reads it in Mode A today.
//   2. Simpler `--check` drift detection — one big JSON file diffs cleanly.
//
// Usage:
//   node scripts/build-shadcn-props.mjs          # regenerate the monolith
//   node scripts/build-shadcn-props.mjs --check  # non-zero if regen differs
//
// Also regenerates ./shadcn-props/_index.json from the directory contents so
// an agent can read the index alone (~300 B) instead of the full monolith
// when selecting which single component file to load.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const MONO_PATH = resolve(REPO_ROOT, 'skills/create-component/shadcn-props.json');
const SPLIT_DIR = resolve(REPO_ROOT, 'skills/create-component/shadcn-props');
const INDEX_PATH = resolve(SPLIT_DIR, '_index.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatJson(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function main() {
  const check = process.argv.includes('--check');

  if (!existsSync(SPLIT_DIR)) {
    console.error(
      `error: split directory not found: ${SPLIT_DIR}\n` +
        '       run `node scripts/split-shadcn-props.mjs` once to create it.'
    );
    process.exit(1);
  }

  const files = readdirSync(SPLIT_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .sort((a, b) => a.localeCompare(b));

  const entries = {};
  for (const f of files) {
    const name = f.replace(/\.json$/, '');
    entries[name] = readJson(resolve(SPLIT_DIR, f));
  }

  // Preserve whichever $schema / $comment the old monolith had, so reading
  // this file in an editor still JSON-schema-lints correctly.
  const oldMono = existsSync(MONO_PATH) ? readJson(MONO_PATH) : {};
  const mono = {
    $schema: oldMono.$schema ?? './shadcn-props.schema.json',
    $comment:
      oldMono.$comment ??
      'Regenerated from skills/create-component/shadcn-props/*.json via scripts/build-shadcn-props.mjs. Edit the per-component files, not this bundle.',
    ...entries,
  };

  // Regenerate the index from the split directory.
  const index = {
    $schema: '../shadcn-props.schema.json',
    $comment:
      'Index of per-component shadcn-props entries. Regenerate the monolithic ../shadcn-props.json with `node scripts/build-shadcn-props.mjs`.',
    generatedBy: 'scripts/build-shadcn-props.mjs',
    components: files.map(f => {
      const name = f.replace(/\.json$/, '');
      const e = entries[name];
      return {
        name,
        category: e.category || null,
        layout: e.layout || 'chip',
        pageName: e.pageName || null,
        docsUrl: e.docsUrl || null,
        file: `./${f}`,
      };
    }),
  };

  const monoNext = formatJson(mono);
  const indexNext = formatJson(index);
  const monoPrev = existsSync(MONO_PATH) ? readFileSync(MONO_PATH, 'utf8') : '';
  const indexPrev = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';

  const monoChanged = monoNext !== monoPrev;
  const indexChanged = indexNext !== indexPrev;

  if (check) {
    let failed = 0;
    if (monoChanged) {
      console.error(`drift: ${MONO_PATH} is out of sync with the split directory.`);
      failed++;
    }
    if (indexChanged) {
      console.error(`drift: ${INDEX_PATH} is out of sync.`);
      failed++;
    }
    if (failed > 0) {
      console.error('       run `node scripts/build-shadcn-props.mjs` to regenerate.');
      process.exit(1);
    }
    console.log('build-shadcn-props: OK (monolith and index match split)');
    return;
  }

  if (monoChanged) {
    writeFileSync(MONO_PATH, monoNext);
    console.log(`updated ${MONO_PATH}`);
  }
  if (indexChanged) {
    writeFileSync(INDEX_PATH, indexNext);
    console.log(`updated ${INDEX_PATH}`);
  }
  if (!monoChanged && !indexChanged) {
    console.log('build-shadcn-props: already up to date');
  }
}

main();
