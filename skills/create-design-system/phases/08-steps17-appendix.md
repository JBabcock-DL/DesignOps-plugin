
## Step 17 — Populate Token Overview

Follow **Canvas documentation visual spec § A–H** for any new or updated frames/text on this page. The `↳ Token Overview` scaffold already uses the § H table hierarchy and per-box variable bindings — this step's job is to (a) upgrade every doc text node to assign `textStyleId` now that Doc/* styles exist, (b) refresh cell text with **live** `codeSyntax` values, and (c) delete scaffold placeholders.

Navigate to the `↳ Token Overview` page using `figma.setCurrentPageAsync`. The `/new-project` skill's Step 5d drew this page (Figma script: [`../../new-project/phases/05d-token-overview.md`](../../new-project/phases/05d-token-overview.md)) with auto-layout section shells, a proper `doc/table/token-overview/platform-mapping` table per § H, and amber `placeholder/*` notes for each section.

**Pre-pass — upgrade text styles + shadows**

Doc/* text styles and `Effect/shadow-sm` are published in Step 15c § 0. The scaffold wrote raw `fontName`/`fontSize` as a fallback on every doc text node. Now that the styles exist:

1. Load `figma.getLocalTextStylesAsync()` once; cache by name.
2. Traverse the page. For every text node whose parent chain includes `_PageContent`, reassign `textStyleId`:
   - Section titles (children named or authored as `Doc/Section` equivalents — 20px Bold in scaffold) → assign `Doc/Section`.
   - Token-path labels on cards, `TOKEN` cells, command-card titles → `Doc/TokenName`.
   - Header row cells, body cells, tags, small code strings → `Doc/Code`.
   - Captions, helper lines, mode labels, footer notes → `Doc/Caption`.
3. Load `figma.getLocalEffectStylesAsync()`. For every frame whose name starts with `token-overview/` (section shells), `doc/table/token-overview/`, `dark-mode-panel`, or `font-scale-panel` and which does **not** already carry an `effectStyleId`, assign `Effect/shadow-sm`.

Skip a node silently if assignment throws (e.g. a style name differs from the scaffold's fallback). Log one summary line: `Doc/* upgraded · N nodes · shadow-sm applied · M frames`.

**Architecture diagram (Section 1)**

The scaffold created five `arch-box/{name}` frames already bound to the correct variables per collection:

- `arch-box/Primitives` → `color/primary/default` (Theme)
- `arch-box/Theme` → `color/secondary/default` (Theme)
- `arch-box/Typography` / `arch-box/Layout` / `arch-box/Effects` → `color/neutral/800` (Primitives)

Verify each binding resolves to a variable (not just a fallback hex). If the scaffold wrote only a fallback hex (variable was missing at scaffold time), **rebind now** — use `figma.variables.createVariableAlias(variable)` on the fill paint's `boundVariables.color`. Leave sizes, positions, and the `→` arrows unchanged.

**Platform Mapping table (Section 2)**

Locate `doc/table/token-overview/platform-mapping` via `page.findOne(n => n.name === 'doc/table/token-overview/platform-mapping')`. For every row frame named `doc/table/token-overview/platform-mapping/row/{tokenPath}`:

1. Read the row's `{tokenPath}` from the layer name.
2. Look up the variable by that path from the correct collection (Theme for `color/*`, Primitives for raw ramps, Typography for `{Slot}/*/font-size` and similar, Layout for `space/*`/`radius/*`, Effects for `shadow/color`).
3. Read the variable's live `codeSyntax` (set in Step 11). For each of WEB / ANDROID / iOS:
   - Find the cell named `.../row/{tokenPath}/cell/{web|android|ios}`.
   - The cell contains a single text node. If the text content differs from the live `codeSyntax` string, set `text.characters` to the new value.
   - Leave the `token` cell text alone (it already matches the path).
4. If a row's `{tokenPath}` no longer exists as a variable, leave it visible but append ` · stale` to the `token` cell caption so `/sync-design-system` can flag it.

**Minimum row set** — if any of these are absent from the scaffolded table, insert them as new rows using the same § H row pattern before the pre-pass deletes placeholders:

`color/background/default`, `color/background/content`, `color/background/content-muted`, `color/background/variant`, `color/border/default`, `color/border/subtle`, `color/primary/default`, `color/primary/content`, `color/primary/subtle`, `color/secondary/default`, `color/tertiary/default`, `color/error/default`, `color/component/ring`, `Headline/LG/font-size`, `Title/LG/font-size`, `Body/MD/font-size`, `typeface/display`, `space/md`, `space/lg`, `radius/md`, `radius/lg`, `shadow/color`.

Re-apply the "last row has no bottom stroke" rule after any insertion.

**Phone frames (Section 3)**

Find `dark-mode-phone/light` and `dark-mode-phone/dark` (wrappers containing a 220×150 preview rectangle). Verify the phone frame inside each:

- `phone-frame/light` → fill bound to `color/background/default` (resolves Light).
- `phone-frame/dark` → fill bound to `color/neutral/950` (Primitives) so it reads as dark without depending on Theme Dark mode at render time.

If the Plugin API supports per-layer explicit mode (`setExplicitVariableModeForCollection`), you may instead wrap `phone-frame/dark` in a `doc/theme-preview/dark` wrapper and bind its fill to `color/background/default` — matching the § H.4 Theme pattern.

**Typography scale (Section 3, right panel)**

Find each `scale-cell/{mode}` cell. The scaffold set an approximate `fontSize` per mode. If Typography collection modes expose a `Body/LG/font-size` variable at each mode, you may bind the specimen text's `fontSize` via `setBoundVariable('fontSize', ...)` with explicit mode per cell so the row visually tracks live sizes. Otherwise leave the scaffold sizes — they're close enough and Step 17 isn't required to regenerate them.

**Placeholder strips from `/new-project` Step 5d**

Find every node on `↳ Token Overview` whose **name** starts with `placeholder/` (amber "run /create-design-system" notes). Delete each of these nodes after the sections above are updated — they are scaffolding only, not part of the final spec.

If any legacy text node still contains the substring `TBD`, replace `TBD` with the resolved value implied by the nearest section heading or table row; if ambiguous, use the resolved `color/primary/500` hex.

Log the **Canvas checklist** row for Step 17.

---

## Step 18 — Update Cover with Brand Colors

Navigate to the `Thumbnail` page using `figma.setCurrentPageAsync`. Find the frame named `Cover`.

**If `Cover` is found:**

1. Read the frame's current `fills` array. Locate the `GRADIENT_LINEAR` fill entry.
2. Update `gradientStops[0].color` to the resolved RGBA for `color/primary/500` from the Primitives collection (convert the hex to `{ r, g, b, a }` floats in the 0–1 range).
3. Update `gradientStops[1].color` to the resolved RGBA for `color/secondary/500` from the Primitives collection.
4. Leave `gradientTransform` completely unchanged — do not alter the gradient angle or position.
5. Write the updated fills back to the frame.

**If `Cover` is not found:**

Log the warning `Cover frame not found — skipping Step 18 cover gradient update` and continue to Step 19 without error.

Log the **Canvas checklist** row for Step 18 (done or skipped).

---

## Step 19 — Offer next step

If **`WRITE_TOKENS_CSS` is true** and `TOKEN_CSS_PATH` is set, call **AskUserQuestion**:

> "Run `/create-component` now to build UI components and wire them to `{TOKEN_CSS_PATH}`? (yes / no)"

If **yes**, pass `TOKEN_CSS_PATH` as context when invoking `/create-component`. If **no**, close the skill.

If **`WRITE_TOKENS_CSS` is false**, call **AskUserQuestion**:

> "`tokens.css` was not written this run (Figma variables only). Run `/create-component` anyway? (yes / no) — if **yes**, you will need a token CSS file path (create one later with this skill or point to an existing file)."

If **yes** without `TOKEN_CSS_PATH`, invoke `/create-component` only with clear context that the designer must supply `token_css_path` / import manually. If **no**, close the skill.

---

## Token Naming Reference

### Primitives examples
```
color/primary/50        → lightest ramp step
color/primary/500       → brand anchor (input hex)
color/primary/950       → darkest shade
color/error/600         → error red
color/neutral/100       → near-white gray
color/tertiary/500      → tertiary brand anchor
typeface/display        → STRING "Inter" (display / heading family)
typeface/body           → STRING "Inter" (body / label family)
Space/400               → 16px (base 4 × 4)
Space/600               → 24px
Corner/Medium           → 12px
Corner/Full             → 9999px
elevation/400           → 4
```

### Theme examples
```
color/background/default           Light → color/neutral/50    Dark → color/neutral/900
color/background/container-highest Light → color/neutral/50    Dark → color/neutral/800
color/background/variant           Light → color/neutral/100   Dark → color/neutral/800
color/background/content                Light → color/neutral/900   Dark → color/neutral/50
color/background/inverse           Light → color/neutral/950   Dark → color/neutral/50
color/border/default               Light → color/neutral/200   Dark → color/neutral/700
color/primary/fixed              Light → color/primary/100   Dark → color/primary/300
color/primary/default            Light → color/primary/500   Dark → color/primary/400
color/error/on-fixed      Light → color/error/900     Dark → color/error/100
color/component/ring             Light → color/primary/500   Dark → color/primary/400
```

### Typography examples
```
Headline/LG/font-size   mode 100 → 32    mode 130 → 42    mode 200 → 45 (nonlinear)
Headline/LG/font-family all modes → VARIABLE_ALIAS → typeface/display
Title/MD/font-size      mode 100 → 16    mode 130 → 21    mode 200 → 28
Body/MD/font-size       mode 100 → 14    mode 150 → 21    mode 200 → 28
Body/MD/font-family     all modes → VARIABLE_ALIAS → typeface/body
Label/SM/font-weight    all modes → 500 (constant)
```

### Layout examples
```
space/md    → aliases Space/300 (12px)
space/lg    → aliases Space/400 (16px)
radius/md   → aliases Corner/Medium (12px)
radius/full → aliases Corner/Full (9999px)
```

### Effects examples
```
shadow/color       Light → #000 @ 10%    Dark → #000 @ 30%
shadow/lg/blur     → aliases elevation/400 (4) in both modes
```

---

## codeSyntax Derivation Rules

Apply to every variable in every collection.

### Step-by-step derivation

1. Take the full variable name: e.g. `color/primary/500` or `Display/LG/font-size`
2. Split on `/`, `-`, and spaces into word tokens: `["color","primary","500"]` or `["Display","LG","font","size"]`
3. **WEB:** lowercase all tokens, join with `-`, wrap: `var(--color-primary-500)` / `var(--display-lg-font-size)`
   - Exception for Primitives: this derivation applies. For Theme: see rule 6 — codeSyntax is set explicitly from the Step 6 table, not derived.
4. **ANDROID:** for tokens that use derivation (Primitives layout-adjacent, Layout, Effects), use the **WEB token string without** `var(--` / `)` — **kebab-case** (e.g. `space-md`, `shadow-sm-blur`, `color-primary-500`).
5. **iOS:** use **fully dot-separated paths** — Step 5 (Primitives), Step 8 (Layout), Step 9 (Effects). Rule: **every word gets its own segment separated by a period** — split on both `/` and kebab `-`. **Never camelCase** (write `.Secondary.on.subtle`, not `.Secondary.onSubtle`; `.font.size`, not `.fontSize`). **Typography:** for `Category/Size/property` variables, emit **`.Typography.{category}.{size}.{property}`** where `property` is the kebab tail with dots (see Step 7 iOS rule — e.g. `Headline/MD/line-height` → `.Typography.headline.md.line.height`).
6. **Theme (all platforms):** codeSyntax is set EXPLICITLY per token from the table in Step 6. The Figma path is a designer label; do not derive codeSyntax from it. Example: `color/background/content-muted` → WEB `var(--color-content-muted)`, ANDROID `on-surface-variant`, iOS `.Foreground.secondary` — path and all three codeSyntax columns are intentionally different.

### Platform exception summary

**Theme (all platforms — codeSyntax set EXPLICITLY from the Step 6 table, NOT derived from path):**

The Figma token path is a designer-friendly label. The codeSyntax name is different by design. Always read from the Step 6 table — never generate Theme codeSyntax by transforming the path. Official M3 role list: [Material Design 3 — Static baseline](https://m3.material.io/styles/color/static/baseline). ANDROID `codeSyntax` uses those roles in **kebab-case** (e.g. `surface-container-high`), not Compose API camelCase.

Selected examples showing intentional name divergence:

| Figma token path | WEB | ANDROID (M3 kebab) | iOS (semantic) |
|---|---|---|---|
| `color/background/default` | `var(--color-background)` | `surface` | `.Background.default` |
| `color/background/container-high` | `var(--color-background-container-high)` | `surface-container-high` | `.Background.high` |
| `color/background/inverse` | `var(--color-inverse-surface)` | `inverse-surface` | `.Background.inverse` |
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Background.shadow.tint` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Background.variant` |
| `color/background/content-muted` | `var(--color-content-muted)` | `on-surface-variant` | `.Foreground.secondary` |
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/content` | `var(--color-on-primary)` | `on-primary` | `.Primary.on` |
| `color/error/fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.error.fixed` |
| `color/error/default` | `var(--color-danger)` | `error` | `.Status.error` |

The full Theme codeSyntax table is in Step 6 — this is just a reminder that path ≠ codeSyntax for Theme.

**Primitives color ramps:**
- `color/primary/500` → WEB `var(--color-primary-500)`, ANDROID `color-primary-500`, iOS `.Palette.primary.500`
- `color/neutral/100` → WEB `var(--color-neutral-100)`, ANDROID `color-neutral-100`, iOS `.Palette.neutral.100`

**Layout / Effects (pattern):**
- `space/md` → WEB `var(--space-md)`, ANDROID `space-md`, iOS `.Layout.space.md`
- `Display/LG/font-size` → WEB `var(--display-lg-font-size)`, ANDROID `display-lg-font-size`, iOS `.Typography.display.lg.font.size`
- `Title/LG/line-height` → WEB `var(--title-lg-line-height)`, ANDROID `title-lg-line-height`, iOS `.Typography.title.lg.line.height`

---

## Color Ramp Generation

When generating a ramp from a **single hex anchor** (designer-provided brand color **or** a Baseline seed from Step 5), generate the full 11-stop ramp (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) using the Tailwind lightness interpolation approach:

1. Convert the input hex to HSL. The input hex becomes the `500` stop.
2. Assign target lightness values per stop:

   | Stop | Target L (HSL %) |
   |---|---|
   | 50  | 97 |
   | 100 | 93 |
   | 200 | 84 |
   | 300 | 73 |
   | 400 | 62 |
   | 500 | input L (anchor) |
   | 600 | input L − 10 |
   | 700 | input L − 20 |
   | 800 | input L − 30 |
   | 900 | input L − 40 |
   | 950 | input L − 47 |

3. Keep H constant. Slightly desaturate lighter stops (S − 2% per stop above 500) and increase saturation for darker stops (S + 2% per stop below 500), clamped to [10%, 100%].
4. Clamp L to [5%, 98%].
5. Convert each HSL back to hex.

If the designer provides explicit hex values for specific stops, use those and interpolate only unspecified stops.

---

## Error Guidance

| Error | Cause | Resolution |
|---|---|---|
| 403 Permission denied | MCP connector not authenticated or insufficient Figma tier | Re-authenticate in Claude Code settings; confirm Organization/Enterprise tier |
| 404 File not found | File key is wrong or file was deleted | Verify key from URL; re-run `/new-project` if needed |
| Partial write failures (errors in 200 response) | Malformed variable payload or non-existent alias ID | Retry failed variables; report names and reasons if retry fails |
| Variable alias resolution failure | Alias references a Primitive ID that doesn't exist | Confirm Primitives collection was written before alias collections; re-run Primitives step if IDs are missing |
| Typography mode count mismatch | Fewer than 8 modes on Typography collection | Verify all 8 mode names were sent (85, 100, 110, 120, 130, 150, 175, 200) |
