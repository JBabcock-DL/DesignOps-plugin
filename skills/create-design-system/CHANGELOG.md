# `/create-design-system` — Incident history

Preserved historical context for gotcha rules in [`conventions/00-gotchas.md`](./conventions/00-gotchas.md). **Not a runtime read** — kept for future debugging only.

---

## 2026 — Tier 3 Foundations shell (deferred style-guide pages + stable refs)

**Change:** `/new-project` Step 5 no longer creates the five style-guide leaf `PAGE`s; they are created (or legacy-matched) by **`/create-design-system`** after variables + Step 11 close via [`phases/06b-foundations-shell.md`](./phases/06b-foundations-shell.md). [`designops-foundations-shell.json`](../shared/designops-foundations-shell.json) + `pluginData` page slugs + [`_DesignOpsRegistry`](./conventions/foundations-shell-and-preflight.md) collection ids; canvas runners use [`_lib.js`](./canvas-templates/_lib.js) `findDesignOpsPage` / `readDesignOpsCollectionRegistry` / `resolveCollectionByLogicalKey`. Read-only probe: [`phases/preflight-snapshot.md`](./phases/preflight-snapshot.md). **Spec polish:** pre-flight emits `blocked_ambiguous` + `duplicate_legacy_match:` for ambiguous display-title collisions; `npm run qa:foundations-shell-manifest` keeps embedded `MANIFEST` aligned with the JSON file.

---

## 2026 — Text Styles canvas: SPECIMEN audit, variableMap authority, fonts

**Observed:** Agents running on existing files sometimes saw Typography table specimens without the row’s published `textStyleId`, or wrong variable bindings when a stale host `ctx.variableMap` was merged.

**Fix:** [`canvas-templates/_lib.js`](./canvas-templates/_lib.js) always rebuilds `variableMap` from `getLocalVariablesAsync()`; [`loadFontsForTextStyles`](./canvas-templates/_lib.js) + runner pre-load slot fonts; [`text-styles.js`](./canvas-templates/text-styles.js) names `cell/*` / `text/specimen`, applies §0.5 text pipeline order, and [`_step15c-text-styles-runner.fragment.js`](./canvas-templates/bundles/_step15c-text-styles-runner.fragment.js) post-audits specimens and returns `ok: false` when counts fail. §14 + [`10-column-spec.md`](./conventions/10-column-spec.md) updated.

---

## 2026 — MCP audit: header cells reusing body recipe (→ §0.5)

**Observed (MCP diff):**
- Good table — [`testingUpdates — Foundations`](https://www.figma.com/design/BLcvn6UptGIgtNzNfLU4TU/testingUpdates-%E2%80%94-Foundations?node-id=204-7): `doc/table/.../header/cell/*` as `layoutMode: 'HORIZONTAL'`, `primaryAxisSizingMode: 'FIXED'`, `counterAxisSizingMode: 'FIXED'`, explicit `resize(colWidth, headerHeight)` **before** text, header text with `textAutoResize: 'HEIGHT'`.
- Broken run — [`v44-updates — Foundations`](https://www.figma.com/design/uCpQaRsW4oiXW3DsC6cLZm/v44-updates-%E2%80%94-Foundations?node-id=106-10): reused body rules (`VERTICAL` + primary `AUTO` + `resize(colWidth, 1)` while text was still `'NONE'`) for header cells → every header cell height stuck at 1px while the header row stayed ~56px tall. Unreadable chrome.

Fix captured in §0.5.

---

## 2026 — MCP audit: Primitives swatches missing variable binding (→ §0.7)

**Observed (same v44 file):** every `RECTANGLE` under `doc/table/primitives/color/.../cell/swatch` (or `.../cell/SWATCH`) had a plain `SOLID` fill with no `boundVariables.color`. Chips resolved to static hex and did not track token edits — a hard fail for a variables-first style guide.

Golden file: `figma.variables.setBoundVariableForPaint` on `fills[0]` to the `Primitives` variable whose `name` equals the row token path. Clone paint, call setter, **reassign** the return value to `rect.fills`.

Fix captured in §0.7. Audit gate in [`conventions/14-audit.md`](./conventions/14-audit.md).

---

## 2026 — MCP / audit-style pass: TOC band-strip text collapsed by blanket §0.2 (→ §0.8)

**Observed:** a script walked every TEXT under `📝 Table of Contents` → `_PageContent` and applied §0.2 using `text.resize(parent.width - parent.paddingLeft - parent.paddingRight, 1)`. For TEXT whose `parent.name` matched `^band-strip/` (but not `…/title-stack`), the parent is the 64px HORIZONTAL strip (`SPACE_BETWEEN`, width 1720, padding 24). Formula yielded **1720 − 48 = 1672** — same number as `CARD_INNER` in [`skills/new-project/phases/05c-table-of-contents.md`](../new-project/phases/05c-table-of-contents.md) but **wrong here**: forced the right-aligned `Doc/Code` `N sections · M pages` count chip into a 1672-wide rail, collapsing the strip.

Fix captured in §0.8: carve out `band-strip/*` TEXT, keep `textAutoResize: 'WIDTH_AND_HEIGHT'` so the chip hugs its string width.

---

## 2026 — Token Overview platform-mapping double-elevated (→ §0.9)

**Observed:** `/create-design-system` Step 17 shadow pre-pass used prefix match `doc/table/token-overview/` and applied `Effect/shadow-sm` to the inner `platform-mapping` table plus its `header` / `body` / `row/*` / `cell/*` descendants. Section shell `token-overview/platform-mapping` already carried `shadow-sm` → block rendered double-lit.

Fix captured in §0.9: pre-pass excludes `doc/table/token-overview/platform-mapping` and all descendants. Style-guide tables on other pages keep the single `shadow-sm` on `doc/table/{slug}` root per §§12/13.
