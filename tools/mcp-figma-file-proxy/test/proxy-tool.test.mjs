import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runUseFigmaFromMcpArgsFile } from '../lib/proxy-tool.mjs';
import { resetFigmaMcpClientForTests } from '../lib/upstream-figma.mjs';

test('runUseFigmaFromMcpArgsFile: mock upstream returns text', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'mcp-pxy-'));
  const p = path.join(base, 'mcp-variants.json');
  const payload = {
    fileKey: 'abc123',
    code: "export default async function () { return { ok: true }; }",
    description: 't',
  };
  await writeFile(p, JSON.stringify(payload), 'utf8');

  try {
    const r = await runUseFigmaFromMcpArgsFile(
      { mcpArgsPath: p },
      {
        env: {
          ...process.env,
          FIGMA_MCP_TEST_MOCK: '1',
          FIGMA_MCP_READ_ROOTS: base,
        },
        inject: {
          create: async () => ({
            callTool: async ({ name, arguments: args }) => {
              assert.equal(name, 'use_figma');
              assert.equal(args.fileKey, 'abc123');
              return { content: [{ type: 'text', text: 'injected-ok' }] };
            },
          }),
        },
      }
    );
    assert.equal(r.isError, undefined);
    assert.equal(r.content[0].type, 'text');
    assert.equal(r.content[0].text, 'injected-ok');
  } finally {
    resetFigmaMcpClientForTests();
  }
});

test('runUseFigmaFromMcpArgsFile: check script fails on bad JSON', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'mcp-pxy-'));
  const p = path.join(base, 'bad.json');
  await writeFile(p, 'not json {{{', 'utf8');
  const r = await runUseFigmaFromMcpArgsFile(
    { mcpArgsPath: p },
    {
      env: {
        ...process.env,
        FIGMA_MCP_READ_ROOTS: base,
        FIGMA_MCP_TEST_MOCK: '1',
      },
    }
  );
  assert.equal(r.isError, true);
  assert.ok(String(r.content[0].text).includes('check-use-figma-mcp-args'));
  resetFigmaMcpClientForTests();
});
