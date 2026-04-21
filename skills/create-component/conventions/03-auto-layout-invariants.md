# create-component / conventions / 03-auto-layout-invariants.md

> Scope: Figma Auto-Layout **enum invariants** and **property-assignment order** rules that every archetype builder and doc helper must follow. A violation here throws a hard validation error in Figma and aborts the entire `use_figma` draw, or produces the "whole doc frame renders as a thin horizontal sliver" bug.
>
> **Related**: [`01-config-schema.md`](./01-config-schema.md) (the fields feeding into these frames). [`02-archetype-routing.md`](./02-archetype-routing.md) (which builder is consuming these rules). [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) §10 covers the doc-frame-level auto-layout contract that complements these invariants.

## 3.1.2 — Figma auto-layout enum invariants (do not violate)

Figma throws a hard validation error and aborts the entire `use_figma` draw when an auto-layout enum receives a disallowed value. The most common regression is putting `'STRETCH'` on the wrong property — it's valid on `layoutAlign` (a **child-side** property) but never on `counterAxisAlignItems` or `primaryAxisAlignItems` (both **parent-side**).

| Property (on an auto-layout frame) | Allowed values | Common bug |
|---|---|---|
| `layoutMode` | `'NONE'` \| `'HORIZONTAL'` \| `'VERTICAL'` | — |
| `primaryAxisSizingMode` | `'FIXED'` \| `'AUTO'` | — |
| `counterAxisSizingMode` | `'FIXED'` \| `'AUTO'` | — |
| `primaryAxisAlignItems` | `'MIN'` \| `'MAX'` \| `'CENTER'` \| `'SPACE_BETWEEN'` | Setting `'STRETCH'` (invalid). |
| `counterAxisAlignItems` | `'MIN'` \| `'MAX'` \| `'CENTER'` \| `'BASELINE'` | Setting `'STRETCH'` (invalid) — agents reach for this when they want children to fill the counter axis. |
| `layoutAlign` (on the **child**) | `'INHERIT'` \| `'STRETCH'` \| `'MIN'` \| `'CENTER'` \| `'MAX'` | — `'STRETCH'` IS valid here. |
| `layoutSizingHorizontal` / `layoutSizingVertical` (on the **child**) | `'HUG'` \| `'FILL'` \| `'FIXED'` | — |

**To stretch a child across the parent counter-axis, do this on the CHILD after `appendChild`:**

```js
parent.appendChild(child);
child.layoutAlign = 'STRETCH';           // or
child.layoutSizingHorizontal = 'FILL';   // (on a HORIZONTAL parent: stretches vertically; swap property on VERTICAL parent)
```

**Never do this on the parent:**

```js
parent.counterAxisAlignItems = 'STRETCH'; // ❌ throws "Invalid enum value" and aborts the draw
parent.primaryAxisAlignItems = 'STRETCH'; // ❌ same
```

Every archetype builder in [`templates/archetype-builders.figma.js`](../templates/archetype-builders.figma.js) already follows this contract — they set `counterAxisAlignItems` to `'MIN'` / `'CENTER'` on the parent and `layoutAlign = 'STRETCH'` on stretched children. If you're editing or porting a builder and see an agent-authored variant with `'STRETCH'` on either axis-align property, rewrite it per the rules above before running.

## 10. Auto-layout rules (same 10px-collapse guardrails as the style-guide tables)

Every frame you create for the matrix must follow these rules. Reuse them directly from [`create-design-system/conventions/08-hierarchy-and-09-autolayout.md` §9](../../create-design-system/conventions/08-hierarchy-and-09-autolayout.md) — the same helper can produce both tables and matrices.

| Frame | `layoutMode` | `primaryAxisSizingMode` | `counterAxisSizingMode` | Notes |
|---|---|---|---|---|
| `doc/component/{name}` | VERTICAL | AUTO | FIXED (1640) | Root doc frame |
| `.../header` | VERTICAL | AUTO | STRETCH | Title + summary + source link |
| `.../properties` (table root) | VERTICAL | AUTO | FIXED (1640) | See [`04-doc-pipeline-contract.md` §4](./04-doc-pipeline-contract.md#4-properties--types-table-every-component) |
| `.../matrix` | VERTICAL | AUTO | FIXED (1640) | See [`04-doc-pipeline-contract.md` §5](./04-doc-pipeline-contract.md#5-variant--state-specimen-matrix) |
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
