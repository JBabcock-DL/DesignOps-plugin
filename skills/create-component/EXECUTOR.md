# /create-component — EXECUTOR (canonical quickstart)

> **Repo vs marketplace:** If you edit this file under `skills/create-component/`, mirror to the Claude plugin cache per [`AGENTS.md`](../../AGENTS.md) (skill edits section).

---

## §0 — Quickstart

> **Composer 2 / Cursor:** [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) — measurement, disk staging, parent **`Read` → `call_mcp`**.

**This file** is the single canonical recipe for install, CONFIG, **five-call** Figma draw, `check-payload`, and MCP transport. Then open [`SKILL.md`](./SKILL.md) for **§9** and supported components. On conflict: **EXECUTOR** wins assembly and transport; **conventions/** win cited geometry.

### Step 6 — five `use_figma` calls in the parent (default)

Integrated IDE Figma MCP only: assemble **`code`** = **`ctx` prefix + bundle body**, run **`check-payload`** on that string, then **`call_mcp` `use_figma`**. No parallel Node MCP invoker.

**`ctx`:** Must mirror full **CONFIG** plus at least `activeFileKey` or `fileKey`, `registryComponents` (or equivalent registry snapshot), and `usesComposes` / `composedWith` when composites run. Match the shape expected by [`canvas-templates/cc-runtime-head.js`](./canvas-templates/cc-runtime-head.js) and the bundle you execute.

**Order (fixed):**

1. **`scaffold.min.mcp.js`** — doc shell, header, table chrome, placeholders.
2. **`properties.min.mcp.js`** — fill properties table rows.
3. **`component-chip.min.mcp.js`** *or* **`component-<layout>.min.mcp.js`** — pick from `CONFIG.layout` and [`02-archetype-routing.md`](./conventions/02-archetype-routing.md) (`chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, `composed`).
4. **`matrix.min.mcp.js`** — variant × state matrix.
5. **`usage.min.mcp.js`** — usage / Do–Don’t notes.

**Bundles:** [`skills/create-component/canvas-templates/bundles/*.min.mcp.js`](./canvas-templates/bundles/). **Sources:** [`canvas-templates/`](./canvas-templates/) (`cc-runtime-head.js`, archetype splits, doc chunks). **Build:** `npm run bundle-component` ( [`scripts/bundle-component-mcp.mjs`](../../scripts/bundle-component-mcp.mjs) ).

**Caps:** Figma `use_figma.code` **`maxLength` 50 000**. Per-bundle bodies are sized to stay under the cap once `ctx` is prepended; if transport fails, use [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) and shrink **CONFIG** prose or split work per maintainer guidance — do not add gzip/bootstrap wrappers.

| Concern | Guidance |
|--------|-----------|
| **Writer subagents** | May assemble `code` to disk in the consumer repo or `tmp/`; **parent** performs `Read` → `call_mcp`. |
| **`Task` as `use_figma` runner** | Avoid defaulting here; subagents often cannot emit full tool args. |
| **Session runbook** | Finish `/create-design-system` table bundles (15a–c, 17) in separate turns from `/create-component` draws — [`AGENTS.md`](../../AGENTS.md). |

### §0.1 — `code` assembly checklist

1. **`const ctx = { ... };`** (or equivalent) — full CONFIG + file/registry fields.
2. **Bundle** — `Read` the committed `.min.mcp.js` for this step; concatenate after `ctx` (no extra eval wrappers).
3. **`node scripts/check-payload.mjs <file-or-stdin>`** — must exit 0 before MCP.
4. **Full MCP JSON** — if the host has truncated `call_mcp` before, also verify the full tool-arguments object serializes ([`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs)).

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
| 6 | Draw → Figma | **Five** calls above, parent default |
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
