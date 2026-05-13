# Phase 06b — Foundations shell (Tier 3)

## Goal

After **Step 11 close** (Doc/* text styles + Effect/shadow-* published) and **before** Phase 07 canvas (Step 15a), run **one** mutating `use_figma` that:

1. Ensures **`_DesignOpsRegistry`** `FRAME` exists on **`Documentation components`** (off-canvas) and writes **`labs.designops/collectionRegistry`** JSON (`primitives`, `theme`, `typography`, `layout`, `effects` → collection ids).
2. For each entry in [`designops-foundations-shell.json`](../../shared/designops-foundations-shell.json) `shellPages`: finds or creates the `PAGE`, sets **`labs.designops/pageSlug`**, places **`_Header`** instance when missing, sets title/description from manifest.
3. Stamps **`labs.designops/pageSlug` = `token-overview`** on **`↳ Token Overview`** when that page exists and has no slug yet (helps Step 17 runner).
4. Wires **TOC URL hyperlinks** for every `toc-link/*` row on **`📝 Table of Contents`** (same behavior as [`../../new-project/phases/05f-toc-hyperlinks.md`](../../new-project/phases/05f-toc-hyperlinks.md)) — requires `FILE_KEY` in the script.

## Prerequisites

- `/new-project` completed through **05b** (`_Header` master on `Documentation components`) and **05c** (TOC rows include the five style-guide link rows; 05f skipped missing destinations until now).
- `/create-design-system` **Step 11** complete including **Step 11 close** (see [`04-step11-push.md`](./04-step11-push.md)).
- Optional: run [`preflight-snapshot.md`](./preflight-snapshot.md) read-only probe first; if `axisC.docCorePresent` or `axisC.effectShadowPresent` is false, finish Step 11 close before this shell.

## Assembly (single `use_figma`)

1. Load **figma-use** if required.
2. `const FILE_KEY = '<same key as use_figma fileKey>';` — required for TOC hyperlinks.
3. Optionally `const MANIFEST_VERSION_EMBED = '2026-05-13';` (match [`designops-foundations-shell.json`](../../shared/designops-foundations-shell.json) `manifestVersion`).
4. **`Read`** [`foundations-shell.figma.js`](./foundations-shell.figma.js) in full and paste as the script body (it embeds `MANIFEST.shellPages`; keep in sync with the JSON file when editing — repo CI runs `npm run qa:foundations-shell-manifest`).

**No** `_shared-token-helpers` inlay is required for the default shell — header instances clone the existing `_Header` master from Phase 05b.

## Success criteria

- Return JSON includes `ok: true`, `createdCount`, `stampedCount`, `headersPlaced`, `linksSet`, `registryKeys`.
- Second run on the same file: `createdCount === 0` (idempotent).

## Failure modes

- **`_Header` master missing** — re-run `/new-project` Phase 05b.
- **Ambiguous legacy page match** — resolve duplicate page names in Figma, then re-run.

## Payload size

If the host hits MCP limits, split into two calls: (1) registry + pages + headers only, (2) TOC hyperlinks only — second script needs `FILE_KEY` only.
