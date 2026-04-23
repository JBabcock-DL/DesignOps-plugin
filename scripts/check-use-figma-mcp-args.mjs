#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/check-use-figma-mcp-args.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Local preflight: verify the *entire* JSON you intend to pass to the Figma
// MCP as `use_figma` tool arguments parses cleanly, serializes, and re-parses
// without error — and report UTF-8 byte length of the serialized form.
//
// This complements `check-payload.mjs`, which only validates the inner `code`
// string. Short-context hosts often fail with "Unexpected end of JSON input"
// when the *wrapper* is truncated, not the script body.
//
// Usage
//   echo '{"fileKey":"...","code":"..."}' | node scripts/check-use-figma-mcp-args.mjs
//   node scripts/check-use-figma-mcp-args.mjs path/to/args.json
//   node scripts/check-use-figma-mcp-args.mjs --verbose path/to/args.json
//
// Exit codes: 0 ok, 1 JSON failure, 2 usage / empty input

import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.error(`Usage:
  node scripts/check-use-figma-mcp-args.mjs <path.json>
  cat args.json | node scripts/check-use-figma-mcp-args.mjs
`);
  process.exit(0);
}

const verbose = args.includes('--verbose') || args.includes('-v');
const pathArg = args.find((a) => a !== '--verbose' && a !== '-v');

let raw;
if (pathArg) {
  raw = await readFile(pathArg, 'utf8');
} else if (!process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  raw = Buffer.concat(chunks).toString('utf8');
} else {
  console.error('check-use-figma-mcp-args: pass a file path or pipe JSON on stdin');
  process.exit(2);
}

if (!raw || !raw.trim()) {
  console.error('check-use-figma-mcp-args: input is empty');
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`check-use-figma-mcp-args: JSON.parse failed — ${err.message}`);
  process.exit(1);
}

let serialized;
try {
  serialized = JSON.stringify(parsed);
} catch (err) {
  console.error(`check-use-figma-mcp-args: JSON.stringify failed — ${err.message}`);
  process.exit(1);
}

try {
  JSON.parse(serialized);
} catch (err) {
  console.error(`check-use-figma-mcp-args: re-parse of serialized string failed — ${err.message}`);
  process.exit(1);
}

const byteLength = Buffer.byteLength(serialized, 'utf8');

const codeField =
  parsed && typeof parsed === 'object' && parsed !== null && 'code' in parsed
    ? parsed.code
    : parsed && typeof parsed === 'object' && parsed !== null && 'arguments' in parsed && parsed.arguments
      ? parsed.arguments.code
      : null;

const codeLength = typeof codeField === 'string' ? codeField.length : 0;
const cap = 50_000; // Figma `use_figma.code` maxLength (see skills/EXECUTOR.md)

const warn =
  codeLength > cap
    ? `  WARNING: code is ${codeLength} chars (schema cap ${cap} — expect MCP rejection).`
    : '';

console.log(
  `OK  JSON tool args: ${byteLength} UTF-8 bytes (serialized)${codeLength ? `, code string ${codeLength} chars` : ''}.`,
);
if (warn) {
  console.log(warn);
}
if (verbose && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
  console.log(`  Top-level keys: ${Object.keys(parsed).join(', ')}`);
}

process.exit(0);
