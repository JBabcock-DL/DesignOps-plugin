# Phase 05c — Table of Contents layout

## Runtime order
Runs **after** Phase 05 (pages exist) and **before** Phase 05b in the orchestrator.

## Goal
Draw the TOC body inside `_PageContent` on `📝 Table of Contents` as a **single-column stacked list** of full-width section cards, grouped by system band. **Do not** set hyperlinks here (Phase 05f).

## Prerequisites
- Phase 05 complete (pages exist, including `📝 Table of Contents`).
- Page's `_Header` matches the current spec: `y=0`, **height 320**, **`cornerRadius: 0`**, **width 1800**. If `_Header` is missing or from an older version (height 360, cornerRadius 24, or absent), run **Phase 05b first** — this script places `_PageContent` at `y: 320` on the assumption that `_Header` ends exactly at 320 with a square seam.

## Inputs
- **`fileKey`** — the Figma file key.
  - **Fresh run** inside `/new-project`: use the `fileKey` captured in Step 4.
  - **Re-run** outside the orchestrator (fix cycle, plugin-update test, replay): `Read` `templates/agent-handoff.md` for `active_file_key`. If the handoff doc is empty or missing, ask the user to paste the `fileKey` or the full Figma URL (extract the key from `figma.com/design/:fileKey/…`) before continuing.

## Placeholders
None.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

Before editing this script, **`Read`** [`skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) § 3 (canvas geometry) and the `skills/create-design-system/SKILL.md` section **Canvas documentation visual spec** (§ A–G). The TOC renders at the same 1720 inner width as `↳ Token Overview`, uses a **literal `#FFFFFF`** `_PageContent` fill (not the `color/background/default` token — it may resolve to an off-white tint), and follows the same `Doc/*` text-style + shadow-sm rhythm as style-guide pages. Layout is a **single-column stacked list**: the four system "bands" each get a 64-tall strip (`color/background/variant`) followed by a `band-list/{slug}` VERTICAL stack of full-width `toc-card/{title}` section cards (each card spans the full **1720** inner width). Cards use `color/background/default` + `color/border/subtle` + `Effect/shadow-sm`, and every text node either carries `textStyleId` (when Doc/* styles exist) or a raw-font fallback that `/create-design-system` Step 15c § 0 can upgrade.

## Re-running on a non-empty file (idempotency)
This script **appends** a new `_PageContent` frame to `📝 Table of Contents` — it does **not** clean up prior runs. Before re-running on a file that already has TOC content (e.g. testing layout changes, or re-invoking after a plugin/skill update), first run a small wipe script with `use_figma` that targets the page and removes any existing `_PageContent` child:

```javascript
const page = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(page);
const removedNodeIds = [];
for (const c of page.children.filter(c => c.name === '_PageContent')) {
  removedNodeIds.push(c.id);
  c.remove();
}
return { removedNodeIds };
```

Leave `_Header` in place — Phase 05b owns it.

## Success criteria
Four band strips (`band-strip/{slug}`) separating Foundations / Atoms / Components / Platform; under each band a single-column `band-list/{slug}` stack of full-width `toc-card/{title}` section cards (1720 wide each); summary bar at the bottom; no URL hyperlinks yet; `_PageContent` positioned at `y: 320` with a **literal `#FFFFFF`** fill (not token-bound).

## Known Figma API gotchas this script must follow
- **`resize()` before sizing modes.** For any frame where `primaryAxisSizingMode` or `counterAxisSizingMode` is `'AUTO'`, call `resize(w, h)` **before** assigning the sizing modes. Calling `resize()` after an `'AUTO'` assignment silently resets that axis to `'FIXED'` — the symptom is child containers that collapse to 1 px tall and their content renders off the visible area.
- **Literal white, not bound.** `_PageContent.fills` must be `[{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]`. Do **not** `bindThemeColor(pageContent, 'color/background/default', …)` — the token often resolves to an off-white in Theme · Light and breaks the visual match with the rest of the documentation.
- **Auto-layout all the way down.** Every card, strip, and row is auto-layout. Do not precompute `cardHeight` or a running `currentY` — heights hug content.
- **Do not set hyperlinks here.** Phase 05f (`/new-project` Step 5c-links) runs last and owns every TOC link.

## Step 5c — Draw Table of Contents

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `📝 Table of Contents` page. Wrap all TOC body content in a `_PageContent` vertical auto-layout frame at `y = 320` (directly beneath `_Header` once Step 5b runs — zero gap seam, per `create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` § 3). Each system band emits **one** `band-strip/{slug}` followed by **one** `band-list/{slug}` VERTICAL stack of full-width `toc-card/{title}` section cards — no 2-column grid. Section cards, rows, and strips are all auto-layout so heights hug content — do not precompute `cardHeight` or a running `currentY`. **Do not** set hyperlinks here; Step **5c-links** (phase 05f) runs after Steps 5b, 5d, and 5e.


> **AGENT ACTION REQUIRED.** The Table of Contents draw script has been extracted into a sibling `.figma.js` template for consistency with the `/new-project` Phase 05d and `/create-component` extractions (both done to prevent `Read` truncation from silently dropping code mid-file).
>
> Script-assembly order for this `use_figma` call:
>
> 1. **`Read`** [`skills/new-project/phases/05c-table-of-contents.figma.js`](./05c-table-of-contents.figma.js) **in full** (no `limit`) and use it as the base script.
> 2. **`Read`** [`skills/new-project/phases/_shared-token-helpers.figma.js`](./_shared-token-helpers.figma.js) **in full** (no `limit`) and paste its contents verbatim between the `↓↓↓ INLINE _shared-token-helpers.figma.js HERE ↓↓↓` / `↑↑↑ END` markers inside the base script. A runtime `typeof` assert after the markers throws an actionable error if the shared helpers were not inlined.
> 3. Inline the fully assembled payload into a single `use_figma` call, passing the `fileKey` from Step 4.
>
> Do NOT paraphrase, do NOT truncate. Hyperlinks are wired later in Phase 05f (`toc-hyperlinks`) — this phase only draws the bands and section cards.
