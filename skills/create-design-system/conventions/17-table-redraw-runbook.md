# Table redraw runbook — `use_figma` (Steps 15a–15c + Step 17)

**Audience:** Agents running `/create-design-system` style-guide steps, `/sync-design-system` **6.Canvas.9b** / **9d**, or any replay of the committed MCP bundles.

**Goal:** Redraw or refresh documentation **tables** without transport failures. Full context: [`16-mcp-use-figma-workflow.md`](./16-mcp-use-figma-workflow.md), [`AGENTS.md`](../../../AGENTS.md).

---

## 1. MCP server

Use the workspace **`serverIdentifier`** from `mcps/**/SERVER_METADATA.json` (Cursor: often **`plugin-figma-figma`**). The slug `figma` alone may not resolve.

---

## 2. Transport

| Priority | Action |
|----------|--------|
| **1 — Primary** | **Delegate each page to the [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent** via `Task(subagent_type: "generalPurpose")`. Parent passes `step`, `fileKey`, `description`; subagent `Read`s the bundle and calls `use_figma` with it verbatim; parent receives a compact `{ ok, step, pageName, tableGroups, … }` summary. This is the only path that keeps the 18–30k-char bundle out of the parent's context. Full delegation pattern: [`16-mcp-use-figma-workflow.md`](./16-mcp-use-figma-workflow.md) § *Canvas runner subagent*. |
| 2 — Debug fallback | Parent-side editor **`Read`** the `.min.mcp.js` file → pass the returned string **verbatim** as `use_figma` → `code`. Use only when the runner subagent cannot reach the MCP and the parent must escalate. |
| Forbidden | Shell `cat` / `type` as the source of truth for full bundles (stdout may truncate). Repo scratch `*-payload.json` / `.mcp-*` (see [`AGENTS.md`](../../../AGENTS.md)). |
| Do not assume | `codeWorkspacePath` or other file indirection — not in the connector schema. Only inline `code` exists. |

---

## 3. Committed bundles (wire = `.min.mcp.js`)

All paths are relative to the **repository root** when the workspace is this repo; with **Claude Code + plugin install**, use the same paths under the **skill directory** ([`16-mcp-use-figma-workflow.md`](./16-mcp-use-figma-workflow.md) § Source root).

| Step | Bundle (minified) |
|------|-------------------|
| 15a — ↳ Primitives | [`../canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../canvas-templates/bundles/step-15a-primitives.min.mcp.js) |
| 15b — ↳ Theme | [`../canvas-templates/bundles/step-15b-theme.min.mcp.js`](../canvas-templates/bundles/step-15b-theme.min.mcp.js) |
| 15c — ↳ Layout | [`../canvas-templates/bundles/step-15c-layout.min.mcp.js`](../canvas-templates/bundles/step-15c-layout.min.mcp.js) |
| 15c — ↳ Text Styles | [`../canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../canvas-templates/bundles/step-15c-text-styles.min.mcp.js) |
| 15c — ↳ Effects | [`../canvas-templates/bundles/step-15c-effects.min.mcp.js`](../canvas-templates/bundles/step-15c-effects.min.mcp.js) |
| 17 — ↳ Token Overview | [`../canvas-templates/bundles/step-17-token-overview.min.mcp.js`](../canvas-templates/bundles/step-17-token-overview.min.mcp.js) |

Regenerate all bundles after editing templates: `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs` ([`../canvas-templates/bundles/README.md`](../canvas-templates/bundles/README.md)).

---

## 4. Call count (parity)

- **15c** is always **three sequential `Task` subagent invocations** (Layout → Text Styles → Effects) — one bundle each, one Task each. Not parallel; not combined.
- **15a** and **15b** are one subagent Task each when those pages are redrawn.
- **Step 17** is one subagent Task when **↳ Token Overview** is refreshed.
- In every case, the subagent internally makes **one `use_figma` call** with the bundle verbatim; the parent never calls `use_figma` for canvas redraws itself.

---

## 5. Do not use in MCP `use_figma` scripts

- **`figma.clientStorage`** multi-part stitching — not reliably supported in the MCP host; pass one self-contained bundle per `use_figma` call.
- **`fetch`** to load bundle source from a URL (bundles must be committed and read from disk — see [`16-mcp-use-figma-workflow.md`](./16-mcp-use-figma-workflow.md)).
- Base64 / `atob` wrappers unless the host is verified to support them ([`16-mcp-use-figma-workflow.md`](./16-mcp-use-figma-workflow.md) § MCP host constraints).

---

## 6. `fileKey`

Always from the designer at runtime (URL, `--file-key`, handoff). Never commit customer file keys into docs or issues.

---

## 7. Token Overview shadow rule (§0.9)

Do not stack **`Effect/shadow-sm`** on **`doc/table/token-overview/platform-mapping`** or its descendants — see [`SKILL.md`](../SKILL.md) §0.9 and [`00-gotchas.md`](./00-gotchas.md).
