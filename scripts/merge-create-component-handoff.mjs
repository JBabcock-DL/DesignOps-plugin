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
//   <step>        cc-doc-scaffold-shell | cc-doc-scaffold-header | … | cc-doc-finalize
//   handoff.json  path to existing JSON (will be read, merged, written)
//   figma-return  JSON file: either the object returned from use_figma, or
//                 { "raw": { ... } } (slice-runner shape)
//   phase-state   optional; default = dirname(handoff)/phase-state.json
//
// Library exports (used by resume-handoff.mjs and finalize-slice.mjs):
//   SLUG_ORDER, STEPS, pred, sleep, waitForFilePresent
//   parseFigmaReturn, mergeReturnIntoHandoff, mergeOne
//   detectStaleReturnFiles, validatePhaseStateSchema
//
// Exit: 0 ok
//       1 usage / merge / write error
//       2 missing or invalid file
//       13 DAG order violation
//       14 duplicate step
//       15 stale return-*.json files on disk (orphaned by skipped merges)
//       16 handoff/phase-state corruption (completedSlugs disagrees with disk)
//       18 phase-state schema violation
//
// Ordering: run this script **after** the Figma return file is flushed to disk (e.g. do not
// shell-merge in the same message as a chat `Write` to that path until the write has
// completed; chained `Write` then `run_terminal_cmd` in one assistant turn is fine).

import { readFile, writeFile, access, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join, basename } from "node:path";

export const SLUG_ORDER = [
  "cc-doc-scaffold-shell",
  "cc-doc-scaffold-header",
  "cc-doc-scaffold-table-chrome",
  "cc-doc-scaffold-table-body",
  "cc-doc-scaffold-placeholders",
  "cc-variants",
  "cc-doc-component",
  "cc-doc-props-1",
  "cc-doc-props-2",
  "cc-doc-matrix",
  "cc-doc-usage",
  "cc-doc-finalize",
];

/** First machine slug in the draw ladder (scaffold sub-slice 1). */
export const FIRST_DRAW_SLUG = SLUG_ORDER[0];

/** Scaffold tuple-op slugs in order, before `cc-variants` (for assembly / ops). */
export const SCAFFOLD_SUB_SLUGS = SLUG_ORDER.slice(0, SLUG_ORDER.indexOf("cc-variants"));

export const STEPS = new Set(SLUG_ORDER);

const PART_SUFFIX = /^(.+)\.part([1-9]\d*)$/;

/** Base slugs or `cc-doc-matrix.part2` style when the base is in SLUG_ORDER. */
export function isValidStepSlug(slug) {
  if (typeof slug !== "string" || !slug.length) return false;
  if (STEPS.has(slug)) return true;
  const m = slug.match(PART_SUFFIX);
  return m ? STEPS.has(m[1]) : false;
}

const FILE_WAIT_RETRIES = 3;
const FILE_WAIT_MS = 100;

export function sleep(ms) {
  return new Promise((resolveFn) => setTimeout(resolveFn, ms));
}

/** Handovers after parallel `Write` in the same process can see ENOENT momentarily (Windows/FS). */
export async function waitForFilePresent(path, label) {
  let lastErr;
  for (let i = 0; i < FILE_WAIT_RETRIES; i++) {
    try {
      await access(path);
      return;
    } catch (e) {
      lastErr = e;
      if (e?.code && e.code !== "ENOENT") {
        throw new MergeFailure(2, `${label} not accessible: ${e.message} — ${path}`);
      }
      if (i < FILE_WAIT_RETRIES - 1) await sleep(FILE_WAIT_MS);
    }
  }
  throw new MergeFailure(
    2,
    `missing file after ${FILE_WAIT_RETRIES} attempts: ${label} — ${path} (${lastErr?.code ?? lastErr})`,
  );
}

export function pred(slug) {
  const m = typeof slug === "string" ? slug.match(PART_SUFFIX) : null;
  if (m) {
    const base = m[1];
    const n = parseInt(m[2], 10);
    if (n > 1) return `${base}.part${n - 1}`;
    const bi = SLUG_ORDER.indexOf(base);
    if (bi <= 0) return null;
    return SLUG_ORDER[bi - 1];
  }
  const i = SLUG_ORDER.indexOf(slug);
  if (i <= 0) return null;
  return SLUG_ORDER[i - 1];
}

