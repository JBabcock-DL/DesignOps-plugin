#!/usr/bin/env node
// Minify the `.figma.js` templates that /create-component inlines into every
// `use_figma` call, and emit per-archetype pre-bundled engine files sized to
// fit under the `use_figma.code` hard limit of 50000 characters.
//
// Why per-archetype:
//   1. The `use_figma` MCP tool schema caps `code` at maxLength:50000. A single
//      full-engine bundle (draw-engine + all 7 archetype builders) minifies to
//      ~49 KB with identifier mangling — technically under the limit, but too
//      tight once the agent prepends the §0 CONFIG preamble (typically
//      1–4 KB), so the submission is rejected by the MCP before it ever runs.
//   2. Each component only needs ONE archetype builder (determined by
//      CONFIG.layout), not all seven. Emitting a separate bundle per archetype
//      gets each file down to 26–32 KB, leaving 18–24 KB of headroom for
//      CONFIG regardless of registry size.
//   3. The two-file runtime workflow (`draw-engine.min` + `archetype-builders
//      .min`, spliced by the agent at a comment marker) doesn't work at all
//      because minification strips the marker — there is no machine-findable
//      split point in the minified output. The build script does the splice
//      from the source files instead, where the marker still exists.
//
// Identifier mangling is safe even though the source uses
// `typeof buildSurfaceStackVariant === 'function'` runtime assertions,
// because those references are in the SAME compilation unit as the
// declarations: esbuild renames the declaration and all references
// consistently. The four "boundary" identifiers declared by the agent-
// authored §0 CONFIG preamble (`CONFIG`, `ACTIVE_FILE_KEY`,
// `REGISTRY_COMPONENTS`, `usesComposes`) are *referenced but not declared*
// inside the templates, so esbuild treats them as free variables and leaves
// them un-renamed automatically.
//
// Inputs:
//   skills/create-component/templates/draw-engine.figma.js
//   skills/create-component/templates/archetype-builders.figma.js
//
// Outputs (committed siblings, regenerated on every `npm run build:min`):
//   skills/create-component/templates/create-component-engine-chip.min.figma.js
//   skills/create-component/templates/create-component-engine-surface-stack.min.figma.js
//   skills/create-component/templates/create-component-engine-field.min.figma.js
//   skills/create-component/templates/create-component-engine-row-item.min.figma.js
//   skills/create-component/templates/create-component-engine-tiny.min.figma.js
//   skills/create-component/templates/create-component-engine-control.min.figma.js
//   skills/create-component/templates/create-component-engine-container.min.figma.js
//   skills/create-component/templates/create-component-engine-composed.min.figma.js  (for CONFIG.layout === '__composes__')
//   skills/create-component/templates/create-component-engine-{layout}.step0.min.figma.js   (variant plane only — MCP ladder)
//   skills/create-component/templates/create-component-engine-doc.step1..step5.min.figma.js (layout-agnostic phase-2 doc slices — slim + esbuild minify + terser unused strip; per-step sizes vary)
//   skills/create-component/templates/create-component-engine.min.figma.js           (debug-only; full 7-archetype bundle, too tight for runtime)
//   skills/create-component/templates/draw-engine.min.figma.js                       (debug-only; standalone draw-engine with no archetype builders)
//   skills/create-component/templates/archetype-builders.min.figma.js                (debug-only; standalone archetype-builders with no draw-engine)
//
// Usage:
//   node scripts/build-min-templates.mjs           # writes all outputs
//   node scripts/build-min-templates.mjs --check   # non-zero if any output is stale
//
// `verify-cache.sh` invokes --check to ensure committed .min artifacts stay
// in sync with their sources.

import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { minify as terserMinify } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const TEMPLATES_DIR = 'skills/create-component/templates';

const DRAW_ENGINE_REL = `${TEMPLATES_DIR}/draw-engine.figma.js`;
const ARCHETYPE_BUILDERS_REL = `${TEMPLATES_DIR}/archetype-builders.figma.js`;

