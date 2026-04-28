#!/usr/bin/env node
/**
 * Single orchestration path for /create-component Step 6 prep:
 * assemble ctx + bundle for all five runner slugs (fixed order),
 * run check-payload on each output, optionally probe-parent-transport / check MCP wrapper JSON,
 * write progress + runner hints JSON for sequential Task/parent use_figma (never parallel cc-* Tasks).
 *
 * Usage (from plugin repo root or any cwd — resolves repo root from this script):
 *   node scripts/create-component-step6-all.mjs --ctx-file /path/to/radio-group.ctx.js
 *   node scripts/create-component-step6-all.mjs --ctx-file ./draw/ctx.js --out-dir ./draw --check-mcp-args
 *   node scripts/create-component-step6-all.mjs --ctx-file ./draw/ctx.js --probe-first --file-key K
 *
 * Does NOT invoke use_figma (IDE MCP only).
 *
 * Audience: agents / CI — run from the DesignOps-plugin root per AGENTS.md (*Agents run plugin CLI*).
 * Do not treat this as an end-user manual copy-paste step when an agent can execute it.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleComponentUseFigmaCode } from './assemble-component-use-figma-code.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/** Mirrors conventions/02-archetype-routing.md layout → bundle slug */
const LAYOUT_TO_COMPONENT_STEP = {
  chip: 'cc-component-chip',
  'surface-stack': 'cc-component-surface-stack',
  field: 'cc-component-field',
  'row-item': 'cc-component-row-item',
  tiny: 'cc-component-tiny',
  control: 'cc-component-control',
  container: 'cc-component-container',
  '__composes__': 'cc-component-composed',
};

function usage(code = 2) {
  console.error(`
Usage:
  node scripts/create-component-step6-all.mjs --ctx-file <path> [options]

Required:
  --ctx-file <path>     UTF-8 JS file defining const ctx = { … }; (EXECUTOR §0)

Options:
  --out-dir <path>      Assembled outputs + progress JSON (default: dirname(ctx-file))
  --repo-root <path>    DesignOps-plugin root with skills/create-component/… (default: this repo)
  --component-bundle-step <slug>   Override cc-component-* from layout (e.g. cc-component-control)
  --probe-first         Emit probe-parent-transport JSON (--size 38000) before assembling
  --probe-size <n>      Override probe byte size (default 38000)
  --check-mcp-args      After each assemble, verify full MCP wrapper JSON round-trips (writes temp files under os.tmpdir())
  --progress-file <path>  Override progress JSON path (default: <out-dir>/create-component-step6-progress.json)
  --dry-run             Print planned steps + paths only (no writes)
  --file-key <key>      Optional fileKey for probe / MCP-args hints if missing from ctx

Reads layout + component + fileKey from ctx source via regex (no vm eval).
`);
  process.exit(code);
}

function parseArgs(argv) {
  const o = {
    ctxFile: null,
    outDir: null,
    repoRoot: REPO_ROOT,
    componentBundleStep: null,
    probeFirst: false,
    probeSize: 38000,
    checkMcpArgs: false,
    progressFile: null,
    dryRun: false,
    fileKey: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ctx-file') o.ctxFile = argv[++i];
    else if (a === '--out-dir') o.outDir = argv[++i];
    else if (a === '--repo-root') o.repoRoot = path.resolve(argv[++i]);
    else if (a === '--component-bundle-step') o.componentBundleStep = argv[++i];
    else if (a === '--probe-first') o.probeFirst = true;
    else if (a === '--probe-size') o.probeSize = parseInt(argv[++i], 10);
    else if (a === '--check-mcp-args') o.checkMcpArgs = true;
    else if (a === '--progress-file') o.progressFile = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--file-key') o.fileKey = argv[++i];
    else if (a === '-h' || a === '--help') usage(0);
    else {
      console.error(`create-component-step6-all: unknown arg: ${a}`);
      usage(1);
    }
  }
  return o;
}

