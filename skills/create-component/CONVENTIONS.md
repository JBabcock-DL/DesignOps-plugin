# Component Canvas Conventions — Quick Reference

> **Audience:** AI agents (Claude, Sonnet, etc.) running `/create-component`. Read this **before** you draw any component so every page in the file looks like one system instead of a pile of loose instances on an empty frame.
>
> **Authoritative source:** [`skills/create-component/SKILL.md`](./SKILL.md). When this summary disagrees with the skill, the skill wins.
>
> **Related:** [`skills/create-design-system/CONVENTIONS.md`](../create-design-system/CONVENTIONS.md) — the style-guide canvas geometry this file reuses.

---

## 1. The rule: every component is drawn as a **matrix**

Old behavior (deprecated): variants pushed into a single wrapping horizontal `combineAsVariants` set with no labels, no documentation, no grouping.

New behavior (mandatory for every component, even single-state ones): a **documentation frame** with three stacked sections.

```
doc/component/{name}
├── doc/component/{name}/header        — title + 1-line summary + source link
├── doc/component/{name}/properties    — Properties + Types table (§4)
├── doc/component/{name}/matrix        — Variant × State specimen matrix (§5)
└── doc/component/{name}/usage         — Usage notes (§6) — Do / Don't bullets
```

A matrix is still drawn when the component has no state axis (the matrix collapses to a single column) and when it has no variant axis (a single row). This keeps every component page visually consistent — a designer skimming the file always finds the title, the properties, then the specimen grid, then the usage notes in the same order.

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

## 3. The `ComponentSet` lives **above** the doc frame, not inside it

Figma's native variant picker (the Properties panel on an instance) reads from a **`ComponentSetNode`**. Code Connect mapping also resolves off the component set. But the matrix you draw is a **pure documentation gallery** made of **instances**, not the raw components.

The flow:

1. Build each variant `ComponentNode` via `buildVariant(...)` (same helper as today).
2. Call `figma.combineAsVariants(nodes, figma.currentPage)` → returns a `ComponentSetNode`.
3. Place the component set at **`x: 0, y: 0`** above `_Header` (outside the visible page region but on the same page). Name it `{ComponentName} — ComponentSet`. This keeps it pickable in Figma's Assets panel and resolvable for Code Connect, without polluting the doc frame.
4. For each matrix cell, call `figma.createInstance(component)` and set the instance's `setProperties({...})` to match the cell's (variant, size, state) coordinates. Append the **instance** to the matrix cell frame.

**Never embed the raw ComponentSet inside the matrix.** The matrix is built from instances so that if the designer tweaks a variant definition, every cell updates automatically.

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
3. Resolve the Theme / Layout / Typography collections and font-family values (same as the current Step 6 template — unchanged).
4. Build every variant `ComponentNode` via `buildVariant(...)` as siblings on the page.
5. Call `figma.combineAsVariants(variantNodes, figma.currentPage)` → `ComponentSetNode`. Position the set at `x: 0, y: -2000` (above the page's visible region). Name it `{ComponentName} — ComponentSet`.
6. Build the `doc/component/{name}` root frame inside `_PageContent` in this order:
   - **Header** (title + summary + shadcn docs link).
   - **Properties table** — follow §4 spec.
   - **Matrix** — follow §5 spec. For each cell: `figma.createInstance(componentNode)` → `instance.setProperties({...})` → append.
   - **Usage notes** — follow §6 spec.
7. Remove the bottom stroke from the last variant row of the last size group.
8. Report the page checklist: 1 component set created · N variant rows · M state columns · properties-row count · Do/Don't bullet count.

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
- `doc/component/button/matrix` — 1640 wide, 4 size groups (`sm`, `default`, `lg`, `icon`) × 6 variant rows × 4 state columns (default / hover / pressed / disabled). Total cells: 4 × 6 × 4 = **96 instances**. Dashed outline; header groups "DEFAULT" (3 cols) + "DISABLED" (1 col); state labels row underneath; variant rows labeled Default / Destructive / Outline / Secondary / Ghost / Link.
- `doc/component/button/usage` — 2-column Do / Don't grid, each with 3 bullets pulled from shadcn button guidance.
- `Button — ComponentSet` sitting at `x: 0, y: -2000`, containing 24 variant components (6 variants × 4 sizes — state is a _visual_ axis driven by the matrix, not a Figma property, so we do **not** create 96 component nodes; see §14).

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
- [ ] All variant nodes combined into one `ComponentSet` named `{Name} — ComponentSet`
- [ ] ComponentSet placed at `x: 0, y: -2000` (out of viewport)
- [ ] State columns mapped correctly: if shadcn has no state prop, the matrix uses instance overrides (§13.1); if shadcn has a `disabled`/`checked`/etc. prop, the matrix uses `setProperties(...)`

### Doc frame — header
- [ ] `doc/component/{name}` root frame exists inside `_PageContent`
- [ ] Title (`Doc/Section`), summary (`Doc/Caption`), source link rendered

### Doc frame — properties table
- [ ] 5 columns (PROPERTY · TYPE · DEFAULT · REQUIRED · DESCRIPTION) summing to 1640
- [ ] Property row order: variant props → state props → content props → a11y props → escape hatches
- [ ] Every cell's text uses `Doc/Code` or `Doc/Caption`; `textAutoResize = 'HEIGHT'`

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
