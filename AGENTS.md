# Agent instructions — DesignOps Plugin

These notes apply to **any** AI agent or automation working in this repository (Cursor, Claude Code, CI bots with repo access, etc.).

**Token-light index:** [`memory.md`](memory.md) — compact checklist and links; use this for quick orientation, then open sections below or linked skills when needed.

**MCP spirals (retries, new runners, invented limits):** Stop and follow [`memory.md` — MCP anti-spiral](memory.md#mcp-anti-spiral-agents) (**system thesis:** host-side file/chunked tool args vs one decision tree here; no speculative machinery). **Deeper fixes** (who must ship file-backed or chunked args): see *Large `use_figma` transport* below and [`skills/create-component/conventions/18-mcp-payload-budget.md`](skills/create-component/conventions/18-mcp-payload-budget.md).

**Claude Code:** [`CLAUDE.md`](CLAUDE.md) is the project bootstrap file; it instructs the agent to load **`memory.md`** and **`AGENTS.md`** automatically — the user should not need to repeat that per session.

**Agents run plugin CLI:** Documented **`node scripts/…`** and **`npm run …`** steps (e.g. **`bundle-component`**, **`verify`**, **`create-component-step6`**, **`merge-handoff`** where applicable) are **executed by the agent** (or CI) from the DesignOps-plugin root unless blocked (sandbox/network, interactive auth, or no working `call_mcp` / Figma MCP in the environment). **Do not** tell designers or end users to manually run these commands when the agent can run them — document exceptions only when automation truly cannot proceed. Cursor: [`.cursor/rules/agent-run-designops-commands.mdc`](.cursor/rules/agent-run-designops-commands.mdc).

## Step 6 Figma invoke — default is **Cursor / Claude Code Figma MCP** (`call_mcp`), not standalone Node MCP

**`/create-component` Step 6:** Prefer **`Task` → [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md)** per step (`cc-scaffold` … `cc-usage`) with **`assembledCodePath`** after [`scripts/assemble-component-use-figma-code.mjs`](scripts/assemble-component-use-figma-code.mjs) and **`check-payload`** — same delegation model as style-guide canvas. **Orchestration:** **`npm run create-component-step6 -- --ctx-file <path>`** runs all five assembles + **`check-payload`** (optional **`--check-mcp-args`**, **`--probe-first`**) and writes **`create-component-step6-progress.json`** — still **five sequential** MCP invocations (**never** parallel **`Task`** for two **`cc-*`** steps). **Fallback:** parent **`Read`** the same assembled file → **`call_mcp` → `use_figma`**. Regenerate bundles after editing canvas sources: **`npm run bundle-component`**. Resolver Figma MCP `server` id from workspace **`mcps/*/SERVER_METADATA.json`** — do **not** hardcode a server name across hosts.

**No parallel invoker:** Figma **`use_figma`** runs through the IDE‑integrated MCP session **`call_mcp`**. There is **no** supported Node/streamed “Desktop MCP” substitute in this repo. If **`call_mcp`** fails, run **`probe-parent-transport`**, then shrink **CONFIG** / fix transport — not another MCP stack.

**When you doubt parent or subagent capacity:** prove with **`probe-parent-transport`** and **`check-use-figma-args`** on the bytes you send — do **not** invent ceilings or speculative runners outside **`canvas-bundle-runner`** + parent fallback.

**Composer / Cursor quick reference:** [`skills/create-component/conventions/08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md) (classification, measurement, pre-release QA — not in **`npm run verify`**).

`Task` **writers** may run **`assemble-component-use-figma-code.mjs`** + **`check-payload`**; **`Task` → `canvas-bundle-runner`** (or **parent** `Read` → `call_mcp`) owns **`use_figma`** per [`canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md). Detail: **[`EXECUTOR.md`](skills/create-component/EXECUTOR.md)** §0 and **[`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)**.

## MCP payloads — prefer inline; ephemeral files when they fix transport

When a tool accepts an **inline** argument (e.g. Figma **`use_figma`** → `code`, or similar “pass the script/blob here” parameters):

1. **Default:** Put the payload **directly in that tool’s arguments** for the invocation.
2. If the payload is too large for one call, split work across **multiple sequential invocations**, each with a **fresh, self-contained** payload.
3. **This repository (DesignOps-plugin):** Do **not** add **persistent** staging artifacts under **`skills/`**—or disposable names like `.mcp-*`, `_mcp-*`, `*-once.js`, `*-payload.json`, `_mcp-args*.json`, `_tmp*` **at plugin repo root**—used **only** as a clipboard before calling MCP. Shell snippets whose only job is writing those paths for hand-copied payloads are still an anti-pattern **when** inline assembly is viable.

### Ephemeral files (explicitly OK)

You may write assembled `code` or full MCP args to disk **when that fixes a real issue** (IDE truncating tool JSON, unreliable paste, scripted `check-payload`, or pairing with **`Read`** so the parent passes **complete** bytes to `call_mcp`). This is encouraged over inventing limits or spinning the wrong runner.

**Rules:**

- **Runner or parent `call_mcp`:** **`Task` → `canvas-bundle-runner`** performs **`use_figma`** when transport succeeds; otherwise **parent** **`Read` → `call_mcp`** on the same file ([`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)). Consumer-repo disk staging for assembled `code` is allowed; see **`AGENTS.md`** *Ephemeral files*.
- **Never use shell `cat` / `type` of giant files as source of truth** (truncation risk). Use **`Read`** on paths the editor resolves fully.
- **Do not duplicate** maintained skill artifacts (`*.min.mcp.js`, bundled canvas, template `*.figma.js`) into parallel scratch copies inside **`skills/`** “for convenience” — **`Read`** the canonical path once.

