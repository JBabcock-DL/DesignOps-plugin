#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/probe-page.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Generic page-tree enumerator for /create-component recovery and debug.
//
// Emits one `use_figma` MCP args JSON that lists named children of a target
// page in the given Figma file, optionally filtered by depth and by a name
// substring. Intended for two scenarios:
//
// 1. EXECUTOR.md §0.3 runbook (MCP returned `undefined`): rather than the
//    agent composing a probe payload by hand, run `probe-page` and pipe the
//    return JSON straight into a return-<slug>.json file or read it directly
//    to recover IDs (pageContentId, docRootId, compSetId).
//
// 2. Post-draw "what got drawn?" debug — list the slot/section nodes on the
//    component's page after a slice succeeded silently or partially.
//
// Parent still owns `use_figma` / `call_mcp`. This script ONLY emits the
// args JSON or prints it to stdout; it does NOT call MCP.
//
// Usage
//   node scripts/probe-page.mjs --emit <fileKey> --page <pageName> \
//     [--depth N] [--name-includes <substr>] [--out <args.json>] \
//     [--description <text>]
//
//   --emit <fileKey>          Figma file key to probe.
//   --page <pageName>         Page name to enumerate (e.g. "↳ Checkbox").
//   --depth N                 default 3. How many tree levels to traverse.
//                             1 = direct children, 2 = grandchildren, etc.
//   --name-includes <substr>  optional case-sensitive substring filter on
//                             node names. e.g. "doc/component/checkbox".
//   --out <args.json>         optional. Default: print MCP args JSON to stdout.
//
// Output JSON shape (when parent runs the emitted code):
//   {
//     pageName: string,
//     pageId: string,
//     totalNodes: number,
//     truncated: boolean,        // true if we hit the depth cap
//     nodes: [
//       { id, name, type, depth, parentName }
//     ]
//   }
//
// Exit codes:
//   0  ok
//   1  bad CLI / write error

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.error(
    `Usage: node scripts/probe-page.mjs --emit <fileKey> --page <pageName> [options]\n` +
    `  --depth N                 default 3\n` +
    `  --name-includes <substr>  case-sensitive name filter\n` +
    `  --out <args.json>         default: stdout\n` +
    `  --description <text>      use_figma description\n`,
  );
  process.exit(args.length === 0 ? 2 : 0);
}

let fileKey = null;
let pageName = null;
let depth = 3;
let nameIncludes = null;
let outPath = null;
let description = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--emit') fileKey = args[++i];
  else if (a === '--page') pageName = args[++i];
  else if (a === '--depth') depth = parseInt(args[++i], 10);
  else if (a === '--name-includes') nameIncludes = args[++i];
  else if (a === '--out') outPath = args[++i];
  else if (a === '--description') description = args[++i];
  else { console.error(`probe-page: unknown arg: ${a}`); process.exit(1); }
}

if (!fileKey) { console.error('probe-page: --emit <fileKey> is required'); process.exit(1); }
if (!pageName) { console.error('probe-page: --page <pageName> is required'); process.exit(1); }
if (!Number.isFinite(depth) || depth < 1 || depth > 10) {
  console.error('probe-page: --depth must be 1..10'); process.exit(1);
}

// Plugin-side enumeration. Builds a flat list to keep the return small enough
// for tight transports (Composer 2). MAX_NODES caps the result; truncated flag
// signals when more existed.
const code = [
  `const TARGET_PAGE_NAME = ${JSON.stringify(pageName)};`,
  `const MAX_DEPTH = ${depth};`,
  `const NAME_FILTER = ${nameIncludes ? JSON.stringify(nameIncludes) : 'null'};`,
  `const MAX_NODES = 500;`,
  ``,
  `const page = figma.root.children.find(c => c.name === TARGET_PAGE_NAME);`,
  `if (!page) {`,
  `  return { error: 'page-not-found', pageName: TARGET_PAGE_NAME, availablePages: figma.root.children.map(c => c.name) };`,
  `}`,
  ``,
  `const nodes = [];`,
  `let truncated = false;`,
  `function walk(node, d, parentName) {`,
  `  if (nodes.length >= MAX_NODES) { truncated = true; return; }`,
  `  if (!NAME_FILTER || (typeof node.name === 'string' && node.name.indexOf(NAME_FILTER) !== -1)) {`,
  `    nodes.push({`,
  `      id: node.id,`,
  `      name: node.name,`,
  `      type: node.type,`,
  `      depth: d,`,
  `      parentName: parentName || null,`,
  `    });`,
  `  }`,
  `  if (d < MAX_DEPTH && Array.isArray(node.children)) {`,
  `    for (const child of node.children) {`,
  `      if (nodes.length >= MAX_NODES) { truncated = true; return; }`,
  `      walk(child, d + 1, node.name);`,
  `    }`,
  `  }`,
  `}`,
  `for (const child of page.children) walk(child, 1, page.name);`,
  ``,
  `return {`,
  `  pageName: page.name,`,
  `  pageId: page.id,`,
  `  totalNodes: nodes.length,`,
  `  truncated,`,
  `  nodes,`,
  `};`,
].join('\n');

const mcpArgs = {
  fileKey,
  code,
  description: description || `probe-page: enumerate "${pageName}" depth=${depth}${nameIncludes ? ` filter="${nameIncludes}"` : ''}`,
  skillNames: 'figma-use',
};

const json = JSON.stringify(mcpArgs);

if (outPath) {
  writeFileSync(resolve(outPath), json, 'utf8');
  console.log(`OK  wrote MCP args → ${resolve(outPath)} (${Buffer.byteLength(json, 'utf8')}B)`);
  console.log(`    Next: parent Read this file + call_mcp use_figma`);
} else {
  process.stdout.write(json);
}
