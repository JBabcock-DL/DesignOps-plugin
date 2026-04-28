# MCP payload shrink — solution plan (create-component)

**Status:** implementation roadmap (not yet executed). **Research depth:** see [`10-phased-payload-research.md`](./10-phased-payload-research.md) (CONFIG keys, preamble deps, why “÷ slices” is wrong). **North star:** [`18-mcp-payload-budget.md`](./18-mcp-payload-budget.md). **Orchestrator contract:** [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) (today: full `configBlock` on every call).

**Problem in one line:** each `use_figma` is a **stateless** full script, so `code ≈ |preamble| + |CONFIG| + |step engine| + |varGlobals|` every time. **More DAG slugs** split *work* and *host risk*; they do **not** remove repeated CONFIG or a full min file unless you **change assembly**.

---

## 1. What must stay true

- **Figma tool shape:** one `code` string per call; no documented “import previous run’s module” in the official MCP path ([`AGENTS.md`](../../../AGENTS.md), [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md)).
- **Staging files:** **`AGENTS.md`** allows **ephemeral** outputs (`--out` / `--emit-mcp-args` + parent **`Read`**) when needed — [**`21`**](./21-mcp-ephemeral-payload-protocol.md) + [**`22`**](./22-deterministic-agent-flows.md) (gates + recovery). Still **no** persistent scratch under **`skills/`**. Shrinking bytes needs CONFIG projection / engine split (below); files address **transport** only.
- **Handoff invariants** from the handoff section in [`13`](./13-component-draw-orchestrator.md) still hold after any trim (ids, `compSetId`, `phase-state`).

---

## 2. What actually costs bytes (in order to attack)

| Piece | Repeats per draw? | Typical leverage |
|-------|-------------------|------------------|
| **`CONFIG` block** | Yes — same verbatim block all **12** calls today (config note in [`13`](./13-component-draw-orchestrator.md)) | **High** if step only needs a subset of keys and engine can accept it. |
| **Step `*.min.figma.js`** | New file per *engine step* (step0, step1…); **same** step3 for both props passes | **High** if you **split the build** (thin doc-only, thin props-only). |
| **`preamble.runtime.figma.js`** | Every call | **Medium** — already small minified; optional “thin preamble” variants need a contract (see `10` §4). |
| **`REGISTRY_COMPONENTS`** in preamble | Every call, can be large | **Medium** — trim to entries needed for *this* step if engine allows (finalize-heavy today). |
| **Tuple / op list** (scaffold) | Per scaffold sub-slice | **Proven** pattern: small runtime + data ([`17-scaffold-sub-slice-states.md`](./17-scaffold-sub-slice-states.md), [`op-interpreter.figma.js`](../templates/op-interpreter.figma.js)). |

---

## 3. Solution tiers (do in roughly this order)

### Tier 0 — Honest baselines (required before refactors)

- **Measure the full `use_figma` arguments object**, not just the naked min file: [`scripts/check-use-figma-mcp-args.mjs`](../../../scripts/check-use-figma-mcp-args.mjs), [`scripts/check-payload.mjs`](../../../scripts/check-payload.mjs).
- **CI / dev:** keep [`npm run qa:step-bundles`](../../../package.json) as the raw-bundle dashboard; **`npm run qa:assembled-size`** emits per-slug **`code`** / MCP-wrapper byte rows from **real assembly** (`--emit-mcp-args`) against a **`--draw-dir`** (Tier 0 — report-only unless you wire thresholds).
- **Host cap:** if IDE transport is the real ceiling, use [`docs/mcp-transport-cursor-fallback.md`](../../../docs/mcp-transport-cursor-fallback.md) and [`scripts/probe-parent-transport.mjs`](../../../scripts/probe-parent-transport.mjs) before guessing limits ([`AGENTS.md`](../../../AGENTS.md)).

**Exit:** every change below has a before/after number for the **same** component fixture.

---

### Tier 1 — `assemble-slice` CONFIG projection (no draw-engine surgery first)

**Idea:** emit a **smaller JSON object** (or a second `__CC_CONFIG_DENSE__` global) for steps that only read a known subset, *only after* a static or runtime allowlist is safe.

- **Where:** [`scripts/assemble-slice.mjs`](../../../scripts/assemble-slice.mjs) + a single source of truth map `step → required CONFIG paths` (JSON or `.mjs` under `scripts/` or `skills/create-component/` — committed, not scratch).
- **Guardrails:** start with **read-only subset** for doc-only steps (e.g. drop `shadcnSourceHash`, verbose debug fields) if the engine never reads them in `_ccPhase === 2`. **Do not** strip keys the shared draw-engine top still reads (see `10` §3 — the shared prefix is the trap).
- **Win:** linear savings × **12** calls for whatever you remove *safely*.

