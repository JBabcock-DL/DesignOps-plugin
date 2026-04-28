#!/usr/bin/env node
// Static contract checks for /create-component (canvas bundles + doc inventory).
// Run: npm run qa:lively-oasis-contract  (also wired into npm run verify)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

let failures = 0;
function need(path, substrings, label) {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) {
    console.error(`qa-lively-oasis-contract: missing file ${path}`);
    failures++;
    return;
  }
  const text = readFileSync(abs, "utf8");
  for (const s of substrings) {
    if (!text.includes(s)) {
      console.error(`qa-lively-oasis-contract: ${label} — expected substring not found:\n  ${JSON.stringify(s)}`);
      failures++;
    }
  }
}

need(
  "skills/create-component/canvas-templates/cc-runtime-head.js",
  ["CONFIG.pageName", "figma.variables.getLocalVariableCollections"],
  "canvas runtime head",
);

need(
  "scripts/bundle-component-mcp.mjs",
  [".min.mcp.js", "canvas-templates"],
  "component MCP bundler",
);

const convDir = join(REPO_ROOT, "skills/create-component/conventions");
const mdFiles = readdirSync(convDir).filter((f) => f.endsWith(".md"));
const EXPECTED_CONVENTIONS = 8;
if (mdFiles.length !== EXPECTED_CONVENTIONS) {
  console.error(
    `qa-lively-oasis-contract: expected ${EXPECTED_CONVENTIONS} conventions/*.md files, got ${mdFiles.length}: ${mdFiles.sort().join(", ")}`,
  );
  failures++;
} else {
  console.log(`qa-lively-oasis-contract: OK  conventions/*.md count = ${mdFiles.length}`);
}

const skillPath = join(REPO_ROOT, "skills/create-component/SKILL.md");
const MAX_SKILL_LINES = 300;
if (existsSync(skillPath)) {
  const n = readFileSync(skillPath, "utf8").split(/\r?\n/).length;
  if (n > MAX_SKILL_LINES) {
    console.error(
      `qa-lively-oasis-contract: SKILL.md must stay ≤ ${MAX_SKILL_LINES} lines (router + §9 + generated tables); got ${n}. Trim prose into EXECUTOR.md or conventions.`,
    );
    failures++;
  } else {
    console.log(`qa-lively-oasis-contract: OK  SKILL.md lines = ${n} (max ${MAX_SKILL_LINES})`);
  }
}

if (failures > 0) {
  console.error(`qa-lively-oasis-contract: FAILED (${failures} check(s))`);
  process.exit(1);
}

console.log("qa-lively-oasis-contract: OK (canvas-templates + convention inventory)");
