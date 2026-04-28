#!/usr/bin/env node
// scripts/designops-step6-engine.mjs — deterministic Step 6 orchestration (Draw Engine v1)
//
// Subcommands: status | prepare | validate-draw-dir
//
// See: skills/create-component/conventions/23-designops-step6-engine.md

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { getStep6Status } from "./lib/designops-step6-status.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const MANIFEST_VERSION = 1;

function usage(code = 0) {
  const msg =
    `designops-step6-engine — DesignOps Draw Engine (Step 6)\n\n` +
    `Usage:\n` +
    `  node scripts/designops-step6-engine.mjs status --draw-dir <abs-path>\n` +
    `  node scripts/designops-step6-engine.mjs validate-draw-dir \\\n` +
    `      --draw-dir <abs-path> [--config-block <path>] [--registry <path>] [--handoff <path>]\n` +
    `  node scripts/designops-step6-engine.mjs prepare \\\n` +
    `      --draw-dir <abs-path> --layout <chip|…> \\\n` +
    `      --config-block <path.js> --registry <path|.json|"{}"> --file-key <figmaKey> \\\n` +
    `      [--handoff path|default draw-dir/handoff.json] [--plugin-root <path>] \\\n` +
    `      [--slug <slug>] [--force] [--no-run]\n\n` +
    `prepare writes draw-dir/current-step.manifest.json and .designops/staging/mcp-<slug>.json (disk-only).\n`;
  if (code === 0) console.log(msg);
  else console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      out[k] = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true;
    }
  }
  return out;
}

async function cmdStatus(argsIn) {
  const drawDir = resolve(argsIn["draw-dir"] || argsIn.drawDir || "");
  if (!drawDir) usage(2);

  const st = await getStep6Status(drawDir);
  if (!st.ok) {
    console.error(JSON.stringify({ ok: false, ...st }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...st }, null, 2));
  process.exit(0);
}

function cmdValidateDrawDir(argsIn) {
  const drawDir = resolve(argsIn["draw-dir"] || "");
  const handoff = resolve(argsIn.handoff || join(drawDir, "handoff.json"));
  const cfg = argsIn["config-block"] ? resolve(argsIn["config-block"]) : null;
  const reg = argsIn.registry ? argsIn.registry : join(drawDir, ".designops-registry.json");

  const errors = [];
  if (!drawDir || !existsSync(drawDir)) errors.push(`draw-dir missing or not found: ${drawDir}`);
  if (!existsSync(handoff)) errors.push(`handoff missing: ${handoff}`);
  if (cfg && !existsSync(cfg)) errors.push(`--config-block not found: ${cfg}`);

  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(2);
  }

  const resolvedReg =
    typeof reg === "string" && reg.startsWith("{")
      ? "inline-json"
      : existsSync(resolve(reg))
        ? resolve(reg)
        : reg.includes("/") || reg.includes("\\") || existsSync(join(drawDir, reg))
          ? resolve(reg.includes("/") ? reg : join(drawDir, reg))
          : reg;

  if (resolvedReg !== "inline-json" && typeof resolvedReg === "string" && !resolvedReg.includes("{")) {
    try {
      if (!existsSync(resolvedReg)) errors.push(`registry path not found: ${resolvedReg}`);
    } catch {
      /* ignore */
    }
  }

  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        drawDir,
        handoff,
        ...(cfg ? { configBlock: cfg } : {}),
        registryResolved: resolvedReg !== "inline-json" ? resolvedReg : "literal",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

