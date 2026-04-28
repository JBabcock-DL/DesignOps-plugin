# MCP large-payload transport — solution architecture handoff (2026-04-27)

This document is the **full research roll-up** for turning the transport spike into **solution architecture** decisions. It does not replace [`AGENTS.md`](../AGENTS.md) or skill runbooks; it **informs** owners of **Figma MCP**, **Cursor**, and **DesignOps** skills.

**Primary references**

- **Canonical transport doc:** this file (measurements, §3–5 closure, **§6** follow-ons). **Removed (2026 cleanup):** separate research spin-offs under `docs/research/` (phase log, closure Q&A, Plan A pre-ship plan) — substance merged here or in normative skills ([`13`](../skills/create-component/conventions/13-component-draw-orchestrator.md), phase [`04`](../skills/create-component/phases/04-slice-cc-doc-scaffold.md); scaffold intermediate states folded into **`13`** **§1**).
- **When JSON fails before Figma:** [mcp-transport-cursor-fallback.md](./mcp-transport-cursor-fallback.md) (operator order).

---

## 1. Problem statement

`use_figma` tool arguments are **inline JSON** (notably a large `code` string, schema cap about **50k**). Failures in the field have been conflated with:

- **(A)** Host/bridge `call_mcp` cannot carry **N** bytes;
- **(B)** Model-mediated **re-serialization** of one tool call (JSON parse, truncation) at **~25k**; versus
- **(C)** Figma or plugin (file access, execution), distinct from (A)–(B); versus
- **(D)** On-disk **validation** only (`check-payload`, `check-use-figma-mcp-args`).

**Research goal:** Separate these and decide: **gzip in-plugin**, **file-path proxy MCP**, or **documentation and runbook** only, without changing the design-system canvas or `/create-component` engine geometry.

---

## 2. Hypotheses and outcomes

| Id | Hypothesis | Outcome |
|----|------------|--------|
| H1 | On-disk args can be valid while **model-mediated** `call_mcp` still fails for **~25k** `code`. | **Confirmed in part.** **5k** and **10k** `code` (5 228 and **10 279** B full serialized `use_figma` args) **succeed** in one parent `call_mcp` with **Figma** `ok: true` (2026-04-27). **25k** in **one** `call_mcp_tool` from the **same** Agent class was **not** completed: **~25.4k** UTF-8 serialized `arguments` **exceeds the practical single-assistant-message embed** here (output token + tool JSON; see §3.3). This is **not** the same as “Figma rejects” or universal “bridge rejects.” **Manual** Composer / parent with full JSON using `probe-args-real-25k.json` (sibling `figTest/`) remains the 25k capstone for `maxProvenSize`. |
| H2 | **Transport** (bytes to Figma MCP) is distinct from **Figma** (file open + plugin + `ok: true`). | **Confirmed** with real `fileKey` and plugin returns; distinguish **file access errors** from **JSON parse** errors. |
| H3 | **Gzip** or **base64** in `assemble-slice` by default reduces pain. | **Do not** default. Policy in [`AGENTS.md`](../AGENTS.md) and [`skills/create-component/conventions/08-cursor-composer-mcp.md`](../skills/create-component/conventions/08-cursor-composer-mcp.md): **no** gzip/bootstrap unless the **Figma** plugin run supports **`DecompressionStream`** and there is a **measured** need. |
| H4 | A **file-path proxy** in front of Cursor’s Figma OAuth session is a light lift. | **No-go** as a default. Chaining into Cursor’s connector is not supported; a **standalone** stdio → HTTP client needs its **own** OAuth to `mcp.figma.com` — Figma does not accept PAT; **removing** an in-repo proxy experiment confirmed **parent `Read` + official `use_figma`** is the practical path. |
| H5 | **`@file` in `use_figma.code`** avoids large JSON. | **Not supported** in shipping Figma MCP schema (only inline `code`). Chat **`@` file** is not tool-arg indirection. |

---

## 3. What was measured (empirical)

### 3.1 Static and CI

| Measure | Result |
|--------|--------|
| **25k** `code`, full serialized `use_figma` tool JSON | **25 000** B `code`, **25 429** B UTF-8 total; [`check-use-figma-mcp-args`](../scripts/check-use-figma-mcp-args.mjs) **PASS** on sibling `figTest/draw-transport-research/probe-args-real-25k.json` (SHA-256: `0fb0d9769f6f85de0393edb53465b389b3603b05255a04f6ee69b5e705282030`). |
| **Real** Foundations `fileKey` | `uCpQaRsW4oiXW3DsC6cLZm` |
| **create-component** slice sizes (CI) | Wrapped largest step ~**27.1k** B ( [`qa:step-bundles`](../package.json) ); still under **50k** Figma `code` cap; **check-payload** passes on min bundles. |

