# create-component / conventions / 04-doc-pipeline-contract.md

> Scope: the **doc frame** — the 5-section canvas every component renders into. Covers the matrix rule, page layout, ComponentSet section, properties table, variant × state matrix, usage notes, per-category state axes, per-component variant/size rows, token bindings, build order, and the Button reference implementation. This file is the **archetype-agnostic** contract every builder must honor.
>
> **Related**: [`01-config-schema.md`](./01-config-schema.md) (fields consumed here). [`02-archetype-routing.md`](./02-archetype-routing.md) (what builders produce). [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) (enum + order-of-assignment rules). [`06-audit-checklist.md`](./06-audit-checklist.md) (S9.* assertions that gate a "drawn" report).

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

| Layer | Width | Notes |
|---|---|---|
| Page canvas | **1800px** | Already scaffolded; do not resize. |
| `_Header` instance | **1800px** | `layoutMode: VERTICAL`, FIXED height 320, `cornerRadius: 0`. |
| `_PageContent` | **1800px** | `x: 0, y: 320`, padding **80 all sides**, `itemSpacing: 48`, fill `#FFFFFF` literal. |
| Inner content | **1640px** | Every `doc/component/*` root frame renders at 1640 wide. |
| Properties table | **1640px** | Same chrome as style-guide tables (§4). |
| Matrix root | **1640px** | Fixed width; columns divide the space after the row-label gutter (§5). |

**One component per page.** Do **not** stack two components in one `_PageContent`. `↳ Buttons` holds one Button doc frame; `↳ Cards` holds one Card doc frame; overlay pages (`↳ Dialogue`, `↳ Drawer`, `↳ Popover`, `↳ Tooltips`) hold one frame for that specific overlay.

**Delete before drawing.** When redrawing, delete every node on the page **other than `_Header`** (same rule as Step 15a in `/create-design-system`). Do not leave stale specimens under the new matrix.

### 2.1 — Same failure modes as the style guide (what Sonnet / Cursor must not "fix")

The **§6 `use_figma` template in [`SKILL.md`](../SKILL.md)** already bakes in the critical discipline from **create-design-system** [`SKILL.md` §0.1–§0.2](../../create-design-system/SKILL.md): **`resize` before `primaryAxisSizingMode` / `counterAxisSizingMode`**, **Hug height on rows/cells before `resize(..., 1)`**, and **`text.resize(w, 1)` → `textAutoResize = 'HEIGHT'`** on every doc table cell. Agents re-implementing the page from prose (instead of copying the template) are what reproduce **1px-tall bodies** and **~10px text rails**.

**Depth / effects — intentional difference from style-guide data tables:** Style-guide **`doc/table/{slug}`** roots often carry **`Effect/shadow-sm`** (one elevation on the table chrome). The **shipped component doc** does **not** assign **`effectStyleId`** to the properties table, matrix, or `doc/component/{name}` root. **Do not** "align to § G Depth" by adding **`shadow-sm`** to those frames or to **`doc/table-group/{component}/properties`** *and* the inner table — that repeats the **Token Overview** mistake (stacked shadows + shadow on the wrapping **`body`**). If product later wants a single card shadow, add it **once** on a dedicated outer wrapper only, then document the change in this file and the template.

**Clearing shadows:** If you ever attach or inherit an effect style on doc chrome, clearing **`effectStyleId` alone is not enough** — also set **`node.effects = []`** on that node (Figma keeps local `DROP_SHADOW` entries otherwise). Same rule as **`/sync-design-system` 6.Canvas.9d** and **create-design-system `SKILL.md` §0.9**.

**After the full tree is built**, if **`_PageContent`** or **`doc/component/{name}`** reads as clipped or too short, re-assert vertical Hug per **create-design-system `SKILL.md` §0.1** (Figma sometimes pins **`layoutSizingVertical: 'FIXED'`** after **`appendChild`**).

### 2.2 — Phased / multi-call draws — preserve space; use placeholders

