#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// extract-cva.mjs
//
// Runtime-extracts the cva() config from a shadcn-style component source file
// and prints it as JSON to stdout. Used by /create-component Mode A to make
// the installed component the source of truth for Figma.
//
// Usage (from the consuming project's cwd, via npx tsx so TS paths resolve):
//   npx tsx <abs-path-to-this-file> <abs-path-to-component.tsx>
//
// Output (stdout, JSON):
//   Success: { source, exportName, base, variants, defaultVariants, compoundVariants, displayName }
//     - source: "runtime"  (imported module exposed .variants on the cva return)
//             | "parsed"   (we fell back to string-parsing the source file)
//   Failure: { error, stack?, availableExports? }
//
// Exit codes: 0 on success, 1 on any failure the skill should surface.
//
// Why two paths:
//   class-variance-authority v0.7+ returns a function whose .variants,
//   .defaultVariants, .compoundVariants are exposed as own properties on the
//   returned function — so a plain dynamic import gets us everything. Older
//   cva builds do not. For those, we read the component source text, locate
//   the cva(base, { ... }) call, and evaluate the two arguments inside a
//   sandboxed vm.createContext() to recover the config. The string parser
//   only needs to handle shadcn's stereotyped cva call-sites, not arbitrary
//   JS.
// ──────────────────────────────────────────────────────────────────────────────

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import vm from 'node:vm';

function emitOk(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2));
  process.exit(0);
}
function emitFail(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    emitFail({ error: 'usage: extract-cva.mjs <componentFilePath>' });
  }
  const absPath = resolvePath(argv[0]);

  // ── Tier 1: runtime import ────────────────────────────────────────────────
  // If the compiled module exposes .variants on any function export, we have
  // everything we need without touching source text. This is the preferred
  // path and should win on any cva@0.7+ installation.
  let runtimeAttempt = null;
  try {
    const mod = await import(pathToFileURL(absPath).href);
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === 'function' && value.variants && typeof value.variants === 'object') {
        runtimeAttempt = {
          source: 'runtime',
          exportName: name,
          base: normalizeBase(value.base),
          variants: value.variants,
          defaultVariants: value.defaultVariants ?? {},
          compoundVariants: value.compoundVariants ?? [],
          displayName: mod.default?.displayName ?? null,
        };
        break;
      }
    }
    if (runtimeAttempt) emitOk(runtimeAttempt);
  } catch (err) {
    // Intentional fall-through: runtime import failure (TS paths, JSX, missing
    // deps) should NOT abort the script — tier 2 works on raw source text.
    runtimeAttempt = { error: err.message };
  }

  // ── Tier 2: string parse ──────────────────────────────────────────────────
  let src;
  try {
    src = await readFile(absPath, 'utf8');
  } catch (err) {
    emitFail({ error: `read failed: ${err.message}`, runtimeTier1: runtimeAttempt });
  }

  const callMatch = src.match(/(?:export\s+(?:const|let|var)\s+|(?:const|let|var)\s+)([A-Za-z_][\w]*)\s*=\s*cva\s*\(/);
  if (!callMatch) {
    emitFail({
      error: 'no `const X = cva(...)` call found in source',
      runtimeTier1: runtimeAttempt,
    });
  }
  const exportName = callMatch[1];
  const openParenIdx = src.indexOf('(', callMatch.index + callMatch[0].length - 1);
  const { args, end } = readCallArgs(src, openParenIdx);
  if (end < 0) {
    emitFail({ error: 'unterminated cva(...) call', runtimeTier1: runtimeAttempt });
  }
  if (args.length < 1) {
    emitFail({ error: 'cva() called with no arguments', runtimeTier1: runtimeAttempt });
  }

  // Evaluate the two argument expressions in an isolated vm. The vm has no
  // globals except a capture slot — unresolved identifiers (e.g. a utility
  // helper imported at the top of the file) throw, which we surface as an
  // error rather than silently returning garbage.
  const sandbox = { __cva_args: null };
  vm.createContext(sandbox);
  try {
    vm.runInContext(
      `__cva_args = [${args.join(',')}];`,
      sandbox,
      { timeout: 250 }
    );
  } catch (err) {
    emitFail({
      error: `failed to evaluate cva args: ${err.message}`,
      args,
      runtimeTier1: runtimeAttempt,
    });
  }

  const [rawBase, config = {}] = sandbox.__cva_args || [];
  emitOk({
    source: 'parsed',
    exportName,
    base: normalizeBase(rawBase),
    variants: config.variants ?? {},
    defaultVariants: config.defaultVariants ?? {},
    compoundVariants: config.compoundVariants ?? [],
    displayName: null,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// cva accepts base as a string or a string[] — normalize to a single string
// so the downstream resolver can treat both shapes identically.
function normalizeBase(b) {
  if (b == null) return null;
  if (typeof b === 'string') return b;
  if (Array.isArray(b)) return b.filter(Boolean).join(' ');
  return String(b);
}

// Simple balanced-bracket scanner — reads the arguments of a function call
// starting at the opening paren index and returns the comma-separated raw
// argument strings plus the closing-paren position. Handles nested parens,
// brackets, braces, and single/double/backtick string literals (including
// escape sequences). Does NOT handle template literal ${...} interpolations
// deeply — shadcn's cva() calls don't use those in practice, and if they
// ever do, runtime tier 1 should cover them.
function readCallArgs(src, openParenIdx) {
  let depth = 0;
  let inStr = null;
  let escaped = false;
  let cur = '';
  const args = [];
  for (let i = openParenIdx + 1; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { cur += ch; escaped = false; continue; }
    if (inStr) {
      cur += ch;
      if (ch === '\\') { escaped = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; cur += ch; continue; }
    if (ch === ')' && depth === 0) {
      if (cur.trim()) args.push(cur);
      return { args, end: i };
    }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
    cur += ch;
  }
  return { args: [], end: -1 };
}

main().catch((err) => {
  emitFail({ error: `unhandled: ${err.message}`, stack: err.stack });
});
