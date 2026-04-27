#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/cache-tokens.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Cache the Figma variable graph (collections + variables) for a Foundations
// file so subsequent /create-component runs can skip the per-component Step
// 4.7 token enumeration. Parent still owns the `use_figma` call — this script
// emits the MCP args (parent invokes call_mcp), then ingests the return into
// `<consumer-repo>/.token-cache.<fileKey>.json`.
//
// Flow (per Foundations file, run once; refresh after editing the file):
//   1. node scripts/cache-tokens.mjs --emit <fileKey> --out cache-tokens-args.json
//      → writes MCP args JSON for parent to consume
//   2. parent: Read cache-tokens-args.json + call_mcp use_figma {fileKey, code, ...}
//   3. parent: Write the return to cache-tokens-return.json
//   4. node scripts/cache-tokens.mjs --ingest <fileKey> cache-tokens-return.json --target <consumer-dir>
//      → writes <consumer-dir>/.token-cache.<fileKey>.json
//
// Staleness:
//   - Cache stores `cachedAt` and `figmaFileKey`.
//   - assemble-slice may consult the cache and warn if older than 7 days
//     OR if the file has been modified since `cachedAt` (the latter requires
//     a hash that this script does not collect — agents can call --refresh
//     after editing Foundations).
//
// Usage
//   node scripts/cache-tokens.mjs --emit <fileKey> [--out <args.json>] [--description <text>]
//   node scripts/cache-tokens.mjs --ingest <fileKey> <return.json> --target <consumer-dir> [--refresh]
//   node scripts/cache-tokens.mjs --status --target <consumer-dir> [--file-key <fileKey>]
//
// Exit codes:
//   0  ok
//   1  bad CLI / write error / parse error
//   2  cache file not found (status mode only)

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.error(
    `Usage:\n` +
    `  node scripts/cache-tokens.mjs --emit <fileKey> [--out <args.json>] [--description <text>]\n` +
    `  node scripts/cache-tokens.mjs --ingest <fileKey> <return.json> --target <consumer-dir> [--refresh]\n` +
    `  node scripts/cache-tokens.mjs --status --target <consumer-dir> [--file-key <fileKey>]\n` +
    `\nThe --emit flow writes MCP args JSON for the parent to call_mcp; the --ingest flow\n` +
    `consumes the parent's return and writes <target>/.token-cache.<fileKey>.json.\n`,
  );
  process.exit(args.length === 0 ? 2 : 0);
}

let mode = null;
let fileKey = null;
let outPath = null;
let returnPath = null;
let target = null;
let description = null;
let refresh = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--emit') { mode = 'emit'; fileKey = args[++i]; }
  else if (a === '--ingest') { mode = 'ingest'; fileKey = args[++i]; returnPath = args[++i]; }
  else if (a === '--status') { mode = 'status'; }
  else if (a === '--out') { outPath = args[++i]; }
  else if (a === '--target') { target = args[++i]; }
  else if (a === '--description') { description = args[++i]; }
  else if (a === '--file-key') { fileKey = args[++i]; }
  else if (a === '--refresh') { refresh = true; }
  else { console.error(`cache-tokens: unknown arg: ${a}`); process.exit(1); }
}

if (!mode) {
  console.error('cache-tokens: pick a mode: --emit | --ingest | --status');
  process.exit(1);
}

// ─── --emit ──────────────────────────────────────────────────────────────────
if (mode === 'emit') {
  if (!fileKey) { console.error('cache-tokens: --emit requires <fileKey>'); process.exit(1); }

  // Plugin code: enumerate variable collections + their variables. Returned
  // shape mirrors what conventions/07-token-paths.md §7.3 option 2 uses.
  const code = [
    `const cols = figma.variables.getLocalVariableCollections();`,
    `const vars = figma.variables.getLocalVariables();`,
    `const out = {`,
    `  fileKey: typeof figma.fileKey === 'string' ? figma.fileKey : null,`,
    `  collections: cols.map(c => ({`,
    `    id: c.id,`,
    `    name: c.name,`,
    `    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),`,
    `    defaultModeId: c.defaultModeId,`,
    `  })),`,
    `  variables: vars.map(v => ({`,
    `    id: v.id,`,
    `    name: v.name,`,
    `    resolvedType: v.resolvedType,`,
    `    variableCollectionId: v.variableCollectionId,`,
    `    codeSyntax: v.codeSyntax || {},`,
    `  })),`,
    `};`,
    `return out;`,
  ].join('\n');

  const mcpArgs = {
    fileKey,
    code,
    description: description || `cache-tokens: enumerate variable collections + variables for ${fileKey}`,
    skillNames: 'figma-use',
  };
  const json = JSON.stringify(mcpArgs);

  if (outPath) {
    writeFileSync(resolve(outPath), json, 'utf8');
    console.log(`OK  wrote MCP args → ${resolve(outPath)} (${Buffer.byteLength(json, 'utf8')}B)`);
    console.log(`    Next: parent Read this file + call_mcp use_figma; save the return,`);
    console.log(`          then: node scripts/cache-tokens.mjs --ingest ${fileKey} <return.json> --target <consumer-dir>`);
  } else {
    process.stdout.write(json);
  }
  process.exit(0);
}

