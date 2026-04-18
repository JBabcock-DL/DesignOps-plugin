# Component Canvas Conventions — Quick Reference

> **Audience:** AI agents (Claude, Sonnet, etc.) running `/create-component`. Read this **before** you draw any component so every page in the file looks like one system instead of a pile of loose instances on an empty frame.
>
> **Authoritative source:** [`skills/create-component/SKILL.md`](./SKILL.md). When this summary disagrees with the skill, the skill wins.
>
> **Related:** [`skills/create-design-system/CONVENTIONS.md`](../create-design-system/CONVENTIONS.md) — the style-guide canvas geometry this file reuses.

---

## 1. The rule: every component is drawn as a **matrix**

Old behavior (deprecated): variants pushed into a single wrapping horizontal `combineAsVariants` set with no labels, no documentation, no grouping. And earlier versions of this skill parked the `ComponentSet` off-canvas at `y: -2000` — designers couldn't find it to edit.

New behavior (mandatory for every component, even single-state ones): a **documentation frame** with five stacked sections, including the live `ComponentSet` in-line so designers can edit it in place.

```
doc/component/{name}
├── doc/component/{name}/header               — title + 1-line summary + source link
├── doc/component/{name}/properties           — Properties + Types table (§4)
├── doc/component/{name}/component-set-group  — Live ComponentSet section (§3.2)
├── doc/component/{name}/matrix               — Variant × State specimen matrix (§5)
└── doc/component/{name}/usage                — Usage notes (§6) — Do / Don't bullets
```

A matrix is still drawn when the component has no state axis (the matrix collapses to a single column) and when it has no variant axis (a single row). This keeps every component page visually consistent — a designer skimming the file always finds the title, the properties, the live ComponentSet, then the specimen grid, then the usage notes in the same order.

---

## 2. Page layout — reuse the style-guide geometry

Component pages live inside the same 1800px canvas as the style-guide pages (`↳ Buttons`, `↳ Cards`, `↳ Dialogue`, etc.). Every page already has a scaffolded `_Header` + `_PageContent` from `/new-project` step 5b. You are **drawing into `_PageContent`**, not creating new page chrome.

| Layer                  | Width       | Notes                                                                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Page canvas            | **1800px**  | Already scaffolded; do not resize.                                                                     |
| `_Header` instance     | **1800px**  | `layoutMode: VERTICAL`, FIXED height 320, `cornerRadius: 0`.                                           |
| `_PageContent`         | **1800px**  | `x: 0, y: 320`, padding **80 all sides**, `itemSpacing: 48`, fill `#FFFFFF` literal.                    |
| Inner content          | **1640px**  | Every `doc/component/*` root frame renders at 1640 wide.                                               |
| Properties table       | **1640px**  | Same chrome as style-guide tables (§4).                                                                 |
| Matrix root            | **1640px**  | Fixed width; columns divide the space after the row-label gutter (§5).                                 |

**One component per page.** Do **not** stack two components in one `_PageContent`. `↳ Buttons` holds one Button doc frame; `↳ Cards` holds one Card doc frame; overlay pages (`↳ Dialogue`, `↳ Drawer`, `↳ Popover`, `↳ Tooltips`) hold one frame for that specific overlay.

**Delete before drawing.** When redrawing, delete every node on the page **other than `_Header`** (same rule as Step 15a in `/create-design-system`). Do not leave stale specimens under the new matrix.

---

## 3. The `ComponentSet` lives **inside** the doc frame as its own section

Figma's native variant picker (the Properties panel on an instance) reads from a **`ComponentSetNode`**. Code Connect mapping also resolves off the component set. But designers need to be able to **see and edit the variants** without hunting for them off-canvas — so the ComponentSet lives inside the documentation frame as a dedicated section, not parked at `y: -2000` and not embedded inside the matrix.

The flow:

1. Build each variant `ComponentNode` via `buildVariant(...)` (same helper as today).
2. Call `figma.combineAsVariants(nodes, figma.currentPage)` → returns a `ComponentSetNode`. Name it `{ComponentTitle} — ComponentSet`.
3. **Reparent** the ComponentSet into the doc frame's **Component Set section** (see §3.2 below) using `section.appendChild(compSet)`. This preserves the node identity — Figma's Assets panel and Code Connect still resolve it as the canonical source — while placing it visually where designers expect to find it.
4. For each matrix cell, call `figma.createInstance(component)` and set the instance's `setProperties({...})` to match the cell's (variant, size, state) coordinates. Append the **instance** to the matrix cell frame.

**Never embed the raw ComponentSet inside the matrix itself.** The matrix is built from instances so that a single edit to the ComponentSet propagates to every cell automatically.

## 3.2 — Component Set section layout

The Component Set section is the third child of `docRoot`, sitting between the Properties table and the Matrix. Structure:

