#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/validate-tokens.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Offline validator for CONFIG token paths. Run BEFORE a use_figma draw so
// you catch typos / stale / inferred paths before the draw-engine silently
// falls back to hex.
//
// Usage:
//
//   node scripts/validate-tokens.mjs <config.(json|js)> <variable-defs.json>
//       [--component <name>]   # only validate this component if <config> is a bundle
//       [--quiet]              # suppress the "OK" banner, still exit 0/1
//
// Inputs
// ------
// <config>   Either a single CONFIG object or a map { component: CONFIG, ... }.
//            Accepted formats:
//              .json  — JSON of CONFIG (stripped of functions — replace `label`
//                       with any string to satisfy the parser).
//              .js    — a module with `export default CONFIG` or
//                       `module.exports = CONFIG`. The module is imported, so
//                       functions stay as functions (but this script only
//                       reads string fields).
//
// <variable-defs>
//            JSON in either shape:
//              1. `{ 'color/primary/default': '#...', ... }` — the shape
//                 `get_variable_defs` (MCP tool) returns directly.
//              2. `[ { name: 'color/primary/default', collection: 'Theme' }, ... ]`
//                 — the shape produced by the `use_figma` probe in
//                 SKILL.md §4.7.a option 2.
//            File may come from either tool — this script normalizes both.
//
// Output
// ------
// Prints one line per unresolved path:
//   MISS  <kind>  <path>  (in <component>.<field>; closest: <closest>)
// Exits 0 when every CONFIG token path resolves; 1 otherwise.
//
// This is the same validation the live draw-engine performs (see
// templates/draw-engine.figma.js §2.5 + returnPayload.unresolvedTokenPaths).
// Running it offline avoids wasting a use_figma round-trip.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  printUsageAndExit();
}

const configPath = args[0];
const defsPath = args[1];
let componentFilter = null;
let quiet = false;
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--component') componentFilter = args[++i];
  else if (args[i] === '--quiet') quiet = true;
}

const configs = await loadConfigs(configPath, componentFilter);
const paths = loadPaths(defsPath);

let totalMisses = 0;
const componentsChecked = [];

for (const { component, config } of configs) {
  const misses = validateConfig(config, paths);
  componentsChecked.push({ component, misses });
  totalMisses += misses.length;
  if (misses.length > 0) {
    for (const m of misses) {
      const closestStr = m.closest.length > 0 ? m.closest.join(', ') : 'none';
      console.error(
        `MISS  ${m.kind.padEnd(18)}  ${m.path.padEnd(36)}  (${component}.${m.field}; closest: ${closestStr})`
      );
    }
  }
}

if (totalMisses === 0) {
  if (!quiet) {
    const total = componentsChecked.reduce((n, c) => n + (c.pathCount || 0), 0);
    console.log(`OK  validated ${componentsChecked.length} component(s) against ${paths.size} live variable path(s); every CONFIG path resolves.`);
  }
  process.exit(0);
} else {
  const nComp = componentsChecked.filter(c => c.misses.length > 0).length;
  console.error(`\nFAIL  ${totalMisses} unresolved token path(s) across ${nComp} component(s).`);
  console.error(`      See skills/create-component/conventions/07-token-paths.md for canonical rules.`);
  console.error(`      Or run SKILL.md §4.7.a to re-enumerate AVAILABLE_TOKEN_PATHS for this file.`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function printUsageAndExit() {
  console.error(`Usage: node scripts/validate-tokens.mjs <config.(json|js)> <variable-defs.json> [--component <name>] [--quiet]`);
  console.error(`       See file header for format details.`);
  process.exit(2);
}

async function loadConfigs(p, filter) {
  const abs = path.resolve(p);
  const ext = path.extname(abs).toLowerCase();
  let raw;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    const mod = await import(url.pathToFileURL(abs).href);
    raw = mod.default ?? mod.CONFIG ?? mod;
  } else {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  }

  if (raw && typeof raw === 'object' && typeof raw.component === 'string') {
    if (filter && raw.component !== filter) {
      console.error(`--component '${filter}' does not match this CONFIG (component='${raw.component}').`);
      process.exit(2);
    }
    return [{ component: raw.component, config: raw }];
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw).filter(([, v]) => v && typeof v === 'object');
    const filtered = filter ? entries.filter(([k]) => k === filter) : entries;
    if (filtered.length === 0 && filter) {
      console.error(`--component '${filter}' not found in bundle.`);
      process.exit(2);
    }
    return filtered.map(([component, config]) => ({
      component: config.component ?? component,
      config,
    }));
  }

  console.error(`Could not parse <config>: expected a single CONFIG or a map { component: CONFIG, ... }.`);
  process.exit(2);
}

