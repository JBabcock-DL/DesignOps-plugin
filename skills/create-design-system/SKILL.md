---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives (including `typeface/display` + `typeface/body` STRING primitives), Theme (Light/Dark modes), Typography (M3 baseline — 15 slots × 4 properties × 8 Android-curve scale modes; font-family aliases typeface primitives), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections. Local tokens.css is optional (explicit opt-in after variables are pushed).
argument-hint: "Optional: --theme brand|baseline (default brand). Optional: --file-key <key-or-figma-design-url> (e.g. when chaining from /new-project). Baseline uses Material 3 static baseline seed hues for Primitives ramps; Brand uses wizard or pasted hexes."
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

> **[`CONVENTIONS.md`](./CONVENTIONS.md) is the authoritative canvas / table spec.** Read it **in full** on the first run of every session. It owns: canvas geometry (1800/1640), the five-collection architecture, codeSyntax casing for all three platforms, § 0 known-gotcha rules (row / cell Hug-before-resize, textAutoResize HEIGHT, Theme hex-sibling, Doc/\* + Effect publish order), table hierarchy, column widths per page, cell patterns, chrome→variable binding map, build-order checklist, and the pre-commit audit checklist.
>
> **Phase files under [`phases/`](./phases/) orchestrate** — which step, which page, which slug, which row set, which AskUserQuestion to fire, which codeSyntax table to apply. They do **not** own geometry, columns, cells, or auto-layout rules. **When a phase file disagrees with CONVENTIONS.md, CONVENTIONS wins.**

---

## Optional — Parse `$ARGUMENTS` for theme source

Before Step 1, parse `$ARGUMENTS` for `--theme` and `--file-key`:

**`--theme`**

- `--theme baseline` → set `THEME_SOURCE` to **`baseline`** and `THEME_FROM_CLI` to **true** (Material 3 static baseline seed colors for Primitives ramps — see Step 5).
- `--theme brand` → set `THEME_SOURCE` to **`brand`** and `THEME_FROM_CLI` to **true**.
- Flag absent or invalid → set `THEME_FROM_CLI` to **false** and leave `THEME_SOURCE` unset until Step 2.5 (wizard path only).

When `THEME_FROM_CLI` is **true** and Step 2 was **no**, skip Step 2.5. When Step 2 is **yes** (pasted tokens), always use **`brand`** for Primitives color ramps (ignore `--theme baseline` for colors).

**`--file-key`** (optional; e.g. read-only plugin install, or when handoff was not written)

- Accept `--file-key <value>` or `--file-key=<value>`. Strip quotes.
- If `<value>` matches `figma.com/design/<KEY>/` or `figma.com/file/<KEY>/`, set `FILE_KEY_FROM_ARGS` to `<KEY>` (the path segment only: letters, digits, hyphens).
- Otherwise treat the whole value as a bare file key. If it matches `^[A-Za-z0-9-]+$`, set `FILE_KEY_FROM_ARGS`. If invalid, ignore the flag (Step 1 will prompt).

---

## Interactive input contract

- For **Steps 1–4**, **Step 2.5** (theme source, when needed), **Step 10** (plan approval — `yes` / `details` / change request), **Step 11** when a per-collection push fails (Plugin script or REST `codeSyntax` patch) (`retry` / `skip` / `abort`) or returns partial errors (`retry` / `skip` / `abort`), **Step 12.5** (optional `tokens.css`), **Step 13** (path prompt in 13a when CSS is opted in), and **Step 19**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
- **Do not** print a block of multiple questions as plain markdown before the first AskUserQuestion.
- After any AskUserQuestion, you may show a brief acknowledgment in prose; do not bundle the next question in that same message — call AskUserQuestion again.
- Follow **Progress checklist** below so the designer sees liveness during long wizard and API runs.

---

## Progress checklist (required)

**While collecting answers (Steps 1–4):** After **each** Step 3 `AskUserQuestion` answer, send **one** short line before the next question, e.g. `Collected: base border radius (px)` — no big checklist yet.

**After Step 4 finishes** (current Figma variable state is read), the long work begins. Immediately post the **“Building your design system”** checklist below with **every** line `[ ]` and `Current:` on the **first** row. Then **repost the entire checklist** after each listed item completes (Steps 5–19), updating `[x]` and moving `Current:` to the next row. Do **not** paste JSON, CSS blobs, or full API payloads into these messages.

If a row is **skipped** by skill logic (e.g. no canvas step), mark it `[x]` once and note `(skipped)` in `Current:` when you skip forward.

**On failure**, leave that row `[ ]`, add one line of context, retry that unit before checking later rows.

### Template — use after Step 4 (copy and update)

**Building your design system**

Current: Building Primitives…

