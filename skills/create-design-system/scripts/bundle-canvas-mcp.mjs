#!/usr/bin/env node
/**
 * Regenerates committed MCP canvas bundles under canvas-templates/bundles/.
 *
 * Usage (from repo root):
 *   node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
 *
 * Each step writes two files:
 *   1. step-*.mcp.js      — readable (comments, indentation) for review/debug.
 *   2. step-*.min.mcp.js  — whitespace/comment-stripped for the inline
 *                           use_figma `code` argument. Token-preserving,
 *                           never re-parses as ESM (preserves top-level
 *                           `await` + `return`).
 *
 * Esbuild / minify caveat: the Figma MCP script uses top-level `await` and
 * top-level `return`. Esbuild as ESM rejects top-level `return`. We avoid
 * that entirely by using a state-machine comment/whitespace stripper that
 * never reparses the source — see stripMinify below and bundles/README.md.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.join(__dirname, '..');
const CT = path.join(skillRoot, 'canvas-templates');
const bundlesDir = path.join(CT, 'bundles');

function readUtf8(rel) {
  return fs.readFileSync(path.join(CT, rel), 'utf8');
}

/** LF-only output avoids mixed CRLF/LF in committed bundles (Windows editors + concat). */
function normalizeNewlines(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Strip JS comments and collapse whitespace without reparsing as ESM.
 *
 * Preserves exactly:
 *   - String / template literal contents (single, double, backtick, incl. ${…}).
 *   - Regex literals (basic form; the bundles only use simple /.../ patterns).
 *   - Top-level `await` and top-level `return` (we never wrap in a function).
 *
 * Removes:
 *   - // line comments
 *   - /* block comments *\/
 *   - Leading and trailing whitespace on every line.
 *   - Runs of blank lines (collapsed to a single '\n').
 *
 * Inter-token whitespace inside a line is left alone — this keeps the
 * minifier trivially correct around ASI-sensitive constructs (e.g. `return`
 * followed by a value on the next line stays on its own line).
 */
function stripMinify(src) {
  const input = normalizeNewlines(src);
  let out = '';
  let i = 0;
  const n = input.length;

  // Track the last non-whitespace emitted char to disambiguate `/` as regex vs divide.
  // If prev is in this set, `/` starts a regex literal.
  const regexPrev = new Set([
    '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
    '+', '-', '*', '%', '<', '>', '^', '~', '\n',
  ]);
  const regexKeywords = ['return', 'typeof', 'in', 'of', 'instanceof', 'new', 'delete', 'void', 'throw'];
  let lastTok = '';

  function appendEmit(ch) {
    out += ch;
    if (/\s/.test(ch)) {
      // don't update lastTok on whitespace
    } else {
      lastTok = ch;
    }
  }

  function couldStartRegex() {
    if (regexPrev.has(lastTok)) return true;
    // Look at trailing word on out to detect keyword before /
    const m = /([A-Za-z_$][A-Za-z0-9_$]*)\s*$/.exec(out);
    if (m && regexKeywords.includes(m[1])) return true;
    return false;
  }

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      appendEmit(ch);
      i++;
      while (i < n) {
        const c = input[i];
        if (c === '\\') { out += c + input[i + 1]; i += 2; continue; }
        if (c === quote) { appendEmit(c); i++; break; }
        out += c;
        i++;
      }
      continue;
    }
    // Template literal
    if (ch === '`') {
      appendEmit(ch);
      i++;
      let braceDepth = 0;
      while (i < n) {
        const c = input[i];
        if (c === '\\') { out += c + input[i + 1]; i += 2; continue; }
        if (braceDepth === 0 && c === '`') { appendEmit(c); i++; break; }
        if (braceDepth === 0 && c === '$' && input[i + 1] === '{') {
          out += '${';
          i += 2;
          braceDepth = 1;
          // inside ${…} — treat like normal code until matching }
          while (i < n && braceDepth > 0) {
            const cc = input[i];
            if (cc === '{') { braceDepth++; out += cc; i++; continue; }
            if (cc === '}') { braceDepth--; out += cc; i++; if (braceDepth === 0) break; continue; }
            if (cc === '"' || cc === "'") {
              const q = cc; out += q; i++;
              while (i < n) {
                const x = input[i];
                if (x === '\\') { out += x + input[i + 1]; i += 2; continue; }
                if (x === q) { out += q; i++; break; }
                out += x; i++;
              }
              continue;
            }
            out += cc;
            i++;
          }
          continue;
        }
        out += c;
        i++;
      }
      continue;
    }
    // Regex literal
    if (ch === '/' && couldStartRegex()) {
      appendEmit(ch);
      i++;
      let inClass = false;
      while (i < n) {
        const c = input[i];
        if (c === '\\') { out += c + input[i + 1]; i += 2; continue; }
        if (c === '[') { inClass = true; out += c; i++; continue; }
        if (c === ']') { inClass = false; out += c; i++; continue; }
        if (c === '/' && !inClass) { appendEmit(c); i++; break; }
        out += c;
        i++;
      }
      // flags
      while (i < n && /[a-z]/.test(input[i])) { appendEmit(input[i]); i++; }
      continue;
    }
    appendEmit(ch);
    i++;
  }

  // Line-level cleanup: trim each line, drop blank lines.
  const lines = out.split('\n').map(l => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''));
  return lines.filter(l => l.length > 0).join('\n') + '\n';
}

