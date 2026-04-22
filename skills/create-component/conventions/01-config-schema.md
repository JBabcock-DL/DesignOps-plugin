# create-component / conventions / 01-config-schema.md

> Scope: the **per-component `CONFIG`** object that lives at the top of every `use_figma` draw. This is the only block the agent edits per component. Everything below `CONFIG` is the generic draw engine (inlined from [`templates/draw-engine.figma.js`](../templates/draw-engine.figma.js) and, for non-chip layouts, [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js)).
>
> **Related**: [`00-overview.md`](./00-overview.md) (router, glossary, modes). [`02-archetype-routing.md`](./02-archetype-routing.md) (picking `CONFIG.layout`). [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) (valid enum values). [`05-code-connect.md`](./05-code-connect.md) (Mode A class-to-token resolution that populates `CONFIG.style`).

## 3. Component `CONFIG` schema (the ONLY thing you edit per component)

The `/create-component` script in `SKILL.md` is split into two halves: a per-component **`CONFIG`** object at the very top of the `use_figma` code block (§0), and a **generic draw engine** inlined from [`templates/draw-engine.figma.js`](../templates/draw-engine.figma.js) that reads every field from `CONFIG`. The engine is identical for every component. If you find yourself editing anything below `CONFIG`, you are forking the standard — stop and add the missing knob to this schema instead.

### Required fields

