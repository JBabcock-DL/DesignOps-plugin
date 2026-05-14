# Phase 06b — Foundations shell (Tier 3)

## Goal

After **Step 11 close** (Doc/* text styles + Effect/shadow-* published) and **before** Phase 07 canvas (Step 15a), run **one** mutating `use_figma` that:

1. Ensures **`_DesignOpsRegistry`** `FRAME` exists on **`Documentation components`** (off-canvas) and writes **`labs.designops/collectionRegistry`** JSON (`primitives`, `theme`, `typography`, `layout`, `effects` → collection ids).
2. For each entry in [`designops-foundations-shell.json`](../../shared/designops-foundations-shell.json) `shellPages`: finds or creates the `PAGE`, sets **`labs.designops/pageSlug`**, places **`_Header`** instance when missing, sets title/description from manifest.
3. Stamps **`labs.designops/pageSlug` = `token-overview`** on **`↳ Token Overview`** when that page exists and has no slug yet (helps Step 17 runner).
4. Wires **TOC URL hyperlinks** for every `toc-link/*` row on **`📝 Table of Contents`** (same behavior as [`../../new-project/phases/05f-toc-hyperlinks.md`](../../new-project/phases/05f-toc-hyperlinks.md)) — requires `FILE_KEY` in the script.

## Prerequisites

- **Ideal:** `/new-project` through **05b** (`_Header` master on `Documentation components`) and **05c** (TOC rows include the five style-guide link rows; 05f skipped missing destinations until now).
- **Custom / migrated files:** If there is no `_Header` `COMPONENT` on `Documentation components`, the shell still completes items 1, 3, and 4 and returns `headerMasterMissing: true` (see **Missing `_Header` master** below) — do not treat that return as a thrown error.
- `/create-design-system` **Step 11** complete including **Step 11 close** (see [`04-step11-push.md`](./04-step11-push.md)).
- Optional: run [`preflight-snapshot.md`](./preflight-snapshot.md) read-only probe first; if `axisC.docCorePresent` or `axisC.effectShadowPresent` is false, finish Step 11 close before this shell.

## Assembly (single `use_figma`)

1. Load **figma-use** if required.
2. `const FILE_KEY = '<same key as use_figma fileKey>';` — required for TOC hyperlinks.
3. Optionally `const MANIFEST_VERSION_EMBED = '2026-05-13';` (match [`designops-foundations-shell.json`](../../shared/designops-foundations-shell.json) `manifestVersion`).
4. **`Read`** [`foundations-shell.figma.js`](./foundations-shell.figma.js) in full and paste as the script body (it embeds `MANIFEST.shellPages`; keep in sync with the JSON file when editing — repo CI runs `npm run qa:foundations-shell-manifest`).

**No** `_shared-token-helpers` inlay is required for the default shell — header instances clone the existing `_Header` master from Phase 05b when that master exists.

## Success criteria

- Return JSON includes `ok: true`, `createdCount`, `stampedCount`, `headersPlaced`, `linksSet`, `registryKeys`, and boolean `headerMasterMissing` (`false` when a `_Header` `COMPONENT` was found on `Documentation components`).
- Second run on the same file: `createdCount === 0` (idempotent).

## Missing `_Header` master — `AskUserQuestion` (parent only)

`use_figma` cannot prompt the designer. After the shell returns, if **`headerMasterMissing` is `true`**:

1. Fire **one `AskUserQuestion`** with exactly these options (labels may shorten; meanings must match):

- **Build documentation header** — Run **`/new-project` Phase 05b** as written in [`skills/new-project/phases/05b-documentation-headers.md`](../../new-project/phases/05b-documentation-headers.md): inline [`_shared-token-helpers.figma.js`](../../new-project/phases/_shared-token-helpers.figma.js) between the markers, one `use_figma` with the file key. That phase creates the real shared `_Header` (1800×320, `cornerRadius: 0`, bound fill, logo + wordmark + `_title` / `_description` per spec) and places instances site-wide. **Then re-run Phase 06b** (same assembly as above) so the five style-guide pages get manifest title/description overrides and any remaining shell work stays idempotent.

- **Skip** — Continue to Phase 07 without building a header in this turn. Style-guide canvas (Step 15a+) expects an `_Header` instance at `(0,0)` on each leaf page; missing chrome can cause asserts or thin layout until 05b + 06b are done later.

- **Stop** — End the skill run; designer fixes the file manually (e.g. copies `_Header` from a Foundations template), then re-runs `/create-design-system` from Phase 06b.

2. Do **not** invent a substitute “minimal” header inside `foundations-shell.figma.js` — the only automated **build** path is Phase **05b** above.

## Failure modes

- **Ambiguous legacy page match** — resolve duplicate page names in Figma, then re-run.

## Payload size

If the host hits MCP limits, split into two calls: (1) registry + pages + headers only, (2) TOC hyperlinks only — second script needs `FILE_KEY` only.
