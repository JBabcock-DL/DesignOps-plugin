# create-component / conventions / 06-audit-checklist.md

> Scope: the **audit checklist** every `/create-component` run must pass before a component is marked "drawn to canvas" in the Step 8 report. Every item is tagged either with an `S9.*` ID that maps 1:1 to a [SKILL.md §9 Self-check](../SKILL.md) assertion (verified against the `use_figma` return payload, no manual inspection needed), with `MA.*` for Mode A pre-draw extraction assertions, or with `V` for visual-only items that require a screenshot review. A component is not drawn until every `S9.*` / `MA.*` row passes; `V` rows are strongly recommended but not blocking.
>
> **§14.0 (Mode A only)** assertions evaluate the extraction / resolution phase ([`SKILL.md` §4.5](../SKILL.md) + [`05-code-connect.md` §§2.5 / 3.4](./05-code-connect.md) + [`01-config-schema.md` §3.5](./01-config-schema.md#35--curated-prop-map-shadcn-propsjson)) before a draw even runs. In Mode B every row below §14.0 is N/A — the synthetic CONFIG has no extractor output to audit.

## 14. Audit checklist before reporting a component "drawn"

### 14.0 — Mode A extraction (skip in Mode B)

- [ ] **MA.1** `CONFIG._source === 'shadcn-1:1'`. If any other value, the component ran in Mode B — skip the remaining §14.0 rows and continue to Page scaffold.
- [ ] **MA.2** `extract-cva.mjs` exited 0 and returned a non-empty `variants` object. Its `exportName` appears in the `SKILL.md` §8 run report.
- [ ] **MA.3** Every cva variant key in `Object.keys(extractOutput.variants[labelKey])` appears in `CONFIG.variants`. No synthetic variant names were injected.
- [ ] **MA.4** `CONFIG.defaultVariant === extractOutput.defaultVariants[labelKey]` and (if a size axis exists) `CONFIG.defaultSize === extractOutput.defaultVariants.size`. The ComponentSet's default instance (`draw-engine.figma.js §6.6D`) matches.
- [ ] **MA.5** For every `(variant, defaultSize)` class string fed to `resolve-classes.mjs`, the resulting `unresolved[]` entries are logged in Step 8 under `unresolvedClasses[{component}]`. Count is reported even when zero.
- [ ] **MA.6** Every `CONFIG.style[variant].fill` / `.labelVar` / `.strokeVar` matches a Figma variable path (prefix `color/`), unless the resolver returned no binding — in which case the synthetic fallback hex is used AND the class is listed in `unresolvedClasses`.
- [ ] **MA.7** `CONFIG.radius` resolves to a `radius/*` path (or the synthetic fallback when `rounded-*` is absent from the base class string).
- [ ] **MA.8** The component has an entry in [`shadcn-props.json`](../shadcn-props.json) and its `pageName`, `componentProps`, `iconSlots`, `properties`, `category`, and optional `composes` values survived merge into CONFIG unchanged; when `composes` is present, `resolver/validate-composes.mjs` was run in Step 4.5.g.

### Page scaffold

- [ ] **S9.1** Navigated to the correct `↳ {Page}` per the routing table in `SKILL.md` — `pageName === CONFIG.pageName` in the return payload
- [ ] **S9.1** Deleted every node other than `_Header` — `docRootChildren >= 2`
- [ ] **V** `_PageContent` exists at (0, 320), 1800 wide, padding 80, fill `#FFFFFF`

### Component set

- [ ] **S9.3** Every variant × size combination has a `ComponentNode` — `compSetVariants.length === CONFIG.variants.length × max(CONFIG.sizes.length, 1)`
- [ ] **V** Each variant's inner label text uses a published `Label/*` text style (Label/XS / Label/SM / Label/MD / Label/LG) driven by `CONFIG.labelStyle` — not raw `fontSize`
- [ ] **S9.2** All variant nodes combined into one `ComponentSet` named `{Title} — ComponentSet`
- [ ] **S9.4** ComponentSet **reparented into the doc frame** as [`04-doc-pipeline-contract.md` §3.2](./04-doc-pipeline-contract.md#32--component-set-section-layout) (Component Set section) — NOT parked at `y: -2000` and NOT left on the page root
- [ ] **V** ComponentSet configured as `HORIZONTAL` + `WRAP` auto-layout, 1640 wide, 32 padding, 24 itemSpacing, 24 counterAxisSpacing, dashed stroke bound to `color/border/subtle`, fill bound to `color/background/variant`, `cornerRadius: 16`
- [ ] **V** State columns mapped correctly: if shadcn has no state prop, the matrix uses instance overrides ([`04-doc-pipeline-contract.md` §13.1](./04-doc-pipeline-contract.md#131--why-state-is-not-a-figma-variant-property)); if shadcn has a `disabled`/`checked`/etc. prop, the matrix uses `setProperties(...)`

### Icon slots ([`01-config-schema.md` §3.3](./01-config-schema.md#33--icon-slots--element-component-properties-designer-ready-polish))

- [ ] **S9.7** If `CONFIG.iconSlots.leading` is true: every variant with a label contains a child named `icon-slot/leading` at **24 × 24** with no fill and a 1 px dashed stroke bound to `color/border/default`, `cornerRadius: 4`
- [ ] **S9.7** If `CONFIG.iconSlots.trailing` is true: same, named `icon-slot/trailing`
- [ ] **S9.8** Every variant whose `CONFIG.label(size, variant)` returns `null` contains exactly **one** child named `icon-slot/center` at 24 × 24 — and no text node
- [ ] **V** Icon-only variants have **square** padding (`paddingTop == paddingLeft`) so they render as squares — matches shadcn `h-10 w-10`
- [ ] **S9.7** Slot layer order is `icon-slot/leading → text → icon-slot/trailing` (reading order)

### Element component properties ([`01-config-schema.md` §3.3.2](./01-config-schema.md#332--the-three-element-component-properties))

- [ ] **S9.5** If `CONFIG.componentProps.label` is true: the `ComponentSet` has a `TEXT` property named exactly `"Label"` with default = first non-null `CONFIG.label(...)` value
- [ ] **S9.5** Every variant's text node has `componentPropertyReferences.characters` pointing to that property ID
- [ ] **S9.6** If `CONFIG.componentProps.leadingIcon` is true: `ComponentSet` has a `BOOLEAN` property `"Leading icon"` (default `true`) referenced by every `icon-slot/leading`'s `visible` field
- [ ] **S9.6** If `CONFIG.componentProps.trailingIcon` is true: same for `"Trailing icon"` (default `false`) and `icon-slot/trailing`
- [ ] **S9.9** `propErrorsCount === 0`. If `addComponentProperty` threw (soft failure) and `propErrorsCount > 0`, the run surfaces `propErrorsSample` and stops — do not report the component "drawn"

### Doc frame — header

- [ ] **V** `doc/component/{name}` root frame exists inside `_PageContent` with 5 children (header, properties, component-set-group, matrix, usage)
- [ ] **V** Title (`Doc/Section`), summary (`Doc/Caption`), source link rendered

### Doc frame — properties table

- [ ] **V** 5 columns (PROPERTY · TYPE · DEFAULT · REQUIRED · DESCRIPTION) summing to 1640
- [ ] **V** Property row order: variant props → state props → content props → a11y props → escape hatches
- [ ] **V** Every cell's text uses `Doc/Code` or `Doc/Caption`; `textAutoResize = 'HEIGHT'`
- [ ] **V** Properties table subtree has **no** stacked doc elevation: **`effects` empty** and **no `effectStyleId`** on the table root, `body`, and row frames (unless the `SKILL.md` §6 template was intentionally updated — default is shadowless; [`04-doc-pipeline-contract.md` §2.1](./04-doc-pipeline-contract.md#21--same-failure-modes-as-the-style-guide-what-sonnet--cursor-must-not-fix))

### Doc frame — component set section ([`04-doc-pipeline-contract.md` §3.2](./04-doc-pipeline-contract.md#32--component-set-section-layout))

- [ ] **S9.4** Section frame named `doc/component/{name}/component-set-group`, VERTICAL auto-layout, 1640 wide
- [ ] **V** Section title "Component" (`Doc/Section`) + caption explaining "Live ComponentSet — edit here, matrix updates"
- [ ] **S9.4** The `ComponentSetNode` itself is a direct child of this section (third child of `docRoot`)

### Doc frame — matrix

- [ ] **V** Matrix is 1640 wide, dashed outline `color/border/subtle`, `cornerRadius: 16`
- [ ] **V** Two-tier header: group row (DEFAULT | DISABLED) + state-label row
- [ ] **V** Gutter width = 220 (size 60 + variant 160) when size axis present; 160 when absent
- [ ] **V** State cells equal-width and sum to 1420 (or 1480 when no size axis)
- [ ] **V** Size groups stacked vertically in shadcn declaration order
- [ ] **V** Row labels are **outside** cells, fixed 160 wide, `Doc/Caption`
- [ ] **V** Every cell contains exactly **one** instance, created via `figma.createInstance(componentNode)`
- [ ] **V** Instance properties set to match the cell coordinates
- [ ] **V** Bottom stroke removed from the last row of the last size group

### Doc frame — usage notes

- [ ] **V** 2-column Do / Don't grid, each 805 wide, padding 28, fill `color/background/variant`
- [ ] **V** Minimum 3 bullets per column

### Text & bindings

- [ ] **V** Every text node uses a `Doc/*` style (never raw `fontName`/`fontSize`)
- [ ] **V** Every chrome fill/stroke bound to a Theme/Primitives variable
- [ ] **V** No hard-coded hex on chrome
- [ ] **V** Instance overrides (hover/pressed/disabled) use opacity for button-like components ([`04-doc-pipeline-contract.md` §13.1.a](./04-doc-pipeline-contract.md#131a--opacity-is-authoritative-for-button-like-components)) or `setProperties(...)` for components where state IS a Figma variant ([`04-doc-pipeline-contract.md` §13.1.b](./04-doc-pipeline-contract.md#131b--exception-state-is-a-figma-variant-property)) — never math-generated fill shades

If any `S9.*` / `MA.*` row fails, fix before reporting the component `drawn`. `V` rows require a `get_screenshot` review and should be corrected where possible; do not block the run on them unless the designer reports a regression.

---

## 15. Where the authoritative rules live

| Topic | File |
|---|---|
| Full orchestration (install + draw) | [`SKILL.md`](../SKILL.md) |
| Matrix layout spec | [`04-doc-pipeline-contract.md §5`](./04-doc-pipeline-contract.md#5-variant--state-specimen-matrix) |
| Properties table spec | [`04-doc-pipeline-contract.md §4`](./04-doc-pipeline-contract.md#4-properties--types-table-every-component) |
| State axis per component category | [`04-doc-pipeline-contract.md §7`](./04-doc-pipeline-contract.md#7-per-category-state-axes-what-columns-the-matrix-draws) |
| Variant rows per component | [`04-doc-pipeline-contract.md §8`](./04-doc-pipeline-contract.md#8-per-component-variant-rows-what-rows-the-matrix-draws) + shadcn source at `components/ui/{component}.tsx` |
| Auto-layout rules (10px-collapse prevention) | [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) + [`create-design-system/conventions/08-hierarchy-and-09-autolayout.md` §9](../../create-design-system/conventions/08-hierarchy-and-09-autolayout.md) |
| Token binding map (chrome → variable) | [`04-doc-pipeline-contract.md §11`](./04-doc-pipeline-contract.md#11-token-bindings-for-matrix-chrome) + [`create-design-system/conventions/11-cells-12-bindings-13-build-order.md` §12](../../create-design-system/conventions/11-cells-12-bindings-13-build-order.md) |
| `Doc/*` text style definitions | [`create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` §7](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) |
| Canvas geometry (1800 / 1640 / 80 padding) | [`create-design-system/conventions/03-through-07-geometry-and-doc-styles.md` §3](../../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) |
| Page routing (component → page) | [`SKILL.md`](../SKILL.md) Step 6 routing table (regenerated by `scripts/build-create-component-docs.mjs`) |

When you are unsure, **`Read` the relevant file** rather than guessing. Every file referenced above is designed to be read in full by the agent before executing its step.