**Exception (committed reads):** When a skill document **explicitly** names a **committed** path to read (e.g. `skills/new-project/phases/*.md` fenced blocks, `skills/create-design-system/canvas-templates/*.js`, **`skills/create-design-system/canvas-templates/bundles/*.mcp.js`** and **`*.min.mcp.js`**, **`skills/create-component/canvas-templates/bundles/*.min.mcp.js`** — pre-built payloads from [`skills/create-design-system/scripts/bundle-canvas-mcp.mjs`](skills/create-design-system/scripts/bundle-canvas-mcp.mjs) and [`scripts/bundle-component-mcp.mjs`](scripts/bundle-component-mcp.mjs)), follow it.

If you accidentally leave a stray staging file in this repo’s tree, **delete it** before finishing; the deliverable is tool/Figma state, not noisy commits.

### Hardened runbook — ephemeral files × payload caps

Ephemeral disk + parent **`Read` → `call_mcp`** fixes transport when inline JSON is fragile ([`AGENTS.md`](AGENTS.md) *MCP payloads*; [`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)). **Wire size:** Figma **`use_figma.code`** **`maxLength` 50 000**; component bundles are emitted by [`scripts/bundle-component-mcp.mjs`](scripts/bundle-component-mcp.mjs) to respect that cap with **`ctx` headroom**. **Fixed component draw order:** **`scaffold` → `properties` → `component-*` → `matrix` → `usage`** ([`EXECUTOR`](skills/create-component/EXECUTOR.md) **§0**).

**If you are tempted to skip assembly because the payload feels large:** Use **`assemble-component-use-figma-code.mjs`** + **`check-payload`** + **`Task` → `canvas-bundle-runner`** first (same pattern as style-guide canvas). **If** the subagent **cannot** pass the full `call_mcp` JSON, fall back to **parent** **`Read`** of the **same** assembled file — do not invent proxy transports.

- **Canvas (Steps 15a–c / 17) and `/create-component` Step 6:** Prefer [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) via `Task` so large **`code`** stays out of the **parent** thread **when** the subagent can pass the full `use_figma` tool args. **Create-component** passes **`assembledCodePath`** (see **[`assemble-component-use-figma-code.mjs`](scripts/assemble-component-use-figma-code.mjs)**). If `Task` **cannot** materialize the payload in `call_mcp`, use the **parent** path in [`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) — **`Read`** the same file the runner would have used, one `use_figma` — do not spin subagents that cannot deliver. See § *Canvas bundles* below.
- **Components (`/create-component` Step 6):** **Five** sequential steps (`cc-scaffold` → … → `cc-usage`) per [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0** — same runner skill as canvas; **parent fallback** identical. For **non-canvas** one-off scripts, follow [`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md).

### Session runbook — style-guide tables, then components (staged)

When a single user request covers **both** style-guide table canvas work **and** `/create-component` draws, **do not** interleave a full 15* table redraw and a full component `use_figma` in **one** parent turn. That pattern maximizes JSON truncation and tool-arg failures on short-context hosts.

- **Phase A — Tables (unchanged):** Run `/create-design-system` Step 15a–15c and Step 17 as documented — **one** [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) `Task` per slug, **three** sequential `Task`s for 15c, then audit. Do **not** change [`canvas-templates/`](skills/create-design-system/canvas-templates/) geometry, [`conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md) rules, or bundle layout to “optimize” this — the split is **orchestration only**.
- **Phase B — Components:** Run `/create-component` **one component at a time** to completion (install + preflight + Step 6 **five** `use_figma` invocations via **`Task` → canvas-bundle-runner** preferred, **parent** fallback, then registry / reporting) before starting the next, across **as many assistant turns as needed** — see [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md).
- **Orchestration vs engine:** Staging **tables**, **bundles**, and **components** in **separate** turns is required. **Step 6** = **five** sequential payloads ([`EXECUTOR` §0](skills/create-component/EXECUTOR.md)) — **prefer** **`canvas-bundle-runner`**; **parent** **`Read` → `call_mcp`** when the host cannot pass full args from a subagent. See [`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md).

**`/create-component` Step 6:** After Steps **1–5** and **4.7**, run **five** `use_figma` invocations in order per [`EXECUTOR` §0](skills/create-component/EXECUTOR.md): assemble with **`assemble-component-use-figma-code.mjs`**, **`check-payload`**, then **`Task` → `canvas-bundle-runner`** (`cc-*` steps + `assembledCodePath`) or **parent** `Read` → `call_mcp`. Style-guide canvas uses the **same** runner for Step 15/17 (committed `.min.mcp.js` only — no `assembledCodePath`).

### Canvas bundles (Step 15 / Step 17)

**Preferred (token isolation):** `Task` → [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md): **Canvas** — `step=<slug>`, `fileKey`, `description` **when** the subagent can pass the full bundle in `use_figma`. **Create-component** — same skill, `step=cc-*`, **`assembledCodePath`**, `fileKey`, `description`. **If** subagent `call_mcp` fails on size, use **parent** `use_figma` with `Read` on the **same bytes** ([16](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)) — do not keep retrying a subagent that cannot materialize the payload. Rationale: [16](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*; full contract: [`canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md). Canvas slug map: [`17-table-redraw-runbook.md`](skills/create-design-system/conventions/17-table-redraw-runbook.md). 15c = **three** sequential calls in **order** (Layout → Text Styles → Effects).

### Host vs agent transport (Figma `use_figma`)

**Supported path:** Put the assembled **`code`** (from **`Read`** of committed **`.min.mcp.js`**, or of a **single** **`assemble-component-use-figma-code.mjs` output**, or the canvas runner’s one-file rule) in the MCP tool argument’s **`code`** field. **`Read`** preserves full-length bytes; shell `cat` / `type` can truncate — do **not** use those as proof of correctness.

**No server-side shortcut:** The shipping Figma **`use_figma`** API takes **`code`** as an **inline** string — there **is no** **`codeWorkspacePath`**. Temporary files bridge **trusted** bytes into the **parent’s** **`call_mcp`**; they **do not** substitute for **`Read`** on committed bundles ([`skills/create-design-system/canvas-templates/bundles/`](skills/create-design-system/canvas-templates/bundles/), [`skills/create-component/canvas-templates/bundles/`](skills/create-component/canvas-templates/bundles/)). Operational detail: **[`16` — MCP workflow](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)** and **[`EXECUTOR` §0](skills/create-component/EXECUTOR.md)**.

- [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) — read templates/data, plain `code`, ~50k cap, split calls, MCP host limits
- [`skills/create-design-system/conventions/17-table-redraw-runbook.md`](skills/create-design-system/conventions/17-table-redraw-runbook.md) — bundle path matrix (15a–15c + Step 17)
- [`skills/create-design-system/phases/07-steps15a-15c.md`](skills/create-design-system/phases/07-steps15a-15c.md) — § *Agent-driven only — no workspace scripts*
- [`skills/create-design-system/SKILL.md`](skills/create-design-system/SKILL.md) — Canvas (Steps 15a–17)
- [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) — router + non-negotiables; canvas chain detail [`skills/sync-design-system/phases/06-axis-A-and-canvas.md`](skills/sync-design-system/phases/06-axis-A-and-canvas.md)

### Table fidelity — all models (Sonnet, Composer, etc.)

MCP comparison of a **golden** style-guide table vs a regressed one showed: **header cells** were built with the **body** auto-layout recipe (VERTICAL + Hug + `resize(w,1)`), which collapses header chrome to **1px** while text stays `textAutoResize: 'NONE'`; body rows looked “tall enough” but **code columns** stayed **~9px** tall; **Primitives swatch** `RECTANGLE`s often shipped with **resolved hex only** (no `boundVariables.color`) instead of **`setBoundVariableForPaint`** to the row’s **`Primitives`** variable. **Authoritative fix:** read [`skills/create-design-system/conventions/00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md) **§0.5–0.7** and [`skills/create-design-system/conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md) before declaring canvas work done. Do **not** infer header geometry from “the row looks fine,” or swatch correctness from “it shows the right color.”

**`/create-component` draws:** `node.resize()` resets auto-layout sizing modes to `FIXED`. Setting **`primaryAxisSizingMode = 'AUTO'` before `resize(width, 1)`** on a **VERTICAL `COMPONENT`** leaves a **1px-tall** master; **HORIZONTAL** `doc/.../usage` frames need **`counterAxisSizingMode = 'AUTO'`** or the Do / Don’t block collapses vertically. Matrix specimen cells should **hug height** (**counter `AUTO`**) with **`minHeight`**, not a fixed 72px band that clips tall fields. Rules: [`skills/create-design-system/conventions/00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md) **§0.10**, [`skills/create-component/conventions/03-auto-layout-invariants.md`](skills/create-component/conventions/03-auto-layout-invariants.md) **§10.2**, [`skills/create-component/conventions/04-doc-pipeline-contract.md`](skills/create-component/conventions/04-doc-pipeline-contract.md) **§5.4 / §6**.

### Skill edits — repo is canonical, marketplace cache is downstream

This repo (`DesignOps-plugin/`) is the **canonical source** for every skill under `skills/`. Claude Code's plugin loader populates a parallel cache at `~/.claude/plugins/marketplaces/local-desktop-app-uploads/labs-design-ops/skills/<skill>/` from this tree (hence the `local-desktop-app-uploads` segment in the path). Both copies must stay byte-identical or the agent will silently run the stale one.

**Rule for any agent editing a skill:**

1. Edit the file under `skills/<skill>/…` in this repo **first**. That's the version that gets committed and shipped.
2. Run **`bash scripts/sync-cache.sh`** (or `npm run sync-cache`) to mirror **`skills/**`** and the repo-root bootstrap files **`CLAUDE.md`**, **`memory.md`**, **`AGENTS.md`** into the local marketplace folder. **`npm run verify`** (or `verify-cache`) diffs both **`skills/`** and those three files against the cache.
3. Legacy / manual mirror — only if you must copy a single skill file without running the script:
   ```
   cp skills/<skill>/<file> ~/.claude/plugins/marketplaces/local-desktop-app-uploads/labs-design-ops/skills/<skill>/<file>
   ```
   (Use whatever path form the host OS requires — e.g. `C:/Users/<user>/.claude/plugins/...` on Windows.) Also copy **`CLAUDE.md`**, **`memory.md`**, and **`AGENTS.md`** from the repo root to the same **`labs-design-ops/`** directory if you changed them.
4. `diff` or `npm run verify` afterwards and expect a clean exit. Never leave the two trees drifted.
5. Only the repo copy gets committed; the marketplace cache is local-machine state and is not tracked by this repo.

If you edited the marketplace cache by accident (e.g. via an absolute path search), copy it back to the repo copy instead of re-doing the edits by hand, then re-verify with `diff`. Do **not** treat the cache as authoritative when reconciling.

### `/create-component` — Mode A vs Mode B

When installing shadcn components and drawing them to Figma, **Mode B (`synthetic-fallback`) is not always an error** — many files (e.g. `form`) have no extractable `cva()` for [`skills/create-component/resolver/extract-cva.mjs`](skills/create-component/resolver/extract-cva.mjs). **Do not** conflate “extractor exit 1” with “missing `class-variance-authority`” in a single paraphrase; read stdout JSON verbatim and follow [`skills/create-component/conventions/05-code-connect.md`](skills/create-component/conventions/05-code-connect.md) §2.5.5. **Axis B** in [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) may mark a component `unresolvable` for drift diffs while `/create-component` can still draw in Mode B.

**MCP transport (short-context / Composer-class agents):** Each `use_figma` call must be **one** complete JSON tool argument — `Unexpected end of JSON input` usually means **truncation or invalid JSON**, not a Figma bug. [`scripts/check-payload.mjs`](scripts/check-payload.mjs) validates the **`code` string** only; the **entire** MCP tool-arguments object must still round-trip through `JSON.stringify` / `JSON.parse` in the host. [`scripts/check-use-figma-mcp-args.mjs`](scripts/check-use-figma-mcp-args.mjs) reports UTF-8 size of a serialized `use_figma` call. Do **not** use gzip/base64 bootstrap unless the plugin host supports **`DecompressionStream`** (often it does not — see [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)). Full checklist: [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0**.

**When the parent should not re-type `code` in chat:** prefer **writer subagent** (assemble + `check-payload` + write to the **design repo**; return short path metadata only) + **parent** `Read` + `use_figma` — see [`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md). **Do not refuse** the **parent** `Read` → `call_mcp` path because the staging file looks “large”—attempt it first.

**Large `use_figma` transport (measured 2026):** Cursor @-mentions for files in **chat** are not documented as a substitute for inline `code` in the Figma MCP tool. **If** tool JSON truncates **after** a failed parent invoke: run **`check-payload`** / **`check-use-figma-args`** on the bytes you send, then **`probe-parent-transport`**; shrink **`ctx`** / CONFIG prose or use ephemeral **`Read` → `call_mcp`** per [`21-mcp-ephemeral-payload-protocol.md`](skills/create-component/conventions/21-mcp-ephemeral-payload-protocol.md) — do **not** add proxy MCP stacks or gzip/bootstrap unless the host documents support. **Default in Cursor for `use_figma`:** parent **`call_mcp`** using the IDE’s Figma MCP session.

### Host matrix (Claude Code vs Cursor)

| Concern | Claude Code (plugin) | Cursor |
|--------|----------------------|--------|
| Skill / bundle paths | `${CLAUDE_PLUGIN_ROOT}` / installed plugin copy | Workspace must include plugin root — [`.cursor/rules/cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc) |
| Committed `.min.mcp.js` `Read` | From plugin tree | Same; ensure **Add Folder to Workspace** if the primary root is another repo |
| Figma MCP `server` id | Host-specific | `mcps/**/SERVER_METADATA.json` → `serverIdentifier` (not necessarily `figma`) |
| Canvas bundles (15 / 17) | Parent: `Task` → [`skills/canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md) | Same |

### IDE rule (Cursor)

Project rule files (always on in Cursor): [`.cursor/rules/mcp-inline-payloads.mdc`](.cursor/rules/mcp-inline-payloads.mdc), [`.cursor/rules/cursor-designops-skill-root.mdc`](.cursor/rules/cursor-designops-skill-root.mdc).

**Skill / bundle paths in Cursor:** Agents only see files under **workspace folders**. If the user’s primary folder is **not** the DesignOps plugin, they must **Add Folder to Workspace** for the plugin root (same tree as Claude Code’s `${CLAUDE_PLUGIN_ROOT}`, typically under `~/.claude/plugins/cache/`). Otherwise `skills/create-design-system/canvas-templates/bundles/*.min.mcp.js` will not resolve. See [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) § *Source root — Cursor*.

### Cursor — Figma MCP `server` identifier

Cursor registers each MCP connector under a **workspace-specific** server id (see the project’s `mcps/` tree — for example `SERVER_METADATA.json` with `serverIdentifier`). The slug `figma` may **not** resolve when invoking tools; read the descriptor or follow the connection error text instead of hardcoding a name across machines or Cursor versions.
