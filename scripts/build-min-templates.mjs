#!/usr/bin/env node
// Minify the `.figma.js` templates that /create-component inlines into every
// `use_figma` call, AND emit a pre-bundled engine file that agents can paste
// as a single block.
//
// Why the pre-bundle exists:
//   draw-engine.figma.js has an insertion marker (`// ↓↓↓ INLINE
//   archetype-builders.figma.js HERE ↓↓↓`) that splits the file into a top
//   half (helpers + chip buildVariant, §0-§5.7) and a bottom half (main
//   dispatch + doc pipeline, §6.0+). When minified as a single file those
//   comment markers vanish, so agents cannot reliably find the split point
//   to inject archetype-builders between the halves. The runtime `typeof
//   buildSurfaceStackVariant === 'function'` assertion in §6.2a then fires
//   for every non-chip archetype (Card, Input, Checkbox, Select, …) and the
//   whole draw aborts.
//
//   Fix: build the correct ordering once, at build time, and commit it as
//   `create-component-engine.min.figma.js`. The SKILL.md script-assembly
//   order becomes CONFIG preamble + one bundle file — no manual splicing.
//
// Inputs:
//   skills/create-component/templates/draw-engine.figma.js
//   skills/create-component/templates/archetype-builders.figma.js
//
// Outputs (committed siblings):
//   skills/create-component/templates/draw-engine.min.figma.js
//   skills/create-component/templates/archetype-builders.min.figma.js
//   skills/create-component/templates/create-component-engine.min.figma.js  ← preferred inline
//
// Usage:
//   node scripts/build-min-templates.mjs           # writes all three outputs
//   node scripts/build-min-templates.mjs --check   # non-zero if any output is stale
//
// `verify-cache.sh` invokes --check to ensure committed .min artifacts stay
// in sync with their sources.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const DRAW_ENGINE_REL = 'skills/create-component/templates/draw-engine.figma.js';
const ARCHETYPE_BUILDERS_REL = 'skills/create-component/templates/archetype-builders.figma.js';
const BUNDLE_REL = 'skills/create-component/templates/create-component-engine.min.figma.js';

// Standalone minified artifacts (one-to-one with each source).
const STANDALONE_TEMPLATES = [DRAW_ENGINE_REL, ARCHETYPE_BUILDERS_REL];

// Every committed artifact the build produces — used by --check.
const ALL_OUTPUTS = [
  { src: DRAW_ENGINE_REL, dest: minifiedPath(DRAW_ENGINE_REL) },
  { src: ARCHETYPE_BUILDERS_REL, dest: minifiedPath(ARCHETYPE_BUILDERS_REL) },
  // The bundle depends on BOTH sources. Track as two rows so --check reports
  // the actually-stale input when drift is detected.
  { src: DRAW_ENGINE_REL, dest: BUNDLE_REL },
  { src: ARCHETYPE_BUILDERS_REL, dest: BUNDLE_REL },
];

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

function minifiedPath(src) {
  return src.replace(/\.figma\.js$/, '.min.figma.js');
}

/**
 * Minify a plain-script body that uses top-level `await` and/or top-level
 * `return` (both legal inside Figma's implicit async IIFE, but not at ES
 * module top level). Wraps in an async IIFE so esbuild can parse it, then
 * peels the wrapper so the output is still an inline-able script body.
 *
 * identifier mangling is disabled because the runtime
 * `typeof buildSurfaceStackVariant === 'function'` assertions in
 * draw-engine §6.2a / §6.9a resolve by source name.
 */