// CONFIG.layout value → builder function name that handles it.
// 'composed' is the filename-safe spelling of CONFIG.layout === '__composes__'.
const ARCHETYPE_BUILDERS = {
  'surface-stack': 'buildSurfaceStackVariant',
  'field': 'buildFieldVariant',
  'row-item': 'buildRowItemVariant',
  'tiny': 'buildTinyVariant',
  'control': 'buildControlVariant',
  'container': 'buildContainerVariant',
  'composed': 'buildComposedVariant',
};

// HARD_LIMIT must match the maxLength in the use_figma tool descriptor
// (mcps/plugin-figma-figma/tools/use_figma.json). The build refuses to commit
// any per-archetype bundle that exceeds HARD_LIMIT - CONFIG_HEADROOM so the
// agent always has enough budget for its §0 CONFIG preamble.
const HARD_LIMIT = 50000;
const CONFIG_HEADROOM = 10000; // agent gets at least 10 KB for CONFIG + registry

const PER_ARCHETYPE_REL = Object.fromEntries(
  Object.keys({ chip: 'chip', ...ARCHETYPE_BUILDERS }).map(layout => [
    layout,
    `${TEMPLATES_DIR}/create-component-engine-${layout}.min.figma.js`,
  ]),
);
const FULL_BUNDLE_REL = `${TEMPLATES_DIR}/create-component-engine.min.figma.js`;
const DRAW_ENGINE_MIN_REL = `${TEMPLATES_DIR}/draw-engine.min.figma.js`;
const ARCHETYPE_BUILDERS_MIN_REL = `${TEMPLATES_DIR}/archetype-builders.min.figma.js`;

const SPLIT_PHASE2_MARK = '// __CREATE_COMPONENT_ENGINE_SPLIT_PHASE2__';

const OMIT_CHIP_START = '// __CC_DOC_SLIM_OMIT_CHIP_BUILDER_START__';
const OMIT_CHIP_END = '// __CC_DOC_SLIM_OMIT_CHIP_BUILDER_END__';
const OMIT_ELSE_BEGIN = '// __CC_DOC_SLIM_OMIT_VARIANT_ELSE_BEGIN__';
const OMIT_ELSE_END = '// __CC_DOC_SLIM_OMIT_VARIANT_ELSE_END__';

function lineEndAfter(src, fromIdx) {
  const nl = src.indexOf('\n', fromIdx);
  return nl === -1 ? src.length : nl + 1;
}

function stripDocSlimChipBuilder(top) {
  const s = top.indexOf(OMIT_CHIP_START);
  const e = top.indexOf(OMIT_CHIP_END);
  if (s < 0 || e < 0) {
    throw new Error(
      `stripDocSlimChipBuilder: missing ${OMIT_CHIP_START} or ${OMIT_CHIP_END} in draw-engine top.`,
    );
  }
  const afterE = lineEndAfter(top, e);
  return `${top.slice(0, s).trimEnd()}\n\n${top.slice(afterE).trimStart()}`;
}

function stripDocSlimVariantElse(bottom) {
  const a = bottom.indexOf(OMIT_ELSE_BEGIN);
  const b = bottom.indexOf(OMIT_ELSE_END);
  if (a < 0 || b < 0) {
    throw new Error(
      `stripDocSlimVariantElse: missing ${OMIT_ELSE_BEGIN} or ${OMIT_ELSE_END} in draw-engine bottom.`,
    );
  }
  const afterB = lineEndAfter(bottom, b);
  return `${bottom.slice(0, a).trimEnd()}\n}\n\n${bottom.slice(afterB).trimStart()}`;
}

// Replaced for step1..step5 min bundles so __ccDocStep is a constant → esbuild DCE drops other branches.
const DOC_STEP_RUNTIME_BLOCK = `const __ccDocStepDefault = null;
const __ccDocStep =
  typeof __CREATE_COMPONENT_DOC_STEP__ === 'number'
    ? __CREATE_COMPONENT_DOC_STEP__
    : __ccDocStepDefault;`;

function assembledIncludesDocStepBlock(s) {
  return s.includes(DOC_STEP_RUNTIME_BLOCK);
}

