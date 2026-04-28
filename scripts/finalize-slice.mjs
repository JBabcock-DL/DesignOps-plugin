#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/finalize-slice.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Atomic write-then-merge wrapper for one /create-component Step 6 slice.
// Replaces the two-step "Write return-<slug>.json + run merge" pattern with
// one command — saves one tool call per slice (× 12 slices = 12 fewer round
// trips per component draw).
//
// Use this AFTER the parent's `use_figma` / `call_mcp` returns (success `{ok:true}` or
// structured fail `{ok:false, why, remediation}`).
// Pipe the return JSON in (recommended for large returns) or pass --return-json
// inline (small returns only — Windows shells cap argv around ~32 KB).
//
// Usage
//   # Write from stdin (preferred)
//   echo '<return-json>' | node scripts/finalize-slice.mjs <slug> <handoff.json>
//
//   # Or write inline (small returns only)
//   node scripts/finalize-slice.mjs <slug> <handoff.json> --return-json '<return-json>'
//
//   # Or merge an already-written file
//   node scripts/finalize-slice.mjs <slug> <handoff.json> --return-path return-<slug>.json
//
//   Optional: [--phase-state <path>]  default = dirname(handoff)/phase-state.json
//             [--keep-return]         do not delete return file after successful merge
//                                     (default: keep on disk for resume-handoff)
//
//   <slug>  cc-doc-scaffold-shell | … | cc-doc-finalize
//           cc-doc-matrix   | cc-doc-usage | cc-doc-finalize
//
// Exit codes propagate from mergeOne (merge-create-component-handoff.mjs):
//   0   ok
//   1   write or merge error
//   2   missing/invalid file or bad CLI
//   13  DAG order violation
//   14  duplicate step
//   15  stale return-*.json files (orphans from skipped merges)
//   16  state corruption
//   18  phase-state schema violation
//   19  Figma slice returned ok:false (handoff unchanged)
// Notes
//   - Uses waitForFilePresent inside mergeOne, so a fresh write is safe.
//   - The return JSON written here uses the canonical name `return-<slug>.json`
//     in dirname(handoff). resume-handoff and the orphan check key off this.
//   - If the input return JSON is wrapped as { "raw": {...} } (slice-runner
//     format) or bare {...} (direct use_figma return), both work — mergeOne
//     handles unwrap.

import { writeFile, readFile, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

import {
  STEPS,
  isValidStepSlug,
  MergeFailure,
  mergeOne,
} from './merge-create-component-handoff.mjs';

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('-h') || args.includes('--help')) {
  console.error(
    `Usage:\n` +
    `  echo '<return-json>' | node scripts/finalize-slice.mjs <slug> <handoff.json> [options]\n` +
    `  node scripts/finalize-slice.mjs <slug> <handoff.json> --return-json '<json>' [options]\n` +
    `  node scripts/finalize-slice.mjs <slug> <handoff.json> --return-path <path>   [options]\n` +
    `\nOptions:\n` +
    `  --phase-state <path>  default = dirname(handoff)/phase-state.json\n` +
    `  --keep-return         do not delete the return file after merge\n` +
    `\nSteps: ${[...STEPS].join(' | ')}`,
  );
  process.exit(2);
}

const slug = args[0];
const handoffPath = resolve(args[1]);

let returnJson = null;     // string content
let returnPathArg = null;  // explicit path
let phaseStatePath = null;
let keepReturn = false;

for (let i = 2; i < args.length; i++) {
  const a = args[i];
  switch (a) {
    case '--return-json':  returnJson = args[++i] ?? ''; break;
    case '--return-path':  returnPathArg = args[++i] ?? ''; break;
    case '--phase-state':  phaseStatePath = resolve(args[++i] ?? ''); break;
    case '--keep-return':  keepReturn = true; break;
    default:
      console.error(`finalize-slice: unknown option: ${a}`);
      process.exit(2);
  }
}

if (!isValidStepSlug(slug)) {
  console.error(`finalize-slice: unknown step "${slug}"`);
  process.exit(2);
}
if (!existsSync(handoffPath)) {
  console.error(`finalize-slice: handoff.json not found: ${handoffPath}`);
  process.exit(2);
}

// ── Resolve return source ────────────────────────────────────────────────────

let returnPath;
let returnPathWasWritten = false;

if (returnPathArg) {
  // Mode: merge already-written file
  if (returnJson !== null) {
    console.error('finalize-slice: --return-path and --return-json are mutually exclusive');
    process.exit(2);
  }
  returnPath = resolve(returnPathArg);
  if (!existsSync(returnPath)) {
    console.error(`finalize-slice: --return-path not found: ${returnPath}`);
    process.exit(2);
  }
} else {
  // Mode: write then merge. Source = stdin OR --return-json
  if (returnJson === null) {
    // Read stdin
    try {
      returnJson = readFileSync(0, 'utf8');
    } catch (e) {
      console.error(`finalize-slice: failed to read stdin: ${e.message}`);
      process.exit(2);
    }
    if (!returnJson.trim()) {
      console.error('finalize-slice: stdin is empty. Pipe the return JSON or pass --return-json/--return-path.');
      process.exit(2);
    }
  }

  // Validate parseable BEFORE writing to disk so we don't leave a junk file.
  try {
    JSON.parse(returnJson);
  } catch (e) {
    console.error(`finalize-slice: return JSON is not parseable: ${e.message}`);
    process.exit(1);
  }

  returnPath = join(dirname(handoffPath), `return-${slug}.json`);
  try {
    await writeFile(returnPath, returnJson, 'utf8');
    returnPathWasWritten = true;
  } catch (e) {
    console.error(`finalize-slice: cannot write ${returnPath}: ${e.message}`);
    process.exit(1);
  }
}

// ── Run merge (mergeOne includes waitForFilePresent for our fresh write) ─────

try {
  const r = await mergeOne({
    step: slug,
    handoffPath,
    returnPath,
    phaseStatePath,
  });
  console.log(`OK  finalize-slice ${r.step}: handoff=${r.handoffPath}`);
  console.log(`    phase-state=${r.phaseStatePath}  next=${r.nextSlug ?? 'null'}`);
  if (returnPathWasWritten) {
    console.log(`    return=${returnPath}${keepReturn ? '' : ' (kept on disk; use --keep-return=false-equivalent in future to clean)'}`);
  }
  // We deliberately leave the return file in place by default so resume-handoff
  // can replay if needed. Future: add --auto-clean once the workflow is stable.
} catch (e) {
  if (e instanceof MergeFailure) {
    console.error(`finalize-slice: ${e.message}`);
    process.exit(e.code);
  }
  console.error(e);
  process.exit(1);
}