**Prerequisite:** key-use audit from `10` §5+ or a short runtime log in dev.

---

### Tier 2 — Draw-engine refactor: “late entry” for doc phase

**Idea:** today much of the shared prefix still runs for doc work (`10` §3). **Refactor** so doc-only invocations **branch earlier** to a small bootstrap that only sets what doc steps need (ids, `layoutKey` guard, `doc` globals), *without* pulling full variant-grid helpers when `__ccDocStep` is in play.

- **Where:** `skills/create-component/templates/draw-engine.figma.js` + [`scripts/build-min-templates.mjs`](../../../scripts/build-min-templates.mjs) (if you emit a **separate** “doc entry” bundle).
- **Win:** drops **`|engine|`** for matrix/usage/props if those steps stop sharing the monolithic “everything” graph.

**Cost:** high — needs careful test matrix per archetype.

---

### Tier 3 — True engine split in `build-min` (largest structural win)

**Idea:** not every doc step needs the full `draw-engine` + every builder. `build-min-templates` already produces per-archetype **step0**; extend the **doc ladder** with **more min artifacts**, e.g.:

- `doc.step3.props-only.min.figma.js` — only `__ccDocFillPropertiesFromConfig` and helpers it needs.
- `doc.step4.matrix-only.min.figma.js` — only matrix + deps.

- **Map** new files in [`assemble-slice.mjs` `STEP_ENGINE_MAP`](../../../scripts/assemble-slice.mjs) and [slice runner §2](../../create-component-figma-slice-runner/SKILL.md).
- **CI:** keep `HARD_LIMIT - CONFIG_HEADROOM` checks per emitted file.

**Win:** can bring **8–20+ kB** class steps *down* toward the north star for those steps **without** relying on the host to cache anything.

---

### Tier 4 — Tuple / op pattern beyond scaffold

**Idea:** where logic is data-driven, prefer **op-interpreter + JSON ops** over inlining more minified imperative code (already used for scaffold in [`op-interpreter.min.figma.js`](../templates/op-interpreter.min.figma.js)).

- **Where:** new op vocabularies in [`op-interpreter.figma.js`](../templates/op-interpreter.figma.js) + smaller generators; **not** a second ad-hoc mini-language without QA.

**Win:** sub-linear growth when adding new doc chrome.

---

### Tier 5 — Registry and preamble diet

- **Per-step `REGISTRY_COMPONENTS`:** only resolve keys needed for *this* component draw (already partially implied by project); for **early** slices, a map with **only the current package** + icon pack entry if the preamble can be taught not to need the full monorepo list until finalize.
- **Align with** `10` §4 (preamble + `composes`).

---

## 4. Rollout plan (suggested)

| Phase | Work | Outcome |
|------|------|--------|
| P0 | Tier 0 metrics on 2–3 real components (chip + heaviest layout) + document baseline table | No behaviour change; numbers in this doc or `CHANGELOG` |
| P1 | Tier 1 safe CONFIG trimming (proven unused keys only) + tests | ↓ `CONFIG` bytes on all 12 calls |
| P2 | Tier 3 for **one** hot step (e.g. `step3` props-only split) + `qa:step-bundles` + `verify` | Proof of meaningful ↓ for two props calls |
| P3 | Tier 2/3 broadened to doc tail + Tier 4 where ops win | Move median slice toward 18 target |
| P4 | Tier 5 registry/preamble + polish | Shave last KB on every call |

---

## 5. Success criteria

- **Primary:** full MCP `use_figma` `arguments` UTF-8 size for **P50 and P95** real components, measured the same way as Tier 0.
- **Guardrails:** all existing `npm run verify` + `build:min:check` + `check-payload` on every emitted slice; no handoff regressions; no policy violations in `AGENTS.md`.
- **Stretch:** majority of doc slices in the **8–10 kB** *design* range where the engine work allows ([`18`](./18-mcp-payload-budget.md)) — Figma 50k remains the hard backstop, not the goal.

---

## 6. Related files (implementation touchpoints)

- [`scripts/assemble-slice.mjs`](../../../scripts/assemble-slice.mjs) — CONFIG injection, `varGlobals`, engine path.
- [`scripts/build-min-templates.mjs`](../../../scripts/build-min-templates.mjs) — bundle boundaries, byte budgets.
- [`templates/draw-engine.figma.js`](../templates/draw-engine.figma.js) — single biggest lever after assembly policy.
- [`EXECUTOR.md`](../EXECUTOR.md) — must stay consistent with any new assembly flags.

When this plan ships discrete milestones, add a one-line entry under [Unreleased] in the repo `CHANGELOG.md` and keep [`memory.md`](../../../memory.md) / [`AGENTS.md`](../../../AGENTS.md) transport notes in sync if behavior or measurement commands change.