When the doc frame is built across **several** Figma Plugin API runs (see [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md)), agents **must not** leave empty shells that **collapse** in auto-layout — that destroys table width, header/body alignment, and the visual contract designers expect.

**Rules:**

1. **Keep canonical geometry first** — `_PageContent`, `doc/component/{name}` at **1640px** inner width, **five section slots** in the final order (header → properties → component-set-group → matrix → usage). If a section’s real content is not ready yet, still create the **frame node** (correct `name`, `layoutMode`, `layoutAlign: 'STRETCH'`, `itemSpacing`) so siblings and gutters match §1–§2.
2. **Properties table** — Always ship the **full chrome**: `doc/table-group/...` wrapper, **`doc/table/...` at 1640px**, **header row** with uppercase columns and `color/background/variant` fill (§4). If body rows are filled in a later step, step 1 must still insert **placeholder body rows** — not an empty body — using the **same** row/cell auto-layout as production (`minHeight` per §4, `textAutoResize: 'HEIGHT'`, centered counter-axis). Use neutral filler text (`—`, `…`, or `Pending`) in cells until real copy replaces it; **do not** rely on zero-height empty frames.
3. **Replace in place** — Prefer updating placeholder row text / swapping placeholder nodes over **deleting the table shell** and redrawing. Ripping out the grid mid-pipeline is how column widths and section order drift.
4. **Same failure modes as §2.1** — Empty VERTICAL children with no text and no `minHeight` still produce **~10px rails** and **1px-tall** table bodies. Placeholders exist specifically to hold space until `CONFIG.properties` (or matrix/usage builders) run.

#### 2.2.1 — Strict properties table build (no structural redraw)

These are the **valid** ways to get a correct table **without** deleting and re-building the 1640px shell mid-ladder. Stray patterns tend to reflow columns or collapse the body.

| Path | When | What happens |
|------|------|----------------|
| **A — In-place scaffold + component + fill (shipped multistep default)** | `CONFIG.properties` is known before any doc `use_figma` (always true in `/create-component`). | **Slice 1** (`cc-doc-scaffold` / `create-component-engine-doc.step1`): `buildPropertiesTable(placeholder rows)` — header + **`properties.length` placeholder** body rows + dashed reserves. **Slice 2** (`cc-doc-component` / `step2`): live `ComponentSet` into the doc section. **Slice 3** (`cc-doc-props` / `step3`): `__ccDocFillPropertiesFromConfig()` — **only** overwrites text in existing cells. Row count and table shell are fixed for the life of the draw. See [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) §1. |
| **B — Single `use_figma` (inline / single-pass)** | Parent runs full `draw-engine` with `__ccDocStep === null`. | Same **ordering** as Path A in one run: placeholder table + reserves → **component section** → **in-place fill** from `CONFIG.properties` → matrix → usage → finalize — no separate per-slice `use_figma` calls. |
| **C — Placeholder then text-only (custom)** | Any other split of “shell” and “content” across two calls. | Same as former Path B: reserved placeholder rows, then in-place text only — **no** delete/rebuild of the table root mid-ladder. |

**Forbidden**

- A **header-only** table in one step and **grow the body later** by appending an unpredictable number of rows if that step did not reserve row geometry (leads to collapse or a second “draw” in practice).
- **Deleting** `doc/table/.../properties` (or the table group) and recreating it in a later slice **unless** you are intentionally resetting the whole page (same rule as “delete before drawing” in §2 — not mid-pipeline).