### 3.2 Parent-thread E2E (Cursor, `serverIdentifier` `plugin-figma-figma`)

Recorded in sibling `figTest/draw-transport-research/.transport-proof.json` (outside this plugin repo; add that folder to the workspace to open it) after successful [`probe-parent-transport.mjs --record`](../scripts/probe-parent-transport.mjs) runs. “Total MCP args” = UTF-8 `Buffer.byteLength(JSON.stringify({ fileKey, code, description, skillNames }), 'utf8')` for the object passed to `use_figma`.

| Session / probe | `code` size | Total serialized `use_figma` args | Figma plugin return | Notes |
|----------------|------------|----------------------------------|---------------------|--------|
| earlier closure | 2 000 B | 2 198 B (example) | `ok: true`, `observedCodeBytes: 2000` | real `fileKey`; full bridge + plugin path |
| 2026-04-27 spike | 5 000 B | 5 228 B | `ok: true`, `observedCodeBytes: 5000` | emitted from this repo, parent `call_mcp_tool` with full inline `code` |
| 2026-04-27 spike | **10 000 B** | **10 279 B** | `ok: true`, `observedCodeBytes: 10000` | **current `maxProvenSize` in proof file**; same parent path as 5k |
| 25 000 B on disk | 25 000 B | 25 429 B | (not in one agent `call_mcp` here) | **E2E not completed** in a **single** model-emitted `call_mcp_tool` in this session; see §3.3 |

**Proof and artifacts (sibling `figTest/draw-transport-research/`)**  
`.transport-proof.json` (includes `agentSession20260427.spikeVerdict`), `probe-args-real-25k.json`, optional `mcp-tool-call-wrapper.json` (one-line wrapper for manual tooling).

### 3.3 2026-04-27 spike: what blocked the 25k “last box”

The failure class is **not** “Figma rejects 25k” and **not** a failing `check-use-figma-mcp-args` on the canonical on-disk file.

- **Subagent** (`Task` path): a single `call_mcp_tool` with the full **~25.4k** UTF-8 serialized `arguments` object is **not** reliably materialized (e.g. `Unexpected end of JSON input`, or using a file path where an object is required). Cursor chat `@file` and `@path` strings in tool args are **not** MCP `code` indirection; they do not substitute for inline JSON.
- **Parent agent, same host**: inlining **20k+** B `code` in one `call_mcp_tool` hits **assistant output token** limits, producing empty or truncated tool JSON and the same parse error. **10k** `code` **does** pass as one inline invocation, setting an empirical **~10.3k**-class ceiling for this **“model re-emits the full blob in one turn”** path.
- **Implication:** Raising `maxProvenSize` toward **25 429** requires a path where the **full** tool-arguments JSON reaches the bridge **without** the model pasting the entire 25k `code` string in one message (e.g. human-driven Composer, a future **host** feature for large or file-backed args, or a **non-LLM** client that already holds the file bytes).

See `agentSession20260427` inside the proof JSON (continue vs pivot narrative is in **§4–5** and **§7** below).

---

## 4. Solution architecture (recommended)

### 4.1 Default (no new infrastructure)

1. **Parent** (or design-repo script) assembles `use_figma` per [`create-component-figma-slice-runner`](../skills/create-component-figma-slice-runner/SKILL.md) and [`EXECUTOR` §0](../skills/create-component/EXECUTOR.md).
2. **Ten** sequential **machine slugs** for Step 6 (four `cc-doc-scaffold-*` sub-slugs, then `cc-variants`, then five doc slugs through `cc-doc-finalize`); **handoffJson** between them per orchestrator.
3. **No** default **`Task`** subagent as **runner** for full **~25–30k** `code` (subagent transport often **cannot** emit full `call_mcp` args).
4. **Canvas** bundles: [`canvas-bundle-runner`](../skills/canvas-bundle-runner/SKILL.md) or parent `Read` of committed `.min.mcp.js` per [`16-mcp-use-figma-workflow.md`](../skills/create-design-system/conventions/16-mcp-use-figma-workflow.md).

**Rationale:** Measured and documented sizes sit **below** the Figma **~50k** `code` cap; on-disk checks pass. The main residual risk is **(B)**, not Figma or static validation.

### 4.2 Proof and anti-confabulation

- Before citing “parent can’t carry ~24k,” run [`probe-parent-transport.mjs`](../scripts/probe-parent-transport.mjs) and/or read `.transport-proof.json` in the draw directory.
- **Do not** invent host limits; if **25k** E2E is needed, perform **one** **Read** of the emitted JSON + **one** `use_figma`, then record:  
  `node scripts/probe-parent-transport.mjs --record --size 25000 --observed-bytes 25429 --target <draw-dir>` (use script-printed `total-mcp-args` if re-emitted).