function parseCtxMeta(src) {
  const layoutM = src.match(/\blayout:\s*['"]([^'"]+)['"]/);
  const componentM = src.match(/\bcomponent:\s*['"]([^'"]+)['"]/);
  let fileKey =
    src.match(/\bactiveFileKey:\s*['"]([^'"]+)['"]/)?.[1] ||
    src.match(/\bfileKey:\s*['"]([^'"]+)['"]/)?.[1] ||
    null;
  return {
    layout: layoutM ? layoutM[1] : null,
    component: componentM ? componentM[1] : 'component',
    fileKey,
  };
}

function buildSequence(layout, explicitSlug) {
  const fallback = LAYOUT_TO_COMPONENT_STEP.chip;
  let componentStep =
    explicitSlug ||
    (layout && LAYOUT_TO_COMPONENT_STEP[layout]) ||
    fallback;
  if (!explicitSlug && layout && !LAYOUT_TO_COMPONENT_STEP[layout]) {
    console.warn(`create-component-step6-all: unknown layout "${layout}" — using ${fallback}`);
    componentStep = fallback;
  }
  return ['cc-scaffold', 'cc-properties', componentStep, 'cc-matrix', 'cc-usage'];
}

function assembledPath(outDir, slug) {
  return path.join(outDir, `assembled-${slug}.mjs`);
}

function runProbeFirst({ repoRoot, outDir, fileKey, probeSize, dryRun }) {
  const probeScript = path.join(repoRoot, 'scripts/probe-parent-transport.mjs');
  const outProbe = path.join(outDir, '.probe-parent-transport-mcp-args.json');
  if (dryRun) {
    console.log(`[dry-run] probe-parent-transport → ${outProbe}`);
    return { ok: true, skipped: true };
  }
  const fk = fileKey || 'PROBE_NO_FIGMA_FILE_REQUIRED';
  const r = spawnSync(process.execPath, [probeScript, '--size', String(probeSize), '--file-key', fk, '--out', outProbe], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'probe-parent-transport failed');
    return { ok: false, exitCode: r.status ?? 1 };
  }
  console.log(`OK  probe-parent-transport → ${outProbe}`);
  return { ok: true, path: outProbe };
}

