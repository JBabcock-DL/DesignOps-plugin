#!/usr/bin/env node
// scripts/generate-ops.mjs — JSON op list + op-interpreter.runtime.min.figma.js for /create-component
// Usage: node scripts/generate-ops.mjs --slug <slug> --config <config.js> --out <assembled.js>

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

import {
  buildScaffoldShellOps,
  buildScaffoldHeaderOps,
  buildScaffoldTableOps,
  buildScaffoldTableChromeOps,
  buildScaffoldTableBodyOps,
  buildScaffoldPlaceholdersOps,
  buildScaffold1Ops,
} from './op-generators/cc-doc-scaffold.mjs';
import { toWireScaffoldOps } from './op-generators/compact-scaffold-ops.mjs';
import { getDelegatedMinRelPath } from './op-generators/lib/delegate-legacy-min.mjs';
import { tryTupleFirstDelegatedEngine } from './op-generators/tuple-delegate-pipeline.mjs';
import { SCAFFOLD_SUB_SLUGS } from './merge-create-component-handoff.mjs';

const SCAFFOLD_TUPLE = new Set(SCAFFOLD_SUB_SLUGS);

const SCAFFOLD_BUILD = {
  'cc-doc-scaffold-shell': buildScaffoldShellOps,
  'cc-doc-scaffold-header': buildScaffoldHeaderOps,
  'cc-doc-scaffold-table-chrome': buildScaffoldTableChromeOps,
  'cc-doc-scaffold-table-body': buildScaffoldTableBodyOps,
  'cc-doc-scaffold-placeholders': buildScaffoldPlaceholdersOps,
};

function opsForScaffoldTupleSlug(slug, config) {
  const fn = SCAFFOLD_BUILD[slug];
  if (!fn) return null;
  return fn(config);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const BOOL = new Set(['help']);

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      if (BOOL.has(key)) a[key] = true; else a[key] = argv[++i] ?? '';
    }
  }
  return a;
}

function usage() {
  console.error(
    'Usage: node scripts/generate-ops.mjs --slug <cc-doc-scaffold-shell|...> \\\n' +
    '  --config <config.mjs> --out <assembled.js> \\\n' +
    '  [--layout <chip|...|__composes__>]  (required for cc-variants) \\\n' +
    '  [--plugin-root <path>] [--budget <bytes>]\n',
  );
}

export async function loadConfigFromFile(configPath) {
  const abs = resolve(configPath);
  if (!existsSync(abs)) {
    throw new Error(`generate-ops: config not found: ${abs}`);
  }
  const body = readFileSync(abs, 'utf8');
  if (/\bexport\s+default\b|\bexport\s*\{/.test(body)) {
    const mod = await import(pathToFileURL(abs).href);
    return mod.default ?? mod.CONFIG ?? mod;
  }
  // Const-only CONFIG (typical /create-component config block) — add export in a temp ESM
  const tmp = join(tmpdir(), `ccload-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  const augmented = `${body.trim()}\nexport { CONFIG };\n`;
  writeFileSync(tmp, augmented, 'utf8');
  try {
    const mod = await import(pathToFileURL(tmp).href);
    if (mod.CONFIG) return mod.CONFIG;
    return mod.default;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

function buildOpsForSlug(slug, config) {
  const fromTuple = opsForScaffoldTupleSlug(slug, config);
  if (fromTuple) return fromTuple;
  if (slug === 'cc-doc-scaffold-full-qa') {
    return buildScaffold1Ops(config);
  }
  throw new Error(
    `generate-ops: slug "${slug}" has no op-list generator (uses delegated min bundle via assembleOpsBody)`,
  );
}

function readOpRuntimeMin(pluginRoot) {
  const p = join(pluginRoot, 'skills', 'create-component', 'templates', 'op-interpreter.min.figma.js');
  if (!existsSync(p)) {
    throw new Error(`generate-ops: run npm run build:min first; missing ${p}`);
  }
  return readFileSync(p, 'utf8');
}

/**
 * @param {object} p
 * @param {string} p.slug
 * @param {object} p.config — loaded CONFIG object (used for scaffold tuple sub-slugs)
 * @param {string} [p.layout] — required for cc-variants delegate
 * @param {string} [p.pluginRoot]
 * @param {number} [p.budget] — if set, scaffold-only: fail when body exceeds (Phase 4 hook)
 * @returns {string}
 */
export function assembleOpsBody({ slug, config, layout, pluginRoot = REPO_ROOT, budget = null }) {
  const rel = getDelegatedMinRelPath(slug, layout, pluginRoot);
  if (rel) {
    const delegated = tryTupleFirstDelegatedEngine({
      slug,
      layout,
      config,
      pluginRoot,
    });
    if (typeof delegated === 'string' && delegated.length > 0) {
      return delegated;
    }
    throw new Error(
      `generate-ops: delegated slice "${slug}" (layout=${String(layout)}) ` +
        'must resolve via tryTupleFirstDelegatedEngine — check delegate-legacy-min mapping',
    );
  }
  if (SCAFFOLD_TUPLE.has(slug) || slug === 'cc-doc-scaffold-full-qa') {
    const verbose =
      slug === 'cc-doc-scaffold-full-qa'
        ? buildScaffold1Ops(config)
        : SCAFFOLD_BUILD[slug](config);
    const { wireOps, strings } = toWireScaffoldOps(verbose);
    const runtime = readOpRuntimeMin(pluginRoot);
    const body =
      `const __S=${JSON.stringify(strings)};\n` +
      `const __OP_LIST__ = ${JSON.stringify(wireOps)};\n` +
      runtime.trim() +
      '\n';
    if (budget != null && Number.isFinite(budget) && Buffer.byteLength(body, 'utf8') > budget) {
      throw new Error(
        `generate-ops: assembled scaffold body exceeds --budget ${budget}B (got ${Buffer.byteLength(body, 'utf8')}B). ` +
          'Split / compression not implemented for this run.',
      );
    }
    return body;
  }
  throw new Error(`generate-ops: unsupported slug "${slug}"`);
}

async function mainCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  const slug = args['slug'];
  const configPath = args['config'];
  const outPath = args['out'];
  const layout = args['layout'] || undefined;
  const budgetArg = args['budget'];
  const budget = budgetArg != null && budgetArg !== '' ? Number(budgetArg) : null;
  const pluginRoot = args['plugin-root'] ? resolve(args['plugin-root']) : REPO_ROOT;
  if (!slug || !configPath || !outPath) {
    usage();
    process.exit(1);
  }
  if (slug === 'cc-variants' && !layout) {
    console.error('generate-ops: --layout is required for cc-variants');
    process.exit(1);
  }
  const config = await loadConfigFromFile(configPath);
  const body = assembleOpsBody({ slug, config, layout, pluginRoot, budget: Number.isFinite(budget) ? budget : null });
  writeFileSync(resolve(outPath), body, 'utf8');
  const bytes = Buffer.byteLength(body, 'utf8');
  let opCount = 0;
  try {
    opCount = buildOpsForSlug(slug, config).length;
  } catch {
    opCount = 0;
  }
  console.log(`generate-ops: slug=${slug} tupleOps=${opCount} out=${resolve(outPath)} body=${bytes}B`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  mainCli().catch(e => { console.error(e); process.exit(1); });
}