### 4.3 When to add technical mitigations (pivot triggers)

| Trigger | Action |
|--------|--------|
| **Repeated** `Unexpected end of JSON` / truncated wrapper on **parent** with **proven** full args on disk | Escalate to **host**; consider **smaller** slices, **phased** `EXECUTOR` path, or **writer** subagent that writes to **design repo** + parent **Read** + `use_figma` (per [08-cursor-composer-mcp](../skills/create-component/conventions/08-cursor-composer-mcp.md), section D.1). |
| **25k** probe passes manually but **real** slice content still fails | Investigate **content-specific** escaping, not only raw size. |
| **Product** need for **>50k** `code` (unlikely if bundles stay under cap) | **Upstream** (Figma MCP: chunking, `code` ref to workspace file with explicit security model), not ad-hoc repo scratch files. |

### 4.4 Explicit non-goals (for this program)

- **Default** **gzip** in `assemble-slice` without **DecompressionStream** in plugin and measured need.
- **Default** **file-path proxy** in repo to **chain** Cursor’s Figma session.
- **Staged** `*-payload.json` / `.mcp-*` scratch in repo for tool args (see [`AGENTS.md`](../AGENTS.md)).

### 4.5 Cursor and Figma MCP identifiers

- Use **`serverIdentifier`** from the workspace `mcps/**/SERVER_METADATA.json` (e.g. `plugin-figma-figma`); do not assume the slug `figma` in all environments.

---

## 5. Closure for “last box” (25k E2E)

**Target:** One parent-thread `use_figma` with **25 000** B `code` and real `fileKey`, then `--record` with **observed** full serialized args (**25 429** B for the canonical `probe-args-real-25k.json` on the sibling `figTest` draw path).

**2026-04-27 status**

- **Closed for workflow purposes:** the spike produced a **measured** parent-thread ceiling on this model-mediated path: **10 279** B total serialized `use_figma` args with **Figma** `ok: true` and `observedCodeBytes: 10 000` (see §3.2, `.transport-proof.json` `maxProvenSize`). That is enough to refute ad hoc claims that “the parent can’t carry ~10k.”
- **Not closed at 25 429 B on this same path:** a **single** automated **`call_mcp_tool`** carrying the full **25k** `code` in one assistant message is **not** completed here, for reasons in §3.3 (output token + bridge JSON shape), **independent** of the Figma **~50k** `code` schema.
- **Remaining manual capstone:** one **Read** of `probe-args-real-25k.json` and **one** `use_figma` in a **parent** path that can pass the full JSON (e.g. **Cursor Composer** or any host that does not re-truncate the tool call), then:  
  `node scripts/probe-parent-transport.mjs --record --size 25000 --observed-bytes 25429 --target <draw-dir>`

---

## 6. Solution ideation (from research + spike)

This section **prioritizes** follow-on work. It does **not** change normative skills until owners adopt items explicitly.

### 6.0 Tier 0 — Op-interpreter + data ops (DesignOps-plugin, in progress 2026)

**Direction:** A **shared** Figma runtime ([`skills/create-component/templates/op-interpreter.figma.js`](../skills/create-component/templates/op-interpreter.figma.js) → [`op-interpreter.min.figma.js`](../skills/create-component/templates/op-interpreter.min.figma.js)) plus **tuple JSON ops** from Node ([`scripts/generate-ops.mjs`](../scripts/generate-ops.mjs)) for the **scaffold** slice; other slices use the **same** committed per-step / step0 `*.min.figma.js` artifacts **via** `generate-ops` (delegate — byte-identical to the pre-op ladder). [`assemble-slice.mjs`](../scripts/assemble-slice.mjs) defaults to this path; `--legacy-bundles` reads min files only. **Goal:** one assembly entrypoint, optional future compression. **Status:** sub–8 kB per-call hardening and full tuple ports for doc steps 2–6 remain follow-ups; committed min bundles stay canonical until then.

#### 6.0.1 Research — meeting **≤ 8 kB `code`**, **≤ 10 kB serialized `use_figma` args** (granularity + compression)

**Measured context (in-repo):** Parent-thread proof and §3.2–3.3: a **~10.3 kB** class **total serialized MCP object** is realistic on a model-mediated path. The **8 kB** target for the **`code` string** is stricter: the wrapper also carries `fileKey`, `description`, `skillNames`, and JSON delimiters, so the **10 kB full-args** cap and **8 kB code** cap are related but not identical — leave **~1–2 kB** headroom in `check-use-figma-mcp-args` for wrapper growth when tuning CI.

**Why the current op scaffold misses 8 kB (typical):**

