# Upstream — `use_figma` bundle transport (Option D)

Artifacts for filing and validating **file-backed `code`** (`codeWorkspacePath` / equivalent) so agents do not inline **~20–31 KB** Step 15 bundles on every `use_figma` call.

| Doc | Purpose |
|-----|---------|
| [`MCP-USE-FIGMA-BUNDLE-MRE.md`](./MCP-USE-FIGMA-BUNDLE-MRE.md) | Minimal reproducible report for maintainers (transport + `fetch` + no team `fileKey`). |
| [`OPTION-D-ACCEPTANCE-CRITERIA.md`](./OPTION-D-ACCEPTANCE-CRITERIA.md) | Security, parity, and error-handling acceptance criteria. |
| [`STEP-15-POST-OPTION-D-VALIDATION.md`](./STEP-15-POST-OPTION-D-VALIDATION.md) | Post-fix validation checklist (designer-supplied `fileKey`, six bundles: Steps 15a–15c + Step 17 Token Overview). |
| [`../RFC-figma-mcp-bundle-transport.md`](../RFC-figma-mcp-bundle-transport.md) | Full RFC + copy-paste issue **Title** and **Body** for trackers. |

## Repo tracking

- [DesignOps-plugin#4](https://github.com/JBabcock-DL/DesignOps-plugin/issues/4) — central tracking; link this folder and the RFC in upstream tickets.

## Maintainer actions (in-repo)

- Track implementation status on [DesignOps-plugin#4](https://github.com/JBabcock-DL/DesignOps-plugin/issues/4).
- After upstream ships `codeWorkspacePath` (or equivalent), run [`STEP-15-POST-OPTION-D-VALIDATION.md`](./STEP-15-POST-OPTION-D-VALIDATION.md) against a **designer-authorized** file (no committed `fileKey`).

## Filing checklist (human)

Duplicate the request where your org routes connector feedback:

1. **Figma** — MCP / `use_figma` tool owners (or official feedback channel).
2. **Cursor** — MCP host / Figma connector (forum or support per current process).

For each ticket:

- **Title:** use the RFC section *Title (either tracker)*.
- **Body:** paste from the RFC fenced block *Body (Figma MCP / Cursor)*, then add links to:
  - RFC: `https://github.com/JBabcock-DL/DesignOps-plugin/blob/main/skills/create-design-system/RFC-figma-mcp-bundle-transport.md`
  - MRE: `https://github.com/JBabcock-DL/DesignOps-plugin/blob/main/skills/create-design-system/upstream/MCP-USE-FIGMA-BUNDLE-MRE.md`
  - Acceptance: `https://github.com/JBabcock-DL/DesignOps-plugin/blob/main/skills/create-design-system/upstream/OPTION-D-ACCEPTANCE-CRITERIA.md`
  - Repo issue: `https://github.com/JBabcock-DL/DesignOps-plugin/issues/4`

**Do not** paste a specific team `fileKey` into public upstream bodies; use “designer-authorized file” language from the MRE.
