import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  getAllowRootsFromEnv,
  isPathUnderAnyRoot,
  parseRootsList,
  resolveAllowedMcpArgsFile,
} from '../lib/read-roots.mjs';

test('parseRootsList splits on path.delimiter', () => {
  const a = path.join('a', 'b');
  const b = path.join('c', 'd');
  const s = a + path.delimiter + b;
  assert.deepEqual(parseRootsList(s), [a, b]);
});

test('getAllowRootsFromEnv merges list and workspace', () => {
  const roots = getAllowRootsFromEnv({
    FIGMA_MCP_READ_ROOTS: '/x',
    FIGMA_MCP_WORKSPACE_ROOT: '/y',
  });
  assert.ok(roots.includes('/x'));
  assert.ok(roots.includes('/y'));
});

test('resolveAllowedMcpArgsFile allows file under root', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'mcp-allow-'));
  const f = path.join(base, 'args.json');
  await writeFile(f, '{}', 'utf8');
  const realBase = await realpath(base);
  const { realPath } = await resolveAllowedMcpArgsFile('args.json', {
    allowRoots: [base],
    cwd: base,
  });
  const rp = await realpath(realPath);
  assert.equal(rp, path.join(realBase, 'args.json'));
});

test('resolveAllowedMcpArgsFile rejects path outside roots', async () => {
  const a = await mkdtemp(path.join(tmpdir(), 'mcp-in-'));
  const b = await mkdtemp(path.join(tmpdir(), 'mcp-out-'));
  const outside = path.join(b, 'nope.json');
  await writeFile(outside, '{}', 'utf8');
  await assert.rejects(
    () =>
      resolveAllowedMcpArgsFile(outside, {
        allowRoots: [a],
        cwd: a,
      }),
    /not under allowed roots/
  );
});

test('isPathUnderAnyRoot', async () => {
  const a = await mkdtemp(path.join(tmpdir(), 'mcp-'));
  const sub = path.join(a, 'x');
  await mkdir(sub, { recursive: true });
  const r = [await realpath(a)];
  assert.equal(isPathUnderAnyRoot(path.join(r[0], 'x', 'f.json'), r), true);
  assert.equal(isPathUnderAnyRoot('/unlikely/nonexistent-absolute-path', r), false);
});
