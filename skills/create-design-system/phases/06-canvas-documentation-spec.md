
## Canvas documentation visual spec

Agents **must read this section** before executing Steps **15a–18** and any `use_figma` script that draws token documentation. **`/sync-design-system`** Steps **9b–9e** must follow the **same** structure, binding, and Dev Mode rules (**§ A–G**; see [`../../sync-design-system/SKILL.md`](../../sync-design-system/SKILL.md)).

### A — Structure (geometry, naming; stable across all files)

| Rule | Value |
|---|---|
| Page canvas width | **1800px** — pages sit on a 1800px canvas column that the `_Header` and `_PageContent` frames both span. |
| `_Header` component | Every page's `_Header` instance: **`layoutMode: VERTICAL`** (auto-layout, **not** `NONE`), **FIXED height 320**, **FIXED width 1800** (resize every existing instance to 1800 so it lines up with `_PageContent`), **`cornerRadius: 0`** (the square bottom edge lets `_PageContent` butt directly against it for a clean seam — **do not** re-introduce the legacy 24px radius). Internal structure: a horizontal top row (logo 40×40 + "DETROIT LABS" label, `spaceBetween`, height 40) and a vertical `_title` + `_description` stack. Padding `{40, 40, 40, 61}` (L·T·R·B, asymmetric bottom preserves the legacy description baseline). Outer `itemSpacing 60`, title-stack `itemSpacing 23`. |
| `_PageContent` shell | One **`_PageContent`** frame per page, positioned **`x: 0, y: 320`** (directly beneath `_Header` with no gap): **`layoutMode: VERTICAL`**, **`primaryAxisSizingMode: AUTO`**, **`counterAxisSizingMode: FIXED`**, **`layoutAlign: STRETCH`**, **width 1800**, **padding 80px on all four sides**, **`itemSpacing 48`**, **fill `#FFFFFF` (literal white, not token-bound)**. All sections/tables are children of this shell. Inner content width = **1640** (1800 − 80 − 80) — every `doc/table-group/*` and `doc/table/*` must render at **1640** wide. |
| Vertical rhythm | 8px grid (`itemSpacing` / gaps use multiples of 8); **48px** `itemSpacing` between **major** sections (ramps, Theme groups, style-guide tables). |
| Section frames | Auto-layout **`VERTICAL`**, **`primaryAxisSizingMode: AUTO`**, **`counterAxisSizingMode: FIXED`**, width **fill (STRETCH)** inside `_PageContent`; **`layoutAlign: STRETCH`** |
| Section shell | Inset panels: **`cornerRadius` 16**, stroke **`color/border/subtle`**, **`itemSpacing` 24**; section **fill** **`color/background/default`** (Theme · Light); **token cards** inside use **`color/background/variant`** so panels read as **cards on a calm base** (gallery pattern — see reference links below this table) |
| Section group headers | Full-width strip **1640×64px**; title **`Doc/Section`**; optional **1px** bottom edge via stroke on strip (**`color/border/subtle`**) |
| Theme token grid | **2 columns**: section body stacks **`doc/theme/card-row-{n}`** rows (**§ F**). Each **card**: **`minHeight` 200**, **`padding` 28**, **`cornerRadius` 16**, stroke **`color/border/subtle`**, fill **`color/background/variant`** |
| Theme swatch previews | **88×88px** minimum, **`cornerRadius` 12**; **`Doc/Caption`** for Light / Dark |
| Primitives ramp cards | **120×160** cards (**`VERTICAL`** stacks, **`AUTO`** height), **`itemSpacing` 12** between cards; swatch fill bound per § **D** |
| Layer naming | Token Overview: `token-overview/{section}`, `_PageContent`; Theme preview wrappers: `doc/theme-preview/light` / `dark`; style guide: **`doc/…`** prefix (e.g. `doc/primitives/ramp-row/primary`, `doc/theme/card-row-1`, `doc/table/{slug}/…`) |

