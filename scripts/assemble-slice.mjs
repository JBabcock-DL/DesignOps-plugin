#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/assemble-slice.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Single-command assembly for one create-component MCP ladder slice.
// Collapses 5 manual steps (Read × 4 files, varGlobals build, check-payload,
// check-use-figma-mcp-args, concat) into one command. **Invoke Figma** with
// **Read** + **call_mcp `use_figma`** (Cursor / Claude Figma MCP — default),
// or **`npm run figma:mcp-invoke -- --file`** (fallback; manifest `finalizeHint`).
// This script writes assembly to --out / --emit-mcp-args.
//
// Implements: skills/create-component-figma-slice-runner/SKILL.md §0.1 assembly
//             skills/create-component/conventions/13-component-draw-orchestrator.md §3
//
// Usage
//   node scripts/assemble-slice.mjs \
//     --step <cc-doc-scaffold-shell|cc-doc-scaffold-header|…|cc-doc-finalize> \
//     --layout <chip|surface-stack|field|row-item|tiny|control|container|__composes__> \
//     --config-block <path-to-config-block.js> \
//     --registry <path-to-.designops-registry.json> \
//     --handoff <path-to-handoff.json | "{}"> \
//     --file-key <figmaFileKey> \
//     --out <output-code.js> \
//     [--description "<use_figma description string>"] \
//     [--emit-mcp-args <output-mcp-args.json>] \
//     [--legacy-bundles]     read per-step min.figma.js (escape hatch; default = generate-ops)
//
// Canonical on-disk name for JSON written by --emit-mcp-args: `mcp-<step-slug>.json` in the
// design repo (e.g. `mcp-cc-doc-props.json`). Do not introduce parallel ad hoc names
// (`mcp-invoke-use-figma.json`, etc.) in the same folder. Consume with parent
// **`Read` → `call_mcp` / `use_figma`**, or **`npm run figma:mcp-invoke -- --file`** (fallback).
//
// Exit codes:
//   0  ok
//   1  bad CLI args
//   2  unknown step or layout
//   3  missing/unreadable input file
//  10  check-payload failed (assembled code has a JS syntax error)
//  11  check-use-figma-mcp-args failed (MCP wrapper JSON invalid)
//  17  non-canonical sibling files detected in --emit-mcp-args dir
//      (e.g. figma-slices/invoke-*.json, mcp-invoke-*.json, .mcp-args-*.json).
//      Remove them and retry; do not coexist with parallel naming schemes.
//
// Optional flags:
//   --legacy-bundles              use committed *.min.figma.js per step (pre–op default path)
//                                 (default: generate-ops assembles all slugs: tuple ops for
//                                 scaffold sub-slugs, delegated min engines for 2–6 + variants)
//   --skip-check                  skip the check-payload + check-use-figma-mcp-args passes
//                                 (for the rare debug case; otherwise they always run).
//   --skip-noncanonical-guard     skip the non-canonical sibling check (escape hatch
//                                 if a design repo legitimately has unrelated *.json
//                                 files matching the anti-patterns; document why).
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { loadConfigFromFile, assembleOpsBody } from './generate-ops.mjs';
import { SLUG_ORDER, SCAFFOLD_SUB_SLUGS, FIRST_DRAW_SLUG } from './merge-create-component-handoff.mjs';
import { applyConfigProjectionForSlug, configObjectToEmbeddedBlock } from './config-projection.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const SCAFFOLD_SUB_SET = new Set(SCAFFOLD_SUB_SLUGS);
const DOC_STEP1_MIN = 'create-component-engine-doc.step1.min.figma.js';

