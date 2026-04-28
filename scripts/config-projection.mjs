/**
 * CONFIG projection for assemble-slice (Tier 1 / wire-size roadmap).
 * Default: identity (full CONFIG everywhere). Narrow `bySlug` when audited safe.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _map = null;
function loadMap() {
  if (_map) return _map;
  const raw = readFileSync(join(__dirname, "config-projection-map.json"), "utf8");
  _map = JSON.parse(raw);
  return _map;
}

/**
 * @param {string} slug
 * @param {object} config
 * @returns {object} cloned + projected
 */
export function applyConfigProjectionForSlug(slug, config) {
  if (!config || typeof config !== "object") return config;
  const map = loadMap();
  const rule = map.bySlug?.[slug] ?? map.defaults ?? { allowTopLevelKeys: null };
  const keys = rule.allowTopLevelKeys;
  if (keys === null || keys === undefined) {
    return structuredClone(config);
  }
  if (!Array.isArray(keys)) {
    return structuredClone(config);
  }
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(config, k)) out[k] = config[k];
  }
  return out;
}

/**
 * Embed CONFIG as runnable plugin preamble (same shape as trimmed config block files).
 */
export function configObjectToEmbeddedBlock(cfg) {
  return `const CONFIG = ${JSON.stringify(cfg, null, 2)};`;
}
