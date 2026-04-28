#!/usr/bin/env node
// Static contract checks for Lively Oasis / Step 6 fail-fast (templates + doc inventory).
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

need("skills/create-component/templates/preamble.figma.js", ["function __ccPreflightFileKey", "figma.fileKey"], "preamble preflight");

need(
  "skills/create-component/templates/op-interpreter.figma.js",
  [
    "__ccPreflightFileKey()",
    "_handoffMisses",
    "handoff-id-not-resolvable-in-current-file",
    "scaffoldRefs.ok === false",
  ],
  "op-interpreter fail-fast",
);

// 16 convention files (14 Lively Oasis consolidation + 22 delegate hotspots + 24 tuple roadmap)
const convDir = join(REPO_ROOT, "skills/create-component/conventions");
const mdFiles = readdirSync(convDir).filter((f) => f.endsWith(".md"));
if (mdFiles.length !== 16) {
  console.error(
    `qa-lively-oasis-contract: expected 16 conventions/*.md files, got ${mdFiles.length}: ${mdFiles.sort().join(", ")}`,
  );
  failures++;
} else {
  console.log(`qa-lively-oasis-contract: OK  conventions/*.md count = ${mdFiles.length}`);
}

const skillPath = join(REPO_ROOT, "skills/create-component/SKILL.md");
const referencePath = join(REPO_ROOT, "skills/create-component/REFERENCE-agent-steps.md");
const MAX_SKILL_LINES = 300;
if (existsSync(skillPath)) {
  const n = readFileSync(skillPath, "utf8").split(/\r?\n/).length;
  if (n > MAX_SKILL_LINES) {
    console.error(
      `qa-lively-oasis-contract: SKILL.md must stay ≤ ${MAX_SKILL_LINES} lines (router + §9 + generated tables); got ${n}. Move prose to REFERENCE-agent-steps.md.`,
    );
    failures++;
  } else {
    console.log(`qa-lively-oasis-contract: OK  SKILL.md lines = ${n} (max ${MAX_SKILL_LINES})`);
  }
}

if (existsSync(referencePath)) {
  const n = readFileSync(referencePath, "utf8").split(/\r?\n/).length;
  console.log(`qa-lively-oasis-contract: REFERENCE-agent-steps.md lines = ${n} (informational)`);
}

if (failures > 0) {
  console.error(`qa-lively-oasis-contract: FAILED (${failures} check(s))`);
  process.exit(1);
}

console.log("qa-lively-oasis-contract: OK (templates + convention inventory)");