/**
 * Domain error with an exit-code; CLI maps to process.exit, library callers
 * (resume-handoff, finalize-slice) catch and present.
 */
export class MergeFailure extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ─── 1a/4. State integrity ───────────────────────────────────────────────────

const RETURN_FILE_RE = /^return-(.+)\.json$/;

/**
 * Scan `dir` for return-*.json files and return Map<slug, absolutePath>.
 * Filters to valid step slugs (`isValidStepSlug`) so unrelated files (e.g. `return-foo.json`
 * from another tool) don't trip the consistency check.
 */
export async function listReturnFilesOnDisk(dir) {
  const out = new Map();
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const m = RETURN_FILE_RE.exec(name);
    if (!m) continue;
    const slug = m[1];
    if (!isValidStepSlug(slug)) continue;
    out.set(slug, resolve(dir, name));
  }
  return out;
}

/**
 * Compare phase-state.completedSlugs with on-disk return-*.json files.
 * `currentReturnPath` is excluded from "orphan" detection because it's the
 * file we're about to merge.
 *
 * Returns:
 *   { kind: 'ok' }
 *   { kind: 'orphans', slugs: [...], paths: [...] }
 *     – disk has return-X.json for X NOT in completedSlugs (skipped merges)
 *   { kind: 'corruption', missing: [...] }
 *     – completedSlugs lists slugs whose return file is missing AND we are
 *       about to re-add one of them (means handoff was reset but disk was not)
 */
export async function detectStaleReturnFiles({
  handoffDir,
  completedSlugs,
  requestedStep,
  currentReturnPath,
}) {
  const onDisk = await listReturnFilesOnDisk(handoffDir);
  if (currentReturnPath) {
    const baseSlug = (() => {
      const m = RETURN_FILE_RE.exec(basename(currentReturnPath));
      return m ? m[1] : null;
    })();
    if (baseSlug) onDisk.delete(baseSlug);
  }

  const completedSet = new Set(completedSlugs ?? []);
  const orphans = [];
  for (const [slug, path] of onDisk) {
    if (!completedSet.has(slug) && slug !== requestedStep) orphans.push({ slug, path });
  }
  if (orphans.length > 0) {
    return { kind: "orphans", entries: orphans };
  }

  // corruption check: requestedStep already in completedSlugs and disk missing
  // its return file → handoff was reset but disk has nothing to back it up.
  if (completedSet.has(requestedStep)) {
    return { kind: "corruption", reason: "duplicate-merge", slug: requestedStep };
  }

  return { kind: "ok" };
}

// ─── 4. phase-state.json schema validator ────────────────────────────────────

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Hand-rolled schema check matching schemas/phase-state.schema.json. Returns
 * an array of human-readable error strings; empty = valid.
 *
 * Allowed top-level shapes:
 *   – fresh draw: { component, fileKey, lastSliceOk: null, nextSlug: (first in SLUG_ORDER, e.g. cc-doc-scaffold-shell),
 *                   completedSlugs: [], lastCodeSha256: null, lastUpdated }
 *   – mid draw:  lastSliceOk = a slug in SLUG_ORDER, completedSlugs = SLUG_ORDER.slice(0, idx+1),
 *                nextSlug = SLUG_ORDER[idx+1] || null, lastCodeSha256 = sha256 hex.
 *
 * The `null`-shape is also accepted (no phase-state on disk yet — caller decides).
 */
