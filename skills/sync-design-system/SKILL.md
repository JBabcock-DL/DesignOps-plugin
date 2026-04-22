---
skill: sync-design-system
invocation: /sync-design-system
description: >
  One reconcile pass across three design-system axes — Variables (A),
  Components (B), and Code Connect mappings (C). Reads every enabled axis,
  presents every drift together, collects every decision in a single bundled
  prompt, then executes in strict dependency order (A → B → C) with a
  pre-execution validation pass that catches cascading drift without silent
  re-decisioning.
arguments: {}
auth: Figma MCP connector via Claude Code (no PAT required)
api: Figma Variables REST API — GET /v1/files/:key/variables/local, PUT /v1/files/:key/variables; Figma Connect API for Axis C published mapping state
requires_figma_tier: Organization
---

# Skill — /sync-design-system (router)

**One reconcile, three axes.** This file is the **entry + branch router**. Step bodies live in [`phases/`](./phases/) — **read only the phase file for your current step**; do not load every shard at session start.

This skill audits every design-system surface in a single pass: tokens (**Axis A**), components (**Axis B**), and Code Connect mappings (**Axis C**). It presents every drift together, collects all directions in **one bundled decision prompt**, and executes in strict dependency order (A → B → C). A **pre-execution validation pass** runs between axes so upstream writes never silently decide on drift the user never saw.

**MCP repo policy:** [`../../AGENTS.md`](../../AGENTS.md) — inline tool payloads only (no `.mcp-*` / scratch staging files under the repo).