**Reference quality (browse for tone — do not copy trademarks):** [Shopify Polaris — tokens](https://polaris.shopify.com/tokens), [Material Design 3 — foundations](https://m3.material.io/foundations), [Carbon — color tokens](https://carbondesignsystem.com/elements/color/tokens), [Atlassian Design — tokens](https://atlassian.design/foundations/tokens), [Supernova — documenting design tokens](https://supernova.io/blog/documenting-design-tokens-a-guide-to-best-practices-with-supernova). Target **clear hierarchy**, **generous whitespace**, and **consistent card chrome** — not dense “spreadsheet only” layouts.

**Documentation type ramp** (create/update local **Text styles** in Step 15c before drawing pages that need them):

| Style name | Role | Typical binding / source |
|---|---|---|
| `Doc/Section` | Semantic group strips + page section titles | Prefer **`setBoundVariable`** to **`Headline/LG/font-size`**, **`Headline/LG/font-family`**, **`Headline/LG/font-weight`**, **`Headline/LG/line-height`** (Typography · mode **100**). Strip text fill → **`color/neutral/50`** (Primitives); on light cards use **`color/background/content`**. |
| `Doc/TokenName` | Token path on cards, TOKEN column emphasis | Bind to **`Label/LG/font-size`** (and matching family/weight/line) or **`Headline/SM/*`** Typography vars at mode **100**; **16–18px** effective minimum. |
| `Doc/Code` | WEB / ANDROID / iOS code lines, dense table cells | Bind to **`Label/SM/font-size`** (and matching family/weight/line) at mode **100**; **13–14px** mono; **line-height ≥ 1.45**. |
| `Doc/Caption` | “Light” / “Dark” labels, helper lines, table column hints | Bind to **`Body/SM/*`** or **`Label/MD/*`** Typography vars at mode **100**; **12–14px**. |

If **`Doc/*`** styles cannot bind (API limits), set resolved values from Typography mode **100** once, then still prefer variable-bound **fills** on chrome.

### B — Doc reading mode (Theme)

- **Light** mode values drive **documentation chrome** fills and strokes on canvas (predictable contrast). Swatches that **demonstrate** Light vs Dark use **explicit Theme mode** on wrapper frames (see § **Token demonstration**).
- Resolve hex via **this file’s** variables (REST snapshot from Step 11 or live `variables/local` in plugin) — never use a hard-coded brand hex for surfaces.

### C — Token binding map (documentation chrome → variable path)

Apply via Figma **variable bindings** on frame `fills` / `strokes` and text `fillStyleId` / bound variables **where the Plugin API supports it** (`setBoundVariable` / variable-bound paints). If binding is not available in the execution environment, apply the **resolved value from this file’s** variable for the same path (still per-system). **Never** use a fixed hex palette copied from another product.

| Doc role | Variable | Collection / mode |
|---|---|---|
| Page / outer body background under sections | `color/background/default` | Theme · Light |
| Section card surface | `color/background/variant` | Theme · Light |
| Section card stroke | `color/border/subtle` | Theme · Light |
| Primary heading text on light surfaces | `color/background/content` | Theme · Light |
| Secondary / metadata text | `color/background/content-muted` | Theme · Light |
| Style guide section label strip background | `color/neutral/950` | Primitives · Default |
| Style guide section label strip text | `color/neutral/50` | Primitives · Default |
| Divider lines (e.g. Text Styles row separator) | `color/border/subtle` | Theme · Light |
| Accent fills (small diagram boxes, highlights) | `color/primary/subtle` | Theme · Light |
| Layout bar fill (spacing preview bars) | `color/primary/200` | Primitives · Default |
| Radius preview square fill | `color/neutral/100` | Primitives · Default |
| Effects preview card fill | `color/background/default` | Theme · Light |
| Effects preview card stroke | `color/border/subtle` | Theme · Light |

**Typography:** After **`Doc/*`** and **slot text styles** exist (Step 15c), **all** style guide headings, token names, code, and table body text must use **`textStyleId`** pointing at those styles — not one-off Inter with arbitrary sizes.

**Fallback:** if a path is missing, log a warning and resolve `color/neutral/200` / `color/neutral/800` from **this file’s** Primitives only.

### D — Token demonstration (Dev Mode inspect)

Layers that **represent** a token’s value must expose that token in **Dev Mode → Variables**, not only a matching hex.

| Surface | Binding rule |
|---|---|
| **Primitives** color ramp card fill | Bind **`boundVariables.color`** on the solid paint to the **Primitives** variable for `color/{ramp}/{stop}` (same path as the label). |
| **Theme** color swatch | Bind paint to the **Theme** variable for that semantic path (e.g. `color/background/default`). To show **Light and Dark** side‑by‑side **while both stay bound to the same variable**: wrap each swatch in a frame and call **`wrapper.setExplicitVariableModeForCollection(themeCollection, lightModeId)`** (and parallel for **Dark**) — **Light** wrapper → Theme collection’s **Light** `modeId`, **Dark** wrapper → **Dark** `modeId` (`ExplicitVariableModesMixin` on frames). Inner rectangle fill uses **`boundVariables.color` → `figma.variables.createVariableAlias(themeVariable)`**. **Hex-label caveat:** the accompanying hex text must be a **sibling** of the mode-scoped wrapper, **not a child** — otherwise its own text fill (bound to `color/background/content`) resolves inside the Dark wrapper to white and disappears on the white cell background. Keep chip **inside** the wrapper, hex **outside** it (see § **H.4**). If the API is unavailable or throws, **fallback:** bind **one** swatch only + print the other mode’s resolved hex as text + log `Theme dual-preview: explicit mode unsupported — single bound swatch + hex fallback`. |
| **Layout** spacing bars | Bind **`width`** / **`minWidth`** to the **`space/*`** Layout variable where `setBoundVariable` accepts it; else resolved px + label. |
| **Typography** specimen | **`textStyleId`** → published **`Display/LG`** … styles whose fields bind to Typography variables (below). |

### E — Auto-layout and text sizing (**mandatory — prevents ~10px collapsed frames**)

Broken style guides often show **empty or 10px-tall** sections because frames stayed at **default size** or text did not participate in auto-layout height.

| Rule | Requirement |
|---|---|
| Hug contents | Any **`VERTICAL`** frame that stacks children with **variable height** MUST use **`primaryAxisSizingMode = 'AUTO'`** (Plugin API) so the frame **grows with its children**. Do **not** leave the default **100×100** box or call **`resize(w, 10)`** / **`resize(w, h)`** with a **tiny `h`** as a placeholder. |
| Width vs height | Typical pattern: **`counterAxisSizingMode = 'FIXED'`** + explicit **`resize(1640, …)`** only when height is irrelevant because **AUTO** will expand; if you must `resize` before children exist, set height to something **≥ 200** temporarily, then rely on **AUTO** after children append, or **`resizeWithoutConstraints`** where supported. |
| Text auto-resize | Immediately after assigning **`text.characters`**, set **`text.textAutoResize = 'HEIGHT'`** (fixed width) or **`'WIDTH_AND_HEIGHT'`** so the text node reports a **real bounding height**. **`'NONE'`** (default in many scripts) often yields **~10px** layout contribution inside auto-layout — **this is the most common bug**. |
| Child alignment | Use **`layoutAlign = 'STRETCH'`** on children that should fill the section width (token cards, strips). For **fixed-width** specimens (swatches), use **`MIN`** / center on cross axis as needed. |
| Row grouping | **Never** place dozens of nodes as **direct siblings** under a wide parent without a **row** frame. Each **logical row** (one ramp’s swatches, one Theme **pair** of cards, one Layout token, one Typography specimen row, one style-guide table line) = **one** auto-layout frame (`doc/.../row-*`) so **`itemSpacing`**, **`padding`**, and **`STRETCH`** apply predictably. |

### F — Row-grouping hierarchy (examples; use the same idea on every page)

| Page | Parent chain (all auto-layout; all vertical stacks **`primaryAxisSizingMode: AUTO`**) |
|---|---|
| **↳ Primitives** | `_PageContent` → `doc/primitives/section/{ramp}` (**VERTICAL**) → strip (fixed **64** height) → `doc/primitives/ramp-row/{ramp}` (**HORIZONTAL**, `AUTO` height) → **11 ×** `doc/primitives/card/{ramp}-{stop}` (**VERTICAL** per card: swatch rect + text stack). Space / Corner / Typeface: `_PageContent` → `doc/primitives/section/space` → **`doc/primitives/space-rows`** (**VERTICAL**) → one **`doc/primitives/space-row/{token}`** (**HORIZONTAL**) per token. |
| **↳ Theme** | `_PageContent` → `doc/theme/group/{semanticGroup}` (**VERTICAL**) → strip → `doc/theme/group-grid` (**VERTICAL**) → **`doc/theme/card-row-{n}`** (**HORIZONTAL**, exactly **two** cards) → `doc/theme/card/{path}` (**VERTICAL** per card). |
| **↳ Layout** | `_PageContent` → `doc/layout/section/{spacing-or-radius}` (**VERTICAL**) → `doc/layout/rows` (**VERTICAL**) → **`doc/layout/row/{token}`** (**HORIZONTAL**) per token. |
| **↳ Text Styles** | `_PageContent` → `doc/typography/rows` (**VERTICAL**) → **`doc/typography/row/{slot}`** (**HORIZONTAL**) per slot. |
| **↳ Effects** | `_PageContent` → `doc/effects/grid` (**VERTICAL** or **HORIZONTAL** wrap) → **`doc/effects/card/{tier}`** (**VERTICAL** per tier). |

### G — Premium visual language (**sleek · modern · editorial**)

§ **G** builds on § **A–F**. The guides should feel like **shipping product documentation** (Polaris / Carbon / **Storybook** docs tone): confident spacing, restrained color, crisp type — not a dense internal spreadsheet.

| Pillar | Do this |
|---|---|
| **Restraint** | Let **neutral surfaces** carry the layout. Use **`color/primary/subtle`** only for **small** highlights (one accent zone per section — e.g. spacing bar fill, a single “focus” chip). Avoid multicolor decorative frames. |
| **Depth (subtle)** | Elevate **Theme token cards**, **Effects** tier cards, and outer **style-guide table** frames (`doc/table/{slug}`) with **`effectStyleId` → `Effect/shadow-sm`** (or one restrained **`DROP_SHADOW`** from **`shadow/color`** + **`shadow/sm/blur`** at Effects · Light) so surfaces **float slightly** — **one** shadow recipe sitewide, low opacity. **Optional:** the same on the outer **`doc/primitives/section/{ramp}`** wrapper (whole ramp), **never** on every small swatch. **Ordering:** `Effect/shadow-sm` is created in **Step 15c §0** — Steps **15a–15b** run **before** that in the default checklist, so on **first** run **skip** `effectStyleId` on Primitives/Theme unless the agent publishes effect styles **earlier in the same combined `use_figma` script`** or the designer **re-runs** 15a–15b after 15c once. Do not stack multiple shadows. |
| **Geometry** | Prefer **one radius scale** on docs: strips and outer panels **16**, inner swatches and chips **12**, large hero cards (Effects) **20–24**. Keep **parallel edges** aligned across a section (card grids share the same left/right margins). |
| **Typography** | Strictly **`Doc/*`** text styles (**§ A**). Section strips: title + optional **`Doc/Caption`** subtitle (one line: what this group is *for*). On **light** cards, titles **`color/background/content`**, metadata **`color/background/content-muted`** — clear **title / body / code** tiers. |
| **Whitespace** | Bias toward **more** padding inside cards (**28–32px**) and **48–64px** between major bands. Dense style-guide tables still use **row `minHeight` 56** + **16px** horizontal cell padding — never cram text to the cell edge. |
| **Swatches** | Color squares **fully fill** their frame corners (same radius as frame or slightly less with **2–4px** inner “mat” using **`color/background/default`** if you want a gallery inset). Theme Light/Dark previews use **identical** geometry side-by-side so comparison feels **controlled**. |
| **Motion / craft** | No literal motion in static Figma — imply quality through **alignment**, **consistent naming**, and **pixel-perfect spacing** on the **8px** grid. After layout, **one pass**: nudge any off-grid `itemSpacing` / `padding` to multiples of **4** (prefer **8**). |

**Anti-patterns (never):** rainbow gradient backgrounds on doc chrome; **3+** stroke weights in one card; arbitrary Inter sizes; **#000000` / `#FFFFFF`** detached fills on chrome when the Theme/Primitives variable exists; clip content that should hug height.

---

### H — Table format spec

§ **H** is the **single source of truth** for every data table drawn on `↳ Primitives`, `↳ Theme`, `↳ Layout`, `↳ Text Styles`, and `↳ Effects`. Tables replace the dense, clipped single-stack rendering from earlier iterations. Reference quality for tone: [Ant Design — Base Color Palettes](https://ant.design/docs/spec/colors) (clean per-group tables, 54px rows, swatch chip + hex + code, one table per logical group). Do **not** copy trademarks — this spec maps the *pattern*, not the paint.

Every table on every page uses the **same component geometry and token bindings**. Only the column definitions change per page (see **§ H.3** below).

#### H.1 — Table component hierarchy

Every table is built from this **exact** parent chain. No orphan cells, no direct-child rows on `_PageContent`.

```
_PageContent                                       VERTICAL · AUTO · FIXED · width 1800 · padding 80 all sides · fill #FFFFFF · x=0 y=320
└── doc/table-group/{slug}                         VERTICAL · AUTO · STRETCH · itemSpacing 12
    ├── doc/table-group/{slug}/title               TEXT · Doc/Section · fill color/background/content
    ├── doc/table-group/{slug}/caption             TEXT · Doc/Caption · fill color/background/content-muted  (optional, 1 line)
    └── doc/table/{slug}                           VERTICAL · AUTO · STRETCH · cornerRadius 16 · clipsContent
        │                                          stroke 1 color/border/subtle · fill color/background/default
        │                                          effectStyleId Effect/shadow-sm (when published — § G Depth)
        ├── doc/table/{slug}/header                HORIZONTAL · FIXED height 56 · STRETCH · fill color/background/variant
        │                                          bottom 1px stroke color/border/subtle
        │   └── doc/table/{slug}/header/cell/{col} FIXED width per § H.3 · paddingH 20 · cross-axis CENTER
        │       └── TEXT · Doc/Code (uppercase, tracking +0.04em) · fill color/background/content-muted
        └── doc/table/{slug}/body                  VERTICAL · AUTO · STRETCH
            └── doc/table/{slug}/row/{tokenPath}   HORIZONTAL · FIXED width 1640 · AUTO height · minHeight 64
                │                                  paddingV 16 · paddingH 0 · bottom 1px stroke color/border/subtle
                │                                  counterAxisAlignItems CENTER (so swatch + text cells align vertically)
                │                                  (omit bottom stroke on the last child)
                └── doc/table/{slug}/row/.../cell/{col}  VERTICAL (default) or HORIZONTAL (Theme LIGHT/DARK) · AUTO height · FIXED width per § H.3
                    │                              paddingH 20 · paddingV 4 · itemSpacing 4 · cross-axis CENTER
                    └── cell content — see § H.4 cell patterns
```

**Slug convention** (`{slug}` = stable per table for Dev Mode lookups):

| Page | `{slug}` values |
|---|---|
| ↳ Primitives | `primitives/color/{ramp}`, `primitives/space`, `primitives/radius`, `primitives/elevation`, `primitives/typeface` |
| ↳ Theme | `theme/background`, `theme/border`, `theme/primary`, `theme/secondary`, `theme/tertiary`, `theme/error`, `theme/component` |
| ↳ Layout | `layout/spacing`, `layout/radius` |
| ↳ Text Styles | `typography/styles` |
| ↳ Effects | `effects/shadows`, `effects/color` |

Row naming inside the body: **full token path** (e.g. `doc/table/primitives/color/primary/row/color/primary/500`). This lets agents address a row by name in follow-up scripts.

#### H.2 — Auto-layout rules (prevents the 10px-collapse bug)

These rules are **mandatory** on every frame inside a table. Failing any one of them produces the clipped, overflowed table seen in prior runs (see [reference comparison](https://www.figma.com/design/BLcvn6UptGIgtNzNfLU4TU/testingUpdates-%E2%80%94-Foundations?node-id=187-7) vs [Ant Design — Base Color Palettes](https://www.figma.com/design/BLcvn6UptGIgtNzNfLU4TU/testingUpdates-%E2%80%94-Foundations?node-id=179-4217)).

| Frame | `layoutMode` | `primaryAxisSizingMode` | `counterAxisSizingMode` | `layoutAlign` | Notes |
|---|---|---|---|---|---|
| `doc/table/{slug}` | `VERTICAL` | `AUTO` | `FIXED` | `STRETCH` | Call `resizeWithoutConstraints(1640, 1)` after creation; AUTO expands height when header + body are appended. |
| `doc/table/{slug}/header` | `HORIZONTAL` | `FIXED` (height **56**) | `FIXED` (width **1640**) | `STRETCH` | Set `resize(1640, 56)` **after** creation, **before** appending cells. `counterAxisAlignItems: CENTER`. |
| `doc/table/{slug}/header/cell/{col}` | `HORIZONTAL` | `FIXED` (height **56**) | `FIXED` (width = column width) | `INHERIT` | Call `resize(colWidth, 56)` before appending text. `paddingLeft/paddingRight: 20`, `counterAxisAlignItems: CENTER`. |
| `doc/table/{slug}/body` | `VERTICAL` | `AUTO` | `FIXED` (width **1640**) | `STRETCH` | |
| `doc/table/{slug}/row/*` | `HORIZONTAL` | `FIXED` (width **1640**) | `AUTO` | `STRETCH` | `minHeight` **64**, `paddingTop/paddingBottom: 16`, `counterAxisAlignItems: CENTER` (vertically centers mixed-height cells — swatch cells are taller than mono-text cells and this is the single knob that keeps rows feeling aligned rather than crowded). Height hugs tallest cell. |
| `doc/table/{slug}/row/*/cell/{col}` | `VERTICAL` (default) or `HORIZONTAL` (Theme `LIGHT`/`DARK`) | `AUTO` | `FIXED` (width = column width) | `INHERIT` | Call `resize(colWidth, 1)` before appending content; AUTO grows. **Padding:** `paddingLeft/paddingRight: 20`, `paddingTop/paddingBottom: 4`, `itemSpacing: 4`. Vertical cells: `primaryAxisAlignItems: CENTER`, `counterAxisAlignItems: MIN`. |
| Cell text nodes | — | — | — | — | **Immediately after `text.characters`:** `text.resize(colWidth - 40, 1)` (account for 20px L + 20px R padding) then `text.textAutoResize = 'HEIGHT'`. Never leave `'NONE'` — that is the **root cause** of the 10px collapse. |
| Cell inline wrappers (swatch chip + hex) | `HORIZONTAL` | `AUTO` | `AUTO` | `INHERIT` | `itemSpacing` **10**, `counterAxisAlignItems: CENTER`. See § H.4 **Theme** swatch entry — wrappers hold the **chip only**; hex text is a **sibling** in the cell. |

**Never** `resize(w, h)` with `h < 20` as a scaffold — rely on `AUTO` for every height that depends on children.

#### H.3 — Column specs per page

All widths in pixels. Totals equal **1640** exactly (1800 page width − 80 + 80 `_PageContent` padding) so left/right edges align across every table on the page.

**↳ Primitives**

One table **per color ramp** (`primary`, `secondary`, `tertiary`, `error`, `neutral`). Group title = ramp name ("Primary"). Rows = 11 stops (50 → 950).

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TOKEN` | 320 | `Doc/Code` — path (`color/primary/500`) |
| 2 | `SWATCH` | 96 | 48×48 rounded-rect · cornerRadius 10 · stroke 1 `color/border/subtle` · fill bound to the row's Primitives variable (§ D) |
| 3 | `HEX` | 120 | `Doc/Code` — uppercase hex |
| 4 | `WEB` | 360 | `Doc/Code` — `var(--color-primary-500)` |
| 5 | `ANDROID` | 340 | `Doc/Code` |
| 6 | `iOS` | 404 | `Doc/Code` |

One table each for **Space**, **Corner Radius**, **Elevation**, **Typeface**:

| Slug | Col widths (sum 1640) |
|---|---|
| `primitives/space` | `TOKEN` 260 · `VALUE` 100 · `PREVIEW` 260 · `WEB` 340 · `ANDROID` 320 · `iOS` 360 |
| `primitives/radius` | `TOKEN` 260 · `VALUE` 100 · `PREVIEW` 260 · `WEB` 340 · `ANDROID` 320 · `iOS` 360 |
| `primitives/elevation` | `TOKEN` 260 · `VALUE` 100 · `WEB` 400 · `ANDROID` 380 · `iOS` 500 |
| `primitives/typeface` | `TOKEN` 320 · `SPECIMEN` 460 · `VALUE` 200 · `WEB` 320 · `ANDROID` 160 · `iOS` 180 |

- **Space `PREVIEW`:** HORIZONTAL cell with a bar `height 16`, `cornerRadius 4`, fill `color/primary/200` (bound); `width` bound to the `Space/*` variable where `setBoundVariable` accepts it, else resolved px clamped to 200.
- **Radius `PREVIEW`:** 64×64 square, fill `color/neutral/100`, stroke `color/border/subtle`; `cornerRadius` bound to the `Corner/*` variable.
- **Typeface `SPECIMEN`:** single-line text `"The quick brown fox jumps over 1234567890"` at 24px using the typeface primitive (bound `fontName` when supported).

**↳ Theme**

One table **per semantic group** (`background`, `border`, `primary`, `secondary`, `tertiary`, `error`, `component`). Group title = group name (e.g. "Background"); caption = 1-line role summary (e.g. "Surfaces, containers, scrims").

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TOKEN` | 320 | `Doc/Code` — Figma path. Wide enough for `color/background/container-lowest` without wrapping. |
| 2 | `LIGHT` | 140 | Cell (HORIZONTAL, AUTO) with two siblings per § H.4 **Theme** swatch pattern: (a) mode-scoped wrapper `doc/theme-preview/light` containing **only** the 28×28 chip (bound Theme var), (b) `Doc/Code` hex text **outside** the wrapper so its content-color fill resolves in Light. `itemSpacing 10`, `counterAxisAlignItems CENTER`. |
| 3 | `DARK` | 140 | Same structure as LIGHT, but the mode-scoped wrapper uses the Dark mode id. **Hex text stays outside** the wrapper — never a child of the Dark-scoped frame, or it resolves white on white. |
| 4 | `ALIAS →` | 260 | `Doc/Code` — resolved alias path (e.g. `color/primary/500` · `color/primary/400`); show both modes separated by ` · ` when they differ. Width tuned so the widest aliases (`color/neutral/100 · color/neutral/950`) stay on **one line** at Doc/Code 13px mono. |
| 5 | `WEB` | 320 | `Doc/Code` — wide enough for `var(--color-background-container-lowest)` without wrapping. |
| 6 | `ANDROID` | 220 | `Doc/Code` — fits `surface-container-lowest` without truncation. |
| 7 | `iOS` | 240 | `Doc/Code` — fully dot-separated paths can be long (e.g. `.Status.on.error.fixed.muted`); this width keeps the worst-case 5-segment compounds on **one line** at Doc/Code 13px mono. |

**Sum:** 320 + 140 + 140 + 260 + 320 + 220 + 240 = **1640**. **Row spacing rules for Theme specifically:** row `minHeight 64`, `paddingV 16`, `counterAxisAlignItems: CENTER` (the chip cells are 44px tall, the text cells are ~20px tall — centering is what makes the label and chip + hex read as aligned rather than top-stacked). Cell `paddingH 20` applies uniformly to all 7 cells, including the LIGHT/DARK swatch cells — the previous 16px padding was the subtle crowding source.

Fallback when `setExplicitVariableModeForCollection` is unavailable: bind the LIGHT chip only, print the Dark hex as `Doc/Caption` text below the chip, and log `Theme dual-preview: explicit mode unsupported`.

**↳ Layout**

Two tables: `layout/spacing`, `layout/radius`.

| Col | Header | Width |
|---|---|---|
| 1 | `TOKEN` | 280 |
| 2 | `VALUE` | 100 |
| 3 | `ALIAS →` | 280 |
| 4 | `PREVIEW` | 240 |
| 5 | `WEB` | 320 |
| 6 | `ANDROID` | 220 |
| 7 | `iOS` | 200 |

**Sum:** 280 + 100 + 280 + 240 + 320 + 220 + 200 = **1640**.

- `spacing` `PREVIEW`: bar identical to Primitives Space preview (bound width).
- `radius` `PREVIEW`: 64×64 square with bound `cornerRadius`.

**↳ Text Styles**

Single table `typography/styles`. Rows appear in extended slot order (Display LG → Label SM). Each Body size emits a 5-row block — `Body/{size}/regular`, `Body/{size}/emphasis`, `Body/{size}/italic`, `Body/{size}/link`, `Body/{size}/strikethrough` — keeping the `Body/{size}/` text-style folder (§ 8 step 2) intact in the table as well. Total = 3 + 3 + 3 + 15 + 3 = **27 specimen rows**. Category dividers use **full-width sub-header rows** (single HORIZONTAL cell spanning 1640, fill `color/background/variant`, text `Doc/Caption` uppercase: "Display", "Headline", "Title", "Body", "Label").

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `SLOT` | 220 | `Doc/TokenName` — slot name (`Headline/LG`, `Body/LG/strikethrough`). Widened so 3-segment body-variant paths stay on one line. |
| 2 | `SPECIMEN` | 360 | TEXT with `textStyleId` → published slot style; characters = the slot name itself ("Headline LG"); `textAutoResize = 'HEIGHT'` with width resized to 320 (360 − 40). Display/LG rows wrap to two lines at this width, which is acceptable for the largest sizes. |
| 3 | `SIZE / LINE` | 140 | VERTICAL stack — two `Doc/Code` lines: `{size}px` / `{lineHeight}px` |
| 4 | `WEIGHT / FAMILY` | 180 | VERTICAL stack — two `Doc/Code` lines: `{weight}` / `{family}` |
| 5 | `WEB` | 280 | `Doc/Code` single line — `--{slot}-font-size` pattern; fits `var(--body-lg-strikethrough-font-family)` (longest) on one line. |
| 6 | `ANDROID` | 200 | `Doc/Code` — fits `body-lg-strikethrough-font-family` without wrapping. |
| 7 | `iOS` | 260 | `Doc/Code` — 5- or 6-segment dot path (e.g. `.Typography.body.lg.strikethrough.font.family`) may soft-wrap to two lines at the widest slot; all other slots fit on one line. |

**Sum:** 220 + 360 + 140 + 180 + 280 + 200 + 260 = **1640**.

Row `minHeight` is determined by the specimen — `primaryAxisSizingMode: AUTO` on every row and cell ensures Display/LG rows (96px specimen) grow naturally while Label/SM rows stay compact.

**↳ Effects**

Two tables: `effects/shadows` (5 tier rows) and `effects/color` (1 row — shadow/color).

`effects/shadows` (**sum 1640**):

| Col | Header | Width | Cell pattern |
|---|---|---|---|
| 1 | `TIER` | 140 | `Doc/TokenName` — `sm` / `md` / `lg` / `xl` / `2xl` |
| 2 | `LIGHT` | 180 | `doc/effect-preview/light/{tier}` wrapper with explicit Effects Light mode → 88×88 card `cornerRadius 12` fill `color/background/default` `effectStyleId Effect/shadow-{tier}` |
| 3 | `DARK` | 180 | Same with Effects Dark mode |
| 4 | `BLUR` | 120 | `Doc/Code` — blur value |
| 5 | `ALIAS →` | 200 | `Doc/Code` — `elevation/{step}` |
| 6 | `WEB` | 300 | `Doc/Code` |
| 7 | `ANDROID` | 260 | `Doc/Code` |
| 8 | `iOS` | 260 | `Doc/Code` |

`effects/color` (**sum 1640**):

| Col | Header | Width |
|---|---|---|
| `TOKEN` | 320 |
| `LIGHT` | 180 |
| `DARK` | 180 |
| `VALUE` | 220 |
| `WEB` | 320 |
| `ANDROID` | 220 |
| `iOS` | 200 |

#### H.4 — Cell content patterns

Cells are always a **VERTICAL AUTO** stack so multi-line cells (Theme LIGHT/DARK, Typography SIZE/LINE) grow without collapsing the row. Use these patterns exactly:

| Pattern | Structure |
|---|---|
| **Mono line** (TOKEN, HEX, WEB, ANDROID, iOS, VALUE) | One `Doc/Code` text node. `text.resize(colWidth - 32, 1)` → `textAutoResize = 'HEIGHT'`. |
| **Swatch chip + hex — Primitives** (`SWATCH` + `HEX` combined) | HORIZONTAL wrapper · itemSpacing 10 · cross-axis CENTER · children: [rounded-rect 28×28 cornerRadius 8 stroke 1 `color/border/subtle` fill bound to variable] + [`Doc/Code` hex text, fill `color/background/content`]. |
| **Swatch chip + hex — Theme** (`LIGHT`/`DARK`) | **Structure matters here — this is the #1 dark-mode bug** (hex invisible on dark side). The cell is a HORIZONTAL outer wrapper with **two siblings**: [1] a **mode-scoped inner wrapper** `doc/theme-preview/{mode}` that calls `setExplicitVariableModeForCollection(themeCollection, modeId)` and contains **only** the 28×28 chip rect (bound fill → Theme variable), and [2] a `Doc/Code` hex text node **outside** that wrapper. The hex text's fill binds to `color/background/content` — which **must** resolve in the page's normal mode (Light), not the wrapper's scoped mode. If you place the hex inside the Dark wrapper, its fill resolves to white on the white cell and disappears. Layer tree: `cell (HORIZONTAL, AUTO) → [doc/theme-preview/{mode} (mode-scoped, chip only)] + [doc/code text (hex, sibling)]`. |
| **Preview bar** (Space, Layout spacing) | HORIZONTAL wrapper · cross-axis CENTER · single rectangle height 16 cornerRadius 4 fill `color/primary/200` (bound); width bound to variable (or resolved px). |
| **Preview square** (Radius) | HORIZONTAL wrapper · single 64×64 rect fill `color/neutral/100` stroke `color/border/subtle` cornerRadius bound to variable. |
| **Two-line meta** (Typography SIZE/LINE, WEIGHT/FAMILY) | VERTICAL stack · itemSpacing 4 · two `Doc/Code` text nodes; the second line may use `color/background/content-muted` fill for visual hierarchy. |
| **Category sub-header row** (Text Styles only) | Single row frame width 1640 minHeight 40 fill `color/background/variant`; single cell paddingH 24 with `Doc/Caption` uppercase text, letter-spacing +0.08em. |
| **Alias →** | `Doc/Code` text, color `color/background/content-muted`, prefixed with `↳ ` (U+21B3) when the alias resolves to a primitive; `— (raw)` when the value is a hard-coded literal. |

#### H.5 — Token binding map (table chrome → variable)

Extends § C. Every chrome element below **must** use `setBoundVariable` / variable-bound paints. Fallback to resolved values from **this file's** variables only when the API refuses.

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
| Swatch chip fill | The row's own variable (Primitives or Theme) | per row (§ D) |
| Radius preview square fill | `color/neutral/100` | Primitives |
| Radius preview square stroke | `color/border/subtle` | Theme · Light |
| Spacing preview bar fill | `color/primary/200` | Primitives |
| Effects preview card fill | `color/background/default` | Theme · Light |
| Category sub-header row fill | `color/background/variant` | Theme · Light |

#### H.6 — Text-style usage (mandatory)

Once Step 15c publishes the **`Doc/*`** styles, every cell and header text node MUST assign `textStyleId` — never raw `fontName`/`fontSize` on table bodies. On the **first** run (before 15c has published styles), fall back to literal values matching the § A ramp but log a warning and re-run 15a–15b after 15c to upgrade. This is the single gating rule that makes the tables feel like shipping product documentation rather than a dump.

#### H.7 — Build-order checklist (applies to every table in every Step 15a–15c script)

1. **Create** `doc/table/{slug}` → set `layoutMode`, both sizing modes, `layoutAlign`, radius, clipping, fill+stroke bindings. `resizeWithoutConstraints(1640, 1)`. Do not call `resize(1640, 10)` — AUTO will expand.
2. **Create** `doc/table/{slug}/header` → `resize(1640, 56)` → append cells in column order; each cell `resize(colWidth, 56)` **before** appending its text node.
3. **Create** `doc/table/{slug}/body` → do **not** resize; STRETCH + AUTO handles it.
4. For each data row: **create** the row frame → `resize(1640, 1)` → set `minHeight 64`, `paddingTop/paddingBottom 16`, `counterAxisAlignItems: CENTER` → append cells (each cell `resize(colWidth, 1)` before appending content, with `paddingLeft/paddingRight 20`).
5. For each text node: set `characters` → `resize(textWidth, 1)` → `textAutoResize = 'HEIGHT'` → assign `textStyleId` (or fallback literals) → bind fill.
6. After all rows are appended, remove the bottom stroke from the last row (`row.strokes = []` or set `strokeBottomWeight = 0`) so the outer `clipsContent` radius reads clean.
7. Apply `effectStyleId` to the outer `doc/table/{slug}` frame **only** if `Effect/shadow-sm` already exists in the file (Step 15c § 0 publishes it; earlier steps may skip — see § G Depth).

Any legacy instruction in Steps 15a–15c that conflicts with § **H** is superseded; § **H** wins for tables.

---