// ─── --ingest ────────────────────────────────────────────────────────────────
if (mode === 'ingest') {
  if (!fileKey || !returnPath) { console.error('cache-tokens: --ingest requires <fileKey> <return.json>'); process.exit(1); }
  if (!target) { console.error('cache-tokens: --ingest requires --target <consumer-dir>'); process.exit(1); }
  const returnAbs = resolve(returnPath);
  if (!existsSync(returnAbs)) { console.error(`cache-tokens: return file not found: ${returnAbs}`); process.exit(1); }

  let payload;
  try {
    const raw = JSON.parse(readFileSync(returnAbs, 'utf8'));
    payload = raw?.raw && typeof raw.raw === 'object' ? raw.raw : raw;
  } catch (e) {
    console.error(`cache-tokens: parse error in ${returnAbs}: ${e.message}`); process.exit(1);
  }

  if (!Array.isArray(payload?.collections) || !Array.isArray(payload?.variables)) {
    console.error('cache-tokens: return missing required arrays (collections, variables). Did the parent run the --emit code?');
    process.exit(1);
  }

  const targetAbs = resolve(target);
  if (!existsSync(targetAbs)) {
    try { mkdirSync(targetAbs, { recursive: true }); }
    catch (e) { console.error(`cache-tokens: cannot create target dir: ${e.message}`); process.exit(1); }
  }

  const cacheFile = join(targetAbs, `.token-cache.${fileKey}.json`);
  if (existsSync(cacheFile) && !refresh) {
    // Compare timestamps; warn if overwriting fresh cache
    try {
      const old = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (old?.cachedAt) {
        const ageMs = Date.now() - new Date(old.cachedAt).getTime();
        if (ageMs < 5 * 60 * 1000) {
          console.error(`cache-tokens: existing cache is < 5 min old. Pass --refresh to overwrite.`);
          process.exit(1);
        }
      }
    } catch { /* ignore — if existing cache is corrupt, proceed to overwrite */ }
  }

  const cache = {
    figmaFileKey: payload.fileKey || fileKey,
    cachedAt: new Date().toISOString(),
    schemaVersion: 1,
    collections: payload.collections,
    variables: payload.variables,
  };

  try {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  } catch (e) { console.error(`cache-tokens: write failed: ${e.message}`); process.exit(1); }

  const cN = cache.collections.length;
  const vN = cache.variables.length;
  console.log(`OK  cached ${cN} collection(s), ${vN} variable(s) → ${cacheFile}`);
  process.exit(0);
}

// ─── --status ────────────────────────────────────────────────────────────────
if (mode === 'status') {
  if (!target) { console.error('cache-tokens: --status requires --target <consumer-dir>'); process.exit(1); }
  const targetAbs = resolve(target);
  if (!existsSync(targetAbs)) { console.error(`cache-tokens: target dir not found: ${targetAbs}`); process.exit(2); }

  // Find all .token-cache.*.json in target
  const { readdirSync } = await import('node:fs');
  let entries;
  try { entries = readdirSync(targetAbs); }
  catch (e) { console.error(`cache-tokens: read dir failed: ${e.message}`); process.exit(1); }

  const re = /^\.token-cache\.([^.]+)\.json$/;
  const found = entries
    .map(n => ({ name: n, m: re.exec(n) }))
    .filter(x => x.m && (!fileKey || x.m[1] === fileKey));

  if (found.length === 0) {
    if (fileKey) {
      console.error(`cache-tokens: no cache for ${fileKey} in ${targetAbs}`);
      console.error(`  run: node scripts/cache-tokens.mjs --emit ${fileKey} --out args.json`);
    } else {
      console.error(`cache-tokens: no .token-cache.*.json files in ${targetAbs}`);
    }
    process.exit(2);
  }

  for (const f of found) {
    const path = join(targetAbs, f.name);
    try {
      const cache = JSON.parse(readFileSync(path, 'utf8'));
      const ageH = Math.floor((Date.now() - new Date(cache.cachedAt).getTime()) / (1000 * 60 * 60));
      const stale = ageH > 24 * 7;
      console.log(`${stale ? 'STALE' : 'FRESH'}  ${f.m[1]}  cachedAt=${cache.cachedAt}  age=${ageH}h  collections=${cache.collections.length}  vars=${cache.variables.length}`);
      console.log(`       ${path}`);
    } catch (e) {
      console.log(`ERROR  ${f.m[1]}  ${e.message}`);
    }
  }
  process.exit(0);
}
