# Plan — WO6: Cover frame and file thumbnail

## Approach

Implement a **branded cover** on the **`Thumbnail`** page matching the spirit of [Foundations Agent Kit thumbnail](https://www.figma.com/design/rJQsr4aou5yjzUhaEM0I2f/Foundations-Agent-Kit?node-id=57-103&t=n3aVw4987eltaPJc-1): gradient background, **large project name** (~120px optical), **two status chips** (e.g. platform + "Foundations"), **Detroit Labs mark** (four-square icon). On scaffold (`/new-project`), draw the cover with **neutral placeholder brand colors**; after **`/create-design-system`**, update fills/gradient stops from **primary/secondary** Theme or Primitive tokens and refresh typography from Typography variables. Call **`figma.setFileThumbnailNodeAsync(coverFrame)`** (or current Plugin API equivalent) so the file thumbnail matches the cover frame.

## Steps

- [ ] **Step 1 — Reference measurements** — Capture frame size (1920×1080 vs Figma default), padding, gradient angle/stops, chip radii, icon size from reference (manual in Figma).
- [ ] **Step 2 — `new-project` pass** — In `use_figma` after pages: navigate to `Thumbnail`; create `cover/thumbnail-root` frame; bind where possible to Layout spacing; text: `{Project Name}` from closure passed into script context (inject via string template from MCP host).
- [ ] **Step 3 — Thumbnail API** — After frame creation, set file thumbnail node to that frame; handle permission errors gracefully with user message.
- [ ] **Step 4 — `create-design-system` refresh** — New step (~19): `use_figma` to recolor gradient, chips, and wordmark contrast using Theme/Primitives; update project name if handoff name differs; re-apply `setFileThumbnailNodeAsync`.
- [ ] **Step 5 — `sync-design-system`** — If sync changes brand colors in Primitives/Theme, optionally trigger same refresh step (shared helper with WO2 page subset metadata).

## Build Agents

### Phase 1 (parallel)

- `figma-build` — Steps 1–3: scaffold cover + thumbnail API.

### Phase 2 (sequential)

- `figma-build` — Step 4–5: brand refresh hooks in create/sync SKILLS.

### Phase 3 (parallel)

- `doc-build` — SKILL.md updates + troubleshooting table (API not available on plan tier).

## Dependencies & Tools

- WO1 doc header on Thumbnail page? (Thumbnail may use **cover only** without duplicate header—confirm; user asked cover as thumbnail, not necessarily duplicate doc header on Thumbnail—resolve in Open Questions.)
- Figma Plugin API: `setFileThumbnailNodeAsync`.

## Open Questions

1. **WO1 on Thumbnail** — User said every page; cover might **be** the documentation for Thumbnail—use single merged frame or header + cover stack?
2. **DL mark asset** — Vector drawn in-plugin vs embedded SVG path string in SKILL (prefer minimal inline vector).

## Notes

- Ensure thumbnail update runs **once** per workflow to avoid rate limits (if any).
