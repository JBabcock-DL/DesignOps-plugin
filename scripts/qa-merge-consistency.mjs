#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/qa-merge-consistency.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Integration tests for the fail-fast guards added to:
//   - merge-create-component-handoff.mjs (exit 14, 15, 16, 18)
//   - assemble-slice.mjs                  (exit 17)
//   - resume-handoff.mjs                  (DAG replay)
//   - validatePhaseStateSchema (unit)
//
// Each test sets up a temp dir under os.tmpdir(), seeds files, spawns the
// script under test, and asserts the exit code + a substring of stderr.
//
// Run via:  npm run qa:merge-consistency  (also wired into npm run verify)
//
// Exit 0 if all tests pass; non-zero with a summary if any fail.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  validatePhaseStateSchema,
  SLUG_ORDER,
  FIRST_DRAW_SLUG,
} from './merge-create-component-handoff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const NODE = process.execPath;
const MERGE = join(REPO_ROOT, 'scripts', 'merge-create-component-handoff.mjs');
const ASSEMBLE = join(REPO_ROOT, 'scripts', 'assemble-slice.mjs');
const RESUME = join(REPO_ROOT, 'scripts', 'resume-handoff.mjs');

let failures = 0;
let passed = 0;

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `cc-qa-${prefix}-`));
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function spawnNode(scriptPath, args = [], opts = {}) {
  return spawnSync(NODE, [scriptPath, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS  ${msg}`); }
  else { failures++; console.error(`  FAIL  ${msg}`); }
}

function assertExit(result, expected, label) {
  if (result.status === expected) {
    passed++;
    console.log(`  PASS  ${label} → exit ${expected}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label} → expected exit ${expected}, got ${result.status}`);
    if (result.stderr) console.error(`        stderr: ${result.stderr.split('\n').slice(0, 3).join(' | ')}`);
    if (result.stdout) console.error(`        stdout: ${result.stdout.split('\n').slice(0, 3).join(' | ')}`);
  }
}

function assertStderrIncludes(result, needle, label) {
  if ((result.stderr || '').includes(needle)) {
    passed++;
    console.log(`  PASS  ${label} → stderr includes "${needle}"`);
  } else {
    failures++;
    console.error(`  FAIL  ${label} → stderr does NOT include "${needle}"`);
    console.error(`        stderr was: ${(result.stderr || '').slice(0, 200)}`);
  }
}

const cleanups = [];
function trackTmp(dir) { cleanups.push(dir); return dir; }
process.on('exit', () => {
  for (const d of cleanups) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ─── 1. validatePhaseStateSchema unit tests ───────────────────────────────────
console.log('\n[1] validatePhaseStateSchema');

assert(
  validatePhaseStateSchema({
    lastSliceOk: null, completedSlugs: [], nextSlug: FIRST_DRAW_SLUG, lastCodeSha256: null,
  }).length === 0,
  'fresh-draw shape passes',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'cc-doc-scaffold-shell',
    completedSlugs: ['cc-doc-scaffold-shell'],
    nextSlug: 'cc-doc-scaffold-header',
    lastCodeSha256: 'a'.repeat(64),
  }).length === 0,
  'mid-draw shape with valid sha passes',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'cc-doc-finalize',
    completedSlugs: SLUG_ORDER,
    nextSlug: null,
    lastCodeSha256: 'b'.repeat(64),
  }).length === 0,
  'completed shape passes (nextSlug=null at terminal)',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'cc-doc-finalize', completedSlugs: SLUG_ORDER, nextSlug: null,
    lastCodeSha256: 'pending',
  }).some((e) => e.includes('lastCodeSha256')),
  'placeholder lastCodeSha256 rejected',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'cc-doc-component',
    completedSlugs: [
      'cc-doc-scaffold-shell',
      'cc-doc-scaffold-header',
      'cc-doc-scaffold-table',
      'cc-doc-scaffold-placeholders',
      'cc-variants',
      'cc-doc-component',
    ],
    nextSlug: 'cc-doc-matrix',  // wrong — should be cc-doc-props
    lastCodeSha256: 'c'.repeat(64),
  }).some((e) => e.includes('nextSlug')),
  'wrong nextSlug for lastSliceOk rejected',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'cc-variants',
    completedSlugs: ['cc-doc-scaffold-shell', 'cc-doc-component'],  // not contiguous prefix
    nextSlug: 'cc-doc-component',
    lastCodeSha256: 'd'.repeat(64),
  }).some((e) => e.includes('contiguous SLUG_ORDER prefix')),
  'non-contiguous completedSlugs rejected',
);

assert(
  validatePhaseStateSchema({
    lastSliceOk: 'not-a-slug', completedSlugs: [], nextSlug: null, lastCodeSha256: null,
  }).some((e) => e.includes('lastSliceOk')),
  'unknown slug rejected',
);

// ─── 2. merge: orphan return-*.json detection (exit 15) ──────────────────────
console.log('\n[2] merge — exit 15 (orphan return files)');
{
  const dir = trackTmp(makeTmpDir('orphan'));
  // Fresh draw: handoff = {}, no phase-state, but return-cc-variants.json exists
  // (orphaned from a previous failed run that skipped scaffold's merge).
  writeJson(join(dir, 'handoff.json'), {});
  writeJson(join(dir, 'return-cc-variants.json'), {
    variantHolderId: '1:1', propsAdded: {}, unresolvedTokenMisses: [],
  });
  const ret = {
    pageContentId: '1:2', docRootId: '1:3',
  };
  writeJson(join(dir, 'return-cc-doc-scaffold-shell.json'), ret);

  const r = spawnNode(MERGE, [
    'cc-doc-scaffold-shell', join(dir, 'handoff.json'), join(dir, 'return-cc-doc-scaffold-shell.json'),
  ]);
  assertExit(r, 15, 'orphan cc-variants return triggers exit 15');
  assertStderrIncludes(r, 'stale return-*.json', 'exit 15 message names the issue');
  assertStderrIncludes(r, 'resume-handoff.mjs', 'exit 15 suggests resume-handoff');
}

// ─── 3. merge: duplicate-merge / corruption (exit 14, 16) ────────────────────
console.log('\n[3] merge — exit 14 (duplicate)');
{
  const dir = trackTmp(makeTmpDir('dup'));
  writeJson(join(dir, 'handoff.json'), { doc: { pageContentId: '1:2', docRootId: '1:3' } });
  writeJson(join(dir, 'phase-state.json'), {
    component: 'test', fileKey: 'k1',
    lastSliceOk: 'cc-doc-scaffold-shell',
    completedSlugs: ['cc-doc-scaffold-shell'],
    nextSlug: 'cc-doc-scaffold-header',
    lastCodeSha256: 'a'.repeat(64),
  });
  writeJson(join(dir, 'return-cc-doc-scaffold-shell.json'), {
    pageContentId: '1:2', docRootId: '1:3',
  });
  const r = spawnNode(MERGE, [
    'cc-doc-scaffold-shell', join(dir, 'handoff.json'), join(dir, 'return-cc-doc-scaffold-shell.json'),
  ]);
  assertExit(r, 14, 'duplicate merge triggers exit 14');
}

// ─── 4. merge: phase-state schema violation (exit 18) ────────────────────────
console.log('\n[4] merge — exit 18 (schema violation)');
{
  const dir = trackTmp(makeTmpDir('schema'));
  writeJson(join(dir, 'handoff.json'), {});
  writeJson(join(dir, 'phase-state.json'), {
    lastSliceOk: 'cc-doc-finalize', completedSlugs: SLUG_ORDER, nextSlug: null,
    lastCodeSha256: 'pending',  // <-- violation
  });
  writeJson(join(dir, 'return-cc-doc-scaffold-shell.json'), {
    pageContentId: '1:2', docRootId: '1:3',
  });
  const r = spawnNode(MERGE, [
    'cc-doc-scaffold-shell', join(dir, 'handoff.json'), join(dir, 'return-cc-doc-scaffold-shell.json'),
  ]);
  assertExit(r, 18, 'placeholder lastCodeSha256 triggers exit 18');
  assertStderrIncludes(r, 'lastCodeSha256', 'exit 18 message names the offending field');
}

// ─── 5. assemble-slice: non-canonical sibling guard (exit 17) ────────────────
console.log('\n[5] assemble-slice — exit 17 (non-canonical sibling)');
{
  const dir = trackTmp(makeTmpDir('noncanon'));
  // Seed minimal inputs
  writeJson(join(dir, '.designops-registry.json'), { fileKey: 'k1', components: {} });
  writeFileSync(join(dir, 'config-block.js'), '// minimal\nconst CONFIG = { component: "test", layout: "chip" };\n', 'utf8');
  // Place a non-canonical sibling
  writeJson(join(dir, 'mcp-invoke-use-figma.json'), { stale: true });
  // Run assemble-slice — it should detect the sibling and exit 17 BEFORE reaching engine assembly,
  // assuming the engine path is required; but the guard runs after assembly. To guarantee exit 17
  // path, we expect the script to fail earlier with exit 3 (missing engine) UNLESS the project root
  // has the engine. To isolate, just check that the guard FUNCTION fires when triggered: pass
  // realistic args that get to the guard.
  //
  // Simpler approach: confirm that with all valid inputs the guard fires. We assemble against the
  // real plugin templates so the engine is present.
  const outPath = join(dir, 'out.js');
  const mcpArgsPath = join(dir, 'mcp-cc-doc-scaffold-shell.json');
  const r = spawnNode(ASSEMBLE, [
    '--step', 'cc-doc-scaffold-shell',
    '--layout', 'control',
    '--config-block', join(dir, 'config-block.js'),
    '--registry', join(dir, '.designops-registry.json'),
    '--handoff', '{}',
    '--file-key', 'k1',
    '--out', outPath,
    '--emit-mcp-args', mcpArgsPath,
  ]);
  assertExit(r, 17, 'non-canonical sibling triggers exit 17');
  assertStderrIncludes(r, 'mcp-invoke-use-figma.json', 'exit 17 names the offending file');
}

// ─── 6. resume-handoff: replay orphans + report next slug ────────────────────
console.log('\n[6] resume-handoff — replays orphans, reports next slug');
{
  const dir = trackTmp(makeTmpDir('resume'));
  const ret = { pageContentId: '1:2', docRootId: '1:3' };
  const varRet = { variantHolderId: '1:9', propsAdded: { label: true }, unresolvedTokenMisses: [] };
  writeJson(join(dir, 'handoff.json'), {});
  writeJson(join(dir, 'return-cc-doc-scaffold-shell.json'), ret);
  writeJson(join(dir, 'return-cc-doc-scaffold-header.json'), ret);
  writeJson(join(dir, 'return-cc-doc-scaffold-table.json'), ret);
  writeJson(join(dir, 'return-cc-doc-scaffold-placeholders.json'), ret);
  writeJson(join(dir, 'return-cc-variants.json'), varRet);
  // Dry-run first
  const dry = spawnNode(RESUME, [dir, '--dry-run']);
  assertExit(dry, 0, 'resume --dry-run exits 0');
  assertStderrIncludes({ stderr: dry.stdout }, 'to replay', 'dry-run reports plan');

  // Real replay
  const r = spawnNode(RESUME, [dir]);
  assertExit(r, 0, 'resume replays orphans → exit 0');
  if (!r.stdout.includes('next slug: cc-doc-component')) {
    failures++;
    console.error(`  FAIL  resume reports next slug after replay (got: ${r.stdout.slice(-200)})`);
  } else {
    passed++;
    console.log('  PASS  resume reports next slug after replay');
  }
}

// ─── 7. resume-handoff: handoff={} but phase-state claims progress ───────────
console.log('\n[7] resume-handoff — state mismatch (exit 1)');
{
  const dir = trackTmp(makeTmpDir('mismatch'));
  writeJson(join(dir, 'handoff.json'), {});
  writeJson(join(dir, 'phase-state.json'), {
    component: 'test', fileKey: 'k1',
    lastSliceOk: 'cc-doc-scaffold-shell',
    completedSlugs: ['cc-doc-scaffold-shell'],
    nextSlug: 'cc-doc-scaffold-header',
    lastCodeSha256: 'a'.repeat(64),
  });
  const r = spawnNode(RESUME, [dir]);
  assertExit(r, 1, 'handoff={} with non-empty phase-state triggers exit 1');
  assertStderrIncludes(r, 'state mismatch', 'mismatch message present');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────────`);
console.log(`qa:merge-consistency: ${passed} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