| Field | Type | Example | Purpose |
|---|---|---|---|
| `component` | `string` (kebab-case) | `'button'` | Matches shadcn filename; used in Figma node names (`doc/component/{component}/…`) and Code Connect. |
| `title` | `string` | `'Button'` | Display title in the header and ComponentSet name. |
| `pageName` | `string` | `'↳ Buttons'` | Target Figma page (must match the `/new-project` routing table). |
| `summary` | `string` | `'Trigger an action or navigate. …'` | Single sentence under the title. |
| `variants` | `string[]` | `['default','outline',…]` | Row axis of the matrix and first axis of the ComponentSet. `['default']` → single row. |
| `sizes` | `string[]` | `['sm','default','lg','icon']` | Second axis of the ComponentSet, stacked vertically in the matrix. **`[]` disables the size axis** (matrix drops the 60px size column, ComponentSet variant names become `variant=X` only). |
| `style` | `Record<variant, { fill, fallback, labelVar, strokeVar }>` | see below | Per-variant paint bindings — every entry in `variants` must have a matching `style` entry. |
| `padH` | `{ default: token, [size]: token }` | `{ default: 'space/md', sm: 'space/xs' }` | Horizontal padding per size. `default` key is the fallback. |
| `radius` | `string` (Layout token) | `'radius/md'` | Corner radius applied to all variants. |
| `label` | `string \| ((size, variant) => string \| null)` | `(s) => s === 'icon' ? null : 'Button'` | Inner text per cell. Return `null` (or `''`) to skip the text node — when `iconSlots` is also enabled, this triggers **icon-only mode**: the directional slots are replaced by a single `icon-slot/center` and padding is squared off (shadcn `size=icon` pattern). See §3.3.1. |
| `labelStyle` | `{ default: styleName, [size]: styleName }` _optional_ | `{ default: 'Label/MD', sm: 'Label/SM', lg: 'Label/LG', icon: 'Label/MD' }` | Published text style applied to the inner label per size (keys must match entries in `sizes`; `default` is the fallback). Names must resolve via `figma.getLocalTextStylesAsync()` — typically `Label/XS · Label/SM · Label/MD · Label/LG` from the `/create-design-system` Typography collection. If the style doesn't exist, `buildVariant` falls back to raw `fontSize: 14` + bound font-family variable. Omit the field entirely to always use the raw fallback (discouraged for production components). |
| `iconSlots` | `{ leading: boolean, trailing: boolean, size?: number }` _optional_ | `{ leading: true, trailing: true, size: 24 }` | Render **24×24 placeholder frames** around the label so designers can drop SVG content without detaching. Slots are named `icon-slot/leading` and `icon-slot/trailing`; when `label()` returns `null` for a given size, both flags are ignored and a single `icon-slot/center` is drawn instead (shadcn `size=icon` pattern). `size` defaults to **24**; do not deviate without a matching token update. Omit the field to skip icon slots entirely. **See §3.3.1 for the authoritative paint / stroke / cornerRadius / layoutMode spec — do not duplicate those values here.** |
| `componentProps` | `{ label: boolean, leadingIcon: boolean, trailingIcon: boolean }` _optional_ | `{ label: true, leadingIcon: true, trailingIcon: true }` | Figma element component properties added to the `ComponentSet` so designers edit instances **without detaching**. `label` → **TEXT** property `"Label"` bound to every variant's inner text characters; `leadingIcon` / `trailingIcon` → **BOOLEAN** properties `"Leading icon"` / `"Trailing icon"` bound to the matching `icon-slot/*` frame's `visible` field. BOOLEAN flags are ignored if the matching `iconSlots.<side>` is false. If `addComponentProperty` throws (older plugin contexts), the draw continues and designers fall back to detaching — see § 3.3. |
| `states` | `{ key, group }[]` | `[{key:'default',group:'default'},…]` | Matrix columns. `group: 'default'` = interactive cluster (left); `group: 'disabled'` = disabled cluster (right). If **no** state has group `'disabled'`, the two-tier header collapses to a single row. |
| `applyStateOverride` | `(instance, stateKey, ctx) => void` | opacity overlay / `setProperties` call | Applied to each matrix cell's instance. For opacity-based states (button-like), mutate `instance.opacity`. For components where state IS a Figma variant prop (checkbox, switch), call `instance.setProperties({...})` here instead. `ctx = { variant, size, componentNode }`. |
| `properties` | `[name, type, default, required, description][]` | 5-tuple rows | Properties+Types table body. Columns are fixed at `PROPERTY / TYPE / DEFAULT / REQUIRED / DESCRIPTION`. |
| `usageDo` | `string[]` | ≥3 bullets | Left "Do" card. |
| `usageDont` | `string[]` | ≥3 bullets | Right "Don't" card. |
| `composes` | `{ component, slot, cardinality, count?, defaultProps? }[]` _optional_ | see plan + `shadcn-props.schema.json` | When non-empty, the draw engine uses **instance stacks** per [`02-archetype-routing.md` §3.05](./02-archetype-routing.md#305--composition-via-composes-atomic-composites) instead of icon-slot + label children. |
| `layout` | `'chip' \| 'surface-stack' \| 'field' \| 'row-item' \| 'tiny' \| 'container' \| 'control'` _optional_ | `'surface-stack'` | Archetype that selects the draw-engine builder. Defaults to `'chip'`. See [`02-archetype-routing.md` §3.1.1](./02-archetype-routing.md#311--archetype-routing-table) for the routing table. |
| `docsUrl` | `string` _optional_ | `'https://ui.shadcn.com/docs/components/card'` | Canonical shadcn/ui docs URL. Both `/create-component` Mode A extraction and Mode B synthesis reference this for 1:1 structural matching. |
| `surface` | `object` _optional, required when `layout === 'surface-stack'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Header/content/footer composition for Card, Alert, Dialog, Sheet, Drawer, Popover, Tooltip, Hover Card, Empty, Sidebar. Fields: `titleText`, `descriptionText`, `titleStyleName`, `descriptionStyleName`, `sectionPadY`, `gap`, `innerGap`, `width`, `actionSlot: { enabled, slotLabel, width, height }`, `contentSlot: { enabled, slotLabel, minHeight }`, `footerSlot: { enabled, slotLabel, align: 'start'\|'end'\|'between', minHeight }`. |
| `field` | `object` _optional, required when `layout === 'field'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Label/chrome/helper composition for Input, Textarea, Select, Combobox, Date Picker, Input OTP, Input Group, Label, Native Select, Form. Fields: `fieldType: 'input'\|'textarea'\|'select'\|'otp'`, `showLabel`, `labelText`, `labelStyleName`, `placeholderText`, `showHelper`, `helperText`, `leadingIcon`, `trailingIcon`, `width`, `textareaMinHeight`, `otpLength`. |
| `row` | `object` _optional, required when `layout === 'row-item'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Leading/title+desc/trailing composition for Dropdown Menu, Menubar, Navigation Menu, Item, Command, Breadcrumb, Sidebar row, Context Menu. Fields: `titleText`, `descriptionText`, `leadingIcon`, `trailingIcon`, `trailingIsChevron`, `shortcut`, `shortcutText`, `titleStyleName`, `descriptionStyleName`, `width`. |
| `tiny` | `object` _optional, required when `layout === 'tiny'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Pure-shape spec for Separator, Skeleton, Spinner, Progress, Avatar, Aspect Ratio, Scroll Area. Fields: `shape: 'separator'\|'skeleton'\|'spinner'\|'progress'\|'avatar'\|'aspect-ratio'\|'scroll-area'`, plus per-shape extras (`width`, `height`, `orientation`, `size`, `initials`, `filled`). |
| `control` | `object` _optional, required when `layout === 'control'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Small primitive spec for Checkbox, Radio Group, Switch. Fields: `shape: 'checkbox'\|'radio'\|'switch'`, `size`, `indicatorVar`, plus switch extras (`width`, `height`, `trackOnVar`, `trackOffVar`, `thumbVar`). **Control variants encode `checked`/`pressed` in the variant name** so the builder renders the filled glyph. |
| `container` | `object` _optional, required when `layout === 'container'`_ | see [`02-archetype-routing.md`](./02-archetype-routing.md) | Header + expandable panel spec for Accordion, Collapsible, Tabs, Resizable, Carousel. Fields: `kind: 'accordion'\|'tabs'`, `width`, `titleText`, `panelText`, `tabs: string[]`, `activeIndex`, `panelMinHeight`. |

### String-field authoring rules (applies to `summary`, `properties[4]`, `usageDo`, `usageDont`, all `*Text` fields)

String fields are the #1 source of `use_figma` `SyntaxError` failures — and when they fail, the agent typically misdiagnoses the root cause and spirals. These rules eliminate the class.

**Rule 1 — Never hand-retype a string field from [`shadcn-props/<component>.json`](../shadcn-props/).** `Read` the JSON file and either (a) inline the entry as a JS object literal at the top of CONFIG (JSON is a strict subset of JS — every field is already correctly escaped), or (b) for per-field copies, paste the quoted JSON value *verbatim*, including the double-quote delimiters. Retyping prose is how apostrophes (`doesn't`, `you're`) and internal quotes collide with single-quote delimiters and produce `SyntaxError: expecting ')'`.

**Rule 2 — Prefer double-quoted or template-literal delimiters for prose.** Most authored English contains apostrophes; few contain backticks; almost none contain both. A good default:

```js
// GOOD — double-quoted, apostrophes are free
summary: "Trigger an action or navigate. Don't overload the label.",

// GOOD — template literal, $ must still be escaped but apostrophes are free
summary: `Native <label> associated with a form control via htmlFor.`,

// BAD — single-quoted prose routinely collides with apostrophes
summary: 'Native <label> that doesn't render anything else',  // ← SyntaxError on `doesn`
```

**Rule 3 — Angle brackets (`<`, `>`) inside JS string literals are valid.** A `summary` field like `"Native <label> associated with a form control via htmlFor."` is **not** a `SyntaxError`. The Figma Plugin API parser is plain JavaScript — there is no JSX context and no HTML parsing around string literals. When you see `SyntaxError: expecting ')'` after drafting a component whose `summary` references an HTML tag, **the angle brackets are a red herring** — the real issue is somewhere else (usually a quote-delimiter collision on an apostrophe). Do **not** escape to `&lt;label&gt;`; do **not** rewrite the prose. Run the preflight instead (Rule 4).

**Rule 4 — Run the local syntax preflight ([`SKILL.md` §0 Step 5.5](../SKILL.md#0)) before every `use_figma` call.** `npm run check-payload -- <staged-payload>` parses the assembled payload exactly the way `use_figma` does (as an async function body) and prints the failing `line:col` in ~1 second. This is the cheapest gate in the pipeline and eliminates the "is it the angle brackets? is it the apostrophe? is it the arrow function?" spiral entirely.

### `style` entry shape

```js
style: {
  default: {
    fill:      'color/primary/default',   // Theme token for the background
    fallback:  '#1a1a1a',                 // hex used when the Theme collection is absent
    labelVar:  'color/primary/content',   // Theme token for the label text fill
    strokeVar: null,                      // Theme token for stroke, or null for no stroke
  },
  // ... one entry per variant ...
}
```

> **Token paths here are Figma variable names — not CSS vars, not Tailwind classes, not guesses.** Every `fill` / `labelVar` / `strokeVar` must appear verbatim in `figma.variables.getLocalVariables()` in the active file. Do **not** infer paths from past agent transcripts, from `tokens.css`, or from another project's CONFIG — re-enumerate live via `get_variable_defs` and validate per-component at `SKILL.md` Step 4.7. Full rules + the `--color-primary` vs `color/primary/default` gotcha: [`07-token-paths.md`](./07-token-paths.md).

### Axis-shape cheatsheet

| Component shape | `variants` | `sizes` | `states` | `applyStateOverride` |
|---|---|---|---|---|
| Button-like (button, toggle) | 2–6 visual variants | 3–4 size presets | `default` · `hover` · `pressed` ⎮ `disabled` | opacity overlay |
| Input-like (input, textarea, select) | `['default']` | `[]` | `default` · `focus` · `error` ⎮ `disabled` | mutate `strokes` + overlay field |
| Checkable (checkbox, radio, switch) | `['default']` | `[]` | `unchecked` · `checked` · `indeterminate` ⎮ `disabled` | `instance.setProperties({ checked, disabled })` |
| Badge / Alert | 4–5 visual variants | `[]` | `[{ key: 'default', group: 'default' }]` | no-op |
| Overlay (dialog, popover) | `['default']` | `[]` | `[{ key: 'open', group: 'default' }]` | no-op |
| Card / Separator / Layout | `['default']` | `[]` | `[{ key: 'default', group: 'default' }]` | no-op |

When adding a component whose shape doesn't fit any row above, **add a new row to this cheatsheet** in the same PR — the matrix rule applies to every component without exception.

### Invariants (enforced by the engine)

- `variants.length ≥ 1` — never an empty variant axis.
- Every entry in `variants` has a matching key in `style`. The engine throws `CONFIG.style missing entry for variant 'X'` if not.
- Every entry in `sizes` has a matching key in `padH` (or the `default` key is used as fallback).
- Every `states` entry's `group` is either `'default'` or `'disabled'`.
- `properties` rows are exactly 5-tuples.
- `usageDo` and `usageDont` each have ≥ 3 bullets.
- If `iconSlots.leading` is `true`, **every** variant with a non-null label has a child named `icon-slot/leading` (24×24). Same rule for `trailing`. The engine throws `Variant 'X' is missing icon-slot/Y` if not.
- A variant with a null label AND any icon-slot setting enabled has exactly one child named `icon-slot/center` — never both a text node and a center slot.

---

## 3.3 — Icon slots & element component properties (designer-ready polish)

Base the component structure on the [shadcn/ui component reference](https://ui.shadcn.com/docs/components). shadcn components accept `children` freely (text + icons) and use utility classes like `[&_svg]:size-4` to normalize icon sizing — we mirror that contract in Figma with **explicit slot frames** and **element component properties**, so designers get the same optionality without writing code.

### 3.3.1 — The 24×24 icon slot rule

Every component that can accept inline iconography has **named, empty 24×24 frames** where icons go. They preserve auto-layout space even when nothing is dropped in, so a button labeled `Save` looks identical whether or not it eventually gets a `<Plus />` icon.

| Rule | Value |
|---|---|
| Slot size | **24 × 24** px (system-wide — never deviate per-component) |
| Slot fill | **none** (`fills: []`) |
| Slot stroke | `color/border/default` (Theme var, fallback `#d4d4d8`), 1 px, `dashPattern: [4, 3]` — visible but clearly a placeholder |
| Slot `cornerRadius` | `4` — distinguishes the slot from the component chrome |
| Slot layoutMode | `NONE` — the frame is a passive placeholder |
| Slot `clipsContent` | `false` — a designer's dropped icon can overhang briefly during editing |
| Layer name | `icon-slot/leading` · `icon-slot/trailing` · `icon-slot/center` |

Layer ordering inside every variant is strict: **`icon-slot/leading` → text node → `icon-slot/trailing`**. When `CONFIG.label(size, variant)` returns `null` / `''`, the variant is "icon-only" — buildVariant drops both directional slots and emits a single centered `icon-slot/center` instead, and forces padding to be square so the component ends up square (this is the shadcn `size=icon` pattern — `h-10 w-10` for a 40×40 button around a 24×24 slot).

Slots render as **dashed 24 × 24 outlines on canvas** so designers see exactly where to drop content, and they're also **discoverable by name** in the layers panel. Once a designer drops a 24 × 24 icon component, vector, or SVG child inside, the dashed stroke sits behind the child and becomes invisible in the final render. To hide a slot without editing it, designers flip the matching boolean component property (next section) — this sets the frame's `visible = false`, which hides both the stroke and any child content.

### 3.3.2 — The three element component properties

Inside `buildVariant` — **before** `combineAsVariants` is ever called — the script adds three properties to **each individual variant component** using `comp.addComponentProperty(name, type, default)`, then references them from the variant's inner nodes via `node.componentPropertyReferences`. After `combineAsVariants`, the ComponentSet automatically **unifies identically-named properties across variants** into a single set-level property — so designers see one `Label` / one `Leading icon` / one `Trailing icon` in Figma's right-hand Properties panel regardless of which `variant=…, size=…` combination their instance lands on.

| Property | Type | Default | Bound to | Purpose |
|---|---|---|---|---|
| `Label` | `TEXT` | first non-null `CONFIG.label(size, variant)` | every variant's text node's `characters` | Designers change the button text without detaching the instance. |
| `Leading icon` | `BOOLEAN` | `true` | every variant's `icon-slot/leading` `.visible` | Toggle the leading slot on/off without detaching. |
| `Trailing icon` | `BOOLEAN` | `false` | every variant's `icon-slot/trailing` `.visible` | Toggle the trailing slot on/off without detaching. |

Default BOOLEAN values are asymmetric (`Leading icon: true`, `Trailing icon: false`) on purpose: most shadcn buttons in the wild have a leading icon (e.g. `<Plus /> Add item`) and a bare tail. Individual designs can override per instance.

Binding a **single property** across all 24 (or N) variants — rather than one property per variant — is the whole point. It gives the instance a unified `Label` / `Leading icon` / `Trailing icon` control set in the Properties panel regardless of which `variant=…, size=…` combination is selected.

### 3.3.3 — Fallback when `addComponentProperty` throws

Older Figma plugin contexts or non-standard file permissions can reject `addComponentProperty` calls. The script wraps the whole block in a `try / catch` and logs `addComponentProperty failed — ComponentSet still usable, designers will need to detach to edit text`. The draw continues; the audit checklist's component-property items become **soft warnings** in that case, not hard failures. Icon slots still work (they're plain frames), and the ComponentSet itself is still valid — the only regression is designers have to detach an instance to edit the text, which is the pre-property-API baseline.

If you see that warning consistently across a run, check:
1. The ComponentSet has at least one variant with a bindable text child.
2. Figma plugin host is recent enough (the property API shipped in 2023).
3. The file isn't read-only (branch permissions).

### 3.3.4 — Which components get slots + props

Follow the shadcn docs. Default assumption for every component CONFIG going forward:

| Category | Components | Default `iconSlots` | Default `componentProps` |
|---|---|---|---|
| Button-like | `button`, `toggle`, `toggle-group` | `leading: true, trailing: true, size: 24` | `label: true, leadingIcon: true, trailingIcon: true` |
| Input-like | `input`, `textarea`, `select` | `leading: true, trailing: true, size: 24` | `label: false` (input uses placeholder not child text), `leadingIcon: true, trailingIcon: true` |
| Badge / Alert | `badge`, `alert` | `leading: true, trailing: false, size: 24` | `label: true, leadingIcon: true, trailingIcon: false` |
| Tabs / menu items | `tabs`, `menubar`, `navigation-menu`, `dropdown-menu`, `context-menu`, `command` | `leading: true, trailing: true, size: 24` | `label: true, leadingIcon: true, trailingIcon: true` |
| Checkable | `checkbox`, `radio-group`, `switch` | **omit** — the check/dot IS the glyph | `label: true` (if the component emits an adjacent label), `leadingIcon: false, trailingIcon: false` |
| Structure / Layout | `card`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `skeleton`, `avatar` | **omit** | **omit** — no text property makes sense at the shell level |
| Overlays | `dialog`, `drawer`, `sheet`, `popover`, `tooltip`, `hover-card`, `alert-dialog` | **omit** — overlays wrap arbitrary content | **omit** |

When unsure, visit the [shadcn docs](https://ui.shadcn.com/docs/components) for that component and look at the example source: if `children` is text + an inline `<svg>`, the Figma counterpart gets slots + props.

---

## 3.5 — Curated prop map (`shadcn-props.json`)

> Authoritative: [`skills/create-component/shadcn-props.json`](../shadcn-props.json). One entry per **kebab-case** component name from the [shadcn/ui Components index](https://ui.shadcn.com/docs/components) (CLI `npx shadcn add <name>`). Each key must have a matching row in the `SKILL.md` Step 6 routing table (regenerated by `scripts/build-create-component-docs.mjs`).

### 3.5.1 — Why this file exists

shadcn's TypeScript prop surface is stable and small (most components are Radix primitives passed through `<Comp className={cn(variants(props), className)} {...rest}/>`), but running a TS AST parser at session time is expensive and fragile. Hand-maintaining one curated JSON entry per component is cheaper and more honest — a skill update is the right ceremony for a new shadcn release. The JSON feeds **both** Mode A (as the `pageName` / `componentProps` / `iconSlots` / `properties` seed) **and** Mode B (as the synthetic-template body when shadcn isn't installed).

### 3.5.2 — Entry schema

Each key `{componentName}` maps to an object with these fields:

| Field | Type | Purpose |
|---|---|---|
| `pageName` | string | Target Figma page (must match the SKILL.md §6 routing table entry exactly, including the `↳` prefix). |
| `labelKey` | string | Which cva axis becomes the Figma `variant` property (e.g. `'variant'`, `'size'`, `'orientation'`). The other axis — if present — becomes `size`. |
| `category` | enum | Display group consumed by `scripts/build-create-component-docs.mjs` when regenerating `SKILL.md`'s Supported Components block. See the script's `CATEGORY_ORDER` + `CATEGORY_MAP`. |
| `summary` | string | One-sentence doc-header line for [`04-doc-pipeline-contract.md` §3.2](./04-doc-pipeline-contract.md#32--component-set-section-layout) of the component page. |
| `iconSlots` | `{ leading: boolean, trailing: boolean, size: number }` | Drives §3.3.1 icon slot generation. `size` is fixed at 24 across the system — do not vary per-component. |
| `componentProps` | `{ label: boolean, leadingIcon: boolean, trailingIcon: boolean }` | Drives §3.3.2 element component property creation. Booleans require the matching `iconSlots.*` flag above. |
| `properties` | `[name, type, default, required, description][]` | Rows for the Properties + Types table ([`04-doc-pipeline-contract.md` §4](./04-doc-pipeline-contract.md#4-properties--types-table-every-component)). Columns are positional: 5 strings per row. |

### 3.5.3 — What this file does NOT contain

- **Variants / sizes / classnames.** Those come from the cva config in Mode A, or from the synthetic template in Mode B.
- **Per-variant colors.** Those are resolved from classnames against `tokens.css` in Mode A, or set in the synthetic template for Mode B.
- **States / state overrides.** Those come from the SKILL.md §6 Mode B template default and [`04-doc-pipeline-contract.md` §13.1](./04-doc-pipeline-contract.md#131--why-state-is-not-a-figma-variant-property); Mode A inherits the same defaults unchanged.
- **Usage notes.** Mode B ships canonical Do/Don't bullets for a small set of reference components; Mode A should reuse them verbatim. If a component lacks curated usage notes, emit a single Do bullet that cites the shadcn docs URL and leave the Don't list empty.

### 3.5.4 — Extending the map

When a new shadcn component ships (or the routing table grows):

1. Add one entry keyed by the shadcn CLI name (`npx shadcn add <name>`).
2. Pick `labelKey` from the cva axes — default to `'variant'` if unsure. Shadcn components that keep all their variance in `size` (e.g. `separator` uses `orientation`) should set `labelKey` to that axis name.
3. Copy the `properties[]` rows from the shadcn docs prop table; keep wording concise. 5 columns, positional.
4. Decide `iconSlots` + `componentProps` from the §3.3.4 category table.
5. Set `category` so `scripts/build-create-component-docs.mjs` can group the component in SKILL.md's Supported Components list.
6. Run `node scripts/build-create-component-docs.mjs` to regenerate the generated blocks in `SKILL.md`.
