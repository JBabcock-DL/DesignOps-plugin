#!/usr/bin/env node
// designops-canvas-session.mjs — ordered canvas(bundle) steps manifest (Steps 15/17 aligned with canvas-bundle-runner SKILL).

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const CANVAS_STEPS = [
  { step: '15a-primitives', bundle: 'skills/create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js' },
  { step: '15b-theme', bundle: 'skills/create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js' },
  { step: '15c-layout', bundle: 'skills/create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js' },
  { step: '15c-text-styles', bundle: 'skills/create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js' },
  { step: '15c-effects', bundle: 'skills/create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js' },
  { step: '17-token-overview', bundle: 'skills/create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js' },
];

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const k = x.slice(2);
      a[k] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    }
  }
  return a;
}

const raw = parseArgs(process.argv.slice(2));
const outPath = raw.out ? resolve(raw.out) : join(REPO_ROOT, 'current-canvas-session.manifest.json');

const manifest = {
  version: 1,
  kind: 'canvas-bundles',
  designopsPluginRoot: REPO_ROOT,
  steps: CANVAS_STEPS.map((s) => ({
    step: s.step,
    bundlePath: join(REPO_ROOT, s.bundle),
    bundlePathRepoRelative: s.bundle,
    exists: existsSync(join(REPO_ROOT, s.bundle)),
  })),
  parent_note:
    'One Task or parent use_figma per step; Read exactly one bundle path per invocation (canvas-bundle-runner SKILL).',
};

writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(JSON.stringify({ ok: true, written: outPath, stepCount: CANVAS_STEPS.length }, null, 2));
