# Design System Conventions — Router & index

> **Audience:** AI agents on `/new-project`, `/create-design-system`, or `/sync-design-system`.
>
> **Do not read this repo in one giant blob.** Use [`SKILL.md`](./SKILL.md) for orchestration, **Known gotchas (§0)** inlined there, and the **per-phase conventions map** in SKILL. Open only the shard files listed for the phase you are running.
>
> **Precedence:** The shards under [`conventions/`](./conventions/) plus **§0** in [`SKILL.md`](./SKILL.md) are **authoritative** for canvas geometry, table structure, column widths, cell patterns, auto-layout sizing rules, and token bindings. Phase files under [`phases/`](./phases/) **orchestrate** (which step, which page, which slug, which row set, which AskUserQuestion, which `codeSyntax` table). They do not own geometry, columns, cells, or sizing rules. **When a phase file disagrees with these conventions, the conventions win.** If a phase file encodes a deviation that should stick, move the rule into the appropriate shard (or §0 in SKILL + [`conventions/00-gotchas.md`](./conventions/00-gotchas.md)) first, then reference it from the phase.

## §0 — Known gotchas

**Authoritative for agents (in skill context):** [`SKILL.md`](./SKILL.md) — section **Known gotchas (§0 — paired with `conventions/00-gotchas.md`)**.

**File copy for deep links / humans:** [`conventions/00-gotchas.md`](./conventions/00-gotchas.md) (~130 lines). **Edit both together** when changing §0.

## Shard TOC (approximate line counts — use for liveness messages)

| § (legacy) | Topic | File | ~Lines |
| --- | --- | --- | --- |
| 1 | Five collections | [`conventions/01-collections.md`](./conventions/01-collections.md) | 20 |
| 2 | codeSyntax WEB / ANDROID / iOS | [`conventions/02-codesyntax.md`](./conventions/02-codesyntax.md) | 75 |
| 3–7 | Geometry, pages, body variants, naming, Doc/* styles | [`conventions/03-through-07-geometry-and-doc-styles.md`](./conventions/03-through-07-geometry-and-doc-styles.md) | 200 |
| 8–9 | Table hierarchy + autolayout | [`conventions/08-hierarchy-and-09-autolayout.md`](./conventions/08-hierarchy-and-09-autolayout.md) | 120 |
| 10 | Column specs (prose + tables) | [`conventions/10-column-spec.md`](./conventions/10-column-spec.md) | 120 |
| 10 | Column widths (structured) | [`conventions/column-widths.json`](./conventions/column-widths.json) | — |
| 11–13 | Cells, bindings, build order | [`conventions/11-cells-12-bindings-13-build-order.md`](./conventions/11-cells-12-bindings-13-build-order.md) | 95 |
| 14 | Audit checklist | [`conventions/14-audit.md`](./conventions/14-audit.md) | 55 |
| 16 | MCP `use_figma` agent workflow (file-driven canvas, split calls, host limits) | [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) | ~95 |

## Where the authoritative rules live

| Topic                              | Location |
| ---------------------------------- | -------- |
| `.designops-registry.json` (Figma component keys + `nodeId` map for `/create-component`, `/code-connect`, `/sync-design-system`) | [`skills/create-component/registry.schema.json`](../create-component/registry.schema.json) + [`skills/create-component/SKILL.md`](../create-component/SKILL.md) Step 5 + [`skills/create-component/resolver/merge-registry.mjs`](../create-component/resolver/merge-registry.mjs) |
| Full skill orchestration + §0 + per-phase load map | [`SKILL.md`](./SKILL.md) |
| Visual language (tone, reference links, premium pillars) | [`phases/06-canvas-documentation-spec.md`](./phases/06-canvas-documentation-spec.md) § **A–G** |
| Table format spec (hierarchy, columns, cells, bindings, build order) | Shards above + §0 in SKILL |
| MCP `use_figma`: read templates/data or **bundles** (`canvas-templates/bundles/*.mcp.js`), plain `code`, split if >~50k | [`conventions/16-mcp-use-figma-workflow.md`](./conventions/16-mcp-use-figma-workflow.md) |
| Theme codeSyntax table (explicit)  | [`phases/02-steps5-9.md`](./phases/02-steps5-9.md) § **6** + [`phases/02b-theme-codesyntax.md`](./phases/02b-theme-codesyntax.md) |
| Typography codeSyntax rule         | [`phases/02-steps5-9.md`](./phases/02-steps5-9.md) § **7** / **7b**        |
| Body text variant rules            | [`phases/02-steps5-9.md`](./phases/02-steps5-9.md) § **7b** + [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) §0 |
| Sync redraw steps (9b, 9d, 9e)     | [`skills/sync-design-system/SKILL.md`](../sync-design-system/SKILL.md)     |
| New-project page scaffold          | [`skills/shared/pages.json`](../shared/pages.json) + [`skills/new-project/phases/05-scaffold-pages.md`](../new-project/phases/05-scaffold-pages.md) |
| `_Header` template                 | [`skills/new-project/phases/05b-documentation-headers.md`](../new-project/phases/05b-documentation-headers.md) |

When you are unsure, **`Read` the relevant shard** rather than guessing.
