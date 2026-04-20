
## Canvas documentation visual spec

Agents **must read this section** before executing Steps **15a–18** and any **`use_figma`** work that draws token documentation. **`/sync-design-system`** Steps **9b–9e** must follow the **same** structure, binding, and Dev Mode rules (**§ A–G**; see [`../../sync-design-system/SKILL.md`](../../sync-design-system/SKILL.md)).

**How that code runs:** only via the **`use_figma` MCP tool** — inline `code` strings per call. Do **not** add throwaway workspace files (`.mcp-*`, `*-payload.json`, scratch `.js`, etc.) to hold or transport that script; see [`./07-steps15a-15c.md`](./07-steps15a-15c.md) § *Agent-driven only — no workspace scripts*.

> **Precedence:** Table geometry, column widths, cell patterns, chrome → variable bindings, auto-layout sizing rules, and build order are authoritative in the **conventions shards** — §0 in [`../SKILL.md`](../SKILL.md) and [`../conventions/03-through-07-geometry-and-doc-styles.md`](../conventions/03-through-07-geometry-and-doc-styles.md), [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md), [`../conventions/10-column-spec.md`](../conventions/10-column-spec.md), [`../conventions/column-widths.json`](../conventions/column-widths.json), [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md). This spec is authoritative for **visual language only** (tone, whitespace, depth, anti-patterns). When a rule in this file disagrees with those conventions, **the conventions win**.
>
> **Auto-layout vocabulary used throughout:** **Hug** (frame fits its children) = Plugin API `primaryAxisSizingMode`/`counterAxisSizingMode = 'AUTO'`. **Fixed** (pinned dimension) = `= 'FIXED'`. **Fill** (frame expands to fill its parent) = `layoutGrow = 1` on the primary axis, or `layoutAlign = 'STRETCH'` on the counter axis (`STRETCH` is the legacy API name — the Figma UI calls this "Fill container").

### A — Structure (geometry, naming; stable across all files)

| Rule | Value |
|---|---|
| Page canvas width | **1800px** — pages sit on a 1800px canvas column that the `_Header` and `_PageContent` frames both span. |
| `_Header` component | Every page's `_Header` instance: **`layoutMode: VERTICAL`** (auto-layout, **not** `NONE`), **Fixed height 320**, **Fixed width 1800** (resize every existing instance to 1800 so it lines up with `_PageContent`), **`cornerRadius: 0`** (the square bottom edge lets `_PageContent` butt directly against it for a clean seam — **do not** re-introduce the legacy 24px radius). Internal structure: a horizontal top row (logo 40×40 + "DETROIT LABS" label, `spaceBetween`, height 40) and a vertical `_title` + `_description` stack. Padding `{40, 40, 40, 61}` (L·T·R·B, asymmetric bottom preserves the legacy description baseline). Outer `itemSpacing 60`, title-stack `itemSpacing 23`. |
| `_PageContent` shell | One **`_PageContent`** frame per page, positioned **`x: 0, y: 320`** (directly beneath `_Header` with no gap): **`layoutMode: VERTICAL`**, height **Hug** (`primaryAxisSizingMode: 'AUTO'`), counter-axis **Fixed** (`counterAxisSizingMode: 'FIXED'`) at **width 1800**, **Fill** its parent page width (`layoutAlign: 'STRETCH'`), **padding 80px on all four sides**, **`itemSpacing 48`**, **fill `#FFFFFF` (literal white, not token-bound)**. All sections/tables are children of this shell. Inner content width = **1640** (1800 − 80 − 80) — every `doc/table-group/*` and `doc/table/*` must render at **1640** wide. |
| Vertical rhythm | 8px grid (`itemSpacing` / gaps use multiples of 8); **48px** `itemSpacing` between **major** sections (ramps, Theme groups, style-guide tables). |
| Section frames | Auto-layout **`VERTICAL`**, height **Hug** (`primaryAxisSizingMode: 'AUTO'`), counter-axis **Fixed** (`counterAxisSizingMode: 'FIXED'`), **Fill** the parent width (`layoutAlign: 'STRETCH'`) inside `_PageContent`. |
| Section shell | Inset panels: **`cornerRadius` 16**, stroke **`color/border/subtle`**, **`itemSpacing` 24**; section **fill** **`color/background/default`** (Theme · Light); **token cards** inside use **`color/background/variant`** so panels read as **cards on a calm base** (gallery pattern — see reference links below this table) |
| Section group headers | Full-width strip **1640×64px**; title **`Doc/Section`**; optional **1px** bottom edge via stroke on strip (**`color/border/subtle`**) |
| Theme token grid | **2 columns**: section body stacks **`doc/theme/card-row-{n}`** rows (**§ F**). Each **card**: **`minHeight` 200**, **`padding` 28**, **`cornerRadius` 16**, stroke **`color/border/subtle`**, fill **`color/background/variant`** |
| Theme swatch previews | **88×88px** minimum, **`cornerRadius` 12**; **`Doc/Caption`** for Light / Dark |
| Primitives ramp cards | **120×160** cards (**`VERTICAL`** stacks, height **Hug**), **`itemSpacing` 12** between cards; swatch fill bound per § **D** |
| Layer naming | Token Overview: `token-overview/{section}`, `_PageContent`; Theme preview wrappers: `doc/theme-preview/light` / `dark`; style guide: **`doc/…`** prefix (e.g. `doc/primitives/ramp-row/primary`, `doc/theme/card-row-1`, `doc/table/{slug}/…`) |

