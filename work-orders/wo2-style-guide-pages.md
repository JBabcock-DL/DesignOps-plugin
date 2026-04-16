# Plan — WO2: Style guide pages with visual variable guides

## Approach

After variables exist in Figma (`/create-design-system` REST push completes), run a **canvas-generation pass** that builds **per-token visual documentation** on the five Style Guide subpages: `↳ Primitives`, `↳ Theme`, `↳ Layout`, `↳ Text Styles`, `↳ Effects`. Each page uses the **WO1 documentation header** pattern first, then content: grids of **swatches / dimension chips / type specimens / shadow previews** bound to variables where the Plugin API allows (colors, floats, strings). Reference layouts from [Theme](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=61196-4197&t=n3aVw4987eltaPJc-1), [Layout](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=61198-1762&t=n3aVw4987eltaPJc-1), [Primitives](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=61196-2859&t=n3aVw4987eltaPJc-1), [Effects](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=61198-4119&t=n3aVw4987eltaPJc-1), [Typography](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=61198-3446&t=n3aVw4987eltaPJc-1) — **design may diverge** where a clearer dev/designer pattern exists, but **headers must stay consistent** with WO1. For `/sync-design-system`, after a successful variable push, invoke a **narrow redraw** that updates only pages whose underlying collections changed (detect via collection names + diff buckets from sync).

## Steps

- [ ] **Step 1 — Content model** — Define a small internal schema: `{ collection, group, variables[], cardTemplate }` mapping Figma variable **paths** to card UI (e.g. Primitives color ramps = grouped rows by ramp; Theme = Light/Dark side-by-side or mode toggle note in description; Typography = one row per slot × property matrix; Layout = spacing ladder + radius chips; Effects = shadow stack previews).
- [ ] **Step 2 — `use_figma` generator** — Implement `redrawStyleGuidePages(fileKey, { collectionsAffected })`: delete prior frames named `style-guide/*` (or update in place) to avoid duplicates; rebuild from live `figma.variables.getLocalVariables()`.
- [ ] **Step 3 — Wire create-design-system** — In `skills/create-design-system/SKILL.md`, after Step 12 verify and Step 13 CSS write, add **new Step** (~16): call `use_figma` with full style guide generation (all five pages). Ensure **figma-use** prerequisite.
- [ ] **Step 4 — Wire sync-design-system** — In `skills/sync-design-system/SKILL.md`, after Step 8 execute / Step 9 confirm, add **Step 9b**: map diff tokens → owning collection; if any token in `Primitives|Theme|Typography|Layout|Effects` changed, call `redrawStyleGuidePages` with that subset; if only unrelated legacy collections changed, skip canvas.
- [ ] **Step 5 — Performance** — Batch operations inside **one** `use_figma` per full redraw; if sync only touches Theme, still safe to regenerate Theme page only (smaller payload) per `collectionsAffected`.
- [ ] **Step 6 — Designer notes** — On each style page, add a short **"For developers"** caption block (text) explaining codeSyntax / `tokens.css` link — optional paragraph, not screenshot-only.

## Build Agents

### Phase 1 (parallel)

- `figma-build` — Steps 1–2: generator script, templates, variable binding.

### Phase 2 (sequential)

- `doc-build` — Steps 3–4: integrate into `create-design-system` and `sync-design-system` SKILLS; document mode behavior (Light default canvas preview + note for Dark).

### Phase 3 (parallel)

- `script-build` — Step 5: optional shared module if duplicate JS is extracted to a template file consumed by the agent (only if repo introduces a shared snippet location).

## Dependencies & Tools

- WO1 complete (doc headers present before content Y-offset; or generator draws header if missing).
- Figma Plugin API variable binding patterns (reuse patterns from `create-component` SKILL `bindColor` / `bindNum`).
- REST variable reads already used in skills; canvas pass is **Plugin API only**.

## Open Questions

1. **Theme page mode preview** — Single canvas mode vs duplicated frames for Light/Dark (recommend **two columns** for at-a-glance dev comparison).
2. **Typography page** — Show **one mode (100)** on canvas with footnote listing other modes, vs mini grid for 85/130/200 (latter is heavy); pick default in build.

## Notes

- `create-design-system` currently ends at Step 15 offer; renumber downstream steps when inserting canvas steps.
- Sync skill currently stops at Step 9; 9b keeps "Confirm completion" semantics—either run redraw before final summary or extend summary with "Style pages refreshed: …".
