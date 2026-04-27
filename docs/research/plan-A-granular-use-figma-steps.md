# Plan A — More granular `use_figma` steps (research-grounded)

**Status (2026):** **Shipped** in-repo — `SLUG_ORDER` has **N = 4** first-class scaffold sub-slugs (`cc-doc-scaffold-shell` → … → `cc-doc-scaffold-placeholders`) before `cc-variants`, with merge, `assemble-slice` / `generate-ops`, and normative skills updated. **`.partN` merge** for wire splits remains **unimplemented** (throws). Below is the historical plan + success criteria; evidence rows stay useful for follow-on splits.

**Scope (original):** Split the *logical* single-draw scaffold step (formerly one **`cc-doc-scaffold`** / step1 min bundle) into **several** sequential `use_figma` invocations (shell → header → table → placeholders), each with **smaller** inline `code`, while keeping the global draw ladder valid.

This plan ties every major move to **measured or written** sources in this repo. It was a **pre-implementation** checklist; it is now **closed** for the four-sub-slug Plan A, with the revision log last updated when docs were aligned post-ship.

---

## 1. Why this exists (evidence, not opinion)

| Claim | Source |
|--------|--------|
| Model-mediated parent `call_mcp` has a **practical** ~**10.3 kB** class ceiling for **full serialized** `use_figma` args on one path; **25k** `code` in one assistant message did not complete | [mcp-transport-solution-architecture-2026.md §3.2–3.3](./mcp-transport-solution-architecture-2026.md) |
| Smaller **per-invocation** `code` reduces truncation risk for that path | Same doc §4.1, §6.0.1 tactic **A** |
| Current op **scaffold** assembly is still **~15.5 kB** for a typical fixture; **8 kB** `code` needs more splits **or** thinner runtime | Same doc §6.0.1 (measured line + wire note) |
| **Scaffold must complete** (page, table shell, placeholder rows, dashed reserves) **before** `cc-variants` | [13-component-draw-orchestrator.md](../../skills/create-component/conventions/13-component-draw-orchestrator.md) §1 |
| Table / placeholder rules (no illegal empty body, header geometry, row count = `CONFIG.properties.length`) | [04-doc-pipeline-contract.md](../../skills/create-component/conventions/04-doc-pipeline-contract.md), [09-mcp-multi-step-doc-pipeline.md](../../skills/create-component/conventions/09-mcp-multi-step-doc-pipeline.md) §1.1 |
| Handoff must carry `pageContentId` / `docRootId` for doc-resume; later `compSetId`, variant holder, etc. | [13 §4](../../skills/create-component/conventions/13-component-draw-orchestrator.md), [merge-create-component-handoff.mjs](../../scripts/merge-create-component-handoff.mjs) `mergeReturnIntoHandoff` |
| **`.partN` merge is not implemented** — `mergeOne` **throws** if `step.includes('.part')` | [merge-create-component-handoff.mjs](../../scripts/merge-create-component-handoff.mjs) lines 343–346 |
| **First merge step** is **`SLUG_ORDER[0]`** (`cc-doc-scaffold-shell`) when `needPrev === null` | **Done** — [merge-create-component-handoff.mjs](../../scripts/merge-create-component-handoff.mjs) `mergeOne` uses `FIRST_DRAW_SLUG` / `SLUG_ORDER[0]`, not a hardcoded legacy name |
| `listReturnFilesOnDisk` only tracks `return-*.json` for slugs in **`STEPS`** = **`new Set(SLUG_ORDER)`** | Same file lines 56, 128–145 — new first-class slugs must be **in** `SLUG_ORDER` to participate in orphan detection |

**Implication:** “More granular steps” is aligned with **measured transport pressure** and **doc DAG**. Implementation must update **`SLUG_ORDER`, merge, resume, assemble-slice, and 13** in lockstep; **`.partN` as a merge path** is **blocked** today unless merge is built (research [§6.0.2](./mcp-transport-solution-architecture-2026.md) recommends **first-class slugs** as the simpler path).

---

## 2. Decision record (pick one before coding)

### 2.1 Recommended: **First-class sub-slugs** in `SLUG_ORDER`

