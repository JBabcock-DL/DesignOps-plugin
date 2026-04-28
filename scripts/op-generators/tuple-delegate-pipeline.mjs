/**
 * Tuple-first delegated pipeline hooks ([24] roadmap).
 *
 * **`assembleOpsBody`** calls this whenever the slice maps to a delegated `*.min.figma.js`
 * (`getDelegatedMinRelPath` is truthy).
 *
 * - **Today:** return the canonical committed min UTF-8 (same bytes as filesystem read).
 * - **Later:** branch per `{ slug, layout }` and return compact **`__OP_LIST__`** + shared
 *   interpreter ONLY after **`qa:tuple-parity`** / Figma golden parity permits replacing
 *   those bytes.
 */

import { getDelegatedMinRelPath } from './lib/delegate-legacy-min.mjs';
import { readDelegatedMinUtf8 } from './lib/read-delegated-min.mjs';

/** @typedef {{ slug: string, layout?: string, config: object, pluginRoot: string }} TupleCtx */

/**
 * @param {TupleCtx} ctx
 * @returns {string | null} engine body ONLY (no CONFIG/preamble); null if no delegated mapping
 */
export function tryTupleFirstDelegatedEngine(ctx) {
  const { slug, layout, pluginRoot } = ctx;
  void ctx.config;
  const rel = getDelegatedMinRelPath(slug, layout, pluginRoot);
  if (!rel) return null;
  return readDelegatedMinUtf8(slug, layout, pluginRoot);
}

/**
 * Exported for QA: canonical delegated UTF-8 (must equal generate-ops delegated branch).
 */
export function delegatedBaselineBytes(slug, layout, pluginRoot) {
  return Buffer.byteLength(readDelegatedMinUtf8(slug, layout, pluginRoot), 'utf8');
}
