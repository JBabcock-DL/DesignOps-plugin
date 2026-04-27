# MCP large-payload transport — closure report

**Date:** 2026-04-27  
**Scope:** Close the research track in [`mcp-large-payload-transport-2026.md`](./mcp-large-payload-transport-2026.md) with a clear bottom line and a **continue vs pivot** recommendation for the DesignOps plugin and `/create-component` defaults.

---

## Goal (from the plan)

Understand where large `use_figma` tool arguments can fail:

1. **(A)** Cursor / host bridge cannot carry **N** bytes in one `call_mcp`, **vs**
2. **(B)** Only the **model-mediated** path breaks (re-encode, truncation) for **~25k** `code`, **vs**
3. **Figma’s** separate **~50k** `code` schema cap and **check-payload** (string-only) success.

Use that to decide whether to invest in **gzip**, a **file-path proxy MCP**, or **documentation / runbook** only.

---

## Hypothesis (prior research)

**H1:** On-disk args pass [`check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs), but **Cursor/Composer** can still throw **JSON parse errors** when the **model-mediated** `call_mcp` path serializes a **~25k** `code` string.

**H2:** Distinguish **transport** (bytes reach Figma MCP) from **Figma** (file access, plugin run, `ok: true`).

---

## What we measured (empirical)

| Check | Result |
|--------|--------|
| **25k on disk** | `probe-args-real-25k.json`: **25 000** B `code`, **25 429** B full UTF-8 tool JSON — [`check-use-figma-mcp-args`](../../scripts/check-use-figma-mcp-args.mjs) **PASS** |
| **Real `fileKey` (Foundations)** | `uCpQaRsW4oiXW3DsC6cLZm` — `probe-parent-transport.mjs` **`--file-key`** added for emit |
| **Tiny script in real file** | `use_figma` returns **`{"ok":true,...}`** — file open + plugin run **OK** (not a transport error) |
| **2k synthetic probe, same file** | Parent `call_mcp` with emitted args returns **`ok: true`**, **`observedCodeBytes: 2000`**, **`probe: 'parent-transport'`** — **full round trip** (bridge + Figma + plugin) |
| **5k / 10k parent E2E (2026-04-27)** | **5 228** and **10 279** B full serialized `use_figma` args; plugin returns `ok: true` with matching `observedCodeBytes` — **recorded** in `figTest/draw-transport-research/.transport-proof.json` as `maxProvenSize` = **10 279** |
| **25k in one model-mediated `call_mcp` from this agent** | **Not completed here** — subagent and parent one-shot with **25k+** B inline `code` hit **bridge JSON parse** / **output token** limits, not Figma. **10k** `code` in one turn **did** work; 25k requires a path that does not re-emit the full blob in one message (see [solution architecture §3.3, §6](./mcp-transport-solution-architecture-2026.md)) |

**Intermediate sizes on disk (for your own one-shot tests):** `probe-args-real-6k.json` (~6238 B), `probe-args-real-12k.json` (~12.3k B), and `probe-args-real-25k.json` — all valid; run **Read → one `use_figma`** in the **parent** and `--record` with the printed `total-mcp-args` size.

---

## Phase gates (from plan) — short status

| Phase | Outcome |
|--------|---------|
| **0** Baseline | **2k** E2E proven with real file; **25k** validated **on disk**; **25k** single parent `call_mcp` = **you run** one Read + one call (path above) to max out `maxProvenSize` in `.transport-proof.json` |
| **1** Cursor `@file` / CLI | **No** documented `@file` indirection for Figma `use_figma` `code` — see [Cursor MCP docs](https://cursor.com/docs/mcp) |
| **2** Gzip + base64 | **Do not** add to `assemble-slice` by default; [08](../../skills/create-component/conventions/08-cursor-composer-mcp.md) + [AGENTS](../../AGENTS.md) already set policy |
| **3** File proxy | **No-go** to chain into **Cursor’s** Figma session; **optional** stand-alone HTTP client + OAuth is a **separate** product (see [tools/mcp-figma-file-proxy/README.md](../../tools/mcp-figma-file-proxy/README.md)) |
| **4–5** Docs + fallback | **Done:** [AGENTS](../../AGENTS.md), [EXECUTOR](../../skills/create-component/EXECUTOR.md), [08](../../skills/create-component/conventions/08-cursor-composer-mcp.md), [mcp-transport-cursor-fallback.md](../mcp-transport-cursor-fallback.md) |

---

## Bottom line

1. **Figma and disk validation are not the weak link** for “class ~25k” slices: the tool schema and `check-use-figma-mcp-args` are consistent with real draws.
2. **A genuine “large payload” risk remains** in **(B)** the **model-mediated** re-emission of **exact** `call_mcp` JSON for **~25k**-class sizes — we **did** prove **10k** `code` (**10 279** B total args) E2E in the parent, and we **did** prove **on-disk 25k** validity; we **did not** prove **25k** in **one** automated Agent message in this session.
3. **Default DesignOps guidance stays:** **parent** `Read` + `use_figma` (or design-repo assembly), **not** `Task` as a runner for full slices, **not** gzip by default, **not** a required file-proxy.
4. **One manual step** remains for **empirical** closure at **25k**: in Cursor **parent**, `Read` `figTest/draw-transport-research/probe-args-real-25k.json` → **one** `use_figma` with parsed args → on success:  
   `node scripts/probe-parent-transport.mjs --record --size 25000 --observed-bytes 25429 --target c:/Users/jbabc/Documents/GitHub/figTest/draw-transport-research`  
   (adjust path if your draw dir moves.)

---

## Continue or pivot?

| Question | Recommendation |
|----------|------------------|
| **Continue** building skills, `assemble-slice`, parent Step 6 seven-slice flow, and docs as today? | **Yes.** Evidence does **not** support replacing the default path with gzip, a proxy, or subagent runners. |
| **Pivot** to engineering a **file-proxy** package or **gzip** in the pipeline? | **No** as a default. **Revisit** only if **(i)** your **manual 25k** parent call repeatedly fails with **JSON parse** (not Figma), and **(ii)** fallbacks in [mcp-transport-cursor-fallback.md](../mcp-transport-cursor-fallback.md) are insufficient. |
| **Pivot** research to **“real slice content re-encoding”** (not probe filler)? | **Optional follow-up** if **25k probe** passes in parent but **real** `create-component` slices still fail — then the failure mode is likely **content-specific** escaping, not raw size. |

**Summary:** **Continue the build** on the current architecture; use the **probe + proof file** to stop confabulated “parent can’t carry ~24k” and **pivot** only on **measured** failures after the **25k** parent step and real draws, not on the absence of a full agent-automated 25k `call_mcp` in this thread.

---

## Artifacts (paths)

- Draw dir: `figTest/draw-transport-research/` (sibling to this repo — add to workspace to `Read` probes)
- Proof file: `.transport-proof.json` (update with `--record` after 25k success)
- Scripts: [`probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) (`--file-key` supported)
- Longer narrative: [mcp-large-payload-transport-2026.md](./mcp-large-payload-transport-2026.md)
- Solution architecture handoff: [mcp-transport-solution-architecture-2026.md](./mcp-transport-solution-architecture-2026.md)

---

## Last box (25k E2E) — 2026-04-27 agent note (compiled)

- **10k** `code` in **one** parent `call_mcp` **succeeded**; proof **recorded** with **`maxProvenSize` = 10 279** (`.transport-proof.json`).
- The **25k** on-disk file (`probe-args-real-25k.json`, **25 429** B, SHA-256 `0fb0d9769f6f85de0393edb53465b389b3603b05255a04f6ee69b5e705282030`) was **not** run as **one** automated `call_mcp_tool` in this interface: the **entire** JSON does not fit a **single** model-mediated tool invocation (same class of failure as `Unexpected end of JSON` when the tool body is empty/truncated). This does **not** show Figma rejects 25k.
- **To finish the last box** at 25 429 B: use **Composer** (or any path that supplies full args without the model re-typing 25k in one block), `ok: true` with `observedCodeBytes: 25000`, then `probe-parent-transport.mjs --record --size 25000 --observed-bytes 25429 --target <draw-dir>`.
- **Product ideation** for longer-term mitigations: [solution architecture §6](./mcp-transport-solution-architecture-2026.md) (Writer + parent, host file-backed args, upstream Figma, optional proxy).
