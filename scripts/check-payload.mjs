#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/check-payload.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Local syntax preflight for a `use_figma` payload assembled per SKILL.md §0
// Script-assembly order (CONFIG → preamble.figma.js → per-archetype bundle).
// Runs ENTIRELY offline, in Node — no Figma round-trip, no MCP call.
//
// Why this exists
// ---------------
// `use_figma` executes its `code` argument inside an async function, so any
// SyntaxError surfaces in the tool's return as `SyntaxError: Unexpected token`
// or `expecting ')'` without a reliable source position — making it expensive
// to diagnose. The most common culprit is a **hand-retyped string field**
// (summary / usageDo / usageDont / description) that contains an apostrophe,
// backtick, or quote matching its own delimiter. Angle brackets inside a JS
// string (e.g. `'Native <label> associated ...'`) are NOT a syntax error —
// do not chase them.
//
// This script parses the payload the same way `use_figma` does (as an async
// function body) and prints the line / column of the first syntax error.
//
// Usage
// -----
//
//   # Read from stdin (recommended for piping from an assembled payload)
//   cat my-payload.js | node scripts/check-payload.mjs
//
//   # Read from a file path
//   node scripts/check-payload.mjs path/to/payload.js
//
//   # npm alias
//   npm run check-payload -- path/to/payload.js
//
// Exit codes
//   0   payload parses as a valid async function body
//   1   SyntaxError — line + column printed on stderr, full stack on --trace
//   2   usage / bad CLI args
//
// What this does NOT do
//   - Execute the payload (it runs purely parser / lexer).
//   - Validate Figma Plugin API usage (that happens inside Figma).
//   - Validate token paths (see scripts/validate-tokens.mjs).
//   - Check for missing boundary identifiers (see the preamble-presence gate
//     at the top of draw-engine.figma.js §0a; that fires in Figma).
//
// This is the cheapest gate in the whole pipeline — run it before every
// `use_figma` call. SKILL.md §6.0a makes it mandatory.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const wantTrace = args.includes('--trace');
const filteredArgs = args.filter(a => a !== '--trace' && a !== '--help' && a !== '-h');
if (args.includes('--help') || args.includes('-h')) {
  printUsageAndExit(0);
}

const [maybePath] = filteredArgs;

let code;
let sourceLabel;
if (maybePath) {
  const abs = path.resolve(maybePath);
  if (!fs.existsSync(abs)) {
    console.error(`check-payload: file not found: ${maybePath}`);
    process.exit(2);
  }
  code = fs.readFileSync(abs, 'utf8');
  sourceLabel = maybePath;
} else if (!process.stdin.isTTY) {
  code = await readStdin();
  sourceLabel = '<stdin>';
} else {
  printUsageAndExit(2);
}

if (!code || code.trim().length === 0) {
  console.error(`check-payload: ${sourceLabel} is empty — nothing to parse.`);
  process.exit(2);
}

// `use_figma` wraps the `code` argument in an async IIFE. Match that by
// parsing the payload as an async function body: that's the only shape in
// which top-level `await`, `return returnPayload`, and the dozens of other
// top-level statements in the engine bundle are all legal.
//
// We wrap the body with a prologue + epilogue newline so the reported
// position maps cleanly back to user-facing line numbers: the payload's
// line 1 becomes the wrapper's line 2, and we subtract 1 before printing.
const wrapped = '(async function __payload__() {\n' + code + '\n})';

try {
  new vm.Script(wrapped, { filename: sourceLabel, displayErrors: true });
} catch (err) {
  if (err && err.name === 'SyntaxError') {
    reportSyntaxError(err, sourceLabel, code);
    process.exit(1);
  }
  throw err;
}

