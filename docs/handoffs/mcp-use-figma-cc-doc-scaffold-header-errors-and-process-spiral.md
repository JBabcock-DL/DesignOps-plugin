# MCP `use_figma` session handoff — full transcripts, trouble list, and process spiral

**Repos involved:** Canonical doc lives in **DesignOps-plugin** (this file). Consumer run artifacts live in sibling repo **figtest** (`draw-radio/`, `handoff.json`).  
**Goal of the session:** Complete `/create-component` Step 6 for **radio-group**, slug **`cc-doc-scaffold-header`**, against Figma file key **`uCpQaRsW4oiXW3DsC6cLZm`**, parent thread owns **`call_mcp` → `use_figma`** per [`AGENTS.md`](../../AGENTS.md) / [`skills/create-component/EXECUTOR.md`](../../skills/create-component/EXECUTOR.md).

**Pointer from figtest:** [`figtest/draw-radio/MCP-ERROR-TRANSCRIPTS-handoff.md`](../../../figtest/draw-radio/MCP-ERROR-TRANSCRIPTS-handoff.md) redirects here (stub).

---

## A. Full transcripts (verbatim / faithful)

### A.1 Offline validation — `check-use-figma-mcp-args.mjs`

Command:

```bash
node scripts/check-use-figma-mcp-args.mjs "<path-to>/figtest/draw-radio/invoke-mcp-args.json"
```

**Stdout:**

```text
OK  JSON tool args: 15182 UTF-8 bytes (serialized), code string 14212 chars.
```

Meaning: the **serialized** MCP tool-arguments JSON (same shape as passed to `use_figma`) round-trips; `code` length is within Figma’s `maxLength` budget for the tool schema.

---

### A.2 Smoke — small `use_figma` (Cursor **parent** `call_mcp_tool`)

- **Server:** `plugin-figma-figma` (see workspace `mcps/**/SERVER_METADATA.json` for renames).
- **Tool:** `use_figma`
- **Intent:** Confirm plugin runs; read `figma.currentPage.name` and `figma.fileKey`.

**Approximate arguments:**

| Field | Value |
|--------|--------|
| `fileKey` | `uCpQaRsW4oiXW3DsC6cLZm` |
| `description` | Smoke / pre-check |
| `skillNames` | `figma-use` |

**Tool result:**

```json
{"ok": true, "page": "Thumbnail", "fileKey": "headless"}
```

**Signal:** The request supplied a concrete URL segment `fileKey`, but **observed `figma.fileKey` inside the plugin was `"headless"`**.

---

### A.3 Full slice — `cc-doc-scaffold-header`

- **Payload:** Same logical object as `figtest/draw-radio/invoke-mcp-args.json` (assembled via `radio-slice.cjs` → `assemble-slice.mjs`).
- **`description`:** `create-component cc-doc-scaffold-header radio-group`
- **`skillNames`:** `figma-use,create-component-figma-slice-runner`

**Failure (Figma plugin / MCP tool error channel):**

```text
Error: [op] unknown parent ref 'dr'
    at h (PLUGIN_1_SOURCE:143:2332)
    at <anonymous> (PLUGIN_1_SOURCE:143:7859)

Figma Debug UUID: 18faa231-e96c-4e76-90ea-8cfcdc4a430d
```

Mechanical interpretation (maps to generated op interpreter in **`skills/create-component/templates`** / min bundles): parent ref **`dr`** is the doc-root slot filled from **`getNodeByIdAsync(__CC_HANDOFF_DOC_ROOT_ID__)`**. Handoff at the time used **`601:11`**. If that async lookup does not yield a node that can accept children **`t.dr` is never registered**, later **`[2,"dr","header"]`** (append) throws **`unknown parent ref 'dr'`**.

---

### A.4 Follow-up probe — resolve handoff node IDs

Intent: **`await figma.getNodeByIdAsync("601:10")`** and **`"601:11"`**, plus page / fileKey.

**Tool result:**

```json
{"fileKey": "headless", "page": "Thumbnail", "601:10": null, "601:11": null}
```

