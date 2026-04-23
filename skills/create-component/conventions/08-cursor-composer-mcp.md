# Cursor + Composer-class hosts — `use_figma` reliability (Step 6)

**Audience:** Agents and humans using **Cursor** with **Composer-class** (or other short-output) models for [`/create-component`](../SKILL.md). **Not** a second copy of assembly rules — those stay in [`../EXECUTOR.md`](../EXECUTOR.md) and [`../../../AGENTS.md`](../../../AGENTS.md).

**Goal:** Reliable **Step 6** (Figma MCP `use_figma` with ~40–43K inline `code`) by **adoption** of the repo’s intended pipeline — not by requiring one model to emit the full minified engine in the parent thread.

**Non-goals:** Do not block on Cursor raising per-tool-arg limits; do not require “Composer-only” success for Step 6. Success = a **known-good path** (delegation + preflight) with **documented fallbacks**.

---

## Sequential work vs one `use_figma` payload (clarify the “blob”)

**Two different levels:**

1. **Orchestration (session / chat)** — **Do** break work up **sequentially**: finish each **style-guide** `canvas-bundle-runner` `Task` on its own; for **`/create-component`**, run **six** `Task`s → `create-component-figma-slice-runner` **per component**; avoid one parent turn that chains unrelated large Figma calls. Tables, bundles, and component draws are **different jobs** — schedule them as **separate** steps. The parent should only pass a small **`configBlock`** + **`handoffJson`**, not re-assemble the minified engine in chat. **Fallback** (no viable `Task`): parent inline or preassembled per [`../EXECUTOR.md`](../EXECUTOR.md) **§0** — not a second subagent.

2. **Shipped component draw (Step 6 engine)** — On canvas, sections still appear in dependency order (Properties table, header, live ComponentSet tile, matrix, usage — see [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md)). **Delegated transport:** **six** `use_figma` calls via **six** `Task`s → [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md), each with **one** min slice from that skill’s **§2** map — see [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) and [§13](13-component-draw-orchestrator.md). **Parent inline (fallback):** **two** phased full-engine calls or one single-call full script per [`../EXECUTOR.md`](../EXECUTOR.md) **§0** (same template bytes, not a different workflow). **Anti-pattern:** uploading the **same** full engine blob on every call when the goal is small, fast steps.

**Anti-pattern (still true):** Ad-hoc **minification**, **trimming** built bundles, or **stub** `code` (`PLACEHOLDER`) to “fit” MCP — that breaks `check-payload` / Figma; see [`../EXECUTOR.md`](../EXECUTOR.md) and slice runner prohibitions.

**Allowed exception — parent preassembles files:** The **parent** may assemble CONFIG + preamble + `*.stepN.min.figma.js` (or full-engine phased blobs) to **OS temp** / workspace paths, run **`check-payload`**, then call **`use_figma` inline** or hand paths to a subagent that **only** `Read`s and submits — all spelled out in [`../EXECUTOR.md`](../EXECUTOR.md) **§0** / **§0.1** when the normal slice `Task` path hits host limits. Do not splice or trim minified engines ad hoc outside the build pipeline.

If slice `Task`s **abort**, **retry** the failing slice, then use **parent-preassembled** or **inline** per [`../EXECUTOR.md`](../EXECUTOR.md) — do not invent a second `Task` skill for the same draw.

---

## Task subagent failures — two different size limits

