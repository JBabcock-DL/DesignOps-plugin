# /create-component — EXECUTOR (canonical quickstart)

> **Repo vs marketplace:** If you edit this file under `skills/create-component/`, mirror to the Claude plugin cache per [`AGENTS.md`](../../AGENTS.md) (skill edits section).

---

## §0 — Quickstart

> **Composer 2 / Cursor:** [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) — measurement, disk staging, **`Read` → `call_mcp`**.

**This file** is the single canonical recipe for install, CONFIG, **five-call** Figma draw, `check-payload`, and MCP transport. Then open [`SKILL.md`](./SKILL.md) for **§9** and supported components. On conflict: **EXECUTOR** wins assembly and transport; **conventions/** win cited geometry.

**Who runs shell commands:** Agents execute **`node scripts/…`** / **`npm run …`** from the plugin repo per [`AGENTS.md`](../../AGENTS.md) (*Agents run plugin CLI*). Designers are **not** expected to copy-paste terminal steps unless an exception applies (no agent, CI-only workflow, or blocker listed there).

### Step 6 — five `use_figma` calls (same runner pattern as style-guide canvas)

Integrated IDE Figma MCP only. **Preferred:** `Task` → **[`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md)** (one Task per step) so large assemble text stays out of the parent thread — same delegation model as Steps 15a–c / 17. **Fallback:** parent **`Read`** the same assembled file → **`call_mcp` `use_figma`** if the subagent cannot pass the full tool JSON.

**Per-step assembly (before each Task or parent invoke):**

1. Write **`ctx`** to a UTF-8 file: `const ctx = { … };` with full **CONFIG** plus at least `activeFileKey` or `fileKey`, `registryComponents`, and `usesComposes` / `composedWith` when composites run. Match the shape expected by [`canvas-templates/cc-runtime-head.js`](./canvas-templates/cc-runtime-head.js) (`const CONFIG = ctx` in-bundle — **ctx** is the single merged object).
2. Run **`node scripts/assemble-component-use-figma-code.mjs --step <slug> --ctx-file <path> --out <path>`** from this repo root (or pass absolute paths). Slugs: **`cc-scaffold`**, **`cc-properties`**, **`cc-matrix`**, **`cc-usage`**, **`cc-component-chip`**, **`cc-component-surface-stack`**, **`cc-component-field`**, **`cc-component-row-item`**, **`cc-component-tiny`**, **`cc-component-control`**, **`cc-component-container`**, **`cc-component-composed`** — pick the **`cc-component-*`** row for **`CONFIG.layout`** via [`02-archetype-routing.md`](./conventions/02-archetype-routing.md).
3. **`npm run check-payload -- <out>`** — must exit 0.
4. **`Task`:** `step=<same slug>`, `assembledCodePath=<out>`, `fileKey=…`, `description=…` per **[`canvas-bundle-runner` §6](../canvas-bundle-runner/SKILL.md)**. If **`ok: false`** and errors indicate transport/truncation, **parent** repeats step 4 with **`Read` → `call_mcp`** on the **same** `<out>` file.

**Batch assemble (recommended):** From plugin repo root run **`npm run create-component-step6 -- --ctx-file <path/to/ctx.js>`** [`scripts/create-component-step6-all.mjs`](../../scripts/create-component-step6-all.mjs). That emits **`assembled-cc-*.mjs`** under **`--out-dir`** (default: dirname of ctx), runs **`check-payload`** on each (optional **`--check-mcp-args`** for full MCP wrapper JSON), optionally **`--probe-first`** ([`probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs)), and writes **`create-component-step6-progress.json`** with **`invokeHints`** for the five MCP calls. Still requires **five sequential** **`Task` → [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md)** or parent **`Read` → call_mcp`** — this script does **not** invoke Figma.

**Parallelism:** Do **not** launch **two `Task`** delegations for **`cc-*`** steps at the same time (e.g. matrix + usage in parallel). Same ordering rule as style-guide canvas [**16** § Canvas runner](../create-design-system/conventions/16-mcp-use-figma-workflow.md): **strict sequence**, one **`use_figma`** completes before the next assemble/runner prompt.

**Order (fixed):** `cc-scaffold` → `cc-properties` → **`cc-component-*`** (one row from the table) → `cc-matrix` → `cc-usage`.

**Bundles:** [`skills/create-component/canvas-templates/bundles/*.min.mcp.js`](./canvas-templates/bundles/). **Sources:** [`canvas-templates/`](./canvas-templates/). **Build:** `npm run bundle-component` ([`scripts/bundle-component-mcp.mjs`](../../scripts/bundle-component-mcp.mjs)).

**Caps:** Figma `use_figma.code` **`maxLength` 50 000**. If transport fails, [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) + shrink **CONFIG** prose per [`18-mcp-payload-budget.md`](./conventions/18-mcp-payload-budget.md) — do not add gzip/bootstrap wrappers.

| Concern | Guidance |
|--------|-----------|
| **Writer subagents** | May run **`assemble-component-use-figma-code.mjs`** + **`check-payload`** and write **`ctx`** / assembled paths only; **runner** or **parent** owns **`call_mcp`**. |
| **Session runbook** | Finish `/create-design-system` table bundles (15a–c, 17) in separate turns from `/create-component` draws — [`AGENTS.md`](../../AGENTS.md). |

### §0.1 — `code` assembly checklist

1. **`const ctx = { ... };`** — full CONFIG + file/registry fields (see Step 6).
2. **`assemble-component-use-figma-code.mjs`** — writes `ctx` + committed bundle into one file (same bytes as hand-concat).
3. **`npm run check-payload -- <assembled>`** — must exit 0 before MCP.
4. **`Task` → `canvas-bundle-runner`** with `assembledCodePath`, or **parent** `Read` → `call_mcp`.
5. **Full MCP JSON** — if the host has truncated `call_mcp` before, also verify the full tool-arguments object serializes ([`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs)).

CONFIG authoring: prefer **`npm run build-config-block -- <component> --out <path>.config.js`**; avoid hand-typing apostrophes in single-quoted strings ([`07-token-paths.md`](./conventions/07-token-paths.md)).

### §0.2 — Twelve steps (sketch)

| # | Step | Notes |
|---|------|--------|
| 1 | Resolve component list | `AskUserQuestion` if needed |
| 2 | Locate `tokens.css` | May be null (Mode B / hex fallback) |
| 3 | shadcn init + token wiring | |
| 3b | Icon pack bootstrap | `designops.config.json` |
| 4 | `shadcn add` each component | |
| 4.3 | Peer dependency audit | |
| 4.4 | Icon import rewrite | |
| 4.7 | Token path preflight | [`07-token-paths.md`](./conventions/07-token-paths.md) |
| 5 | Resolve Figma `fileKey` | handoff or prompt |
| 5.5 | `check-payload` | before **each** Step 6 call |
| 6 | Draw → Figma | **Five** calls above — **`Task` → `canvas-bundle-runner`** preferred; **parent** `Read` → `call_mcp` on transport failure |
| 7 | §9 assertions | [`SKILL.md`](./SKILL.md) — use **`component-*`** return for structure checks |
| 8 | Reporting + registry | [`resolver/merge-registry.mjs`](./resolver/merge-registry.mjs) |

Mode A / Mode B extraction semantics: [`05-code-connect.md`](./conventions/05-code-connect.md).

### §0.3 — When `use_figma` returns empty / undefined

Inspect the bundle tail for a top-level `return` (minifier regression). Re-run **`npm run bundle-component`**. Do not loop on `Task` subagents for silent empty returns — fix the bundle or payload once.

### §0.4 — Deep links

| Topic | Where |
|-------|--------|
| CONFIG schema | [`01-config-schema.md`](./conventions/01-config-schema.md) |
| Doc layout / matrix / usage | [`04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) |
| Auto-layout order | [`03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) |
| Audit ↔ §9 | [`06-audit-checklist.md`](./conventions/06-audit-checklist.md) |
| Non-canvas MCP patterns | [`16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
