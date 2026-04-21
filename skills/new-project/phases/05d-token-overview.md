# Phase 05d — Token Overview skeleton

## Runtime order
Runs **after** Phases 05c and 05b.

## Goal
Draw the Token Overview documentation skeleton on `↳ Token Overview` with `placeholder/{section}` nodes for **`/create-design-system` Step 17** (Token Overview population).

## Prerequisites
- Phases 05, 05c, and 05b complete per orchestrator order.
- Page's `_Header` on `↳ Token Overview` matches the current spec: `y=0`, **height 320**, **`cornerRadius: 0`**, **width 1800**. If `_Header` is missing or from an older version (height 360, cornerRadius 24, or absent), run **Phase 05b first** — this script places `_PageContent` at `y: 320` on the assumption that `_Header` ends exactly at 320 with a square seam.

## Inputs
- **`fileKey`** — the Figma file key.
  - **Fresh run** inside `/new-project`: use the `fileKey` captured in Step 4.
  - **Re-run** outside the orchestrator (fix cycle, plugin-update test, replay): `Read` `templates/agent-handoff.md` for `active_file_key`. If the handoff doc is empty or missing, ask the user to paste the `fileKey` or the full Figma URL (extract the key from `figma.com/design/:fileKey/…`) before continuing.

## Placeholders
None in the script.

## Instructions
Before editing this script or running `use_figma`, **`Read`** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§ A–H). Geometry must match § A; section surfaces, strokes, and doc text fills must follow the **token binding map** (§ C) and the **table hierarchy** (§ H): bind Theme **Light** and Primitives variables where those paths exist, with the script's hex values only as **resolved fallbacks** when a variable is missing. The platform-mapping table inside this page follows the **same § H hierarchy** as style-guide tables — no absolute `x`/`y` positioning. **Do not** apply `Effect/shadow-sm` to `doc/table/token-overview/platform-mapping` or any of its children; the parent `token-overview/platform-mapping` section shell already provides depth.

Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Re-running on a non-empty file (idempotency)
This script **appends** a new `_PageContent` frame to `↳ Token Overview` — it does **not** clean up prior runs. Before re-running on a file that already has Token Overview content (e.g. testing layout changes, or re-invoking after a plugin/skill update), first run a small wipe script with `use_figma` that removes any existing `_PageContent` child (and any deprecated `_Content` frame from older versions):

```javascript
const page = figma.root.children.find(p => p.name === '↳ Token Overview');
await figma.setCurrentPageAsync(page);
const removedNodeIds = [];
for (const c of page.children.filter(c => c.name === '_PageContent' || c.name === '_Content')) {
  removedNodeIds.push(c.id);
  c.remove();
}
return { removedNodeIds };
```

Leave `_Header` in place — Phase 05b owns it.

## Success criteria
`_PageContent` positioned at `y: 320` with a **literal `#FFFFFF`** fill (not token-bound); all sections from the phase script present; amber placeholder strips present; platform-mapping table uses § H auto-layout hierarchy; every text node either carries `textStyleId` (when Doc/* styles exist) or a matching raw-font fallback that `/create-design-system` Step 17 can upgrade.

## Known Figma API gotchas this script must follow
- **`resize()` before sizing modes.** For any frame where `primaryAxisSizingMode` or `counterAxisSizingMode` is `'AUTO'`, call `resize(w, h)` **before** assigning the sizing modes. Calling `resize()` after an `'AUTO'` assignment silently resets that axis to `'FIXED'` — the symptom in this script is a collapsed platform-mapping table `body` (cells render but rows stack inside a 1 px container, so the user sees only the header). Both the table `body` and each table `row` already follow this ordering below; preserve it when editing.
- **Literal white, not bound.** `_PageContent.fills` must be `[{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]`. Do **not** `bindThemeColor(pageContent, 'color/background/default', …)` — the token often resolves to an off-white in Theme · Light and breaks the visual match with the rest of the documentation.
- **Auto-layout all the way down.** Every section shell, table row, and cell is auto-layout. Do not precompute row heights or absolute `x`/`y` positioning for any child of `_PageContent`.
- **Placeholder text nodes are required.** `/create-design-system` Step 17 looks up `placeholder/{section}` by name to know which strips to replace. Do not rename or remove them here.

## Step 5d — Draw Token Overview Skeleton

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `↳ Token Overview` page. Wrap all Token Overview body sections in a `_PageContent` vertical auto-layout frame at `y = 320` (directly beneath `_Header` — zero-gap seam, per `create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` § 3). `_PageContent.fills` must be **literal `#FFFFFF`**, not token-bound. Every section, table, row, and cell is auto-layout — no absolute positioning. Mark every placeholder element with an amber annotation text node named `placeholder/{section}` so that **Step 17** in `/create-design-system` knows which elements to replace with real token values.


> **AGENT ACTION REQUIRED.** The Token Overview draw script has been extracted into a sibling `.figma.js` template to prevent `Read` truncation from silently dropping the claudeSection footer or platform-mapping table.
>
> Script-assembly order for this `use_figma` call:
>
> 1. **`Read`** [`skills/new-project/phases/05d-token-overview.figma.js`](./05d-token-overview.figma.js) **in full** (no `limit`) and use it as the base script.
> 2. **`Read`** [`skills/new-project/phases/_shared-token-helpers.figma.js`](./_shared-token-helpers.figma.js) **in full** (no `limit`) and paste its contents verbatim between the `↓↓↓ INLINE _shared-token-helpers.figma.js HERE ↓↓↓` / `↑↑↑ END` markers inside the base script — the helpers it defines (`bindThemeColor`, `bindPrimColor`, `bindThemeStroke`, `applyDocStyle`, …) are referenced throughout the Token Overview body. A runtime `typeof` assert immediately after the markers throws with an actionable message if they're missed.
> 3. Inline the fully assembled payload into a single `use_figma` call, passing the `fileKey` from Step 4.
>
> Do NOT paraphrase, do NOT truncate, do NOT split across multiple `use_figma` calls. The script walks every section (Primitives → Theme → Typography → Layout → Effects → Code Connect → Claude section) in dependency order; a partial run leaves a half-built skeleton that `/create-design-system` Step 17 will then try to populate.
