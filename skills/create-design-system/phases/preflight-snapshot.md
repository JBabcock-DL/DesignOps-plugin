# Pre-flight snapshot (read-only)

## Goal

Return a single JSON object describing **pages** (names + `labs.designops/pageSlug` + `_Header` presence), **variable collections**, **collection registry** frame (if present), and **axis C** documentation-style gates — **no** creates, **no** `setPluginData` writes. Used before Foundations shell and before canvas Step 15a per [`conventions/foundations-shell-and-preflight.md`](../conventions/foundations-shell-and-preflight.md).

## When to run

- After `/create-design-system` **Step 4** (variable registry read).
- Immediately before **Phase 06b** Foundations shell `use_figma`.
- Before first `Task` → `canvas-bundle-runner` for Step 15a (parent may re-run if unsure).

## Assembly (MCP `use_figma`)

1. Load **figma-use** if your host requires it.
2. Set `const FILE_KEY = '<fileKey>';` (echo only).
3. Optionally set `const MANIFEST_VERSION_EMBED = '<manifestVersion from designops-foundations-shell.json>';` for traceability.
4. **`Read`** [`preflight-snapshot.figma.js`](./preflight-snapshot.figma.js) in full (no `limit`) and paste **verbatim** after those constants.
5. One `use_figma` with `fileKey` + assembled `code`. Post the returned JSON summary to the designer (counts + `shellCandidateBranch` + `warnings`).

## Success criteria

- `schemaVersion === 1`.
- `axisC` booleans reflect whether Step 11 close has run (Doc/* + Effect styles + typography heuristic).
- Interpret `shellCandidateBranch`: if **`blocked_ambiguous`**, stop and reconcile duplicate pages / registry JSON before Phase 06b or canvas 15a (see [`conventions/foundations-shell-and-preflight.md`](../conventions/foundations-shell-and-preflight.md) warning table).

## Failure modes

If `figma.getLocalTextStylesAsync` throws, catch and set `warnings: ['text_styles_error']` — still return `pages` + `collections` when possible.