```
doc/component/{name}/component-set-group       VERTICAL auto-layout, width 1640
├── title              "Component"              Doc/Section, 24
├── caption            "Live ComponentSet — edit here, matrix updates."  Doc/Caption, 13
└── [ComponentSetNode] — reparented from the page, configured as a grid
```

The `ComponentSetNode` itself is auto-layout-configured as a **horizontal WRAP grid** so every variant is visible at a glance and the group re-flows as variants are added or removed:

| Property | Value | Reason |
|---|---|---|
| `layoutMode` | `HORIZONTAL` | variants laid out left-to-right before wrap |
| `layoutWrap` | `WRAP` | wraps to a new row when the width is exhausted |
| `resize(1640, 1)` → then `primaryAxisSizingMode = FIXED`, `counterAxisSizingMode = AUTO` | — | fixed width triggers wrap; height grows with rows. **Order matters** (see CONVENTIONS §10.1) |
| `padding*` | 32 all sides | breathing room around the variants |
| `itemSpacing` | 24 | gap between variants in a row |
| `counterAxisSpacing` | 24 | gap between wrapped rows |
| `fills` | bound to `color/background/variant` (fallback `#fafafa`) | subtle specimen background |
| `strokes` | bound to `color/border/subtle` (fallback `#e5e7eb`) | frame outline |
| `strokeWeight` | 1 | — |
| `dashPattern` | `[6, 4]` | dashed frame to signal "editable source" vs the solid matrix |
| `cornerRadius` | 16 | matches every other doc container |

**Do not** set `x`/`y` on the ComponentSet after reparenting — the parent's auto-layout owns position. **Do not** duplicate or clone the ComponentSet. There is exactly one per component per page.

---

## 3.1 — Component `CONFIG` schema (the ONLY thing you edit per component)

The `/create-component` script in `SKILL.md` is split into two halves: a per-component **`CONFIG`** object at the very top of the `use_figma` code block (§0), and a **generic draw engine** (§1–§6) that reads every field from `CONFIG`. The engine is identical for every component. If you find yourself editing anything below `CONFIG`, you are forking the standard — stop and add the missing knob to this schema instead.

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
| `label` | `string \| ((size, variant) => string)` | `(s) => s === 'icon' ? '⬡' : 'Button'` | Inner text per cell. Return `''` or `null` to skip the text node. |
| `labelStyle` | `{ default: styleName, [size]: styleName }` _optional_ | `{ default: 'Label/MD', sm: 'Label/SM', lg: 'Label/LG', icon: 'Label/MD' }` | Published text style applied to the inner label per size (keys must match entries in `sizes`; `default` is the fallback). Names must resolve via `figma.getLocalTextStylesAsync()` — typically `Label/XS · Label/SM · Label/MD · Label/LG` from the `/create-design-system` Typography collection. If the style doesn't exist, `buildVariant` falls back to raw `fontSize: 14` + bound font-family variable. Omit the field entirely to always use the raw fallback (discouraged for production components). |
| `iconSlots` | `{ leading: boolean, trailing: boolean, size?: number }` _optional_ | `{ leading: true, trailing: true, size: 24 }` | Render empty **24×24 placeholder frames** around the label so designers can drop SVG content without detaching. Slots are named `icon-slot/leading` and `icon-slot/trailing` and have no fill / no stroke (space-preserving). When `label()` returns `null` for a given size, both flags are ignored and a single `icon-slot/center` is drawn instead — this is the shadcn `size=icon` pattern. `size` defaults to **24** (the system token); do not deviate without a matching token update. Omit the whole field to skip icon slots entirely. See § 3.3. |
| `componentProps` | `{ label: boolean, leadingIcon: boolean, trailingIcon: boolean }` _optional_ | `{ label: true, leadingIcon: true, trailingIcon: true }` | Figma element component properties added to the `ComponentSet` so designers edit instances **without detaching**. `label` → **TEXT** property `"Label"` bound to every variant's inner text characters; `leadingIcon` / `trailingIcon` → **BOOLEAN** properties `"Leading icon"` / `"Trailing icon"` bound to the matching `icon-slot/*` frame's `visible` field. BOOLEAN flags are ignored if the matching `iconSlots.<side>` is false. If `addComponentProperty` throws (older plugin contexts), the draw continues and designers fall back to detaching — see § 3.3. |
| `states` | `{ key, group }[]` | `[{key:'default',group:'default'},…]` | Matrix columns. `group: 'default'` = interactive cluster (left); `group: 'disabled'` = disabled cluster (right). If **no** state has group `'disabled'`, the two-tier header collapses to a single row. |
| `applyStateOverride` | `(instance, stateKey, ctx) => void` | opacity overlay / `setProperties` call | Applied to each matrix cell's instance. For opacity-based states (button-like), mutate `instance.opacity`. For components where state IS a Figma variant prop (checkbox, switch), call `instance.setProperties({...})` here instead. `ctx = { variant, size, componentNode }`. |
| `properties` | `[name, type, default, required, description][]` | 5-tuple rows | Properties+Types table body. Columns are fixed at `PROPERTY / TYPE / DEFAULT / REQUIRED / DESCRIPTION`. |
| `usageDo` | `string[]` | ≥3 bullets | Left "Do" card. |
| `usageDont` | `string[]` | ≥3 bullets | Right "Don't" card. |

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

