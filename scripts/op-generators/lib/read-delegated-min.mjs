// Single read helper for delegated create-component *.min.figma.js (tuple migration + parity QA).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDelegatedMinRelPath } from './delegate-legacy-min.mjs';

/**
 * @param {string} slug
 * @param {string | undefined} layout
 * @param {string} pluginRoot
 */
export function readDelegatedMinUtf8(slug, layout, pluginRoot) {
  const rel = getDelegatedMinRelPath(slug, layout, pluginRoot);
  if (!rel) throw new Error(`read-delegated-min: no delegated mapping for ${slug}`);
  const abs = join(pluginRoot, rel);
  if (!existsSync(abs)) throw new Error(`read-delegated-min: missing ${abs} (npm run build:min)`);
  return readFileSync(abs, 'utf8');
}