1. **Runtime:** `op-interpreter.min.figma.js` is **~6 kB+** after minify (preamble contract, `bindColor`, `__ccRunOps`, handoff) — a **2.5 kB** runtime target implies aggressive dead-strip or a **smaller** op surface per slice.
2. **Data:** [`cc-doc-scaffold.mjs`](../scripts/op-generators/cc-doc-scaffold.mjs) expands the doc frame into many tuple ops with **verbose `props` objects** (repeated keys: `layoutMode`, `fillVar`, `primaryAxisSizingMode`, …). `JSON.stringify` of that list dominates once runtime is fixed.
3. **Delegates:** Slices that still embed full `create-component-engine-doc.stepN.min.figma.js` are **~19–25 kB `code` alone** — indirection does not shrink wire size until those become **data** or **more calls**.

**Tactics (combine as needed):**

| Tactic | Idea | Effect | Cost |
|--------|------|--------|------|
| **A. Finer-grained `use_figma` steps** | Split one logical step into **2+ MCP rounds** (e.g. scaffold → header, table, placeholders), each with fewer ops and optionally a **smaller** runtime | Each **`code`** drops with work split; more slugs in `SLUG_ORDER` and handoff | More parent turns; `merge` / `phase-state` / [`13`](../skills/create-component/conventions/13-component-draw-orchestrator.md) updates |
| **B. Part files (`*.partN`)** | When over `--budget`, emit `mcp-<slug>.part1.json` + `.part2` (op plan Phase 4); Figma runs sequential `use_figma` with shared handoff | Splits **wire** size per invocation | `merge` for sub-slugs, resume rules (partially sketched) |
| **C. Op compression (same # of Figma calls)** | Numeric opcodes + **positional** prop arrays; **symbol table** in preamble; **omit defaults** in JSON (interpreter supplies schema defaults) | Often **2–4×** smaller JSON | Generator + interpreter lockstep; tests |
| **D. Thinner runtime** | Per-profile builds (scaffold-only) or split helpers into optional chunks | Lowers fixed **per-call** cost | More `.min.figma.js` variants to maintain |
| **E. Port delegates** | Tuple ops + small runtime for doc 2–6 and variants (replace ~20k min bodies) | Addresses **largest** slices | Large port of [`draw-engine.figma.js`](../skills/create-component/templates/draw-engine.figma.js) / archetype builders |

**Suggested sequencing for green size gates:** (1) **(C)** on scaffold + tighten `qa:op-interpreter` toward 8000/10000. (2) If still over, **(A)** or **(B)** for scaffold, measure with `check-use-figma-mcp-args`. (3) Re-**probe** if parent-path limits are unclear (§3). (4) **(E)** + (A)/(C) for non-scaffold — delegates never hit 8 kB **code** without more rounds or a real op port.

**2026-04-28 (wire ops):** `generate-ops` + [`compact-scaffold-ops.mjs`](../scripts/op-generators/compact-scaffold-ops.mjs) emit **`__S`** (string table for `color/…` token paths) + **short frame/text keys** (`L`,`P`,`C`, …) and wire text (`[1,id,0,{Y,c,f,…}]`). Interpreter expands via `wF` / `wT` in [`op-interpreter.figma.js`](../skills/create-component/templates/op-interpreter.figma.js). **~15.5 kB** assembled for a 3-row properties fixture; **8 kB** still requires more splits or a much smaller runtime.

**Out of scope (reconfirmed):** gzip/base64 in `code` without a measured Figma plugin `DecompressionStream` path; scratch staging files for payloads ([`AGENTS.md`](../AGENTS.md)).

#### 6.0.2 Research — **more granular steps** (what is possible before implementation)

**Goal:** Additional `use_figma` rounds so each **`code`** stays under budget (e.g. 8 kB), without breaking the doc contract or resume tooling.

**Hard product constraints (do not violate without an explicit spec change):**

1. **Global DAG** — [`13-component-draw-orchestrator.md`](../skills/create-component/conventions/13-component-draw-orchestrator.md) **§1**: `cc-doc-scaffold-shell` → … → `cc-doc-scaffold-placeholders` → `cc-variants` → `cc-doc-component` → … Any new sub-step must sit **inside** this order (e.g. expand only the **scaffold** segment into more first-class slugs **before** `cc-variants`). You cannot run variant plane before `_PageContent` + `docRoot` + table shell + dashed reserves exist.
2. **Table / placeholder contract** — [`04-doc-pipeline-contract.md`](../skills/create-component/conventions/04-doc-pipeline-contract.md) **§2.2–2.2.1**: no empty table body mid-ladder; placeholder row count = `CONFIG.properties.length`; header row geometry must not collapse. A split “scaffold” is only valid if **every** intermediate state still has a legal table shell (see [`13-component-draw-orchestrator.md`](../skills/create-component/conventions/13-component-draw-orchestrator.md) scaffold table — same gates as legacy **§1.1** in the retired multi-call doc).
3. **Handoff IDs** — Resume for doc work uses `__CC_HANDOFF_PAGE_CONTENT_ID__` + `__CC_HANDOFF_DOC_ROOT_ID__` (and later `compSetId`, variant holder, etc.). The **first** granular call must create nodes whose ids are returned; **subsequent** calls must use the same `assemble-slice` **varGlobals** path as doc steps 2–6 today ([`assemble-slice.mjs`](../scripts/assemble-slice.mjs) `buildVarGlobals`), not the “first slice” branch that omits handoff ids.

**What can be split (high level):**

| Area | Split idea | Handoff / resume | Main risk |
|------|------------|------------------|-----------|
| **Scaffold (op)** | **R1** `_PageContent` + `docRoot` frames only · **R2** header (title, summary) · **R3** properties group + table + header row + body rows · **R4** three dashed placeholders | After R1 return `pageContentId` + `docRootId`; R2–R4 use doc-resume globals + `find`/`append` by name (same as draw-engine) | R1-only must leave `docRoot` structurally valid for R2; table must appear before `cc-variants` with full placeholder rows |
| **Scaffold (bytes only)** | Same Figma result, but **two** MCP JSON files (`mcp-cc-doc-scaffold.part1.json` / `.part2`) **one after another** in the same “step” with no merge slug change | Same return/merge as **one** `cc-doc-scaffold` if merge accepts a single logical step; else need **`.partN` merge** story | Today `mergeOne` rejects **`.part\*` merge**; part files are wire-only unless merge is extended |
| **Matrix** | Row groups or variant batches in separate calls | Need stable parent id (matrix frame) + optional “last row index” in handoff | `draw-engine` `buildMatrix` is one coherent pass; splitting needs idempotent row append and **merge** rules for `cc-doc-matrix.part1`, `.part2` |
| **Variants** | Holder frame first, then add `COMPONENT` children in batches | `variantHolderId` after first batch; second batch appends children | `combineAsVariants` timing: usually one **combine** after all components exist — last sub-step must own **combine**, earlier steps only **stage** |
| **Doc 2–6 (min engines)** | Only helps size if each sub-step ships **smaller min** or **tuple ops**; raw `step2..6` are already **per-step** minified | Same as matrix: new slugs or `.partN` | **Largest** win is **porting** to op + thin runtime (§6.0.1 **E**), not arbitrary vertical splits |

**Orchestration / repo touchpoints (any new machine slug or `.part`):**

- [`SLUG_ORDER`](../scripts/merge-create-component-handoff.mjs) — insert new slugs in **dependency order**; `pred` / `completedSlugs` / `phase-state` must stay consistent ([**13** §4](../skills/create-component/conventions/13-component-draw-orchestrator.md), [phase-state schema](../skills/create-component/conventions/schema/phase-state.schema.json)).
- **Return files** — `return-<slug>.json` naming; listReturnFiles / stale checks use `SLUG_ORDER` today.
- **Phases** — one doc under `skills/create-component/phases/` per slug if the slug is user-visible in the ladder.
- **`assemble-slice` / `generate-ops` / `verify-component-slice-map`** — map new slugs to engines or op generators.

**Recommendation (order of attack):**

1. **Scaffold only, 2–4 sub-slugs** (e.g. `cc-doc-scaffold-shell` → `cc-doc-scaffold-table` → `cc-doc-scaffold-placeholders`) — clearest **byte** win for the op-interpreter path, clearest handoff (`pageContentId` / `docRootId` after shell), aligns with **`13` + `04`** “smaller Plugin API runs.”
2. **Implement merge + phase-state for true `.partN` merges** (or treat sub-slugs as **first-class** slugs in `SLUG_ORDER` — simpler than multipart state machine).
3. **Matrix / variants** — only after scaffold sub-steps are stable; variant **combine** boundary is the tricky design review.

**Shipped (2026):** Plan A **first-class** scaffold sub-slugs (`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`) are in [`SLUG_ORDER`](../scripts/merge-create-component-handoff.mjs); normative runbooks (**13**, **EXECUTOR**, phase **04**) match. This section stays **research** for **further** splits (matrix, variants, `.partN` merge, thinner runtime).

**Normative runbooks (shipped scaffolds):** [`13` §1](../skills/create-component/conventions/13-component-draw-orchestrator.md), [phase 04](../skills/create-component/phases/04-slice-cc-doc-scaffold.md); merge / `SLUG_ORDER` in [`merge-create-component-handoff.mjs`](../scripts/merge-create-component-handoff.mjs). Further splits (matrix, variants, true `.partN` merge) remain research.

### 6.1 Tier 1 — DesignOps / consumer repo (low cost, immediate)

| Idea | Rationale | Risk |
|------|-----------|------|
| **Writer + parent** pattern as default for Composer-class agents | [`08-cursor-composer-mcp.md`](../skills/create-component/conventions/08-cursor-composer-mcp.md) D.1: subagent (or script) assembles to **design repo**; **parent** `Read` + **one** `use_figma`. Avoids subagent **emitting** ~26–30k+ `call_mcp` JSON. | Discipline: parent must do MCP, not the writer. |
| **Single npm script** in the consumer app | One command: `assemble-slice` + `check-payload` + write `mcp-*.json` to a **stable path**; parent only **Read**s and calls MCP. Reduces hand assembly errors. | Paths differ per repo; document once per install. |
| **Proof-first before delegating** | [`AGENTS.md`](../AGENTS.md): run [`probe-parent-transport.mjs`](../scripts/probe-parent-transport.mjs) or read `.transport-proof.json`; **forbid** inventing “parent transport limits” below **documented** `maxProvenSize` without a failed probe. | None if docs stay visible. |
| **Keep slices under one parent turn budget** | [`EXECUTOR.md`](../skills/create-component/EXECUTOR.md) phasing / one component per turn when the host is short on output. | Orchestration, not a transport fix. |

### 6.2 Tier 2 — IDE / host (Cursor) — product asks

| Idea | Rationale | Risk |
|------|-----------|------|
| **File-backed or blob-backed `use_figma` tool args** (explicit schema) | Would let the client send a **path** or **handle** the IDE reads server-side, avoiding **model re-emit** of 25k+ strings. Figma and DesignOps would need a **documented** contract (allowlist, max size, encoding). | Requires Figma + Cursor (or MCP spec) changes; long lead time. |
| **Larger or streaming tool-argument channel for MCP** from Agent | If the limit is the **message envelope** to `call_mcp`, raising it or chunking with idempotency would help 25k-class payloads. | Platform roadmap; not repo-controlled. |
| **Documented** max safe inline size for **Agent** | Align expectations with `maxProvenSize` from probes (e.g. **~10k** class in one shot on this path). | Per-host; must stay in sync. |

### 6.3 Tier 3 — Figma MCP (upstream)

| Idea | Rationale | Risk |
|------|-----------|------|
| **Optional** `codeUri` or workspace-relative `codeFile` (with allowlist) | Offloads huge `code` from the JSON body when the file is **already** on the designer machine. | Security model (path traversal, shared workspaces); protocol version. |
| **Confirm** 50k `code` is wire-stable when the **host** delivers full bytes | Our spike did **not** show Figma rejecting 25k; unblocks “host fixed” line of attack. | — |

### 6.4 Tier 4 — Stand-alone MCP / proxy (high cost, **not shipped**)

| Idea | Rationale | Outcome |
|------|-----------|--------|
| **Local stdio MCP + HTTP forward** to `https://mcp.figma.com/mcp` | Model passes a **short** file path; same JSON as inline `use_figma`. | **Removed from the repo (2026).** A standalone `node` process does **not** get Cursor’s OAuth; **Figma’s remote MCP** does not accept a **PAT** as Bearer; Figma’s catalog path is **OAuth in approved clients** only. **Practical fix:** **parent `Read` of `mcp-*.json` + one `use_figma` on the IDE’s Figma MCP** — no second server. |
| **gzip + DecompressionStream** in plugin | Only if measured need and [AGENTS.md](../AGENTS.md) exception. | Sandboxed API support; not a default. |

### 6.5 Decision matrix (when to do what)

- **Stuck on `Unexpected end of JSON` with on-disk `check-use-figma-mcp-args` PASS** → treat as **(B) model/bridge re-serialization** first: **Writer + parent Read**, or **Composer** one-shot, or **smaller** `use_figma` split — **not** gzip and **not** `Task` runner for the full slice.
- **Manual 25k probe succeeds in parent; real slice still fails** → pivot to **content-specific** escaping / `check-payload` / syntax (not raw size).
- **Product requirement for >50k `code`** → **upstream** Figma + host; not ad-hoc scratch files in `skills/`.

### 6.6 Near-term next steps (suggested)

1. Keep **default** create-component and canvas runbooks as today (§4.1).  
2. Add or tighten **one** consumer-repo **package.json** example for **emit → Read → `use_figma`** (optional small PR in docs / [08](...)).  
3. Run the **25k** proof **once** in **Composer** (or chosen parent path) to raise `maxProvenSize` to **25 429** if still desired for institutional confidence.  
4. Track **Cursor** / **Figma** public roadmap for **large tool args**; link back here when something ships.  
5. Revisit **Tier 4** only if Figma documents a **supported** way for a non-catalog client to obtain OAuth access tokens for `mcp.figma.com` **or** adds file-backed `use_figma` in the **IDE** (see Tier 2).

### 6.7 Deeper fix — what removes the model-in-the-middle bottleneck

This section is the **durable / host-side** answer aligned with **[`memory.md`](../memory.md) — MCP anti-spiral, system thesis:** repo work stays a **single decision tree** and **no speculative layers** until file-backed or chunked tool args exist.

The recurring “MCP spiral” is rarely **Figma’s ~50k `code` schema cap**. It is usually **(B):** the **assistant** must **re-emit** the full `call_mcp` JSON (large `code` string inside), and **that** path hits **output token limits, truncation, or copy errors** long before Figma sees the bytes. Repo-side tactics (more slices, op-interpreter, writer → file → parent `Read`) **narrow** the blob or **change who holds** the bytes; they do not change the protocol.

**Fix classes, strongest first (protocol / product):**

| Class | Idea | Who ships it | Removes spiral if… |
|--------|------|----------------|---------------------|
| **H1 — File-backed or handle-backed args** | MCP tool schema allows `codePath`, `codeRef`, or opaque **blob id**; the **IDE or MCP client** reads bytes from disk/workspace and forwards **full** JSON to Figma **without** the model concatenating a 25k string in chat. | **Cursor (or MCP spec) + Figma** agreeing on shape, allowlist, max size, encoding | The model only passes a **short** path or id; truncation in the assistant message no longer maps to broken `code`. |
| **H2 — Chunked `use_figma` (session)** | e.g. `use_figma_init` → N × `use_figma_append` → `use_figma_exec`; server-side reassembly before plugin. | **Figma MCP** (and host support for multi-call sequence) | Each assistant message stays small; total script size can exceed per-message limits. |
| **H3 — Native “run tool from workspace file”** | IDE feature: “invoke tool with arguments loaded from `*.json`” (no LLM body). | **IDE** | Same as H1 for local workflows; CI-friendly. |
| **H4 — Non-LLM MCP caller** | Script or action uses the **same** OAuth-connected Figma MCP stack but **never** routes payload through a model. | **Team automation** | Proves transport; does not fix agent UX unless paired with H1–H3. |

**Dependencies:** H1 and H2 need **coordinated** changes. A file path in tool args is **unsafe** without an allowlist (workspace root, no traversal, max bytes, optional hash). Chunking needs **idempotency** and **timeouts** so half-sent scripts cannot run.

**What DesignOps-plugin does until then (no spiral):**

1. **[`memory.md`](../memory.md) — MCP anti-spiral:** classify error → measure → prefer smaller wire or writer + parent `Read`; forbid new runner types on speculation.
2. **Tier 0–1 in this doc:** op-interpreter / tuple ops, extra slugs, consumer **assemble → stable path → parent `Read` + one `use_figma`** (sections 6.0 and 6.1 above).
3. **Track vendor roadmaps:** Cursor MCP / Composer large-args behavior; Figma MCP changelog for payload or chunking — link or cite here when a product ships H1-class support.

**Research prompts for owners (copy-paste):**

- **Cursor / MCP:** Is there (or will there be) a supported way to pass **large tool arguments** without embedding the full string in the model message (file URI, attachment id, multi-part tool call)?
- **Figma:** Would the official MCP accept **chunked** `code` assembly or an optional **`codeFile`** scoped to the connected workspace, with documented security limits?

### 6.8 How to implement host-side tool args (concrete checklist)

**Spec note:** MCP tools take **JSON arguments** per `inputSchema`; there is **no** standard “automatic file-backed parameter.” Host-side relief means the **client and/or server** move bytes **without** the model emitting the full `code` string.

**Blocked by today’s connector:** The official Figma **`use_figma`** tool expects **inline** `code` (schema `maxLength` 50000) and typically sets **`additionalProperties: false`**, so a DesignOps-only convention like `codePath` **cannot** be honored until **Figma** (and Cursor’s packaged connector) ships new schema + server logic.

| Track | Who implements | Work |
|--------|----------------|------|
| **A — Optional `codeFile` / workspace path on `use_figma`** | **Figma** (MCP server + bridge) | Extend tool schema: `code` **xor** `codeFile` (or `codeUri` with strict scheme). Server reads file from **allowlisted roots** only (no `..`, cap size to plugin limit, optional hash). Same execution path as today’s `code` string after read. |
| **B — Client-side hydration** | **Cursor** (or any MCP client) | Before `tools/call`, expand a **documented** indirection (short path, blob id, or attachment) into full `arguments` so the **model** never re-types 25k+ characters. Requires product API + docs; not solvable inside this repo alone. |
| **C — Chunked session API** | **Figma** + possibly client | e.g. `use_figma_session_open` → `…_append` × N → `…_execute`. Server buffers until execute; enforce TTL, idempotency, max total size vs 50k plugin cap. |
| **D — Until A/B/C** | **DesignOps / consumer** | `assemble-slice` → file on disk; **parent `Read` + one `use_figma`**; or **non-LLM** MCP client where your org has a supported token path ([§6.4](#64-tier-4--stand-alone-mcp--proxy-high-cost--not-shipped)). |

**Suggested MVP:** **Track A** on Figma’s official MCP (smallest conceptual change: one read on the server, model sends only a short path). **Track B** helps any large tool arg, not only Figma, but depends on Cursor’s roadmap.

**Track E — Removed (non-viable for IDE parity):** A standalone Node **`use_figma`** invoker (Desktop MCP + Streamable HTTP) was **shipped and removed** — it could not replace the IDE’s OAuth/session for Figma’s remote MCP. The supported mitigation is **more granular draw slices** (target **8–10 kB** per call where practical): [`skills/create-component/conventions/18-mcp-payload-budget.md`](../skills/create-component/conventions/18-mcp-payload-budget.md).

---

## 7. Stakeholder matrix

| Role | Takeaway |
|------|----------|
| **Design system / create-component** | **Expand** the draw ladder with **smaller** per-slice `code` (north star **8–10 kB** per [`18-mcp-payload-budget.md`](../skills/create-component/conventions/18-mcp-payload-budget.md)); more sub-slugs / `.partN` as needed. Parent **`Read` + one `use_figma`**. Proof file to stop false “transport” delegation. |
| **Cursor / IDE platform** | Measured in spike: one-shot **~10.3k**-class (10 279 B serialized args) E2E on model-mediated `call_mcp`; 25k in one **Agent** turn not completed here. Residual limit is **model/bridge re-serialization** for very large `call_mcp`, not Figma’s 50k cap. Optional: **documented** large-arg path (file indirection) at MCP layer. |
| **Figma MCP** | **No** change required for **~25–30k** class payloads **if** the host delivers full inline `code`. Optional future: **args file** with explicit security for **>50k** edge cases. |
| **Security / platform** | In-repo file-proxy for Figma was **removed**; duplicate OAuth to `mcp.figma.com` is not viable for a bare stdio helper without a token source. |

---

## 8. Revision

| Date | Change |
|------|--------|
| 2026-04-27 | Initial SA handoff: measured results, 25k agent-embed limit note, default architecture, pivot triggers, stakeholder matrix. |
| 2026-04-27 (b) | Spike compiled: 5k/10k parent E2E, `maxProvenSize` **10 279**; §3.3 blockers for 25k one-turn embed; new §6 **Solution ideation** (tiers 1–4, decision matrix, next steps). Stakeholder table updated. |
| 2026 (proxy removal) | In-repo `tools/mcp-figma-file-proxy` **removed**; Figma remote MCP requires OAuth in catalog clients, not PAT; use **parent `Read` + official `use_figma`**. |
| 2026-04-28 (c) | **§6.0.2** — granular sub-steps: constraints, scaffold/matrix/variant split ideas, repo touchpoints (pre-code). |
| 2026-04-28 (d) | Link to plan-A from §6.0.2 (file since **removed** — see 2026-04-28 (f)). |
| 2026-04-28 (e) | **§6.0.2** hard constraints + **§7** stakeholder row: **12-slice** ladder (five scaffold + rest); endnote — Plan A first-class sub-slugs **shipped** in repo runbooks. |
| 2026-04-28 (f) | **Doc cleanup:** removed `docs/research/*` spin-offs; **this file** is the only long-form MCP transport write-up; path is `docs/mcp-transport-solution-architecture-2026.md`. §4.1 and §6.0.1 cross-links updated. |
| 2026-04-27 (g) | **§6.7** — Deeper fix: H1–H4 (file-backed / chunked / IDE / non-LLM caller), dependencies, DesignOps stance until vendors ship; owner research prompts. **`AGENTS.md`** cross-link to anti-spiral + §6.7. |
| 2026-04-27 (h) | §6.7 lead: explicit link to `memory.md` system thesis (one tree, no speculative layers until host-side args). |
| 2026-04-27 (i) | **§6.8** — Implementation checklist for host-side tool args (Figma `codeFile`, Cursor hydration, chunked session, repo stopgap). |
| 2026-04-27 (j) | **§6.8** — Track E: **removed** standalone invoker; link [`18-mcp-payload-budget.md`](../skills/create-component/conventions/18-mcp-payload-budget.md). |
| 2026-04-28 (h) | **Track E** doc: removed `buildable-figma-payload-path` + `figma-mcp-invoke`; micro-slice budget is canonical. |
