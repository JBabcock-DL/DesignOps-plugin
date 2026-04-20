> **Edit-time reference for `canvas-templates/*.js` — not a runtime read for `/create-design-system`.** Rules from this file are baked into `_lib.js` helpers and `buildTable()`. Read this when editing templates.

# 8. Table component hierarchy (every table, every page)

Every table on every style-guide page uses the **same** parent chain. No orphan cells, no direct-child rows on `_PageContent`.

```
_PageContent                                       VERTICAL · AUTO · FIXED · width 1800 · padding 80 · fill #FFFFFF · x=0 y=320
└── doc/table-group/{slug}                         VERTICAL · AUTO · STRETCH · itemSpacing 12 · **clipsContent `false`** (never fixed placeholder height — see **§0.1** note in [`00-gotchas.md`](./00-gotchas.md))
    ├── doc/table-group/{slug}/title               TEXT · Doc/Section · fill color/background/content
    ├── doc/table-group/{slug}/caption             TEXT · Doc/Caption · fill color/background/content-muted  (optional, 1 line)
    └── doc/table/{slug}                           VERTICAL · AUTO · STRETCH · cornerRadius 16 · clipsContent · **`{slug}` may contain slashes** (e.g. `primitives/color/primary`) — automation must detect table roots by **direct children** named `…/header` and `…/body`, not by a `^doc/table/[^/]+$` pattern.
        │                                          stroke 1 color/border/subtle · fill color/background/default
        │                                          effectStyleId Effect/shadow-sm (when published — § G Depth) **except** `doc/table/token-overview/platform-mapping` and all inner frames — that table is nested inside `token-overview/platform-mapping`, which already applies `shadow-sm` once.
        ├── doc/table/{slug}/header                HORIZONTAL · FIXED height 56 · width 1640 · fill color/background/variant
        │                                          bottom 1px stroke color/border/subtle
        │   └── doc/table/{slug}/header/cell/{col} FIXED width per §10 (`10-column-spec.md` + `column-widths.json`) · paddingH 20 · counterAxisAlignItems CENTER
        │       └── TEXT · Doc/Code (uppercase, tracking +0.04em) · fill color/background/content-muted
        └── doc/table/{slug}/body                  VERTICAL · AUTO · STRETCH
            └── doc/table/{slug}/row/{tokenPath}   HORIZONTAL · FIXED width 1640 · AUTO height · minHeight 64
                │                                  paddingV 16 · paddingH 0 · bottom 1px stroke color/border/subtle
                │                                  counterAxisAlignItems CENTER
                │                                  (omit bottom stroke on the last child)
                └── doc/table/{slug}/row/.../cell/{col}  VERTICAL (default) or HORIZONTAL (Theme LIGHT/DARK) · AUTO height · FIXED width
                    │                              paddingH 20 · paddingV 4 · itemSpacing 4 · cross-axis CENTER
                    └── cell content — see `11-cells-12-bindings-13-build-order.md` §12
```

**Slug values per page:**

| Page | `{slug}` values |
|---|---|
| ↳ Primitives | `primitives/color/{ramp}`, `primitives/space`, `primitives/radius`, `primitives/elevation`, `primitives/typeface`, `primitives/font-weight` |
| ↳ Theme | `theme/background`, `theme/border`, `theme/primary`, `theme/secondary`, `theme/tertiary`, `theme/error`, `theme/component` |
| ↳ Layout | `layout/spacing`, `layout/radius` |
| ↳ Text Styles | `typography/styles` |
| ↳ Effects | `effects/shadows`, `effects/color` |

Rows are named **full token path** (e.g. `doc/table/primitives/color/primary/row/color/primary/500`) so follow-up scripts can address a row by name.

---

## 9. Auto-layout rules that prevent the 10px-collapse bug

These rules are **mandatory** on every frame inside a table. Failing any one of them produces clipped, collapsed tables. The row / body-cell rows below are the specific scenario covered in detail by **§ 0.1** in [`00-gotchas.md`](./00-gotchas.md) — set the height axis to **Hug** before `resize`. Cell-text rows are the scenario in **§ 0.2**.

Column headers use the Plugin API literals; the **Sizing** column restates each in Hug / Fixed / Fill prose so designers and agents match up.

| Frame | `layoutMode` | Primary / counter sizing (Hug · Fixed · Fill) | `layoutAlign` | Notes |
|---|---|---|---|---|
| `doc/table/{slug}` | VERTICAL | primary **Hug** (`AUTO`) · counter **Fixed 1640** (`FIXED`) | `STRETCH` (Fill width in parent) | Call `resizeWithoutConstraints(1640, 1)` after creation. |
| `doc/table/{slug}/header` | HORIZONTAL | primary **Fixed 1640** · counter **Fixed 56** | `STRETCH` (Fill width in parent) | `resize(1640, 56)` **before** appending cells. `counterAxisAlignItems: CENTER`. |
| Header cells | HORIZONTAL | primary **Fixed colWidth** · counter **Fixed 56** | `INHERIT` | `resize(colWidth, 56)` before appending text. `paddingH: 20`, center-aligned. **Hard rule:** header cells are **never** the VERTICAL / Hug / `resize(colWidth, 1)` body-cell recipe — that combination yields **1px-tall header cells** when label text is still `textAutoResize: 'NONE'` (see **§ 0.5** / **§ 0.6** in [`00-gotchas.md`](./00-gotchas.md)). |
| `doc/table/{slug}/body` | VERTICAL | primary **Hug** (`AUTO`) · counter **Fixed 1640** | `STRETCH` (Fill width in parent) | |
| **Body rows** (§ 0.1) | HORIZONTAL | primary **Fixed 1640** · counter **Hug** (`AUTO`) — **set Hug before `resize`** | `STRETCH` | `minHeight: 64`, `paddingV: 16`, `counterAxisAlignItems: CENTER`. |
| **Body cells** (§ 0.1) | VERTICAL or HORIZONTAL | primary **Hug** (`AUTO`) · counter **Fixed colWidth** — **set Hug before `resize`** | `INHERIT` | `resize(colWidth, 1)` after sizing modes are set. `paddingH: 20`, `paddingV: 4`, `itemSpacing: 4`. Vertical cells: `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: MIN`. |
| Cell text nodes (§ 0.2) | — | — | — | **Immediately after `text.characters`:** `text.resize(colWidth - 40, 1)` → `text.textAutoResize = 'HEIGHT'`. Never leave `'NONE'` — that is the **root cause** of the 10px collapse. |
| Cell inline wrappers | HORIZONTAL | primary **Hug** · counter **Hug** | `INHERIT` | `itemSpacing: 10`, `counterAxisAlignItems: CENTER`. |

**Never** `resize(w, h)` with `h < 20` as a scaffold — rely on **Hug** (`AUTO`) for every height that depends on children. See **§ 0.1** in [`00-gotchas.md`](./00-gotchas.md) for the full call order on body rows and body cells.

**The #1 and #2 bugs you will hit:**
1. Forgetting to set the height axis to **Hug** (`AUTO`) before `resize(1640, 1)` / `resize(colWidth, 1)`. The `1` sticks as a **Fixed** height and the row/cell renders as a 1px sliver. → § 0.1.
2. Forgetting `text.textAutoResize = 'HEIGHT'` after setting characters. The text node defaults to `'NONE'`, contributes ~10px to the row, and the row collapses. → § 0.2.
