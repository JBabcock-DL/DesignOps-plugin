#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/resume-handoff.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Recover from a half-completed /create-component Step 6 ladder.
//
// Inspects a draw directory containing handoff.json and zero or more
// return-<slug>.json siblings, then replays any missing merges in DAG order.
// Prints `next slug: <slug>` (or `ladder complete`) so the agent knows
// exactly what to call next without reading phase-state by hand.
//
// Use cases:
//   - A session crashed/exited mid-draw and left return files unmerged.
//   - Someone manually reset handoff.json={} after returns existed (the
//     orphan check in merge would normally exit 15; resume-handoff is the
//     one-command fix it points at).
//   - You want to confirm the on-disk state is consistent before running
//     the next slice.
//
// Usage
//   node scripts/resume-handoff.mjs <draw-dir>
//   node scripts/resume-handoff.mjs <draw-dir> --dry-run
//
//   <draw-dir>  directory containing handoff.json (and phase-state.json,
//               return-*.json siblings).
//
// Exit
//   0   clean: ladder is consistent (replayed any missing merges; printed next slug).
//   1   irrecoverable: malformed JSON, schema violation we cannot rebuild,
//       or DAG impossibility (e.g. cc-doc-props on disk but cc-variants missing).
//   2   usage error or directory not found.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  SLUG_ORDER,
  STEPS,
  MergeFailure,
  mergeOne,
  listReturnFilesOnDisk,
  validatePhaseStateSchema,
} from "./merge-create-component-handoff.mjs";

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2 || args.includes("-h") || args.includes("--help")) {
  console.error(`Usage: node scripts/resume-handoff.mjs <draw-dir> [--dry-run]`);
  process.exit(2);
}

const drawDir = resolve(args[0]);
const dryRun = args.includes("--dry-run");

if (!existsSync(drawDir)) {
  console.error(`resume-handoff: directory not found: ${drawDir}`);
  process.exit(2);
}
const handoffPath = join(drawDir, "handoff.json");
const phaseStatePath = join(drawDir, "phase-state.json");

if (!existsSync(handoffPath)) {
  console.error(`resume-handoff: no handoff.json in ${drawDir}`);
  process.exit(2);
}

const onDisk = await listReturnFilesOnDisk(drawDir);
const onDiskSlugs = SLUG_ORDER.filter((s) => onDisk.has(s));

let phaseState = null;
if (existsSync(phaseStatePath)) {
  try {
    phaseState = JSON.parse(await readFile(phaseStatePath, "utf8"));
  } catch (e) {
    console.error(`resume-handoff: phase-state parse error: ${e.message}`);
    process.exit(1);
  }
  const errs = validatePhaseStateSchema(phaseState);
  if (errs.length) {
    console.error(`resume-handoff: phase-state schema violation:\n  - ${errs.join("\n  - ")}`);
    console.error(
      `\nIf you intentionally reset state, delete ${phaseStatePath} and re-run resume-handoff.`,
    );
    process.exit(1);
  }
}

// What's already merged?
const completedSet = new Set(phaseState?.completedSlugs ?? []);

// Slugs to replay = on-disk return files NOT in completedSlugs, in DAG order.
const toReplay = onDiskSlugs.filter((s) => !completedSet.has(s));

// Validate DAG contiguity: replay set must form a contiguous prefix-extension.
// I.e., the first replay slug must be SLUG_ORDER[completedSet.size], and
// each subsequent replay slug must be the next in SLUG_ORDER.
if (toReplay.length > 0) {
  const firstExpected = SLUG_ORDER[completedSet.size];
  if (toReplay[0] !== firstExpected) {
    console.error(
      `resume-handoff: cannot replay — first orphan slug is ${toReplay[0]} but DAG expects ${firstExpected} next.`,
    );
    console.error(`  completed (per phase-state): [${[...completedSet].join(", ") || "(none)"}]`);
    console.error(`  on disk (return-*.json):     [${onDiskSlugs.join(", ")}]`);
    console.error(`  Either the return-*.json files are out of order, or phase-state is wrong.`);
    process.exit(1);
  }
  for (let i = 1; i < toReplay.length; i++) {
    const prevIdx = SLUG_ORDER.indexOf(toReplay[i - 1]);
    if (toReplay[i] !== SLUG_ORDER[prevIdx + 1]) {
      console.error(
        `resume-handoff: cannot replay — gap in return files between ${toReplay[i - 1]} and ${toReplay[i]}.`,
      );
      console.error(
        `  Get the missing return file for ${SLUG_ORDER[prevIdx + 1]} on disk, or remove the later return files.`,
      );
      process.exit(1);
    }
  }
}