export function validatePhaseStateSchema(state) {
  const errors = [];
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    errors.push("phase-state must be a JSON object");
    return errors;
  }
  if (!("lastSliceOk" in state)) errors.push("missing required field: lastSliceOk");
  if (!("completedSlugs" in state)) errors.push("missing required field: completedSlugs");
  if (!("nextSlug" in state)) errors.push("missing required field: nextSlug");
  if (!("lastCodeSha256" in state)) errors.push("missing required field: lastCodeSha256");
  if (errors.length) return errors;

  const { lastSliceOk, completedSlugs, nextSlug, lastCodeSha256 } = state;

  if (lastSliceOk !== null && (typeof lastSliceOk !== "string" || !isValidStepSlug(lastSliceOk))) {
    errors.push(`lastSliceOk must be null or a valid step slug (got ${JSON.stringify(lastSliceOk)})`);
  }
  if (!Array.isArray(completedSlugs)) {
    errors.push("completedSlugs must be an array");
  } else {
    for (const s of completedSlugs) {
      if (typeof s !== "string" || !isValidStepSlug(s)) {
        errors.push(`completedSlugs contains invalid slug: ${JSON.stringify(s)}`);
      }
    }
  }
  if (nextSlug !== null && (typeof nextSlug !== "string" || !isValidStepSlug(nextSlug))) {
    errors.push(`nextSlug must be null or a valid step slug (got ${JSON.stringify(nextSlug)})`);
  }
  if (lastCodeSha256 !== null && (typeof lastCodeSha256 !== "string" || !SHA256_HEX.test(lastCodeSha256))) {
    errors.push("lastCodeSha256 must be null or a 64-char hex SHA-256 (no placeholders)");
  }

  if (errors.length) return errors;

  // cross-field consistency (relaxed when multi-part slugs are present)
  const hasMultipart = Array.isArray(completedSlugs) && completedSlugs.some((s) => typeof s === "string" && s.includes(".part"));
  if (Array.isArray(completedSlugs) && completedSlugs.length > 0) {
    const expectedLast = completedSlugs[completedSlugs.length - 1];
    if (lastSliceOk !== expectedLast) {
      errors.push(`lastSliceOk (${lastSliceOk}) does not match last(completedSlugs) (${expectedLast})`);
    }
    if (!hasMultipart) {
      const idx = SLUG_ORDER.indexOf(expectedLast);
      const expectedNext = idx >= 0 && idx < SLUG_ORDER.length - 1 ? SLUG_ORDER[idx + 1] : null;
      if (nextSlug !== expectedNext) {
        errors.push(`nextSlug (${nextSlug}) does not match expected (${expectedNext}) for lastSliceOk=${expectedLast}`);
      }
      const expectedCompleted = SLUG_ORDER.slice(0, idx + 1);
      if (
        completedSlugs.length !== expectedCompleted.length ||
        completedSlugs.some((s, i) => s !== expectedCompleted[i])
      ) {
        errors.push(
          `completedSlugs (${completedSlugs.join(",")}) is not a contiguous SLUG_ORDER prefix ` +
            `ending at lastSliceOk=${expectedLast}`,
        );
      }
    }
  } else if (lastSliceOk !== null) {
    errors.push("lastSliceOk is non-null but completedSlugs is empty");
  }

  return errors;
}

// ─── Pure return-payload merging (no I/O) ────────────────────────────────────

/** Unwrap slice-runner's `{ raw: ... }` shape if present. */
export function parseFigmaReturn(retWrapper) {
  return retWrapper?.raw && typeof retWrapper.raw === "object" ? retWrapper.raw : retWrapper;
}

/**
 * Apply the merge rules for a single slice. Returns the new handoff object;
 * does NOT write to disk. Throws MergeFailure(1) if the payload is missing
 * required fields.
 */
export function mergeReturnIntoHandoff({ step, handoff, payload }) {
  const next = handoff && typeof handoff === "object" && !Array.isArray(handoff) ? { ...handoff } : {};
  if (step === "cc-variants") {
    const variantHolderId = payload?.variantHolderId;
    if (typeof variantHolderId !== "string" || !variantHolderId.length) {
      throw new MergeFailure(1, "cc-variants return missing variantHolderId (string)");
    }
    next.afterVariants = {
      variantHolderId,
      propsAdded: payload.propsAdded && typeof payload.propsAdded === "object" ? payload.propsAdded : {},
      unresolvedTokenMisses: Array.isArray(payload.unresolvedTokenMisses) ? payload.unresolvedTokenMisses : [],
    };
    return next;
  }
  const pageContentId = payload?.pageContentId;
  const docRootId = payload?.docRootId;
  const compSetId = payload?.compSetId;
  const missing = [];
  if (typeof pageContentId !== "string" || !pageContentId.length) missing.push("pageContentId");
  if (typeof docRootId !== "string" || !docRootId.length) missing.push("docRootId");
  if (missing.length) {
    throw new MergeFailure(1, `doc slice return missing: ${missing.join(", ")}. Refusing to write partial handoff.doc.`);
  }
  const prevDoc = next.doc && typeof next.doc === "object" ? next.doc : {};
  next.doc = { ...prevDoc, pageContentId, docRootId };
  if (typeof compSetId === "string" && compSetId.length) {
    next.doc.compSetId = compSetId;
  }
  if (typeof payload?.propertiesTableId === "string" && payload.propertiesTableId.length) {
    next.doc.propertiesTableId = payload.propertiesTableId;
  }
  return next;
}