// ── Bundle map — create-component-figma-slice-runner SKILL.md §2 ───────────
// Maps step slug → engine filename relative to templates/.
// For cc-variants, the filename also depends on layout (see LAYOUT_TO_ARCHETYPE below).
const STEP_ENGINE_MAP = {
  'cc-doc-scaffold-shell':         DOC_STEP1_MIN,
  'cc-doc-scaffold-header':        DOC_STEP1_MIN,
  'cc-doc-scaffold-table-chrome':  DOC_STEP1_MIN,
  'cc-doc-scaffold-table-body':    DOC_STEP1_MIN,
  'cc-doc-scaffold-placeholders':  DOC_STEP1_MIN,
  'cc-variants':                   null, // resolved via layout → archetype below
  'cc-doc-component':  'create-component-engine-doc.step2.min.figma.js',
  'cc-doc-props':        'create-component-engine-doc.step3.min.figma.js',
  'cc-doc-props-1':      'create-component-engine-doc.step3.min.figma.js',
  'cc-doc-props-2':      'create-component-engine-doc.step3.min.figma.js',
  'cc-doc-matrix':     'create-component-engine-doc.step4.min.figma.js',
  'cc-doc-usage':      'create-component-engine-doc.step5.min.figma.js',
  'cc-doc-finalize':   'create-component-engine-doc.step6.min.figma.js',
};

// Maps CONFIG.layout values to the archetype filename segment for cc-variants.
// Note: '__composes__' maps to 'composed' (filename-safe spelling).
const LAYOUT_TO_ARCHETYPE = {
  'chip':           'chip',
  'surface-stack':  'surface-stack',
  'field':          'field',
  'row-item':       'row-item',
  'tiny':           'tiny',
  'control':        'control',
  'container':      'container',
  '__composes__':   'composed',
};

const VALID_STEPS = new Set(Object.keys(STEP_ENGINE_MAP));
const VALID_LAYOUTS = new Set(Object.keys(LAYOUT_TO_ARCHETYPE));

// ── CLI argument parsing ──────────────────────────────────────────────────
// Boolean (no-arg) flags. Anything not in this set consumes the next argv slot.
const BOOL_FLAGS = new Set(['skip-check', 'skip-noncanonical-guard', 'use-ops', 'legacy-bundles']);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (BOOL_FLAGS.has(key)) {
        args[key] = true;
      } else {
        args[key] = argv[++i] ?? '';
      }
    }
  }
  return args;
}

function usage() {
  console.error(
    'Usage: node scripts/assemble-slice.mjs \\\n' +
    '  --step <slug> --layout <layout> \\\n' +
    '  --config-block <path> --registry <path|"{}"> --handoff <path|"{}"> \\\n' +
    '  --file-key <figmaFileKey> --out <output.js> \\\n' +
    '  [--description "<text>"] [--emit-mcp-args <output.json>] [--legacy-bundles]\n' +
    '\nSteps: ' + [...VALID_STEPS].join(' | ') +
    '\nLayouts: ' + [...VALID_LAYOUTS].join(' | '),
  );
}

const rawArgs = parseArgs(process.argv.slice(2));

const step         = rawArgs['step'];
const layout       = rawArgs['layout'];
const configPath   = rawArgs['config-block'];
const registryArg  = rawArgs['registry'];
const handoffArg   = rawArgs['handoff'];
const fileKey      = rawArgs['file-key'];
const outPath      = rawArgs['out'];
const description  = rawArgs['description'] || `create-component step=${step} layout=${layout}`;
const mcpArgsPath  = rawArgs['emit-mcp-args'];
const skipCheck    = rawArgs['skip-check'] === true;
const skipNonCanonicalGuard = rawArgs['skip-noncanonical-guard'] === true;
const useLegacy = rawArgs['legacy-bundles'] === true;
// Default: op pipeline (generate-ops). --legacy-bundles reads min engines directly. --use-ops is a no-op alias for default.
const useOps = !useLegacy;
// Auto-detect plugin root: directory containing skills/create-component/
const pluginRoot   = rawArgs['plugin-root'] ?? REPO_ROOT;

if (!step || !layout || !configPath || !registryArg || !handoffArg || !fileKey || !outPath) {
  usage();
  process.exit(1);
}