// Every committed artifact the build produces — used by --check. Per-archetype
// bundles depend on BOTH sources, so each is tracked as two rows.
function buildCheckRows() {
  const rows = [];
  for (const dest of Object.values(PER_ARCHETYPE_REL)) {
    rows.push({ src: DRAW_ENGINE_REL, dest });
    // chip bundles don't use archetype-builders, but including the dep is
    // harmless — it just means editing archetype-builders.figma.js marks
    // every bundle stale, prompting a rebuild. That matches reality since
    // editing the shared helpers in archetype-builders.figma.js would change
    // cross-bundle contracts.
    rows.push({ src: ARCHETYPE_BUILDERS_REL, dest });
  }
  const layouts = ['chip', ...Object.keys(ARCHETYPE_BUILDERS)];
  for (const layout of layouts) {
    const dest0 = `${TEMPLATES_DIR}/create-component-engine-${layout}.step0.min.figma.js`;
    rows.push({ src: DRAW_ENGINE_REL, dest: dest0 });
    rows.push({ src: ARCHETYPE_BUILDERS_REL, dest: dest0 });
  }
  for (let s = 1; s <= 5; s++) {
    const dest = `${TEMPLATES_DIR}/create-component-engine-doc.step${s}.min.figma.js`;
    rows.push({ src: DRAW_ENGINE_REL, dest });
  }
  rows.push({ src: DRAW_ENGINE_REL, dest: FULL_BUNDLE_REL });
  rows.push({ src: ARCHETYPE_BUILDERS_REL, dest: FULL_BUNDLE_REL });
  rows.push({ src: DRAW_ENGINE_REL, dest: DRAW_ENGINE_MIN_REL });
  rows.push({ src: ARCHETYPE_BUILDERS_REL, dest: ARCHETYPE_BUILDERS_MIN_REL });
  return rows;
}

function sliceStep0Bottom(drawBottom) {
  const idx = drawBottom.indexOf(SPLIT_PHASE2_MARK);
  if (idx < 0) {
    throw new Error(
      `sliceStep0Bottom: missing ${SPLIT_PHASE2_MARK} in draw-engine bottom — cannot emit step0 bundles.`,
    );
  }
  return drawBottom.slice(0, idx).trimEnd() + '\n';
}

function step0BundleBanner(layout, includedBuilder) {
  const lines = [
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.`,
    `// bundle: create-component-engine step0 variants-only (${layout})`,
    `// sources: ${DRAW_ENGINE_REL} (truncated before ${SPLIT_PHASE2_MARK})`,
  ];
  if (layout === 'chip') {
    lines.push(`//   (no archetype-builders — chip layout)`);
  } else {
    lines.push(`//   ${ARCHETYPE_BUILDERS_REL} (shared helpers + ${includedBuilder})`);
  }
  lines.push(`// regenerate: npm run build:min`);
  lines.push(
    `// Runner: MCP call 0 — inject __CREATE_COMPONENT_PHASE__=1 or omit (single-pass); see create-component-figma-runner §1c.`,
  );
  return lines.join('\n') + '\n';
}

function docSlimStepBanner(stepNum) {
  const lines = [
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.`,
    `// bundle: create-component-engine-doc step${stepNum} (layout-agnostic phase-2 doc slice)`,
    `// sources: ${DRAW_ENGINE_REL} only — slim top (no chip buildVariant) + slim bottom (no variant-build else) + baked __CREATE_COMPONENT_PHASE__=2; esbuild then terser (dead/unused strip)`,
    `// regenerate: npm run build:min`,
    `// Runner: same for every CONFIG.layout — inject §1b phase-2 globals + handoff ids for steps 2–5.`,
  ];
  return lines.join('\n') + '\n';
}