const bytes = Buffer.byteLength(code, 'utf8');
console.log(`OK  ${sourceLabel} parses as an async function body (${bytes.toLocaleString()} bytes).`);
process.exit(0);

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function printUsageAndExit(code) {
  const stream = code === 0 ? console.log : console.error;
  stream(`Usage: node scripts/check-payload.mjs [<path>] [--trace] [--help]`);
  stream(``);
  stream(`  Reads <path> (or stdin if omitted) and parses the content as an async`);
  stream(`  function body — the same way use_figma evaluates its 'code' argument.`);
  stream(`  Prints OK + byte count on success; SyntaxError with file:line:col on`);
  stream(`  failure. Exit 0 / 1 / 2.`);
  stream(``);
  stream(`  Examples:`);
  stream(`    cat payload.js | node scripts/check-payload.mjs`);
  stream(`    node scripts/check-payload.mjs /tmp/staged-button.js`);
  stream(`    npm run check-payload -- /tmp/staged-button.js`);
  process.exit(code);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function reportSyntaxError(err, sourceLabel, code) {
  const location = extractLocation(err);
  const adjustedLine = location && typeof location.line === 'number'
    ? Math.max(1, location.line - 1) // account for wrapper prologue line
    : null;
  const column = location && typeof location.column === 'number' ? location.column : null;

  console.error(`SyntaxError in ${sourceLabel}${adjustedLine ? `:${adjustedLine}${column != null ? ':' + column : ''}` : ''}`);
  console.error(`  ${err.message}`);

  if (adjustedLine) {
    printCodeFrame(code, adjustedLine, column);
  }

  console.error(``);
  console.error(`Diagnostic tips:`);
  console.error(`  • "expecting ')'" is almost always an unescaped quote inside a hand-retyped`);
  console.error(`    summary / description / usage string — NOT the angle brackets in '<label>'.`);
  console.error(`    Angle brackets inside a JS string literal are valid.`);
  console.error(`  • Prefer Read-ing the shadcn-props/<component>.json file and pasting the`);
  console.error(`    JSON as a literal object (JSON is a strict subset of JS) instead of`);
  console.error(`    hand-retyping the 'summary' / 'properties' fields.`);
  console.error(`  • Check the field delimiters match: apostrophes in text require "..."`);
  console.error(`    delimiters or \`template literals\` — and backticks in text require '...'`);
  console.error(`    delimiters.`);

  if (wantTrace) {
    console.error(``);
    console.error(err.stack);
  }
}

function extractLocation(err) {
  const lines = (err.stack || '').split('\n');
  for (const line of lines) {
    const m = line.match(/<stdin>:(\d+)|^\s*at\s.*:(\d+):(\d+)|(\w[\w\-./]+):(\d+)(?::(\d+))?/);
    if (!m) continue;
    const lineNum = Number(m[1] || m[2] || m[5]);
    const colNum = Number(m[3] || m[6] || 0);
    if (Number.isFinite(lineNum) && lineNum > 0) return { line: lineNum, column: colNum };
  }
  // Fall back to parsing V8's "Uncaught SyntaxError: ... at X:Y" — emitted
  // above the stack when displayErrors is true.
  const head = lines[0] || '';
  const mHead = head.match(/:(\d+)(?::(\d+))?/);
  if (mHead) {
    return { line: Number(mHead[1]), column: Number(mHead[2] || 0) };
  }
  return null;
}

function printCodeFrame(code, line, column, context = 2) {
  const lines = code.split(/\r?\n/);
  const start = Math.max(1, line - context);
  const end = Math.min(lines.length, line + context);
  const gutterWidth = String(end).length;
  console.error(``);
  for (let i = start; i <= end; i++) {
    const marker = i === line ? '>' : ' ';
    const gutter = String(i).padStart(gutterWidth, ' ');
    console.error(`  ${marker} ${gutter} | ${lines[i - 1] ?? ''}`);
    if (i === line && column != null && column >= 0) {
      const caret = ' '.repeat(gutterWidth + 3 + column) + '^';
      console.error(`    ${caret}`);
    }
  }
}
