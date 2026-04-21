#!/usr/bin/env node
// One-time migration — reads the monolithic
// skills/create-component/shadcn-props.json and explodes it into per-component
// JSON files under skills/create-component/shadcn-props/{component}.json plus
// an index at skills/create-component/shadcn-props/_index.json.
//
// Rerunning is safe: the migration overwrites the split files with the
// contents of the monolith. Do NOT call this script from normal CI — after the
// initial split lands, the directory is the source of truth and the monolith
// is regenerated from it via scripts/build-shadcn-props.mjs.
//
// Usage:
//   node scripts/split-shadcn-props.mjs             # writes the split files
//   node scripts/split-shadcn-props.mjs --dry-run   # previews without writing

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

function writeJsonPretty(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const mono = readJson(MONO_PATH);

  const meta = {};
  const entries = {};
  for (const [name, value] of Object.entries(mono)) {
    if (name.startsWith('$')) meta[name] = value;
    else entries[name] = value;
  }

  const names = Object.keys(entries).sort((a, b) => a.localeCompare(b));
  const index = {
    $schema: meta.$schema ?? './shadcn-props.schema.json',
    $comment:
      meta.$comment ??
      'Index of per-component shadcn-props entries. Regenerate the monolithic ../shadcn-props.json with `node scripts/build-shadcn-props.mjs`.',
    generatedBy: 'scripts/build-shadcn-props.mjs',
    components: names.map(n => ({
      name: n,
      category: entries[n].category || null,
      layout: entries[n].layout || 'chip',
      pageName: entries[n].pageName || null,
      docsUrl: entries[n].docsUrl || null,
      file: `./${n}.json`,
    })),
  };

  console.log(`found ${names.length} component entries in ${MONO_PATH}`);
  if (dry) {
    for (const n of names) console.log(`  would write ${n}.json`);
    console.log(`  would write _index.json (${names.length} entries)`);
    return;
  }

  mkdirSync(SPLIT_DIR, { recursive: true });
  for (const n of names) {
    const target = resolve(SPLIT_DIR, `${n}.json`);
    writeJsonPretty(target, entries[n]);
  }
  writeJsonPretty(INDEX_PATH, index);
  console.log(`wrote ${names.length} files under skills/create-component/shadcn-props/`);
  console.log(`wrote ${INDEX_PATH}`);
  console.log(
    'next: run `node scripts/build-shadcn-props.mjs` to regenerate shadcn-props.json from the split,\n' +
      '      verify it matches the original (git diff should be empty modulo key order),\n' +
      '      then commit the split + regenerated monolith together.'
  );
}

main();
