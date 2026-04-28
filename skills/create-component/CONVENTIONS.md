# Component Canvas Conventions — Router

> This file used to hold all component-canvas conventions in one large document. Topic-scoped files live under [`conventions/`](./conventions/). This router keeps legacy **section IDs** stable (see map at bottom).

## Files

| File | Covers |
|---|---|
| [`conventions/00-overview.md`](./conventions/00-overview.md) | Router · Mode A / Mode B · glossary |
| [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) | `CONFIG` schema · icon slots · element properties |
| [`conventions/02-archetype-routing.md`](./conventions/02-archetype-routing.md) | Archetype routing · `composes[]` |
| [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) | Auto-layout enums · 10px-collapse · assignment order |
| [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) | Matrix · page layout · properties table · usage |
| [`conventions/05-code-connect.md`](./conventions/05-code-connect.md) | Mode A extraction · Code Connect |
| [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) | MA.* + S9.* audit |
| [`conventions/07-token-paths.md`](./conventions/07-token-paths.md) | Token paths · Step 4.7 |

## Read order for agents

1. [`EXECUTOR.md`](./EXECUTOR.md) — install + **five-call** draw + `check-payload`.
2. [`SKILL.md`](./SKILL.md) — §9 + supported list.
3. Convention shards above as needed for CONFIG, geometry, audit.

| Layer | Path |
|------|------|
| Quickstart + transport | [`EXECUTOR.md`](./EXECUTOR.md) |
| Figma MCP workflow (generic) | [`../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
| Canvas bundles (source) | [`canvas-templates/`](./canvas-templates/) |

## Legacy section-ID map

| Old ID | New file |
|---|---|
| §0 · §0.1 · §15 | [`conventions/00-overview.md`](./conventions/00-overview.md) |
| §3 · §3.3 · §3.5 | [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) |
| §3.1.1 · §3.05 | [`conventions/02-archetype-routing.md`](./conventions/02-archetype-routing.md) |
| §3.1.2 · §10 | [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) |
| §1–§13 (doc pipeline) | [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) |
| §2.5 · §3.4 | [`conventions/05-code-connect.md`](./conventions/05-code-connect.md) |
| §14 · §15 | [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) |

When in doubt, start at [`conventions/00-overview.md`](./conventions/00-overview.md).

## Authoritative source

[`SKILL.md`](./SKILL.md) (**§9**) and [`EXECUTOR.md`](./EXECUTOR.md) (**§0**). **§9** + cited conventions win assertions/geometry; **EXECUTOR** wins procedure and MCP transport.
