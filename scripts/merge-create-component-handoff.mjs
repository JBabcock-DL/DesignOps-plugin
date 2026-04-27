#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/merge-create-component-handoff.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Context optimization: merge one Figma `use_figma` return into handoff.json on
// disk so the parent thread does not need to paraphrase large JSON in chat.
// MCP transport is unchanged: only the parent calls `use_figma`. This file only
// updates parent-maintained handoff state between slices (see conventions/13).
//
// Also updates phase-state.json next to handoff (or at optional path) for
// mid-draw resume — see 13 §4 and phases 04–10.
//
// Usage
//   node scripts/merge-create-component-handoff.mjs <step> <handoff.json> <figma-return.json> [phase-state.json]
//
//   <step>        cc-doc-scaffold | cc-variants | cc-doc-component | cc-doc-props |
//                 cc-doc-matrix | cc-doc-usage | cc-doc-finalize
//   handoff.json  path to existing JSON (will be read, merged, written)
//   figma-return  JSON file: either the object returned from use_figma, or
//                 { "raw": { ... } } (slice-runner shape)
//   phase-state   optional; default = dirname(handoff)/phase-state.json
//
// Exit: 0 ok, 1 usage/merge error, 2 missing/invalid file, 13 DAG order, 14 duplicate step
//
// Ordering: run this script **after** the Figma return file is flushed to disk (e.g. do not
// shell-merge in the same message as a chat `Write` to that path until the write has
// completed; chained `Write` then `run_terminal_cmd` in one assistant turn is fine).

