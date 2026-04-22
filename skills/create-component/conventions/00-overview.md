# create-component / conventions / 00-overview.md

> **Audience:** AI agents (Claude, Sonnet, etc.) running `/create-component`. Read the specific sub-file you need before authoring / editing a component — the router below maps each concern to the authoritative file.
>
> **Authoritative source:** [`skills/create-component/SKILL.md`](../SKILL.md). When any of these sub-files disagrees with the skill, the skill wins. The skill's §0 Quickstart is the single canonical recipe; §9 Self-check is the pass/fail gate for reporting a component "drawn".
>
> **Related:** [`skills/create-design-system/CONVENTIONS.md`](../../create-design-system/CONVENTIONS.md) (router) and [`skills/create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) — the style-guide canvas geometry this set of files reuses. **§0 gotchas:** [`skills/create-design-system/SKILL.md`](../../create-design-system/SKILL.md).

This folder replaces the single-file `CONVENTIONS.md` (~940 lines) that used to live next to `SKILL.md`. Content is identical — only the physical layout changed so agents Read smaller, topic-scoped files.

## Router

| When you are … | Read |
|---|---|
| Authoring a new component's `CONFIG` object (picking `layout`, `variants`, `sizes`, `style`, `iconSlots`, etc.) | [`01-config-schema.md`](./01-config-schema.md) |
| Picking `CONFIG.layout` and understanding which builder it routes to; wiring `composes[]` on a composite | [`02-archetype-routing.md`](./02-archetype-routing.md) |
| Writing or editing an archetype builder; debugging a Figma Auto-Layout `Invalid enum value` throw | [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) |
| Laying out the doc frame — matrix, properties table, ComponentSet tile, usage notes, token bindings | [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) |
| Extracting cva from shadcn sources (Mode A); mapping Tailwind classes → Figma tokens; curating `shadcn-props.json` | [`05-code-connect.md`](./05-code-connect.md) |
| Gating a component as "drawn to canvas"; running the audit checklist before surfacing a run summary | [`06-audit-checklist.md`](./06-audit-checklist.md) |
| Writing / validating any `fill`, `labelVar`, `strokeVar`, `padH`, `radius`, or `*Var` path on a `CONFIG`; avoiding the `--color-primary` vs `color/primary/default` spiral | [`07-token-paths.md`](./07-token-paths.md) |

## Two sources of truth (Mode A vs Mode B)

> **Contract.** `/create-component` accepts **two** inputs as authoritative for a component's structure, and never more than one at a time:
>
> - **Mode A — `shadcn-1:1`**: the installed `components/ui/{component}.tsx` source file is canonical. The skill extracts the cva variants, resolves every Tailwind class against `tokens.css`, and merges the result with the curated entry in [`shadcn-props.json`](../shadcn-props.json) to assemble CONFIG automatically. Figma is a **derived mirror** — no hand-authored CONFIG fields, no independent decisions about colors or sizing.
> - **Mode B — `synthetic-fallback` / `synthetic-no-shadcn`**: no installed source is available (shadcn declined, source file missing, cva import failure, `tokens.css` missing, or no `shadcn-props.json` entry). The agent fills in the Mode B synthetic CONFIG template in `SKILL.md` §6 using sensible shadcn-aligned defaults so the designer still gets a professional, designer-ready placeholder they can evolve.
>
> Mode A and Mode B share **exactly the same draw engine** below the CONFIG block — the icon slots, element component properties, matrix, properties table, and usage notes are byte-identical. The only variable is who writes CONFIG. `SKILL.md` §4.5 defines the Mode A extraction pipeline and the precondition probe that decides the mode per component; `SKILL.md` §6's mode branch routes into the correct CONFIG producer. [`06-audit-checklist.md`](./06-audit-checklist.md) §14.0 adds Mode A-specific audit assertions.

Every component drawn in a run carries a `CONFIG._source` tag (`shadcn-1:1`, `synthetic-fallback`, or `synthetic-no-shadcn`) that surfaces in the SKILL.md §8 reporting table.

**How to read `synthetic-fallback`:**

- **Recoverable** — a precondition failed (missing file, missing peer so Tier 1 `import()` threw, one-off parse bug). Fixing the project and re-running may flip the row to `shadcn-1:1`.
- **Structural** — the installed source **does not** expose an extractable `cva` config (e.g. `form`, `cn()`-only files, `tailwind-variants`). **`shadcn-props.json` + Mode B** may remain the long-term source for variant chrome; the canvas draw is still valid. Do not treat this as “waiting for a better source file” if upstream shadcn never used `cva` for that component.

Mode A rows track variant chrome from code automatically on every subsequent `/create-component` run when extraction succeeds.

## 0.1 — Glossary (canonical vocabulary)

> Any agent reading these files should use **exactly these terms** — no synonyms, no rephrasings. When `SKILL.md` §0 and any `conventions/*.md` file disagree, the skill wins, but terminology must be identical across both.

| Term | Definition |
|------|------------|
| **ComponentSet** | The single `ComponentSetNode` produced by `combineAsVariants`. It owns the `variant` / `size` properties and every element component property (`Label`, `Leading icon`, `Trailing icon`). One per component. Reparented **into** the doc frame at `doc/component/{name}/component-set-group`. |
| **variant (ComponentNode)** | A single `ComponentNode` inside the ComponentSet, one per `(variant × size)` tuple. Never "a Figma variant" as in vocabulary — that ambiguity is the problem this glossary prevents. |
| **variant axis** | The `variant` Figma property (e.g. `default`, `destructive`, `outline`). Populated from `CONFIG.variants[]`. |
| **size axis** | The `size` Figma property (e.g. `sm`, `default`, `lg`, `icon`). Populated from `CONFIG.sizes[]`. If `CONFIG.sizes === []`, no size axis is created. |
| **element component property** | A `TEXT` / `BOOLEAN` / `INSTANCE_SWAP` property added via `addComponentProperty` **on each ComponentNode before `combineAsVariants`**. After combining, identically-named properties unify at the ComponentSet level. The three canonical ones are `Label` (TEXT), `Leading icon` (BOOLEAN), `Trailing icon` (BOOLEAN). |
| **icon slot** | A 24×24 `FrameNode` named `icon-slot/leading`, `icon-slot/trailing`, or `icon-slot/center`. Fills `[]`, 1 px dashed stroke bound to `color/border/default`, cornerRadius 4, layoutMode `NONE`. Reserves space even when empty; the BOOLEAN element property toggles its `visible` field. Authoritative spec: [`01-config-schema.md`](./01-config-schema.md) §3.3.1. |
| **icon-only mode** | The state triggered when `CONFIG.label(size, variant)` returns `null` and at least one `iconSlots.*` flag is true. The directional slots collapse to a single `icon-slot/center`, and `padVEff = padH` makes the component square. This mirrors shadcn's `size=icon`. |
| **doc frame** | The top-level wrapper `doc/component/{name}` auto-layout frame holding the five sections: header, properties table, component-set-group, matrix, usage. One per component page. |
| **matrix cell** | A single `InstanceNode` in the Variant × State specimen grid. Each cell points back to the ComponentSet. Cells receive state overrides via `CONFIG.applyStateOverride`. |
| **state override** | A mutation applied to a matrix cell's instance at draw time to simulate `:hover` / `:active` / `:disabled`. The authoritative mechanism is **opacity** for button-like components; `setProperties({...})` is the exception for components where state IS a Figma variant (checkbox, switch). See [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) §13.1. |
| **primary variant** | The variant listed first in `CONFIG.variants`. It becomes the ComponentSet's default variant and is surfaced as the `defaultValue` of the `variant` property. |
| **doc/* node path** | The Figma layer-name convention: every node the skill creates inside a component page lives under `doc/component/{component}/...`. Used by the Step 9 self-check assertions to locate nodes mechanically. |
| **cva config** | The second argument to `cva(base, { variants, defaultVariants, compoundVariants })` inside a shadcn source file. The extractor (`resolver/extract-cva.mjs`) pulls this object out and hands it to the class resolver. |
| **leaf (CSS var)** | The last hop of a `var()` chain in `tokens.css` — a primitive-style name like `color-primary`, `color-background`, `corner-medium`, `space-md`. The resolver's `LEAF_TO_FIGMA` table reverse-maps leaves to Figma variable paths (e.g. `color-primary → color/primary/default`). |
| **shadcn alias** | A shadcn-style CSS var like `--primary`, `--border`, `--destructive-foreground`, defined in `tokens.css` as `var(--color-primary)` etc. Aliases chain to leaves; resolve by calling the resolver's `aliasToLeaf[name]` map. |
| **resolver bucket** | The output keys of `resolve-classes.mjs`: `fills`, `strokes`, `radii`, `spacing`, `typography`, `effects`, `layout`, `unresolved`. Each entry carries a `tailwindClass` and a `state` (`base`, `hover`, `disabled`, …). |
| **unresolved class** | A Tailwind utility the resolver could not map to a Figma token. Surfaced in SKILL.md §8 reporting; drives the Mode A audit checklist in [`06-audit-checklist.md`](./06-audit-checklist.md) §14.0. |

## Where the authoritative rules live

| Topic | File |
|---|---|
| Full orchestration (install + draw) | [`SKILL.md`](../SKILL.md) |
| `CONFIG` schema and per-component fields | [`01-config-schema.md`](./01-config-schema.md) |
| Archetype routing + `composes[]` composition | [`02-archetype-routing.md`](./02-archetype-routing.md) |
| Auto-layout enum invariants + order-of-assignment rules | [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) |
| Matrix layout, properties table, ComponentSet tile, usage notes, doc-pipeline contract, build order, Button reference | [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) |
| Mode A extraction + class-to-token resolution + curated prop map | [`05-code-connect.md`](./05-code-connect.md) |
| Audit checklist (MA.* + S9.*) | [`06-audit-checklist.md`](./06-audit-checklist.md) |
| Canonical token-path rules + pre-flight discovery + banned inference strategies | [`07-token-paths.md`](./07-token-paths.md) |
| `Doc/*` text style definitions | [`create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` §7](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) |
| Canvas geometry (1800 / 1640 / 80 padding) | [`create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` §3](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) |
| Page routing (component → page) | [`SKILL.md`](../SKILL.md) Step 6 routing table (regenerated by `scripts/build-create-component-docs.mjs`) |

When you are unsure, **`Read` the relevant file** rather than guessing. Every file referenced above is designed to be read in full by the agent before executing its step.
