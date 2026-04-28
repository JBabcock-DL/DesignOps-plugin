# MCP ephemeral payload protocol (normative — create-component Step 6 + related)

**Procedural order (step-by-step machine):** [`22-deterministic-agent-flows`](./22-deterministic-agent-flows.md).

**Audience:** Every agent invoking Figma **`use_figma`** for `/create-component` or debugging transport.  
**Companion:** [`08-cursor-composer-mcp`](./08-cursor-composer-mcp.md) **§** writer vs parent; [`20-mcp-payload-shrink-solution`](./20-mcp-payload-shrink-solution.md) (byte tiers); [`AGENTS.md`](../../../AGENTS.md) **MCP payloads** section.

---

## Two separate problems — do not conflate them

| Axis | Question | Handles |
|------|----------|---------|
| **A — Transport** | Can this host pass **complete** MCP tool JSON **without truncation** when `code` is large? | Inline `code` vs **writer → `--out` / `--emit-mcp-args`** → parent **`Read`** → `call_mcp` ([`08`](./08-cursor-composer-mcp.md) §A, §D.1); [`docs/mcp-transport-cursor-fallback.md`](../../../docs/mcp-transport-cursor-fallback.md) |
| **B — Wire size** | Is the **assembled** slice still too heavy *even after* reliable transport? | More [`18`](./18-mcp-payload-budget.md) rounds, scaffold sub-slugs, [`20`](./20-mcp-payload-shrink-solution.md) tiers (CONFIG projection, engine split, tuples) |

**Rule:** Fixing **B** alone does **not** fix pasted/truncated tool JSON; fixing **A** alone does **not** remove repeated CONFIG/engine bytes. Agents run **measurement** (`check-*`, probes) against the **failure class** they observe.

---

## Decision tree (per slice — follow in order)

```mermaid
flowchart TD
  start[Slice N ready to draw] --> classify{Symptom?}
  classify -->|"Unexpected JSON / truncation / paste failure"| axisA["Axis A — transport"]
  classify -->|"Valid JSON reaches Figma but slow/hot context"| axisB["Axis B — orchestration"]
  classify -->|"Figma runs but perf / quotas"| axisB
  classify -->|"ok: false from Figma / plugin"| figmaDiag[Diagnostics / handoff / ids]

  axisA --> writer["Writer: assemble-slice → disk in design-repo draw/"]
  writer --> chk["check-payload + check-use-figma-mcp-args"]
  chk --> okChk{"Pass?"}
  okChk -->|no| fixAsm[Fix assembly / inputs — not transport]
  okChk -->|yes| parentRead["Parent: Read full bytes → ONE call_mcp"]
  parentRead --> doneA[finalize-slice merge handoff]

  axisB --> smaller["Prefer more smaller slugs — 13 DAG — not trimming engines"]
  smaller --> roadmap["If still over budget — 20 tier plan + measure"]

  roadmap --> tier[Implement next safe tier with before/after size]
```

1. **Classify:** Is the failure **`Unexpected end of JSON`** / truncated args → **Axis A**. Is the failure **size / maintainability / north-star budget** → **Axis B**.
2. **Axis A:** Use the **explicit file-backed transport** sequence below — **never** loosen validation or invent a gzip/bootstrap layer ([`08`](./08-cursor-composer-mcp.md) sandbox anti-pattern).
3. **Axis B:** Follow **`13`** scaffold + doc ladder granularity; apply **`20`** tiers with measured baselines (**Tier 0** first).
4. **Confabulated parent caps:** **[`scripts/probe-parent-transport.mjs`](../../../scripts/probe-parent-transport.mjs)** once **before** changing runner strategy ([`AGENTS.md`](../../../AGENTS.md)).

---

## Ephemeral-file transport sequence (canonical — Axis A)

Use this checklist **for every slice** when the parent prefers **not** to embed `code` in chat, or when the IDE has truncated tool JSON in the past.

