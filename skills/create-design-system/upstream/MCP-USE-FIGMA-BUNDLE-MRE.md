# Minimal reproducible report — `use_figma` bundle transport

**Audience:** Figma MCP and Cursor MCP host maintainers.  
**Tracking:** [DesignOps-plugin#4](https://github.com/JBabcock-DL/DesignOps-plugin/issues/4) · [RFC — bundle transport](../RFC-figma-mcp-bundle-transport.md)

## Summary

Agents automating DesignOps **Step 15** (style-guide tables) need to pass **~18–31 KB** of self-contained Plugin API JavaScript per `use_figma` call. The script **fits** the documented `code` character cap (~50 000), but **delivery** of the verbatim bytes through agent + MCP tooling is unreliable. A **file-backed `code` path** (RFC Option D) removes the failure class without changing Figma file semantics.

**Do not hardcode a team `fileKey` in this document.** Use any authorized Figma Design file the designer chooses (`figma.com/design/<fileKey>/…`, or `--file-key` per [`SKILL.md`](../SKILL.md)).

## Symptom

- Step 15 bundles exist as committed **`.min.mcp.js`** files (one per call). See [`../canvas-templates/bundles/README.md`](../canvas-templates/bundles/README.md).
- Automation **fails or flakes** when the full bundle must be copied into the inline `use_figma` → `code` JSON argument (truncation, escaping, or agent “lift” from editor reads / terminal output).

## Reproduction (conceptual)

1. Open a workspace that contains this skill (or the DesignOps plugin install with the same bundle paths under the skill root).
2. Identify **`fileKey`** from a designer-provided Figma URL or CLI flag (not committed here).
3. Attempt to run **five** sequential `use_figma` calls, each with **`code`** set to the **full UTF-8 text** of:
   - `skills/create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js`
   - `skills/create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js`
   - `skills/create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js`
   - `skills/create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js`
   - `skills/create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js`
4. Observe transport failures **before** or **during** tool invocation when the agent relies on:
   - shell `cat` / `type` + copy from capped terminal output, or
   - brittle reconstruction of file contents from chat-sized excerpts.

## Why this is not a “script bug”

- Measured wire sizes stay **under** the `code` cap (see [`../MCP-PAYLOAD-RESEARCH.md`](../MCP-PAYLOAD-RESEARCH.md) §8, §12, and bundle README).
- When the **same bytes** are supplied intact, the Plugin API logic is the intended DesignOps implementation (committed bundles).

## Why `fetch` inside `use_figma` is not a workaround

- The JavaScript executed by `use_figma` runs in a **Figma plugin context** exposed by the MCP server, **not** a full browser.
- **`fetch` is not defined** in that environment; loading bundle bytes from a URL inside the plugin fails.
- Do not assume `atob`, `TextDecoder`, or `clientStorage` stitching without verification — see [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md).

## Requested fix

Implement **RFC Option D**: allow-listed **`codeWorkspacePath`** (or equivalent) so the **host** reads the bundle file as UTF-8 and passes it as today’s `code`. See [OPTION-D-ACCEPTANCE-CRITERIA.md](./OPTION-D-ACCEPTANCE-CRITERIA.md) and [STEP-15-POST-OPTION-D-VALIDATION.md](./STEP-15-POST-OPTION-D-VALIDATION.md).

## References

- [`../RFC-figma-mcp-bundle-transport.md`](../RFC-figma-mcp-bundle-transport.md)
- [`../MCP-PAYLOAD-RESEARCH.md`](../MCP-PAYLOAD-RESEARCH.md) §12–§12.1
- [`../../AGENTS.md`](../../AGENTS.md) — inline payloads; host-first transport
