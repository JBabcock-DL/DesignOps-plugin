#!/usr/bin/env node
/**
 * Regenerates MCP bundles for create-component canvas-templates (five-call draw).
 *
 * Usage (from repo root):
 *   node scripts/bundle-component-mcp.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const CT = path.join(repoRoot, 'skills/create-component/canvas-templates');
const bundlesDir = path.join(CT, 'bundles');

function readUtf8(relFromCT) {
  return fs.readFileSync(path.join(CT, relFromCT), 'utf8');
}

function normalizeNewlines(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripMinify(src) {
  const input = normalizeNewlines(src);
  let out = '';
  let i = 0;
  const n = input.length;
  const regexPrev = new Set([
    '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
    '+', '-', '*', '%', '<', '>', '^', '~', '\n',
  ]);
  const regexKeywords = ['return', 'typeof', 'in', 'of', 'instanceof', 'new', 'delete', 'void', 'throw'];
  let lastTok = '';

  function appendEmit(ch) {
    out += ch;
    if (/\s/.test(ch)) return;
    lastTok = ch;
  }

  function couldStartRegex() {
    if (regexPrev.has(lastTok)) return true;
    const m = /([A-Za-z_$][A-Za-z0-9_$]*)\s*$/.exec(out);
    if (m && regexKeywords.includes(m[1])) return true;
    return false;
  }

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      appendEmit(ch);
      i++;
      while (i < n) {
        const c = input[i];
        if (c === '\\') {
          out += c + input[i + 1];
          i += 2;
          continue;
        }
        if (c === quote) {
          appendEmit(c);
          i++;
          break;
        }
        out += c;
        i++;
      }
      continue;
    }
    if (ch === '`') {
      appendEmit(ch);
      i++;
      let braceDepth = 0;
      while (i < n) {
        const c = input[i];
        if (c === '\\') {
          out += c + input[i + 1];
          i += 2;
          continue;
        }
        if (braceDepth === 0 && c === '`') {
          appendEmit(c);
          i++;
          break;
        }
        if (braceDepth === 0 && c === '$' && input[i + 1] === '{') {
          out += '${';
          i += 2;
          braceDepth = 1;
          while (i < n && braceDepth > 0) {
            const cc = input[i];
            if (cc === '{') {
              braceDepth++;
              out += cc;
              i++;
              continue;
            }
            if (cc === '}') {
              braceDepth--;
              out += cc;
              i++;
              if (braceDepth === 0) break;
              continue;
            }
            if (cc === '"' || cc === "'") {
              const q = cc;
              out += q;
              i++;
              while (i < n) {
                const x = input[i];
                if (x === '\\') {
                  out += x + input[i + 1];
                  i += 2;
                  continue;
                }
                if (x === q) {
                  out += q;
                  i++;
                  break;
                }
                out += x;
                i++;
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
    if (ch === '/' && couldStartRegex()) {
      appendEmit(ch);
      i++;
      let inClass = false;
      while (i < n) {
        const c = input[i];
        if (c === '\\') {
          out += c + input[i + 1];
          i += 2;
          continue;
        }
        if (c === '[') {
          inClass = true;
          out += c;
          i++;
          continue;
        }
        if (c === ']') {
          inClass = false;
          out += c;
          i++;
          continue;
        }
        if (c === '/' && !inClass) {
          appendEmit(c);
          i++;
          break;
        }
        out += c;
        i++;
      }
      while (i < n && /[a-z]/.test(input[i])) appendEmit(input[i++]);
      continue;
    }
    appendEmit(ch);
    i++;
  }
  const lines = out.split('\n').map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''));
  return lines.filter((l) => l.length > 0).join('\n') + '\n';
}

function writeBundle(name, body) {
  fs.mkdirSync(bundlesDir, { recursive: true });
  const outPath = path.join(bundlesDir, name);
  const normalized = normalizeNewlines(body);
  fs.writeFileSync(outPath, normalized, 'utf8');
  console.log('Wrote', outPath, '—', normalized.length, 'chars');
}

function writeBundlePair(baseName, body) {
  const readable = normalizeNewlines(body);
  writeBundle(baseName + '.mcp.js', readable);
  writeBundle(baseName + '.min.mcp.js', stripMinify(readable));
}

function readRunner(name) {
  return fs.readFileSync(path.join(bundlesDir, name), 'utf8');
}

const PREAMBLE = `const CONFIG = ctx;
const ACTIVE_FILE_KEY = typeof ctx.activeFileKey === 'string' ? ctx.activeFileKey : (typeof ctx.fileKey === 'string' ? ctx.fileKey : '');
const REGISTRY_COMPONENTS = ctx.registryComponents || {};
const usesComposes = !!ctx.usesComposes;
let pageContent;
let docRoot;
let compSet = null;
let variantBuildHolder = null;
let variantByKey = {};
let propsAdded;
const __ccPropAddErrors = [];
const hasSizeAxis = !!(CONFIG.sizes && CONFIG.sizes.length > 0);
`;

const joinParts = (...parts) => parts.map(normalizeNewlines).join('\n');

// ── scaffold ─────────────────────────────────────────────────────────────
{
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-scaffold-clear.js'),
    readUtf8('cc-doc-chunk-a.js'),
    readUtf8('cc-doc-constants.js'),
    readUtf8('cc-doc-page-header.js'),
    readUtf8('cc-doc-chunk-b.js'),
    readRunner('_scaffold-runner.fragment.js'),
  );
  writeBundlePair('scaffold', body);
}

// ── properties ───────────────────────────────────────────────────────────
{
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-doc-fill-props.js'),
    readRunner('_properties-runner.fragment.js'),
  );
  writeBundlePair('properties', body);
}

// ── usage ────────────────────────────────────────────────────────────────
{
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-doc-chunk-a.js'),
    readUtf8('cc-doc-constants.js'),
    readUtf8('cc-doc-chunk-b.js'),
    readUtf8('cc-doc-insert-replace.js'),
    readUtf8('cc-doc-usage-only.js'),
    readRunner('_usage-runner.fragment.js'),
  );
  writeBundlePair('usage', body);
}

// ── matrix ───────────────────────────────────────────────────────────────
{
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-doc-chunk-a.js'),
    readUtf8('cc-doc-constants.js'),
    readUtf8('cc-doc-chunk-b.js'),
    readUtf8('cc-doc-insert-replace.js'),
    readUtf8('cc-doc-matrix-only.js'),
    readRunner('_matrix-runner.fragment.js'),
  );
  writeBundlePair('matrix', body);
}

const DOC_TAIL = joinParts(
  readUtf8('cc-doc-chunk-a.js'),
  readUtf8('cc-doc-constants.js'),
  readUtf8('cc-doc-chunk-b.js'),
  readUtf8('cc-doc-insert-replace.js'),
  readUtf8('cc-doc-chunk-c.js'),
  readRunner('_component-runner.fragment.js'),
);

// ── component-chip ────────────────────────────────────────────────────────
{
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-build-variant-chip.js'),
    readUtf8('cc-variant-loop-chip.js'),
    DOC_TAIL,
  );
  writeBundlePair('component-chip', body);
}

const ARCH_LAYOUTS = [
  ['surface-stack', 'cc-arch-surface-stack.js'],
  ['field', 'cc-arch-field.js'],
  ['row-item', 'cc-arch-row-item.js'],
  ['tiny', 'cc-arch-tiny.js'],
  ['control', 'cc-arch-control.js'],
  ['container', 'cc-arch-container.js'],
  ['composed', 'cc-arch-composed.js'],
];

for (const [layout, archFile] of ARCH_LAYOUTS) {
  const body = joinParts(
    PREAMBLE,
    readUtf8('cc-runtime-head.js'),
    readUtf8('cc-build-variant-chip.js'),
    readUtf8('cc-arch-shared.js'),
    readUtf8(archFile),
    readUtf8('cc-variant-dispatch.js'),
    DOC_TAIL,
  );
  writeBundlePair(`component-${layout}`, body);
}
