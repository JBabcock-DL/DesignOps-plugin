/**
 * Shared status for `designops-step6-engine.mjs` / tests.
 * Single source of truth: merge-create-component-handoff SLUG_ORDER + phase-state.json
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  SLUG_ORDER,
  FIRST_DRAW_SLUG,
  validatePhaseStateSchema,
} from "../merge-create-component-handoff.mjs";

/**
 * @param {string} drawDir absolute path to draw directory (handoff.json expected)
 * @returns {Promise<
 *   | { ok: true; drawDir: string; nextSlug: string | null; completedSlugs: string[]; terminal: boolean; phaseState: object | null }
 *   | { ok: false; code: string; message: string; remediation?: string; errors?: string[] }
 * >}
 */
export async function getStep6Status(drawDir) {
  const handoffPath = join(drawDir, "handoff.json");
  const phaseStatePath = join(drawDir, "phase-state.json");

  if (!existsSync(handoffPath)) {
    return {
      ok: false,
      code: "NO_HANDOFF",
      message: `handoff.json missing in ${drawDir}`,
    };
  }

  if (!existsSync(phaseStatePath)) {
    return {
      ok: true,
      drawDir,
      nextSlug: FIRST_DRAW_SLUG,
      completedSlugs: [],
      terminal: false,
      phaseState: null,
    };
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(phaseStatePath, "utf8"));
  } catch (e) {
    return {
      ok: false,
      code: "PHASE_STATE_PARSE",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const errs = validatePhaseStateSchema(raw);
  if (errs.length) {
    return {
      ok: false,
      code: "INVALID_PHASE_STATE",
      message: "phase-state.json failed validation",
      errors: errs,
      remediation: `Fix state or run: node scripts/resume-handoff.mjs ${drawDir}`,
    };
  }

  const terminal = raw.nextSlug === null;
  return {
    ok: true,
    drawDir,
    nextSlug: raw.nextSlug,
    completedSlugs: Array.isArray(raw.completedSlugs) ? raw.completedSlugs : [],
    terminal,
    phaseState: raw,
  };
}

export { SLUG_ORDER, FIRST_DRAW_SLUG };
