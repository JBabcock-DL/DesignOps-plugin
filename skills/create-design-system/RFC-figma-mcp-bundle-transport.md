# RFC (draft) — Figma MCP `use_figma`: bundle transport

**Status:** Draft for posting to **Figma MCP** and/or **Cursor** issue trackers.  
**Context:** Orchestration friction documented in [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) §11 and **§12**.

## Problem

The `use_figma` tool accepts a single **`code`** string (character cap, e.g. ~50 000). Authoring agents must concatenate large **Plugin API** scripts from multiple canonical files and pass the result **inline** in JSON. That causes:

- Copy/paste and escaping errors
- Host UI / message limits on very large arguments
- Policy tension when teams forbid temp files used only to stage `code`

## Proposal

Extend the Figma MCP tool schema (or a sibling tool) with **one** of:

### Option A — `bundleId` + `bundleVersion`

```json
{
  "fileKey": "…",
  "bundleId": "create-design-system.step15a-primitives",
  "bundleVersion": "1.0.0",
  "description": "…",
  "skillNames": "figma-use"
}
```

The **MCP server** (or host) resolves `bundleId` + `bundleVersion` to the merged script bytes from a **trusted registry** (ship-side table, marketplace asset index, or signed blob store) before execution in Figma.

### Option B — `codePaths` (server-side read)

```json
{
  "fileKey": "…",
  "codePaths": [
    "{skillRoot}/canvas-templates/_lib.js",
    "{skillRoot}/canvas-templates/primitives.js",
    "{skillRoot}/canvas-templates/bundles/_step15a-runner.fragment.js"
  ],
  "join": "concat",
  "description": "…"
}
```

The server concatenates in order. **`skillRoot`** would be defined by the host (Claude Code plugin path, workspace root, etc.).

### Option C — Optional `params` only

When the bundle is fully self-contained, allow a **small** JSON `params` object (e.g. `pageNameOverride`) while `code` stays empty or minimal.

## Security / trust

- Bundles must be **integrity-checked** (hash pinned to skill version) or loaded only from **allow-listed** roots.
- `codePaths` must not allow arbitrary filesystem reads outside declared skill roots.

## Relation to current DesignOps workaround

Until upstream ships this, this repository ships **committed** [`canvas-templates/bundles/step-15a-primitives.mcp.js`](./canvas-templates/bundles/step-15a-primitives.mcp.js) and [`scripts/bundle-canvas-mcp.mjs`](./scripts/bundle-canvas-mcp.mjs) so agents can `Read` **one** file into `use_figma.code`.

## References

- [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) §8–§12  
- [`canvas-templates/bundles/README.md`](./canvas-templates/bundles/README.md)
