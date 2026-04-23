# MCP `σ` budget — **total** `code` across all calls in one draw

**Definition — σ (sigma):** For one component draw, **σ = sum of `len(code)`** over every `use_figma` in that draw.

**Goal many teams want:** **σ ≲ ~45K** (same order as a **one-shot** monolith) **and** **several** MCP calls (phases, skills, subagents) for **per-call** host limits and clearer orchestration.

**Figma tool:** `use_figma` has **only** inline `string` `code` (`maxLength` 50,000). No `codePath` in the repo’s tool descriptor — see `mcps/plugin-figma-figma/tools/use_figma.json`.

---

## What was wrong in the “single-call only” reading

The **one-shot** monolith is one minified string of order **~36–40K** (engine) + **~6K** (preamble) + **CONFIG** — **~42–48K** total, one call.

A **true partition** of that same work into **6 valid scripts** would satisfy:

> **|P1| + |P2| + … + |P6| ≈ |monolith| + small overhead**  

not **6 × (almost full engine)**. **Same total information, split across calls** — that **is** possible in principle, and it matches your “chain of events that comes together.”

**What blocks it today is not “physics”** — it is our **build and assembly** pattern.

---

## Why **committed** six-step σ is ~150K (research)

1. **Doc steps 1–5** are each built from the **same** slimmed `draw-engine` assembly (`buildDocSlimSteps` in [`scripts/build-min-templates.mjs`](../../../scripts/build-min-templates.mjs)): `slimTop + slimBottom` is **re-minified 5 times** with a different `__ccDocStep` constant. Terser removes **dead** branches, but each output still **embeds a large shared core** (token helpers, `makeText`, `__ccDocResumeFromHandoff`, etc.). So the **sum** of the five doc bundles **far exceeds** a single monolith — **overlap by design**, not a partition.

2. **`step0`** is a **genuine** truncation (variant plane only) — that part is closer to a **subset** of the monolith, not a duplicate of the full 36K.

3. **`preamble.figma.js` (~6K)** is currently inlined **on every** call in the mental model. Repeating it **6 times** is **+~36K** to σ **before** engine bytes.

So: **current σ ≫ 45K** reflects **redundant** bytes across steps, not a proof that **6 phases can never** sum to 45K.

---

## A concrete direction that **can** approach σ ≲ 45K (6+ calls)

| Lever | What to do |
|--------|------------|
| **1 — Partition the engine in *source***, not by re-rolling the same file 5× | Refactor `draw-engine.figma.js` (and helpers) into **importable** units (or explicit marker regions) that **esbuild** can bundle into **6 (or N) entry points** with **disjoint** runtime roots: each `P_k` only contains the **closure** needed for that phase. **No** large shared subtree duplicated across 5 compiles. Handoff is **Figma state** (node ids) + small injected globals, not re-shipping the same helpers. |
| **2 — Preamble once (or “thin” after call 1)** | Call 1: full or standard preamble. Calls 2–6: **micro-preamble** (only `ACTIVE_FILE_KEY`, `usesComposes` bit, and whatever the gate at §0a truly needs — target **&lt;1K**), **not** 6× the full 6K file. Saves **tens of KB** off σ. |
| **3 — Phase-scoped `configBlock` each call** | Smaller per-phase `CONFIG` (your chain-of-skills model) shaves each string; total impact is smaller than (1) but matches “separate skills.” |
| **4 — Independent skills / `Task` per phase** | **Orchestration** (parent, subagents) does not change σ by itself, but it **enforces** one small `code` per turn — the **payload** must be built to (1)–(3). |

**Target identity (design-time check):**

- Let **E** = minified engine bytes for one full per-archetype call (one compile).
- A **partitioned** pipeline should aim for **sum of engine parts ≈ E** (plus small glue), **not** 5× a near-full **E′** doc slice + **step0**.

---

## When single-call is still the **pragmatic** default

- **No refactored partition build yet** → **one** `use_figma` with `create-component-engine-{layout}.min.figma.js` + `preamble` is still the **only** way to get σ in the **~40–50K** range **with today’s committed files**.
- **Per-call** tool JSON limits (~25–32K) may **force** many calls with **current** (non-partition) bundles; that mode optimizes **max(call)**, not **σ** — and **acknowledge the trade** until (1)–(2) land.

---

## Automation

- [`npm run measure-sigma`](../../../package.json) — shows how far **naive** six-step + repeated preamble is from a **partition** target.
- Keep using [`check-payload`](../../../scripts/check-payload.mjs) / `check-use-figma-mcp-args` on **each** assembled string.

## Cross-references

- [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) — phase DAG  
- [`build-min-templates.mjs`](../../../scripts/build-min-templates.mjs) — how doc steps are produced today (overlap)  
- [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) — `use_figma` contract
