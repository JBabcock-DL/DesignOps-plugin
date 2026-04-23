# DesignOps-plugin — agent memory (workflow index)

**Purpose:** Default bootstrap for agents in this repo. **Claude Code** loads **[`CLAUDE.md`](CLAUDE.md)** automatically; it points here. **Cursor:** see [`.cursor/rules/cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc). **Full policy:** [`AGENTS.md`](AGENTS.md) (MCP, subagents, cache, hosts).

---

## Authority stack (what to trust, in order)

1. **`memory.md`** (this file) — *where to go, in what order, what not to load*
2. **`AGENTS.md`** — *inline MCP payloads, canvas runner delegation, session split tables↔components, skill/cache sync*
3. **`skills/<skill>/SKILL.md` + linked shards** — *lazy-load only the phase or convention file the current step needs*

Do not paste entire `SKILL.md` files into context “just in case.” Follow each skill’s lazy-load table / router.

---

## Typical end-to-end flow (design team using the plugin)

| Phase | Command / mechanism | Notes |
|------|---------------------|--------|
| 1. Scaffold Figma file | **`/new-project`** | Foundations template, Drafts; then designer moves file per skill output. |
| 2. Variables + collections + style-guide canvas | **`/create-design-system`** | Steps 1–17; **Steps 15a–15c + 17** = committed `.min.mcp.js` bundles. |
| 3. Draw UI components | **`/create-component`** | One component per run to completion when possible; **`EXECUTOR.md`** assembly order. |
| 4. Reconcile drift | **`/sync-design-system`** | **Axis A → B → C** (variables → components → Code Connect); one bundled decision pass; **pre-execution validation** between axes. |
| 5. Code Connect only (optional) | **`/code-connect`** | Often invoked from sync **Axis C**; standalone for mapping sweeps. |
| 6. Ops / QA | **`/accessibility-check`**, **`/new-language`**, **`/dev-handoff`** | As needed. |

**Handoff file:** `/new-project` → `/create-design-system` can write **`templates/agent-handoff.md`** locally (paths, file key). Other skills may read/update it — see [`README.md`](README.md) *Skill Chaining*.

**Design project artifacts (consumer repo):** e.g. **`tokens.css`**, **`tokens.json`**, **`.designops-registry.json`** for `/create-component` registry — not necessarily in *this* plugin repo.

---

## Session choreography (token + MCP safety)

- **Same session asks for style-guide tables *and* `/create-component`:** Finish **Phase A** (all Step 15a–15c + 17 via **`Task` → [`skills/canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md)** — one Task per slug; 15c = **three** sequential Tasks) **before** Phase B (one component draw at a time). **`AGENTS.md`** *Session runbook*.
- **Parent thread must not** `Read` canvas **`.min.mcp.js`** or paste bundle text for Step 15/17 — **canvas-bundle-runner** only.
- **`/create-component` Step 6:** **`Task` → [`skills/create-component-figma-runner/SKILL.md`](skills/create-component-figma-runner/SKILL.md)** is the **default** whenever subagents exist; parent passes **`configBlock`** (verbatim `const CONFIG = { … };`, not `JSON.stringify`) + **`layout`**; parent never inlines the engine. **Fallback:** parent inline `use_figma` only if `Task` unavailable (**`EXECUTOR.md`**, **`AGENTS.md`**).
- **`/sync-design-system` canvas refresh (6.Canvas.9b/9d):** same **canvas-bundle-runner** rule; after each runner Task, parent runs **§14 audit** slice for that page — [`skills/create-design-system/conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md).

---

## Non-negotiables (Figma + layout)

- **MCP:** Inline **`use_figma`** `code` in the tool call — **no** repo scratch files to stage payloads. **Exception:** committed paths skills name explicitly (`*.min.mcp.js`, etc.). **`AGENTS.md`**.
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
| [`create-component`](skills/create-component/SKILL.md) | `/create-component` | shadcn-aligned component + **5-section doc frame**; **`EXECUTOR.md`** = assembly + 50k cap. |
| [`create-component-figma-runner`](skills/create-component-figma-runner/SKILL.md) | **`Task` (default for Step 6)** | Subagent: **`configBlock`** + preamble + engine + `check-payload` + one `use_figma`; parent runs §9 + registry. |
| [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) | **`Task` subagent only** | Run **one** committed Step 15a / 15b / 15c-* / 17 bundle verbatim. |
| [`code-connect`](skills/code-connect/SKILL.md) | `/code-connect` | Find/publish Code Connect mappings; often **Axis C** of sync. |
| [`accessibility-check`](skills/accessibility-check/SKILL.md) | `/accessibility-check` | WCAG-oriented Figma frame audit. |
| [`new-language`](skills/new-language/SKILL.md) | `/new-language` | Duplicate frame → locale page; translate text; RTL warning. |
| [`dev-handoff`](skills/dev-handoff/SKILL.md) | `/dev-handoff` | Figma/context → GitHub or Jira ticket. |

**Interactive contract:** Many skills require **`AskUserQuestion`** — **one tool call per decision moment**; don’t dump multi-part markdown prompts instead.

---

## `/create-component` transport (50k ceiling)

- Runtime = **`CONFIG`** + **`preamble.figma.js`** + **exactly one** **`create-component-engine-{layout}.min.figma.js`** (~32–35K).
- **Do not** inline **`create-component-engine.min.figma.js`** (full 7 archetypes) for a real draw — no headroom for CONFIG. See [`skills/create-component/templates/README.md`](skills/create-component/templates/README.md).
- Validate payloads: **`npm run check-payload`**, **`npm run check-use-figma-args`** (from this repo’s `package.json`).

---

## Maintaining *this* repository (plugin authors)

| Action | Command / file |
|--------|----------------|
| After editing **`draw-engine.figma.js`** or **`archetype-builders.figma.js`** | `npm run build:min` |
| After edits that affect generated SKILL blocks | `npm run build:docs` |
| Before merge / CI expectation | `npm run verify` (props + docs + min + **verify-cache**) |
| Mirror **`skills/`** + repo-root **`CLAUDE.md`**, **`memory.md`**, **`AGENTS.md`** to local Claude marketplace | `npm run sync-cache` / `bash scripts/sync-cache.sh` |
| Canonical tree | **`skills/**`** in **this** repo; cache under **`~/.claude/plugins/.../labs-design-ops/skills`** must match — **`AGENTS.md`** § Skill edits |

---

## Lazy-load map (avoid reading everything)

| If you’re doing… | Open first… | Then… |
|------------------|---------------|--------|
| Style-guide / variables | [`skills/create-design-system/CONVENTIONS.md`](skills/create-design-system/CONVENTIONS.md) | Only the phase + convention shard for the current step. |
| Geometry / pages / doc styles | [`skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) | As skill directs. |
| Gotchas / §0 index | [`skills/create-design-system/SKILL.md`](skills/create-design-system/SKILL.md) §0 + [`00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md) | §0.10 for resize/component/usage/matrix. |
| Component draw | [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) | Then `SKILL.md` sections as needed. |
| Sync reconcile | [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) router | **One** [`phases/*.md`](skills/sync-design-system/phases/) for current step. |
| MCP / bundles / Cursor roots | [`AGENTS.md`](AGENTS.md) | [`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) when debugging transport. |

---

## Host notes

- **Claude Code:** Figma MCP connector; **`CLAUDE.md`** → this file; optional **`.claude/settings.json`** for permissions / paths.
- **Cursor:** Workspace must include plugin root (or cache) so `skills/...` resolves; MCP **server** id from **`mcps/**/SERVER_METADATA.json`**; rules **`.cursor/rules/*.mdc`**.

---

*Keep this file dense. Add new **recurring** workflows or footguns in a line or table row; move long prose to `AGENTS.md` or the relevant `skills/*/conventions/*.md`.*
