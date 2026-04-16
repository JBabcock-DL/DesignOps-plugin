# Plan — WO4: Table of Contents page with linked page index

## Approach

On `/new-project`, after pages and WO1 documentation chrome exist, populate **`📝 Table of Contents`** with a **two-column auto-layout grid** of section cards. Each card lists pages in that section with **clickable navigation** to the target page. Figma does not expose true hyperlinks between pages in all clients; implement **documented pattern**: use **prototype links** where supported, and/or name child frames `toc-link/{Page Name}` plus instructions in SKILL for designers; for **agents**, rely on **stable frame names** and `setCurrentPageAsync` in scripts. Visual styling uses **WO1 documentation components** only (no ad-hoc styles).

## Steps

- [ ] **Step 1 — Section grouping** — Derive groups from the existing `pages[]` array in `skills/new-project/SKILL.md`: segments start at each `---` title row (emoji section titles) and include subsequent `↳` entries until next `---`.
- [ ] **Step 2 — Card grid** — `use_figma`: for each section, create a card frame (title = section name, body = vertical list of rows). Each row: page display name + chevron; attach **navigation action** per Figma capabilities research in Step 3.
- [ ] **Step 3 — Linking strategy** — Spike in reference file or Figma docs: use `Reaction` / prototype `NAVIGATE_TO` if available in Plugin API for internal page navigation; if not available, embed **"Go" button** components triggering plugin-only message is **not** acceptable—fallback: **hyperlink text** to Figma URL with `pageId` query if generatable, else document manual navigation.
- [ ] **Step 4 — Layer naming convention** — Each interactive control named `toc-link/{exact page name as in pages[]}` for grep/agent discovery.
- [ ] **Step 5 — SKILL update** — Add **Step 5c** to `skills/new-project/SKILL.md` after doc headers (5b): TOC build inside same or second `use_figma` call; if two calls required for MCP limits, document order: pages → headers → TOC.
- [ ] **Step 6 — Validation** — Every non-separator page appears exactly once; `---` rows excluded from links; `Thumbnail` included if desired (Open Question).

## Build Agents

### Phase 1 (parallel)

- `figma-build` — Steps 1–4: TOC layout + naming + linking spike implementation.

### Phase 2 (sequential)

- `doc-build` — Step 5–6: SKILL integration + validation checklist.

## Dependencies & Tools

- WO1 documentation components.
- Figma Plugin API for reactions/navigation (confirm version availability).

## Open Questions

1. **Thumbnail page** — List in TOC or exclude as meta page?
2. **Single vs dual `use_figma`** — Prefer single call with WO1 if performance allows.

## Notes

- User asked for links to **each subsequent** page; interpret as all scaffolded content pages except pure `---` dividers.