async function buildStepZero(esbuild, layout, { drawTop, drawBottom, sharedHelpers, builders }) {
  const destRel = `${TEMPLATES_DIR}/create-component-engine-${layout}.step0.min.figma.js`;
  const step0Bottom = sliceStep0Bottom(drawBottom);
  // Full draw-engine continues to the doc tail when _ccPhase === 0. This bundle
  // truncates before the doc tail, so without this guard a legacy _ccPhase 0 run
  // would fall off the end after building variants. Mirror phase-1 return shape.
  const step0Phase0Return = `
if (_ccPhase === 0) {
  return {
    ok: true,
    phase: 0,
    compSetId: compSet.id,
    compSetName: compSet.name,
    compSetKey: compSet.key,
    propsAdded,
    unresolvedTokenMisses: _unresolvedTokenMisses.slice(),
    layout: layoutKey === '__composes__' ? 'composes' : (CONFIG.layout || 'chip'),
  };
}
`;
  let includedBuilder = null;
  let assembled;
  if (layout === 'chip') {
    assembled = drawTop + '\n' + step0Bottom + step0Phase0Return;
  } else {
    includedBuilder = ARCHETYPE_BUILDERS[layout];
    const builderSrc = builders[includedBuilder];
    if (!builderSrc) throw new Error(`builder ${includedBuilder} not parsed for layout ${layout}`);
    assembled = drawTop + '\n' + sharedHelpers + '\n' + builderSrc + '\n' + step0Bottom + step0Phase0Return;
  }

  const peeled = await minifyScriptBody(esbuild, assembled, `step0[${layout}]`, { mangle: true });
  const body = step0BundleBanner(layout, includedBuilder) + peeled + '\n';
  const bodyBytes = Buffer.byteLength(body, 'utf8');
  if (bodyBytes > HARD_LIMIT - CONFIG_HEADROOM) {
    throw new Error(
      `step0[${layout}] is ${bodyBytes} bytes, exceeds budget ${HARD_LIMIT - CONFIG_HEADROOM}`,
    );
  }
  writeFileSync(resolve(REPO_ROOT, destRel), body);
  return { layout, step: 0, destRel, destBytes: bodyBytes };
}

function removeObsoletePerLayoutDocSteps() {
  const layouts = ['chip', ...Object.keys(ARCHETYPE_BUILDERS)];
  const dir = resolve(REPO_ROOT, TEMPLATES_DIR);
  for (const layout of layouts) {
    for (let s = 1; s <= 5; s++) {
      const p = resolve(dir, `create-component-engine-${layout}.step${s}.min.figma.js`);
      if (existsSync(p)) unlinkSync(p);
    }
  }
}

async function buildDocSlimSteps(esbuild, drawTop, drawBottom) {
  if (!assembledIncludesDocStepBlock(drawBottom)) {
    throw new Error('buildDocSlimSteps: draw-engine bottom missing __ccDocStep block.');
  }
  const slimTop = stripDocSlimChipBuilder(drawTop);
  const slimBottom = stripDocSlimVariantElse(drawBottom);
  let base = `${slimTop}\n${slimBottom}`;
  if (!assembledIncludesDocStepBlock(base)) {
    throw new Error('buildDocSlimSteps: slim assembly lost __ccDocStep block.');
  }
  const results = [];
  for (let stepNum = 1; stepNum <= 5; stepNum++) {
    let assembled = base.replace(DOC_STEP_RUNTIME_BLOCK, `const __ccDocStep = ${stepNum};`);
    assembled = `var __CREATE_COMPONENT_PHASE__=2;\n${assembled}`;
    let peeled = await minifyScriptBody(esbuild, assembled, `doc-slim-step${stepNum}`, {
      mangle: true,
    });
    peeled = await terserDeadStripAsyncBody(peeled, `doc-slim-step${stepNum}`);
    const destRel = `${TEMPLATES_DIR}/create-component-engine-doc.step${stepNum}.min.figma.js`;
    const body = docSlimStepBanner(stepNum) + peeled + '\n';
    const bodyBytes = Buffer.byteLength(body, 'utf8');
    if (bodyBytes > HARD_LIMIT - CONFIG_HEADROOM) {
      throw new Error(
        `create-component-engine-doc.step${stepNum} is ${bodyBytes} bytes, exceeds budget ${HARD_LIMIT - CONFIG_HEADROOM}`,
      );
    }
    writeFileSync(resolve(REPO_ROOT, destRel), body);
    results.push({ step: stepNum, destRel, destBytes: bodyBytes });
  }
  return results;
}

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch (err) {
    console.error(
      'error: esbuild is required but not installed.\n' +
        '       run `npm install` at the repo root to install devDependencies,\n' +
        '       then retry `npm run build:min`.'
    );
    process.exit(1);
  }
}

