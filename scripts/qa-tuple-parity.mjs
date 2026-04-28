#!/usr/bin/env node
/**
 * qa-tuple-parity.mjs — golden parity scaffolding for tuple-first delegated migration ([24] roadmap).
 *
 * For each delegated slug: verifies delegated *.min.figma.js exists, measures UTF-8 bytes,
 * confirms generate-ops assembleOpsBody emits identical engine bytes for that slug (delegated path),
 * and runs check-payload on the delegated engine body offline.
 *
 * Usage:
 *   node scripts/qa-tuple-parity.mjs [--config scripts/test-fixtures/min-op-scaffold.config.mjs]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getDelegatedMinRelPath } from './op-generators/lib/delegate-legacy-min.mjs';
import { assembleOpsBody, loadConfigFromFile } from './generate-ops.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const DELEGATED_SLUGS = [
  'cc-doc-component',
  'cc-doc-props-1',
  'cc-doc-props-2',
  'cc-doc-matrix',
  'cc-doc-usage',
  'cc-doc-finalize',
  'cc-variants',
];

function bytes(s) {
  return Buffer.byteLength(s, 'utf8');
}

function runCheckPayload(codePath) {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/check-payload.mjs'), codePath], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return r.status === 0;
}

async function main() {
  const argv = process.argv.slice(2);
  let configPath = join(REPO_ROOT, 'scripts/test-fixtures/min-op-scaffold.config.mjs');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') configPath = resolve(argv[++i]);
  }

  const config = await loadConfigFromFile(configPath);

  const reportDir = join(REPO_ROOT, '.designops', 'qa-tuple-parity');
  mkdirSync(reportDir, { recursive: true });

  const rows = [];

  for (const slug of DELEGATED_SLUGS) {
    const layout = slug === 'cc-variants' ? 'control' : undefined;
    const rel = getDelegatedMinRelPath(slug, slug === 'cc-variants' ? layout : undefined, REPO_ROOT);
    if (!rel) {
      console.error(`qa-tuple-parity: no delegate mapping for ${slug}`);
      process.exit(1);
    }
    const absBlob = join(REPO_ROOT, rel);
    if (!existsSync(absBlob)) {
      console.error(`qa-tuple-parity: delegated min missing (npm run build:min): ${absBlob}`);
      process.exit(1);
    }
    const rawBlob = readFileSync(absBlob, 'utf8');
    const blobBytes = bytes(rawBlob);

    const body = assembleOpsBody({
      slug,
      config,
      layout,
      pluginRoot: REPO_ROOT,
      budget: null,
    });
    const assembleBytes = bytes(body);
    const bytesMatch = body === rawBlob;

    if (!bytesMatch) {
      console.error(
        `qa-tuple-parity: assembleOpsBody must match delegated min byte-for-byte for ${slug}; got assemble=${assembleBytes}B file=${blobBytes}B`,
      );
      process.exit(1);
    }

    const tmpJs = join(reportDir, `engine-${slug}.code.js`);
    writeFileSync(tmpJs, body, 'utf8');
    if (!runCheckPayload(tmpJs)) {
      console.error(`qa-tuple-parity: check-payload failed for ${slug}`);
      process.exit(1);
    }

    rows.push({
      slug,
      layout: slug === 'cc-variants' ? layout : null,
      delegatedFile: rel,
      delegatedMinBytes: blobBytes,
      assembleOpsBodyBytes: assembleBytes,
      bytesMatch,
    });
  }

  const outPath = join(reportDir, 'tuple-parity-report.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        configPath,
        portOrderNote:
          'Migrate order: cc-doc-component (step2), then cc-doc-matrix/usage/finalize/props splits, cc-variants step0 last — see skills/create-component/conventions/24-tuple-expand-delegated-roadmap.md',
        slugs: rows,
        summary:
          'Delegating path emits the same *.min.figma.js bytes as filesystem read. Shrinking payloads requires emitting compact ops + interpreter.',
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`qa-tuple-parity: OK  report=${outPath}`);
  for (const r of rows) {
    console.log(`  ${r.slug}: delegatedMin=${r.delegatedMinBytes}B match=${r.bytesMatch}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