**Definition:** Replace the single position that was `cc-doc-scaffold` with an ordered list, for example:

- `cc-doc-scaffold-shell` → `cc-doc-scaffold-header` → `cc-doc-scaffold-table` → `cc-doc-scaffold-placeholders`

…then **`cc-variants`** unchanged, then the rest of the **six** post-scaffold slugs (`cc-doc-component` … `cc-doc-finalize`) — **10** `use_figma` calls total.

**Grounding:** [§6.0.2](./mcp-transport-solution-architecture-2026.md) *Orchestration / repo touchpoints* and *Recommendation* item 1; [mergeOne](../../scripts/merge-create-component-handoff.mjs) **rejects** `.part` merge.

**Tradeoff (resolved):** The normative “seven `use_figma`” story became **10** (four scaffold + one variant + five doc) — see [13](../../skills/create-component/conventions/13-component-draw-orchestrator.md) **§1**.

### 2.2 Not recommended yet: **`.part1` / `.part2` only**

**Definition:** Keep one logical name `cc-doc-scaffold` for humans but run `cc-doc-scaffold.part1` / `.part2` in sequence.

**Grounding:** Valid `isValidStepSlug` ([merge-create-component-handoff.mjs](../../scripts/merge-create-component-handoff.mjs) 61–66), but **merge** explicitly **throws** for `.part` steps (343–346). **Do not** start here without a **merge + phase-state** design signed off (research [§6.0.2](./mcp-transport-solution-architecture-2026.md) table row *Scaffold (bytes only)*).

---

## 3. Spec checkpoints (before any Figma code generation)

Work with **04** + **09** + draw-engine behavior so **each** intermediate file state is legal:

1. **Shell-only slice:** Does `docRoot` (and page frame) exist in a state that the **next** slice can attach to without violating structure rules? (Research [§6.0.2](./mcp-transport-solution-architecture-2026.md) *Hard product constraints* point 2.)
2. **Table split:** The **last** scaffold sub-slice that runs before **`cc-variants`** must match [13](../../skills/create-component/conventions/13-component-draw-orchestrator.md) §1: full **placeholder** body rows, dashed reserves, no empty body “mid-ladder” when combined with prior slices.
3. **Handoff path:** After the **first** sub-slice that creates ids, [assemble-slice.mjs](../../scripts/assemble-slice.mjs) must use the **doc-resume** `varGlobals` branch (ids in globals), not the branch that **omits** handoff ids — stated in [§6.0.2](./mcp-transport-solution-architecture-2026.md) point 3.

**Deliverable:** A short “allowed intermediate states” table (can live in 13 or a phase file once approved).

---

## 4. Implementation phases (ordered)

### Phase A — Orchestration and merge (blocking)

| Task | Rationale / pointer |
|------|---------------------|
| Expand `SLUG_ORDER` with **N** scaffold sub-slugs **contiguous** before `cc-variants` | [merge SLUG_ORDER](../../scripts/merge-create-component-handoff.mjs) 46–54; [pred](../../scripts/merge-create-component-handoff.mjs) 96–108 |
| **Generalize** `mergeOne` “first step” from hardcoded `cc-doc-scaffold` to **`SLUG_ORDER[0]`** | Lines 397–405 must match new first slug |
| Keep **`STEPS` = new Set(SLUG_ORDER)** so `listReturnFilesOnDisk` and finalize-slice see new slugs | Lines 56, 128–145 |
| Update **resume-handoff.mjs** replay order (it indexes `SLUG_ORDER`) | [resume-handoff.mjs](../../scripts/resume-handoff.mjs) |
| Extend **qa-merge-consistency** / **qa-op-part-slugs** (or new QA) for longer prefix | [package.json](../../package.json) `verify` |
| **Phase-state** validator: `completedSlugs` must remain a **contiguous prefix** of `SLUG_ORDER` (already the rule; length increases) | [13 §4](../../skills/create-component/conventions/13-component-draw-orchestrator.md), schema |

### Phase B — Assembly (`assemble-slice` + `generate-ops`)

