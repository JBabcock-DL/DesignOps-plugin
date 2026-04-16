# Plan — WO3: MCP Tokens page — machine-readable token manifest

## Approach

Add a dedicated canvas artifact on **`↳ MCP Tokens`**: a top-level frame (e.g. `[MCP] Token Manifest`) containing (1) a **structured table** (auto-layout rows: collection, name, modes, WEB / ANDROID / iOS codeSyntax, resolved value summary) and (2) a **single TEXT node** holding **minified JSON** of the full variable registry subset needed by agents (`get_design_context` / copy-paste friendly). The JSON is the **canonical machine-readable** export; the table is human-audit. Generate on **`/create-design-system`** completion (same session or chained `use_figma` after REST verify) and **regenerate on `/sync-design-system`** after any variable write, always replacing the previous manifest nodes by stable name/id strategy.

## Steps

- [ ] **Step 1 — JSON schema** — Define versioned JSON: `{ "version": 1, "fileKey", "generatedAt", "variables": [ { "id", "name", "collection", "resolvedType", "modes": { modeName: value }, "codeSyntax": { "WEB","ANDROID","iOS" } } ] }`. Value serialization: colors as `#RRGGBB` or `rgba()`, floats as numbers, aliases as `{ "aliasOf": "path" }` resolved for agent clarity.
- [ ] **Step 2 — REST fetch reuse** — Reuse the same GET `/variables/local` response already parsed in `create-design-system` / `sync-design-system`; transform to schema in the agent, then pass string into `use_figma` as a literal or chunk if size limits—if too large, split into **multiple text nodes** `manifest-chunk-0..N` with a small index header (document chunking rules in SKILL).
- [ ] **Step 3 — Table layout** — Build auto-layout table frame with monospace-friendly text; column widths fixed; row height consistent; bind color swatches where row is COLOR type.
- [ ] **Step 4 — Page placement** — Navigate to `↳ MCP Tokens`; place manifest frame under WO1 doc header; name layers predictably (`mcp-tokens/manifest-json`, `mcp-tokens/table`).
- [ ] **Step 5 — create-design-system** — Add post-verify step (~17): build manifest from latest GET; `use_figma` write.
- [ ] **Step 6 — sync-design-system** — After any successful variable PUT from Options 1–4, run manifest rebuild (Step **9b** alongside or after WO2 style refresh); if sync reports zero token changes, skip manifest rewrite.

## Build Agents

### Phase 1 (parallel)

- `api-build` — Step 1–2: schema + transform from Figma variables API payload.
- `figma-build` — Step 3–4: table + text nodes, chunking strategy.

### Phase 2 (sequential)

- `doc-build` — Steps 5–6: SKILL.md updates for both skills, error handling (empty collections).

## Dependencies & Tools

- Figma Variables REST GET (existing MCP / connector).
- `use_figma` + figma-use skill.
- WO1 header frame ordering (manifest sits below header).

## Open Questions

1. **Payload size** — Figma `characters` max length per TEXT node; measure manifest size for default DS; implement chunking threshold (e.g. >25k chars).
2. **Secrets** — Confirm no non-variable data in JSON (should be none).

## Notes

- Goal: agents **never** need to OCR screenshots for token lists.
- Consider adding `tokens.css` path echo in JSON `meta` from handoff for cross-linking.