## 4. Properties & Types table (every component)

Above the matrix, render a Properties table that documents the component's public API. Column widths sum to **1640** (same rule as style-guide tables).

| Col | Header       | Width | Cell pattern |
|-----|--------------|-------|--------------|
| 1   | `PROPERTY`   | 240   | Doc/TokenName — e.g. `variant`, `size`, `disabled`, `asChild` |
| 2   | `TYPE`       | 380   | Doc/Code — TypeScript-style union: `"default" \| "destructive" \| "outline" \| …` or `boolean` |
| 3   | `DEFAULT`    | 160   | Doc/Code — the default value in quotes, or `—` if none |
| 4   | `REQUIRED`   | 120   | Doc/Caption — `yes` / `no` |
| 5   | `DESCRIPTION`| 740   | Doc/Caption — one sentence. Link to shadcn docs with a `See →` suffix when useful. |

**Sum: 240 + 380 + 160 + 120 + 740 = 1640.**

Follow the same hierarchy and auto-layout rules as design-system tables (see [`create-design-system/CONVENTIONS.md` §8–9](../create-design-system/CONVENTIONS.md)): `doc/table-group/{component-name}/properties` wrapper; `doc/table/{component-name}/properties` with header + body rows; `minHeight: 64` per row; `counterAxisAlignItems: CENTER`; `textAutoResize: 'HEIGHT'` on every text node.

Property row ordering (canonical):

1. Core variant props in declaration order (e.g. `variant`, `size`).
2. State props (`disabled`, `checked`, `selected`, `pressed`, `open`).
3. Content props (`children`, `label`, `placeholder`).
4. Accessibility / ARIA props (`aria-label`, `role`) if documented on the shadcn source.
5. Escape-hatch props last (`className`, `asChild`, `...props`).

Pull the property list by reading the shadcn source file in `components/ui/{component}.tsx` — the `VariantProps<typeof …Variants>` union and `cva(...)` call expose every variant name and its allowed values. Never make up properties the source doesn't define.

---

## 5. Variant × State specimen matrix

The heart of every component page. Structure:

```
doc/component/{name}/matrix                          VERTICAL · AUTO · STRETCH · width 1640 · stroke 1 color/border/subtle dashed · cornerRadius 16 · padding 0
├── matrix/header-groups                             HORIZONTAL · FIXED height 44 · width 1640 · bottom 1px stroke color/border/subtle
│   ├── matrix/header-groups/gutter                  FIXED width 220 · (empty spacer — lines up with row labels)
│   ├── matrix/header-groups/cell/default            Doc/Caption uppercase "DEFAULT" · spans N-1 state columns
│   └── matrix/header-groups/cell/disabled           Doc/Caption uppercase "DISABLED" · spans 1 state column
├── matrix/header-states                             HORIZONTAL · FIXED height 40 · bottom 1px stroke color/border/subtle
│   ├── matrix/header-states/gutter                  FIXED width 220
│   └── matrix/header-states/cell/{state}            FIXED width (§5.3) · Doc/Caption "default" / "hover" / "pressed" / "disabled"
└── matrix/size-group/{size}                         HORIZONTAL · AUTO height · STRETCH (one block per size; omit if no size axis)
    ├── matrix/size-group/{size}/label               FIXED width 60 · VERTICAL · centered · Doc/TokenName "Small" + 1px right edge stroke color/border/subtle
    └── matrix/size-group/{size}/rows                VERTICAL · AUTO · STRETCH
        └── matrix/size-group/{size}/row/{variant}   HORIZONTAL · AUTO height · minHeight 72 · bottom 1px stroke color/border/subtle (omit on last row of last size group)
            ├── matrix/.../row/{variant}/label       FIXED width 160 · VERTICAL · center-aligned · Doc/Caption "Primary"
            └── matrix/.../row/{variant}/cell/{state} FIXED width (§5.3) · HORIZONTAL · center + center alignment · paddingH 16 · paddingV 16 · appendChild(instance)
```

### 5.1 — The two-tier header

Top tier = category labels grouped. Default group spans every **interactive** state column (default + hover + pressed + focus + error + any states that are "enabled"); Disabled group spans the disabled column. This mirrors the reference image's "Default | Disabled" split and makes the page scannable at a glance.

If a component has **no disabled state** (overlays, skeleton) the DISABLED group is omitted and the DEFAULT group spans all columns.

