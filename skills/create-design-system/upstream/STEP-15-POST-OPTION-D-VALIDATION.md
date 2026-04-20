# Canvas MCP bundles — validation after Option D ships

**Prerequisite:** `use_figma` (or MCP host) supports allow-listed **`codeWorkspacePath`** (or equivalent) per [`OPTION-D-ACCEPTANCE-CRITERIA.md`](./OPTION-D-ACCEPTANCE-CRITERIA.md).

**`fileKey`:** Use the **designer’s** Figma Design file only. Parse from `figma.com/design/<fileKey>/…`, from handoff, or from `--file-key` per [`../SKILL.md`](../SKILL.md). **Do not commit team file keys** into shared documentation.

## Preconditions (file state)

- Target file has variables and doc styles expected for style-guide + Token Overview runs (at minimum **Primitives** + **Theme**, **`Doc/*`** text styles + **`Effect/shadow-*`** per skill §0.4; Token Overview page from `/new-project` 05d for Step 17 bundle).
- Designer has authorized MCP access to that file.

## Calls to run (in order)

Use the **MCP server identifier** your Cursor project exposes (often `plugin-figma-figma`, not the bare slug `figma` — see [`../../AGENTS.md`](../../AGENTS.md)).

For each row, invoke `use_figma` with:

- `fileKey`: `<designer file key>`
- `skillNames`: `figma-use` (when required by host)
- `codeWorkspacePath`: path **relative to allow-listed root** (adjust if host requires skill-root prefix)

| Step | `codeWorkspacePath` (repo layout) |
|------|-----------------------------------|
| 15a | `skills/create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js` |
| 15b | `skills/create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js` |
| 15c | `skills/create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js` |
| 15c | `skills/create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js` |
| 15c | `skills/create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js` |
| 17 — Token Overview | `skills/create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js` |

If the workspace root is **not** this repository (e.g. Claude Code with plugin-only install), use the **same relative paths under the skill directory** as documented in [`../SKILL.md`](../SKILL.md) and [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md).

## Pass criteria

- Each call returns success (host-defined) with no file-read or size errors.
- In Figma, the **↳ Primitives**, **↳ Theme**, **↳ Layout**, **↳ Text Styles**, and **↳ Effects** documentation pages show the expected style-guide tables (per [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md)); **↳ Token Overview** reflects Step 17 behavior (per [`../phases/08-steps17-appendix.md`](../phases/08-steps17-appendix.md)).
- No manual copy-paste of bundle source was required to complete the **six** calls (five style-guide + Token Overview).

## Failure triage

- **Path / allow-list errors:** confirm host roots include workspace or skill install path.
- **Parse errors in Figma:** verify the file read is **byte-identical** to the committed `.min.mcp.js` (no truncation; UTF-8 intact).
- **Missing styles / bindings:** confirm Step 11 close (Doc/* + Effect styles) ran for that file, or run docs-only prerequisites per [`../SKILL.md`](../SKILL.md) §0.4.