---

### A.5 On-disk figtest state (at time of run)

| Artifact | Role |
|-----------|------|
| `figtest/handoff.json` | `doc.pageContentId` / `doc.docRootId` aligned with scaffold return |
| `figtest/draw-radio/return-cc-doc-scaffold-shell.json` | Recorded **`601:10` / `601:11`** from shell slice merge |
| `figtest/phase-state.json` | **`nextSlug`:** **`cc-doc-scaffold-header`** after shell; header **not** merged successfully |

Paths are relative to **figtest** repo root unless noted.

---

## B. Full trouble list (everything that went wrong or blocked)

1. **Large parent payload (~15.2k UTF-8 serialized tool args)** — creates anxiety about **JSON truncation**, **single-message limits**, and **whether `call_mcp_tool` can embed a full object** without splitting. Documented workaround path is **`Read`** committed / design-repo file + **one** `use_figma` ([`docs/mcp-transport-cursor-fallback.md`](../mcp-transport-cursor-fallback.md), [`AGENTS.md`](../../AGENTS.md)).

2. **`invoke-mcp-args.json` is multi-kilobyte one-line JSON** — hard to **`Grep`** (results truncate with `[... omitted long line]`). **`Read`** works for full bytes; **`rg`/shell `cat`** discouraged for huge blobs when truncation is silent (**AGENTS**).

3. **No supported “pass file path as `code` substitute” on `use_figma`** — the shipped Figma MCP tool schema requires inline **`code`** (see the `use_figma` descriptor in the Cursor workspace `mcps/plugin-figma-figma/tools/` mirror, not in this repo). Workspace path indirection is not a documented parameter.

4. **Forbidden escape hatches memorized from repo policy** —**no** throwaway MCP staging files under **`skills/`**; **no** alternate Node MCP clients to Figma Cloud without IDE OAuth (**`docs/mcp-transport-cursor-fallback.md`** §6). That **eliminates** “spawn stdio MCP / curl localhost / env FIGMA_TOKEN” as serious options without changing policy.

5. **Smoke result already showed `fileKey: "headless"`** — strong evidence the **execution environment** might not equal the URL file key **before** the full slice ran. That signal was easy to **under-treat** until the **`dr`** failure and the **null** node probe confirmed it.

6. **`[op] unknown parent ref 'dr'`** — runtime failure inside op interpreter: **handoff doc root id not bound** in the plugin graph **as seen by MCP**.

7. **Probe showed `601:10` / `601:11` → `null`** — same session as (6): **ids from a real-file scaffold do not resolve** here.

8. **`figma.fileKey` = `"headless"`** persists across smoke + probe — suggests **connector / session / file-target** mismatch (not slice assembly correctness).

9. **Transport vs execution confusion** — **`check-use-figma-mcp-args` OK** proves **wrapper JSON string** is valid; it does **not** prove the **host** didn’t truncate **before** Figma—here invocation **reached** Figma and ran JS, so **transport for this size worked**; failure is **post-delivery**.

10. **Cannot `finalize-slice` / merge** without a **successful** `use_figma` return object — phase state **stuck** on **`cc-doc-scaffold-header`**.

11. **Optional scratch files** (`_roundtrip.json`, etc.) — created during size checks; should be **deleted** if present (throwaway); **invoke-mcp-args.json** is the **real** artifact.

12. **User instruction tension** — “agent attempts payloads, not me” vs **only IDE `call_mcp`** can use the **logged-in Figma session** for remote MCP — pins the fix to **IDE + correct file focus**, not a headless script.

---

## C. Why the process “spiraled” (honest postmortem)

This is the narrative of **why** the thread spent many turns on mechanics instead of finishing the draw in Figma.