| Step | Who | Action |
|:---:|:---:|---|
| 1 | Agent | Resolve a **staging root** outside **`skills/`** in **this repo**: prefer **consumer design repo** (e.g. `<project>/designops-draw/<run-id>/` or existing `draw/`/`mcp-exports/`), **or** OS temp. **Never** commit scratch under **`skills/`** |
| 2 | Shell | `node scripts/assemble-slice.mjs … --out <staging>/<slug>.code.js [--emit-mcp-args <staging>/mcp-<slug>.json]` from **DesignOps-plugin** root (paths to `--config-block`, `--handoff`, `--registry` point at the consumer project as today) ([`assemble-slice.mjs` header](../../../scripts/assemble-slice.mjs)) |
| 3 | Shell | Scripts run **`check-payload`** + **`check-use-figma-mcp-args`** by default (**exit ≠ 0** → fix inputs; do **not** skip unless you documented `--skip-*` reason) |
| 4 | **Parent** only | **`Read`** the **`--out`** file **or** `mcp-<slug>.json` (full file; **no** shell `cat` of huge blobs for truth) → **`call_mcp` `use_figma`** with the same `{ fileKey, code, … }` bytes the JSON encodes |
| 5 | **Parent** | `finalize-slice` / [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs) per **`13`** — update **`handoff.json`** on disk; do not paraphrase large returns |
| 6 | Agent | **`Delete`** staging files **after** successful merge when the designers do not need retained debug artifacts (`gitignored` dirs are fine leaving until session end) |

**Canonical names:**

- **`mcp-<step-slug>.json`** alongside `--emit-mcp-args` (e.g. `mcp-cc-doc-props-1.json` if slug includes hyphen numbering per merge script).

- **`assemble-slice` exit codes** `10`, `11`, `17`: treat as blocking — **`17`** means clean non-canonical siblings in the emit directory ([`assemble-slice.mjs`](../../../scripts/assemble-slice.mjs)).

**Still forbidden:**

- **`Task` / subagent calling `call_mcp` / `use_figma`** except rare proof that subagent emits full MCP args (**default = parent**) ([`08`](./08-cursor-composer-mcp.md) §D.1).
- **`PLACEHOLDER`** or hand-trimmed `code` to “fit.”
- **Parallel naming schemes** in the same **`--emit-mcp-args` directory** (`mcp-invoke-*.json`, etc.) — script **exit 17** exists to enforce this ([`assemble-slice`](../../../scripts/assemble-slice.mjs)).

---

## Pairing ephemeral transport with shrink roadmap (Axes A + B)

| If you … | Then … |
|---------|--------|
| Only need **reliable MCP delivery** | **§ Ephemeral-file transport sequence** alone is enough (`Read` preserves full UTF-8/length). |
| Need **smaller sustained wire size** | After transport works, execute **`20`** **Tier 0** baselines (`check-use-figma-mcp-args`, optional CI sample row), then tiers **1–4** — **committed** projection maps under `scripts/` / repo, **not** ad hoc JSON strips in **`skills/`** scratch files. |
| Hit **Composer / short-output limits** while **only** shrinking bytes | Prefer **narrower scaffold sub-slugs** and **`13`** sequencing before inventing wrappers ([`memory.md`](../../../memory.md) MCP anti-spiral). |

Ephemeral paths **carry** validated bytes; **`20`** **changes assembly** — both may apply to the **same** component over time without contradiction.

---

## Where this plugs into global policy

| Document | Relationship |
|---------|----------------|
| [**`AGENTS.md`**](../../../AGENTS.md) **MCP payloads** | Declares prefer-inline + **explicitly OK ephemeral** carries; forbids **`skills/`** persistent scratch |
| [**`08`**](./08-cursor-composer-mcp.md) | Writer ↔ parent MCP ownership, recovery order |
| **`20`** | Byte-reduction tiers **orthogonal** to file carriers |
| [`docs/mcp-transport-cursor-fallback.md`](../../../docs/mcp-transport-cursor-fallback.md) | IDE-specific fallback ladder |
| **`13`** **§** handoff / merge | Invariants unchanged when using files |

---

## Self-check before closing a draw

- [ ] Every slice passed **`check-payload`** (or recorded exit with `--skip` reason reviewed).
- [ ] **`mcp-*.json`**, if used, **`JSON.parse`**’d in tooling pass or parent without truncation symptom.
- [ ] **`handoff.json`** updated via **merge scripts**, not pasted return blobs.
- [ ] No orphaned scratch tracked under **`skills/`** **in DesignOps-plugin** for “clipboard” payloads.

