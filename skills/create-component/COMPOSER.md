# /create-component — Composer-class

**Authority:** This file wins for Composer-class. Period.

## Agent execution (automation)

- **Run** every `node scripts/…` and `npm run …` step here yourself (shell from the **DesignOps-plugin** repo root). Do not tell the user to copy-paste commands unless you are blocked (e.g. the environment has no Figma MCP and cannot `call_mcp` / `use_figma` at all).
- **Payload budget:** target **8–10 kB** (UTF-8) per assembled `code` + full MCP `arguments` per slice — [`conventions/18-mcp-payload-budget.md`](./conventions/18-mcp-payload-budget.md). If a slice is still huge, add **more** machine sub-slugs / `.partN` steps (merge-handoff order) and thinner engines — not a second MCP client.
- **`--emit-mcp-args`:** use when the parent will **`Read`** the same JSON in full and pass it to `call_mcp` (large objects must not be retyped in chat).
- **Default — remote MCP in the IDE:** Figma is connected via the host’s Figma MCP (e.g. Cursor marketplace, OAuth). **Parent** assembles, **`Read`s** the emitted `*.js` or `mcp-*.json` in full, then **`call_mcp`** (see `mcps/**/SERVER_METADATA.json` → `serverIdentifier`).

## One-time setup

- **Cursor `Add Folder to Workspace`** for the DesignOps plugin root (see `.cursor/rules/cursor-designops-skill-root.mdc`).
- Resolve Figma MCP **`serverIdentifier`** from `mcps/**/SERVER_METADATA.json` (not necessarily `figma`).
- Have the Figma **`fileKey`** and a **`.designops-registry.json`** (or JSON your `--registry` path points at).
- **`npm install`** in the plugin repo (esbuild, etc. for `npm run build:min` when you touch `preamble.figma.js`).
- Smoke: `node scripts/check-payload.mjs --help` (and read `scripts/assemble-slice.mjs` header for flags).

## The flow

```
1. node scripts/build-config-block.mjs <component>
2. # Loop 3–5 for each draw slug in this order (expand with .part2+ when a step is still too fat):
   cc-doc-scaffold-shell → cc-doc-scaffold-header → cc-doc-scaffold-table-chrome →
   cc-doc-scaffold-table-body →
   cc-doc-scaffold-placeholders → cc-variants → cc-doc-component → cc-doc-props-1 →
   cc-doc-props-2 →
   cc-doc-matrix → cc-doc-usage → cc-doc-finalize
3. node scripts/assemble-slice.mjs ... [--emit-mcp-args <draw/mcp-<slug>.json>]
4. **use_figma** — parent **`call_mcp`** with server id from `mcps/**/SERVER_METADATA.json`. Assembled `code` = `Read` full `--out` or full JSON from `--emit-mcp-args` (no hand-copy of truncated lines).
5. node scripts/merge-create-component-handoff.mjs <slug> handoff.json return.json
```

(Phase state file defaults to `dirname(handoff.json)/phase-state.json`; pass a 4th path to override.)

## Recovery ladder (deterministic)

1. Re-read `phase-state.json` for `nextSlug` and the on-disk `handoff.json`.
2. If `assemble-slice.mjs` exits **10** or **11** (`check-payload` / `check-use-figma-mcp-args`), fix the assembled code or MCP args before retrying.
3. If `use_figma` returns truncation or `Unexpected end of JSON input`, **split the work** (more sub-slugs, thinner bundle, or [`probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) once to document the host) — do not assume a separate shell invoker will fix auth or session parity with the IDE.
4. Escalate to a higher-capacity model for that single `use_figma` call if the bytes are already minimal and the host is proven to accept them.

## Hard prohibitions

- No `Task` subagents for full-slice `use_figma` payloads unless the host is proven to pass complete `call_mcp` tool args.
- No hand-editing `preamble.runtime.figma.js` (generated) — edit `preamble.figma.js` and `npm run build:min`.
- No hand-typed `summary` / `usageDo` / `usageDont` — use `build-config-block.mjs` or `Read` from `shadcn-props`.
- No `cat` of large min files as the MCP `code` source (truncation risk); `Read` in editor or `assemble-slice` `--out`.
- No parallel draw slices; one slug at a time, fixed DAG; prefer **more** ordered turns over **bigger** strings.

**Related:** [`../create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md), [`EXECUTOR.md`](./EXECUTOR.md) §0, [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md), [`conventions/18-mcp-payload-budget.md`](./conventions/18-mcp-payload-budget.md).