**Authoring rule:** `N = CONFIG.properties.length` is knowable **before** any Figma call in `/create-component` — there is no reason the structural row count should change between slices.

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
| `resize(1640, 1)` → then `primaryAxisSizingMode = FIXED`, `counterAxisSizingMode = AUTO` | — | fixed width triggers wrap; height grows with rows. **Order matters** (see [`03-auto-layout-invariants.md` §10.1](./03-auto-layout-invariants.md#101--property-assignment-order-matters)) |
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

## 3.1.3 — Archetype builders must not touch the doc pipeline

The archetype builders in [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js) (`buildSurfaceStackVariant`, `buildFieldVariant`, `buildRowItemVariant`, `buildTinyVariant`, `buildContainerVariant`, `buildControlVariant`, plus the classic `buildVariant` chip path) produce **component masters only**. They return `{ component, slots, propKeys }` and nothing else.

The surrounding doc frame — title, summary, Properties table, ComponentSet tile, Variants × States matrix, Do / Don't cards — is rendered by three shared functions in [`templates/draw-engine.figma.js`](../templates/draw-engine.figma.js) `§§6.6 – 6.8`:

- `buildPropertiesTable(CONFIG.properties)` — §6.6, full 1640px table with **uppercase** headers (`PROPERTY`, `TYPE`, `DEFAULT`, `REQUIRED`, `DESCRIPTION`) and a `color/background/variant` header fill.
- `buildMatrix()` — §6.7, a single Variants × States grid that implicitly covers every size (size is the inner group axis).
- `buildUsageNotes()` — §6.8, the Do / Don't card row.

These three helpers are **archetype-agnostic**. They must render the same frame whether the component is a button (chip), card (surface-stack), input (field), menu item (row-item), checkbox (tiny), dialog (container), or switch (control). Button (`v60 Foundations` file, node `388:95`) is the canonical visual reference. If a rendered page does not match Button's doc-frame structure:

| Regression symptom | What it means | Fix |
|---|---|---|
| Mixed-case column headers (`Name`, `Type`, `Default`, `Required`, `Description`). | Builder rewrote the header row. | Restore `buildPropertiesTable` from `draw-engine.figma.js §6.6` verbatim — uppercase is non-negotiable. |
| Properties table narrower than 1640px. | Builder used a local `width` override. | Remove it. Every doc section spans the full `DOC_FRAME_WIDTH`. |
| A "Size variants" (or "Size Variants") section appears under ComponentSet. | Builder injected a per-size strip. | Delete it. Size differences are already covered by `buildMatrix` grouping. |
| Two separate ComponentSet tiles (one per size). | Builder emitted the tile per size. | Remove. `draw-engine.figma.js §6.6B` wraps **one** ComponentSet containing every variant × size. |
| `docRoot` has more or fewer than 5 children at the end of the run. | Builder appended extra doc frames, or skipped §§6.6 / 6.6B / 6.7 / 6.8. | Builders must never touch `docRoot`. Only the main script adds the five canonical sections. |

The `draw-engine.figma.js §6.9a` self-check now throws on each of these fingerprints — treat a failure there as evidence that an archetype builder was forking the doc pipeline, not as a bug in the self-check itself.

---

## 4. Properties & Types table (every component)

Above the matrix, render a Properties table that documents the component's public API. Column widths sum to **1640** (same rule as style-guide tables).

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `PROPERTY` | 240 | Doc/TokenName — e.g. `variant`, `size`, `disabled`, `asChild` |
| 2 | `TYPE` | 380 | Doc/Code — TypeScript-style union: `"default" \| "destructive" \| "outline" \| …` or `boolean` |
| 3 | `DEFAULT` | 160 | Doc/Code — the default value in quotes, or `—` if none |
| 4 | `REQUIRED` | 120 | Doc/Caption — `yes` / `no` |
| 5 | `DESCRIPTION` | 740 | Doc/Caption — one sentence. Link to shadcn docs with a `See →` suffix when useful. |

**Sum: 240 + 380 + 160 + 120 + 740 = 1640.**

Follow the same hierarchy and auto-layout rules as design-system tables (see [`create-design-system/conventions/08-hierarchy-and-09-autolayout.md` §§8–9](../../create-design-system/conventions/08-hierarchy-and-09-autolayout.md)): `doc/table-group/{component-name}/properties` wrapper; `doc/table/{component-name}/properties` with header + body rows; `minHeight: 64` per row; `counterAxisAlignItems: CENTER`; `textAutoResize: 'HEIGHT'` on every text node. **Do not** copy the style-guide **`effectStyleId: Effect/shadow-sm`** treatment onto this doc table unless you deliberately change the `SKILL.md` §6 template — see **§2.1** above.

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
            ├── matrix/.../row/{variant}/label       FIXED width 160 · VERTICAL · Hug height · minHeight 72 · layoutAlign STRETCH (in row) · Doc/Caption "Primary"
            └── matrix/.../row/{variant}/cell/{state} FIXED width (§5.3) · HORIZONTAL · primary FIXED · counter AUTO (Hug) · minHeight 72 · center + center · paddingH/V 16 · appendChild(instance)
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
|---:|---:|
| 6 | ~236 |
| 5 | 284 |
| 4 | 355 |
| 3 | ~473 |
| 2 | 710 |
| 1 | 1420 |

If there is no size axis, gutter drops to 160 and state-cell region is 1480 — split the same way.

### 5.4 — Cells contain **one instance, centered** (height **hugs** content)

Each state cell is a HORIZONTAL frame with **`primaryAxisSizingMode: FIXED`** (column width), **`counterAxisSizingMode: AUTO`** (Hug height), **`minHeight: 72`**, `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: CENTER`, `paddingH: 16`, `paddingV: 16`. Child: one `InstanceNode` created from the component set, with `setProperties({ variant, size, state })` applied to the instance.

**Do not** use **`FIXED` / `FIXED` + explicit `height: 72`** on specimen cells — tall components (inputs with label + helper, textareas) clip or look broken. Hugging the counter axis lets the row grow with the tallest cell; `minHeight` preserves the matrix rhythm for short components.

The instance is **not resized** — it hugs its own auto-layout. Buttons stay button-sized, inputs stay input-sized. The cell grows vertically to fit.

If an instance would overflow its cell (e.g. a wide date-picker), increase the matrix outer width to a multiple of 1640 (2280 / 2600 / 3280) only for that component and log a note in its usage section. Do **not** shrink the instance.

### 5.5 — Dashed outline (optional but recommended)

The matrix root frame uses a 1px dashed stroke `color/border/subtle` with `dashPattern: [6, 4]` and `cornerRadius: 16`. This visually separates the specimen gallery from the properties table and usage notes above/below it. On components where a dashed stroke feels too designery (e.g. `card`, `separator`), swap to a solid 1px stroke.

---

## 6. Usage notes section

Below the matrix, render a 2-column Do / Don't grid documenting the most common usage questions. Each column is a VERTICAL stack, width 805 (1640 / 2 − 15 itemSpacing), padding 28, fill `color/background/variant`, cornerRadius 16.

```
doc/component/{name}/usage                           HORIZONTAL · primary AUTO · counter AUTO · STRETCH · itemSpacing 30
├── usage/do                                         VERTICAL · width 805 · padding 28 · fill color/background/variant · cornerRadius 16
│   ├── title   Doc/TokenName "Do"  with a leading "✓ " glyph (or text-only if emoji-averse)
│   └── bullets VERTICAL · itemSpacing 12 · each: TEXT Doc/Caption with leading "· " bullet
└── usage/dont                                       VERTICAL · width 805 · padding 28 · fill color/background/variant · cornerRadius 16
    ├── title   Doc/TokenName "Don't" with leading "✕ "
    └── bullets — same as Do
```

**Minimum content per component:** 3 "Do" bullets + 3 "Don't" bullets, pulled from the component's shadcn documentation page where possible (linked in §4 description column).

If you have no sourced guidance, still render the frames with 3 placeholder bullets each so the page has its shape — designers can edit in-place. Do not skip the section.

**Usage row sizing (critical):** the `usage` frame is **HORIZONTAL**, so the **counter** axis is **vertical**. `makeFrame` defaults to `resize(w, 1)` and **`counterAxisSizingMode: FIXED`** — that combination collapses the whole section to **1px tall**. The shipped `buildUsageNotes` helper must set **`counterAxisSizingMode = 'AUTO'`** (and usually `layoutSizingVertical = 'HUG'`) **after** resize. See [`03-auto-layout-invariants.md`](./03-auto-layout-invariants.md) §10.2 and create-design-system [`00-gotchas.md`](../../create-design-system/conventions/00-gotchas.md) §0.10.

---

## 7. Per-category state axes (what columns the matrix draws)

The matrix's column headers come from this table. Agents should not improvise states — pick the row that matches the component's category and stick to it.

| Category | Components | States (left → right, grouped DEFAULT \| DISABLED) |
|---|---|---|
| **Button-like** | `button`, `toggle`, `toggle-group` | `default` · `hover` · `pressed` \| `disabled` |
| **Input-like** | `input`, `textarea`, `select`, `combobox` | `default` · `focus` · `error` \| `disabled` |
| **Checkable** | `checkbox`, `radio-group`, `switch` | `unchecked` · `checked` · `indeterminate`† \| `disabled` |
| **Date / time** | `date-picker`, `calendar`, `input-otp` | `default` · `focus` \| `disabled` |
| **Slider / range** | `slider` | `default` · `hover` · `dragging` \| `disabled` |
| **Tabs / segmented** | `tabs`, `navigation-menu`, `menubar` | `inactive` · `hover` · `active` \| `disabled` |
| **Link / nav** | `breadcrumb`, `pagination` | `default` · `hover` · `active` \| `disabled` |
| **Overlay (anchored)** | `popover`, `tooltip`, `hover-card`, `dropdown-menu`, `context-menu`, `command` | `open` (single column; no DISABLED group) |
| **Overlay (modal)** | `dialog`, `alert-dialog`, `drawer`, `sheet` | `open` (single column) |
| **Display / status** | `alert`, `badge`, `progress`, `skeleton`, `avatar`, `sonner`, `toast` | `default` (single column; variants render as rows) |
| **Structure** | `card`, `separator`, `aspect-ratio`, `scroll-area`, `resizable`, `accordion`, `collapsible`, `table`, `form`, `label` | `default` (single column) |

† `indeterminate` applies to checkbox only; omit the column for radio and switch.

---

## 8. Per-component variant rows (what rows the matrix draws)

Rows come from the component's `variant` or equivalent property, read straight from the shadcn source file. When a component has no variant property, the matrix draws **one row** labeled with the component name.

**Reference — shadcn defaults at time of writing:**

| Component | Rows (top → bottom) | Source |
|---|---|---|
| `button` | `default` · `destructive` · `outline` · `secondary` · `ghost` · `link` | `buttonVariants` |
| `badge` | `default` · `secondary` · `destructive` · `outline` | `badgeVariants` |
| `alert` | `default` · `destructive` | `alertVariants` |
| `toggle` | `default` · `outline` | `toggleVariants` |
| `input` | `default` (single row; variants absent) | — |
| `checkbox` | `default` (single row) | — |
| `tabs` | `default` (single row) | — |
| `card` | `default` (single row) | — |

Always read the actual shadcn source in `components/ui/{component}.tsx` first — this table is a convenience only. If shadcn ships a new variant (e.g. `button` gains `icon-outline`), add it as a row without waiting for this file to update.

**Row label → display text mapping:** use the exact variant-property string (`default`, `destructive`) as both the row label and the instance property value. Do not rename for prettiness — designers and developers need the same vocabulary.

---

## 9. Per-component size rows (size groups stacked vertically)

When a component has a `size` property, the matrix stacks **one size group per size value** in the order declared by shadcn. Size labels go in the 60px left column.

| Component | Size groups (top → bottom) |
|---|---|
| `button` | `sm` · `default` · `lg` · `icon` |
| `toggle` | `sm` · `default` · `lg` |
| `avatar` | `sm` · `md` · `lg` |
| `input` | (no size axis — single group) |

Label text = shadcn value verbatim (`sm`, `default`, `lg`, `icon`). If you want friendlier labels, add a parenthetical after the value: `default (base)`, `icon (square)`.

---

## 11. Token bindings for matrix chrome

All matrix chrome must use variable-bound paints (same rule as the style-guide tables — see [`create-design-system/conventions/11-cells-12-bindings-13-build-order.md` §12](../../create-design-system/conventions/11-cells-12-bindings-13-build-order.md)).

| Matrix element | Variable | Collection |
|---|---|---|
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

0. **(Mode A only)** Run Step 4.5's extraction pipeline for the component: probe preconditions (§0), spawn `resolver/extract-cva.mjs` to get the cva config, spawn `resolver/resolve-classes.mjs` once per `(variant, size)` class string, and assemble CONFIG per [`05-code-connect.md` §2.5.4](./05-code-connect.md#254--config-assembly-order). If any step fails, downgrade to Mode B synthetic CONFIG (`_source = 'synthetic-fallback'`) and carry on. In Mode B, step 0 is skipped entirely and the agent hand-fills the synthetic template from `SKILL.md` §6.
1. Navigate to the component's target page (`figma.setCurrentPageAsync`). Delete every node on the page **other than `_Header`**.
2. Verify / create `_PageContent` at `x: 0, y: 320`, 1800 × AUTO, padding 80, fill `#FFFFFF`.
3. Resolve the Theme / Layout / Typography collections, font-family values, and published text styles (Doc/* and Label/*).
4. Build every variant `ComponentNode` via `buildVariant(...)` as siblings on the page. Each variant is assembled as `[icon-slot/leading]? → [text label]? → [icon-slot/trailing]?` (or a single `icon-slot/center` when the label is null). Bind each variant's label text to the appropriate `Label/*` text style via `CONFIG.labelStyle`. **Inside `buildVariant`, immediately after appending children, add element component properties on THIS variant** via `comp.addComponentProperty('Label', 'TEXT', defaultText)`, `comp.addComponentProperty('Leading icon', 'BOOLEAN', true)`, `comp.addComponentProperty('Trailing icon', 'BOOLEAN', false)` per `CONFIG.componentProps`, and set `textNode.componentPropertyReferences = { characters: labelKey }` / `slot.componentPropertyReferences = { visible: booleanKey }` on the corresponding child nodes. The Figma Plugin API requires element props be added to components **before** combining — see `figma-use/component-patterns.md`. Wrap the property block in `try / catch`; on failure, log a warning and continue (soft downgrade per [`01-config-schema.md` §3.3.3](./01-config-schema.md#333--fallback-when-addcomponentproperty-throws)). `buildVariant` returns `{ component, slots, propKeys }`.
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
- `doc/component/button/component-set-group` — 1640-wide section containing the **live `Button — ComponentSet`** (24 variant components, 6 variants × 4 sizes) laid out as a horizontal-wrap grid with 32 padding, 24 gap, dashed border, corner radius 16. Each variant's inner label uses the `Label/MD` (or `Label/SM` / `Label/LG`, per size) published text style. The three non-icon sizes (`sm`, `default`, `lg`) each render as `[icon-slot/leading 24×24] → text → [icon-slot/trailing 24×24]`; the `icon` size renders as a single centered `icon-slot/center 24×24`. The ComponentSet exposes three element properties in Figma's right panel: **`Label`** (TEXT, default `"Button"`), **`Leading icon`** (BOOLEAN, default on), **`Trailing icon`** (BOOLEAN, default off). State is a _visual_ axis driven by the matrix below, not a Figma property — so we do **not** create 96 component nodes (see [`06-audit-checklist.md` §14](./06-audit-checklist.md)).
- `doc/component/button/matrix` — 1640 wide, 4 size groups (`sm`, `default`, `lg`, `icon`) × 6 variant rows × 4 state columns (default / hover / pressed / disabled). Total cells: 4 × 6 × 4 = **96 instances** — all pointing back to the ComponentSet above. Dashed outline; header groups "DEFAULT" (3 cols) + "DISABLED" (1 col); state labels row underneath; variant rows labeled Default / Destructive / Outline / Secondary / Ghost / Link.
- `doc/component/button/usage` — 2-column Do / Don't grid, each with 3 bullets pulled from shadcn button guidance.

### 13.1 — Why state is NOT a Figma variant property

shadcn renders state via `:hover` / `:active` / `:disabled` pseudo-classes on the same DOM node — there is no `state` prop. In Figma, we mirror that: the `ComponentSet` has `variant` and `size` props only. The matrix simulates state visually by applying **per-cell instance overrides** at render time — the underlying component never changes.

#### 13.1.a — Opacity is authoritative for button-like components

`CONFIG.applyStateOverride` **must** use `instance.opacity` as the primary mechanism for every component whose shadcn source implements states via `:hover` / `:active` / `:disabled` alone (button, toggle, badge, link, most interactive atoms). This is what the SKILL template's Button CONFIG ships with and what the matrix assumes:

```js
applyStateOverride: (instance, stateKey) => {
  if (stateKey === 'hover')    instance.opacity = 0.92;
  if (stateKey === 'pressed')  instance.opacity = 0.85;
  if (stateKey === 'disabled') instance.opacity = 0.5;
},
```

Why opacity and not fill overrides:

- **Deterministic** across every variant. Does not require a matching `color/{variant}/hover` token to exist; works the same for `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` without per-variant branching.
- **One number per state**, not a paint resolution per `(variant × state)` pair. A smaller model (Sonnet, Haiku) can replicate the rule with zero lookups.
- **Survives theme swaps.** Bound fill tokens change when light/dark mode flips; opacity stays visually correct.
- **Matches the audit checklist** in [`06-audit-checklist.md`](./06-audit-checklist.md) which asserts states are opacity-based unless `CONFIG.states` says otherwise.

Do **not** override fills to math-generated shades (`lighten by 8%`, `darken by 8%`), and do **not** swap bound tokens at render time. Either approach forks the golden path.

#### 13.1.b — Exception: state IS a Figma variant property

For components whose shadcn source exposes state through a React prop that Figma models as a variant property — `checkbox` (`checked`), `switch` (`checked`), `input` (`disabled`), `radio` (`checked`) — map the matrix's state column to `instance.setProperties({ ... })` and skip the opacity overlay:

```js
applyStateOverride: (instance, stateKey, ctx) => {
  if (stateKey === 'checked')  instance.setProperties({ State: 'Checked' });
  if (stateKey === 'disabled') instance.setProperties({ State: 'Disabled' });
},
```

`ctx = { variant, size, componentNode }` if you need the originating component to re-bind anything. Use this branch only when the shadcn prop is already surfaced as a Figma variant — otherwise stay on the opacity path.

#### 13.1.c — What about per-state bound tokens?

If a design system author has already published `color/primary/hover`, `color/primary/pressed`, etc. as Theme variables, they are still exposed for manual use (custom illustrations, bespoke states) — but they are **not** consumed by `applyStateOverride` in the default pipeline. Introducing a token-swap path would make the matrix's behavior dependent on token presence, which violates the determinism goal above. If a future component genuinely needs token-swapped states, add a new `CONFIG` knob (e.g. `stateTokens: { hover: 'color/primary/hover', ... }`) rather than mutating `applyStateOverride`.

---

## 14 — Mid-draw resume state (`phase-state.json`)

The merge script writes `phase-state.json` next to `handoff.json` after every Step 6 slice; this is the canonical mid-draw resume state.

Schema (validated on every merge — exit 18 on violation): [`schema/phase-state.schema.json`](./schema/phase-state.schema.json). Hand-rolled validator lives alongside [`scripts/merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs) (`validatePhaseStateSchema`).

Notable rules:

- `lastCodeSha256` is `null` (no merge yet) or a 64-char lowercase hex SHA-256. **Placeholder strings like `"pending"` are rejected.** Do not hand-fill it.
- `completedSlugs` must be a contiguous prefix of `SLUG_ORDER` ending at `lastSliceOk` — the merge script enforces this.
- `nextSlug` must equal `SLUG_ORDER[indexOf(lastSliceOk) + 1]`, or `null` after `cc-doc-finalize`.

When recovering a broken ladder (handoff reset, missing merges), use [`scripts/resume-handoff.mjs`](../../../scripts/resume-handoff.mjs) — see [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) §5.3.