1. **Policy + size together** — [`AGENTS.md`](../../AGENTS.md) stresses **inline** `code`, **no** scratch payload files, **parent** owns `use_figma`, and **no** default **Task** subagents for huge `call_mcp` blobs. That is correct for product quality, but it forces the **parent** to **materialize ~15k characters** in one tool call. Any uncertainty about **host limits** triggers a **search for alternatives** (Node, stdio, base64, file indirection)—most of which are **explicitly ruled out** or **don’t share OAuth**, so those branches are **dead ends**. That reads as “spiraling” but is **enumeration of disallowed paths**.

2. **Two different problems got interleaved** — (A) **Can the parent emit a valid full `arguments` object?** vs (B) **Does Figma resolve `601:11` in the active file?** Shell work on (A) continued **after** smoke already hinted (B) via **`headless`**. Narrowing on (A) did not fix (B).

3. **Validation tools report “OK” at the wrong layer** — **`check-use-figma-mcp-args`** and **`check-payload`** are **necessary** but **not sufficient** for end-to-end success: they cannot assert **Cursor → Figma file binding** or **node id truth** in the user’s document.

4. **Tool-output formats** — **`Grep`** truncates long lines; **`Read`** doesn’t. A few attempts used **`grep`/wc** patterns that looked like duplication; the point was **confirming byte counts** and **avoiding silent shell truncation** per **AGENTS** guidance.

5. **`call_mcp_tool` ergonomics** — the assistant does not have **`arguments: fs.readFileSync(...)`**; it must pass a **structured object**. The practical path is **`Read`** full JSON → **one** `call_mcp_tool` with parsed fields. Any attempt to “pipeline” through **extra files** without **actually** calling MCP added steps without reducing the core action.

6. **After the real error appeared** — the failure was **clear and architectural** (`dr` / null nodes / `headless`). Further tool calls would not **patch** connector binding; the right next step is **human/env**: **open the real file**, **confirm MCP target**, **re-probe ids**, then **replay** the same assembled payload.

---

## D. Suspected root cause (for fixers)

| Layer | Status in this session |
|--------|-------------------------|
| Slice assembly / `invoke-mcp-args.json` | **Passed** offline checks; plugin **executed** JS (reached op interpreter). |
| Parent MCP transport (~15.2k serialized) | **Delivered** (no JSON parse error from host for the full call). |
| Figma MCP file / node binding | **Likely broken / mismatched**: **`fileKey` → `headless`**, **`601:10`/`601:11` → `null`**, **`dr` missing**. |

Treat as **connector / session / which file is targeted by `use_figma`**, not as a DesignOps **op list** bug, until repro shows **`fileKey`** matching the open file and **non-null** `getNodeByIdAsync` for handoff ids.

---

## E. Files and commands (quick index)

| Location | Note |
|----------|------|
| [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs) | Wrapper JSON size / parse validation |
| [`scripts/check-payload.mjs`](../../scripts/check-payload.mjs) | `code` string parse / JSON escapes |
| [`scripts/finalize-slice.mjs`](../../scripts/finalize-slice.mjs) | After success: merge return into `handoff.json` |
| [`docs/mcp-transport-cursor-fallback.md`](../mcp-transport-cursor-fallback.md) | When transport fails vs execution |
| `figtest/draw-radio/invoke-mcp-args.json` | Exact args used for header slice attempt |
| `figtest/draw-radio/slice-cc-doc-scaffold-header.code.js` | Assembled **`code`** body |

---

## F. Repro checklist (minimal)

1. Figma Desktop: open file **`uCpQaRsW4oiXW3DsC6cLZm`**; authenticate **official Figma MCP** in Cursor.
2. `use_figma` probe: **`figma.fileKey`**, **`await figma.getNodeByIdAsync('601:11')`** — expect **real file key**, **non-null** node (or refreshed ids from a new shell run merged into **`handoff.json`**).
3. If still **`headless`** / null: stop — fix **connector / file targeting** before changing **DesignOps** slice assembly.
4. When probe is green: **`Read`** `invoke-mcp-args.json` → **`call_mcp` `use_figma`** → **`finalize-slice`** `cc-doc-scaffold-header` → advance **`phase-state`**.

---

*Append new transcripts under §A if you re-run with different connector versions or file keys.*