| Task | Rationale / pointer |
|------|---------------------|
| Add `STEP_ENGINE_MAP` / op-generator entries so **each** new slug emits **one** `code` payload | [assemble-slice.mjs](../../scripts/assemble-slice.mjs) `VALID_STEPS` / `STEP_ENGINE_MAP` |
| Split [cc-doc-scaffold.mjs](../../scripts/op-generators/cc-doc-scaffold.mjs) (or wire tuples) so ops are **partitioned** across sub-generators; shared **`__S`** / preamble rules per [§6.0.1](./mcp-transport-solution-architecture-2026.md) |
| Run **`check-payload` / `check-use-figma-mcp-args`** on **each** sub-slice; compare to **~10.3k** full-args proof if aiming for “one parent turn” | [mcp-transport-solution-architecture-2026.md §3.2](./mcp-transport-solution-architecture-2026.md) |

### Phase C — Skills and operator docs (normative)

| Task | Rationale / pointer |
|------|---------------------|
| Update [13 §1](../../skills/create-component/conventions/13-component-draw-orchestrator.md) — fixed DAG and **count** of `use_figma` calls | **Done** — **10** sequential slugs; **four** scaffold + `cc-variants` + **five** doc |
| Add or split [phases/04-slice-cc-doc-scaffold.md](../../skills/create-component/phases/04-slice-cc-doc-scaffold.md) into one file per new slug *or* one file with N internal stages linked to machine slugs | **Done** — one phase file **04** with four machine slugs; [17-scaffold-sub-slice-states.md](../../skills/create-component/conventions/17-scaffold-sub-slice-states.md) for intermediate states |
| [EXECUTOR.md](../../skills/create-component/EXECUTOR.md), [08-cursor-composer-mcp.md](../../skills/create-component/conventions/08-cursor-composer-mcp.md) — Step 6 count / handoffJson cadence | **Done** |
| [memory.md](../../memory.md) / [AGENTS.md](../../AGENTS.md) — “seven slices” → **10** | **Done** |

### Phase D — Verification

| Task | Rationale / pointer |
|------|---------------------|
| `npm run verify` after `build:min` if interpreter template changes | Project convention |
| Optional: re-run [probe-parent-transport.mjs](../../scripts/probe-parent-transport.mjs) for a new **ceiling** if host changes — [AGENTS.md](../../AGENTS.md) anti-confabulation rule |
| `bash scripts/sync-cache.sh` after skill edits | [AGENTS.md](../../AGENTS.md) skill edits |

---

## 5. Success criteria (measurable)

1. **Each** new scaffold `use_figma` passes **`check-payload`** and, if CI enforces it, stays under the **adopted** `code` / full-args budget (align with [§6.0.1](./mcp-transport-solution-architecture-2026.md) targets, not a guess).
2. **Full ladder** still runs **sequential only**; `merge` + `phase-state` + `resume-handoff` accept the longer `SLUG_ORDER` without manual hand-edits.
3. **04 / 09** invariants hold for the **union** of intermediate canvas states (per section 3).
4. No reliance on **`.partN` merge** until that path is **explicitly** implemented and tested (currently **throws**).

---

## 6. Explicit non-goals (for Plan A)

- **Default** gzip / base64 in `code` — policy in [AGENTS.md](../../AGENTS.md) and [§4.1](./mcp-transport-solution-architecture-2026.md).
- **Scratch** `*-payload.json` in repo for tool args — [AGENTS.md](../../AGENTS.md) MCP section.
- Splitting **matrix** or **variants** before scaffold granularity is **proven** — [§6.0.2](./mcp-transport-solution-architecture-2026.md) *Recommendation* item 3 (variants combine boundary risk).

---

## 7. Revision log

| Date | Change |
|------|--------|
| 2026-04-28 | Initial plan: grounded in solution-arch doc §3, §6.0.1–6.0.2, 13, merge-create-component-handoff (first-step + `.part` guards). |
| 2026-04-28 (ship) | Plan A (N=4) implemented: `SLUG_ORDER`, merge, `assemble-slice` / `generate-ops`, **13** / **04** / **EXECUTOR** / **AGENTS** / **memory**; this doc retagged as **Status: shipped** + Phase C table marked **Done**. |