import { readFile, writeFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";

const SLUG_ORDER = [
  "cc-doc-scaffold",
  "cc-variants",
  "cc-doc-component",
  "cc-doc-props",
  "cc-doc-matrix",
  "cc-doc-usage",
  "cc-doc-finalize",
];

const STEPS = new Set(SLUG_ORDER);

const FILE_WAIT_RETRIES = 3;
const FILE_WAIT_MS = 100;

function sleep(ms) {
  return new Promise((resolveFn) => setTimeout(resolveFn, ms));
}

/** Handovers after parallel `Write` in the same process can see ENOENT momentarily (Windows/FS). */
async function waitForFilePresent(path, label) {
  let lastErr;
  for (let i = 0; i < FILE_WAIT_RETRIES; i++) {
    try {
      await access(path);
      return;
    } catch (e) {
      lastErr = e;
      if (e?.code && e.code !== "ENOENT") {
        console.error(`merge-create-component-handoff: ${label} not accessible: ${e.message} — ${path}`);
        process.exit(2);
      }
      if (i < FILE_WAIT_RETRIES - 1) await sleep(FILE_WAIT_MS);
    }
  }
  console.error(
    `merge-create-component-handoff: missing file after ${FILE_WAIT_RETRIES} attempts: ${label} — ${path} (${lastErr?.code ?? lastErr})`,
  );
  process.exit(2);
}

function pred(slug) {
  const i = SLUG_ORDER.indexOf(slug);
  if (i <= 0) return null;
  return SLUG_ORDER[i - 1];
}

const args = process.argv.slice(2);
if (args.length < 3 || args.length > 4 || args.includes("-h") || args.includes("--help")) {
  console.error(`Usage: node scripts/merge-create-component-handoff.mjs <step> <handoff.json> <figma-return.json> [phase-state.json]
Steps: ${[...STEPS].join(" | ")}`);
  process.exit(2);
}

const step = args[0];
const handoffPath = resolve(args[1]);
const returnPath = resolve(args[2]);
const phaseStatePath = args[3]
  ? resolve(args[3])
  : join(dirname(handoffPath), "phase-state.json");
if (!STEPS.has(step)) {
  console.error(`merge-create-component-handoff: unknown step "${step}"`);
  process.exit(1);
}
await waitForFilePresent(handoffPath, "handoff.json");
await waitForFilePresent(returnPath, "figma return");

let handoff;
let retWrapper;
try {
  handoff = JSON.parse(await readFile(handoffPath, "utf8"));
} catch (e) {
  console.error(`merge-create-component-handoff: handoff parse: ${e.message}`);
  process.exit(1);
}
try {
  retWrapper = JSON.parse(await readFile(returnPath, "utf8"));
} catch (e) {
  console.error(`merge-create-component-handoff: return parse: ${e.message}`);
  process.exit(1);
}

if (typeof handoff !== "object" || handoff === null || Array.isArray(handoff)) {
  handoff = {};
}

let phaseState = null;
if (existsSync(phaseStatePath)) {
  try {
    const raw = await readFile(phaseStatePath, "utf8");
    phaseState = JSON.parse(raw);
  } catch (e) {
    console.error(`merge-create-component-handoff: phase-state parse: ${e.message}`);
    process.exit(1);
  }
}

if (phaseState && phaseState.lastSliceOk === step) {
  console.error(
    `merge-create-component-handoff: ${step} already recorded as lastSliceOk in ${phaseStatePath} (duplicate merge)`,
  );
  process.exit(14);
}

const needPrev = pred(step);
if (needPrev === null) {
  if (step !== "cc-doc-scaffold") {
    console.error(`merge-create-component-handoff: first draw slice must be cc-doc-scaffold, got ${step}`);
    process.exit(13);
  }
  if (phaseState && Array.isArray(phaseState.completedSlugs) && phaseState.completedSlugs.length > 0) {
    console.error(
      "merge-create-component-handoff: phase-state shows progress but merge requests cc-doc-scaffold — " +
        "refusing to clobber. Delete phase-state.json to restart or merge the correct next step.",
    );
    process.exit(13);
  }
} else {
  if (!phaseState || phaseState.lastSliceOk !== needPrev) {
    console.error(
      `merge-create-component-handoff: DAG order violation — need lastSliceOk=${needPrev} before ${step}, ` +
        `got ${phaseState ? JSON.stringify(phaseState.lastSliceOk) : "no phase-state"}.`,
    );
    process.exit(13);
  }
}

/** Figma return payload (or raw inner object). */
const payload = retWrapper?.raw && typeof retWrapper.raw === "object" ? retWrapper.raw : retWrapper;

if (step === "cc-variants") {
  const variantHolderId = payload?.variantHolderId;
  if (typeof variantHolderId !== "string" || !variantHolderId.length) {
    console.error(
      "merge-create-component-handoff: cc-variants return missing variantHolderId (string). Refusing to clobber afterVariants.",
    );
    process.exit(1);
  }
  handoff.afterVariants = {
    variantHolderId,
    propsAdded: payload.propsAdded && typeof payload.propsAdded === "object" ? payload.propsAdded : {},
    unresolvedTokenMisses: Array.isArray(payload.unresolvedTokenMisses) ? payload.unresolvedTokenMisses : [],
  };
} else {
  const pageContentId = payload?.pageContentId;
  const docRootId = payload?.docRootId;
  const compSetId = payload?.compSetId;
  const missing = [];
  if (typeof pageContentId !== "string" || !pageContentId.length) missing.push("pageContentId");
  if (typeof docRootId !== "string" || !docRootId.length) missing.push("docRootId");
  if (missing.length) {
    console.error(
      `merge-create-component-handoff: doc slice return missing: ${missing.join(", ")}. Refusing to write partial handoff.doc.`,
    );
    process.exit(1);
  }
  const prevDoc = handoff.doc && typeof handoff.doc === "object" ? handoff.doc : {};
  handoff.doc = {
    ...prevDoc,
    pageContentId,
    docRootId,
  };
  if (typeof compSetId === "string" && compSetId.length) {
    handoff.doc.compSetId = compSetId;
  }
}

const handoffJson = JSON.stringify(handoff, null, 2) + "\n";
const lastCodeSha256 = createHash("sha256").update(handoffJson, "utf8").digest("hex");

let component = null;
if (typeof handoff.component === "string") {
  component = handoff.component;
} else if (typeof handoff.__createComponentName === "string") {
  component = handoff.__createComponentName;
}

const idx = SLUG_ORDER.indexOf(step);
const nextSlug = idx >= 0 && idx < SLUG_ORDER.length - 1 ? SLUG_ORDER[idx + 1] : null;
const completedSlugs = SLUG_ORDER.slice(0, idx + 1);

const nextPhase = {
  component: component ?? (phaseState && phaseState.component) ?? null,
  fileKey: (phaseState && phaseState.fileKey) ?? (typeof handoff.fileKey === "string" ? handoff.fileKey : null),
  lastSliceOk: step,
  nextSlug,
  completedSlugs,
  lastCodeSha256,
  lastUpdated: new Date().toISOString(),
};

try {
  await writeFile(handoffPath, handoffJson, "utf8");
} catch (e) {
  console.error(`merge-create-component-handoff: write: ${e.message}`);
  process.exit(1);
}
try {
  await writeFile(phaseStatePath, JSON.stringify(nextPhase, null, 2) + "\n", "utf8");
} catch (e) {
  console.error(`merge-create-component-handoff: phase-state write: ${e.message}`);
  process.exit(1);
}

console.log(`OK  merged ${step} into ${handoffPath}`);
console.log(`    phase-state → ${phaseStatePath}  next=${nextSlug ?? "null"}`);
