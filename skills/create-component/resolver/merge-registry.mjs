#!/usr/bin/env node
// merge-registry.mjs — upsert one component record into repo-root `.designops-registry.json`.
//
// Usage:
//   node merge-registry.mjs <path-to-.designops-registry.json> <path-to-entry.json>
//
// entry.json shape:
//   { "fileKey": "ABC123", "component": "button", "nodeId": "12:34", "key": "…", "pageName": "↳ Buttons",
//     "publishedAt": "2026-04-18T12:00:00.000Z", "version": 2, "cvaHash": "…", "composedChildVersions": { "toggle": 1 } }
//
// If the registry file is missing, it is created with `{ fileKey, components: {} }` from entry.fileKey.
//
// entry.json: brief retry on first ENOENT (same ordering race as merge-create-component-handoff).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ENTRY_WAIT_RETRIES = 3;
const ENTRY_WAIT_MS = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readEntryWithRetry(entryPath) {
  let lastErr;
  for (let i = 0; i < ENTRY_WAIT_RETRIES; i++) {
    try {
      return await readFile(entryPath, 'utf8');
    } catch (e) {
      lastErr = e;
      if (e?.code !== 'ENOENT' || i === ENTRY_WAIT_RETRIES - 1) throw e;
      await sleep(ENTRY_WAIT_MS);
    }
  }
  throw lastErr;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    process.stderr.write(
      'usage: merge-registry.mjs <path-to-.designops-registry.json> <path-to-entry.json>\n',
    );
    process.exit(1);
  }
  const regPath = resolve(argv[0]);
  const entryPath = resolve(argv[1]);
  const raw = await readEntryWithRetry(entryPath);
  const incoming = JSON.parse(raw);
  const {
    fileKey,
    component,
    nodeId,
    key,
    pageName,
    publishedAt,
    version,
    cvaHash,
    composedChildVersions,
  } = incoming;
  if (!fileKey || !component || !nodeId || !key || !pageName || !publishedAt || typeof version !== 'number') {
    process.stderr.write('entry.json must include fileKey, component, nodeId, key, pageName, publishedAt, version\n');
    process.exit(1);
  }

  let registry = { fileKey, components: {} };
  try {
    const existing = await readFile(regPath, 'utf8');
    registry = JSON.parse(existing);
  } catch (_) {
    /* create new */
  }
  if (registry.fileKey && registry.fileKey !== fileKey) {
    process.stderr.write(
      `registry fileKey ${registry.fileKey} != entry fileKey ${fileKey} — refuse to merge (cross-file pollution).\n`,
    );
    process.exit(1);
  }
  registry.fileKey = fileKey;
  registry.components = registry.components && typeof registry.components === 'object' ? registry.components : {};
  const record = { nodeId, key, pageName, publishedAt, version, cvaHash: cvaHash ?? null };
  if (composedChildVersions && typeof composedChildVersions === 'object') {
    record.composedChildVersions = composedChildVersions;
  }
  registry.components[component] = record;
  await writeFile(regPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  process.stdout.write(`merged registry component "${component}" → ${regPath}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.message || e}\n`);
  process.exit(1);
});
