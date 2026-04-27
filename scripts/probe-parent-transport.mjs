#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/probe-parent-transport.mjs
// ═══════════════════════════════════════════════════════════════════════════
// EMPIRICAL transport-size probe for the parent's `call_mcp` → `use_figma`
// path. Exists because agents repeatedly **confabulate** that "parent
// transport can't carry ~24 KB" and silently drop into a `Task` subagent —
// despite EXECUTOR.md §0 / conventions/13 saying parent is the default.
//
// The right way to settle the question is to RUN the call. This script
// emits a synthetic `use_figma` MCP-args JSON of the requested byte size
// (default 25,000 — slightly larger than a typical doc-step assembled
// payload). The parent agent then runs `call_mcp use_figma` with the
// emitted args. If the call succeeds, the agent records the result in
// `.transport-proof.<draw-dir>.json` and is THEREAFTER FORBIDDEN to cite
// "parent transport limit" as a reason to delegate to a subagent.
//
// The synthetic plugin code is a no-op that returns
// `{ ok: true, observedCodeBytes: <number> }` so the round trip is real
// and the parent can verify the response shape.
//
// Usage
//   node scripts/probe-parent-transport.mjs --size 25000
//     [--out probe-args.json]
//     [--description "<text>"]
//
//   --size N        target byte length of the assembled `code` field
//                   (default 25000; legal range 1000..49000).
//   --out PATH      write MCP args JSON here (default: stdout).
//   --description   override the use_figma description (default includes size).
//
// After parent runs call_mcp and observes ok:true, RECORD the result:
//
//   node scripts/probe-parent-transport.mjs --record \
//     --size 25000 --observed-bytes 25034 \
//     --target <draw-dir>
//
// That writes `<draw-dir>/.transport-proof.json` (or appends a record).
// `assemble-slice` and finalize-slice can read this file to short-circuit
// any "transport too big" reasoning.
//
// Exit
//   0  ok (emit or record succeeded)
//   1  bad CLI / write error / size out of range

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.error(
    `Usage:\n` +
    `  node scripts/probe-parent-transport.mjs --size N [--out args.json] [--description text]\n` +
    `  node scripts/probe-parent-transport.mjs --record --size N --observed-bytes M --target <draw-dir>\n` +
    `\nDefault size: 25000 bytes (slightly above typical doc-step). Range: 1000..49000.\n`,
  );
  process.exit(args.length === 0 ? 2 : 0);
}

let mode = 'emit';
let size = 25000;
let outPath = null;
let description = null;
let observedBytes = null;
let target = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--record') mode = 'record';
  else if (a === '--size') size = parseInt(args[++i], 10);
  else if (a === '--out') outPath = args[++i];
  else if (a === '--description') description = args[++i];
  else if (a === '--observed-bytes') observedBytes = parseInt(args[++i], 10);
  else if (a === '--target') target = args[++i];
  else { console.error(`probe-parent-transport: unknown arg: ${a}`); process.exit(1); }
}

if (!Number.isFinite(size) || size < 1000 || size > 49000) {
  console.error(`probe-parent-transport: --size must be 1000..49000 (got ${size})`);
  process.exit(1);
}

// ─── --record (post-success) ─────────────────────────────────────────────────
if (mode === 'record') {
  if (!target) { console.error('probe-parent-transport: --record requires --target <draw-dir>'); process.exit(1); }
  if (!Number.isFinite(observedBytes)) {
    console.error('probe-parent-transport: --record requires --observed-bytes <N>');
    process.exit(1);
  }
  const targetAbs = resolve(target);
  if (!existsSync(targetAbs)) { console.error(`probe-parent-transport: target not found: ${targetAbs}`); process.exit(1); }
  const proofPath = join(targetAbs, '.transport-proof.json');
  let proof = { records: [] };
  if (existsSync(proofPath)) {
    try { proof = JSON.parse(readFileSync(proofPath, 'utf8')); }
    catch { proof = { records: [] }; }
    if (!Array.isArray(proof.records)) proof.records = [];
  }
  proof.records.push({
    recordedAt: new Date().toISOString(),
    requestedSize: size,
    observedBytes,
    pass: true,
  });
  // Update top-level summary
  proof.maxProvenSize = Math.max(...proof.records.filter(r => r.pass).map(r => r.observedBytes));
  proof.lastVerifiedAt = new Date().toISOString();
  writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(`OK  recorded transport proof: ${observedBytes} bytes carried successfully.`);
  console.log(`    ${proofPath}`);
  console.log(`    maxProvenSize=${proof.maxProvenSize} (cite this in run reports; do NOT delegate to subagents below this size).`);
  process.exit(0);
}

// ─── --emit (default) ────────────────────────────────────────────────────────
// Build a no-op plugin payload sized to ~`size` bytes. Pad with a comment
// containing repeating filler so the syntax stays trivially parseable.
const HEADER =
  `// probe-parent-transport: synthetic no-op payload to verify call_mcp transport.\n` +
  `// If you are reading this in a Figma run report, the parent's call_mcp DID carry the\n` +
  `// payload. Cite that fact instead of delegating to a subagent.\n`;
const FOOTER = `\nreturn { ok: true, observedCodeBytes: ${size}, probe: 'parent-transport' };\n`;
const FILLER_LINE = `// ${'x'.repeat(96)}\n`; // 100 bytes per line

let code = HEADER;
while (Buffer.byteLength(code + FILLER_LINE + FOOTER, 'utf8') < size) {
  code += FILLER_LINE;
}
// Trim or pad to hit exact size
const remaining = size - Buffer.byteLength(code + FOOTER, 'utf8');
if (remaining > 0) {
  code += '// ' + 'p'.repeat(Math.max(0, remaining - 4)) + '\n';
}
code += FOOTER;

const mcpArgs = {
  fileKey: 'PROBE_NO_FIGMA_FILE_REQUIRED',
  // ↑ Many MCP hosts don't validate the fileKey shape until the plugin runs.
  // The synthetic code never touches `figma.*` so the fileKey is informational.
  // If your host rejects unknown keys, pass --description with a real fileKey
  // and re-emit; the body is still synthetic.
  code,
  description: description || `probe-parent-transport: ${size}B synthetic payload — verify parent call_mcp carries this.`,
  skillNames: 'figma-use',
};
const json = JSON.stringify(mcpArgs);
const totalBytes = Buffer.byteLength(json, 'utf8');

if (outPath) {
  writeFileSync(resolve(outPath), json, 'utf8');
  console.log(`OK  wrote probe args → ${resolve(outPath)}`);
  console.log(`    code=${size}B  total-mcp-args=${totalBytes}B`);
  console.log(`    Next: parent Read this file + call_mcp use_figma with these args.`);
  console.log(`    On success, run:`);
  console.log(`      node scripts/probe-parent-transport.mjs --record --size ${size} --observed-bytes ${totalBytes} --target <draw-dir>`);
} else {
  process.stdout.write(json);
}