function writeBundle(name, body) {
  fs.mkdirSync(bundlesDir, { recursive: true });
  const outPath = path.join(bundlesDir, name);
  const normalized = normalizeNewlines(body);
  fs.writeFileSync(outPath, normalized, 'utf8');
  console.log('Wrote', outPath, '—', normalized.length, 'chars (LF-normalized)');
}

function writeBundlePair(baseName, body) {
  const readable = normalizeNewlines(body);
  writeBundle(baseName + '.mcp.js', readable);
  const min = stripMinify(readable);
  writeBundle(baseName + '.min.mcp.js', min);
}

function readRunner(relFromBundles) {
  return fs.readFileSync(path.join(bundlesDir, relFromBundles), 'utf8');
}

const lib = readUtf8('_lib.js');

// ── Step 15a — Primitives ──────────────────────────────────────────────────
{
  const prim = readUtf8('primitives.js');
  const runner = readRunner('_step15a-runner.fragment.js');
  writeBundlePair('step-15a-primitives', lib + prim + runner);
}

// ── Step 15b — Theme ───────────────────────────────────────────────────────
{
  const theme = readUtf8('theme.js');
  const runner = readRunner('_step15b-runner.fragment.js');
  writeBundlePair('step-15b-theme', lib + theme + runner);
}

// ── Step 15c — Layout ──────────────────────────────────────────────────────
{
  const layout = readUtf8('layout.js');
  const runner = readRunner('_step15c-layout-runner.fragment.js');
  writeBundlePair('step-15c-layout', lib + layout + runner);
}

// ── Step 15c — Text Styles ─────────────────────────────────────────────────
{
  const textStyles = readUtf8('text-styles.js');
  const runner = readRunner('_step15c-text-styles-runner.fragment.js');
  writeBundlePair('step-15c-text-styles', lib + textStyles + runner);
}

// ── Step 15c — Effects ─────────────────────────────────────────────────────
{
  const effects = readUtf8('effects.js');
  const runner = readRunner('_step15c-effects-runner.fragment.js');
  writeBundlePair('step-15c-effects', lib + effects + runner);
}

// ── Step 17 — Token Overview ───────────────────────────────────────────────
{
  const tokenOverview = readUtf8('token-overview.js');
  const runner = readRunner('_step17-runner.fragment.js');
  writeBundlePair('step-17-token-overview', lib + tokenOverview + runner);
}
