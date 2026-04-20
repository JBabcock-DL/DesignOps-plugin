## Step 5 — Generate the Primitives collection

Write raw, platform-agnostic values into the `Primitives` collection (create if absent; update in place if present).

**Data reference:** [`../data/primitives-baseline.json`](../data/primitives-baseline.json) — scales, ramp anchors, codeSyntax rules + examples.

### Color ramps

Generate 5 ramps (`primary`, `secondary`, `tertiary`, `error`, `neutral`), 11 stops each (`50 … 950`). Variable name pattern: `color/{ramp}/{stop}`.

- **Brand mode** (`THEME_SOURCE = brand`): use the designer's hexes from Step 2 (paste) or Step 3 (wizard) as the `500` anchor. Tertiary: alias all `color/tertiary/{stop}` to the corresponding `color/secondary/{stop}` if the designer skipped the tertiary wizard input.
- **Baseline mode** (`THEME_SOURCE = baseline`): use the 5 fixed `500` anchors in `primitives-baseline.json` → `baselineAnchors`. Always emit full `color/tertiary/*` ramps in Baseline mode — do not alias to secondary.

Interpolate all stops with the Tailwind lightness approach (dark anchor at 950, light anchor at 50, 500 is the designer's hex hue). Round to nearest integer.

### Non-color Primitives

All scales, aliases, and codeSyntax examples are in `primitives-baseline.json`. Follow `spacing.scale`, `radius`, `elevation`, `typeface`, and `fontWeight` arrays. Rules:
- `Corner/Extra-small` through `Corner/Large` use `base × multiplier` from Step 3 answer. `Corner/Extra-large` is 28px fixed; `Corner/Full` is 9999px fixed.
- `typeface/display` and `typeface/body` are STRING variables — the **only** location for literal family names. Every Typography `*/font-family` aliases one of these (Step 7).
- `font/weight/medium = 500` FLOAT — alias target for `Body/*/emphasis/font-weight` (Step 7b).

**codeSyntax:** derivation rules + examples in `primitives-baseline.json` → `codeSyntaxRules`. Key rule: strip collection name, join segments with `-`, lowercase → WEB `var(--result)`. ANDROID same without `var(--/)`. iOS: leading `.`, PascalCase domain, period-separated lowercase path (hyphens split to dots, never camelCase).

---

## Step 6 — Generate the Theme collection (Light / Dark modes)

Create (or update) the `Theme` collection with **two modes: `Light` and `Dark`**.

**Data reference:** [`../data/theme-aliases.json`](../data/theme-aliases.json) — complete alias map (50 rows) + codeSyntax per variable.

Every Theme variable is a COLOR type. Read `rows` from the JSON: `path` = variable name, `light`/`dark` = Primitive path to alias by ID, `codeSyntax` = set explicitly (NOT derived from the Figma variable path). The two entries in `rawLiterals` (`scrim`, `shadow`) are hard-coded RGBA per mode — opacity cannot ride on an alias.

**codeSyntax notes:** WEB uses `--color-*` namespace (Tailwind v4 `@theme` ready). ANDROID uses M3 `ColorScheme` role names in kebab-case (not Compose camelCase). iOS uses dot-path semantics (design-system paths for codegen, not UIColor symbols). Additional exception lists and derivation rules: [`02b-theme-codesyntax.md`](./02b-theme-codesyntax.md).

---

## Step 7 — Generate the Typography collection (8 scale modes)

Create (or update) the `Typography` collection with **eight modes**: `85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`. Mode `100` is base/default.

**Data reference:** [`../data/typography-slots.json`](../data/typography-slots.json) — 15 base slots, body-variant aliases, codeSyntax rules, semantic tokens.css aliases.

### Font family (alias Primitives — single edit point)

For **every** Typography `*/font-family`, in **all 8 modes**, set value to `VARIABLE_ALIAS` — not a raw string. Read aliases from `fontFamilyAliases` in the JSON: Display/Headline/Title → `typeface/display`; Body/Label → `typeface/body`.

### Base values (mode 100)

All 15 slots with `fontSize`, `fontWeight`, `lineHeight` are in `baseSlots` array. Font family is always an alias (above), never a literal.

### Scaling for non-base modes

**Font family and font-weight: identical across all 8 modes — do not scale.**

For `font-size` and `line-height`:
```
scaleFactor = mode / 100   (e.g. mode "130" → 1.30)
if (baseSize < 24 OR scaleFactor <= 1.3):
  scaledSize = round(baseSize × scaleFactor)
else:
  scaledSize = round(baseSize × √(scaleFactor))   ← nonlinear for large text at high scale
```
Apply the same formula to `line-height`. Round to nearest integer. (Matches Android 14 behavior — prevents very large display text becoming unmanageable at accessibility scale.)

### codeSyntax for Typography

Rules in `typography-slots.json` → `codeSyntaxRules`. WEB: `var(--{slot-kebab}-{property-kebab})`. ANDROID: same without `var(--/)`. iOS: `.Typography.{category}.{size}.{property-dot-split}` — hyphens become dots, never camelCase.

---

## Step 7b — Body text variants: emphasis, italic, link, strikethrough

**Data reference:** [`../data/typography-slots.json`](../data/typography-slots.json) → `bodyVariants`.

Three sizes × four variants = **12 variant slots**, **48 alias variables** (4 properties × 12 slots). All 48 are aliases — do not set literals — so the Android scale cascade keeps working without duplication.

Text-style naming rule: base body styles are `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` (nested under the size folder). Read `textStyleNamingRule` from `bodyVariants`.

**Alias targets (from `variableAliasRules` in JSON):**
- `font-family` → `typeface/body`
- `font-size`, `line-height` → `Body/{size}/font-size` / `Body/{size}/line-height` (lock-step Android scaling)
- `font-weight`: `emphasis` → `font/weight/medium`; all other variants → `Body/{size}/font-weight`

**Text style properties + Figma text-node fill coupling:**

Read each variant's `fontNameStyle`, `textDecoration`, and `textFillBinding` from `variants` array. Critical: text styles do not carry fill color — every call site that applies `link` or `strikethrough` must also bind the text node's fill:
- `link` → `fills[0]` VARIABLE_ALIAS → **`color/primary/default`** (Theme, inherits Light/Dark). Do **not** use `color/primary/content` — that is the on-primary pairing and is invisible on neutral backgrounds.
- `strikethrough` → `fills[0]` VARIABLE_ALIAS → **`color/background/content-muted`** (Theme, inherits Light/Dark).

**Italic face availability:** attempt `fontName.style = 'Italic'`; fall back to Regular with `console.warn('italic face not loaded for {family} — Body/{size}/italic created without italic glyph; add the Italic face to resolve')`.

`codeSyntax` for variant slots uses same 4-segment pattern: `body/{size}/{variant}/{property}`.

**Build checklist:**
1. Add `font/weight/medium = 500` to Primitives (Step 5, before pushing Typography).
2. For each of 12 slots × 4 properties × 8 modes: `createVariable` + `valuesByMode[modeId]` = alias target.
3. `codeSyntax` applied in Step 11 REST batch — use §7b patterns from `typography-slots.json`.
4. Step 15c text-styles re-render surfaces the 12 new rows in the canvas table.

---

## Step 8 — Generate the Layout collection

Create (or update) the `Layout` collection with a single **`Default`** mode.

**Data reference:** [`../data/layout-effects.json`](../data/layout-effects.json) → `layout`.

All Layout variables are FLOAT type aliases pointing to Primitives by ID. Read `spacing` and `radius` arrays for path, alias target, and codeSyntax per row.

codeSyntax derivation: strip group prefix (`space/`, `radius/`), kebab the remainder. WEB: `var(--space-xs)`. ANDROID: `space-xs`. iOS: `.Layout.space.xs` (period-separated; `2xl` stays as-is).

---

## Step 9 — Generate the Effects collection

Create (or update) the `Effects` collection with **two modes: `Light` and `Dark`**.

**Data reference:** [`../data/layout-effects.json`](../data/layout-effects.json) → `effects`.

`shadow/color` is a hard-coded RGBA per mode (opacity cannot ride on a variable alias) — read `color.light` and `color.dark` RGBA from JSON. Blur variables alias the corresponding Primitive elevation by ID; values are identical across modes (only shadow color alpha differs). Read `blurs` array for all 5 tiers.

codeSyntax: `shadow/color` ANDROID = `shadow`; iOS = `.Effect.shadow.color`. Blur tiers follow `.Effect.shadow.{tier}.blur` iOS pattern. Full table in JSON `blurs[*].codeSyntax`.

---