if (!VALID_STEPS.has(step)) {
  console.error(`assemble-slice: unknown step "${step}"`);
  process.exit(2);
}

if (!VALID_LAYOUTS.has(layout)) {
  console.error(`assemble-slice: unknown layout "${layout}". Valid: ${[...VALID_LAYOUTS].join(', ')}`);
  process.exit(2);
}

if (useLegacy && SCAFFOLD_SUB_SET.has(step)) {
  console.error(
    'assemble-slice: scaffold sub-slugs use tuple ops; omit --legacy-bundles (default is generate-ops).',
  );
  process.exit(2);
}

// ── Read helpers ─────────────────────────────────────────────────────────
function readFile(p, label) {
  const abs = resolve(p);
  if (!existsSync(abs)) {
    console.error(`assemble-slice: ${label} not found: ${abs}`);
    process.exit(3);
  }
  try {
    return readFileSync(abs, 'utf8');
  } catch (e) {
    console.error(`assemble-slice: cannot read ${label} (${abs}): ${e.message}`);
    process.exit(3);
  }
}

function parseJsonArg(arg, label) {
  // Accepts a file path OR a raw JSON string (e.g. '{}')
  const trimmed = arg.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); }
    catch (e) { console.error(`assemble-slice: ${label} is not valid JSON: ${e.message}`); process.exit(1); }
  }
  const src = readFile(arg, label);
  try { return JSON.parse(src); }
  catch (e) { console.error(`assemble-slice: ${label} JSON parse failed: ${e.message}`); process.exit(3); }
}

// ── Resolve paths ────────────────────────────────────────────────────────
const createComponentRoot = join(pluginRoot, 'skills', 'create-component');
const templatesDir = join(createComponentRoot, 'templates');
const preambleRuntimePath = join(templatesDir, 'preamble.runtime.figma.js');
// Fall back to full preamble if runtime twin not yet generated
const preamblePath = existsSync(preambleRuntimePath)
  ? preambleRuntimePath
  : join(templatesDir, 'preamble.figma.js');

if (!existsSync(preamblePath)) {
  console.error(`assemble-slice: preamble not found at ${preamblePath}. Run: npm run build:min`);
  process.exit(3);
}

// ── Resolve engine: legacy min bundle or op-ops (generate-ops) ─────────
let engineFile;
if (step === 'cc-variants') {
  const archetype = LAYOUT_TO_ARCHETYPE[layout];
  engineFile = `create-component-engine-${archetype}.step0.min.figma.js`;
} else {
  engineFile = STEP_ENGINE_MAP[step];
}
const enginePath = join(templatesDir, engineFile);

let engineSrc;
let loadedConfig = null;
if (useOps) {
  try {
    loadedConfig = await loadConfigFromFile(resolve(configPath));
    loadedConfig = applyConfigProjectionForSlug(step, loadedConfig);
    engineSrc = assembleOpsBody({ slug: step, config: loadedConfig, layout, pluginRoot: resolve(pluginRoot) });
    engineFile = 'generate-ops (tuple ops or delegated .min.figma.js)';
  } catch (e) {
    console.error(`assemble-slice: generate-ops: ${e.message}`);
    process.exit(3);
  }
} else {
  if (!existsSync(enginePath)) {
    console.error(`assemble-slice: engine not found: ${enginePath}. Run: npm run build:min`);
    process.exit(3);
  }
  engineSrc = readFile(enginePath, `engine (${engineFile})`);
}
if (!loadedConfig && (step === 'cc-doc-props-1' || step === 'cc-doc-props-2')) {
  try {
    loadedConfig = await loadConfigFromFile(resolve(configPath));
    loadedConfig = applyConfigProjectionForSlug(step, loadedConfig);
  } catch (e) {
    console.error(`assemble-slice: load CONFIG for ${step}: ${e.message}`);
    process.exit(3);
  }
}

