# MCP payload research — create-design-system canvas

**Status:** **Partially validated** (2026 live MCP read + payload math on a real Foundations file). See **§11** for hypothesis vs attempt.

**Purpose:** Record findings on large `use_figma` payloads, agent looping, and safe decomposition. **§8** records the live checklist; **§9** records follow-ups.

**Related:** [`AGENTS.md`](../../AGENTS.md), [`.cursor/rules/mcp-inline-payloads.mdc`](../../.cursor/rules/mcp-inline-payloads.mdc), [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md), [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md), [`VERIFICATION.md`](./VERIFICATION.md).

---

## 1. Problem

- Figma MCP `use_figma` caps **`code` at ~50 000 characters** (see convention 16).
- Canvas steps compose **`code` = `_lib.js` + page template + `const ctx = …` + `build(ctx)`**, with `ctx` including a full **`variableMap`** (path → variable id) built from **all** local variables (phase 07).
- Static template sizes already consume **~20–31 kB** of source before `ctx`; a large `JSON.stringify(ctx)` (especially **`variableMap`**) can push the full string over the cap.
- Repo policy forbids **throwaway disk staging** (`.mcp-*`, `*-once.js`, scratch under `skills/`, etc.) to work around limits — deliverable is **Figma file state**, not extra files.
- Under pressure, agents may try staging files, hit policy, delete, retry, or split calls **without** clear semantics → looks like **circling**.

---

## 2. Documented call shape (authoritative)

From [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md):

1. Resolve live data (today: includes **`variableMap` for all local variables**).
2. Read `_lib.js` + page template.
3. Compose: **`[_lib] + [template] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"`** → `use_figma` `code`.

[`VERIFICATION.md`](./VERIFICATION.md) measures **`_lib.js` + template** bytes only; it explicitly says to **add margin for `JSON.stringify(ctx)`**. Rows in that table are **not** a guarantee for the full MCP string.

---

## 3. Static size baseline (committed templates, bytes on disk)

| Step | `_lib.js` + template | Notes |
|------|----------------------|--------|
| 15a | `primitives.js` ≈ **30.5k** | Largest static pair |
| 15b | `theme.js` ≈ **21.2k** | |
| 15c | `layout.js` ≈ **21.2k** | |
| 15c | `text-styles.js` ≈ **19.9k** | |
| 15c | `effects.js` ≈ **22.8k** | |

Concatenating **all** page templates into **one** script is **~55k** source alone (before `ctx`) — **not recommended** ([`VERIFICATION.md`](./VERIFICATION.md)).

---

## 4. Hypothesis — dominant `ctx` cost

**Hypothesis:** `ctx.variableMap` (every local variable name → id) often dominates payload growth as collections grow (Theme, Typography multi-mode, Layout, Effects, etc.), and can exceed the remaining budget under **50k** after static JS.

**Refinement after live file (§11):** On a **268-variable** Detroit Labs–style Foundations file, **`JSON.stringify(variableMap)` alone was ~11.2k characters** — meaningful, but **not** the tens-of-kilobytes cliff the prose worst-case implied. Dominance is **file-dependent**; very large registries or longer names could still approach the cap with `_lib` + `primitives.js` (~30.5k static) + full `ctx.rows`.

---

## 5. Why “split into multiple `use_figma` calls” is easy for 15c but ambiguous for 15a/15b