- [ ] Building Primitives (color ramps, space, radius, elevation, typeface strings)
- [ ] Building Theme (semantic colors — Light & Dark)
- [ ] Building Typography (type styles × 8 scale modes)
- [ ] Building Layout (spacing & radius aliases)
- [ ] Building Effects (shadows & blur per mode)
- [ ] Preparing plan — waiting for your approval
- [ ] Pushing variable collections to Figma (Plugin API + REST `codeSyntax`)
- [ ] Verifying variables wrote correctly
- [ ] Optional: write `tokens.css` (your choice — Step 12.5, then Step 13 if yes)
- [ ] Summarizing results (counts & file links)
- [ ] Publishing Doc/\* text styles + Effect/shadow-\* (Step 15c § 0 — run **before** 15a/15b on first runs; see CONVENTIONS § 0.4)
- [ ] Drawing ↳ Primitives style guide (Step 15a)
- [ ] Drawing ↳ Theme style guide (Step 15b)
- [ ] Drawing ↳ Layout + ↳ Text Styles + ↳ Effects (rest of Step 15c)
- [ ] Filling Token Overview from live variables (Step 17)
- [ ] Updating Thumbnail cover (brand gradient) (Step 18)
- [ ] Offering next step (`/create-component`)

**Maps to skill steps:** rows 1–5 → Steps 5–9 · row 6 → Step 10 · rows 7–8 → Steps 11–12 · row 9 → Step 12.5 + Step 13 (`tokens.css`, skip row 9 body if declined) · row 10 → Step 14 · row 11 → Step 15c § 0 (pre-pass on first runs) · rows 12–14 → Steps 15a–15c bodies · rows 15–16 → Steps 17–18 · row 17 → Step 19.

**Docs-only path** (variables already present — see "After Step 4" below): start the checklist at **row 11** (publish Doc/\* + Effect styles) and continue through row 17. Rows 1–10 are marked `[x] (skipped — variables present)` up front.

---

## Phase execution (required)

Work through the phases **in order**, except when **After Step 4 — variables present vs missing** (subsection below) says to **skip 02–04** and go straight to **06 → 07 → 08** (documentation draw/update). For each phase you execute, **`Read` the linked file in full** — phase files are authoritative; this orchestrator only routes.

| Phase | Scope | Read path |
|------|--------|-----------|
| 01 | Steps 1–4 — file key, tokens, wizard, read registry | [`phases/01-steps1-4.md`](./phases/01-steps1-4.md) |
| 02 | Steps 5–9 — generate Primitives, Theme, Typography (+7b), Layout, Effects | [`phases/02-steps5-9.md`](./phases/02-steps5-9.md) |
| 03 | Step 10 — plan approval | [`phases/03-step10.md`](./phases/03-step10.md) |
| 04 | Step 11 — push (Plugin API + REST `codeSyntax`) | [`phases/04-step11-push.md`](./phases/04-step11-push.md) |
| 05 | Steps 12–14 — verify, optional CSS, confirm | [`phases/05-steps12-through14.md`](./phases/05-steps12-through14.md) |
| 06 | Canvas documentation visual spec (§A–H) | [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) |
| 07 | Steps 15a–15c — style-guide pages | [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) |
| 08 | Steps 17–19 + appendix | [`phases/08-steps17-appendix.md`](./phases/08-steps17-appendix.md) |

**First-run ordering (important):** On the first invocation of a session, execute phase 07's **Step 15c § 0** (publish `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`, and `Effect/shadow-{sm,md,lg,xl,2xl}`) **before** 15a/15b so the first pass can bind `textStyleId` / `effectStyleId` directly instead of emitting fallback `fontName`/`fontSize` literals that a second pass would need to upgrade. See [`CONVENTIONS.md`](./CONVENTIONS.md) § 0.4.

### After Step 4 — variables present vs missing

**Step 4** (phase 01) reads the file’s variable registry. Use it **before** phase 02 to decide whether to **generate and push tokens** or **draw/update documentation only**.

| Situation | What to run |
|-----------|-------------|
| **No or insufficient variables** — e.g. missing **`Primitives`** or **`Theme`**, collections empty, or nothing local to bind the style guide to | Continue in order: **02 → 03 → 04 → 05**, then **06 → 07 → 08** (full pipeline). |
| **Variables already in the file** — the registry shows the expected collections (at minimum **`Primitives`** and **`Theme`**) populated with variables suitable for bindings, and the designer has **not** asked to regenerate or replace tokens | **Skip 02–04** (no new generation, no Step 10 plan for a fresh build). **Read 06**, then run **07** and **08** to **draw or refresh** style-guide canvas work (Steps 15a–c, 17–19). Optionally run **05** Step 12 (verify) after canvas if useful. |
| Designer **explicitly** wants new ramps, Theme changes, or a full token rebuild | Run **02 → 03 → 04** even when variables already exist. |

If the snapshot is **ambiguous** (partial collections, legacy naming), call **AskUserQuestion** once: **regenerate tokens** vs **documentation-only refresh** — then follow the matching row above.

**Also load when applying Theme `codeSyntax`:** [`phases/02b-theme-codesyntax.md`](./phases/02b-theme-codesyntax.md) (supplements Step 6 tables in phase 02).

**Canvas (Steps 15a–17):** **agent-driven only** — the agent composes plain Figma Plugin API JavaScript **inline** for each `use_figma` call; follow [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md), [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) § A–H, and [`CONVENTIONS.md`](./CONVENTIONS.md). **Do not** add canvas `.js` files, helper bundles, or scratch scripts to the workspace as part of this skill.

**Foundations page list (shared with `/new-project`):** [`../shared/pages.json`](../shared/pages.json).

