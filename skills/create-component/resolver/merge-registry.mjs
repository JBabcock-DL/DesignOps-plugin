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

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
  const raw = await readFile(entryPath, 'utf8');
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