- **15c** uses **three sequential calls** on **three different pages** — each call wipes **its** page and rebuilds; no cross-call conflict ([`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md)).
- **15a / 15b** use **one page** with **“delete everything except `_Header`, rebuild `_PageContent`”**. A second “self-contained” full wipe **destroys** the first batch unless templates support **append** or **slug-scoped partial redraw**.

**Implication:** Payload splitting for a **single** style-guide page needs an **explicit template contract** (e.g. `ctx.batch`, append vs selective delete), not only prose in convention 16.

---

## 6. In-plugin `variableMap` — interaction with heterogeneous pages

**Idea:** Resolve `variableMap` inside the plugin via `getLocalVariablesAsync()` instead of embedding it in `JSON.stringify(ctx)`.

**Does not** force identical tables or presentation: pages stay different in **manifests, columns, row builders, slugs**. “One bootstrap shape” only means **agreement on how ids are resolved** (shared prelude or helper), not one universal table layout.

**Cons (revisited):** A few hundred extra JS characters per call; templates share bootstrap; **`getLocalVariablesAsync`** must remain available in the MCP host (already assumed for canvas work).

---

## 7. Other directions (ordered by preference)

1. **In-plugin `variableMap`** — largest expected win; no disk; same MCP model.
2. **Template-defined batch modes** for true multi-call 15a/15b when still over cap after (1).
3. **Thin orchestration** — one MCP call per turn, minimal phase + template reads; checklist gates (reduces **chat** confusion loops, not raw `code` bytes).
4. **`clientStorage` stitching** — convention 16 discourages unless verified on host; last resort.
5. **`new-project`** phases with huge inline `use_figma` scripts (e.g. TOC) — same **50k** and **no staging** rules apply; separate from 15a–c but same failure class.

---

## 8. Validation checklist (live attempt — Cursor + Figma MCP)

**File:** `v44-updates — Foundations` · `fileKey` **`uCpQaRsW4oiXW3DsC6cLZm`** (Figma Design URL from user). **Scope:** Docs-only path intent (variables already present); inspection + Step 15a payload math; **full 15a `use_figma` did not complete** in-session (§11).

| Check | Research expectation | Real run result |
|-------|----------------------|-----------------|
| 15a `code` under ~50k? | At risk if `variableMap` is large | **Yes for this file:** unminified `_lib` + `primitives` + in-plugin `ctx` build ≈ **32k** chars; **esbuild --minify** ≈ **17.4k** — both **under 50k**. |
| 15b `code` under ~50k? | Usually more headroom than 15a | **Not executed** this session. |
| 15c (layout / text-styles / effects) each under ~50k? | Static pairs smaller; still add `ctx` | **Not executed** this session. |
| Any MCP/tool error mentioning size / truncation? | Would support variableMap hypothesis | **No.** No Figma `maxLength` rejection observed. |
| Agent created throwaway staging files? | Policy says should not; if yes, which pattern? | **OS temp only** (`%TEMP%/designops-mcp-15a.js`) for compose/measure — **not** committed repo staging. Copy into repo for one-shot MCP was **rejected** by review. |
| Multiple `use_figma` for 15a or 15b? | If yes, did second call wipe first (bug)? | **N/A** — single-call 15a path prepared only. |
| Step 17 script size / errors? | Separate script path; note if large | **Not run** this session. |

**Measured (same session, `use_figma` read-only script):**

| Metric | Value |
|--------|--------|
| Local variable count | **268** |
| Collection names | Primitives, Theme, Typography, Layout, Effects |
| `JSON.stringify(variableMap)` character count | **11 164** |
| Longest variable `name` length | **34** |
| Doc/* text styles present | all four **yes** |
| `Effect/shadow-{sm,md,lg,xl,2xl}` | all **yes** |
| MCP server id (this Cursor project) | **`plugin-figma-figma`** (`figma` alone → “server does not exist”) |

---

## 9. Follow-ups after validation

- [x] Research **partially validated** — **Summary:** On this real file, **50k was not the blocker**; **`variableMap` JSON was ~11k**, not dominant vs ~30.5k static 15a JS. **Pain was orchestration:** getting tens of kB of `code` reliably into `use_figma` from the agent (tool args, no repo staging), plus **wrong MCP server slug** on first try.
- [x] **In-plugin `variableMap` + row build:** Still valuable (smaller `code`, fewer escape bugs, one source of truth in Figma) but for **this** file it is **optimization**, not required to get under 50k if templates are **minified** for MCP transport.
- [ ] **Document MCP server id** for Cursor (`plugin-figma-figma`) in skill or AGENTS pointer if not already obvious to Claude Code users.
- [ ] **Optional:** Phase or VERIFICATION note — “measure `variableMap` JSON for your file” before assuming cap risk; cite **~11k @ 268 vars** as one data point.
- [ ] **Splits / batch contract** for 15a/15b — still relevant for **single-page multi-call** semantics; **not** validated or invalidated by this attempt (not needed once under cap).

---

## 11. Hypothesis vs actual attempt (concise)

| Topic | Research said | Attempt showed |
|--------|----------------|----------------|
| **`variableMap` blows the budget** | Often dominates `ctx`, risk over 50k | **Weaker on this file:** **11 164** chars for **268** vars; static **15a** JS remains the larger slice (~30.5k). |
| **50k cap is the main failure mode** | Primary hard limit | **Schema cap exists**, but **this run never hit it** — no truncation error from Figma MCP for measured payloads. |
| **Agent loops / scratch files** | Staging files + split ambiguity | **Observed friction:** composing **large inline `code`** for `call_mcp_tool` without repo clipboard files; **esbuild minify** to ~17k is a practical transport lever. **First MCP call used wrong server name** (`figma` vs **`plugin-figma-figma`**). |
| **In-plugin resolution** | Removes giant `JSON.stringify(variableMap)` | **Confirmed helpful** for payload and correctness; **not** the only way to stay under 50k here — **minify** alone would likely suffice for 15a on this file. |
| **Step 15a completed on canvas** | Full flow | **Not completed** in Cursor session — measurement + script prep only; no final successful draw returned to chat. |

**Bootstrap bug (agent):** First generated regex for `Space`/`Corner` rows was invalid (`/^Space//`); **fixed** with `String.prototype.startsWith('Space/')` before minify. Template for production should stay **committed** sources, not hand-rolled regex in session.

---

## 10. Changelog

| Date | Note |
|------|------|
| 2026-04-20 | Initial research log from codebase review (no live MCP measurement). |
| 2026-04-20 | Live MCP on file `uCpQaRsW4oiXW3DsC6cLZm`: variable count, `variableMap` JSON length, 15a size estimates, server id `plugin-figma-figma`; §8–§11 filled; full 15a draw not completed in-session. |
| 2026-04-20 | **Implemented:** `ensureLocalVariableMapOnCtx` in [`canvas-templates/_lib.js`](./canvas-templates/_lib.js); all Step 15 templates await it at `build` start; phase 07, convention 16, SKILL, VERIFICATION, AGENTS, sync-design-system docs updated. MCP smoke on same file key: empty `ctx` → **268** keys after hydrate. |