**Reference quality (browse for tone — do not copy trademarks):** [Shopify Polaris — tokens](https://polaris.shopify.com/tokens), [Material Design 3 — foundations](https://m3.material.io/foundations), [Carbon — color tokens](https://carbondesignsystem.com/elements/color/tokens), [Atlassian Design — tokens](https://atlassian.design/foundations/tokens), [Supernova — documenting design tokens](https://supernova.io/blog/documenting-design-tokens-a-guide-to-best-practices-with-supernova). Target **clear hierarchy**, **generous whitespace**, and **consistent card chrome** — not dense "spreadsheet only" layouts.

**Documentation type ramp** (create/update local **Text styles** in Step 15c before drawing pages that need them):

| Style name | Role | Typical binding / source |
|---|---|---|
| `Doc/Section` | Semantic group strips + page section titles | Prefer **`setBoundVariable`** to **`Headline/LG/font-size`**, **`Headline/LG/font-family`**, **`Headline/LG/font-weight`**, **`Headline/LG/line-height`** (Typography · mode **100**). Strip text fill → **`color/neutral/50`** (Primitives); on light cards use **`color/background/content`**. |
| `Doc/TokenName` | Token path on cards, TOKEN column emphasis | Bind to **`Label/LG/font-size`** (and matching family/weight/line) or **`Headline/SM/*`** Typography vars at mode **100**; **16–18px** effective minimum. |
| `Doc/Code` | WEB / ANDROID / iOS code lines, dense table cells | Bind to **`Label/SM/font-size`** (and matching family/weight/line) at mode **100**; **13–14px** mono; **line-height ≥ 1.45**. |
| `Doc/Caption` | "Light" / "Dark" labels, helper lines, table column hints | Bind to **`Body/SM/*`** or **`Label/MD/*`** Typography vars at mode **100**; **12–14px**. |

If **`Doc/*`** styles cannot bind (API limits), set resolved values from Typography mode **100** once, then still prefer variable-bound **fills** on chrome.

### B — Doc reading mode (Theme)

- **Light** mode values drive **documentation chrome** fills and strokes on canvas (predictable contrast). Swatches that **demonstrate** Light vs Dark use **explicit Theme mode** on wrapper frames (see § **Token demonstration**).
- Resolve hex via **this file's** variables (REST snapshot from Step 11 or live `variables/local` in plugin) — never use a hard-coded brand hex for surfaces.

### C — Token binding map (documentation chrome → variable path)

Apply via Figma **variable bindings** on frame `fills` / `strokes` and text `fillStyleId` / bound variables **where the Plugin API supports it** (`setBoundVariable` / variable-bound paints). If binding is not available in the execution environment, apply the **resolved value from this file's** variable for the same path (still per-system). **Never** use a fixed hex palette copied from another product.

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

**Fallback:** if a path is missing, log a warning and resolve `color/neutral/200` / `color/neutral/800` from **this file's** Primitives only.

### D — Token demonstration (Dev Mode inspect)

Layers that **represent** a token's value must expose that token in **Dev Mode → Variables**, not only a matching hex.

| Surface | Binding rule |
|---|---|
| **Primitives** color ramp card fill | Bind **`boundVariables.color`** on the solid paint to the **Primitives** variable for `color/{ramp}/{stop}` (same path as the label). |
| **Theme** color swatch | Bind paint to the **Theme** variable for that semantic path (e.g. `color/background/default`). To show **Light and Dark** side-by-side **while both stay bound to the same variable**: wrap each swatch in a frame and call **`wrapper.setExplicitVariableModeForCollection(themeCollection, lightModeId)`** (and parallel for **Dark**) — **Light** wrapper → Theme collection's **Light** `modeId`, **Dark** wrapper → **Dark** `modeId` (`ExplicitVariableModesMixin` on frames). Inner rectangle fill uses **`boundVariables.color` → `figma.variables.createVariableAlias(themeVariable)`**. **Hex-label caveat** — see §0.3 in [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md) (same text in [`../SKILL.md`](../SKILL.md)): the accompanying hex text must be a **sibling** of the mode-scoped wrapper, **not a child**. If the API is unavailable or throws, **fallback:** bind **one** swatch only + print the other mode's resolved hex as text + log `Theme dual-preview: explicit mode unsupported — single bound swatch + hex fallback`. |
| **Layout** spacing bars | Bind **`width`** / **`minWidth`** to the **`space/*`** Layout variable where `setBoundVariable` accepts it; else resolved px + label. |
| **Typography** specimen | **`textStyleId`** → published **`Display/LG`** … styles whose fields bind to Typography variables (below). |

### E — Auto-layout and text sizing (see §0.1 and §0.2 in SKILL / `00-gotchas.md`)

Broken style guides show **empty or 1px-tall rows / cells** or **10px-tall text rows**. Both are covered authoritatively in [`../SKILL.md`](../SKILL.md) (§0) and [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md):

- **§ 0.1 — Row AND cell height stays Fixed at 1 unless the height axis is set to Hug before `resize`.** Applies at both the row level (`doc/table/{slug}/row/*`) and body-cell level (`.../cell/*`). Always set `counterAxisSizingMode: 'AUTO'` on rows and `primaryAxisSizingMode: 'AUTO'` on cells **before** calling `resize(1640, 1)` / `resize(colWidth, 1)`.
- **§ 0.2 — Text nodes contribute ~10px to auto-layout unless `text.textAutoResize = 'HEIGHT'` is set** right after `text.characters`.
- **§ 9 — Full frame sizing table** (including header, body, inline wrappers) lives in [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md) §9.

**Anti-pattern here:** do not place dozens of nodes as direct siblings under a wide parent without a **row** frame. Each logical row (one ramp's swatches, one Theme pair of cards, one Layout token, one Typography specimen row, one style-guide table line) = **one** auto-layout frame (`doc/.../row-*`) so `itemSpacing`, `padding`, and Fill behavior apply predictably.

### F — Row-grouping hierarchy (examples; use the same idea on every page)

| Page | Parent chain (all auto-layout; all vertical stacks height **Hug** / `primaryAxisSizingMode: 'AUTO'`) |
|---|---|
| **↳ Primitives** | `_PageContent` → `doc/primitives/section/{ramp}` (**VERTICAL**) → strip (Fixed **64** height) → `doc/primitives/ramp-row/{ramp}` (**HORIZONTAL**, height **Hug**) → **11 ×** `doc/primitives/card/{ramp}-{stop}` (**VERTICAL** per card: swatch rect + text stack). Space / Corner / Typeface: `_PageContent` → `doc/primitives/section/space` → **`doc/primitives/space-rows`** (**VERTICAL**) → one **`doc/primitives/space-row/{token}`** (**HORIZONTAL**) per token. |
| **↳ Theme** | `_PageContent` → `doc/theme/group/{semanticGroup}` (**VERTICAL**) → strip → `doc/theme/group-grid` (**VERTICAL**) → **`doc/theme/card-row-{n}`** (**HORIZONTAL**, exactly **two** cards) → `doc/theme/card/{path}` (**VERTICAL** per card). |
| **↳ Layout** | `_PageContent` → `doc/layout/section/{spacing-or-radius}` (**VERTICAL**) → `doc/layout/rows` (**VERTICAL**) → **`doc/layout/row/{token}`** (**HORIZONTAL**) per token. |
| **↳ Text Styles** | `_PageContent` → `doc/typography/rows` (**VERTICAL**) → **`doc/typography/row/{slot}`** (**HORIZONTAL**) per slot. |
| **↳ Effects** | `_PageContent` → `doc/effects/grid` (**VERTICAL** or **HORIZONTAL** wrap) → **`doc/effects/card/{tier}`** (**VERTICAL** per tier). |

### G — Premium visual language (**sleek · modern · editorial**)

§ **G** builds on § **A–F**. The guides should feel like **shipping product documentation** (Polaris / Carbon / **Storybook** docs tone): confident spacing, restrained color, crisp type — not a dense internal spreadsheet.

| Pillar | Do this |
|---|---|
| **Restraint** | Let **neutral surfaces** carry the layout. Use **`color/primary/subtle`** only for **small** highlights (one accent zone per section — e.g. spacing bar fill, a single "focus" chip). Avoid multicolor decorative frames. |
| **Depth (subtle)** | Elevate **Theme token cards**, **Effects** tier cards, and outer **style-guide table** frames (`doc/table/{slug}`) with **`effectStyleId` → `Effect/shadow-sm`** (or one restrained **`DROP_SHADOW`** from **`shadow/color`** + **`shadow/sm/blur`** at Effects · Light) so surfaces **float slightly** — **one** shadow recipe sitewide, low opacity. **Ordering:** see **§0.4** in [`../conventions/00-gotchas.md`](../conventions/00-gotchas.md) or [`../SKILL.md`](../SKILL.md) — publish `Effect/shadow-sm` via Step 15c § 0 **before** 15a/15b on first runs. Do not stack multiple shadows. |
| **Geometry** | Prefer **one radius scale** on docs: strips and outer panels **16**, inner swatches and chips **12**, large hero cards (Effects) **20–24**. Keep **parallel edges** aligned across a section (card grids share the same left/right margins). |
| **Typography** | Strictly **`Doc/*`** text styles (**§ A**). Section strips: title + optional **`Doc/Caption`** subtitle (one line: what this group is *for*). On **light** cards, titles **`color/background/content`**, metadata **`color/background/content-muted`** — clear **title / body / code** tiers. |
| **Whitespace** | Bias toward **more** padding inside cards (**28–32px**) and **48–64px** between major bands. Dense style-guide tables still use **row `minHeight` 64** + **20px** horizontal cell padding (per [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md) §11) — never cram text to the cell edge. |
| **Swatches** | Color squares **fully fill** their frame corners (same radius as frame or slightly less with **2–4px** inner "mat" using **`color/background/default`** if you want a gallery inset). Theme Light/Dark previews use **identical** geometry side-by-side so comparison feels **controlled**. |
| **Motion / craft** | No literal motion in static Figma — imply quality through **alignment**, **consistent naming**, and **pixel-perfect spacing** on the **8px** grid. After layout, **one pass**: nudge any off-grid `itemSpacing` / `padding` to multiples of **4** (prefer **8**). |

**Anti-patterns (never):** rainbow gradient backgrounds on doc chrome; **3+** stroke weights in one card; arbitrary Inter sizes; `#000000` / `#FFFFFF` detached fills on chrome when the Theme/Primitives variable exists; clip content that should Hug height.

---

### H — Table format spec → moved

Everything that used to live in § H (table hierarchy, auto-layout rules, column widths per page, cell patterns, chrome → variable binding map, build-order checklist, text-style usage rule) is now authoritative in the **conventions shards** (see [`../CONVENTIONS.md`](../CONVENTIONS.md) router TOC) — notably §0 in [`../SKILL.md`](../SKILL.md), [`../conventions/08-hierarchy-and-09-autolayout.md`](../conventions/08-hierarchy-and-09-autolayout.md), [`../conventions/10-column-spec.md`](../conventions/10-column-spec.md), [`../conventions/11-cells-12-bindings-13-build-order.md`](../conventions/11-cells-12-bindings-13-build-order.md). **Those files win** for any table question. This spec (§ A–G) is authoritative for visual language (tone, whitespace, depth, anti-patterns) only.

---