The Figma schema allows **`code` up to 50,000 characters** per call ([`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md)). That is **not** the only limit in play:

1. **Subagent / host MCP envelope** — Some Cursor (or `Task`) paths serialize the **entire** `use_figma` tool arguments as JSON. A real run failed at **~28.8K JSON** for a single call when using **§1b** two-phase with the **full** per-archetype bundle + CONFIG + preamble (~**44–45K** `code` for `control`, ~**40–42K** for `chip`). The failure mode is *host-side* truncation or rejection, not Figma’s 50K string cap.

2. **§1d step-0** is smaller (~**18K** minified engine for `control` + ~**6K** preamble + CONFIG) but **control + step0** can still land near **~26–29K** total `code` — close enough to (1) that **six steps** with **parent-preassembled** files is a safer handoff than expecting the subagent to **both** assemble and **send** the largest step.

3. **Never** use **`PLACEHOLDER`** in `code` to probe tool wiring — Figma throws `ReferenceError`; use a **tiny** real script (`return { ok: true, fileKey: figma.fileKey };`) for connectivity checks.

4. **Subagent `stdout` caps** — Using **`cat` / `echo` / shell** to dump a min bundle as proof can **truncate** (~20K in some runs). Use editor **`Read` on a file path** (or a short `wc -c`) for diagnostics, per [`16` troubleshooting](../../create-design-system/conventions/16-mcp-use-figma-workflow.md).

**Recovery order (same component):** **six-`Task` slice chain** (default) already minimizes per-call size → **parent preassembled** files or **parent inline** `use_figma` (same `configBlock`) per [`../EXECUTOR.md`](../EXECUTOR.md) **§0** → model hop (longer context for tool args) if still failing.

---

## ROI order (check in this sequence)

1. **Environment preflight** (below) — minutes; fixes false “MCP broken” when paths or server id are wrong.
2. **Session choreography** — finish style-guide canvas `Task`s before component draws; one component per wave when limits bite.
3. **`Task` → [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md)** (×6, parent [`§13`](../13-component-draw-orchestrator.md)) — **only** component Figma subagent; parent never `Read`s min slices in the **parent** thread. On transport failure, use **preassembled** or **inline** per [`../EXECUTOR.md`](../EXECUTOR.md) **§0**.
4. **Escalation** — model hop for the Figma call only, or parent inline per [`../EXECUTOR.md`](../EXECUTOR.md) when `Task` is unavailable.

The **slice** path uses **six** smaller payloads than phased full engine in the parent. For **timeout / execution-size** issues, see [`../../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) (50k cap on each `code` string).

---

## Phase 1 — Cursor preflight (copyable checklist)

Before drawing, confirm **all** of the following:

- [ ] **DesignOps plugin root is a workspace folder** — `File → Add Folder to Workspace…` so `skills/create-component/...` resolves. See [`.cursor/rules/cursor-designops-skill-root.mdc`](../../../.cursor/rules/cursor-designops-skill-root.mdc).
- [ ] **Figma MCP `serverIdentifier`** — read workspace `mcps/**/SERVER_METADATA.json` (or Cursor’s MCP panel); the bare name `figma` may **not** work. See troubleshooting in [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md).
- [ ] **Target file** — Figma file open; `fileKey` known (URL, handoff, or `--file-key` per [`../SKILL.md`](../SKILL.md)).

---

## Phase 2 — Default workflow: `Task` + slice runner

1. Parent completes Steps **1–5** and **4.7**; finalizes **`configBlock`** (verbatim `const CONFIG = { … };`, not `JSON.stringify` — functions like `applyStateOverride` must survive) and **`layout`**.

2. **Default — six `Task`s per component**, each loading [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md): pass `step` (`cc-variants` … `cc-doc-finalize`), `fileKey`, `layout`, `configBlock`, `createComponentRoot`, `registry`, and `handoffJson` per [slice runner **§0**](../../create-component-figma-slice-runner/SKILL.md) and [orchestrator **§4**](../13-component-draw-orchestrator.md).

3. Subagent: `Read` preamble + the **one** min row for that slice, run [`scripts/check-payload.mjs`](../../../scripts/check-payload.mjs), then **`use_figma`**. Parent runs [`SKILL.md` §9](../SKILL.md) on the **last** slice’s return + registry.

**If `Task` is missing, flaky, or times out in your Cursor build** — use Phase 3 fallbacks; do not assume the runner is unavailable “only when misconfigured.”

```mermaid
flowchart LR
  parent[Parent Steps 1 to 5]
  t0[Task slice cc-variants]
  t5[Task slice cc-doc-finalize]
  parent --> t0
  t0 --> t5
```

*(Six sequential Tasks in production; diagram collapses to first and last for brevity.)*

---

## Phase 3 — Session choreography and fallbacks

- **Tables then components** — If the same session includes **style-guide** Step 15a–c + 17 **and** `/create-component`, **finish** all canvas [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) `Task`s **first**; then run components. **Do not** interleave a full table `use_figma` and a full component `use_figma` in **one** parent turn ([`AGENTS.md`](../../../AGENTS.md) *Session runbook*).
- **One component per wave** — Prefer install → 4.7 → **six** slice `Task`s (or parent inline if `Task` is not viable) → §9 + registry before starting the next component in a **new** turn if output limits bite ([`../EXECUTOR.md`](../EXECUTOR.md) *Session / output limits*).
- **Model hop (Step 6 only)** — If transport still fails after preflight + slice `Task` chain (or **EXECUTOR** inline attempt), run **only the Figma step** with a model that tolerates long tool args (e.g. Claude in Cursor). Policy-neutral workaround.
- **Parent inline** — When `Task` is unavailable, follow [`../EXECUTOR.md`](../EXECUTOR.md) inline assembly order with the **same** `configBlock` / `layout` already prepared (no re-derive).

---

## Symptom → likely cause

| Symptom | Likely cause | See |
|--------|----------------|-----|
| `Read` fails on `skills/create-component/...` | Plugin root not in workspace | Preflight; [`cursor-designops-skill-root.mdc`](../../../.cursor/rules/cursor-designops-skill-root.mdc) |
| `MCP server does not exist` / wrong tool target | Wrong `serverIdentifier` | `mcps/**/SERVER_METADATA.json`; [`16` troubleshooting](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| `Unexpected end of JSON input` on tool call | Truncated or invalid **wrapper** JSON for large `code` — not always a Figma bug | [`AGENTS.md`](../../../AGENTS.md) *MCP transport (Composer-class)*; [`../EXECUTOR.md`](../EXECUTOR.md) *Short-context* |
| `ReferenceError: PLACEHOLDER` inside Figma | Tool call structured before full `code` was pasted (stub `code`) | [`EXECUTOR.md`](../EXECUTOR.md) — never call with placeholders; run `check-payload` first |
| Broken script after shell `cat` / long terminal dump | **Capped** stdout — silent truncation | [`16` § Troubleshooting](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) — use editor `Read`, not `cat` |
| `check-payload` passes, MCP still fails | Pass validates JS string; **entire** MCP args must JSON round-trip | [`AGENTS.md`](../../../AGENTS.md); `npm run check-use-figma-args` if available |

---

## Team validation (record per environment)

Use this to confirm **Phase 2** in your **Cursor** build and to compare before/after preflight (optional ROI note).

| Field | Value |
|--------|--------|
| Date | |
| Cursor version (About) | |
| Figma MCP `serverIdentifier` used | |
| `Task` → `create-component-figma-slice-runner` (six slugs) completed successfully (y/n) | |
| If n — fallback used (model hop / parent inline) | |
| Notes | |

---

## Optional measurement (lightweight ROI)

- **Qualitative:** Track Step 6 failures **before** vs **after** adopting preflight + `Task`-first + split sessions in a sprint.
- **Deeper (if needed):** Tag whether failures were **environment** (A), **transport/truncation** (B), or **model edited bytes** (C) using the table above.

---

## Authority links (do not duplicate)

| Topic | File |
|--------|------|
| Assembly order, 50k cap, short-context, inline fallback | [`../EXECUTOR.md`](../EXECUTOR.md) |
| Inline MCP, session runbook, Composer-class transport | [`../../../AGENTS.md`](../../../AGENTS.md) |
| `use_figma` workflow, cap, split calls, Cursor source root | [`16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| Slice runner + orchestrator, `configBlock` | [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md), [§13](13-component-draw-orchestrator.md) |
