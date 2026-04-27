# /create-component — Composer-class

**Authority:** This file wins for Composer-class. Period.

## One-time setup

- **Cursor `Add Folder to Workspace`** for the DesignOps plugin root (see `.cursor/rules/cursor-designops-skill-root.mdc`).
- Resolve Figma MCP **`serverIdentifier`** from `mcps/**/SERVER_METADATA.json` (not necessarily `figma`).
- Have the Figma **`fileKey`** and a **`.designops-registry.json`** (or JSON your `--registry` path points at).
- **`npm install`** in the plugin repo (esbuild, etc. for `npm run build:min` when you touch `preamble.figma.js`).
- Smoke: `node scripts/check-payload.mjs --help` (and read `scripts/assemble-slice.mjs` header for flags).

## The flow

```
1. node scripts/build-config-block.mjs <component>
2. # Loop 3–5 for each of 10 slices in this order:
   cc-doc-scaffold-shell → cc-doc-scaffold-header → cc-doc-scaffold-table →
   cc-doc-scaffold-placeholders → cc-variants → cc-doc-component → cc-doc-props →
   cc-doc-matrix → cc-doc-usage → cc-doc-finalize
3. node scripts/assemble-slice.mjs --step <slug> --layout <layout> --config-block <path> --registry <path> --handoff <path> --file-key <fileKey> --out <slice.code.js>
4. # Call use_figma in the parent with the assembled code from --out
5. node scripts/merge-create-component-handoff.mjs <slug> handoff.json return.json
```

(Phase state file defaults to `dirname(handoff.json)/phase-state.json`; pass a 4th path to override.)

## Recovery ladder (deterministic)

1. Re-read `phase-state.json` for `nextSlug` and the on-disk `handoff.json`.
2. If `assemble-slice.mjs` exits **10** or **11** (`check-payload` / `check-use-figma-mcp-args`), fix the assembled code or MCP args before retrying.
3. If `use_figma` returns truncation or `Unexpected end of JSON input`, halt — do not retry the same shape; use a host that can pass the full tool-arguments JSON, or reduce payload size in source templates.
4. Escalate to a higher-capacity model for that single `use_figma` call if needed.

## Hard prohibitions

- No `Task` subagents for full 10-slice `use_figma` payloads unless the host is proven to pass complete `call_mcp` tool args.
- No hand-editing `preamble.runtime.figma.js` (generated) — edit `preamble.figma.js` and `npm run build:min`.
- No hand-typed `summary` / `usageDo` / `usageDont` — use `build-config-block.mjs` or `Read` from `shadcn-props`.
- No `cat` of large min files as the MCP `code` source (truncation risk); `Read` in editor or `assemble-slice` `--out`.
- No parallel draw slices; one slug at a time, fixed DAG.

**Related:** [`../create-component-figma-slice-runner/SKILL.md`](../create-component-figma-slice-runner/SKILL.md), [`EXECUTOR.md`](./EXECUTOR.md) §0, [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md).