const ASYNC_IIFE_WRAP_OPEN = '(async()=>{';
const ASYNC_IIFE_WRAP_CLOSE = '})();';

/** Peel the async IIFE wrapper esbuild/terser emit around a Figma script body. */
function peelAsyncIifeWrapper(minBody, label) {
  let peeled = minBody.trim();
  if (peeled.endsWith(';')) peeled = peeled.slice(0, -1);

  const WRAP_PREFIXES = ['(async()=>{', '(async () => {'];
  const WRAP_SUFFIXES = ['})()', '})();'];

  const matchedPrefix = WRAP_PREFIXES.find(p => peeled.startsWith(p));
  if (!matchedPrefix) {
    throw new Error(
      `minify wrapper not found in output for ${label} — cannot safely strip.\n` +
        `first 80 chars: ${peeled.slice(0, 80)}`
    );
  }
  peeled = peeled.slice(matchedPrefix.length);
  const matchedSuffix = WRAP_SUFFIXES.find(s => peeled.endsWith(s));
  if (!matchedSuffix) {
    throw new Error(
      `minify wrapper close not found in output for ${label} — cannot safely strip.\n` +
        `last 80 chars: ${peeled.slice(-80)}`
    );
  }
  peeled = peeled.slice(0, peeled.length - matchedSuffix.length);
  return peeled;
}

/**
 * Second pass for doc-step bundles: esbuild.transform does not eliminate
 * functions only referenced from dead `__ccDocStep` branches. Terser
 * compress.unused removes them. Input/output are the same shape as
 * minifyScriptBody — a peelable async-IIFE body (no outer wrapper).
 */
async function terserDeadStripAsyncBody(esbuildPeeledBody, label) {
  const wrapped = `${ASYNC_IIFE_WRAP_OPEN}\n${esbuildPeeledBody}\n${ASYNC_IIFE_WRAP_CLOSE}`;
  const result = await terserMinify(wrapped, {
    compress: {
      passes: 3,
      dead_code: true,
      unused: true,
    },
    mangle: true,
    format: {
      ascii_only: false,
      comments: false,
    },
  });
  if (result.error) {
    throw new Error(`terser (${label}): ${result.error}`);
  }
  return peelAsyncIifeWrapper(result.code || '', label);
}

/**
 * Minify a plain-script body that uses top-level `await` and/or top-level
 * `return` (both legal inside Figma's implicit async IIFE, but not at ES
 * module top level). Wraps in an async IIFE so esbuild can parse it, then
 * peels the wrapper so the output is still an inline-able script body.
 */
async function minifyScriptBody(esbuild, srcText, label, { mangle }) {
  const wrapped = `${ASYNC_IIFE_WRAP_OPEN}\n${srcText}\n${ASYNC_IIFE_WRAP_CLOSE}`;

  const result = await esbuild.transform(wrapped, {
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: mangle,
    loader: 'js',
    target: 'esnext',
    legalComments: 'none',
    // charset: 'utf8' keeps non-ASCII characters (§, ×, ·, ¬, em-dash, etc.)
    // literal in the output instead of escaping them as \xHH. The \xHH form is
    // valid JavaScript but INVALID JSON — when the bundle is embedded in a JSON
    // string argument (e.g. the MCP `use_figma.code` field), JSON.parse rejects
    // it with "Bad escaped character in JSON". JSON strings carry literal UTF-8
    // bytes natively, so 'utf8' is strictly better for our transport. Do NOT
    // revert to the esbuild default ('ascii') without also adding a post-pass
    // that converts \xHH → \u00HH. See skills/create-component/EXECUTOR.md (MCP transport).
    charset: 'utf8',
  });

  let minBody = result.code.trim();
  if (minBody.endsWith(';')) minBody = minBody.slice(0, -1);

  return peelAsyncIifeWrapper(minBody, label);
}

