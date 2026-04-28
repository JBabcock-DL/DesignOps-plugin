#!/usr/bin/env node
/**
 * Concatenate create-component ctx prefix + committed bundle body for use_figma `code`.
 *
 * Usage (from repo root or consumer repo):
 *   node scripts/assemble-component-use-figma-code.mjs --step cc-scaffold --ctx-file ./draw/ctx.js --out ./draw/assembled-scaffold.mjs
 *
 * --step: cc-scaffold | cc-properties | cc-matrix | cc-usage | cc-component-chip | cc-component-surface-stack | …
 * --ctx-file: UTF-8 file whose content is valid JS executed before the bundle; must define `const ctx = { … };`
 *             (same object shape as EXECUTOR.md — all CONFIG fields plus activeFileKey / fileKey / registryComponents / usesComposes / composedWith).
 *
 * Then: npm run check-payload -- <out>
 * Prefer: Task → canvas-bundle-runner (assembledCodePath + step + fileKey); fallback: parent Read → call_mcp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const BUNDLES_DIR = path.join(REPO_ROOT, 'skills/create-component/canvas-templates/bundles');

/** step (runner slug) → committed bundle filename */
export const CC_STEP_TO_BUNDLE = {
  'cc-scaffold': 'scaffold.min.mcp.js',
  'cc-properties': 'properties.min.mcp.js',
  'cc-matrix': 'matrix.min.mcp.js',
  'cc-usage': 'usage.min.mcp.js',
  'cc-component-chip': 'component-chip.min.mcp.js',
  'cc-component-surface-stack': 'component-surface-stack.min.mcp.js',
  'cc-component-field': 'component-field.min.mcp.js',
  'cc-component-row-item': 'component-row-item.min.mcp.js',
  'cc-component-tiny': 'component-tiny.min.mcp.js',
  'cc-component-control': 'component-control.min.mcp.js',
  'cc-component-container': 'component-container.min.mcp.js',
  'cc-component-composed': 'component-composed.min.mcp.js',
};

function parseArgs(argv) {
  const out = { step: null, ctxFile: null, outPath: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--step' && argv[i + 1]) out.step = argv[++i];
    else if (argv[i] === '--ctx-file' && argv[i + 1]) out.ctxFile = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) out.outPath = argv[++i];
  }
  return out;
}

export function assembleComponentUseFigmaCode({ step, ctxFile, outPath, repoRoot = REPO_ROOT } = {}) {
  const bundlesDir = path.join(repoRoot, 'skills/create-component/canvas-templates/bundles');
  const bundleName = CC_STEP_TO_BUNDLE[step];
  if (!bundleName) {
    throw new Error(
      `assemble-component-use-figma-code: unknown step "${step}". Expected one of: ${Object.keys(CC_STEP_TO_BUNDLE).join(', ')}`,
    );
  }
  if (!ctxFile || !outPath) throw new Error('assemble-component-use-figma-code: ctxFile and outPath required');

  const ctxAbs = path.resolve(ctxFile);
  const bundleAbs = path.join(bundlesDir, bundleName);
  if (!fs.existsSync(ctxAbs)) throw new Error(`ctx file not found: ${ctxAbs}`);
  if (!fs.existsSync(bundleAbs)) throw new Error(`bundle not found: ${bundleAbs}`);

  const ctxPart = fs.readFileSync(ctxAbs, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  const bundlePart = fs.readFileSync(bundleAbs, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const combined = `${ctxPart}\n\n${bundlePart}`;

  const outAbs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, combined, 'utf8');
  return { outAbs, charLength: combined.length, bundleName };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.step || !args.ctxFile || !args.outPath) {
    console.error(`Usage: node scripts/assemble-component-use-figma-code.mjs --step <slug> --ctx-file <path> --out <path>`);
    console.error(`Steps: ${Object.keys(CC_STEP_TO_BUNDLE).join(', ')}`);
    process.exit(2);
  }
  try {
    const { outAbs, charLength } = assembleComponentUseFigmaCode(args);
    console.log(`OK  assembled ${args.step} → ${outAbs} (${charLength} chars)`);
  } catch (e) {
    console.error(e.message || String(e));
    process.exit(1);
  }
}

const __self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__self)) {
  main();
}