function runCheckPayload(repoRoot, assembledAbs) {
  const check = path.join(repoRoot, 'scripts/check-payload.mjs');
  const r = spawnSync(process.execPath, [check, assembledAbs], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  return { ok: r.status === 0, exitCode: r.status ?? 1, stderr: r.stderr || '', stdout: r.stdout || '' };
}

function runCheckMcpArgs(repoRoot, assembledAbs, fileKey, slug) {
  const checker = path.join(repoRoot, 'scripts/check-use-figma-mcp-args.mjs');
  const code = fs.readFileSync(assembledAbs, 'utf8');
  const fk = fileKey || 'PLACEHOLDER_FILE_KEY';
  const payload = {
    fileKey: fk,
    code,
    description: `create-component-step6-all ${slug}`,
    skillNames: 'figma-use,canvas-bundle-runner',
  };
  const tmp = path.join(os.tmpdir(), `step6-mcp-args-${slug}-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
  try {
    const r = spawnSync(process.execPath, [checker, tmp], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    return { ok: r.status === 0, exitCode: r.status ?? 1, stderr: r.stderr || '', tmp };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.ctxFile) {
    console.error('create-component-step6-all: --ctx-file required');
    usage(2);
  }
  const ctxAbs = path.resolve(opts.ctxFile);
  if (!fs.existsSync(ctxAbs)) {
    console.error(`create-component-step6-all: ctx file not found: ${ctxAbs}`);
    process.exit(2);
  }
  const ctxSrc = fs.readFileSync(ctxAbs, 'utf8');
  const meta = parseCtxMeta(ctxSrc);
  const fileKey = opts.fileKey || meta.fileKey || null;
  const outDir = opts.outDir ? path.resolve(opts.outDir) : path.dirname(ctxAbs);
  const progressPath =
    opts.progressFile ||
    path.join(outDir, 'create-component-step6-progress.json');

  const sequence = buildSequence(meta.layout, opts.componentBundleStep);

  if (opts.dryRun) {
    console.log(`create-component-step6-all dry-run`);
    console.log(`  ctx:       ${ctxAbs}`);
    console.log(`  out-dir:   ${outDir}`);
    console.log(`  layout:    ${meta.layout || '(unset)'}`);
    console.log(`  component: ${meta.component}`);
    console.log(`  fileKey:   ${fileKey || '(unset)'}`);
    console.log(`  sequence:  ${sequence.join(' → ')}`);
    sequence.forEach((slug) => console.log(`    - ${slug} → ${assembledPath(outDir, slug)}`));
    process.exit(0);
  }

  fs.mkdirSync(outDir, { recursive: true });

  if (opts.probeFirst) {
    const pr = runProbeFirst({
      repoRoot: opts.repoRoot,
      outDir,
      fileKey,
      probeSize: opts.probeSize,
      dryRun: false,
    });
    if (!pr.ok) process.exit(pr.exitCode ?? 1);
  }

  const startedAt = new Date().toISOString();
  const steps = [];
  let failed = false;

  for (const slug of sequence) {
    const outPath = assembledPath(outDir, slug);
    const stepRecord = {
      slug,
      assembledPath: outPath,
      charLength: null,
      checkPayloadExit: null,
      checkMcpArgsExit: null,
      errors: [],
      finishedAt: null,
    };

    try {
      const { outAbs, charLength } = assembleComponentUseFigmaCode({
        step: slug,
        ctxFile: ctxAbs,
        outPath,
        repoRoot: opts.repoRoot,
      });
      stepRecord.charLength = charLength;
      console.log(`OK  assembled ${slug} → ${outAbs} (${charLength} chars)`);

      const cp = runCheckPayload(opts.repoRoot, outAbs);
      stepRecord.checkPayloadExit = cp.exitCode;
      if (!cp.ok) {
        failed = true;
        stepRecord.errors.push('check-payload failed');
        console.error(cp.stderr || cp.stdout || 'check-payload failed');
      } else {
        const last = (cp.stdout || '').trim().split('\n').pop();
        console.log(last || `OK  check-payload ${slug}`);
      }

      if (opts.checkMcpArgs && cp.ok) {
        const cm = runCheckMcpArgs(opts.repoRoot, outAbs, fileKey, slug);
        stepRecord.checkMcpArgsExit = cm.exitCode;
        if (!cm.ok) {
          failed = true;
          stepRecord.errors.push('check-use-figma-mcp-args failed');
          console.error(cm.stderr || 'check-use-figma-mcp-args failed');
        } else {
          console.log(`OK  check-use-figma-mcp-args ${slug}`);
        }
      }
    } catch (e) {
      failed = true;
      stepRecord.errors.push(e.message || String(e));
      console.error(`FAIL ${slug}:`, e.message || e);
    }

    stepRecord.finishedAt = new Date().toISOString();
    steps.push(stepRecord);
    if (failed) break;
  }

  const invokeHints = sequence.map((slug) => ({
    step: slug,
    assembledCodePath: assembledPath(outDir, slug),
    fileKey: fileKey || '',
    description: `create-component — ${slug.replace(/^cc-/, '')} (${meta.component})`,
  }));

  const progress = {
    schema: 'designops-create-component-step6-progress',
    version: 1,
    ctxFile: ctxAbs,
    repoRoot: opts.repoRoot,
    component: meta.component,
    layout: meta.layout,
    fileKey,
    sequence,
    startedAt,
    updatedAt: new Date().toISOString(),
    orchestrationOk: !failed,
    steps,
    invokeHints,
    policy: {
      sequentialTasksOnly:
        'Never launch parallel Task/canvas-bundle-runner for two cc-* steps; run five invocations strictly in order.',
      runnerSkill: 'skills/canvas-bundle-runner/SKILL.md',
      agentsRunAssembly:
        'npm/node assembly steps are executed by the agent from the DesignOps-plugin repo per AGENTS.md — not manual designer terminal homework.',
    },
  };

  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
  console.log(`\nWrote progress → ${progressPath}`);

  if (failed) {
    console.error('\ncreate-component-step6-all: FAILED (see progress.steps[].errors)');
    process.exit(1);
  }
  console.log('\ncreate-component-step6-all: OK — agent next: five sequential Task → canvas-bundle-runner or parent Read → call_mcp per invokeHints[].');
}

main();
