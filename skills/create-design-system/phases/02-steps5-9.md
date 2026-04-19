## Step 5 — Generate the Primitives collection

Write raw, platform-agnostic values into the `Primitives` collection (create if it does not exist; update in place if it does).

### Color ramps — 5 ramps, 11 stops each

Generate ramps for: **primary**, **secondary**, **tertiary**, **error**, **neutral**.

**Brand mode (`THEME_SOURCE` is `brand`):** Use the designer’s hexes from Step 2 (paste) or Step 3 (wizard) as the `500` anchor for each ramp (except neutral uses the neutral hex; error uses provided hex or `#EF4444`). For tertiary: if the designer skipped the tertiary input in the wizard, alias each `color/tertiary/{stop}` to the corresponding `color/secondary/{stop}` value.

**Baseline mode (`THEME_SOURCE` is `baseline`):** Ignore wizard color answers. Use the **fixed `500` anchors** below — these are the standard Material Design 3 tonal seed hues (see [Material Design 3 — Static baseline](https://m3.material.io/styles/color/static/baseline) and Material Theme Builder defaults). Generate every stop with the **same** Tailwind lightness interpolation from the **Color Ramp Generation** section at the bottom of this skill.

| Ramp | `500` anchor (hex) |
|---|---|
| `primary` | `#6750A4` |
| `secondary` | `#625B71` |
| `tertiary` | `#7D5260` |
| `error` | `#B3261E` |
| `neutral` | `#49454F` |

Always emit full `color/tertiary/{stop}` ramps in Baseline mode (do not alias tertiary to secondary).

Use the Tailwind lightness interpolation approach from the "Color Ramp Generation" section at the bottom. Variable name pattern: `color/{name}/{stop}`

Examples: `color/primary/50` … `color/primary/950`, `color/error/100`, `color/neutral/900`

### Spacing scale

Using the base spacing unit (default 4px), generate the scale below. Variable name: `Space/{scale}`.

| Variable | Value |
|---|---|
| `Space/100` | base × 1 |
| `Space/200` | base × 2 |
| `Space/300` | base × 3 |
| `Space/400` | base × 4 |
| `Space/500` | base × 5 |
| `Space/600` | base × 6 |
| `Space/700` | base × 7 |
| `Space/800` | base × 8 |
| `Space/900` | base × 9 |
| `Space/1000` | base × 10 |
| `Space/1100` | base × 11 |
| `Space/1200` | base × 12 |
| `Space/1600` | base × 16 |
| `Space/2000` | base × 20 |
| `Space/2400` | base × 24 |

### Border radius scale

Variable name: `Corner/{size}`.

| Variable | Value |
|---|---|
| `Corner/None` | 0 |
| `Corner/Extra-small` | base × 1 |
| `Corner/Small` | base × 2 |
| `Corner/Medium` | base × 3 |
| `Corner/Large` | base × 4 |
| `Corner/Extra-large` | 28px |
| `Corner/Full` | 9999px |

### Elevation scale

| Variable | Type | Value |
|---|---|---|
| `elevation/100` | FLOAT | 1 |
| `elevation/200` | FLOAT | 2 |
| `elevation/400` | FLOAT | 4 |
| `elevation/800` | FLOAT | 8 |
| `elevation/1600` | FLOAT | 16 |

### Typeface primitives (STRING)

Two **STRING** variables hold the font family names from Step 3 (wizard questions **6–7**) or Step 2 (pasted tokens). They are the **only** place the literal family names are stored; every Typography **`*/font-family`** variable **aliases** one of these (Step 7).

| Variable | Type | Value |
|---|---|---|
| `typeface/display` | STRING | Display / heading family name (e.g. `Inter`) |
| `typeface/body` | STRING | Body / UI text family name (e.g. `Inter`) |

### Font-weight primitives (FLOAT)

A small weight ladder used by body text **variants** (Step 7b). Primitives stay minimal on purpose — the existing Typography slots still carry their base weights as literals; only the `Body/*/emphasis/*` variant chain aliases this primitive so that "what does emphasis weigh" is edited in **one** place.

| Variable | Type | Value | Used by |
|---|---|---|---|
| `font/weight/medium` | FLOAT | **500** | `Body/{LG\|MD\|SM}/emphasis/font-weight` alias target (Step 7b) |

`codeSyntax` for `font/weight/medium`: WEB `var(--font-weight-medium)` · ANDROID `font-weight-medium` · iOS `.Font.weight.medium` (period between every word — never `.FontWeight.medium`).

**Note:** Full typography metrics (sizes, weights, line heights, scale modes) live in the **Typography** collection (Step 7). Primitives hold **only** the two typeface strings, `font/weight/medium`, and the color / space / corner / elevation tokens.

### codeSyntax for Primitives

Apply to every Primitives variable:

| Example variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `color/primary/500` | `var(--color-primary-500)` | `color-primary-500` | `.Palette.primary.500` |
| `Space/400` | `var(--space-400)` | `space-400` | `.Space.400` |
| `Corner/Medium` | `var(--corner-medium)` | `corner-medium` | `.Corner.medium` |
| `elevation/400` | `var(--elevation-400)` | `elevation-400` | `.Elevation.400` |
| `typeface/display` | `var(--typeface-display)` | `typeface-display` | `.Typeface.display` |
| `typeface/body` | `var(--typeface-body)` | `typeface-body` | `.Typeface.body` |

**Derivation rule:** strip the collection name, join all path segments with `-`, lowercase → WEB `var(--result)`.
- **ANDROID:** same token shape as WEB custom properties **without** the `var(--` / `)` wrapper — **kebab-case** throughout (e.g. `color-primary-500`, `space-400`).
- **iOS:** **dot-path semantics** — leading `.`, PascalCase **domain** segment (`Palette`, `Space`, `Corner`, `Elevation`), then **lower** segments matching the path (`primary`, `500`; `medium` for corners; numeric stops as-is).
- **Corner names with hyphens** in Figma (`Extra-small`) → WEB `corner-extra-small` → ANDROID `corner-extra-small` → iOS `.Corner.extra.small`. iOS paths put **a period between every word** — kebab hyphens become dots, never camelCase (so `extra-small` is `extra.small`, not `extraSmall`).

---

## Step 6 — Generate the Theme collection (Light / Dark modes)

Create (or update) the `Theme` collection with **two modes: `Light` and `Dark`**.

Every Theme variable is a COLOR type that aliases a Primitive variable by ID. Use the tables below — `Light →` and `Dark →` columns name the Primitive path to alias. codeSyntax values are set **explicitly** from the table — they are NOT derived from the variable name path.

### background/ — M3 layer tokens (16 variables)
*Figma folder **`background/`** names the app canvas and tonal layers for designers. **ANDROID `codeSyntax`** uses the same M3 **`ColorScheme` roles** as Jetpack Compose, formatted in **kebab-case** (e.g. `surface-container-high`), not API camelCase. **iOS `codeSyntax`** uses **dot-path semantics** (e.g. `.Background.high` for the high container tone) — not `UIColor` symbol names. The Figma path segment is a designer label, not a platform type.*

**Main layer** — base canvas and tonal endpoints.

| Variable | Light → | Dark → |
|---|---|---|
| `color/background/dim` | `color/neutral/100` | `color/neutral/950` |
| `color/background/default` | `color/neutral/50` | `color/neutral/900` |
| `color/background/bright` | `color/neutral/50` | `color/neutral/800` |

**Containers** — stepped containment / elevation without shadows (lowest → highest emphasis).

| Variable | Light → | Dark → |
|---|---|---|
| `color/background/container-lowest` | `color/neutral/50` | `color/neutral/950` |
| `color/background/container-low` | `color/neutral/100` | `color/neutral/900` |
| `color/background/container` | `color/neutral/200` | `color/neutral/800` |
| `color/background/container-high` | `color/neutral/300` | `color/neutral/700` |
| `color/background/container-highest` | `color/neutral/50` | `color/neutral/800` |

**Tonal variant** — maps to M3 `surfaceVariant` (e.g. chips, subtle fills).

| Variable | Light → | Dark → |
|---|---|---|
| `color/background/variant` | `color/neutral/100` | `color/neutral/800` |

**Content + inverse + utilities**

| Variable | Light → | Dark → |
|---|---|---|
| `color/background/content` | `color/neutral/900` | `color/neutral/50` |
| `color/background/content-muted` | `color/neutral/500` | `color/neutral/400` |
| `color/background/inverse` | `color/neutral/950` | `color/neutral/50` |
| `color/background/inverse-content` | `color/neutral/50` | `color/neutral/900` |
| `color/background/inverse-primary` | `color/primary/300` | `color/primary/700` |
| `color/background/scrim` | *(hard-coded)* `#000000` @ 32% alpha | *(hard-coded)* `#000000` @ 32% alpha |
| `color/background/shadow` | *(hard-coded)* `#000000` @ 15% alpha | *(hard-coded)* `#000000` @ 40% alpha |

Write `color/background/scrim` and `color/background/shadow` as hard-coded COLOR values (not aliases). Figma variable aliases cannot carry opacity; use resolved RGBA.

### border/ — Stroke tokens (2 variables)
*Separate from **`background/`** — divider and stroke colors only. ANDROID still uses M3 `outline` / `outlineVariant`.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/border/default` | `color/neutral/200` | `color/neutral/700` |
| `color/border/subtle` | `color/neutral/100` | `color/neutral/800` |

### primary/ — Primary brand (8 variables)
*Standard roles: CTA fill (`default`), label/icon on that fill (`content`), **subtle** brand surfaces (`subtle` / `on-subtle` = M3 `primary-container` / `on-primary-container`), and **fixed** roles for hero brand moments that stay stable across light/dark (per M3 fixed palette).*

| Variable | Light → | Dark → |
|---|---|---|
| `color/primary/default` | `color/primary/500` | `color/primary/400` |
| `color/primary/content` | `color/primary/50` | `color/primary/50` |
| `color/primary/subtle` | `color/primary/100` | `color/primary/800` |
| `color/primary/on-subtle` | `color/primary/900` | `color/primary/100` |
| `color/primary/fixed` | `color/primary/100` | `color/primary/300` |
| `color/primary/fixed-dim` | `color/primary/200` | `color/primary/800` |
| `color/primary/on-fixed` | `color/primary/900` | `color/primary/100` |
| `color/primary/on-fixed-variant` | `color/primary/800` | `color/primary/200` |

### secondary/ — Secondary actions (8 variables)
*Same shape as primary/.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/secondary/default` | `color/secondary/500` | `color/secondary/400` |
| `color/secondary/content` | `color/secondary/50` | `color/secondary/50` |
| `color/secondary/subtle` | `color/secondary/100` | `color/secondary/800` |
| `color/secondary/on-subtle` | `color/secondary/900` | `color/secondary/100` |
| `color/secondary/fixed` | `color/secondary/100` | `color/secondary/300` |
| `color/secondary/fixed-dim` | `color/secondary/200` | `color/secondary/800` |
| `color/secondary/on-fixed` | `color/secondary/900` | `color/secondary/100` |
| `color/secondary/on-fixed-variant` | `color/secondary/800` | `color/secondary/200` |

### tertiary/ — Decorative / Accent (8 variables)
*Same shape as primary/. **`subtle` / `on-subtle`** also map to shadcn `--accent` / `--accent-foreground`.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/tertiary/default` | `color/tertiary/500` | `color/tertiary/400` |
| `color/tertiary/content` | `color/tertiary/50` | `color/tertiary/50` |
| `color/tertiary/subtle` | `color/tertiary/100` | `color/tertiary/800` |
| `color/tertiary/on-subtle` | `color/tertiary/900` | `color/tertiary/100` |
| `color/tertiary/fixed` | `color/tertiary/100` | `color/tertiary/300` |
| `color/tertiary/fixed-dim` | `color/tertiary/200` | `color/tertiary/800` |
| `color/tertiary/on-fixed` | `color/tertiary/900` | `color/tertiary/100` |
| `color/tertiary/on-fixed-variant` | `color/tertiary/800` | `color/tertiary/200` |

### error/ — Error feedback (8 variables)
*Same token shape as `primary/` (`default`, `content`, `subtle`, `on-subtle`, fixed roles). **Fixed** roles follow M3 error-fixed palette behavior. Add `color/warning/*`, `color/success/*`, or `color/info/*` groups with the same 8-token shape when needed.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/error/default` | `color/error/600` | `color/error/400` |
| `color/error/content` | `color/error/50` | `color/error/50` |
| `color/error/subtle` | `color/error/100` | `color/error/900` |
| `color/error/on-subtle` | `color/error/900` | `color/error/100` |
| `color/error/fixed` | `color/error/100` | `color/error/300` |
| `color/error/fixed-dim` | `color/error/200` | `color/error/800` |
| `color/error/on-fixed` | `color/error/900` | `color/error/100` |
| `color/error/on-fixed-variant` | `color/error/800` | `color/error/200` |

### component/ — shadcn component tokens (4 variables)
*Named shadcn props only. **Scrim** and **shadow** live under `background/` as M3 `ColorScheme` roles (`scrim`, `shadow`).*

| Variable | Light → | Dark → |
|---|---|---|
| `color/component/input` | `color/neutral/200` | `color/neutral/700` |
| `color/component/ring` | `color/primary/500` | `color/primary/400` |
| `color/component/sidebar` | `color/neutral/100` | `color/neutral/900` |
| `color/component/sidebar-content` | `color/neutral/900` | `color/neutral/100` |

### codeSyntax for Theme

Mechanical rules, WEB/iOS exception lists, and ANDROID-only quick reference: **[`06-theme-codesyntax.md`](./06-theme-codesyntax.md)** (supplements the row tables below — keep them in sync when editing).

codeSyntax values are **set explicitly per token** — they are NOT derived from the Figma variable path. Path segments like `background/` and `primary/` are **Figma-only labels** for designers.

**WEB (Tailwind-friendly)** — use a single **`--color-*`** namespace so tokens drop cleanly into [Tailwind CSS v4 `@theme`](https://tailwindcss.com/docs/theme): each `codeSyntax.WEB` is `var(--color-…)` with **designer-oriented** names (`--color-background`, `--color-background-container-high`, `--color-border`, `--color-content`, …).

**ANDROID** — same semantic roles as [Jetpack Compose `ColorScheme`](https://developer.android.com/jetpack/compose/designsystems/material3), but **`codeSyntax` strings use kebab-case**, not Compose API camelCase (e.g. `surface-container-high`, not `surfaceContainerHigh`). Map each token to the M3 role in the table, then hyphenate.

**iOS** — **`codeSyntax` strings use dot-path semantics** (leading `.`, domain segments such as `.Background.high`, `.Foreground.primary`, `.Primary.on`, `.Border.default`) — these are **design-system paths for codegen / documentation**, not `UIColor` static member names.

**Disambiguation**

- **Figma path** (e.g. `color/background/container-high`): where the variable lives in the file.
- **WEB** (e.g. `var(--color-background-container-high)`): CSS custom property for Web / Tailwind theme extension.
- **ANDROID** (e.g. `surface-container-high`): same M3 role as `MaterialTheme.colorScheme.surfaceContainerHigh`, **kebab-case** in `codeSyntax`.
- **iOS** (e.g. `.Background.high`, `.Foreground.primary`): semantic dot path aligned to that role — not UIKit symbol names.

#### `background/` — M3 surface roles on Android / iOS (WEB uses `--color-background*`)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/background/dim` | `var(--color-background-dim)` | `surface-dim` | `.Background.dim` |
| `color/background/default` | `var(--color-background)` | `surface` | `.Background.default` |
| `color/background/bright` | `var(--color-background-bright)` | `surface-bright` | `.Background.bright` |
| `color/background/container-lowest` | `var(--color-background-container-lowest)` | `surface-container-lowest` | `.Background.lowest` |
| `color/background/container-low` | `var(--color-background-container-low)` | `surface-container-low` | `.Background.low` |
| `color/background/container` | `var(--color-background-container)` | `surface-container` | `.Background.mid` |
| `color/background/container-high` | `var(--color-background-container-high)` | `surface-container-high` | `.Background.high` |
| `color/background/container-highest` | `var(--color-background-container-highest)` | `surface-container-highest` | `.Background.highest` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Background.variant` |
| `color/background/content` | `var(--color-content)` | `on-surface` | `.Foreground.primary` |
| `color/background/content-muted` | `var(--color-content-muted)` | `on-surface-variant` | `.Foreground.secondary` |
| `color/background/inverse` | `var(--color-inverse-surface)` | `inverse-surface` | `.Background.inverse` |
| `color/background/inverse-content` | `var(--color-inverse-content)` | `inverse-on-surface` | `.Foreground.inverse` |
| `color/background/inverse-primary` | `var(--color-inverse-brand)` | `inverse-primary` | `.Primary.inverse` |
| `color/background/scrim` | `var(--color-scrim)` | `scrim` | `.Effect.scrim` |
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Background.shadow.tint` |

#### `border/` — Outline roles (WEB `--color-border*`)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/border/subtle` | `var(--color-border-subtle)` | `outline-variant` | `.Border.subtle` |

#### Core M3 `ColorScheme` roles — brand + status (ANDROID column)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/primary/default` | `var(--color-primary)` | `primary` | `.Primary.default` |
| `color/primary/content` | `var(--color-on-primary)` | `on-primary` | `.Primary.on` |
| `color/primary/subtle` | `var(--color-primary-subtle)` | `primary-container` | `.Primary.subtle` |
| `color/primary/on-subtle` | `var(--color-on-primary-subtle)` | `on-primary-container` | `.Primary.on.subtle` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/fixed-dim` | `var(--color-primary-fixed-dim)` | `primary-fixed-dim` | `.Primary.fixed.dim` |
| `color/primary/on-fixed` | `var(--color-on-primary-fixed)` | `on-primary-fixed` | `.Primary.on.fixed` |
| `color/primary/on-fixed-variant` | `var(--color-on-primary-fixed-muted)` | `on-primary-fixed-variant` | `.Primary.on.fixed.muted` |
| `color/secondary/default` | `var(--color-secondary)` | `secondary` | `.Secondary.default` |
| `color/secondary/content` | `var(--color-on-secondary)` | `on-secondary` | `.Secondary.on` |
| `color/secondary/subtle` | `var(--color-secondary-subtle)` | `secondary-container` | `.Secondary.subtle` |
| `color/secondary/on-subtle` | `var(--color-on-secondary-subtle)` | `on-secondary-container` | `.Secondary.on.subtle` |
| `color/secondary/fixed` | `var(--color-secondary-fixed)` | `secondary-fixed` | `.Secondary.fixed` |
| `color/secondary/fixed-dim` | `var(--color-secondary-fixed-dim)` | `secondary-fixed-dim` | `.Secondary.fixed.dim` |
| `color/secondary/on-fixed` | `var(--color-on-secondary-fixed)` | `on-secondary-fixed` | `.Secondary.on.fixed` |
| `color/secondary/on-fixed-variant` | `var(--color-on-secondary-fixed-muted)` | `on-secondary-fixed-variant` | `.Secondary.on.fixed.muted` |
| `color/tertiary/default` | `var(--color-accent)` | `tertiary` | `.Tertiary.default` |
| `color/tertiary/content` | `var(--color-on-accent)` | `on-tertiary` | `.Tertiary.on` |
| `color/tertiary/subtle` | `var(--color-accent-subtle)` | `tertiary-container` | `.Tertiary.subtle` |
| `color/tertiary/on-subtle` | `var(--color-on-accent-subtle)` | `on-tertiary-container` | `.Tertiary.on.subtle` |
| `color/tertiary/fixed` | `var(--color-accent-fixed)` | `tertiary-fixed` | `.Tertiary.fixed` |
| `color/tertiary/fixed-dim` | `var(--color-accent-fixed-dim)` | `tertiary-fixed-dim` | `.Tertiary.fixed.dim` |
| `color/tertiary/on-fixed` | `var(--color-on-accent-fixed)` | `on-tertiary-fixed` | `.Tertiary.on.fixed` |
| `color/tertiary/on-fixed-variant` | `var(--color-on-accent-fixed-muted)` | `on-tertiary-fixed-variant` | `.Tertiary.on.fixed.muted` |
| `color/error/default` | `var(--color-danger)` | `error` | `.Status.error` |
| `color/error/content` | `var(--color-on-danger)` | `on-error` | `.Status.on.error` |
| `color/error/subtle` | `var(--color-danger-subtle)` | `error-container` | `.Status.error.subtle` |
| `color/error/on-subtle` | `var(--color-on-danger-subtle)` | `on-error-container` | `.Status.on.error.subtle` |
| `color/error/fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.error.fixed` |
| `color/error/fixed-dim` | `var(--color-danger-fixed-dim)` | `error-fixed-dim` | `.Status.error.fixed.dim` |
| `color/error/on-fixed` | `var(--color-on-danger-fixed)` | `on-error-fixed` | `.Status.on.error.fixed` |
| `color/error/on-fixed-variant` | `var(--color-on-danger-fixed-muted)` | `on-error-fixed-variant` | `.Status.on.error.fixed.muted` |

#### Extensions (not in core M3 baseline diagram — shadcn alignment)

| Figma variable | WEB | ANDROID (extension) | iOS (semantic) |
|---|---|---|---|
| `color/component/input` | `var(--color-field)` | `input` | `.Component.field` |
| `color/component/ring` | `var(--color-focus-ring)` | `ring` | `.Component.ring` |
| `color/component/sidebar` | `var(--color-sidebar)` | `sidebar` | `.Component.sidebar` |
| `color/component/sidebar-content` | `var(--color-on-sidebar)` | `sidebar-foreground` | `.Component.sidebar.on` |

---

## Step 7 — Generate the Typography collection (8 scale modes)

Create (or update) the `Typography` collection with **eight modes** named exactly:
`85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`

The `100` mode is the base/default.

Baseline roles follow the **Material Design 3 type scale** (Display, Headline, **Title**, Body, Label) — see [M3 — Type scale](https://m3.material.io/styles/typography/type-scale-tokens).

### Style slots (15 slots × 4 properties = 60 variables)

Each slot has four variables: `font-family` (STRING), `font-size` (FLOAT), `font-weight` (FLOAT), `line-height` (FLOAT).

Slots: `Display/LG`, `Display/MD`, `Display/SM`, `Headline/LG`, `Headline/MD`, `Headline/SM`, `Title/LG`, `Title/MD`, `Title/SM`, `Body/LG`, `Body/MD`, `Body/SM`, `Label/LG`, `Label/MD`, `Label/SM`

Example variable names: `Display/LG/font-size`, `Title/MD/font-family`, `Body/MD/font-family`, `Label/SM/font-weight`

### Font family — alias Primitives (single edit point)

For **every** Typography `*/font-family` variable, in **all eight modes**, set the value to a **`VARIABLE_ALIAS`** (not a raw string):

| Slot prefix | Aliases Primitive |
|---|---|
| `Display/*`, `Headline/*`, `Title/*` | `typeface/display` |
| `Body/*`, `Label/*` | `typeface/body` |

`codeSyntax.WEB` on each Typography `font-family` row still uses the slot-specific name (e.g. `var(--headline-lg-font-family)`) so Dev Mode and CSS exports stay readable; resolving that custom property in `tokens.css` points at `var(--typeface-display)` or `var(--typeface-body)` (Step 13).

### Base values (mode `100`)

| Style | font-family | font-size | font-weight | line-height |
|---|---|---|---|---|
| `Display/LG` | *(alias `typeface/display`)* | 57 | 400 | 64 |
| `Display/MD` | *(alias)* | 45 | 400 | 52 |
| `Display/SM` | *(alias)* | 36 | 400 | 44 |
| `Headline/LG` | *(alias)* | 32 | 400 | 40 |
| `Headline/MD` | *(alias)* | 28 | 400 | 36 |
| `Headline/SM` | *(alias)* | 24 | 400 | 32 |
| `Title/LG` | *(alias)* | 22 | 400 | 28 |
| `Title/MD` | *(alias)* | 16 | 500 | 24 |
| `Title/SM` | *(alias)* | 14 | 500 | 20 |
| `Body/LG` | *(alias `typeface/body`)* | 16 | 400 | 24 |
| `Body/MD` | *(alias)* | 14 | 400 | 20 |
| `Body/SM` | *(alias)* | 12 | 400 | 16 |
| `Label/LG` | *(alias)* | 14 | 500 | 20 |
| `Label/MD` | *(alias)* | 12 | 500 | 16 |
| `Label/SM` | *(alias)* | 11 | 500 | 16 |

### Scaling rules for non-base modes

**Font family** and **font-weight** values are **identical across all 8 modes** — do not scale them.

For **font-size** and **line-height**, compute the value for each mode:

```
scaleFactor = mode / 100   (e.g. mode "130" → 1.30)

if (baseSize < 24 OR scaleFactor <= 1.3):
  scaledSize = round(baseSize × scaleFactor)
else:
  scaledSize = round(baseSize × √(scaleFactor))   ← nonlinear for large text at high scale
```

Apply the same formula to `line-height`. Always round to the nearest integer.

The nonlinear rule (Android 14 behaviour) prevents very large display text from becoming unmanageably large at accessibility scale levels.

### codeSyntax for Typography

**ANDROID** — same string as the WEB custom property **without** `var(--` / `)`: **kebab-case** (e.g. `display-lg-font-size`).

**iOS** — **nested dot path** `.Typography.{category}.{size}.{property}`: `category` = first segment as lowercase word (`Display` → `display`, `Headline` → `headline`, `Title` → `title`, `Body` → `body`, `Label` → `label`); `size` = second segment lowercased (`LG` → `lg`, `MD` → `md`, `SM` → `sm`); `property` = tail with **a period between every word** — kebab hyphens split into dot-separated lowercase segments, **never camelCase** (`font-size` → `font.size`, `font-family` → `font.family`, `font-weight` → `font.weight`, `line-height` → `line.height`). Example: `Display/LG/font-size` → `.Typography.display.lg.font.size`.

Every variable in all **15** slots follows this pattern — apply to all **60** variables:

| Property | WEB example | ANDROID | iOS (semantic) |
|---|---|---|---|
| `Display/LG/font-family` | `var(--display-lg-font-family)` | `display-lg-font-family` | `.Typography.display.lg.font.family` |
| `Display/LG/font-size` | `var(--display-lg-font-size)` | `display-lg-font-size` | `.Typography.display.lg.font.size` |
| `Display/LG/font-weight` | `var(--display-lg-font-weight)` | `display-lg-font-weight` | `.Typography.display.lg.font.weight` |
| `Display/LG/line-height` | `var(--display-lg-line-height)` | `display-lg-line-height` | `.Typography.display.lg.line.height` |
| `Headline/LG/font-size` | `var(--headline-lg-font-size)` | `headline-lg-font-size` | `.Typography.headline.lg.font.size` |
| `Title/MD/font-size` | `var(--title-md-font-size)` | `title-md-font-size` | `.Typography.title.md.font.size` |
| `Body/MD/font-family` | `var(--body-md-font-family)` | `body-md-font-family` | `.Typography.body.md.font.family` |
| `Label/SM/font-weight` | `var(--label-sm-font-weight)` | `label-sm-font-weight` | `.Typography.label.sm.font.weight` |

(Pattern repeats for all 15 slots — each with the same 4 properties; iOS always `.Typography.{category}.{size}.{propertyCamel}`.)

### Semantic WEB names (HTML-oriented) — `tokens.css` only

Figma allows **one** `codeSyntax.WEB` string per variable, so **role names** (`--display-lg-font-size`, `--headline-lg-font-size`, …) stay on the Typography variables. For **web components and prose**, mirror the M3 roles into **semantic** custom properties in **`tokens.css`** (Step 13) so authors can use names aligned to headings and body copy:

| Semantic prefix (WEB) | Maps from M3 / Typography slot | Intended use |
|---|---|---|
| `--text-display-lg-*` | `Display/LG/*` | Largest marketing / hero display (`*` = `font-family`, `font-size`, `font-weight`, `line-height`) |
| `--text-display-md-*` | `Display/MD/*` | Large display |
| `--text-display-sm-*` | `Display/SM/*` | Compact display |
| `--text-h1-*` | `Headline/LG/*` | Page title — **H1** |
| `--text-h2-*` | `Headline/MD/*` | Major section — **H2** |
| `--text-h3-*` | `Headline/SM/*` | Subsection — **H3** |
| `--text-h4-*` | `Title/LG/*` | Component / card titles — **H4** |
| `--text-h5-*` | `Title/MD/*` | List group headers — **H5** |
| `--text-h6-*` | `Title/SM/*` | Dense UI titles — **H6** |
| `--text-body-lg-*` | `Body/LG/*` | Lead / intro paragraph |
| `--text-body-*` | `Body/MD/*` | Default long-form **body** |
| `--text-body-sm-*` | `Body/SM/*` | Secondary dense body |
| `--text-label-*` | `Label/LG/*` | Prominent UI label |
| `--text-caption-*` | `Label/MD/*` | Helper text, **caption**, metadata |
| `--text-small-*` | `Label/SM/*` | Fine print, legal, smallest UI |

Step **13b** must emit the **per-property** semantic aliases (e.g. `--text-h1-font-size: var(--headline-lg-font-size);`, `--text-h1-font-family: var(--headline-lg-font-family);`, … for `font-weight` and `line-height`) for each row above — see the Step **13b** template block.

---

## Step 7b — Body text variants: emphasis, italic, link, strikethrough

Long-form prose needs four inline variants on top of each body size. These are modelled as **full slots** so they behave consistently with the rest of Typography (publishable Figma text styles + code-exportable variables). They extend — they do not replace — the base body slots (variable paths `Body/LG`, `Body/MD`, `Body/SM` / text styles `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` — see § 8 step 2 for the text-style naming rule). Each body size therefore ships **five text styles** nested inside its `Body/{size}/` folder: `regular`, `emphasis`, `italic`, `link`, `strikethrough`.

### 12 new slots (3 sizes × 4 variants)

| Slot | Variant of | Weight | fontName `style` | `textDecoration` | Text-node fill |
|---|---|---|---|---|---|
| `Body/LG/emphasis`, `Body/MD/emphasis`, `Body/SM/emphasis` | base body | **500** (alias → `font/weight/medium` Primitive) | `Medium` | `NONE` | inherit paragraph |
| `Body/LG/italic`, `Body/MD/italic`, `Body/SM/italic` | base body | base (400) | `Italic` | `NONE` | inherit paragraph |
| `Body/LG/link`, `Body/MD/link`, `Body/SM/link` | base body | base (400) | `Regular` | **`UNDERLINE`** | bind to **`color/primary/default`** (the brand hue — `/content` is the text-on-primary pairing and is nearly white, invisible on neutral body backgrounds) |
| `Body/LG/strikethrough`, `Body/MD/strikethrough`, `Body/SM/strikethrough` | base body | base (400) | `Regular` | **`STRIKETHROUGH`** | bind to **`color/background/content-muted`** |

**Italic font-face availability:** the body family must ship an italic face (e.g. `Inter Italic`). The push script **attempts** `fontName.style = 'Italic'` and falls back to the base style with a console warning `italic face not loaded for {family} — Body/{size}/italic style created without italic glyph; add the Italic font face to the Figma file to resolve`.

### 48 new Typography variables (aliases, all 8 modes)

Each of the 12 variant slots gets the **same 4 properties** as every other slot:

| Property | Alias target (all 8 modes) |
|---|---|
| `Body/{size}/{variant}/font-family` | **`typeface/body`** Primitive (same as base `Body/*/font-family`) |
| `Body/{size}/{variant}/font-size` | **`Body/{size}/font-size`** — aliases the base, so size scales in lock-step across all 8 Android modes without duplicating the scaling formula |
| `Body/{size}/{variant}/line-height` | **`Body/{size}/line-height`** — same lock-step cascade |
| `Body/{size}/{variant}/font-weight` | `emphasis` → **`font/weight/medium`** Primitive (500); `italic` / `link` / `strikethrough` → **`Body/{size}/font-weight`** (base) |

**Aliasing rationale:** 44 of the 48 new variables are alias-back chains, so the entire Body type ramp remains **one editable surface**: bumping `Body/MD/font-size` at mode 150 also updates `Body/MD/emphasis/font-size`, `Body/MD/italic/font-size`, `Body/MD/link/font-size`, and `Body/MD/strikethrough/font-size` at mode 150 automatically. Only the 3 `emphasis/font-weight` variables break this rule and alias the `font/weight/medium` Primitive instead.

### codeSyntax for variant slots

Same derivation as §7 but with the **4-segment** slot path (`body/{size}/{variant}/{property}`):

| Example variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `Body/LG/emphasis/font-size` | `var(--body-lg-emphasis-font-size)` | `body-lg-emphasis-font-size` | `.Typography.body.lg.emphasis.font.size` |
| `Body/MD/italic/font-weight` | `var(--body-md-italic-font-weight)` | `body-md-italic-font-weight` | `.Typography.body.md.italic.font.weight` |
| `Body/SM/link/line-height` | `var(--body-sm-link-line-height)` | `body-sm-link-line-height` | `.Typography.body.sm.link.line.height` |
| `Body/LG/strikethrough/font-family` | `var(--body-lg-strikethrough-font-family)` | `body-lg-strikethrough-font-family` | `.Typography.body.lg.strikethrough.font.family` |

(Pattern repeats for all 48 variant variables.)

### Figma text styles (publish 12)

After the 48 variables exist, create **12 text styles** with these bindings + style-level properties:

```
Body/LG/emphasis      ← fontSize/lineHeight/fontFamily/fontWeight bound to Body/LG/emphasis/*
                        fontName.style = 'Medium'            (or Regular + explicit weight 500 binding)
                        textDecoration = 'NONE'
Body/LG/italic        ← same variable bindings (weight 400)
                        fontName.style = 'Italic'            (fall back to 'Regular' + warn if face missing)
                        textDecoration = 'NONE'
Body/LG/link          ← same variable bindings (weight 400)
                        fontName.style = 'Regular'
                        textDecoration = 'UNDERLINE'
Body/LG/strikethrough ← same variable bindings (weight 400)
                        fontName.style = 'Regular'
                        textDecoration = 'STRIKETHROUGH'
```

Same pattern for `Body/MD/*` and `Body/SM/*` — **12 published styles total.**

### Text-node fill coupling (critical — not captured in the style)

Figma text styles do **not** include fill color — the style captures size / line / weight / family / fontName / textDecoration, but the `fills` array lives on each text node. Every call site that applies a `link` or `strikethrough` style **must also** bind the text node's fill:

| Style applied | Required fill binding |
|---|---|
| `Body/*/link` | `fills[0]` → `VARIABLE_ALIAS` → **`color/primary/default`** (Theme, inherits Light/Dark). Do **not** use `color/primary/content` — that token is the on-primary text/icon color (sits on `primary/default`) and will be invisible on neutral page/background fills. |
| `Body/*/strikethrough` | `fills[0]` → `VARIABLE_ALIAS` → **`color/background/content-muted`** (Theme, inherits Light/Dark) |
| `Body/*/emphasis`, `Body/*/italic` | no change — inherits whatever fill the surrounding paragraph already has |

Codegen consumers (tokens.css, Compose, SwiftUI) cover this by pairing each body-variant class with its color custom property — see §13b additions.

### Variable-build checklist

1. In the Primitives collection, add `font/weight/medium = 500` (FLOAT) with the codeSyntax from §5.
2. In the Typography collection, for each of `LG`, `MD`, `SM` × `emphasis`, `italic`, `link`, `strikethrough` (12 slots) and each of the 4 properties (48 variable rows), `figma.variables.createVariable(...)` then in **every** of the 8 modes set the `valuesByMode[modeId]` to the alias target from the table above. **Do not** set literal values — all 48 must resolve through aliases so the Android scale modes keep working without duplication.
3. `codeSyntax` for these variables is applied in **Step 11** (REST `UPDATE` batch) after the variables exist — use §7b patterns when building that payload.
4. Run the Step 15c Text Styles re-render (below) so the 12 new rows appear in the table.

Create (or update) the `Layout` collection with a single **`Default`** mode.

All Layout variables are FLOAT type aliases that point to Primitives by ID.

### Spacing aliases

| Variable | → Primitive |
|---|---|
| `space/xs` | `Space/100` |
| `space/sm` | `Space/200` |
| `space/md` | `Space/300` |
| `space/lg` | `Space/400` |
| `space/xl` | `Space/600` |
| `space/2xl` | `Space/800` |
| `space/3xl` | `Space/1200` |
| `space/4xl` | `Space/1600` |

### Radius aliases

| Variable | → Primitive |
|---|---|
| `radius/none` | `Corner/None` |
| `radius/xs` | `Corner/Extra-small` |
| `radius/sm` | `Corner/Small` |
| `radius/md` | `Corner/Medium` |
| `radius/lg` | `Corner/Large` |
| `radius/xl` | `Corner/Extra-large` |
| `radius/full` | `Corner/Full` |

### codeSyntax for Layout

Strip the group prefix (`space/`, `radius/`), kebab the remainder:

| Variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `space/xs` | `var(--space-xs)` | `space-xs` | `.Layout.space.xs` |
| `space/2xl` | `var(--space-2xl)` | `space-2xl` | `.Layout.space.2xl` |
| `radius/md` | `var(--radius-md)` | `radius-md` | `.Layout.radius.md` |
| `radius/full` | `var(--radius-full)` | `radius-full` | `.Layout.radius.full` |

---

## Step 9 — Generate the Effects collection

Create (or update) the `Effects` collection with **two modes: `Light` and `Dark`**.

| Variable | Type | Light value | Dark value |
|---|---|---|---|
| `shadow/color` | COLOR | `#000000` at 10% alpha | `#000000` at 30% alpha |
| `shadow/sm/blur` | FLOAT | aliases `elevation/100` | aliases `elevation/100` |
| `shadow/md/blur` | FLOAT | aliases `elevation/200` | aliases `elevation/200` |
| `shadow/lg/blur` | FLOAT | aliases `elevation/400` | aliases `elevation/400` |
| `shadow/xl/blur` | FLOAT | aliases `elevation/800` | aliases `elevation/800` |
| `shadow/2xl/blur` | FLOAT | aliases `elevation/1600` | aliases `elevation/1600` |

`shadow/color` is a hard-coded COLOR value (not an alias — opacity cannot be carried on an alias). Write it as RGBA directly in both modes.

The blur FLOAT variables alias the corresponding Primitive elevation by ID; their values are identical in both modes (only the color opacity changes between Light and Dark).

### codeSyntax for Effects

`shadow/color` maps to the M3 `shadow` color role. **ANDROID** uses kebab-case; **iOS** uses dot paths under `.Effect`.

| Variable | WEB | ANDROID (M3 kebab) | iOS (semantic) |
|---|---|---|---|
| `shadow/color` | `var(--shadow-color)` | `shadow` | `.Effect.shadow.color` |
| `shadow/sm/blur` | `var(--shadow-sm-blur)` | `shadow-sm-blur` | `.Effect.shadow.sm.blur` |
| `shadow/md/blur` | `var(--shadow-md-blur)` | `shadow-md-blur` | `.Effect.shadow.md.blur` |
| `shadow/lg/blur` | `var(--shadow-lg-blur)` | `shadow-lg-blur` | `.Effect.shadow.lg.blur` |
| `shadow/xl/blur` | `var(--shadow-xl-blur)` | `shadow-xl-blur` | `.Effect.shadow.xl.blur` |
| `shadow/2xl/blur` | `var(--shadow-2xl-blur)` | `shadow-2xl-blur` | `.Effect.shadow.2xl.blur` |

---