function loadPaths(p) {
  const abs = path.resolve(p);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const out = new Set();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry.name === 'string') out.add(entry.name);
    }
  } else if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      if (typeof key === 'string' && key.length > 0) out.add(key);
    }
  } else {
    console.error(`Could not parse <variable-defs>: expected { path: hex, ... } or [{ name, collection }, ...].`);
    process.exit(2);
  }
  if (out.size === 0) {
    console.error(`<variable-defs> contains zero paths — did you run get_variable_defs against the right node?`);
    process.exit(2);
  }
  return out;
}

function validateConfig(config, paths) {
  const misses = [];
  const check = (rawPath, kind, field) => {
    if (rawPath == null || rawPath === '') return;
    if (typeof rawPath !== 'string') return;
    if (paths.has(rawPath)) return;
    misses.push({ kind, path: rawPath, field, closest: findClosest(rawPath, paths, 3) });
  };

  const style = config.style ?? {};
  for (const [variant, entry] of Object.entries(style)) {
    if (!entry || typeof entry !== 'object') continue;
    check(entry.fill, 'color.fill', `style.${variant}.fill`);
    check(entry.labelVar, 'color.label', `style.${variant}.labelVar`);
    check(entry.strokeVar, 'color.stroke', `style.${variant}.strokeVar`);
  }

  const padH = config.padH ?? {};
  for (const [size, v] of Object.entries(padH)) {
    check(v, 'num:padding', `padH.${size}`);
  }
  check(config.radius, 'num:radius', 'radius');

  const scalar = (obj, field, kind, root) => {
    if (!obj) return;
    check(obj[field], kind, `${root}.${field}`);
  };

  if (config.surface) {
    for (const field of Object.keys(config.surface)) {
      if (/Var$/.test(field)) scalar(config.surface, field, 'color.surface', 'surface');
    }
  }
  if (config.field) {
    for (const field of Object.keys(config.field)) {
      if (/Var$/.test(field)) scalar(config.field, field, 'color.field', 'field');
    }
  }
  if (config.control) {
    scalar(config.control, 'indicatorVar', 'color.control', 'control');
    scalar(config.control, 'trackOnVar', 'color.control', 'control');
    scalar(config.control, 'trackOffVar', 'color.control', 'control');
    scalar(config.control, 'thumbVar', 'color.control', 'control');
  }
  if (config.row) {
    for (const field of Object.keys(config.row)) {
      if (/Var$/.test(field)) scalar(config.row, field, 'color.row', 'row');
    }
  }

  return misses;
}

function findClosest(needle, haystack, n) {
  const scored = [];
  for (const candidate of haystack) {
    scored.push([candidate, levenshtein(needle, candidate)]);
  }
  scored.sort((a, b) => a[1] - b[1]);
  return scored.slice(0, n).filter(([, d]) => d <= Math.ceil(needle.length * 0.6)).map(([c]) => c);
}

function levenshtein(a, b) {
  const m = a.length, k = b.length;
  if (m === 0) return k;
  if (k === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(k).fill(0)]);
  for (let j = 1; j <= k; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= k; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][k];
}
