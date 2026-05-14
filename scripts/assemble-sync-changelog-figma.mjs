#!/usr/bin/env node
/**
 * Build a self-contained `use_figma` `code` string for the /sync-design-system
 * optional ↳ changelog page (replace `_PageContent` only).
 *
 * Usage:
 *   node scripts/assemble-sync-changelog-figma.mjs --in <payload.json> --out <changelog-payload.js>
 *
 * Then: npm run check-payload -- <changelog-payload.js>
 *
 * Input JSON (UTF-8):
 * {
 *   "displayName": "Alex",
 *   "dateMmDdYyyy": "05/14/2026",
 *   "isFirstRecordedSync": false,
 *   "scope": "full",
 *   "axisALines": ["…"],
 *   "axisBLines": ["…"],
 *   "axisCLines": ["…"],
 *   "canvasLines": ["…"]
 * }
 *
 * `fileKey` is not embedded; the MCP caller passes fileKey separately.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGE_NAME = '\u21B3 changelog';
const TOKEN_OVERVIEW_NAME = '\u21B3 Token Overview';
const PAGE_NAME_JS = JSON.stringify(PAGE_NAME);
const TOKEN_OVERVIEW_JS = JSON.stringify(TOKEN_OVERVIEW_NAME);

function parseArgs(argv) {
  const out = { inPath: null, outPath: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in' && argv[i + 1]) out.inPath = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) out.outPath = argv[++i];
  }
  return out;
}

/** Emit async-function-body text for use_figma `code`. */
export function assembleSyncChangelogFigmaCode(input) {
  const {
    displayName = '',
    dateMmDdYyyy = '',
    isFirstRecordedSync = false,
    scope = '',
    axisALines = [],
    axisBLines = [],
    axisCLines = [],
    canvasLines = [],
  } = input;

  const data = {
    displayName,
    dateMmDdYyyy,
    isFirstRecordedSync: Boolean(isFirstRecordedSync),
    scope: String(scope),
    axisALines: Array.isArray(axisALines) ? axisALines.map(String) : [],
    axisBLines: Array.isArray(axisBLines) ? axisBLines.map(String) : [],
    axisCLines: Array.isArray(axisCLines) ? axisCLines.map(String) : [],
    canvasLines: Array.isArray(canvasLines) ? canvasLines.map(String) : [],
  };

  const dataJson = JSON.stringify(data);

  const body = `
if (typeof figma === 'undefined') {
  throw new Error('[sync-changelog] Must run inside use_figma.');
}

const DATA = ${dataJson};

function findHeaderComponent(docPage) {
  var h = docPage.findOne(function (n) {
    return n.type === 'COMPONENT' && n.name === '_Header';
  });
  if (h) return h;
  h = docPage.findOne(function (n) {
    return n.type === 'COMPONENT' && /^_?header/i.test(n.name);
  });
  if (h) return h;
  var wide = [];
  for (var i = 0; i < docPage.children.length; i++) {
    var ch = docPage.children[i];
    if (ch.type === 'COMPONENT' && ch.width >= 1200) wide.push(ch);
  }
  if (wide.length === 0) return null;
  wide.sort(function (a, b) {
    return b.width - a.width;
  });
  return wide[0];
}

function hasHeaderOnPage(page) {
  for (var i = 0; i < page.children.length; i++) {
    var c = page.children[i];
    if (c.name !== '_Header') continue;
    if (c.type !== 'INSTANCE' && c.type !== 'COMPONENT') continue;
    if (Math.abs(c.x) >= 1 || Math.abs(c.y) >= 1) continue;
    return true;
  }
  return false;
}

function pageIndexByName(name) {
  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].type === 'PAGE' && pages[i].name === name) return i;
  }
  return -1;
}

function findOrCreateChangelogPage() {
  var rootKids = figma.root.children;
  var existing = null;
  for (var p = 0; p < rootKids.length; p++) {
    if (rootKids[p].type === 'PAGE' && rootKids[p].name === ${PAGE_NAME_JS}) {
      existing = rootKids[p];
      break;
    }
  }
  var anchorIdx = pageIndexByName(${TOKEN_OVERVIEW_JS});
  if (existing) {
    if (anchorIdx >= 0) {
      var curIdx = figma.root.children.indexOf(existing);
      var wantIdx = anchorIdx + 1;
      if (curIdx !== wantIdx) {
        figma.root.insertChild(wantIdx, existing);
      }
    }
    return { page: existing, created: false };
  }
  var pg = figma.createPage();
  pg.name = ${PAGE_NAME_JS};
  if (anchorIdx >= 0) {
    figma.root.insertChild(anchorIdx + 1, pg);
  }
  return { page: pg, created: true };
}

await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

var docPage = figma.root.children.find(function (p) {
  return p.type === 'PAGE' && p.name === 'Documentation components';
});
var headerMaster = docPage ? findHeaderComponent(docPage) : null;

var found = findOrCreateChangelogPage();
var changelogPage = found.page;
await figma.setCurrentPageAsync(changelogPage);

if (!hasHeaderOnPage(changelogPage) && headerMaster) {
  var inst = headerMaster.createInstance();
  inst.x = 0;
  inst.y = 0;
  changelogPage.appendChild(inst);
  var titleNode = inst.findOne(function (n) {
    return n.name === '_title' && n.type === 'TEXT';
  });
  var descNode = inst.findOne(function (n) {
    return n.name === '_description' && n.type === 'TEXT';
  });
  if (titleNode) {
    await figma.loadFontAsync(titleNode.fontName);
    titleNode.characters = 'Changelog';
  }
  if (descNode) {
    await figma.loadFontAsync(descNode.fontName);
    descNode.characters =
      'Record of a /sync-design-system run — scope, axes, and canvas refresh summary.';
  }
}

var oldPc = changelogPage.children.find(function (n) {
  return n.name === '_PageContent' && n.type === 'FRAME';
});
if (oldPc) oldPc.remove();

var PAGE_WIDTH = 1800;
var PAD = 40;
var inner = PAGE_WIDTH - PAD * 2;

var pageContent = figma.createFrame();
pageContent.name = '_PageContent';
pageContent.layoutMode = 'VERTICAL';
pageContent.primaryAxisSizingMode = 'AUTO';
pageContent.counterAxisSizingMode = 'FIXED';
pageContent.resize(PAGE_WIDTH, 400);
pageContent.paddingLeft = pageContent.paddingRight = pageContent.paddingTop = pageContent.paddingBottom = PAD;
pageContent.itemSpacing = 20;
pageContent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
pageContent.clipsContent = false;
pageContent.x = 0;
pageContent.y = 320;
changelogPage.appendChild(pageContent);

var subtitle = figma.createText();
subtitle.fontName = { family: 'Inter', style: 'Semi Bold' };
subtitle.fontSize = 14;
subtitle.fills = [{ type: 'SOLID', color: { r: 0.25, g: 0.27, b: 0.31 } }];
subtitle.textAutoResize = 'HEIGHT';
subtitle.resize(inner, 24);
subtitle.characters = DATA.isFirstRecordedSync ? 'First recorded sync' : 'Sync summary';
pageContent.appendChild(subtitle);

var hero = figma.createText();
hero.fontName = { family: 'Inter', style: 'Medium' };
hero.fontSize = 13;
hero.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.38, b: 0.42 } }];
hero.textAutoResize = 'HEIGHT';
hero.resize(inner, 40);
hero.characters = (DATA.dateMmDdYyyy || '') + ' · ' + (DATA.displayName || '—') + ' · scope: ' + (DATA.scope || '—');
pageContent.appendChild(hero);

function addSection(title, lines) {
  var sec = figma.createFrame();
  sec.name = 'changelog-section/' + title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  sec.layoutMode = 'VERTICAL';
  sec.primaryAxisSizingMode = 'AUTO';
  sec.counterAxisSizingMode = 'FIXED';
  sec.resize(inner, 80);
  sec.itemSpacing = 8;
  sec.fills = [];
  var th = figma.createText();
  th.fontName = { family: 'Inter', style: 'Semi Bold' };
  th.fontSize = 12;
  th.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.16, b: 0.18 } }];
  th.textAutoResize = 'HEIGHT';
  th.resize(inner, 20);
  th.characters = title;
  sec.appendChild(th);
  var body = figma.createText();
  body.fontName = { family: 'Inter', style: 'Regular' };
  body.fontSize = 11;
  body.lineHeight = { unit: 'PIXELS', value: 17 };
  body.fills = [{ type: 'SOLID', color: { r: 0.22, g: 0.24, b: 0.28 } }];
  body.textAutoResize = 'HEIGHT';
  body.resize(inner, 400);
  body.characters = (lines && lines.length ? lines.join('\\n') : '—') || '—';
  sec.appendChild(body);
  pageContent.appendChild(sec);
}

addSection('Axis A — Variables', DATA.axisALines);
addSection('Canvas checklist', DATA.canvasLines);
addSection('Axis B — Components', DATA.axisBLines);
addSection('Axis C — Code Connect', DATA.axisCLines);

return {
  ok: true,
  step: 'sync-changelog',
  pageName: ${PAGE_NAME_JS},
  createdPage: found.created,
};
`;

  return body.replace(/^\n/, '').trimEnd();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inPath || !args.outPath) {
    console.error('Usage: node scripts/assemble-sync-changelog-figma.mjs --in <payload.json> --out <changelog-payload.js>');
    process.exit(2);
  }
  const inAbs = path.resolve(args.inPath);
  if (!fs.existsSync(inAbs)) {
    console.error(`Input not found: ${inAbs}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(inAbs, 'utf8');
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(2);
  }
  const code = assembleSyncChangelogFigmaCode(input);
  const outAbs = path.resolve(args.outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, code, 'utf8');
  console.log(`Wrote ${outAbs} (${code.length} chars)`);
}

const __self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__self)) {
  main();
}