### 5.2 — Row labels (variants) are outside the cells

Row labels sit in a **FIXED width 160** column on the left of each size-group. Text style `Doc/Caption`, fill `color/background/content-muted`, centered vertically. This keeps row labels aligned across every size group — a constant left edge.

Size labels sit in a **FIXED width 60** column to the left of the row-label column, with a 1px right edge stroke `color/border/subtle` acting as the bracket. Text `Doc/TokenName`, center-aligned, vertically centered in the group. If a component has **no size axis**, omit this column (total gutter = 160, total state-cell width = 1480).

### 5.3 — Column (state) widths

Left gutter = size-label (60) + variant-label (160) = **220**. State-cell region = 1640 − 220 = **1420**, split evenly across state count:

| States visible | State cell width |
|---------------:|-----------------:|
| 6              | ~236             |
| 5              | 284              |
| 4              | 355              |
| 3              | ~473             |
| 2              | 710              |
| 1              | 1420             |

If there is no size axis, gutter drops to 160 and state-cell region is 1480 — split the same way.

### 5.4 — Cells contain **one instance, centered**

Each state cell is a HORIZONTAL frame with `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: CENTER`, `paddingH: 16`, `paddingV: 16`. Child: one `InstanceNode` created from the component set, with `setProperties({ variant, size, state })` applied to the instance.

The instance is **not resized** — it hugs its own auto-layout. Buttons stay button-sized, inputs stay input-sized. The cell is large enough to contain any instance at its natural width without clipping.

If an instance would overflow its cell (e.g. a wide date-picker), increase the matrix outer width to a multiple of 1640 (2280 / 2600 / 3280) only for that component and log a note in its usage section. Do **not** shrink the instance.

### 5.5 — Dashed outline (optional but recommended)

The matrix root frame uses a 1px dashed stroke `color/border/subtle` with `dashPattern: [6, 4]` and `cornerRadius: 16`. This visually separates the specimen gallery from the properties table and usage notes above/below it. On components where a dashed stroke feels too designery (e.g. `card`, `separator`), swap to a solid 1px stroke.

---

## 6. Usage notes section

Below the matrix, render a 2-column Do / Don't grid documenting the most common usage questions. Each column is a VERTICAL stack, width 805 (1640 / 2 − 15 itemSpacing), padding 28, fill `color/background/variant`, cornerRadius 16.

```
doc/component/{name}/usage                           HORIZONTAL · AUTO · STRETCH · itemSpacing 30
├── usage/do                                         VERTICAL · width 805 · padding 28 · fill color/background/variant · cornerRadius 16
│   ├── title   Doc/TokenName "Do"  with a leading "✓ " glyph (or text-only if emoji-averse)
│   └── bullets VERTICAL · itemSpacing 12 · each: TEXT Doc/Caption with leading "· " bullet
└── usage/dont                                       VERTICAL · width 805 · padding 28 · fill color/background/variant · cornerRadius 16
    ├── title   Doc/TokenName "Don't" with leading "✕ "
    └── bullets — same as Do
```

**Minimum content per component:** 3 "Do" bullets + 3 "Don't" bullets, pulled from the component's shadcn documentation page where possible (linked in §4 description column).

If you have no sourced guidance, still render the frames with 3 placeholder bullets each so the page has its shape — designers can edit in-place. Do not skip the section.

---

## 7. Per-category state axes (what columns the matrix draws)

The matrix's column headers come from this table. Agents should not improvise states — pick the row that matches the component's category and stick to it.

