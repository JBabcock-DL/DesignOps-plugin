# Plan — WO5: Token Overview page — designer-facing "readme"

## Approach

Treat **`↳ Token Overview`** as the **human onboarding surface** for the design system: a visual readme (frames + text + simple diagrams) explaining **token architecture** (Primitives → Theme/Typography/Layout/Effects), **platform mapping via codeSyntax**, **Light/Dark** and **typography scale modes**, **how to bind variables in Figma**, and **how to use Claude** with the repo skills (`/new-project`, `/create-design-system`, `/sync-design-system`, `/create-component`). WO1 supplies the header early; WO5 splits **skeleton vs populate**: `/new-project` lays out empty placeholder frames with section titles; **`/create-design-system`** fills content after tokens exist (so examples can bind to real variables).

## Steps

- [ ] **Step 1 — Outline content** — Five sections: (A) Architecture flow diagram, (B) Platform mapping table (WEB/ANDROID/iOS columns), (C) Dark mode + font scale guide, (D) How to bind variables in Figma UI, (E) Claude command reference (copy-paste prompts).
- [ ] **Step 2 — Skeleton (`new-project`)** — `use_figma`: create labeled placeholder frames under doc header: `token-overview/architecture`, `/platform-table`, `/modes`, `/binding`, `/claude` with lorem short hints only.
- [ ] **Step 3 — Populate (`create-design-system`)** — New step (~18): replace placeholders with real diagrams: use **connected lines** or simplified auto-layout "flow" frames; mapping table filled from **actual codeSyntax** rows (subset + "see MCP Tokens page"); mode section shows Typography mode names `85`–`200`; binding section uses screenshots-as-frames **optional**—prefer **native Figma UI callouts** (numbered steps).
- [ ] **Step 4 — Variable-bound examples** — Small demo swatches using `color/primary/default`, `space/md`, etc., to prove bindings.
- [ ] **Step 5 — Sync updates** — On `/sync-design-system` after variable changes, re-run **only** sections B/C/D if values or codeSyntax changed (cheap text refresh); A/E static unless SKILL text changes.

## Build Agents

### Phase 1 (parallel)

- `figma-build` — Steps 1–2: skeleton frames on new-project.
- `doc-build` — Step 1 copywriting source in SKILL or markdown snippet the agent pastes (prefer inline in SKILL for single source).

### Phase 2 (sequential)

- `figma-build` — Steps 3–4: populate step in `create-design-system`.
- `code-build` — Step 5: optional small script to diff codeSyntax and emit changed table rows (only if complexity warrants).

### Phase 3 (parallel)

- `doc-build` — sync-design-system hook text + step numbering.

## Dependencies & Tools

- WO1 headers; WO3 MCP page cross-link ("full machine list").
- `use_figma` + figma-use.

## Open Questions

1. **Diagram fidelity** — Strict DL template vs simplified boxes (user allows improvement ideas).
2. **Localization** — English-only v1 assumed.

## Notes

- Align written guidance with existing tables in `create-design-system` Step 6/10 so designers do not see conflicting naming.