> **First time in a session?** Post a liveness line, then `Read` these **only**: [`../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md), [`../create-design-system/conventions/02-codesyntax.md`](../create-design-system/conventions/02-codesyntax.md), and **§0** in [`../create-design-system/SKILL.md`](../create-design-system/SKILL.md) — including **§0.9** before any **6.Canvas.9d** work. Index: [`../create-design-system/CONVENTIONS.md`](../create-design-system/CONVENTIONS.md). Canvas redraws **must** match those conventions.

> **Tokens-only projects** — with a token file but no `components.json`, preflight auto-enables only Axis A when scope is `full` or `code-to-figma`. Scope **`figma-only`** ignores code-side token files entirely.

---

## Non-negotiables (medium-reasoning agents)

1. **`plan.A.figmaVarsInMemory`** — Once populated (`GET /v1/files/:key/variables/local` or continuation from figma-only), **never** refetch that endpoint in the same session for the same reconcile. Reuse the map for canvas, 11.5b, and continuation paths.
2. **`plan.scope === 'figma-only'`** — **Never** run Step 1’s axis-detection table. Jump to [`phases/figma-only-path.md`](./phases/figma-only-path.md) after Step 0.
3. **Style-guide canvas redraws (15a–15c, Step 17 bundles)** — Parent thread: **`Task` → [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md)** only. Do **not** `Read` `.min.mcp.js` in the parent or call `use_figma` for those bundles. See [`AGENTS.md`](../../AGENTS.md) § *Canvas bundles — subagent delegation*. **After each runner Task:** run [`../create-design-system/conventions/14-audit.md`](../create-design-system/conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* before declaring that page done.
4. **Thumbnail `Cover` (6.Canvas.9e)** — Small inline `use_figma` from parent is unchanged (not a committed canvas bundle).

---

## Interactive input contract

Whenever this skill needs interactive input — **scope selection** (Step 0), **token file path**, **Figma file key or URL**, **bundled direction choice** (Step 5), **per-item resolutions** in R mode or validation pauses, **push confirmations**, **continuation choice** (Step 11.5), **Figma → code write confirmation** (Step 11.5b), or **corrected paths after an error** — use **AskUserQuestion**. **One tool call per decision moment.** Wait for each answer before the next.

Bundled decisions are one **tool call** with multiple sub-questions (e.g. Step 5: one sub-question per axis with drift). That is still one decision moment, one `AskUserQuestion`.

Do not dump multiple decision prompts as plain markdown without calling **AskUserQuestion**.

---

## Global flow (one reconcile)

```
 0.    Scope               — ONE AskUserQuestion: figma-only | full | code-to-figma

 ─── scope = figma-only (short-circuit) ───────────────────────────
  1.5  Figma-only preflight — resolve Figma file key only (no code probes)
  2A.figma  Read Figma vars — GET /v1/files/:key/variables/local (ONE time)
                              → stored on plan.A.figmaVarsInMemory
  4.figma   Summary         — variable counts per collection
  5.figma   Page picker     — all | select | cancel
  6.figma   Canvas refresh  — 9b/9d/9e on selected pages
  11.figma  Report          — scope, file key, pages refreshed
  11.5      Continuation    — continue-figma-to-code | continue-full
                              | continue-code-to-figma | done
  11.5b     Direct push     — (continue-figma-to-code only)
            Figma → tokens.css write. Reuses plan.A.figmaVarsInMemory.
            NO second Figma fetch, NO diff, NO canvas chain.

 ─── scope = full | code-to-figma ─────────────────────────────────
  1. Preflight              — detect enabledAxes ∈ {A, B, C}
  2. Read                   — enabled axes only (parallel where possible)
  3. Diff                   — per axis, every item tagged with a stable key
  4. Present                — all diffs in one block
  5. Decide (bundled)       — ONE AskUserQuestion, N sub-questions (collapsed in scope=code-to-figma)
  6. Execute Axis A         — tokens + canvas chain (9b/9d/9e)
  7. Validate Axis B        — reclassify B's plan; pause + re-prompt only on ALTERED or NEW
  8. Execute Axis B         — redraw / PR / review as planned
  9. Validate Axis C        — reclassify C's plan; pause + re-prompt only on ALTERED or NEW
 10. Execute Axis C         — publish / refresh / review as planned
 11. Unified report         — scope, upstream-resolved + validation-pause counts
```

In a clean `figma-only` run the user answers **two** `AskUserQuestion` calls (scope at Step 0, page picker at Step 5.figma) plus one continuation prompt at Step 11.5. The `continue-figma-to-code` branch adds **one** more confirmation (Step 11.5b). In a clean `full` / `code-to-figma` run the user answers **two** (scope at Step 0, direction at Step 5); if entered via continuation from figma-only, the Figma variable read is reused from `plan.A.figmaVarsInMemory`. Validation pauses (Steps 7, 9) are exception-driven.

### Plan state object

From Step 0 onward, the skill holds a `plan` object:

```
plan = {
  scope: 'figma-only' | 'full' | 'code-to-figma',
  continuation: 'continue-figma-to-code' | 'continue-full' | 'continue-code-to-figma' | 'done' | null,
  A: {
    direction: 'F'|'C'|'R'|'S'|null,
    items: [...],
    figmaVarsInMemory: null,   // populated by Step 2A.figma (or Step 2A when scope !== 'figma-only');
                               // reused by Steps 6.figma, 11.5b, and any post-11.5 continuation
                               // path. NEVER refetched within a single session.
  },
  B: { direction: ..., items: [...] },
  C: { direction: ..., items: [...] },
  upstreamResolvedDropped: [],
  validationPausesTriggered: 0,
}
```

Every item across every axis carries a **stable key**: `{axis}.{subject}.{bucket}.{id}` (e.g. `A.tokens.color/primary.conflict`, `B.button.variant-axis.mismatch`, `B.pagination.composition.button.detached-instance`, `C.badge.mapping.stale`). The validation passes in Steps 7 / 9 use these keys to classify post-write diff items as UNCHANGED / RESOLVED / ALTERED / NEW without false positives.

---

## Branch router — which file to `Read` next

**After you record `plan.scope` at Step 0:**

| `plan.scope` | Next phase file(s) in order |
|--------------|-------------------------------|
| **figma-only** | [`phases/figma-only-path.md`](./phases/figma-only-path.md) (Step 1.5 → 2A.figma → 4.figma–6.figma → 11.figma → 11.5 → 11.5b). Token formats / errors: [`reference/token-formats.md`](./reference/token-formats.md), [`reference/error-guidance.md`](./reference/error-guidance.md). |
| **full** or **code-to-figma** | 1. [`phases/00-scope-preflight.md`](./phases/00-scope-preflight.md) (Step 0 recap optional; Step 1) — if Step 0 already done, start at Step 1 content. 2. [`phases/02-read-axes.md`](./phases/02-read-axes.md) 3. [`phases/03-diff.md`](./phases/03-diff.md) 4. [`phases/04-present-05-decide.md`](./phases/04-present-05-decide.md) 5. [`phases/06-axis-A-and-canvas.md`](./phases/06-axis-A-and-canvas.md) 6. [`phases/07-10-axes-BC.md`](./phases/07-10-axes-BC.md) 7. [`phases/11-report-and-R-mode.md`](./phases/11-report-and-R-mode.md) |

**Lazy-read rule:** Open **only** the phase file for the step you are executing. **Step 0** text also appears in [`phases/00-scope-preflight.md`](./phases/00-scope-preflight.md) for the full path; run Step 0 from this router or from that file once.

**Canvas chain detail (9b / 9d / 9e, slug table, 15c ordering):** [`phases/06-axis-A-and-canvas.md`](./phases/06-axis-A-and-canvas.md) §6.Canvas and [`phases/figma-only-path.md`](./phases/figma-only-path.md) §6.figma.

**Drift report template (8.F):** [`drift-report-template.md`](./drift-report-template.md).

---

## Step 0 — Scope selection (run first)

Before any file probes, reads, or diffs, call **AskUserQuestion** once to pin the scope of this run. Do not read tokens, call Figma, or run extractors before this answer lands.

**Prompt**

> "What do you want this sync to cover?
> - **figma-only** — Refresh the Figma style-guide docs (↳ Primitives / Theme / Layout / Text Styles / Effects / Token Overview / Thumbnail) so they reflect the current Figma variables. Stays entirely inside Figma. **No** `tokens.css` / `tokens.json` read, **no** component scan, **no** Code Connect, **no** code-side writes. When it finishes, the skill asks whether to continue to a code-side reconcile.
> - **full** — Full reconcile across Variables (code ↔ Figma), Components, and Code Connect. Direction is chosen per axis at Step 5. May open a drift-report PR (Axis B F-wins) and/or publish mappings (Axis C C-wins).
> - **code-to-figma** — One-way push of code as source of truth: tokens push up to Figma, drifted components get redrawn via `/create-component`, mappings get republished via `/code-connect`. Skips the per-axis direction prompt and asks a single confirmation instead."

Record the answer as `plan.scope`, then follow the **Branch router** table above.

### How scope shapes the rest of the run

| `plan.scope` | What runs | Interaction |
|---|---|---|
| **figma-only** | Short-circuit: file key → one vars read → summary → page picker → canvas → figma-only report → 11.5 → optional 11.5b. | See [`phases/figma-only-path.md`](./phases/figma-only-path.md). |
| **full** | All axes preflight; diff; bundled Step 5; execute A → B → C with validation pauses. | See phase files 00 → 02 → … → 11. |
| **code-to-figma** | Same as full but Step 5 collapsed to Apply C / Review / Skip per axis. | Same phase chain. |

If the user later realizes the scope was wrong, they re-run `/sync-design-system` with the intended scope. The only automatic up-scope path is Step 11.5 after a successful `figma-only` run.

---

## Skill edits — repo vs marketplace cache

If you edit any file under `skills/`, follow [`AGENTS.md`](../../AGENTS.md) § *Skill edits — repo is canonical, marketplace cache is downstream* so local Claude plugin installs do not run stale copies.