// ── Config block string: use projected CONFIG when ops pipeline loaded an object ──
let configBlock;
if (useOps && loadedConfig) {
  configBlock = configObjectToEmbeddedBlock(loadedConfig).trim();
} else {
  configBlock = readFile(configPath, '--config-block').trim();
}

const registry    = parseJsonArg(registryArg, '--registry');
const handoffObj  = parseJsonArg(handoffArg, '--handoff');
const preambleSrc = readFile(preamblePath, 'preamble');

// ── Patch preamble: inject ACTIVE_FILE_KEY + REGISTRY_COMPONENTS ─────────
const activeFileKey = typeof registry.fileKey === 'string' ? registry.fileKey : null;
const registryComponents = (registry.components && typeof registry.components === 'object')
  ? registry.components : {};

const patchedPreamble = preambleSrc
  .replace(
    /const ACTIVE_FILE_KEY\s*=\s*null;/,
    `const ACTIVE_FILE_KEY = ${activeFileKey ? JSON.stringify(activeFileKey) : 'null'};`,
  )
  .replace(
    /const REGISTRY_COMPONENTS\s*=\s*\{\s*\};/,
    `const REGISTRY_COMPONENTS = ${JSON.stringify(registryComponents)};`,
  );

// Four cases: first scaffold, scaffold continuation, variants, doc-component / doc-rest
function buildVarGlobals(stepSlug, handoff, configObj) {
  const doc = (handoff.doc && typeof handoff.doc === 'object') ? handoff.doc : {};
  const av  = (handoff.afterVariants && typeof handoff.afterVariants === 'object') ? handoff.afterVariants : {};
  const pcId = doc.pageContentId;
  const drId = doc.docRootId;
  const vi = SLUG_ORDER.indexOf('cc-variants');
  const lastScaffold = vi > 0 ? SLUG_ORDER[vi - 1] : 'cc-doc-scaffold-placeholders';

  const lines = [];

  if (SCAFFOLD_SUB_SET.has(stepSlug)) {
    if (stepSlug === FIRST_DRAW_SLUG) {
      lines.push(`var __CREATE_COMPONENT_PHASE__ = 2;`);
      lines.push(`var __CREATE_COMPONENT_DOC_STEP__ = 1;`);
    } else {
      if (!pcId || !drId) {
        console.error(
          `assemble-slice: ${stepSlug} requires handoff.doc.pageContentId + docRootId from a prior merge ` +
            `(run merge-create-component-handoff.mjs after ${FIRST_DRAW_SLUG} and each continuation slice).`,
        );
        process.exit(1);
      }
      lines.push(`var __CREATE_COMPONENT_PHASE__ = 2;`);
      lines.push(`var __CREATE_COMPONENT_DOC_STEP__ = 1;`);
      lines.push(`var __CC_HANDOFF_PAGE_CONTENT_ID__ = ${JSON.stringify(pcId)};`);
      lines.push(`var __CC_HANDOFF_DOC_ROOT_ID__ = ${JSON.stringify(drId)};`);
      if (stepSlug === 'cc-doc-scaffold-table-body') {
        const ptId = doc.propertiesTableId;
        if (typeof ptId !== 'string' || !ptId.length) {
          console.error(
            'assemble-slice: cc-doc-scaffold-table-body requires handoff.doc.propertiesTableId ' +
              '(merge after cc-doc-scaffold-table-chrome; Figma return must include propertiesTableId).',
          );
          process.exit(1);
        }
        lines.push(`var __CC_HANDOFF_SCAFFOLD_TABLE_ID__ = ${JSON.stringify(ptId)};`);
      }
    }
  } else if (stepSlug === 'cc-variants') {
    // Variant plane. Preserves _PageContent from scaffold.
    lines.push(`var __CREATE_COMPONENT_PHASE__ = 1;`);
    if (!pcId || !drId) {
      console.error(
        `assemble-slice: cc-variants requires handoff.doc.pageContentId + docRootId (merge returns after each doc slice, through ${lastScaffold}). ` +
          'Run merge-create-component-handoff.mjs after each scaffold sub-slice.',
      );
      process.exit(1);
    }
    lines.push(`var __CC_HANDOFF_PAGE_CONTENT_ID__ = ${JSON.stringify(pcId)};`);
    lines.push(`var __CC_HANDOFF_DOC_ROOT_ID__ = ${JSON.stringify(drId)};`);

  } else {
    // Doc steps 2-6: need full afterVariants + handoff.doc. compSetId required for steps 4-6.
    const requiresCompSet = ['cc-doc-matrix', 'cc-doc-usage', 'cc-doc-finalize'].includes(stepSlug);
    const vhId = av.variantHolderId;
    if (!vhId) {
      console.error(
        `assemble-slice: ${stepSlug} requires handoff.afterVariants.variantHolderId. ` +
        'Run merge-create-component-handoff.mjs after cc-variants first.',
      );
      process.exit(1);
    }
    if (!pcId || !drId) {
      console.error(`assemble-slice: ${stepSlug} requires handoff.doc.pageContentId + docRootId.`);
      process.exit(1);
    }
    if (requiresCompSet && !doc.compSetId) {
      console.error(
        `assemble-slice: ${stepSlug} requires handoff.doc.compSetId. ` +
        'Run merge-create-component-handoff.mjs after cc-doc-component first.',
      );
      process.exit(1);
    }
    lines.push(`var __CREATE_COMPONENT_PHASE__ = 2;`);
    lines.push(`var __PHASE_1_VARIANT_HOLDER_ID__ = ${JSON.stringify(vhId)};`);
    lines.push(`var __CC_PHASE1_PROPS_ADDED__ = ${JSON.stringify(av.propsAdded ?? {})};`);
    lines.push(`var __CC_PHASE1_UNRESOLVED__ = ${JSON.stringify(av.unresolvedTokenMisses ?? [])};`);
    lines.push(`var __CC_HANDOFF_PAGE_CONTENT_ID__ = ${JSON.stringify(pcId)};`);
    lines.push(`var __CC_HANDOFF_DOC_ROOT_ID__ = ${JSON.stringify(drId)};`);
    if (doc.compSetId) {
      lines.push(`var __CC_HANDOFF_COMP_SET_ID__ = ${JSON.stringify(doc.compSetId)};`);
    }
    if (stepSlug === 'cc-doc-props-1' || stepSlug === 'cc-doc-props-2') {
      if (!configObj || !Array.isArray(configObj.properties)) {
        console.error(
          `assemble-slice: ${stepSlug} requires a readable CONFIG with properties[] (same --config-block as the draw).`,
        );
        process.exit(1);
      }
      const n = configObj.properties.length;
      const mid = Math.ceil(n / 2);
      if (stepSlug === 'cc-doc-props-1') {
        lines.push(`var __CC_PROPS_ROW_START__ = 0;`);
        lines.push(`var __CC_PROPS_ROW_END__ = ${mid};`);
      } else {
        lines.push(`var __CC_PROPS_ROW_START__ = ${mid};`);
        lines.push(`var __CC_PROPS_ROW_END__ = ${n};`);
      }
    }
  }

  return lines.join('\n');
}