async function minifyScriptBody(esbuild, srcText, label) {
  const WRAP_OPEN = '(async()=>{';
  const WRAP_CLOSE = '})();';
  const wrapped = `${WRAP_OPEN}\n${srcText}\n${WRAP_CLOSE}`;

  const result = await esbuild.transform(wrapped, {
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    loader: 'js',
    target: 'esnext',
    legalComments: 'none',
  });

  let minBody = result.code.trim();
  if (minBody.endsWith(';')) minBody = minBody.slice(0, -1);

  const WRAP_PREFIXES = ['(async()=>{', '(async () => {'];
  const WRAP_SUFFIXES = ['})()', '})();'];

  let peeled = minBody;
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

function banner(sourceRel) {
  return (
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.\n` +
    `// source: ${sourceRel}\n` +
    `// regenerate with: npm run build:min\n`
  );
}

function bundleBanner() {
  return (
    `// GENERATED by scripts/build-min-templates.mjs — do not edit by hand.\n` +
    `// bundle of:\n` +
    `//   1. ${DRAW_ENGINE_REL} (top half: §0 config resolve .. §5.7 chip buildVariant)\n` +
    `//   2. ${ARCHETYPE_BUILDERS_REL} (all archetype builders, hoisted)\n` +
    `//   3. ${DRAW_ENGINE_REL} (bottom half: §6.0 clear-page .. §6.9a dispatch + doc pipeline)\n` +
    `// regenerate with: npm run build:min\n` +
    `// inline this file verbatim after the Step 0 CONFIG preamble in /create-component.\n`
  );
}

/**
 * Split draw-engine.figma.js on the insertion-point banner:
 *
 *   ...[top half ending with `return { component: c, slots, propKeys }; }`]
 *   // ═══...═══
 *   // ↓↓↓  INLINE archetype-builders.figma.js HERE  ↓↓↓
 *   // ═══...═══
 *   // [prose explaining that archetype-builders goes here]
 *   // ═══...═══
 *   // ↑↑↑  END archetype-builders.figma.js insertion point  ↑↑↑
 *   // ═══...═══
 *   [bottom half starting with // STEP 6. DEFAULT DRAW FLOW]
 *
 * The banner comment is pure documentation — agents were supposed to delete
 * it and paste archetype-builders in its place. We do that automatically by
 * splitting on the two `↓↓↓` / `↑↑↑` sentinel lines, which are unique in the
 * source file, and dropping everything between them.
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
        '  refusing to emit create-component-engine.min.figma.js because the\n' +
        '  split point is ambiguous. restore the banner and retry.'
    );
  }

  // Walk backwards from BEGIN_MARK to include the banner-open `// ═══` line
  // in the DISCARDED chunk, so the top half ends cleanly after buildVariant's
  // closing brace + its trailing blank line.
  const beforeBegin = src.slice(0, beginIdx);
  const topEnd = beforeBegin.lastIndexOf('// ═');
  if (topEnd < 0) {
    throw new Error('splitDrawEngine: could not locate banner-open for begin sentinel');
  }

  // Walk forwards from END_MARK to include the banner-close `// ═══` line in
  // the DISCARDED chunk, so the bottom half starts cleanly on the §6 header.
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

async function buildStandalone(esbuild, srcRel) {
  const srcAbs = resolve(REPO_ROOT, srcRel);
  const destAbs = resolve(REPO_ROOT, minifiedPath(srcRel));
  const srcText = readFileSync(srcAbs, 'utf8');
  const peeled = await minifyScriptBody(esbuild, srcText, srcRel);
  const payload = banner(srcRel) + peeled + '\n';
  writeFileSync(destAbs, payload);
  return {
    srcRel,
    destRel: minifiedPath(srcRel),
    srcBytes: Buffer.byteLength(srcText, 'utf8'),
    destBytes: Buffer.byteLength(payload, 'utf8'),
  };
}

async function buildBundle(esbuild) {
  const drawEngineText = readFileSync(resolve(REPO_ROOT, DRAW_ENGINE_REL), 'utf8');
  const archetypeText = readFileSync(resolve(REPO_ROOT, ARCHETYPE_BUILDERS_REL), 'utf8');

  const { top, bottom } = splitDrawEngine(drawEngineText);

  // Minify each fragment independently so we don't have to hunt for split
  // points in already-minified output. Each fragment is a valid plain-script
  // body on its own — top ends cleanly at the `}` closing buildVariant,
  // bottom starts cleanly at the `// STEP 6` banner, and archetype-builders
  // is self-contained.
  const minTop = await minifyScriptBody(esbuild, top, `${DRAW_ENGINE_REL} (top)`);
  const minArch = await minifyScriptBody(esbuild, archetypeText, ARCHETYPE_BUILDERS_REL);
  const minBottom = await minifyScriptBody(esbuild, bottom, `${DRAW_ENGINE_REL} (bottom)`);

  // Section headers in the emitted bundle so that if an agent opens the file
  // to debug a runtime error, the three segments are still visually
  // distinguishable. These are the ONLY comments preserved in the bundle —
  // minification strips everything else.
  const payload =
    bundleBanner() +
    '// --- §0..§5.7 (draw-engine top) ---\n' +
    minTop +
    '\n' +
    '// --- archetype-builders (hoisted function declarations) ---\n' +
    minArch +
    '\n' +
    '// --- §6.0..§6.9a (draw-engine bottom: clear-page + dispatch + doc pipeline) ---\n' +
    minBottom +
    '\n';

  writeFileSync(resolve(REPO_ROOT, BUNDLE_REL), payload);

  return {
    destRel: BUNDLE_REL,
    topSrcBytes: Buffer.byteLength(top, 'utf8'),
    archSrcBytes: Buffer.byteLength(archetypeText, 'utf8'),
    bottomSrcBytes: Buffer.byteLength(bottom, 'utf8'),
    destBytes: Buffer.byteLength(payload, 'utf8'),
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
    const results = ALL_OUTPUTS.map(checkOne);
    let failed = 0;
    for (const r of results) {
      if (r.missing) {
        console.error(`drift: ${r.dest} is missing. run npm run build:min`);
        failed++;
      } else if (r.stale) {
        console.error(`drift: ${r.src} is newer than ${r.dest}. run npm run build:min`);
        failed++;
      }
    }
    if (failed > 0) process.exit(1);
    console.log('build-min-templates: OK (all up to date)');
    return;
  }

  const esbuild = await loadEsbuild();

  for (const srcRel of STANDALONE_TEMPLATES) {
    const r = await buildStandalone(esbuild, srcRel);
    const pct = ((1 - r.destBytes / r.srcBytes) * 100).toFixed(1);
    console.log(
      `minified ${r.srcRel}\n` +
        `  -> ${r.destRel} (${r.srcBytes} -> ${r.destBytes} bytes, -${pct}%)`
    );
  }

  const b = await buildBundle(esbuild);
  const srcTotal = b.topSrcBytes + b.archSrcBytes + b.bottomSrcBytes;
  const pct = ((1 - b.destBytes / srcTotal) * 100).toFixed(1);
  console.log(
    `bundled create-component engine\n` +
      `  -> ${b.destRel} (${srcTotal} src bytes -> ${b.destBytes} bundled bytes, -${pct}%)`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
