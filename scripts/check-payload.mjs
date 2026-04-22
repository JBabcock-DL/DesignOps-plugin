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

// ─── Gate 1: JavaScript parse ───────────────────────────────────────────
try {
  new vm.Script(wrapped, { filename: sourceLabel, displayErrors: true });
} catch (err) {
  if (err && err.name === 'SyntaxError') {
    reportSyntaxError(err, sourceLabel, code);
    process.exit(1);
  }
  throw err;
}

// ─── Gate 2: JSON transport round-trip ──────────────────────────────────
// MCP tool calls serialize the `code` argument as a JSON string over stdio.
// JavaScript string literals accept \xHH hex escapes; JSON string literals
// do NOT. esbuild's default `charset: 'ascii'` emits \xHH for non-ASCII
// characters (§, ×, ·, ¬, em-dash) because it's 2 bytes shorter than \uXXXX;
// our build uses `charset: 'utf8'` to avoid this, but a hand-authored CONFIG
// or a third-party minifier could re-introduce the problem. A JSON round-trip
// catches it locally before the tool call fails with "Bad escaped character
// in JSON at position N".
//
// Other JSON-unsafe shapes this catches:
//   - Lone UTF-16 surrogates (rare, but happens with emoji-in-string slicing)
//   - Invalid UTF-8 byte sequences
//   - U+2028 / U+2029 (valid in JSON but fatal when the JSON is then
//     evaluated as JavaScript in some transports; we flag these separately)
try {
  const encoded = JSON.stringify(code);
  const decoded = JSON.parse(encoded);
  if (decoded !== code) {
    console.error(`JSON-transport warning in ${sourceLabel}: round-trip modified the payload`);
    console.error(`  original length: ${code.length}`);
    console.error(`  round-trip length: ${decoded.length}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`JSON-transport error in ${sourceLabel}: payload cannot be safely embedded in a JSON string argument (e.g. MCP use_figma.code)`);
  console.error(`  ${err.message}`);
  reportJsonTransportDiagnostics(code);
  process.exit(1);
}

// Extra check: hex escapes that are valid JS but invalid JSON. JSON.stringify
// of a JS string NEVER produces these, but the SOURCE payload may contain
// them as literal escape sequences written into the code (e.g. an agent
// hand-typed `'\x3C'` instead of `'<'`). When the MCP transport treats the
// payload as a JSON string, those sequences survive as literal backslash-x
// and blow up on the other side.
const hexEscapeMatches = code.match(/\\x[0-9a-fA-F]{2}/g);
if (hexEscapeMatches && hexEscapeMatches.length > 0) {
  const unique = [...new Set(hexEscapeMatches)];
  console.error(`JSON-transport error in ${sourceLabel}: ${hexEscapeMatches.length} \\xHH hex escape(s) in source (${unique.slice(0, 5).join(', ')}${unique.length > 5 ? ', …' : ''})`);
  console.error(`  \\xHH is valid JavaScript but invalid JSON. When use_figma serializes the`);
  console.error(`  'code' argument over MCP stdio, JSON.parse rejects the payload with`);
  console.error(`  "Bad escaped character in JSON at position N".`);
  console.error(``);
  console.error(`  Fix options:`);
  console.error(`    1. If this is a MINIFIED bundle: rebuild with \`npm run build:min\` —`);
  console.error(`       our esbuild config pins \`charset: 'utf8'\`. Sources newer than`);
  console.error(`       2024-Q2 already avoid \\xHH. If you see escapes in a fresh bundle,`);
  console.error(`       the charset flag was dropped; restore it in scripts/build-min-templates.mjs.`);
  console.error(`    2. If this is a HAND-AUTHORED payload: replace \\xHH with either the`);
  console.error(`       literal character ('§', '×', '·', '¬') or the \\u00HH form.`);
  process.exit(1);
}

const MCP_CODE_MAX_LENGTH = 50000;
if (code.length > 49000) {
  console.error(
    `check-payload: warning — payload is ${code.length.toLocaleString()} JS string chars; Figma MCP use_figma.code schema maxLength is ${MCP_CODE_MAX_LENGTH.toLocaleString()}. ` +
      `If the tool call fails or truncates, use one per-archetype engine bundle only (see skills/create-component/SKILL.md §0).`
  );
}

const bytes = Buffer.byteLength(code, 'utf8');
console.log(`OK  ${sourceLabel} parses as an async function body (${bytes.toLocaleString()} bytes, JSON-safe).`);
process.exit(0);

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function printUsageAndExit(code) {
  const stream = code === 0 ? console.log : console.error;
  stream(`Usage: node scripts/check-payload.mjs [<path>] [--trace] [--help]`);
  stream(``);
  stream(`  Reads <path> (or stdin if omitted) and validates the content against`);
  stream(`  TWO gates:`);
  stream(`    (1) parses as an async function body — the same way use_figma`);
  stream(`        evaluates its 'code' argument;`);
  stream(`    (2) round-trips through JSON.stringify → JSON.parse without loss,`);
  stream(`        and contains no \\xHH hex escapes (valid JS, invalid JSON).`);
  stream(`  Prints OK + byte count on success; SyntaxError or JSON-transport`);
  stream(`  error with diagnostics on failure. Exit 0 / 1 / 2.`);
  stream(``);
  stream(`  Examples:`);
  stream(`    cat payload.js | node scripts/check-payload.mjs`);
  stream(`    node scripts/check-payload.mjs /tmp/staged-button.js`);
  stream(`    npm run check-payload -- /tmp/staged-button.js`);
  process.exit(code);
}

function reportJsonTransportDiagnostics(code) {
  // Surrogate scan: lone high or low surrogates are invalid when embedded in
  // JSON that will be interpreted as UTF-8 by the recipient. These usually
  // come from emoji-in-string slicing or a buggy copy-paste.
  const lonely = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i);
    if (ch >= 0xD800 && ch <= 0xDBFF) {
      // high surrogate — must be followed by a low surrogate (0xDC00-0xDFFF)
      const next = code.charCodeAt(i + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) lonely.push({ kind: 'high', at: i });
    } else if (ch >= 0xDC00 && ch <= 0xDFFF) {
      // low surrogate — must be preceded by a high surrogate
      const prev = code.charCodeAt(i - 1);
      if (!(prev >= 0xD800 && prev <= 0xDBFF)) lonely.push({ kind: 'low', at: i });
    }
    if (lonely.length >= 3) break;
  }
  if (lonely.length) {
    console.error(``);
    console.error(`  Suspected cause: lone UTF-16 surrogate(s) — usually from slicing a string`);
    console.error(`  in the middle of a multi-unit code point (emoji, CJK).`);
    for (const s of lonely) {
      console.error(`    ${s.kind}-surrogate at char index ${s.at}`);
    }
    return;
  }
  console.error(``);
  console.error(`  Suspected cause: source contains a \\xHH escape, a raw control character`);
  console.error(`  (U+0000-U+001F other than \\n / \\t), or an invalid UTF-8 byte sequence.`);
  console.error(`  Run 'node -e "JSON.parse(JSON.stringify(require(fs).readFileSync(...).toString()))"'`);
  console.error(`  for the full stack.`);
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
