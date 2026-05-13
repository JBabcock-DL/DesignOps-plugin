#!/usr/bin/env node
/**
 * Ensures embedded MANIFEST in foundations-shell.figma.js stays aligned with
 * skills/shared/designops-foundations-shell.json (Tier 3 spec — single manifest authority).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'skills/shared/designops-foundations-shell.json');
const jsPath = join(root, 'skills/create-design-system/phases/foundations-shell.figma.js');

const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
const js = readFileSync(jsPath, 'utf8');

if (!json.manifestVersion) {
  console.error('qa-foundations-shell-manifest: JSON missing manifestVersion');
  process.exit(1);
}

const mvMatch = js.match(/manifestVersion:\s*'([^']*)'/);
if (!mvMatch || mvMatch[1] !== json.manifestVersion) {
  console.error(
    `qa-foundations-shell-manifest: manifestVersion mismatch JSON=${json.manifestVersion} embedded=${mvMatch?.[1] ?? '(missing)'}`,
  );
  process.exit(1);
}

const manifestStart = js.indexOf('const MANIFEST = ');
const manifestEnd = js.indexOf('\nfunction hasHeaderOnPage', manifestStart);
if (manifestStart < 0 || manifestEnd < 0) {
  console.error('qa-foundations-shell-manifest: could not locate MANIFEST block');
  process.exit(1);
}
const manifestBlock = js.slice(manifestStart, manifestEnd);
const slugInBlock = [...manifestBlock.matchAll(/pageSlug:\s*'([^']+)'/g)].map((m) => m[1]);
if (slugInBlock.length !== json.shellPages.length) {
  console.error(
    `qa-foundations-shell-manifest: shellPages count mismatch JSON=${json.shellPages.length} embedded pageSlugs=${slugInBlock.length}`,
  );
  process.exit(1);
}

for (let i = 0; i < json.shellPages.length; i++) {
  const row = json.shellPages[i];
  if (slugInBlock[i] !== row.pageSlug) {
    console.error(
      `qa-foundations-shell-manifest: pageSlug order mismatch at ${i}: JSON=${row.pageSlug} embedded=${slugInBlock[i]}`,
    );
    process.exit(1);
  }
  if (!manifestBlock.includes(`pageSlug: '${row.pageSlug}'`)) {
    console.error(`qa-foundations-shell-manifest: missing pageSlug ${row.pageSlug}`);
    process.exit(1);
  }
  if (!manifestBlock.includes(`displayTitle: '${row.displayTitle}'`)) {
    console.error(`qa-foundations-shell-manifest: missing displayTitle for ${row.pageSlug}`);
    process.exit(1);
  }
  if (!manifestBlock.includes(`headerTitle: '${row.headerTitle}'`)) {
    console.error(`qa-foundations-shell-manifest: missing headerTitle for ${row.pageSlug}`);
    process.exit(1);
  }
  if (!manifestBlock.includes(row.headerDescription)) {
    console.error(`qa-foundations-shell-manifest: missing headerDescription for ${row.pageSlug}`);
    process.exit(1);
  }
  for (const cand of row.legacyNameCandidates || []) {
    if (cand && !manifestBlock.includes(`'${cand}'`)) {
      console.error(`qa-foundations-shell-manifest: missing legacyNameCandidates entry for ${row.pageSlug}: ${cand}`);
      process.exit(1);
    }
  }
}

const preflightPath = join(root, 'skills/create-design-system/phases/preflight-snapshot.figma.js');
const preflightJs = readFileSync(preflightPath, 'utf8');
const legacyBlock = preflightJs.match(/const LEGACY_DISPLAY_TITLES = \[([\s\S]*?)\];/);
if (!legacyBlock) {
  console.error('qa-foundations-shell-manifest: LEGACY_DISPLAY_TITLES not found in preflight-snapshot.figma.js');
  process.exit(1);
}
const legacyTitles = [...legacyBlock[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
const displayTitlesFromJson = json.shellPages.map((r) => r.displayTitle);
if (
  legacyTitles.length !== displayTitlesFromJson.length ||
  legacyTitles.some((t, i) => t !== displayTitlesFromJson[i])
) {
  console.error(
    'qa-foundations-shell-manifest: LEGACY_DISPLAY_TITLES must match shellPages[].displayTitle order from JSON',
  );
  console.error('  preflight:', legacyTitles);
  console.error('  json:     ', displayTitlesFromJson);
  process.exit(1);
}

console.log('qa-foundations-shell-manifest: OK');