const varGlobals = buildVarGlobals(step, handoffObj, loadedConfig);

// ── Concatenate: configBlock → varGlobals → patchedPreamble → engine ──────
// Assembly order per EXECUTOR.md §0 / slice-runner §0.1
const code = [configBlock, varGlobals, patchedPreamble, engineSrc].join('\n');

// ── Run check-payload ─────────────────────────────────────────────────────
const checkPayloadScript = join(REPO_ROOT, 'scripts', 'check-payload.mjs');
if (!skipCheck && existsSync(checkPayloadScript)) {
  const cpResult = spawnSync(
    process.execPath,
    [checkPayloadScript],
    { input: code, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  if (cpResult.status !== 0) {
    console.error('assemble-slice: check-payload FAILED');
    if (cpResult.stderr) console.error(cpResult.stderr);
    if (cpResult.stdout) console.error(cpResult.stdout);
    process.exit(10);
  }
}

// ── Write assembled code ──────────────────────────────────────────────────
writeFileSync(resolve(outPath), code, 'utf8');
const codeBytes = Buffer.byteLength(code, 'utf8');

// ── Build and optionally write full MCP args JSON ─────────────────────────
const mcpArgs = { fileKey, code, description, skillNames: 'figma-use,create-component-figma-slice-runner' };
const mcpArgsJson = JSON.stringify(mcpArgs);
const wrapperBytes = Buffer.byteLength(mcpArgsJson, 'utf8');

// ── 1b. Non-canonical sibling guard ──────────────────────────────────────
// Refuses to coexist with parallel naming schemes for the same step. The
// figtest dir today has both `mcp-cc-doc-scaffold.json` AND
// `figma-slices/invoke-cc-doc-scaffold.json` for the same slug — whichever
// the next agent reads first wins, and there's no way to know which is
// current. Hard-fail here eliminates the ambiguity.
function findNonCanonicalSlices(targetMcpPath) {
  const dir = dirname(resolve(targetMcpPath));
  const offenders = [];
  // Patterns considered non-canonical (canonical is `mcp-<slug>.json`):
  //   `mcp-invoke-*.json`, `.mcp-args-*.json`, `figma-slices/invoke-*.json`,
  //   `figma-slices/mcp-invoke-*.json`
  const dirAntiRe = /^(mcp-invoke-.+\.json|\.mcp-args-.+\.json)$/;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (dirAntiRe.test(name)) offenders.push(join(dir, name));
  }
  // Also scan the conventional `figma-slices/` subdir for any invoke-*.json.
  const slicesDir = join(dir, 'figma-slices');
  try {
    if (statSync(slicesDir).isDirectory()) {
      const subAntiRe = /^(invoke-.+\.json|mcp-invoke-.+\.json)$/;
      for (const name of readdirSync(slicesDir)) {
        if (subAntiRe.test(name)) offenders.push(join(slicesDir, name));
      }
    }
  } catch {
    // no subdir → nothing to scan
  }
  return offenders;
}

if (mcpArgsPath && !skipNonCanonicalGuard) {
  const offenders = findNonCanonicalSlices(mcpArgsPath);
  if (offenders.length > 0) {
    console.error(
      'assemble-slice: non-canonical slice files detected (canonical is `mcp-<slug>.json`):',
    );
    for (const p of offenders) console.error(`  - ${p}`);
    console.error(
      '\nRemove these and retry. They cause silent corruption when an agent picks the\n' +
      'wrong file. If a non-create-component tool legitimately writes one of these names,\n' +
      'pass --skip-noncanonical-guard and document why in the run log.',
    );
    process.exit(17);
  }
}

if (mcpArgsPath) {
  writeFileSync(resolve(mcpArgsPath), mcpArgsJson, 'utf8');

  const checkArgsScript = join(REPO_ROOT, 'scripts', 'check-use-figma-mcp-args.mjs');
  if (!skipCheck && existsSync(checkArgsScript)) {
    const caResult = spawnSync(
      process.execPath,
      [checkArgsScript],
      { input: mcpArgsJson, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (caResult.status !== 0) {
      console.error('assemble-slice: check-use-figma-mcp-args FAILED');
      if (caResult.stderr) console.error(caResult.stderr);
      if (caResult.stdout) console.error(caResult.stdout);
      process.exit(11);
    }
  }
}

// ── Success report (1-line + optional paths) ─────────────────────────────
const line1 = `OK step=${step} layout=${layout} code=${codeBytes}B wrapper=${wrapperBytes}B out=${resolve(outPath)}`;
console.log(line1);
if (mcpArgsPath) {
  console.log(`    mcp-args=${resolve(mcpArgsPath)} engine=${engineFile}`);
} else {
  console.log(`    engine=${engineFile}`);
}