| Category                                   | Components | States (left → right, grouped DEFAULT \| DISABLED) |
|--------------------------------------------|------------|------------------------------------------------------|
| **Button-like**                            | `button`, `toggle`, `toggle-group` | `default` · `hover` · `pressed` \| `disabled` |
| **Input-like**                             | `input`, `textarea`, `select`, `combobox` | `default` · `focus` · `error` \| `disabled` |
| **Checkable**                              | `checkbox`, `radio-group`, `switch` | `unchecked` · `checked` · `indeterminate`† \| `disabled` |
| **Date / time**                            | `date-picker`, `calendar`, `input-otp` | `default` · `focus` \| `disabled` |
| **Slider / range**                         | `slider` | `default` · `hover` · `dragging` \| `disabled` |
| **Tabs / segmented**                       | `tabs`, `navigation-menu`, `menubar` | `inactive` · `hover` · `active` \| `disabled` |
| **Link / nav**                             | `breadcrumb`, `pagination` | `default` · `hover` · `active` \| `disabled` |
| **Overlay (anchored)**                     | `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `command` | `open` (single column; no DISABLED group) |
| **Overlay (modal)**                        | `dialog`, `alert-dialog`, `drawer`, `sheet` | `open` (single column) |
| **Display / status**                       | `alert`, `badge`, `progress`, `skeleton`, `avatar`, `sonner`, `toast` | `default` (single column; variants render as rows) |
| **Structure**                              | `card`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `accordion`, `collapsible`, `table`, `form`, `label` | `default` (single column) |

† `indeterminate` applies to checkbox only; omit the column for radio and switch.

---

## 8. Per-component variant rows (what rows the matrix draws)

Rows come from the component's `variant` or equivalent property, read straight from the shadcn source file. When a component has no variant property, the matrix draws **one row** labeled with the component name.

**Reference — shadcn defaults at time of writing:**

| Component     | Rows (top → bottom)                                                | Source |
|---------------|---------------------------------------------------------------------|--------|
| `button`      | `default` · `destructive` · `outline` · `secondary` · `ghost` · `link` | `buttonVariants` |
| `badge`       | `default` · `secondary` · `destructive` · `outline`                 | `badgeVariants` |
| `alert`       | `default` · `destructive`                                            | `alertVariants` |
| `toggle`      | `default` · `outline`                                                | `toggleVariants` |
| `input`       | `default` (single row; variants absent)                              | — |
| `checkbox`    | `default` (single row)                                               | — |
| `tabs`        | `default` (single row)                                               | — |
| `card`        | `default` (single row)                                               | — |

Always read the actual shadcn source in `components/ui/{component}.tsx` first — this table is a convenience only. If shadcn ships a new variant (e.g. `button` gains `icon-outline`), add it as a row without waiting for this file to update.

**Row label → display text mapping:** use the exact variant-property string (`default`, `destructive`) as both the row label and the instance property value. Do not rename for prettiness — designers and developers need the same vocabulary.

---

## 9. Per-component size rows (size groups stacked vertically)

When a component has a `size` property, the matrix stacks **one size group per size value** in the order declared by shadcn. Size labels go in the 60px left column.

| Component   | Size groups (top → bottom)      |
|-------------|----------------------------------|
| `button`    | `sm` · `default` · `lg` · `icon` |
| `toggle`    | `sm` · `default` · `lg`          |
| `avatar`    | `sm` · `md` · `lg`               |
| `input`     | (no size axis — single group)    |

Label text = shadcn value verbatim (`sm`, `default`, `lg`, `icon`). If you want friendlier labels, add a parenthetical after the value: `default (base)`, `icon (square)`.

---

## 10. Auto-layout rules (same 10px-collapse guardrails as the style-guide tables)

Every frame you create for the matrix must follow these rules. Reuse them directly from [`create-design-system/CONVENTIONS.md` §9](../create-design-system/CONVENTIONS.md) — the same helper can produce both tables and matrices.

| Frame | `layoutMode` | `primaryAxisSizingMode` | `counterAxisSizingMode` | Notes |
|-------|--------------|-------------------------|-------------------------|-------|
| `doc/component/{name}` | VERTICAL | AUTO | FIXED (1640) | Root doc frame |
| `.../header` | VERTICAL | AUTO | STRETCH | Title + summary + source link |
| `.../properties` (table root) | VERTICAL | AUTO | FIXED (1640) | See §4 |
| `.../matrix` | VERTICAL | AUTO | FIXED (1640) | See §5 |
| `matrix/size-group/{size}` | HORIZONTAL | AUTO | STRETCH | One block per size |
| `matrix/.../row/{variant}` | HORIZONTAL | AUTO | STRETCH | `minHeight: 72`, `counterAxisAlignItems: CENTER` |
| State cells | HORIZONTAL | FIXED | FIXED | `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: CENTER`, `paddingH/V: 16` |
| Cell text nodes | — | — | — | **Always** `text.textAutoResize = 'HEIGHT'` immediately after `text.characters =`. Without this the row collapses to 10px. |
| Row-label / size-label frames | VERTICAL | AUTO | FIXED | Center content vertically |

### 10.1 — Property-assignment ORDER matters

**`frame.resize(w, h)` silently resets both sizing modes to FIXED.** If you set `primaryAxisSizingMode = 'AUTO'` *before* calling `resize()`, the resize overwrites it and the frame collapses to 1px tall. Correct order for every frame you create:

```js
const f = figma.createFrame();
f.layoutMode = 'VERTICAL';          // 1. layout mode first
f.resize(1640, 1);                  // 2. resize (resets sizing modes)
f.primaryAxisSizingMode = 'AUTO';   // 3. then sizing modes (these stick)
f.counterAxisSizingMode = 'FIXED';
```

The same rule applies to `resizeWithoutConstraints` — resize first, then sizing modes. This is the #1 cause of the "whole doc frame renders as a thin horizontal sliver" bug.

---

## 11. Token bindings for matrix chrome

All matrix chrome must use variable-bound paints (same rule as the style-guide tables — see [`create-design-system/CONVENTIONS.md` §12](../create-design-system/CONVENTIONS.md)).

| Matrix element | Variable | Collection |
|---------------|----------|------------|
| Outer dashed stroke | `color/border/subtle` | Theme · Light |
| Header rows bottom stroke | `color/border/subtle` | Theme · Light |
| Header group text (DEFAULT / DISABLED) | `color/background/content-muted` | Theme · Light |
| State header text (default / hover / …) | `color/background/content-muted` | Theme · Light |
| Size label text | `color/background/content` | Theme · Light |
| Variant row label text | `color/background/content-muted` | Theme · Light |
| Size-label column right stroke (bracket) | `color/border/subtle` | Theme · Light |
| Variant row bottom stroke | `color/border/subtle` | Theme · Light |
| Usage note card fill | `color/background/variant` | Theme · Light |
| Usage note text | `color/background/content` | Theme · Light |

**Text styles** — every text node assigns `textStyleId` to one of `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`. Never set raw `fontName` / `fontSize` on matrix chrome.

---

## 12. Build order (every component, every run)

1. Navigate to the component's target page (`figma.setCurrentPageAsync`). Delete every node on the page **other than `_Header`**.
2. Verify / create `_PageContent` at `x: 0, y: 320`, 1800 × AUTO, padding 80, fill `#FFFFFF`.
3. Resolve the Theme / Layout / Typography collections, font-family values, and published text styles (Doc/* and Label/*).
4. Build every variant `ComponentNode` via `buildVariant(...)` as siblings on the page. Each variant is assembled as `[icon-slot/leading]? → [text label]? → [icon-slot/trailing]?` (or a single `icon-slot/center` when the label is null). Bind each variant's label text to the appropriate `Label/*` text style via `CONFIG.labelStyle`. **Inside `buildVariant`, immediately after appending children, add element component properties on THIS variant** via `comp.addComponentProperty('Label', 'TEXT', defaultText)`, `comp.addComponentProperty('Leading icon', 'BOOLEAN', true)`, `comp.addComponentProperty('Trailing icon', 'BOOLEAN', false)` per `CONFIG.componentProps`, and set `textNode.componentPropertyReferences = { characters: labelKey }` / `slot.componentPropertyReferences = { visible: booleanKey }` on the corresponding child nodes. The Figma Plugin API requires element props be added to components **before** combining — see `figma-use/component-patterns.md`. Wrap the property block in `try / catch`; on failure, log a warning and continue (soft downgrade per § 3.3.3). `buildVariant` returns `{ component, slots, propKeys }`.
5. Call `figma.combineAsVariants(variantData.map(d => d.component), figma.currentPage)` → `ComponentSetNode`. Name it `{ComponentTitle} — ComponentSet`. The ComponentSet automatically unifies identically-named child properties into set-level properties (so you get one `"Label"` / one `"Leading icon"` / one `"Trailing icon"` in Figma's right panel, regardless of how many variants defined them). Do NOT park at `y: -2000` — it will be reparented into the doc frame in step 6.
6. Build the `doc/component/{name}` root frame inside `_PageContent` in this order:
   - **Header** (title + summary + shadcn docs link).
   - **Properties table** — follow §4 spec.
   - **Component Set section** — follow §3.2 spec. `section.appendChild(compSet)` reparents the live ComponentSet; configure its auto-layout as `HORIZONTAL` + `WRAP` with 32-padding, 24 gap, dashed outline.
   - **Matrix** — follow §5 spec. For each cell: `figma.createInstance(componentNode)` → `instance.setProperties({...})` → append. The instances resolve back to the reparented ComponentSet above, so any edit there propagates here automatically.
   - **Usage notes** — follow §6 spec.
7. Remove the bottom stroke from the last variant row of the last size group.
8. Validate: `docRoot.children.length === 5`, `compSet.parent !== figma.currentPage`, `pageContent.height > 500`.
9. Report the page checklist: 1 component set created (inline) · N variant rows · M state columns · properties-row count · Do/Don't bullet count.

---

## 13. Reference implementation — Button (sample)

Use this as the golden test case when validating `/create-component`. The output must produce a `↳ Buttons` page with:

- `_Header` intact at `y: 0–320`
- `_PageContent` 1800 × AUTO, padding 80, y=320
- `doc/component/button/header` — title "Button", 1-line summary "Trigger an action or navigate. Follows shadcn/ui defaults.", shadcn source link
- `doc/component/button/properties` — 1640-wide table with 6 rows:
  - `variant` · `"default" \| "destructive" \| "outline" \| "secondary" \| "ghost" \| "link"` · `"default"` · no · Visual style.
  - `size` · `"default" \| "sm" \| "lg" \| "icon"` · `"default"` · no · Overall height + padding preset.
  - `disabled` · `boolean` · `false` · no · Disables pointer + keyboard interaction; visual dim applied.
  - `asChild` · `boolean` · `false` · no · Renders the styled classes onto the immediate child via Radix Slot.
  - `type` · `"button" \| "submit" \| "reset"` · `"button"` · no · Native HTML type.
  - `className` · `string` · `—` · no · Tailwind class escape hatch.
- `doc/component/button/component-set-group` — 1640-wide section containing the **live `Button — ComponentSet`** (24 variant components, 6 variants × 4 sizes) laid out as a horizontal-wrap grid with 32 padding, 24 gap, dashed border, corner radius 16. Each variant's inner label uses the `Label/MD` (or `Label/SM` / `Label/LG`, per size) published text style. The three non-icon sizes (`sm`, `default`, `lg`) each render as `[icon-slot/leading 24×24] → text → [icon-slot/trailing 24×24]`; the `icon` size renders as a single centered `icon-slot/center 24×24`. The ComponentSet exposes three element properties in Figma's right panel: **`Label`** (TEXT, default `"Button"`), **`Leading icon`** (BOOLEAN, default on), **`Trailing icon`** (BOOLEAN, default off). State is a _visual_ axis driven by the matrix below, not a Figma property — so we do **not** create 96 component nodes (see §14).
- `doc/component/button/matrix` — 1640 wide, 4 size groups (`sm`, `default`, `lg`, `icon`) × 6 variant rows × 4 state columns (default / hover / pressed / disabled). Total cells: 4 × 6 × 4 = **96 instances** — all pointing back to the ComponentSet above. Dashed outline; header groups "DEFAULT" (3 cols) + "DISABLED" (1 col); state labels row underneath; variant rows labeled Default / Destructive / Outline / Secondary / Ghost / Link.
- `doc/component/button/usage` — 2-column Do / Don't grid, each with 3 bullets pulled from shadcn button guidance.

### 13.1 — Why state is NOT a Figma variant property

shadcn renders state via `:hover` / `:active` / `:disabled` pseudo-classes on the same DOM node — there is no `state` prop. In Figma, we mirror that: the `ComponentSet` has `variant` and `size` props only. The matrix simulates state visually by **changing the cell's instance fill/stroke bindings at render time**:

| State column | Per-cell instance override |
|--------------|-----------------------------|
| `default`   | no overrides (instance renders as component defaults) |
| `hover`     | override fill with `color/{variant-semantic}/hover` if the token exists, otherwise lighten primary fill by ~8% |
| `pressed`   | override fill with `color/{variant-semantic}/pressed` or darken by ~8% |
| `disabled`  | set instance `opacity: 0.5` and override fill to `color/background/variant` |

If a hover/pressed/disabled token exists in the Theme collection, **always** prefer the bound token over a math-generated shade. These are instance-level paint overrides — they do not modify the underlying component.

For components where `disabled` **IS** a Figma variant prop (`checkbox`, `switch`, `input`), map the matrix's disabled column to `setProperties({ disabled: true })` on the instance and skip the overlay treatment.

---

## 14. Audit checklist before reporting a component "drawn"

### Page scaffold
- [ ] Navigated to the correct `↳ {Page}` per the routing table in SKILL.md
- [ ] Deleted every node other than `_Header`
- [ ] `_PageContent` exists at (0, 320), 1800 wide, padding 80, fill `#FFFFFF`

### Component set
- [ ] Every variant × size combination has a `ComponentNode`
- [ ] Each variant's inner label text uses a published `Label/*` text style (Label/XS / Label/SM / Label/MD / Label/LG) driven by `CONFIG.labelStyle` — not raw `fontSize`
- [ ] All variant nodes combined into one `ComponentSet` named `{Title} — ComponentSet`
- [ ] ComponentSet **reparented into the doc frame** as §3 (Component Set section) — NOT parked at `y: -2000` and NOT left on the page root
- [ ] ComponentSet configured as `HORIZONTAL` + `WRAP` auto-layout, 1640 wide, 32 padding, 24 itemSpacing, 24 counterAxisSpacing, dashed stroke bound to `color/border/subtle`, fill bound to `color/background/variant`, `cornerRadius: 16`
- [ ] State columns mapped correctly: if shadcn has no state prop, the matrix uses instance overrides (§13.1); if shadcn has a `disabled`/`checked`/etc. prop, the matrix uses `setProperties(...)`

### Icon slots (§ 3.3)
- [ ] If `CONFIG.iconSlots.leading` is true: every variant with a label contains a child named `icon-slot/leading` at **24 × 24** with no fill and a 1 px dashed stroke bound to `color/border/default`, `cornerRadius: 4`
- [ ] If `CONFIG.iconSlots.trailing` is true: same, named `icon-slot/trailing`
- [ ] Every variant whose `CONFIG.label(size, variant)` returns `null` contains exactly **one** child named `icon-slot/center` at 24 × 24 — and no text node
- [ ] Icon-only variants have **square** padding (`paddingTop == paddingLeft`) so they render as squares — matches shadcn `h-10 w-10`
- [ ] Slot layer order is `icon-slot/leading → text → icon-slot/trailing` (reading order)

### Element component properties (§ 3.3)
- [ ] If `CONFIG.componentProps.label` is true: the `ComponentSet` has a `TEXT` property named exactly `"Label"` with default = first non-null `CONFIG.label(...)` value
- [ ] Every variant's text node has `componentPropertyReferences.characters` pointing to that property ID
- [ ] If `CONFIG.componentProps.leadingIcon` is true: `ComponentSet` has a `BOOLEAN` property `"Leading icon"` (default `true`) referenced by every `icon-slot/leading`'s `visible` field
- [ ] If `CONFIG.componentProps.trailingIcon` is true: same for `"Trailing icon"` (default `false`) and `icon-slot/trailing`
- [ ] If `addComponentProperty` threw (soft failure): warning logged, no error thrown, matrix still rendered — this is an acceptable downgrade, not a bug

### Doc frame — header
- [ ] `doc/component/{name}` root frame exists inside `_PageContent` with 5 children (header, properties, component-set-group, matrix, usage)
- [ ] Title (`Doc/Section`), summary (`Doc/Caption`), source link rendered

### Doc frame — properties table
- [ ] 5 columns (PROPERTY · TYPE · DEFAULT · REQUIRED · DESCRIPTION) summing to 1640
- [ ] Property row order: variant props → state props → content props → a11y props → escape hatches
- [ ] Every cell's text uses `Doc/Code` or `Doc/Caption`; `textAutoResize = 'HEIGHT'`

### Doc frame — component set section (§3.2)
- [ ] Section frame named `doc/component/{name}/component-set-group`, VERTICAL auto-layout, 1640 wide
- [ ] Section title "Component" (`Doc/Section`) + caption explaining "Live ComponentSet — edit here, matrix updates"
- [ ] The `ComponentSetNode` itself is a direct child of this section (third child of `docRoot`)

### Doc frame — matrix
- [ ] Matrix is 1640 wide, dashed outline `color/border/subtle`, `cornerRadius: 16`
- [ ] Two-tier header: group row (DEFAULT | DISABLED) + state-label row
- [ ] Gutter width = 220 (size 60 + variant 160) when size axis present; 160 when absent
- [ ] State cells equal-width and sum to 1420 (or 1480 when no size axis)
- [ ] Size groups stacked vertically in shadcn declaration order
- [ ] Row labels are **outside** cells, fixed 160 wide, `Doc/Caption`
- [ ] Every cell contains exactly **one** instance, created via `figma.createInstance(componentNode)`
- [ ] Instance properties set to match the cell coordinates
- [ ] Bottom stroke removed from the last row of the last size group

### Doc frame — usage notes
- [ ] 2-column Do / Don't grid, each 805 wide, padding 28, fill `color/background/variant`
- [ ] Minimum 3 bullets per column

### Text & bindings
- [ ] Every text node uses a `Doc/*` style (never raw `fontName`/`fontSize`)
- [ ] Every chrome fill/stroke bound to a Theme/Primitives variable
- [ ] No hard-coded hex on chrome
- [ ] Instance overrides (hover/pressed/disabled) prefer bound Theme tokens over math-generated shades

If any box is unchecked, fix before reporting the component as `drawn`.

---

## 15. Where the authoritative rules live

| Topic                                      | File                                                                                      |
|--------------------------------------------|-------------------------------------------------------------------------------------------|
| Full orchestration (install + draw)        | [`skills/create-component/SKILL.md`](./SKILL.md)                                          |
| Matrix layout spec                         | This file, §5                                                                              |
| Properties table spec                      | This file, §4                                                                              |
| State axis per component category          | This file, §7                                                                              |
| Variant rows per component                 | This file, §8 + shadcn source at `components/ui/{component}.tsx`                          |
| Auto-layout rules (10px-collapse prevention)| [`create-design-system/CONVENTIONS.md` §9](../create-design-system/CONVENTIONS.md)         |
| Token binding map (chrome → variable)      | [`create-design-system/CONVENTIONS.md` §12](../create-design-system/CONVENTIONS.md) + §11 |
| `Doc/*` text style definitions             | [`create-design-system/CONVENTIONS.md` §7](../create-design-system/CONVENTIONS.md)         |
| Canvas geometry (1800 / 1640 / 80 padding) | [`create-design-system/CONVENTIONS.md` §3](../create-design-system/CONVENTIONS.md)         |
| Page routing (component → page)            | [`skills/create-component/SKILL.md`](./SKILL.md) Step 6 routing table                     |

When you are unsure, **`Read` the relevant file** rather than guessing. Every file referenced above is designed to be read in full by the agent before executing its step.
