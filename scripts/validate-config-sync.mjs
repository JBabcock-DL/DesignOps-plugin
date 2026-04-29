#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/validate-config-sync.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Compare scalar CONFIG fields between a generated config.js and a ctx.js
// before Step 6 to catch silent drift (geometry, property rows, variants).
//
// Usage:
//   node scripts/validate-config-sync.mjs <config.js> <ctx.js> [--quiet]
//   node scripts/validate-config-sync.mjs --help
//
// Exits 0 when every compared field matches; 1 when any DIFF is found; 2 on bad args.
// Output: one line per mismatch → stdout (DIFF  field  config=…  ctx=…)
// ═══════════════════════════════════════════════════════════════════════════

import path from 'node:path';
import url from 'node:url';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.error(
    `Usage: node scripts/validate-config-sync.mjs <config.js> <ctx.js> [--quiet]\n` +
      `       Compares layout, control.*, variants, sizes, properties.length, padH keys, radius, iconSlots, componentProps.\n` +
      `       Exit 0 = match, 1 = mismatch(es), 2 = bad args.`
  );
  process.exit(args.length === 0 ? 2 : 0);
}

let quiet = false;
const pos = [];
for (const a of args) {
  if (a === '--quiet') quiet = true;
  else pos.push(a);
}

if (pos.length < 2) {
  console.error('validate-config-sync: need <config.js> <ctx.js>');
  process.exit(2);
}

const configPath = path.resolve(pos[0]);
const ctxPath = path.resolve(pos[1]);

const config = await loadConfigLike(configPath);
const ctx = await loadConfigLike(ctxPath);

const diffs = compareSlices(config, ctx);

if (diffs.length > 0) {
  for (const d of diffs) {
    console.log(`DIFF  ${d.field}  config=${d.a}  ctx=${d.b}`);
  }
  process.exit(1);
}

if (!quiet) {
  console.log('OK  config.js and ctx.js agree on compared fields.');
}
process.exit(0);

// ───────────────────────────────────────────────────────────────────────────

async function loadConfigLike(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.js', '.mjs', '.cjs'].includes(ext)) {
    throw new Error(`validate-config-sync: unsupported extension ${ext} (use .js / .mjs / .cjs)`);
  }
  const href = url.pathToFileURL(filePath).href;
  const mod = await import(href);
  let raw = mod.default ?? mod.CONFIG ?? mod.ctx;
  if (raw == null || typeof raw !== 'object') {
    raw = mod;
  }
  if (raw == null || typeof raw !== 'object') {
    throw new Error(`validate-config-sync: could not load an object from ${filePath}`);
  }
  return raw;
}

function normList(v) {
  if (!Array.isArray(v)) return JSON.stringify(v);
  return JSON.stringify([...v].map(String).sort());
}

function normPadHKeys(padH) {
  if (!padH || typeof padH !== 'object' || Array.isArray(padH)) return JSON.stringify(padH);
  return JSON.stringify(Object.keys(padH).map(String).sort());
}

function show(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function sliceForCompare(o) {
  const c = o.control && typeof o.control === 'object' ? o.control : {};
  return {
    layout: o.layout,
    'control.size': c.size,
    'control.shape': c.shape,
    'control.width': c.width,
    'control.height': c.height,
    variants: normList(o.variants),
    sizes: normList(o.sizes),
    'properties.length': Array.isArray(o.properties) ? o.properties.length : undefined,
    'padH.keys': normPadHKeys(o.padH),
    radius: o.radius,
    'iconSlots.leading': o.iconSlots && typeof o.iconSlots === 'object' ? o.iconSlots.leading : undefined,
    'iconSlots.trailing':
      o.iconSlots && typeof o.iconSlots === 'object' ? o.iconSlots.trailing : undefined,
    'componentProps.label':
      o.componentProps && typeof o.componentProps === 'object' ? o.componentProps.label : undefined,
    'componentProps.leadingIcon':
      o.componentProps && typeof o.componentProps === 'object' ? o.componentProps.leadingIcon : undefined,
    'componentProps.trailingIcon':
      o.componentProps && typeof o.componentProps === 'object' ? o.componentProps.trailingIcon : undefined,
  };
}

function compareSlices(a, b) {
  const sa = sliceForCompare(a);
  const sb = sliceForCompare(b);
  const diffs = [];
  for (const field of Object.keys(sa)) {
    const va = sa[field];
    const vb = sb[field];
    if (va !== vb) {
      diffs.push({ field, a: show(va), b: show(vb) });
    }
  }
  return diffs;
}