function banner(sourceRel) {
  return (
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.\n` +
    `// source: ${sourceRel}\n` +
    `// regenerate with: npm run build:min\n`
  );
}

function bundleBanner({ layout, includedBuilder }) {
  const lines = [
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.`,
    `// bundle: create-component-engine (${layout})`,
    `// sources:`,
    `//   ${DRAW_ENGINE_REL} (full)`,
  ];
  if (layout === 'chip') {
    lines.push(`//   (no archetype-builders — chip layout uses buildVariant defined in draw-engine §5.7)`);
  } else if (layout === '__ALL__') {
    lines.push(`//   ${ARCHETYPE_BUILDERS_REL} (full — all 7 archetype builders; debug only, too tight for runtime)`);
  } else {
    lines.push(`//   ${ARCHETYPE_BUILDERS_REL} (shared helpers + ${includedBuilder} only)`);
  }
  lines.push(`// regenerate with: npm run build:min`);
  lines.push(`// inline this file verbatim after the §0 CONFIG preamble in /create-component.`);
  return lines.join('\n') + '\n';
}

/**
 * Split draw-engine.figma.js on the archetype-builders insertion banner.
 * Returns { top, bottom } where the banner block itself is discarded.
 */
function splitDrawEngine(src) {
  const BEGIN_MARK = '// ↓↓↓  INLINE archetype-builders.figma.js HERE  ↓↓↓';
  const END_MARK = '// ↑↑↑  END archetype-builders.figma.js insertion point  ↑↑↑';

  const beginIdx = src.indexOf(BEGIN_MARK);
  const endIdx = src.indexOf(END_MARK);
  if (beginIdx < 0 || endIdx < 0 || endIdx <= beginIdx) {
    throw new Error(
      'splitDrawEngine: could not find the archetype-builders insertion banner.\n' +
        '  expected both of these lines in draw-engine.figma.js:\n' +
        `    ${BEGIN_MARK}\n` +
        `    ${END_MARK}\n` +
        '  refusing to emit bundled outputs because the split point is ambiguous.\n' +
        '  restore the banner and retry.'
    );
  }

  const beforeBegin = src.slice(0, beginIdx);
  const topEnd = beforeBegin.lastIndexOf('// ═');
  if (topEnd < 0) {
    throw new Error('splitDrawEngine: could not locate banner-open for begin sentinel');
  }

  const afterEndMark = src.indexOf('\n', endIdx) + 1;
  const bannerCloseIdx = src.indexOf('// ═', afterEndMark);
  if (bannerCloseIdx < 0) {
    throw new Error('splitDrawEngine: could not locate banner-close for end sentinel');
  }
  const bottomStart = src.indexOf('\n', bannerCloseIdx) + 1;

  return {
    top: src.slice(0, topEnd).trimEnd() + '\n',
    bottom: src.slice(bottomStart),
  };
}

/**
 * Parse archetype-builders.figma.js into:
 *   sharedHelpers — everything before the first `function buildXxxVariant(`
 *   builders[name] — each `function buildXxxVariant(...)` block up to the
 *                    next builder or EOF
 *
 * The parse is regex-based because the file deliberately has only top-level
 * function declarations at column 0 — any nested `function` is indented,
 * so `^function <name>\(` is unambiguous.
 */
function parseArchetypeBuilders(src) {
  const names = Object.values(ARCHETYPE_BUILDERS);
  const starts = [];
  for (const name of names) {
    const re = new RegExp('\\nfunction ' + name + '\\(');
    const m = src.match(re);
    if (!m) {
      throw new Error(
        `parseArchetypeBuilders: builder '${name}' not found at column 0 in ${ARCHETYPE_BUILDERS_REL}.\n` +
          '  every function declared at the top of archetype-builders.figma.js must start at column 0\n' +
          '  so this parser can delimit each block.'
      );
    }
    starts.push({ name, start: m.index + 1 }); // +1 to step past the \n
  }
  starts.sort((a, b) => a.start - b.start);

  const sharedHelpers = src.slice(0, starts[0].start);
  const builders = {};
  for (let i = 0; i < starts.length; i++) {
    const { name, start } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].start : src.length;
    builders[name] = src.slice(start, end);
  }
  return { sharedHelpers, builders };
}