// ─── mergeOne(): library-friendly entrypoint ─────────────────────────────────

/**
 * Run a full single-step merge. Reads handoff + return + phase-state, applies
 * DAG check, consistency check, schema validation, mutation, and writes back.
 *
 * Throws MergeFailure on any error; returns { handoffPath, phaseStatePath, nextSlug, completedSlugs }
 * on success. CLI callers translate `code` to process.exit; library callers
 * (resume-handoff, finalize-slice) format and rethrow / present.
 *
 * Options:
 *   { step, handoffPath, returnPath, phaseStatePath?,
 *     skipStaleReturnsCheck?: boolean (resume-handoff replays multiple → checks once),
 *     skipPhaseStateSchemaCheck?: boolean (resume-handoff: checked once at entry) }
 */
export async function mergeOne({
  step,
  handoffPath,
  returnPath,
  phaseStatePath,
  skipStaleReturnsCheck = false,
  skipPhaseStateSchemaCheck = false,
}) {
  if (!isValidStepSlug(step)) throw new MergeFailure(1, `unknown step "${step}"`);
  const phasePath = phaseStatePath ?? join(dirname(handoffPath), "phase-state.json");

  await waitForFilePresent(handoffPath, "handoff.json");
  await waitForFilePresent(returnPath, "figma return");

  let handoff;
  try {
    handoff = JSON.parse(await readFile(handoffPath, "utf8"));
  } catch (e) {
    throw new MergeFailure(1, `handoff parse: ${e.message}`);
  }
  let retWrapper;
  try {
    retWrapper = JSON.parse(await readFile(returnPath, "utf8"));
  } catch (e) {
    throw new MergeFailure(1, `return parse: ${e.message}`);
  }
  if (typeof handoff !== "object" || handoff === null || Array.isArray(handoff)) {
    handoff = {};
  }

  let phaseState = null;
  if (existsSync(phasePath)) {
    try {
      phaseState = JSON.parse(await readFile(phasePath, "utf8"));
    } catch (e) {
      throw new MergeFailure(1, `phase-state parse: ${e.message}`);
    }
    if (!skipPhaseStateSchemaCheck) {
      const errs = validatePhaseStateSchema(phaseState);
      if (errs.length) {
        throw new MergeFailure(
          18,
          `phase-state.json schema violation:\n  - ${errs.join("\n  - ")}\n` +
            `(${phasePath})`,
        );
      }
    }
  }

  // ─── duplicate-merge guard ────────────────────────────────────────────────
  if (phaseState && phaseState.lastSliceOk === step) {
    throw new MergeFailure(
      14,
      `${step} already recorded as lastSliceOk in ${phasePath} (duplicate merge)`,
    );
  }

  // ─── DAG order ────────────────────────────────────────────────────────────
  const needPrev = pred(step);
  if (needPrev === null) {
    if (step !== SLUG_ORDER[0]) {
      throw new MergeFailure(13, `first draw slice must be ${SLUG_ORDER[0]}, got ${step}`);
    }
    if (phaseState && Array.isArray(phaseState.completedSlugs) && phaseState.completedSlugs.length > 0) {
      throw new MergeFailure(
        13,
        `phase-state shows progress but merge requests ${SLUG_ORDER[0]} — refusing to clobber. ` +
          "Delete phase-state.json to restart or merge the correct next step.",
      );
    }
  } else {
    if (!phaseState || phaseState.lastSliceOk !== needPrev) {
      throw new MergeFailure(
        13,
        `DAG order violation — need lastSliceOk=${needPrev} before ${step}, ` +
          `got ${phaseState ? JSON.stringify(phaseState.lastSliceOk) : "no phase-state"}.`,
      );
    }
  }

  // ─── consistency / orphans (1a) ───────────────────────────────────────────
  if (!skipStaleReturnsCheck) {
    const completedSlugs = phaseState && Array.isArray(phaseState.completedSlugs) ? phaseState.completedSlugs : [];
    const stale = await detectStaleReturnFiles({
      handoffDir: dirname(handoffPath),
      completedSlugs,
      requestedStep: step,
      currentReturnPath: returnPath,
    });
    if (stale.kind === "orphans") {
      const lines = stale.entries.map((e) => `  - ${e.slug}: ${e.path}`).join("\n");
      const order = SLUG_ORDER.filter((s) => stale.entries.some((e) => e.slug === s));
      throw new MergeFailure(
        15,
        `stale return-*.json files detected (previous merges were skipped):\n${lines}\n` +
          `Replay merges in DAG order before continuing:\n` +
          order
            .map(
              (s) =>
                `  node scripts/merge-create-component-handoff.mjs ${s} ${handoffPath} ${stale.entries.find((e) => e.slug === s).path}`,
            )
            .join("\n") +
          `\nOr run: node scripts/resume-handoff.mjs ${dirname(handoffPath)}`,
      );
    }
    if (stale.kind === "corruption") {
      throw new MergeFailure(
        16,
        `state corruption — phase-state shows ${stale.slug} already complete but merge requested again. ` +
          `If you reset handoff.json, also clear phase-state.json (or run resume-handoff.mjs).`,
      );
    }
  }

  // ─── mutate + write ───────────────────────────────────────────────────────
  const payload = parseFigmaReturn(retWrapper);
  const nextHandoff = mergeReturnIntoHandoff({ step, handoff, payload });

  const handoffJson = JSON.stringify(nextHandoff, null, 2) + "\n";
  const lastCodeSha256 = createHash("sha256").update(handoffJson, "utf8").digest("hex");

  let component = null;
  if (typeof nextHandoff.component === "string") component = nextHandoff.component;
  else if (typeof nextHandoff.__createComponentName === "string") component = nextHandoff.__createComponentName;

  const idx = SLUG_ORDER.indexOf(step);
  const nextSlug = idx >= 0 && idx < SLUG_ORDER.length - 1 ? SLUG_ORDER[idx + 1] : null;
  const completedSlugs = SLUG_ORDER.slice(0, idx + 1);

  const nextPhase = {
    component: component ?? (phaseState && phaseState.component) ?? null,
    fileKey: (phaseState && phaseState.fileKey) ?? (typeof nextHandoff.fileKey === "string" ? nextHandoff.fileKey : null),
    lastSliceOk: step,
    nextSlug,
    completedSlugs,
    lastCodeSha256,
    lastUpdated: new Date().toISOString(),
  };

  try {
    await writeFile(handoffPath, handoffJson, "utf8");
  } catch (e) {
    throw new MergeFailure(1, `write: ${e.message}`);
  }
  try {
    await writeFile(phasePath, JSON.stringify(nextPhase, null, 2) + "\n", "utf8");
  } catch (e) {
    throw new MergeFailure(1, `phase-state write: ${e.message}`);
  }

  return { handoffPath, phaseStatePath: phasePath, nextSlug, completedSlugs, step };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = process.argv.slice(2);
  if (args.length < 3 || args.length > 4 || args.includes("-h") || args.includes("--help")) {
    console.error(`Usage: node scripts/merge-create-component-handoff.mjs <step> <handoff.json> <figma-return.json> [phase-state.json]
Steps: ${[...STEPS].join(" | ")}`);
    process.exit(2);
  }
  const step = args[0];
  const handoffPath = resolve(args[1]);
  const returnPath = resolve(args[2]);
  const phaseStatePath = args[3] ? resolve(args[3]) : null;
  try {
    const r = await mergeOne({ step, handoffPath, returnPath, phaseStatePath });
    console.log(`OK  merged ${r.step} into ${r.handoffPath}`);
    console.log(`    phase-state → ${r.phaseStatePath}  next=${r.nextSlug ?? "null"}`);
  } catch (e) {
    if (e instanceof MergeFailure) {
      console.error(`merge-create-component-handoff: ${e.message}`);
      process.exit(e.code);
    }
    console.error(e);
    process.exit(1);
  }
}
