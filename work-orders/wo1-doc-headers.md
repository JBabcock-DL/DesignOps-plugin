# Plan — WO1: Documentation headers on every scaffolded page

## Approach

Extend `/new-project` so the post–page-creation `use_figma` pass builds **documentation chrome** on every real content page: a reusable header (title + usage description) aligned to the Foundations Agent Kit pattern. Source of truth for layout, typography, and spacing is the **Documentation components** page in the reference file; the skill duplicates that structure programmatically (components instantiated from definitions in-page or recreated as frames) so **no page is skipped**—including section dividers only where we intentionally document the divider itself, and **all Brand Assets** subpages. Implement as **one `use_figma` invocation** after pages exist: loop `figma.root.children`, skip non-documentable pages only if explicitly listed in Notes, otherwise append the doc block at a stable Y offset below any future content region.

## Steps

- [ ] **Step 1 — Reference audit** — Open [Foundations Agent Kit — doc example](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=60884-14291&t=n3aVw4987eltaPJc-1) and [Documentation components](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=4011-843&t=n3aVw4987eltaPJc-1); record frame names, auto-layout, text roles (title vs body), and token bindings used on the black DL header.
- [ ] **Step 2 — Doc component primitives in-plugin** — In the same `use_figma` script as page loop, ensure a **"Documentation components"** page exists (already in `pages[]`); create or update local **Component** / **ComponentSet** nodes for `Doc/PageHeader` (and subparts if needed: title, description) matching the reference **pixel- and structure-fidelity** (not a loose approximation).
- [ ] **Step 3 — Page → copy map** — Maintain a `PAGE_DOC_COPY` structure keyed by exact page name strings from `skills/new-project/SKILL.md` Step 5 `pages` array: each entry `{ title, description }` describing **intended usage** of that page (meaningful subtitles for every `↳` page, section headers for `---` rows if we document them, Thumbnail/MCP/TOC copy as specified in WO4–WO6 where those WOs own text—WO1 only supplies placeholder or cross-reference text if another WO overwrites later).
- [ ] **Step 4 — Placement rules** — For each `PageNode`: create a top-level frame (e.g. `doc-header/{page.name}`) at `(0,0)` or consistent grid origin; set `layoutGrow` / fixed width to match file default frame width pattern from reference; lock layer order so headers sit **above** blank workspace.
- [ ] **Step 5 — Exclusions** — Confirm behavior for `---` separator pages: either **minimal doc strip** ("Section divider — no canvas content") or full header—**product decision** in Open Questions; default per user request: **no exceptions** → include a header on `---` pages too.
- [ ] **Step 6 — Skill update** — Edit `skills/new-project/SKILL.md`: add **Step 5b** (or extend Step 5 code block) documenting the loop + map + single `use_figma` requirement; link to reference URLs.
- [ ] **Step 7 — Regression checklist** — New file from `/new-project`: verify every page name in the array has a doc header instance; spot-check Brand Assets and **Documentation components** page itself (self-documenting).

## Build Agents

### Phase 1 (parallel)

- `figma-build` — Steps 1–5: implement `use_figma` script, `PAGE_DOC_COPY`, component primitives, placement.

### Phase 2 (sequential)

- `doc-build` — Step 6: SKILL.md updates, cross-links, exclusion policy text.
- `code-build` — Step 7: if any shared JSON map lives in repo (optional), add minimal fixture for copy.

## Dependencies & Tools

- Figma MCP: `use_figma` (must load **figma-use** skill before any `use_figma` call per project rules).
- Reference file key: `rJQsr4aou5yjzUhaEM0I2f` (read-only visual reference).
- Target skill file: `skills/new-project/SKILL.md`.

## Open Questions

1. **`---` separator pages** — Full doc header with title "—" or a slim variant; user asked for **no exceptions**; recommend full header with copy: "Visual separator between sections in the page list."
2. **`parking lot` / `Grids`** — Confirm same header treatment as other utility pages (assumed yes).

## Notes

- Claude’s summary ("single use_figma call with a loop") matches the **create-component** isolation rule; keep all page iteration inside **one** plugin session.
- WO4–WO6 may replace body text on TOC / Token Overview / Thumbnail; WO1 should still place the **chrome** so pages are never empty of documentation structure.
