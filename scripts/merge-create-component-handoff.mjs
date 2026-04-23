#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/merge-create-component-handoff.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Context optimization: merge one Figma `use_figma` return into handoff.json on
// disk so the parent thread does not need to paraphrase large JSON in chat.
// MCP transport is unchanged: only the parent calls `use_figma`. This file only
// updates parent-maintained handoff state between slices (see conventions/13).
//
// Usage
//   node scripts/merge-create-component-handoff.mjs <step> <handoff.json> <figma-return.json>
//
//   <step>        cc-variants | cc-doc-scaffold | cc-doc-props | cc-doc-component |
//                 cc-doc-matrix | cc-doc-usage | cc-doc-finalize
//   handoff.json  path to existing JSON (will be read, merged, written)
//   figma-return  JSON file: either the object returned from use_figma, or
//                 { "raw": { ... } } (slice-runner shape)
//
// Exit: 0 ok, 1 usage/merge error, 2 missing/invalid file

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const STEPS = new Set([
  "cc-variants",
  "cc-doc-scaffold",
  "cc-doc-props",
  "cc-doc-component",
  "cc-doc-matrix",
  "cc-doc-usage",
  "cc-doc-finalize",
]);

const args = process.argv.slice(2);
if (args.length !== 3 || args.includes("-h") || args.includes("--help")) {
  console.error(`Usage: node scripts/merge-create-component-handoff.mjs <step> <handoff.json> <figma-return.json>
Steps: ${[...STEPS].join(" | ")}`);
  process.exit(2);
}

const step = args[0];
const handoffPath = resolve(args[1]);
const returnPath = resolve(args[2]);
if (!STEPS.has(step)) {
  console.error(`merge-create-component-handoff: unknown step "${step}"`);
  process.exit(1);
}
if (!existsSync(handoffPath) || !existsSync(returnPath)) {
  console.error("merge-create-component-handoff: handoff or return file missing");
  process.exit(2);
}

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

/** Figma return payload (or raw inner object). */
const payload = retWrapper?.raw && typeof retWrapper.raw === "object" ? retWrapper.raw : retWrapper;

if (step === "cc-variants") {
  const compSetId = payload?.compSetId;
  if (typeof compSetId !== "string" || !compSetId.length) {
    console.error(
      "merge-create-component-handoff: cc-variants return missing compSetId (string). Refusing to clobber afterVariants.",
    );
    process.exit(1);
  }
  handoff.afterVariants = {
    compSetId,
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
  if (typeof compSetId !== "string" || !compSetId.length) missing.push("compSetId");
  if (missing.length) {
    console.error(
      `merge-create-component-handoff: doc slice return missing: ${missing.join(", ")}. Refusing to write partial handoff.doc.`,
    );
    process.exit(1);
  }
  handoff.doc = {
    ...(handoff.doc && typeof handoff.doc === "object" ? handoff.doc : {}),
    pageContentId,
    docRootId,
    compSetId,
  };
}

try {
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2) + "\n", "utf8");
} catch (e) {
  console.error(`merge-create-component-handoff: write: ${e.message}`);
  process.exit(1);
}

console.log(`OK  merged ${step} into ${handoffPath}`);