// Special case: handoff was reset to {} but phase-state lists progress.
// Detect this by comparing handoff (empty object) vs phase-state (claims
// completedSlugs). If handoff is empty AND completedSlugs is non-empty, the
// safe move is to replay ALL on-disk returns from scratch — NOT trust
// phase-state. We do this by deleting phase-state if user passes --reset.
//
// Without --reset, we just report and exit 1 (asking the user to clarify).
let handoffRaw;
try {
  handoffRaw = JSON.parse(await readFile(handoffPath, "utf8"));
} catch (e) {
  console.error(`resume-handoff: handoff.json parse error: ${e.message}`);
  process.exit(1);
}
const handoffEmpty = handoffRaw && typeof handoffRaw === "object" && Object.keys(handoffRaw).length === 0;
if (handoffEmpty && completedSet.size > 0) {
  console.error(
    `resume-handoff: state mismatch — handoff.json is {} but phase-state lists ` +
      `${completedSet.size} completed slugs. Pick one:\n` +
      `  (a) Trust phase-state: rebuild handoff by replaying ALL return-*.json files. ` +
      `Delete phase-state.json then re-run resume-handoff.\n` +
      `  (b) Trust handoff (start over): delete phase-state.json AND all return-*.json files, ` +
      `then start the ladder from ${SLUG_ORDER[0]}.`,
  );
  process.exit(1);
}

// Report
console.log(`resume-handoff: ${drawDir}`);
console.log(`  phase-state lastSliceOk: ${phaseState?.lastSliceOk ?? "(none)"}`);
console.log(`  completedSlugs:          [${[...completedSet].join(", ") || "(none)"}]`);
console.log(`  return-*.json on disk:   [${onDiskSlugs.join(", ") || "(none)"}]`);
console.log(`  to replay:               [${toReplay.join(", ") || "(none)"}]`);

if (toReplay.length === 0) {
  const last = phaseState?.lastSliceOk ?? null;
  const idx = last ? SLUG_ORDER.indexOf(last) : -1;
  const nextSlug = idx >= 0 && idx < SLUG_ORDER.length - 1 ? SLUG_ORDER[idx + 1] : null;
  if (last === null && onDiskSlugs.length === 0) {
    console.log(`\nnext slug: ${SLUG_ORDER[0]}  (fresh draw)`);
  } else if (nextSlug === null) {
    console.log(`\nladder complete  (lastSliceOk=cc-doc-finalize)`);
  } else {
    console.log(`\nnext slug: ${nextSlug}`);
  }
  process.exit(0);
}

if (dryRun) {
  console.log(`\n--dry-run: would replay ${toReplay.length} slice(s); not writing.`);
  process.exit(0);
}

// Replay each missing merge in order. Skip the consistency check inside
// mergeOne because we already validated DAG contiguity here, and the disk
// has multiple legitimate orphans we're cleaning up.
for (const slug of toReplay) {
  try {
    const r = await mergeOne({
      step: slug,
      handoffPath,
      returnPath: onDisk.get(slug),
      phaseStatePath,
      skipStaleReturnsCheck: true,
      skipPhaseStateSchemaCheck: false,
    });
    console.log(`  OK replayed ${slug} → next=${r.nextSlug ?? "(end)"}`);
  } catch (e) {
    if (e instanceof MergeFailure) {
      console.error(`resume-handoff: merge ${slug} failed (exit ${e.code}): ${e.message}`);
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  }
}

// Final state
const finalLast = toReplay[toReplay.length - 1];
const finalIdx = SLUG_ORDER.indexOf(finalLast);
const finalNext = finalIdx < SLUG_ORDER.length - 1 ? SLUG_ORDER[finalIdx + 1] : null;
if (finalNext === null) {
  console.log(`\nladder complete  (lastSliceOk=cc-doc-finalize)`);
} else {
  console.log(`\nnext slug: ${finalNext}`);
}
