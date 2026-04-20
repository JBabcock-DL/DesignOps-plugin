# Withdrawn: Figma MCP bundle transport RFC

**Status:** Withdrawn (April 2026). Do **not** treat file-backed `code`, `codeWorkspacePath`, or similar as a supported or “preferred” path in this repo.

**Why:** The shipping Figma MCP `use_figma` tool accepts **only** an inline **`code`** string (JSON Schema cap ~50 000 characters). Cursor’s connector does **not** expose `codeFile`, `codeWorkspacePath`, or any host indirection in the tool schema. Documenting a file-backed happy path misleads agents.

**What works instead:** Use editor **`Read`** on the committed [`.min.mcp.js` bundles](./canvas-templates/bundles/) and pass the file contents **verbatim** as `use_figma` → `code`. Do **not** use shell `cat` / `type` of the full bundle as the source of truth (stdout/UI truncation). Detail: [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md), [`conventions/17-table-redraw-runbook.md`](./conventions/17-table-redraw-runbook.md), [`AGENTS.md`](../../AGENTS.md).

**Historical note:** [DesignOps-plugin#4](https://github.com/JBabcock-DL/DesignOps-plugin/issues/4) tracked an upstream feature ask; this repository no longer maintains copy-paste RFC bodies for that approach here. Close or repurpose that issue if the team is not pursuing platform changes.
