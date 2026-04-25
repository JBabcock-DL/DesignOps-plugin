#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/assemble-slice.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Single-command assembly for one create-component MCP ladder slice.
// Collapses 5 manual steps (Read × 4 files, varGlobals build, check-payload,
// check-use-figma-mcp-args, concat) into one command. Parent still owns
// the `use_figma` call — this script writes the assembled code to --out.
//
// Implements: skills/create-component-figma-slice-runner/SKILL.md §0.1 assembly
//             skills/create-component/conventions/13-component-draw-orchestrator.md §3
//
// Usage
//   node scripts/assemble-slice.mjs \
//     --step <cc-doc-scaffold|cc-variants|cc-doc-component|cc-doc-props|cc-doc-matrix|cc-doc-usage|cc-doc-finalize> \
//     --layout <chip|surface-stack|field|row-item|tiny|control|container|__composes__> \
//     --config-block <path-to-config-block.js> \
//     --registry <path-to-.designops-registry.json> \
//     --handoff <path-to-handoff.json | "{}"> \
//     --file-key <figmaFileKey> \
//     --out <output-code.js> \
//     [--description "<use_figma description string>"] \
//     [--emit-mcp-args <output-mcp-args.json>] \
//     [--plugin-root <path>]  # override create-component skill root (default: auto-detect)
//
// Exit codes:
//   0  ok
//   1  bad CLI args
//   2  unknown step or layout
//   3  missing/unreadable input file
//  10  check-payload failed (assembled code has a JS syntax error)
//  11  check-use-figma-mcp-args failed (MCP wrapper JSON invalid)
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── Bundle map — create-component-figma-slice-runner SKILL.md §2 ───────────
// Maps step slug → engine filename relative to templates/.
// For cc-variants, the filename also depends on layout (see LAYOUT_TO_ARCHETYPE below).
const STEP_ENGINE_MAP = {
  'cc-doc-scaffold':   'create-component-engine-doc.step1.min.figma.js',
  'cc-variants':       null, // resolved via layout → archetype below
  'cc-doc-component':  'create-component-engine-doc.step2.min.figma.js',
  'cc-doc-props':      'create-component-engine-doc.step3.min.figma.js',
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
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      args[key] = argv[++i] ?? '';
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
    '  [--description "<text>"] [--emit-mcp-args <output.json>]\n' +
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

// ── Resolve engine file ───────────────────────────────────────────────────
let engineFile;
if (step === 'cc-variants') {
  const archetype = LAYOUT_TO_ARCHETYPE[layout];
  engineFile = `create-component-engine-${archetype}.step0.min.figma.js`;
} else {
  engineFile = STEP_ENGINE_MAP[step];
}
const enginePath = join(templatesDir, engineFile);
if (!existsSync(enginePath)) {
  console.error(`assemble-slice: engine not found: ${enginePath}. Run: npm run build:min`);
  process.exit(3);
}

// ── Read inputs ───────────────────────────────────────────────────────────
const configBlock = readFile(configPath, '--config-block').trim();
const registry    = parseJsonArg(registryArg, '--registry');
const handoffObj  = parseJsonArg(handoffArg, '--handoff');
const preambleSrc = readFile(preamblePath, 'preamble');
const engineSrc   = readFile(enginePath, `engine (${engineFile})`);

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

// ── Build varGlobals — slice-runner SKILL.md §3 ───────────────────────────
// Four cases: scaffold, variants, doc-component (no compSetId yet), doc-rest
function buildVarGlobals(stepSlug, handoff) {
  const doc = (handoff.doc && typeof handoff.doc === 'object') ? handoff.doc : {};
  const av  = (handoff.afterVariants && typeof handoff.afterVariants === 'object') ? handoff.afterVariants : {};

  const lines = [];

  if (stepSlug === 'cc-doc-scaffold') {
    // First doc slice: no afterVariants, no compSetId. Bundle already sets DOC_STEP=1.
    lines.push(`var __CREATE_COMPONENT_PHASE__ = 2;`);
    lines.push(`var __CREATE_COMPONENT_DOC_STEP__ = 1;`);

  } else if (stepSlug === 'cc-variants') {
    // Second slice: variant plane. Preserves _PageContent from scaffold.
    lines.push(`var __CREATE_COMPONENT_PHASE__ = 1;`);
    const pcId = doc.pageContentId;
    const drId = doc.docRootId;
    if (!pcId || !drId) {
      console.error(
        'assemble-slice: cc-variants requires handoff.doc.pageContentId + docRootId from cc-doc-scaffold return. ' +
        'Run merge-create-component-handoff.mjs after cc-doc-scaffold first.',
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
    const pcId = doc.pageContentId;
    const drId = doc.docRootId;
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
  }

  return lines.join('\n');
}

const varGlobals = buildVarGlobals(step, handoffObj);

// ── Concatenate: configBlock → varGlobals → patchedPreamble → engine ──────
// Assembly order per EXECUTOR.md §0 / slice-runner §0.1
const code = [configBlock, varGlobals, patchedPreamble, engineSrc].join('\n');

// ── Run check-payload ─────────────────────────────────────────────────────
const checkPayloadScript = join(REPO_ROOT, 'scripts', 'check-payload.mjs');
if (existsSync(checkPayloadScript)) {
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

if (mcpArgsPath) {
  writeFileSync(resolve(mcpArgsPath), mcpArgsJson, 'utf8');

  const checkArgsScript = join(REPO_ROOT, 'scripts', 'check-use-figma-mcp-args.mjs');
  if (existsSync(checkArgsScript)) {
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
