#!/usr/bin/env node
/**
 * Call Figma MCP `use_figma` with arguments loaded from a JSON file.
 * No LLM or IDE tool layer reads the large `code` string — only this process does.
 *
 * Usage:
 *   npm run figma:mcp-invoke -- --url "<Desktop MCP URL>" --file path/to/mcp-cc-doc-props.json
 *   npm run figma:mcp-invoke -- --dry-run --file path/to/mcp-cc-doc-props.json
 *
 * Env (instead of --url): FIGMA_DESKTOP_MCP_URL or FIGMA_MCP_URL
 *
 * JSON shape: flat { fileKey, code, description, skillNames? } (as from assemble-slice --emit-mcp-args)
 * or { arguments: { ... } }.
 *
 * docs/buildable-figma-payload-path.md
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`figma-mcp-invoke-from-file — call use_figma via Streamable HTTP (e.g. Figma Desktop MCP)

Usage:
  node scripts/figma-mcp-invoke-from-file.mjs --url <MCP_URL> --file <args.json>
  node scripts/figma-mcp-invoke-from-file.mjs --dry-run --file <args.json>

Options:
  --url <url>           Figma Desktop MCP base URL (or set FIGMA_DESKTOP_MCP_URL / FIGMA_MCP_URL)
  --file <path>         JSON: { fileKey, code, description } or { arguments: { … } }
  --dry-run             Run check-use-figma-mcp-args only; no network
  --tool-name <name>    MCP tool name (default: use_figma)
  -h, --help            This message

Typical: assemble-slice ... --emit-mcp-args draw/mcp-cc-doc-props.json
         FIGMA_DESKTOP_MCP_URL="…" npm run figma:mcp-invoke -- --file draw/mcp-cc-doc-props.json
`);
}

function parseArgs(argv) {
  let url = process.env.FIGMA_DESKTOP_MCP_URL || process.env.FIGMA_MCP_URL || '';
  let file = '';
  let dryRun = false;
  let toolName = 'use_figma';
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      help = true;
      continue;
    }
    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (a === '--url' && argv[i + 1]) {
      url = argv[++i];
      continue;
    }
    if (a === '--file' && argv[i + 1]) {
      file = argv[++i];
      continue;
    }
    if (a === '--tool-name' && argv[i + 1]) {
      toolName = argv[++i];
      continue;
    }
  }
  return { url, file, dryRun, toolName, help };
}

function loadToolArgs(absFile) {
  let argsObj;
  try {
    argsObj = JSON.parse(fs.readFileSync(absFile, 'utf8'));
  } catch (e) {
    console.error('figma-mcp-invoke: invalid JSON:', e.message);
    process.exit(1);
  }

  const inner =
    argsObj.arguments && typeof argsObj.arguments === 'object' ? argsObj.arguments : argsObj;
  const { fileKey, code, description, skillNames } = inner;
  if (!fileKey || typeof code !== 'string' || !description) {
    console.error(
      'figma-mcp-invoke: expected fileKey, code (string), description (top-level or under .arguments)',
    );
    process.exit(1);
  }

  return {
    fileKey,
    code,
    description,
    ...(skillNames != null && skillNames !== '' ? { skillNames } : {}),
  };
}

function runDryRun(absFile) {
  const checkScript = path.join(REPO_ROOT, 'scripts', 'check-use-figma-mcp-args.mjs');
  const r = spawnSync(process.execPath, [checkScript, absFile], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0 && r.status != null) {
    process.exit(r.status);
  }
  console.log('figma-mcp-invoke: --dry-run OK (would call MCP with validated args)');
}

/**
 * MCP `callTool` often wraps the Figma plugin return as
 * `{ content: [{ type: 'text', text: '<JSON string>' }] }`.
 * finalize-slice / merge expect the parsed Figma object (same as IDE `call_mcp` returns).
 */
function unwrapMcpToolResult(result) {
  if (!result || typeof result !== 'object') return result;
  const c = result.content;
  if (Array.isArray(c) && c[0]?.type === 'text' && typeof c[0]?.text === 'string') {
    try {
      return JSON.parse(c[0].text);
    } catch {
      /* fall through */
    }
  }
  return result;
}

async function runMcp(urlStr, toolArgs, toolName) {
  const client = new Client({ name: 'designops-figma-invoke', version: '0.0.1' });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(urlStr));
  } catch (e) {
    console.error('figma-mcp-invoke: bad --url:', e.message);
    process.exit(1);
  }

  try {
    await client.connect(transport);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('figma-mcp-invoke: MCP connect failed:', msg);
    console.error(
      'Hint: use Figma Desktop Dev Mode MCP URL; remote https://mcp.figma.com/mcp needs OAuth in this client (not wired).',
    );
    process.exit(1);
  }

  try {
    const result = await client.callTool({
      name: toolName,
      arguments: toolArgs,
    });
    const outObj = unwrapMcpToolResult(result);
    process.stdout.write(`${JSON.stringify(outObj, null, 2)}\n`);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('figma-mcp-invoke: callTool failed:', msg);
    process.exit(1);
  } finally {
    await transport.close().catch(() => {});
  }
}

async function main() {
  const { url, file, dryRun, toolName, help } = parseArgs(process.argv.slice(2));

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (!file) {
    console.error('figma-mcp-invoke: --file <path.json> is required');
    printHelp();
    process.exit(1);
  }

  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`figma-mcp-invoke: not found: ${abs}`);
    process.exit(1);
  }

  if (dryRun) {
    runDryRun(abs);
    process.exit(0);
  }

  if (!url) {
    console.error(
      'figma-mcp-invoke: --url or FIGMA_DESKTOP_MCP_URL is required (unless --dry-run)\n',
    );
    printHelp();
    process.exit(1);
  }

  const toolArgs = loadToolArgs(abs);
  await runMcp(url, toolArgs, toolName);
}

main().catch((e) => {
  console.error('figma-mcp-invoke:', e);
  process.exit(1);
});
