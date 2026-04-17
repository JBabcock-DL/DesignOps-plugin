# Plan — WO7: Icons — shadcn catalog + core Figma vectors

## Approach

**Part A — shadcn:** Audit whether `shadcn/ui` registry exposes **app icon** components (unlikely as first-class `npx shadcn add` entries). Update `skills/create-component/SKILL.md` **Supported Components** list to include any official icon package guidance (e.g. **lucide-react** pairing) and document **`npx shadcn@latest add`** for icon-related primitives if the registry adds them later.

**Part B — Figma library:** During **`/create-design-system`**, after variables verified, draw a **Core Icons** section (suggested page: `↳ Icons` under Brand Assets **or** dedicated subframe on Brand page per existing IA) with **~60–80 common icons** as **VECTOR** nodes (24px keyline), grouped by category (Arrows, Navigation, Actions, Content, Status, Editor, Media, Alerts). **Lucide** is default: ship **static path data** inline in the SKILL or a compact JSON asset in-repo to avoid runtime network fetches inside Figma plugin. Icons must use **Theme** strokes/fills bound where possible.

**Part C — Code parity:** Add **lucide-react** dependency recommendation in SKILL when icons are generated; map a subset used in `create-component` UI placeholders (e.g. button icon variant) to Lucide component names.

## Steps

- [ ] **Step 1 — shadcn audit** — Run web/registry check or read `shadcn` docs (2026) for `icon`, `lucide`, or app-icon blocks; record outcome in Notes.
- [ ] **Step 2 — SKILL list update** — Edit `skills/create-component/SKILL.md`: new subsection **Icons** — explain Lucide is the default icon system for shadcn v3; installation `npm i lucide-react`; no faux `shadcn add icon` if unsupported.
- [ ] **Step 3 — Path sourcing** — Choose Lucide icons list (arrows: ChevronLeft/Right/Up/Down, ChevronsUpDown; actions: X, Check, Plus, Minus; …) **~68**; acquire SVG paths → convert to Figma `vectorPaths` or use boolean ops—prefer **precomputed** `vectorNetwork` snippets validated once in Figma.
- [ ] **Step 4 — `use_figma` drawer** — New `create-design-system` step (~20): place icons in grid `brand/icons/core-{category}`; apply `Layout/space/*` grid; bind stroke to `color/background/fg` as appropriate on light preview frame.
- [ ] **Step 5 — Sync behavior** — Icon geometry static; **recolor only** when brand neutrals shift post-sync (optional light `use_figma` pass if Theme fg changes—low priority).
- [ ] **Step 6 — Accessibility** — Text note on page: "Icons are strokes; minimum 16px touch target in product" aligned with DL guidance.

## Build Agents

### Phase 1 (parallel)

- `research` — Step 1: shadcn + lucide relationship confirmation.
- `code-build` — Step 3: maintain `icons/lucide-paths.json` (optional) if not embedding in SKILL.

### Phase 2 (sequential)

- `figma-build` — Step 4–6: generator + page layout.
- `doc-build` — Steps 2 + SKILL updates for `create-design-system` step list.

## Dependencies & Tools

- Lucide license (MIT) compatible.
- WO1 doc header on `↳ Icons` page.
- figma-use + `use_figma`.

## Open Questions

1. **Icon page vs Brand** — User SKILL already has `↳ Icons` page; use it as the canvas target (recommended).
2. **Duplication with future real icon set** — If the team imports a commercial icon font later, this grid becomes reference-only; document that in Notes.

## Notes

- Claude’s earlier note (~68 icons / 7 categories) is acceptable scope; adjust counts to fit maintainability **without** losing core coverage (arrow, close, check, menu, search, user, settings, alert).