async function cmdPrepare(raw) {
  if (raw.strategy === "inline") {
    console.error(
      "designops-step6-engine: --strategy inline removed: Composer-class hosts truncate inline tool JSON. Disk is the only supported transport.",
    );
    process.exit(2);
  }

  const drawDir = resolve(raw["draw-dir"] || "");
  const layout = raw.layout || "";
  const skipRun = raw["no-run"] === true;
  const pluginRoot = resolve(raw["plugin-root"] || REPO_ROOT);
  const handoffArg = raw.handoff ? resolve(raw.handoff) : join(drawDir, "handoff.json");
  const cfgPath = raw["config-block"] ? resolve(raw["config-block"]) : null;
  const registryArg = raw.registry ?? "";
  const fileKey = raw["file-key"] || raw.fileKey || "";

  if (!drawDir || !layout || !cfgPath || fileKey === "") {
    console.error("designops-step6-engine: prepare requires --draw-dir --layout --config-block --registry --file-key");
    usage(2);
  }

  const st = await getStep6Status(drawDir);
  if (!st.ok) {
    console.error(JSON.stringify(st, null, 2));
    process.exit(1);
  }
  if (st.terminal) {
    console.error("designops-step6-engine: ladder complete (phase-state.nextSlug is null).");
    process.exit(1);
  }

  const force = raw.force === true;
  let slug = raw.slug || st.nextSlug;
  if (!slug) {
    console.error("designops-step6-engine: could not resolve next slug");
    process.exit(1);
  }
  if (!force && st.nextSlug != null && slug !== st.nextSlug) {
    console.error(
      `designops-step6-engine: --slug ${slug} != expected next ${st.nextSlug} — omit --slug or pass --force`,
    );
    process.exit(1);
  }

  const designopsStaging = join(drawDir, ".designops");
  const stagingDir = join(designopsStaging, "staging");
  mkdirSync(stagingDir, { recursive: true });

  const outPath = resolve(join(stagingDir, `${slug}.code.js`));
  const mcpPath = resolve(join(stagingDir, `mcp-${slug}.json`));

  const assembleExe = resolve(REPO_ROOT, "scripts/assemble-slice.mjs");

  /** @type {string[]} */
  const assembleArgv =
    typeof process.execPath === "string"
      ? [
          process.execPath,
          assembleExe,
          "--step",
          slug,
          "--layout",
          layout,
          "--config-block",
          cfgPath,
          "--registry",
          registryArg,
          "--handoff",
          handoffArg,
          "--file-key",
          fileKey,
          "--plugin-root",
          pluginRoot,
          "--out",
          outPath,
        ]
      : [];

  assembleArgv.push("--emit-mcp-args", mcpPath);

  const manifest = {
    version: MANIFEST_VERSION,
    slug,
    designopsPluginRoot: pluginRoot,
    drawDir,
    strategy: "disk",
    assembleArgv,
    payload: {
      mode: "disk",
      diskPaths: {
        codeJs: outPath,
        mcpArgsJson: mcpPath,
      },
    },
    finalizeHint: {
      mode: "stdin",
      examplePipe: `echo '<return-json>' | node scripts/finalize-slice.mjs ${slug} "${handoffArg}"`,
      returnPathDoc: `Or save return to ${join(drawDir, `return-${slug}.json`)} and use finalize-slice --return-path.`,
    },
    parent_actions: [
      {
        op: "RUN_SHELL",
        argv: assembleArgv,
        cwd: REPO_ROOT,
        exitOnFail: [10, 11, 17],
      },
      { op: "READ_PATH", path: mcpPath, purpose: "mcp-args" },
      { op: "CALL_MCP_USE_FIGMA", fromMcpJson: mcpPath },
      { op: "FINALIZE_STDIN", slug, handoffPath: handoffArg },
    ],
  };

  const manifestPath = join(drawDir, "current-step.manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  if (!skipRun) {
    const run = spawnSync(assembleArgv[0], assembleArgv.slice(1), {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    if (run.status !== 0) {
      console.error(run.stderr || run.stdout || "assemble-slice failed");
      process.exit(run.status ?? 1);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifestPath,
        slug,
        strategy: "disk",
        ranAssemble: !skipRun,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const argv = process.argv.slice(2);
const sub = argv[0];
const argsIn = parseArgs(argv.slice(1));

if (!sub || sub === "-h" || sub === "--help") usage(0);

if (sub === "status") {
  await cmdStatus(argsIn);
} else if (sub === "validate-draw-dir") {
  cmdValidateDrawDir(argsIn);
} else if (sub === "prepare") {
  await cmdPrepare(argsIn);
} else {
  console.error(`Unknown subcommand: ${sub}`);
  usage(2);
}
