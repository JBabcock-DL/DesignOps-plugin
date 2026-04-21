# create-component / conventions / 02-archetype-routing.md

> Scope: picking `CONFIG.layout` for a new component, plus the rules for **composition** (`composes[]`) when a component is built from instances of other components. Both concepts determine which builder function the draw engine dispatches to — the archetype is the scaffold, `composes[]` replaces the inner children when present.
>
> **Related**: [`01-config-schema.md`](./01-config-schema.md) (where the `layout` / `composes` fields are defined). [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) (the enum rules every archetype builder must follow). [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) (what builders MAY NOT touch — doc pipeline contract). The builder source lives in [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js).

## 3.1.1 — Archetype routing table

`CONFIG.layout` selects a draw-engine builder defined in [`draw-engine.figma.js §6.2a`](../templates/draw-engine.figma.js). Every shadcn/ui component listed under [https://ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components) maps to exactly one archetype; [`shadcn-props.json`](../shadcn-props.json) encodes the canonical mapping so Mode A extraction and Mode B synthesis agree.

| Archetype | Builder | Shape | shadcn/ui components |
|---|---|---|---|
| `chip` | `buildVariant` | HORIZONTAL auto-layout with optional leading/trailing icon-slot + label. | Button, Badge, Toggle, Kbd, Label, Typography, Direction, Button Group (via `composes`), Toggle Group (via `composes`), Pagination (via `composes`) |
| `surface-stack` | `buildSurfaceStackVariant` | VERTICAL auto-layout card surface: `CardHeader` (title stack + optional action) → `CardContent` (dashed content slot) → `CardFooter` (dashed action slot). Matches shadcn Card `flex flex-col gap-6 rounded-xl border py-6`. | Card, Alert, Alert Dialog, Dialog, Sheet, Drawer, Popover, Tooltip, Hover Card, Empty, Sidebar, Sonner, Toast, Chart, Calendar, Table |
| `field` | `buildFieldVariant` | VERTICAL outer: Label → field chrome (HORIZONTAL or VERTICAL with placeholder + optional icon-slots, or multi-box for OTP) → helper text. Matches shadcn Input `flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm`. | Input, Textarea, Select, Combobox, Date Picker, Input OTP, Input Group, Field, Form, Native Select |
| `row-item` | `buildRowItemVariant` | HORIZONTAL row with optional leading icon → title + optional description stack → optional shortcut + optional trailing icon/chevron. Matches shadcn DropdownMenuItem `flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm`. | Dropdown Menu, Menubar, Navigation Menu, Context Menu, Command, Breadcrumb, Item |
| `tiny` | `buildTinyVariant` | Shape dispatcher — `separator` (1px line), `skeleton` (rounded rect with muted fill), `spinner` (circle outline), `progress` (track + filled bar), `avatar` (rounded with initials), `aspect-ratio` / `scroll-area` (dashed container). No label/icon composition. | Separator, Skeleton, Spinner, Progress, Avatar, Aspect Ratio, Scroll Area, Slider |
| `container` | `buildContainerVariant` | For `kind='accordion'`: trigger row (title + chevron) + bottom border + optional expanded panel with body text. For `kind='tabs'`: TabsList (rounded muted row with triggers) + TabsContent dashed panel. | Accordion, Collapsible, Tabs, Resizable, Carousel |
| `control` | `buildControlVariant` | Small interactive primitive — 16×16 square (checkbox), 16×16 circle (radio), 36×20 pill w/ thumb (switch). Checked glyph rendered when variant name contains `checked=true`/`pressed=true`/`on`. | Checkbox, Radio Group, Switch |

> **Slider note.** `slider` is currently routed to `tiny` because its canonical display is a 1-pixel-stripe track + thumb shape with no label/icon composition. It is the only **interactive** control in the `tiny` archetype — every other `tiny` component is pure display / passive chrome. Revisit this mapping if hover / drag states are ever needed: at that point a dedicated `range` archetype (or promoting `slider` into `control` with `shape: 'slider'`) becomes more accurate than `tiny`.

**Fallback rule:** If `CONFIG.layout` is omitted or the dispatch encounters an unknown value, the engine falls back to `chip` and emits a `console.warn`. Never introduce a new archetype without also:
1. Adding the builder function in [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js) (above the shared helpers).
2. Extending this table **and** [`shadcn-props.schema.json`](../shadcn-props.schema.json) `layout` enum.
3. Adding a CONFIG reference block in `SKILL.md` §0 (Mode B synthesis template).
4. Updating every matching entry in [`shadcn-props.json`](../shadcn-props.json) and re-running `node scripts/build-create-component-docs.mjs`.

**Authoring tip.** If you can't find a row for your component, it is almost always **`surface-stack`** (for container-shaped components) or **`chip`** (for inline affordances). When in doubt, match the shadcn docs composition block — if the docs show `<Card><CardHeader/>...<CardContent/>...<CardFooter/></Card>` or similar, it's `surface-stack`.

**Sample copy rule.** For non-chip archetypes, seed every variant with real one-line sample copy so the designer sees a plausible shape — never leave a region blank. Title defaults to `CONFIG.title`; description defaults to the first sentence of `CONFIG.summary`. See `§0.surface` / `§0.field` / etc. in the `SKILL.md` §6 template for per-component overrides.

---

## 3.05 — Composition via `composes` (atomic composites)

When a component declares `composes[]` in [`shadcn-props.json`](../shadcn-props.json) (validated in `SKILL.md` §4.5.g), its **variant chrome** still comes from this component's own extracted cva (fill, stroke, padding, radius, layout gaps). **Inner matrix content** is not invented from flat shapes: each variant cell is built as a horizontal stack of **`slot/{slotName}`** auto-layout frames containing real **`InstanceNode`s** of the published child `ComponentSet` (resolved at draw time via `.designops-registry.json` — see `SKILL.md` Step 5).

- **Slot names** match Code Connect `figma.children('<slot>')` lookups in composite `.figma.tsx` templates.
- **Detaching** a nested instance inside a composite is a **composition drift** signal for `/sync-design-system` Axis B (`COMPOSITION_DRIFT` bucket — see that skill's Step 3B).
- **Non-goals** (per atomic-composition plan): no JSX parsing; no automatic prop propagation from composite → child in v1 (`defaultProps` on each compose row only).

The composite archetype is dispatched through `buildComposedVariant` in [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js); every builder there honors [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) and must not touch the doc pipeline (see [`04-doc-pipeline-contract.md` §3.1.3](./04-doc-pipeline-contract.md#313--archetype-builders-must-not-touch-the-doc-pipeline)).
