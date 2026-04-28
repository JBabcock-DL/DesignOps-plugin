# Agent instructions — DesignOps Plugin

These notes apply to **any** AI agent or automation working in this repository (Cursor, Claude Code, CI bots with repo access, etc.).

**Token-light index:** [`memory.md`](memory.md) — compact checklist and links; use this for quick orientation, then open sections below or linked skills when needed.

**MCP spirals (retries, new runners, invented limits):** Stop and follow [`memory.md` — MCP anti-spiral](memory.md#mcp-anti-spiral-agents) (**system thesis:** host-side file/chunked tool args vs one decision tree here; no speculative machinery). **Deeper fixes** (who must ship file-backed or chunked args): [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md) (section 6.7).

**Claude Code:** [`CLAUDE.md`](CLAUDE.md) is the project bootstrap file; it instructs the agent to load **`memory.md`** and **`AGENTS.md`** automatically — the user should not need to repeat that per session.

**Agents run plugin CLI:** Documented **`node scripts/…`** and **`npm run …`** steps (e.g. `assemble-slice`, `merge-handoff`, `verify`) are **executed by the agent** from the DesignOps-plugin root unless blocked (sandbox/network, interactive auth, or no working `call_mcp` / Figma MCP in the environment). Cursor: [`.cursor/rules/agent-run-designops-commands.mdc`](.cursor/rules/agent-run-designops-commands.mdc).

## Step 6 Figma invoke — default is **Cursor / Claude Code Figma MCP** (`call_mcp`), not standalone Node MCP

**Manifest-driven `/create-component`** (Draw Engine v1): after **`npm run designops:step6:prepare`**, follow **`current-step.manifest.json` → `parent_actions`**: **`Read`** **`.designops/staging/mcp-<slug>.json`**, **`call_mcp` → `use_figma`** with **`{ fileKey, code, description, skillNames }`**, **`Write`** MCP result to **`return-<slug>.json`**, then **`finalize-slice --return-path`**. Resolver Figma MCP server id from workspace **`mcps/*/SERVER_METADATA.json`** — do **not** hardcode a server name across hosts.

**Fallback (only when the IDE cannot carry full serialized tool args** — prove with [`scripts/probe-parent-transport.mjs`](scripts/probe-parent-transport.mjs) — **or** headless CI without **`call_mcp`):** **`npm run figma:mcp-invoke -- --file …`** (**[`scripts/figma-mcp-invoke-from-file.mjs`](scripts/figma-mcp-invoke-from-file.mjs)**) streams the **same staging JSON** to **Figma Desktop MCP URL** via Node — see **`finalizeHint.fallbackShellPipe`** in the manifest — **not** a substitute for the editor-managed connector when Cursor/Claude owns the MCP session.

**When you doubt parent capacity**: prove with **`probe-parent-transport`**, do **not** invent ceilings or **`Task`** **`use_figma`** runners.

**Composer / Cursor quick reference:** [`docs/composer2-canvas-playbook.md`](docs/composer2-canvas-playbook.md) (classification, measurement, **`report:delegate-sizes`**, pre-release QA — not in **`npm run verify`**).

`Task` **writers**: **`assemble-slice`**, **`check-payload`**, **`Write`**, **not** **`call_mcp`** / **`figma:mcp-invoke`**. Detail: **[`EXECUTOR.md`](skills/create-component/EXECUTOR.md)** §0, **[`08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md)** §D.1. **Op-interpreter:** `assemble-slice` → **`generate-ops.mjs`** + **[`op-interpreter.min.figma.js`](skills/create-component/templates/op-interpreter.min.figma.js)**; escape **`--legacy-bundles`**.

## MCP payloads — prefer inline; ephemeral files when they fix transport

When a tool accepts an **inline** argument (e.g. Figma **`use_figma`** → `code`, or similar “pass the script/blob here” parameters):

1. **Default:** Put the payload **directly in that tool’s arguments** for the invocation.
2. If the payload is too large for one call, split work across **multiple sequential invocations**, each with a **fresh, self-contained** payload.
3. **This repository (DesignOps-plugin):** Do **not** add **persistent** staging artifacts under **`skills/`**—or disposable names like `.mcp-*`, `_mcp-*`, `*-once.js`, `*-payload.json`, `_mcp-args*.json`, `_tmp*` **at plugin repo root**—used **only** as a clipboard before calling MCP. Shell snippets whose only job is writing those paths for hand-copied payloads are still an anti-pattern **when** inline assembly is viable.

### Ephemeral files (explicitly OK)

You may write assembled `code` or full MCP args to disk **when that fixes a real issue** (IDE truncating tool JSON, unreliable paste, scripted `check-payload`, or pairing with **`Read`** so the parent passes **complete** bytes to `call_mcp`). This is encouraged over inventing limits or spinning the wrong runner.

**Rules:**

- **Parent still performs `call_mcp`:** Subagent **`Write` → disk → parent `Read` → one `call_mcp`** is the approved pattern ([`08-cursor-composer-mcp`](skills/create-component/conventions/08-cursor-composer-mcp.md) §D.1). The **consumer design repo**, a **session `draw/` or `tmp/` folder**, or **OS temp** are preferred outputs for `assemble-slice --out` / `--emit-mcp-args`; keep them **gitignored** in the consumer project if needed **and delete** when the draw is done unless the designer wants to keep them for debugging.
- **Never use shell `cat` / `type` of giant files as source of truth** (truncation risk). Use **`Read`** on paths the editor resolves fully.
- **Do not duplicate** maintained skill artifacts (`*.min.mcp.js`, bundled canvas, template `*.figma.js`) into parallel scratch copies inside **`skills/`** “for convenience” — **`Read`** the canonical path once.

**Exception (committed reads):** When a skill document **explicitly** names a **committed** path to read (e.g. `skills/new-project/phases/*.md` fenced blocks, `skills/create-component/templates/*.figma.js`, `skills/create-design-system/canvas-templates/*.js`, **`skills/create-design-system/canvas-templates/bundles/*.mcp.js`** and **`*.min.mcp.js`** — pre-built payloads from [`skills/create-design-system/scripts/bundle-canvas-mcp.mjs`](skills/create-design-system/scripts/bundle-canvas-mcp.mjs)), follow it.

If you accidentally leave a stray staging file in this repo’s tree, **delete it** before finishing; the deliverable is tool/Figma state, not noisy commits.

### Hardened runbook — ephemeral files × payload shrink

**[`skills/create-component/conventions/21-mcp-ephemeral-payload-protocol.md`](skills/create-component/conventions/21-mcp-ephemeral-payload-protocol.md)** is the explicit pattern: separate **transport** (reliable MCP delivery via disk + parent `Read`) from **wire size** ([`18-mcp-payload-budget.md`](skills/create-component/conventions/18-mcp-payload-budget.md)); per-slice **`assemble-slice`** checklist and canonical **`mcp-<slug>.json`** naming. **Fixed draw order:** [`13-component-draw-orchestrator.md`](skills/create-component/conventions/13-component-draw-orchestrator.md) **§1** (`SLUG_ORDER`). **`Draw Engine` (scripted manifests):** **[`skills/create-component/conventions/23-designops-step6-engine.md`](skills/create-component/conventions/23-designops-step6-engine.md)** — **`npm run designops:step6:status`**, **`npm run designops:step6:prepare`**; writes **`current-step.manifest.json`** in the consumer `draw-dir`; parent follows **`parent_actions`** literally.

**If you are tempted to stage a payload because the inline `code` arg feels too big:** **Subagents must not** be the default carrier for a **single** `use_figma` when the subagent would have to **emit** the full tool `arguments` (often **~15–30K+** JSON) in one `call_mcp` — that commonly **fails** on subagent / short-output transport limits (separate from Figma’s 50K `code` cap).

- **Canvas (Steps 15a–c / 17):** Prefer [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) via `Task` so bundle text stays out of the **parent** thread **when** the subagent can pass the full `code`. If `Task` **cannot** materialize the bundle in `call_mcp`, use the **parent** path in [`16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) (e.g. `Read` the committed `.min.mcp.js` in the parent and one `use_figma`) — do not spin subagents that cannot deliver. See § *Canvas bundles* below.
- **Components (`/create-component` Step 6):** **Default = parent** (or design-repo `assemble-*.mjs` + parent `use_figma`) per [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0** — **not** `Task` → [`create-component-figma-slice-runner`](skills/create-component-figma-slice-runner/SKILL.md) for full-size slices. For **non-canvas** one-off scripts, still follow [`16`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) — split into multiple `use_figma` calls if needed; do not rely on a subagent to emit oversized `call_mcp` payloads.

### Session runbook — style-guide tables, then components (staged)

When a single user request covers **both** style-guide table canvas work **and** `/create-component` draws, **do not** interleave a full 15* table redraw and a full component `use_figma` in **one** parent turn. That pattern maximizes JSON truncation and tool-arg failures on short-context hosts.

- **Phase A — Tables (unchanged):** Run `/create-design-system` Step 15a–15c and Step 17 as documented — **one** [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) `Task` per slug, **three** sequential `Task`s for 15c, then audit. Do **not** change [`canvas-templates/`](skills/create-design-system/canvas-templates/) geometry, [`conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md) rules, or bundle layout to “optimize” this — the split is **orchestration only**.
- **Phase B — Components:** Run `/create-component` **one component at a time** to completion (install + preflight + Step 6 **12** `use_figma` invocations in **parent** or `EXECUTOR` preassembled, then registry / reporting) before starting the next, across **as many assistant turns as needed** — follow [`skills/create-component/phases/00-index.md`](skills/create-component/phases/00-index.md) for time order; see [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) *Session / output limits*.
- **Orchestration vs engine:** Staging **tables**, **bundles**, and **components** in **separate** turns is required. **Step 6** = **12** sequential slices (DAG in [`13`](skills/create-component/conventions/13-component-draw-orchestrator.md)) — **default:** parent assembles and calls `use_figma` per [`create-component-figma-slice-runner` §0.1](skills/create-component-figma-slice-runner/SKILL.md) + [`EXECUTOR` §0](skills/create-component/EXECUTOR.md). **Do not** default to `Task` subagents for **~26–30K+** `code` that subagents often cannot emit. **Optional** `Task` per slice only if the host is proven to pass full `call_mcp` from a subagent. See [`08`](skills/create-component/conventions/08-cursor-composer-mcp.md).

**`/create-component` Step 6:** After Steps **1–5** and **4.7**, run **12** `use_figma` invocations in order (scaffold sub-slugs → `cc-variants` → … → `cc-doc-finalize`, **`handoffJson`** between them) with assembly per [`create-component-figma-slice-runner`](skills/create-component-figma-slice-runner/SKILL.md) and [`EXECUTOR` §0](skills/create-component/EXECUTOR.md). **Machine order and slice count** match **`SLUG_ORDER`** in [`scripts/merge-create-component-handoff.mjs`](scripts/merge-create-component-handoff.mjs) (**`SLUG_ORDER.length`**, currently **12**). The **parent** may `Read` min engines and preamble; optional `Task` only if viable. `check-payload` before each `use_figma`. Style-guide canvas bundles use **`canvas-bundle-runner`** (or [16](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) fallback) — not component `Task` for Step 15/17.

### Canvas bundles (Step 15 / Step 17)

**Preferred (token isolation):** `Task` → [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md) with `step=<slug>`, `fileKey`, `description` **when** the subagent can pass the full bundle in `use_figma`. **If** subagent `call_mcp` fails on bundle size, use **parent** `use_figma` with `Read` on the committed `.min.mcp.js` (same bytes) per [16](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) — do not keep retrying a subagent that cannot materialize the payload. Rationale: [16](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*; full contract: [`canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md). Slug map: [`17-table-redraw-runbook.md`](skills/create-design-system/conventions/17-table-redraw-runbook.md). 15c = **three** sequential calls in **order** (Layout → Text Styles → Effects) — one `Task` or one parent `use_figma` per slug, depending on what works.

### Host vs agent transport (Figma `use_figma`)

**Supported path:** Put the assembled **`code`** (from committed **`Read(...)`** of **`.min.mcp.js`** or from **`assemble-slice --out`**) in the MCP tool argument’s **`code`** field. **`Read`** preserves full-length bytes; shell `cat` / `type` can truncate — do **not** use those as proof of correctness.

**No server-side shortcut:** The shipping Figma **`use_figma`** API takes **`code`** as an **inline** string — there **is no** **`codeWorkspacePath`**. Temporary files bridge **trusted** bytes into the **parent’s** **`call_mcp`**; they **do not** substitute for **`Read`** on committed bundles ([`skills/create-design-system/canvas-templates/bundles/`](skills/create-design-system/canvas-templates/bundles/)) or for duplicating bundles into **`skills/`** scratch paths. Operational checklist: **[`21` — MCP ephemeral payload protocol](skills/create-component/conventions/21-mcp-ephemeral-payload-protocol.md)**.

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

When installing shadcn components and drawing them to Figma, **Mode B (`synthetic-fallback`) is not always an error** — many files (e.g. `form`) have no extractable `cva()` for [`skills/create-component/resolver/extract-cva.mjs`](skills/create-component/resolver/extract-cva.mjs). **Do not** conflate “extractor exit 1” with “missing `class-variance-authority`” in a single paraphrase; read stdout JSON verbatim and follow [`skills/create-component/REFERENCE-agent-steps.md`](skills/create-component/REFERENCE-agent-steps.md) §4.5.0 and [`skills/create-component/conventions/05-code-connect.md`](skills/create-component/conventions/05-code-connect.md) §2.5.5. **Axis B** in [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) may mark a component `unresolvable` for drift diffs while `/create-component` can still draw in Mode B.

**MCP transport (short-context / Composer-class agents):** **North star:** [`skills/create-component/conventions/18-mcp-payload-budget.md`](skills/create-component/conventions/18-mcp-payload-budget.md) (≲ **8–10 kB** UTF-8 per assembled `code` + wrapper) via **more** granular slices. Until templates catch up, committed bundles may be much larger; every `use_figma` call must still be **one** complete JSON tool argument — `Unexpected end of JSON input` usually means **truncation or invalid JSON**, not a Figma bug. [`scripts/check-payload.mjs`](scripts/check-payload.mjs) validates the **`code` string** only; the **entire** MCP tool-arguments object must still round-trip through `JSON.stringify` / `JSON.parse` in the host. [`scripts/check-use-figma-mcp-args.mjs`](scripts/check-use-figma-mcp-args.mjs) reports UTF-8 size of a serialized `use_figma` call. Do **not** use gzip/base64 bootstrap unless the plugin host supports **`DecompressionStream`** (often it does not — see [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md)). Full checklist: [`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) — *Short-context agents / MCP transport*.

**If the parent cannot embed `code` in one `call_mcp` turn:** prefer **writer subagent** (assemble + `check-payload` + write to the **design repo**; return short path metadata only) + **parent** `Read` + `use_figma` over a **runner** subagent that runs many irrelevant tools before MCP — see [`skills/create-component/conventions/08-cursor-composer-mcp.md`](skills/create-component/conventions/08-cursor-composer-mcp.md) **§D.1**.

**Large `use_figma` transport (measured 2026):** Cursor @-mentions for files in **chat** are not documented as a substitute for inline `code` in the Figma MCP tool. **Full write-up** (probes, gzip/proxy go/no-go, op-interpreter, σ / partition): [`docs/mcp-transport-solution-architecture-2026.md`](docs/mcp-transport-solution-architecture-2026.md). If the model/host truncates tool JSON, use [`docs/mcp-transport-cursor-fallback.md`](docs/mcp-transport-cursor-fallback.md) and [`skills/create-component/conventions/18-mcp-payload-budget.md`](skills/create-component/conventions/18-mcp-payload-budget.md) (target **8–10 kB** per slice) before changing assembly defaults. **Default in Cursor for `use_figma`:** parent **`call_mcp`** using the IDE’s Figma MCP session.

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