async function buildStandalone(esbuild, srcRel, destRel) {
  const srcAbs = resolve(REPO_ROOT, srcRel);
  const destAbs = resolve(REPO_ROOT, destRel);
  const srcText = readFileSync(srcAbs, 'utf8');
  // Standalones keep identifier mangling OFF — they're debug artifacts, and
  // their function names are what a developer reads when eyeballing the
  // output. The RUNTIME bundle uses the mangled per-archetype variants.
  const peeled = await minifyScriptBody(esbuild, srcText, srcRel, { mangle: false });
  const payload = banner(srcRel) + peeled + '\n';
  writeFileSync(destAbs, payload);
  return {
    srcRel,
    destRel,
    srcBytes: Buffer.byteLength(srcText, 'utf8'),
    destBytes: Buffer.byteLength(payload, 'utf8'),
  };
}

async function buildPerArchetype(esbuild, layout, { drawTop, drawBottom, sharedHelpers, builders }) {
  const destRel = PER_ARCHETYPE_REL[layout];
  if (!destRel) throw new Error(`unknown archetype layout: ${layout}`);

  let includedBuilder = null;
  let assembled;
  if (layout === 'chip') {
    // chip uses buildVariant (defined in draw-engine top §5.7) — no archetype-builders needed.
    assembled = drawTop + '\n' + drawBottom;
  } else {
    includedBuilder = ARCHETYPE_BUILDERS[layout];
    const builderSrc = builders[includedBuilder];
    if (!builderSrc) throw new Error(`builder ${includedBuilder} not parsed for layout ${layout}`);
    assembled = drawTop + '\n' + sharedHelpers + '\n' + builderSrc + '\n' + drawBottom;
  }

  const peeled = await minifyScriptBody(esbuild, assembled, `bundle[${layout}]`, { mangle: true });
  const body = bundleBanner({ layout, includedBuilder }) + peeled + '\n';
  const bodyBytes = Buffer.byteLength(body, 'utf8');

  if (bodyBytes > HARD_LIMIT - CONFIG_HEADROOM) {
    throw new Error(
      `bundle[${layout}] is ${bodyBytes} bytes, exceeds budget ${HARD_LIMIT - CONFIG_HEADROOM}` +
        ` (hard limit ${HARD_LIMIT} minus ${CONFIG_HEADROOM} reserved for agent CONFIG preamble).\n` +
        '  Shrink one of the shared helpers or the builder itself before committing.'
    );
  }

  writeFileSync(resolve(REPO_ROOT, destRel), body);
  return {
    layout,
    destRel,
    srcBytes: Buffer.byteLength(assembled, 'utf8'),
    destBytes: bodyBytes,
  };
}

async function buildFullBundle(esbuild, { drawTop, drawBottom }, archetypeSrc) {
  const assembled = drawTop + '\n' + archetypeSrc + '\n' + drawBottom;
  const peeled = await minifyScriptBody(esbuild, assembled, 'bundle[full]', { mangle: true });
  const body = bundleBanner({ layout: '__ALL__' }) + peeled + '\n';
  // No budget assertion here — the full bundle is intentionally a debug
  // artifact and will normally exceed HARD_LIMIT - CONFIG_HEADROOM.
  writeFileSync(resolve(REPO_ROOT, FULL_BUNDLE_REL), body);
  return {
    destRel: FULL_BUNDLE_REL,
    srcBytes: Buffer.byteLength(assembled, 'utf8'),
    destBytes: Buffer.byteLength(body, 'utf8'),
  };
}

function checkOne({ src, dest }) {
  const srcAbs = resolve(REPO_ROOT, src);
  const destAbs = resolve(REPO_ROOT, dest);
  if (!existsSync(destAbs)) {
    return { src, dest, missing: true };
  }
  const srcMtime = statSync(srcAbs).mtimeMs;
  const destMtime = statSync(destAbs).mtimeMs;
  if (srcMtime > destMtime) {
    return { src, dest, stale: true };
  }
  return { src, dest, ok: true };
}

