# DesignOps-plugin — agent memory (workflow index)

**Purpose:** Default bootstrap for agents in this repo. **Claude Code** loads **[`CLAUDE.md`](CLAUDE.md)** automatically; it points here. **Cursor:** see [`.cursor/rules/cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc). **Full policy:** [`AGENTS.md`](AGENTS.md) (MCP, subagents, cache, hosts).

---

## Authority stack (what to trust, in order)

1. **`memory.md`** (this file) — *where to go, in what order, what not to load*
2. **`AGENTS.md`** — *MCP payloads (inline default; ephemeral file staging per policy), Draw Engine manifests ([`skills/create-component/conventions/23-designops-step6-engine.md`](skills/create-component/conventions/23-designops-step6-engine.md)), canvas runner delegation, session split tables↔components, skill/cache sync*
3. **`skills/<skill>/SKILL.md` + linked shards** — *lazy-load only the phase or convention file the current step needs*

Do not paste entire `SKILL.md` files into context “just in case.” Follow each skill’s lazy-load table / router.

---

## Typical end-to-end flow (design team using the plugin)

| Phase | Command / mechanism | Notes |
|------|---------------------|--------|
| 1. Scaffold Figma file | **`/new-project`** | Foundations template, Drafts; then designer moves file per skill output. |
| 2. Variables + collections + style-guide canvas | **`/create-design-system`** | Steps 1–17; **Steps 15a–15c + 17** = committed `.min.mcp.js` bundles. |
| 3. Draw UI components | **`/create-component`** | One component per run to completion when possible; **time order** = [`skills/create-component/phases/`](skills/create-component/phases/) (**11** phase files **01–11**; **12** machine `use_figma` slugs in Step 6 — five scaffold → variants → doc, with **two** props-fill phases **07–08**); **`EXECUTOR.md`** = assembly + step IDs. |
| 4. Reconcile drift | **`/sync-design-system`** | **Axis A → B → C** (variables → components → Code Connect); one bundled decision pass; **pre-execution validation** between axes. |
| 5. Code Connect only (optional) | **`/code-connect`** | Often invoked from sync **Axis C**; standalone for mapping sweeps. |
| 6. Ops / QA | **`/accessibility-check`**, **`/new-language`**, **`/dev-handoff`** | As needed. |

**Handoff file:** `/new-project` → `/create-design-system` can write **`templates/agent-handoff.md`** locally (paths, file key). Other skills may read/update it — see [`README.md`](README.md) *Skill Chaining*.

**Design project artifacts (consumer repo):** e.g. **`tokens.css`**, **`tokens.json`**, **`.designops-registry.json`** for `/create-component` registry — not necessarily in *this* plugin repo. When exploring a **design / consumer** repo, avoid unbounded **`**/*`** `Glob` / full-tree scans; use known paths (`package.json`, `src/`, `templates/agent-handoff.md`) or one-level directory listing.

---

## Session choreography (token + MCP safety)

- **Run plugin commands in-agent:** When work uses this repo's **`scripts/`** or **`npm run`** entries (`assemble-slice`, `merge-handoff`, `verify`, etc.), **execute** them via the environment shell from the plugin root; do not default to “run this yourself” unless a gate blocks automation (e.g. no Figma MCP / `call_mcp` in the environment). Cursor: [`.cursor/rules/agent-run-designops-commands.mdc`](.cursor/rules/agent-run-designops-commands.mdc).
- **Same session asks for style-guide tables *and* `/create-component`:** Finish **Phase A** (all Step 15a–15c + 17 via **`Task` → [`skills/canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md)** — one Task per slug; 15c = **three** sequential Tasks) **before** Phase B (one component draw at a time). **`AGENTS.md`** *Session runbook*.
- **Parent thread must not** `Read` canvas **`.min.mcp.js`** or paste bundle text for Step 15/17 — **canvas-bundle-runner** only.
- **`/create-component` Step 6:** default **`node scripts/assemble-slice.mjs …`** (no flag) uses **`generate-ops`**: tuple ops + op-interpreter for **scaffold sub-slugs** (`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`), and delegates to the same committed `*.min.figma.js` engines for the other slugs. **`--legacy-bundles`** reads those min files directly (not for scaffold sub-slugs). See [`EXECUTOR.md`](skills/create-component/EXECUTOR.md).
- **`/sync-design-system` canvas refresh (6.Canvas.9b/9d):** same **canvas-bundle-runner** rule; after each runner Task, parent runs **§14 audit** slice for that page — [`skills/create-design-system/conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md).

---

## MCP anti-spiral (agents)

**System thesis:** Ending **constant looping** on large `use_figma` calls needs **smaller** per-slice bytes (see [`skills/create-component/conventions/18-mcp-payload-budget.md`](skills/create-component/conventions/18-mcp-payload-budget.md), target **8–10 kB**) and, longer term, **host-side** file-backed or chunked tool arguments. **Until vendors ship that**, this repo’s job is one decision tree (classify → measure with [`docs/mcp-transport-cursor-fallback.md`](docs/mcp-transport-cursor-fallback.md)) and **refusing speculative layers** — no extra MCP clients, proxies, or payload formats. Transport detail: [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) §6.7–6.8.

1. **Classify first** — Truncated tool JSON / `Unexpected end of JSON` → host or model re-emission of the wrapper, not “Figma broke.” Figma `ok: false` → file/plugin/access. Wrong frames or overlap → canvas geometry or handoff ids (often **before** transport).
2. **Measure once, then act** — Run `check-payload` / `check-use-figma-args` on the bytes you actually send; use `probe-parent-transport.mjs` before claiming a parent limit. Do not add a new runner pattern to “work around” an unproven cap.
3. **Prefer de-looping over new machinery** — Smaller slice or more `use_figma` rounds; or **writer → file in design repo → parent `Read` → one `use_figma`** per **[`21`](skills/create-component/conventions/21-mcp-ephemeral-payload-protocol.md)** + **[`13`](skills/create-component/conventions/13-component-draw-orchestrator.md)** + **[`08`](skills/create-component/conventions/08-cursor-composer-mcp.md)** §D.1. Avoid proxy MCP, gzip/bootstrap, and extra `Task` roles unless a doc explicitly promotes them after measurement.
4. **Op-interpreter + tuple ops** — A **wire-size** path ([`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) section 6.0), not a second orchestration stack. Monolith parity fixes (e.g. same page clears / handoff targets) belong in the interpreter or generator so **one** pipeline stays correct.

---

## Non-negotiables (Figma + layout)

- **MCP:** Prefer inline **`use_figma`** `code` in the tool call; **ephemeral** `assemble-slice --out` / `--emit-mcp-args` → parent **`Read`** is allowed when transport needs it (see [`AGENTS.md`](AGENTS.md)). Do **not** leave persistent staging under **`skills/`**. **Exception:** committed paths skills name (`*.min.mcp.js`, etc.).
- **`resize()`** resets auto-layout sizing to **FIXED**. Order: **`resize` → then** set `primaryAxisSizingMode` / `counterAxisSizingMode`. **VERTICAL** component roots: avoid 1px-tall masters. **HORIZONTAL** rows (e.g. doc **usage**): **counter axis = vertical** — use **`AUTO`** so height is not pinned at 1px. [**§0.10**](skills/create-design-system/conventions/00-gotchas.md).
- **Matrix specimen cells:** **counter `AUTO`** + **`minHeight`** — not only fixed 72px. [`skills/create-component/conventions/03-auto-layout-invariants.md`](skills/create-component/conventions/03-auto-layout-invariants.md) §10–10.2.
- **Style-guide tables:** header vs body cell recipes differ; **§0.5–0.7** gotchas + **§14 audit** before “done.” [`skills/create-design-system/conventions/00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md).

---

## Skills at a glance (all under `skills/`)

| Skill | Invocation | One-line role |
|-------|------------|----------------|
| [`new-project`](skills/new-project/SKILL.md) | `/new-project` | Scaffold Foundations Figma file + page hierarchy. |
| [`create-design-system`](skills/create-design-system/SKILL.md) | `/create-design-system` | Push tokens/variables; style-guide tables; Step 15a–c + 17 canvas bundles. |
| [`sync-design-system`](skills/sync-design-system/SKILL.md) | `/sync-design-system` | One reconcile **A→B→C**; bundled **AskUserQuestion** decisions; figma-only / full / code-to-figma scopes. |
| [`create-component`](skills/create-component/SKILL.md) | `/create-component` | Router + **§9**; **`REFERENCE-agent-steps.md`** = Steps 1–8; **`EXECUTOR.md`** = assembly + Figma `code` cap + disk manifest (**23**). |
| [`create-component-figma-slice-runner`](skills/create-component-figma-slice-runner/SKILL.md) | **Spec (Step 6)** | Assembly order + `handoffJson`; **default:** parent `use_figma` ×**12** (see `SLUG_ORDER` in [`merge-create-component-handoff.mjs`](scripts/merge-create-component-handoff.mjs)), **not** `Task` for oversized `call_mcp`. |
| [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) | **`Task` (preferred) or [16] parent** | One committed Step 15a / 15b / 15c-* / 17 bundle verbatim; fallback if subagent cannot emit. |
| [`code-connect`](skills/code-connect/SKILL.md) | `/code-connect` | Find/publish Code Connect mappings; often **Axis C** of sync. |
| [`accessibility-check`](skills/accessibility-check/SKILL.md) | `/accessibility-check` | WCAG-oriented Figma frame audit. |
| [`new-language`](skills/new-language/SKILL.md) | `/new-language` | Duplicate frame → locale page; translate text; RTL warning. |
| [`dev-handoff`](skills/dev-handoff/SKILL.md) | `/dev-handoff` | Figma/context → GitHub or Jira ticket. |

**Interactive contract:** Many skills require **`AskUserQuestion`** — **one tool call per decision moment**; don’t dump multi-part markdown prompts instead.

---

## `/create-component` transport (Figma `code` 50k; disk staging)

- **Default — 12 slices in parent:** **12** `use_figma` invocations, assembly per slice runner — `create-component-engine-{layout}.step0.min.figma.js` then **five** **scaffold** tuple-op slices, then `create-component-engine-doc.step2`…`step6` (legacy `step1` min is superseded at assembly; see [13](skills/create-component/conventions/13-component-draw-orchestrator.md)). See [`EXECUTOR` §0](skills/create-component/EXECUTOR.md).
- **Phased / one-shot in parent — two full-engine or one:** **`CONFIG`** + **`preamble.figma.js`** + **`create-component-engine-{layout}.min.figma.js`** in the **parent** per **`EXECUTOR.md`** (fewer Figma round trips than **twelve** slices).
- **Do not** inline **`create-component-engine.min.figma.js`** (full 7 archetypes) for a real draw — no headroom for CONFIG. See [`skills/create-component/templates/README.md`](skills/create-component/templates/README.md).
- **Sequence at orchestration:** separate **turns** for style-guide bundles vs **component draw**; don’t interleave in one parent turn. **Inside** Step 6, **default** = **parent** `use_figma` ×**12** (or `EXECUTOR` phasing) — not `Task` for payloads subagents can’t `call_mcp`. See [08](skills/create-component/conventions/08-cursor-composer-mcp.md).
- Validate payloads: **`npm run check-payload`**, **`npm run check-use-figma-args`** (from this repo’s `package.json`).
- **Measured host context (25k, σ, gzip experiments) and deeper protocol fixes (file-backed / chunked tool args):** [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) — reference only (see section 6.7 for vendor-level options); policy stays in [`AGENTS.md`](AGENTS.md) and [13](skills/create-component/conventions/13-component-draw-orchestrator.md).

---

## Maintaining *this* repository (plugin authors)

| Action | Command / file |
|--------|----------------|
| After editing **`draw-engine.figma.js`** or **`archetype-builders.figma.js`** | `npm run build:min` |
| After edits that affect generated SKILL blocks | `npm run build:docs` |
| Before merge / CI expectation | `npm run verify` (props + docs + min + step/doc bundle QA + **verify-cache**) — `qa:create-component-skill` runs **`check-payload` on all 24** `*.min.figma.js` engine artifacts |
| Mirror **`skills/`** + repo-root **`CLAUDE.md`**, **`memory.md`**, **`AGENTS.md`** to local Claude marketplace | `npm run sync-cache` / `bash scripts/sync-cache.sh` |
| Canonical tree | **`skills/**`** in **this** repo; cache under **`~/.claude/plugins/.../labs-design-ops/skills`** must match — **`AGENTS.md`** § Skill edits |

---

## Lazy-load map (avoid reading everything)

| If you’re doing… | Open first… | Then… |
|------------------|---------------|--------|
| Style-guide / variables | [`skills/create-design-system/CONVENTIONS.md`](skills/create-design-system/CONVENTIONS.md) | Only the phase + convention shard for the current step. |
| Geometry / pages / doc styles | [`skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) | As skill directs. |
| Gotchas / §0 index | [`skills/create-design-system/SKILL.md`](skills/create-design-system/SKILL.md) §0 + [`00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md) | §0.10 for resize/component/usage/matrix. |
| Component draw | **Composer / short context:** [`skills/create-component/conventions/08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md) · [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) | Then [`SKILL.md`](skills/create-component/SKILL.md) **§9** + [`REFERENCE-agent-steps.md`](skills/create-component/REFERENCE-agent-steps.md) as needed. |
| Sync reconcile | [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) router | **One** [`phases/*.md`](skills/sync-design-system/phases/) for current step. |
| MCP / bundles / Cursor roots | [`AGENTS.md`](AGENTS.md) | [`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) when debugging transport. |
| Cursor + Composer; Step 6 `use_figma` pain | [`08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md) | Then [`AGENTS.md`](AGENTS.md) if policy detail needed. |

---

## Host notes

- **Claude Code:** Figma MCP connector; **`CLAUDE.md`** → this file; optional **`.claude/settings.json`** for permissions / paths.
- **Cursor:** Workspace must include plugin root (or cache) so `skills/...` resolves; MCP **server** id from **`mcps/**/SERVER_METADATA.json`**; rules **`.cursor/rules/*.mdc`**. **Step 6 / Composer / large `use_figma` payload:** [preflight + `Task` + fallbacks](skills/create-component/conventions/08-cursor-composer-mcp.md).

---

*Keep this file dense. Add new **recurring** workflows or footguns in a line or table row; move long prose to `AGENTS.md` or the relevant `skills/*/conventions/*.md`.*
