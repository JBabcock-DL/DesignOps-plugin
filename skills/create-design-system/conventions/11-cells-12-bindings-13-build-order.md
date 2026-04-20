# 11. Cell content patterns

Use these exactly. Cells default to **VERTICAL AUTO** so multi-line stacks (Theme LIGHT/DARK, Typography SIZE/LINE) grow without collapsing the row.

| Pattern | Structure |
|---|---|
| **Mono line** (TOKEN, HEX, WEB, ANDROID, iOS, VALUE) | One Doc/Code text node. `text.resize(colWidth - 40, 1)` → `textAutoResize = 'HEIGHT'`. |
| **Swatch chip + hex — Primitives** (combined SWATCH + HEX column) | HORIZONTAL wrapper · itemSpacing 10 · cross-axis CENTER · children: [rounded-rect 28×28 cornerRadius 8 stroke `color/border/subtle` fill bound to variable] + [Doc/Code hex text, fill `color/background/content`]. |
| **Swatch chip + hex — Theme LIGHT/DARK** | **#1 dark-mode bug.** Cell is HORIZONTAL with **two siblings**: [1] mode-scoped wrapper `doc/theme-preview/{mode}` that calls `setExplicitVariableModeForCollection(themeCollection, modeId)` and contains **only** the 28×28 chip (bound fill); [2] Doc/Code hex text as a **sibling** of the wrapper, **not a child**. Hex fill binds to `color/background/content` and MUST resolve in the page's Light mode. If you parent the hex inside the Dark wrapper, the fill resolves to white on the white cell and disappears. Layer tree: `cell (HORIZONTAL, AUTO) → [doc/theme-preview/{mode}, chip only] + [doc/code text sibling]`. |
| **Preview bar** (Space, Layout spacing) | HORIZONTAL wrapper · cross-axis CENTER · single rectangle height 16 cornerRadius 4 fill `color/primary/200` (bound); width bound to the `Space/*` variable (or resolved px). |
| **Preview square** (Radius) | HORIZONTAL wrapper · single 64×64 rect fill `color/neutral/100` stroke `color/border/subtle` cornerRadius bound to the `Corner/*` variable. |
| **Two-line meta** (Typography SIZE/LINE, WEIGHT/FAMILY) | VERTICAL stack · itemSpacing 4 · two Doc/Code text nodes; the second line may use `color/background/content-muted` for visual hierarchy. |
| **Category sub-header row** (Text Styles only) | Single row frame width 1640 minHeight 40 fill `color/background/variant`; single cell paddingH 24 with Doc/Caption uppercase text, letter-spacing +0.08em. |
| **Alias →** | Doc/Code text, fill `color/background/content-muted`, prefixed with `↳ ` (U+21B3) when the alias resolves to a primitive; `— (raw)` when the value is a hard-coded literal. |

**Theme dual-preview fallback:** if `setExplicitVariableModeForCollection` throws, bind only the LIGHT chip, print the Dark hex as Doc/Caption text below the chip, and log `Theme dual-preview: explicit mode unsupported` once per table.

---

## 12. Table chrome → variable binding map

Every chrome element below **must** use `setBoundVariable` / variable-bound paints. Only fall back to resolved values when the Plugin API refuses.

| Table element | Variable | Collection · mode |
|---|---|---|
| Table outer fill | `color/background/default` | Theme · Light |
| Table outer stroke | `color/border/subtle` | Theme · Light |
| Table shadow (guide tables only) | `Effect/shadow-sm` (effectStyleId) | Effects · Light |
| Header row fill | `color/background/variant` | Theme · Light |
| Header row bottom stroke | `color/border/subtle` | Theme · Light |
| Header text | `color/background/content-muted` | Theme · Light |
| Body row bottom stroke | `color/border/subtle` | Theme · Light |
| Primary cell text (TOKEN, HEX, VALUE, codeSyntax) | `color/background/content` | Theme · Light |
| Muted cell text (second lines, alias, caption) | `color/background/content-muted` | Theme · Light |
| Swatch chip stroke | `color/border/subtle` | Theme · Light |
| Swatch chip fill | The row's own variable (Primitives or Theme) | per row |
| Radius preview square fill | `color/neutral/100` | Primitives |
| Radius preview square stroke | `color/border/subtle` | Theme · Light |
| Spacing preview bar fill | `color/primary/200` | Primitives |
| Effects preview card fill | `color/background/default` | Theme · Light |
| Category sub-header row fill | `color/background/variant` | Theme · Light |

---

## 13. Build-order checklist (every table in every Step 15a–15c script)

1. **Create** `doc/table/{slug}` → set `layoutMode`, both sizing modes, `layoutAlign`, radius, clipping, fill + stroke bindings. `resizeWithoutConstraints(1640, 1)`. Do **not** call `resize(1640, 10)` — AUTO will expand.
2. **Create** `doc/table/{slug}/header` → `resize(1640, 56)` → append cells in column order; each cell `resize(colWidth, 56)` **before** appending its text node.
3. **Create** `doc/table/{slug}/body` → do **not** resize; STRETCH + AUTO handles it.
4. For each data row: **create** the row frame → set `layoutMode: 'HORIZONTAL'`, `counterAxisSizingMode: 'AUTO'` (Hug height), `primaryAxisSizingMode: 'FIXED'` (Fixed 1640 width) **before** `resize(1640, 1)` → then set `minHeight 64`, `paddingTop/paddingBottom 16`, `counterAxisAlignItems: CENTER` → append cells. For each cell, set `primaryAxisSizingMode: 'AUTO'` (Hug height) + `counterAxisSizingMode: 'FIXED'` (Fixed colWidth) **before** `resize(colWidth, 1)`, with `paddingLeft/paddingRight 20`. **See § 0.1** in [`00-gotchas.md`](./00-gotchas.md) — skipping the Hug-before-resize sequence is what produces 1px-tall rows and cells.
5. For each text node: set `characters` → `resize(textWidth, 1)` → `textAutoResize = 'HEIGHT'` → assign `textStyleId` (or fallback literals) → bind fill.
6. After all rows are appended, remove the bottom stroke from the last row (`row.strokes = []` or `strokeBottomWeight = 0`) so the outer `clipsContent` radius reads clean.
7. Apply `effectStyleId` to the outer `doc/table/{slug}` frame **only** if `Effect/shadow-sm` already exists in the file (Step 15c §0 publishes it; 15a/15b may skip on first run).

Step 15a draws **10 tables** on ↳ Primitives (5 color ramps + Space + Radius + Elevation + Typeface + Font weight). Step 15b draws **7 tables** on ↳ Theme (one per semantic group). Step 15c draws **2 + 1 + 2 = 5 tables** across ↳ Layout, ↳ Text Styles, ↳ Effects.
