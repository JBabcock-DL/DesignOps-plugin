# Component Canvas Conventions — Router

> This file used to hold all component-canvas conventions in one ~940-line document. It has been split into topic-scoped files under [`conventions/`](./conventions/) so agents Read smaller, focused chunks. This router stays in place so **every existing cross-link to `CONVENTIONS.md` keeps working** — the section IDs below point at the new file paths.

## Files

| File | Covers |
|---|---|
| [`conventions/00-overview.md`](./conventions/00-overview.md) | Router · Mode A / Mode B contract · Glossary (§0, §0.1, §15) |
| [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) | `CONFIG` schema · icon slots · element component properties · curated prop map (§3, §3.3, §3.5) |
| [`conventions/02-archetype-routing.md`](./conventions/02-archetype-routing.md) | Archetype routing table · `composes[]` composition (§3.1.1, §3.05) |
| [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) | Figma Auto-Layout enum invariants · 10px-collapse rules · property-assignment order (§3.1.2, §10) |
| [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) | Matrix rule · page layout · ComponentSet section · properties table · matrix spec · usage notes · build order · Button reference (§§1, 2, 3, 3.1.3, 3.2, 4, 5, 6, 7, 8, 9, 11, 12, 13) |
| [`conventions/05-code-connect.md`](./conventions/05-code-connect.md) | Mode A extraction · class-to-token resolution · Code Connect integration (§2.5, §3.4) |
| [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) | MA.* + S9.* audit checklist · authoritative-rule index (§14, §15) |
| [`conventions/07-token-paths.md`](./conventions/07-token-paths.md) | Token path canonicals · Step 4.7 pre-flight · banned inference strategies |
| [`conventions/08-cursor-composer-mcp.md`](./conventions/08-cursor-composer-mcp.md) | Cursor / Composer Step 6 transport · `Task` + runner |
| [`conventions/13-component-draw-orchestrator.md`](./conventions/13-component-draw-orchestrator.md) | Step 6 · `SLUG_ORDER` · `*.step0` + `create-component-engine-doc.step1..6` · scaffold sub-slugs · **04** §2.2 placeholders |

## System audit — Mode A / Mode B (read order for agents)

Lower-capability models should walk this list in order when debugging extraction vs draw. Authoritative behavior defers to **[`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md)** (especially §4.5.0, §4.5, Steps 6–8) and [`SKILL.md`](./SKILL.md) **§9**. **First read:** [`EXECUTOR.md`](./EXECUTOR.md) for assembly + transport.

| Layer | Path | Role |
|------|------|------|
| Time-ordered phases | [`phases/`](./phases/) (`00-index` + `01`–`10`) | *When* to run each unit; **six** draw phases (`04`–`09`) for Step 6 — [`SKILL.md` *Phase execution*](./SKILL.md) |
| Quickstart + transport | [`EXECUTOR.md`](./EXECUTOR.md) | §0 recipe; `check-payload`; 50k / JSON gates |
| Canonical skill | [`SKILL.md`](./SKILL.md) + [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) | Router + **§9**; Steps **1–8** prose + template |
| Overview + glossary | [`conventions/00-overview.md`](./conventions/00-overview.md) | Mode A vs B vocabulary |
| Extraction + error semantics | [`conventions/05-code-connect.md`](./conventions/05-code-connect.md) | Tier1/Tier2; §2.5.5 decision table |
| Doc pipeline | [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) | Mode A-only doc step 0 |
| Audit | [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) | §14.0 MA.* (N/A in Mode B) |
| Token gate | [`conventions/07-token-paths.md`](./conventions/07-token-paths.md) | Step 4.7; `unresolvedTokenPaths` |
| Implementations | [`resolver/extract-cva.mjs`](./resolver/extract-cva.mjs), [`resolver/resolve-classes.mjs`](./resolver/resolve-classes.mjs) | Extractor + resolver |
| Curated props | [`shadcn-props/`](./shadcn-props/) | Mode B seed; Mode A merge fields |
| Axis B consumer | [`../sync-design-system/SKILL.md`](../sync-design-system/SKILL.md) | Drift diff `unresolvable` (not a create-component hard stop) |

## Legacy section-ID map

Old references in the wild point at section IDs like `CONVENTIONS.md §3.1.2` or `CONVENTIONS.md §14`. Use this table to find the new home:

| Old ID | New file |
|---|---|
| §0 · §0.1 · §15 | [`conventions/00-overview.md`](./conventions/00-overview.md) |
| §3 (CONFIG schema) · §3.3 (icon slots / props) · §3.5 (curated prop map) | [`conventions/01-config-schema.md`](./conventions/01-config-schema.md) |
| §3.1.1 (archetype routing) · §3.05 (composes) | [`conventions/02-archetype-routing.md`](./conventions/02-archetype-routing.md) |
| §3.1.2 (enum invariants) · §10 (auto-layout rules) | [`conventions/03-auto-layout-invariants.md`](./conventions/03-auto-layout-invariants.md) |
| §1 · §2 · §3 (ComponentSet) · §3.1.3 (doc pipeline) · §3.2 (Component Set section) · §4 (properties table) · §5 (matrix) · §6 (usage) · §7 (state axes) · §8 (variant rows) · §9 (size rows) · §11 (bindings) · §12 (build order) · §13 (Button reference) | [`conventions/04-doc-pipeline-contract.md`](./conventions/04-doc-pipeline-contract.md) |
| §2.5 (Mode A extraction) · §3.4 (class-to-token) | [`conventions/05-code-connect.md`](./conventions/05-code-connect.md) |
| §14 (audit checklist) · §15 (authoritative-rule index) | [`conventions/06-audit-checklist.md`](./conventions/06-audit-checklist.md) |

When in doubt, start at [`conventions/00-overview.md`](./conventions/00-overview.md) — it has the full router and the glossary every other file leans on.

## Authoritative source

[`skills/create-component/SKILL.md`](./SKILL.md) (**§9**) and [`REFERENCE-agent-steps.md`](./REFERENCE-agent-steps.md) (Steps **1–8**). When any `conventions/*.md` file disagrees with those, the **skill router + EXECUTOR** win for procedure/transport; **§9** + cited conventions win for assertions/geometry. **First read:** [`EXECUTOR.md`](./EXECUTOR.md) for assembly + transport.
