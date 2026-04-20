# RFC (draft) — Figma MCP `use_figma`: bundle transport

**Status:** Draft for posting to **Figma MCP** and/or **Cursor** issue trackers.  
**Tracking (this repo):** [DesignOps-plugin#4](https://github.com/JBabcock-DL/DesignOps-plugin/issues/4) — upstream feature request + link to copy-paste bodies below.  
**Context:** Orchestration friction documented in [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) §11 and **§12**.

## Problem

The `use_figma` tool accepts a single **`code`** string (character cap, e.g. ~50 000). Authoring agents must concatenate large **Plugin API** scripts from multiple canonical files and pass the result **inline** in JSON. That causes:

- Copy/paste and escaping errors
- Host UI / message limits on very large arguments
- Policy tension when teams forbid temp files used only to stage `code`

### Cursor / agent truncation (motivation)

Some agent hosts surface **terminal command output with a character cap** (for example ~20k). Dumping a committed `.min.mcp.js` (~25–31k bytes) via `cat` / `type` and then copying from chat **drops bytes silently**, so `use_figma` never receives the verbatim bundle. That is a **transport** failure, not a Figma script bug.

**Mitigation today:** Load the bundle with a **non-truncated read path** (editor `Read` → tool argument, or equivalent) — never rely on shell stdout for the full payload. See [`AGENTS.md`](../../AGENTS.md) and [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md).

**Mitigation upstream (this RFC):** Let the **MCP host** read allow-listed files and populate `code` without putting the entire script in the agent transcript.

## Proposal

Extend the Figma MCP tool schema (or a sibling tool) with **one** of:

### Option D — `codeWorkspacePath` / `codeFile` (single allow-listed file) — **preferred for DesignOps**

```json
{
  "fileKey": "…",
  "codeWorkspacePath": "skills/create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js",
  "description": "Step 15a ↳ Primitives canvas bundle",
  "skillNames": "figma-use"
}
```

The **MCP host** (or connector) resolves the path **only** under allow-listed roots — e.g. **workspace root** and/or **plugin skill install directory** — rejects `..` traversal, reads the file as UTF-8, checks size (≤ existing `code.maxLength`, e.g. 50 000), then executes the bytes **as today’s `code`**. Mutually exclusive with inline `code` when this field is set.

**Why one path:** This repository ships **one self-contained `.min.mcp.js` per Step 15 call**; no concat step is required on the server for the happy path.

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
- `codePaths` / `codeWorkspacePath` must not allow arbitrary filesystem reads outside declared skill roots; reject `..`, symlinks outside roots if policy requires.
- Enforce the same **max byte / character count** as inline `code` before execution.

## Relation to current DesignOps workaround

Until upstream ships this, this repository ships **committed** bundles under [`canvas-templates/bundles/`](./canvas-templates/bundles/) (Steps **15a–15c** + **Step 17** Token Overview, readable + `.min.mcp.js`) and [`scripts/bundle-canvas-mcp.mjs`](./scripts/bundle-canvas-mcp.mjs) so agents can `Read` **one** file per call into `use_figma.code` (see [`conventions/17-table-redraw-runbook.md`](./conventions/17-table-redraw-runbook.md)).

---

## Upstream issue draft (copy-paste)

Use these bodies when filing tickets on **Cursor** (Figma connector / MCP host) and **Figma** (MCP `use_figma` tool). Link back to this RFC in the repo:  
`https://github.com/JBabcock-DL/DesignOps-plugin/blob/main/skills/create-design-system/RFC-figma-mcp-bundle-transport.md`

### Title (either tracker)

`Feature request: use_figma — allow-listed file path for Plugin API code (reduce agent payload lift)`

### Body (Figma MCP / Cursor)

```markdown
## Summary

Please extend `use_figma` (or the host that invokes it) so agents can reference **one allow-listed workspace or skill-root file path** instead of inlining ~25–31k characters of JavaScript in every tool call.

## Motivation

- DesignOps ships **committed** one-file bundles (e.g. `step-15a-primitives.min.mcp.js`) for canvas steps; they are the canonical source of truth.
- Inlining the full bundle in JSON works but: (1) burns context in chat, (2) invites escaping mistakes, (3) some agent UIs **truncate shell output**, so `cat`-based workflows silently corrupt `code`.

## Proposal

Add **Option D** from our RFC: optional `codeWorkspacePath` (or `codeFile`) — host reads UTF-8 bytes only under allow-listed roots, max size = existing `code` cap (~50k), no `..` traversal. When set, treat file contents exactly as today’s `code` string.

Alternates: ordered `codePaths[]` concat (Option B), or `bundleId` + version (Option A).

## Security

Allow-list roots (workspace + plugin install path), max bytes, optional SHA-256 pin per skill version.

## Reference

Detroit Labs DesignOps RFC (draft, Option D + context):  
https://github.com/JBabcock-DL/DesignOps-plugin/blob/main/skills/create-design-system/RFC-figma-mcp-bundle-transport.md
```

## References

- [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) §8–§12  
- [`canvas-templates/bundles/README.md`](./canvas-templates/bundles/README.md)
- **Upstream pack (MRE, acceptance criteria, validation, filing checklist):** [`upstream/README.md`](./upstream/README.md)