async function main() {
  const check = process.argv.includes('--check');

  if (check) {
    const results = buildCheckRows().map(checkOne);
    let failed = 0;
    const reported = new Set();
    for (const r of results) {
      if (r.missing && !reported.has(`missing:${r.dest}`)) {
        console.error(`drift: ${r.dest} is missing. run npm run build:min`);
        reported.add(`missing:${r.dest}`);
        failed++;
      } else if (r.stale && !reported.has(`stale:${r.src}:${r.dest}`)) {
        console.error(`drift: ${r.src} is newer than ${r.dest}. run npm run build:min`);
        reported.add(`stale:${r.src}:${r.dest}`);
        failed++;
      }
    }
    if (failed > 0) process.exit(1);
    console.log('build-min-templates: OK (all up to date)');
    return;
  }

  const esbuild = await loadEsbuild();

  const drawEngineSrc = readFileSync(resolve(REPO_ROOT, DRAW_ENGINE_REL), 'utf8');
  const archetypeSrc = readFileSync(resolve(REPO_ROOT, ARCHETYPE_BUILDERS_REL), 'utf8');

  const { top: drawTop, bottom: drawBottom } = splitDrawEngine(drawEngineSrc);
  const { sharedHelpers, builders } = parseArchetypeBuilders(archetypeSrc);

  removeObsoletePerLayoutDocSteps();

  // (1) Debug-only standalones — NOT inlined by agents at runtime.
  for (const [srcRel, destRel] of [
    [DRAW_ENGINE_REL, DRAW_ENGINE_MIN_REL],
    [ARCHETYPE_BUILDERS_REL, ARCHETYPE_BUILDERS_MIN_REL],
  ]) {
    const r = await buildStandalone(esbuild, srcRel, destRel);
    const pct = ((1 - r.destBytes / r.srcBytes) * 100).toFixed(1);
    console.log(
      `standalone (debug-only) ${r.srcRel}\n` +
        `  -> ${r.destRel} (${r.srcBytes} -> ${r.destBytes} bytes, -${pct}%)`
    );
  }

  // (2) Per-archetype runtime bundles.
  const layouts = ['chip', ...Object.keys(ARCHETYPE_BUILDERS)];
  for (const layout of layouts) {
    const r = await buildPerArchetype(esbuild, layout, { drawTop, drawBottom, sharedHelpers, builders });
    const remaining = HARD_LIMIT - r.destBytes;
    console.log(
      `bundle[${layout}]`.padEnd(28) +
        `${r.destBytes} bytes (${remaining} bytes of CONFIG headroom under ${HARD_LIMIT} use_figma limit)`
    );
  }

  // (2b) MCP ladder: step0 per layout + shared slim doc steps 1..5 (one file each).
  for (const layout of layouts) {
    const s0 = await buildStepZero(esbuild, layout, { drawTop, drawBottom, sharedHelpers, builders });
    console.log(
      `step0[${layout}]`.padEnd(28) +
        `${s0.destBytes} bytes (${HARD_LIMIT - s0.destBytes} headroom vs ${HARD_LIMIT})`,
    );
  }
  const docSlim = await buildDocSlimSteps(esbuild, drawTop, drawBottom);
  for (const r of docSlim) {
    console.log(
      `doc.step${r.step}`.padEnd(28) +
        `${r.destBytes} bytes (${HARD_LIMIT - r.destBytes} headroom vs ${HARD_LIMIT})`,
    );
  }

  // (3) Full debug bundle — all archetypes in one file, too tight for runtime.
  const full = await buildFullBundle(esbuild, { drawTop, drawBottom }, archetypeSrc);
  const fullRemaining = HARD_LIMIT - full.destBytes;
  console.log(
    `bundle[full]`.padEnd(28) +
      `${full.destBytes} bytes (${fullRemaining} bytes left vs use_figma limit — ` +
      `${fullRemaining < CONFIG_HEADROOM ? 'DEBUG-ONLY, too tight for CONFIG' : 'runtime-safe'})`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
