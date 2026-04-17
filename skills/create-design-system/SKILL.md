---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives, Theme (Light/Dark modes), Typography (8 Android-curve scale modes), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections.
argument-hint: "Optional: --theme brand|baseline (default brand). Baseline uses Material 3 static baseline seed hues for Primitives ramps; Brand uses wizard or pasted hexes."
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

---

## Optional — Parse `$ARGUMENTS` for theme source

Before Step 1, parse `$ARGUMENTS` for `--theme`:

- `--theme baseline` → set `THEME_SOURCE` to **`baseline`** and `THEME_FROM_CLI` to **true** (Material 3 static baseline seed colors for Primitives ramps — see Step 5).
- `--theme brand` → set `THEME_SOURCE` to **`brand`** and `THEME_FROM_CLI` to **true**.
- Flag absent or invalid → set `THEME_FROM_CLI` to **false** and leave `THEME_SOURCE` unset until Step 2.5 (wizard path only).

When `THEME_FROM_CLI` is **true** and Step 2 was **no**, skip Step 2.5. When Step 2 is **yes** (pasted tokens), always use **`brand`** for Primitives color ramps (ignore `--theme baseline` for colors).

---

## Interactive input contract

- For **Steps 1–4**, **Step 2.5** (theme source, when needed), **Step 10** (plan approval), **Step 11** when the API returns partial write errors, and **Step 19**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
- **Do not** print a block of multiple questions as plain markdown before the first AskUserQuestion.
- After any AskUserQuestion, you may show a brief acknowledgment in prose; do not bundle the next question in that same message — call AskUserQuestion again.

---

## Step 1 — Resolve the Figma file key

1. Check `plugin/templates/agent-handoff.md` for `active_file_key`.

2. **If `active_file_key` is set**, call **AskUserQuestion**:

   > "I'll use the Foundations file from the last `/new-project` run: `<active_file_key>`. Use this file? Reply **yes** or paste a different Figma file key."

   - If **yes**, set `TARGET_FILE_KEY` to `active_file_key`.
   - If the reply is a different key string, validate it (alphanumerics and hyphens only). If valid, set `TARGET_FILE_KEY`. If invalid, call **AskUserQuestion** again until valid.

3. **If `active_file_key` is missing**, call **AskUserQuestion**:

   > "What is the Figma file key for your design system file? (The segment after `figma.com/design/` in the file URL, before the next `/`.)"

   Validate the reply. If malformed, call **AskUserQuestion** again until `TARGET_FILE_KEY` is valid.

Do not proceed without `TARGET_FILE_KEY`.

---

## Step 2 — Check for existing brand tokens

Call **AskUserQuestion**:

> "Do you have brand tokens ready to paste? (colors, fonts, spacing) Reply **yes** to paste them next, or **no** to run the guided wizard one question at a time."

**If yes:**

1. Set `THEME_SOURCE` to **`brand`** — pasted tokens define Primitives; Baseline seed colors do not apply.
2. Call **AskUserQuestion** asking them to paste tokens in any readable format (JSON, CSS variables, Figma token JSON, or a plain list).
3. Parse what you can. For **each** required value still missing after parsing, call **AskUserQuestion** for that single field only (one tool call per missing field):
   - Primary brand color (hex)
   - Secondary/accent color (hex)
   - Neutral/gray base color (hex)
   - Tertiary/accent color (hex) — optional; default to secondary color if skipped
   - Error/danger color (hex) — optional; default `#EF4444` if skipped
   - Body font family name
   - Display/heading font family name
   - Base font size in px
   - Base spacing unit in px
   - Border radius base in px

**If no:** Go to Step 2.5, then Step 3.

---

## Step 2.5 — Theme source: Brand vs Baseline (wizard path only)

Run this step **only** when Step 2 was **no** (no pasted tokens) **and** `THEME_FROM_CLI` is **false** (no explicit `--theme` in `$ARGUMENTS`). If `THEME_FROM_CLI` is **true**, `THEME_SOURCE` is already final — skip this step.

Otherwise call **AskUserQuestion** once:

> "Theme source: **Brand** — generate color ramps from your own primary/secondary/neutral hexes (wizard), or **Baseline** — use Material Design 3 [static baseline](https://m3.material.io/styles/color/static/baseline) seed hues for the five Primitives ramps (same Theme alias structure as Brand; Light/Dark resolves from those ramps). Reply **brand** or **baseline**."

- **`brand`** → set `THEME_SOURCE` to `brand`, then continue to Step 3 (full color wizard).
- **`baseline`** → set `THEME_SOURCE` to `baseline`, then continue to Step 3 (**skip** color questions 1–5; Primitives anchors are taken from Step 5 “Baseline seed anchors”).

---

## Step 3 — Interactive setup wizard (when no tokens supplied)

Collect each value with **AskUserQuestion**, one call at a time, in this order. Use the stated default only when the designer explicitly asks for the default or leaves the answer empty.

**If `THEME_SOURCE` is `baseline`:** Skip questions **1–5** below (color ramps use M3 baseline seeds from Step 5). Start at question **6**.

**If `THEME_SOURCE` is `brand`:** Ask questions **1–10** in order.

1. **AskUserQuestion**: "What is your primary brand color? (hex, e.g. `#3B82F6`)" — required, no default. *(Skip when `THEME_SOURCE` is `baseline`.)*
2. **AskUserQuestion**: "What is your secondary or accent color? (hex)" — required, no default. *(Skip when `baseline`.)*
3. **AskUserQuestion**: "What is your neutral or gray base color? (hex, e.g. `#6B7280`)" — required, no default. *(Skip when `baseline`.)*
4. **AskUserQuestion**: "What is your tertiary or third accent color? (hex, optional — press enter to use secondary color)" *(Skip when `baseline`.)*
5. **AskUserQuestion**: "What is your error or danger color? (hex, optional — default `#EF4444`)" *(Skip when `baseline`.)*
6. **AskUserQuestion**: "What font family for body text? (e.g. `Inter`, `Roboto`; default `Inter` if unspecified)"
7. **AskUserQuestion**: "What font family for display and headings? (default: same as body if unspecified)"
8. **AskUserQuestion**: "Base font size in px? (default: 16)"
9. **AskUserQuestion**: "Base spacing unit in px? (default: 4)"
10. **AskUserQuestion**: "Base border radius in px? (default: 4)"

Then call **AskUserQuestion** to confirm:

- If **`brand`:**  
  > "Collected: Primary `{…}` · Secondary `{…}` · Neutral `{…}` · Tertiary `{…}` · Error `{…}` · Body `{…}` · Display `{…}` · Font size `{…}px` · Spacing `{…}px` · Radius `{…}px`. Proceed with **yes**, or reply **edit** and name which fields to change."

- If **`baseline`:**  
  > "Using **Material 3 Baseline** seed colors for Primitives ramps (see Step 5). Collected: Body `{…}` · Display `{…}` · Font size `{…}px` · Spacing `{…}px` · Radius `{…}px`. Proceed with **yes**, or reply **edit** and name which fields to change."

If the designer replies **edit**, call **AskUserQuestion** once per field they name to change, then AskUserQuestion for confirmation again until they answer **yes**.

---

## Step 4 — Read current Figma variable state

Before writing anything, call the Figma Variables REST API to read the full variable registry of the target file:

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Execute via `mcp__claude_ai_Figma__get_variable_defs` (preferred) or as a direct REST call through the Figma MCP connector. Do **not** use `use_figma` — the Plugin API does not expose variable collection IDs needed for the write payload.

Parse the response and identify:
- Existing collection names and their IDs
- Existing variable names and their IDs within each collection
- Any collections that match `Primitives`, `Theme`, `Typography`, `Layout`, or `Effects`

**Error — 403:** Authentication or tier issue. Report the full error message and abort:
> "The Figma MCP connector does not have write access to this file. Check authentication and that your Figma org is on Organization or Enterprise tier."

**Error — 404:** File not found. Abort with the file key and instructions to re-check the URL.

---

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

**Note:** Typography variables are no longer stored in Primitives — they live in the Typography collection (Step 7).

### codeSyntax for Primitives

Apply to every Primitives variable:

| Example variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `color/primary/500` | `var(--color-primary-500)` | `color-primary-500` | `.Palette.primary.500` |
| `Space/400` | `var(--space-400)` | `space-400` | `.Space.400` |
| `Corner/Medium` | `var(--corner-medium)` | `corner-medium` | `.Corner.medium` |
| `elevation/400` | `var(--elevation-400)` | `elevation-400` | `.Elevation.400` |

**Derivation rule:** strip the collection name, join all path segments with `-`, lowercase → WEB `var(--result)`.
- **ANDROID:** same token shape as WEB custom properties **without** the `var(--` / `)` wrapper — **kebab-case** throughout (e.g. `color-primary-500`, `space-400`).
- **iOS:** **dot-path semantics** — leading `.`, PascalCase **domain** segment (`Palette`, `Space`, `Corner`, `Elevation`), then **lower** segments matching the path (`primary`, `500`; `medium` for corners; numeric stops as-is).
- **Corner names with hyphens** in Figma (`Extra-small`) → WEB `corner-extra-small` → ANDROID `corner-extra-small` → iOS `.Corner.extraSmall` (lowerCamel the last segment if needed for readability).

---

## Step 6 — Generate the Theme collection (Light / Dark modes)

Create (or update) the `Theme` collection with **two modes: `Light` and `Dark`**.

Every Theme variable is a COLOR type that aliases a Primitive variable by ID. Use the tables below — `Light →` and `Dark →` columns name the Primitive path to alias. codeSyntax values are set **explicitly** from the table — they are NOT derived from the variable name path.

### background/ — M3 layer tokens (16 variables)
*Figma folder **`background/`** names the app canvas and tonal layers for designers. **ANDROID `codeSyntax`** uses the same M3 **`ColorScheme` roles** as Jetpack Compose, formatted in **kebab-case** (e.g. `surface-container-high`), not API camelCase. **iOS `codeSyntax`** uses **dot-path semantics** (e.g. `.Back.high` for the high container tone) — not `UIColor` symbol names. The Figma path segment is a designer label, not a platform type.*

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
| `color/background/fg` | `color/neutral/900` | `color/neutral/50` |
| `color/background/fg-subtle` | `color/neutral/500` | `color/neutral/400` |
| `color/background/inverse` | `color/neutral/950` | `color/neutral/50` |
| `color/background/inverse-fg` | `color/neutral/50` | `color/neutral/900` |
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
*Standard roles: CTA fills, on-primary, containers. **Fixed** roles stay stable across light/dark for hero brand moments (per M3 fixed palette).*

| Variable | Light → | Dark → |
|---|---|---|
| `color/primary/default` | `color/primary/500` | `color/primary/400` |
| `color/primary/fg` | `color/primary/50` | `color/primary/50` |
| `color/primary/tint` | `color/primary/100` | `color/primary/800` |
| `color/primary/fg-on-tint` | `color/primary/900` | `color/primary/100` |
| `color/primary/fixed` | `color/primary/100` | `color/primary/300` |
| `color/primary/fixed-dim` | `color/primary/200` | `color/primary/800` |
| `color/primary/on-fixed` | `color/primary/900` | `color/primary/100` |
| `color/primary/on-fixed-variant` | `color/primary/800` | `color/primary/200` |

### secondary/ — Secondary actions (8 variables)
*Same shape as primary/.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/secondary/default` | `color/secondary/500` | `color/secondary/400` |
| `color/secondary/fg` | `color/secondary/50` | `color/secondary/50` |
| `color/secondary/tint` | `color/secondary/100` | `color/secondary/800` |
| `color/secondary/fg-on-tint` | `color/secondary/900` | `color/secondary/100` |
| `color/secondary/fixed` | `color/secondary/100` | `color/secondary/300` |
| `color/secondary/fixed-dim` | `color/secondary/200` | `color/secondary/800` |
| `color/secondary/on-fixed` | `color/secondary/900` | `color/secondary/100` |
| `color/secondary/on-fixed-variant` | `color/secondary/800` | `color/secondary/200` |

### tertiary/ — Decorative / Accent (8 variables)
*Same shape as primary/. `tint` / `fg-on-tint` also map to shadcn `--accent` / `--accent-foreground`.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/tertiary/default` | `color/tertiary/500` | `color/tertiary/400` |
| `color/tertiary/fg` | `color/tertiary/50` | `color/tertiary/50` |
| `color/tertiary/tint` | `color/tertiary/100` | `color/tertiary/800` |
| `color/tertiary/fg-on-tint` | `color/tertiary/900` | `color/tertiary/100` |
| `color/tertiary/fixed` | `color/tertiary/100` | `color/tertiary/300` |
| `color/tertiary/fixed-dim` | `color/tertiary/200` | `color/tertiary/800` |
| `color/tertiary/on-fixed` | `color/tertiary/900` | `color/tertiary/100` |
| `color/tertiary/on-fixed-variant` | `color/tertiary/800` | `color/tertiary/200` |

### status/ — Feedback states (8 variables)
*Standard error roles + **fixed** error roles (M3). Expand with `warning/`, `success/`, `info/` using the same 8-token shape when needed.*

| Variable | Light → | Dark → |
|---|---|---|
| `color/status/error` | `color/error/600` | `color/error/400` |
| `color/status/error-fg` | `color/error/50` | `color/error/50` |
| `color/status/error-tint` | `color/error/100` | `color/error/900` |
| `color/status/error-fg-on-tint` | `color/error/900` | `color/error/100` |
| `color/status/error-fixed` | `color/error/100` | `color/error/300` |
| `color/status/error-fixed-dim` | `color/error/200` | `color/error/800` |
| `color/status/error-on-fixed` | `color/error/900` | `color/error/100` |
| `color/status/error-on-fixed-variant` | `color/error/800` | `color/error/200` |

### component/ — shadcn component tokens (4 variables)
*Named shadcn props only. **Scrim** and **shadow** live under `background/` as M3 `ColorScheme` roles (`scrim`, `shadow`).*

| Variable | Light → | Dark → |
|---|---|---|
| `color/component/input` | `color/neutral/200` | `color/neutral/700` |
| `color/component/ring` | `color/primary/500` | `color/primary/400` |
| `color/component/sidebar` | `color/neutral/100` | `color/neutral/900` |
| `color/component/sidebar-fg` | `color/neutral/900` | `color/neutral/100` |

### codeSyntax for Theme

codeSyntax values are **set explicitly per token** — they are NOT derived from the Figma variable path. Path segments like `background/` and `primary/` are **Figma-only labels** for designers.

**WEB (Tailwind-friendly)** — use a single **`--color-*`** namespace so tokens drop cleanly into [Tailwind CSS v4 `@theme`](https://tailwindcss.com/docs/theme): each `codeSyntax.WEB` is `var(--color-…)` with **designer-oriented** names (`--color-background`, `--color-background-container-high`, `--color-border`, `--color-content`, …).

**ANDROID** — same semantic roles as [Jetpack Compose `ColorScheme`](https://developer.android.com/jetpack/compose/designsystems/material3), but **`codeSyntax` strings use kebab-case**, not Compose API camelCase (e.g. `surface-container-high`, not `surfaceContainerHigh`). Map each token to the M3 role in the table, then hyphenate.

**iOS** — **`codeSyntax` strings use dot-path semantics** (leading `.`, domain segments such as `.Back.high`, `.Primary.on`, `.Border.default`) — these are **design-system paths for codegen / documentation**, not `UIColor` static member names.

**Disambiguation**

- **Figma path** (e.g. `color/background/container-high`): where the variable lives in the file.
- **WEB** (e.g. `var(--color-background-container-high)`): CSS custom property for Web / Tailwind theme extension.
- **ANDROID** (e.g. `surface-container-high`): same M3 role as `MaterialTheme.colorScheme.surfaceContainerHigh`, **kebab-case** in `codeSyntax`.
- **iOS** (e.g. `.Back.high`): semantic dot path aligned to that role — not UIKit symbol names.

#### `background/` — M3 surface roles on Android / iOS (WEB uses `--color-background*`)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/background/dim` | `var(--color-background-dim)` | `surface-dim` | `.Back.dim` |
| `color/background/default` | `var(--color-background)` | `surface` | `.Back.default` |
| `color/background/bright` | `var(--color-background-bright)` | `surface-bright` | `.Back.bright` |
| `color/background/container-lowest` | `var(--color-background-container-lowest)` | `surface-container-lowest` | `.Back.lowest` |
| `color/background/container-low` | `var(--color-background-container-low)` | `surface-container-low` | `.Back.low` |
| `color/background/container` | `var(--color-background-container)` | `surface-container` | `.Back.mid` |
| `color/background/container-high` | `var(--color-background-container-high)` | `surface-container-high` | `.Back.high` |
| `color/background/container-highest` | `var(--color-background-container-highest)` | `surface-container-highest` | `.Back.highest` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Back.variant` |
| `color/background/fg` | `var(--color-content)` | `on-surface` | `.Fore.primary` |
| `color/background/fg-subtle` | `var(--color-content-muted)` | `on-surface-variant` | `.Fore.secondary` |
| `color/background/inverse` | `var(--color-inverse-surface)` | `inverse-surface` | `.Back.inverse` |
| `color/background/inverse-fg` | `var(--color-inverse-content)` | `inverse-on-surface` | `.Fore.inverse` |
| `color/background/inverse-primary` | `var(--color-inverse-brand)` | `inverse-primary` | `.Primary.inverse` |
| `color/background/scrim` | `var(--color-scrim)` | `scrim` | `.Effect.scrim` |
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Back.shadowTint` |

#### `border/` — Outline roles (WEB `--color-border*`)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/border/subtle` | `var(--color-border-subtle)` | `outline-variant` | `.Border.subtle` |

#### Core M3 `ColorScheme` roles — brand + status (ANDROID column)

| Figma variable | WEB | ANDROID | iOS (semantic) |
|---|---|---|---|
| `color/primary/default` | `var(--color-primary)` | `primary` | `.Primary.default` |
| `color/primary/fg` | `var(--color-on-primary)` | `on-primary` | `.Primary.on` |
| `color/primary/tint` | `var(--color-primary-soft)` | `primary-container` | `.Primary.subtle` |
| `color/primary/fg-on-tint` | `var(--color-on-primary-soft)` | `on-primary-container` | `.Primary.onSubtle` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/fixed-dim` | `var(--color-primary-fixed-dim)` | `primary-fixed-dim` | `.Primary.fixedDim` |
| `color/primary/on-fixed` | `var(--color-on-primary-fixed)` | `on-primary-fixed` | `.Primary.onFixed` |
| `color/primary/on-fixed-variant` | `var(--color-on-primary-fixed-muted)` | `on-primary-fixed-variant` | `.Primary.onFixedMuted` |
| `color/secondary/default` | `var(--color-secondary)` | `secondary` | `.Secondary.default` |
| `color/secondary/fg` | `var(--color-on-secondary)` | `on-secondary` | `.Secondary.on` |
| `color/secondary/tint` | `var(--color-secondary-soft)` | `secondary-container` | `.Secondary.subtle` |
| `color/secondary/fg-on-tint` | `var(--color-on-secondary-soft)` | `on-secondary-container` | `.Secondary.onSubtle` |
| `color/secondary/fixed` | `var(--color-secondary-fixed)` | `secondary-fixed` | `.Secondary.fixed` |
| `color/secondary/fixed-dim` | `var(--color-secondary-fixed-dim)` | `secondary-fixed-dim` | `.Secondary.fixedDim` |
| `color/secondary/on-fixed` | `var(--color-on-secondary-fixed)` | `on-secondary-fixed` | `.Secondary.onFixed` |
| `color/secondary/on-fixed-variant` | `var(--color-on-secondary-fixed-muted)` | `on-secondary-fixed-variant` | `.Secondary.onFixedMuted` |
| `color/tertiary/default` | `var(--color-accent)` | `tertiary` | `.Tertiary.default` |
| `color/tertiary/fg` | `var(--color-on-accent)` | `on-tertiary` | `.Tertiary.on` |
| `color/tertiary/tint` | `var(--color-accent-soft)` | `tertiary-container` | `.Tertiary.subtle` |
| `color/tertiary/fg-on-tint` | `var(--color-on-accent-soft)` | `on-tertiary-container` | `.Tertiary.onSubtle` |
| `color/tertiary/fixed` | `var(--color-accent-fixed)` | `tertiary-fixed` | `.Tertiary.fixed` |
| `color/tertiary/fixed-dim` | `var(--color-accent-fixed-dim)` | `tertiary-fixed-dim` | `.Tertiary.fixedDim` |
| `color/tertiary/on-fixed` | `var(--color-on-accent-fixed)` | `on-tertiary-fixed` | `.Tertiary.onFixed` |
| `color/tertiary/on-fixed-variant` | `var(--color-on-accent-fixed-muted)` | `on-tertiary-fixed-variant` | `.Tertiary.onFixedMuted` |
| `color/status/error` | `var(--color-danger)` | `error` | `.Status.error` |
| `color/status/error-fg` | `var(--color-on-danger)` | `on-error` | `.Status.onError` |
| `color/status/error-tint` | `var(--color-danger-soft)` | `error-container` | `.Status.errorSubtle` |
| `color/status/error-fg-on-tint` | `var(--color-on-danger-soft)` | `on-error-container` | `.Status.onErrorSubtle` |
| `color/status/error-fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.errorFixed` |
| `color/status/error-fixed-dim` | `var(--color-danger-fixed-dim)` | `error-fixed-dim` | `.Status.errorFixedDim` |
| `color/status/error-on-fixed` | `var(--color-on-danger-fixed)` | `on-error-fixed` | `.Status.onErrorFixed` |
| `color/status/error-on-fixed-variant` | `var(--color-on-danger-fixed-muted)` | `on-error-fixed-variant` | `.Status.onErrorFixedMuted` |

#### Extensions (not in core M3 baseline diagram — shadcn alignment)

| Figma variable | WEB | ANDROID (extension) | iOS (semantic) |
|---|---|---|---|
| `color/component/input` | `var(--color-field)` | `input` | `.Component.field` |
| `color/component/ring` | `var(--color-focus-ring)` | `ring` | `.Component.ring` |
| `color/component/sidebar` | `var(--color-sidebar)` | `sidebar` | `.Component.sidebar` |
| `color/component/sidebar-fg` | `var(--color-on-sidebar)` | `sidebar-foreground` | `.Component.sidebarOn` |

---

## Step 7 — Generate the Typography collection (8 scale modes)

Create (or update) the `Typography` collection with **eight modes** named exactly:
`85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`

The `100` mode is the base/default.

### Style slots (12 slots × 4 properties = 48 variables)

Each slot has four variables: `font-family` (STRING), `font-size` (FLOAT), `font-weight` (FLOAT), `line-height` (FLOAT).

Slots: `Display/LG`, `Display/MD`, `Display/SM`, `Headline/LG`, `Headline/MD`, `Headline/SM`, `Body/LG`, `Body/MD`, `Body/SM`, `Label/LG`, `Label/MD`, `Label/SM`

Example variable names: `Display/LG/font-size`, `Body/MD/font-family`, `Label/SM/font-weight`

### Base values (mode `100`)

| Style | font-family | font-size | font-weight | line-height |
|---|---|---|---|---|
| `Display/LG` | display font | 57 | 400 | 64 |
| `Display/MD` | display font | 45 | 400 | 52 |
| `Display/SM` | display font | 36 | 400 | 44 |
| `Headline/LG` | display font | 32 | 400 | 40 |
| `Headline/MD` | display font | 28 | 400 | 36 |
| `Headline/SM` | display font | 24 | 400 | 32 |
| `Body/LG` | body font | 16 | 400 | 24 |
| `Body/MD` | body font | 14 | 400 | 20 |
| `Body/SM` | body font | 12 | 400 | 16 |
| `Label/LG` | body font | 14 | 500 | 20 |
| `Label/MD` | body font | 12 | 500 | 16 |
| `Label/SM` | body font | 11 | 500 | 16 |

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

**iOS** — **dot path** under `.Typography.{slot}.{property}` with **lowerCamel** property tails: `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`. Slot uses lowerCamel from the path (`displayLg`, `headlineMd`, `bodySm`, `labelSm`).

Every variable in all 12 slots follows this pattern — apply to all 48 variables:

| Property | WEB example | ANDROID | iOS (semantic) |
|---|---|---|---|
| `Display/LG/font-family` | `var(--display-lg-font-family)` | `display-lg-font-family` | `.Typography.displayLg.fontFamily` |
| `Display/LG/font-size` | `var(--display-lg-font-size)` | `display-lg-font-size` | `.Typography.displayLg.fontSize` |
| `Display/LG/font-weight` | `var(--display-lg-font-weight)` | `display-lg-font-weight` | `.Typography.displayLg.fontWeight` |
| `Display/LG/line-height` | `var(--display-lg-line-height)` | `display-lg-line-height` | `.Typography.displayLg.lineHeight` |
| `Headline/LG/font-size` | `var(--headline-lg-font-size)` | `headline-lg-font-size` | `.Typography.headlineLg.fontSize` |
| `Body/MD/font-family` | `var(--body-md-font-family)` | `body-md-font-family` | `.Typography.bodyMd.fontFamily` |
| `Label/SM/font-weight` | `var(--label-sm-font-weight)` | `label-sm-font-weight` | `.Typography.labelSm.fontWeight` |

(Pattern repeats for all 12 slots: Display/LG, Display/MD, Display/SM, Headline/LG, Headline/MD, Headline/SM, Body/LG, Body/MD, Body/SM, Label/LG, Label/MD, Label/SM — each with the same 4 properties.)

---

## Step 8 — Generate the Layout collection

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

## Step 10 — Present design system plan and get approval

Before writing anything to Figma or the filesystem, present a full summary of every token that will be created and call **AskUserQuestion** to get explicit approval or change requests.

### 10a — Build and display the plan

Show the plan using this exact structure. Substitute all `{…}` placeholders with the actual computed values from Steps 5–9. Include **`Theme source: brand`** or **`Theme source: baseline`** on its own line (from `THEME_SOURCE`). For **baseline**, show the literal M3 seed hexes from Step 5 in the ramp headers instead of designer `{inputHex}` values.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DESIGN SYSTEM PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Figma file: {TARGET_FILE_KEY}
  CSS output: {TOKEN_CSS_PATH}
  Theme source: {THEME_SOURCE}

  Code syntax pattern: every variable includes WEB / ANDROID / iOS tokens.
  **ANDROID** uses **kebab-case** (matches WEB token names without `var()`). **iOS** uses **dot-path semantics** (e.g. `.Palette.primary.500`, `.Space.400`). Theme rows follow Step 6 exactly.

──────────────────────────────────────────────────────────────────────────────────────────────
  PRIMITIVES
──────────────────────────────────────────────────────────────────────────────────────────────
  Syntax pattern:
    WEB:     var(--color-{name}-{stop})  →  e.g. var(--color-primary-500)
    ANDROID: color-{name}-{stop}        →  e.g. color-primary-500  (kebab-case)
    iOS:     .Palette.{name}.{stop}      →  e.g. .Palette.primary.500  (dot path)

  Color ramps — 5 ramps × 11 stops

    Primary   {inputHex}
       50 {hex}  100 {hex}  200 {hex}  300 {hex}  400 {hex}
      500 {hex}  600 {hex}  700 {hex}  800 {hex}  900 {hex}  950 {hex}

    Secondary {inputHex}
       50 {hex}  100 {hex}  200 {hex}  300 {hex}  400 {hex}
      500 {hex}  600 {hex}  700 {hex}  800 {hex}  900 {hex}  950 {hex}

    Tertiary  {inputHex}
       50 {hex}  100 {hex}  200 {hex}  300 {hex}  400 {hex}
      500 {hex}  600 {hex}  700 {hex}  800 {hex}  900 {hex}  950 {hex}

    Error     {inputHex}
       50 {hex}  100 {hex}  200 {hex}  300 {hex}  400 {hex}
      500 {hex}  600 {hex}  700 {hex}  800 {hex}  900 {hex}  950 {hex}

    Neutral   {inputHex}
       50 {hex}  100 {hex}  200 {hex}  300 {hex}  400 {hex}
      500 {hex}  600 {hex}  700 {hex}  800 {hex}  900 {hex}  950 {hex}

  Spacing — base {N}px
    Token          Value    WEB                  ANDROID / iOS
    Space/100      {N}px    var(--space-100)      space-100 · .Space.100
    Space/200      {N}px    var(--space-200)      space-200 · .Space.200
    Space/300      {N}px    var(--space-300)      space-300 · .Space.300
    Space/400      {N}px    var(--space-400)      space-400 · .Space.400
    Space/600      {N}px    var(--space-600)      space-600 · .Space.600
    Space/800      {N}px    var(--space-800)      space-800 · .Space.800
    Space/1200     {N}px    var(--space-1200)     space-1200 · .Space.1200
    Space/1600     {N}px    var(--space-1600)     space-1600 · .Space.1600
    (+ Space/500, 700, 900, 1000, 1100, 2000, 2400)

  Radius — base {N}px
    Token                Value    WEB                       ANDROID / iOS
    Corner/None          0px      var(--corner-none)        corner-none · .Corner.none
    Corner/Extra-small   {N}px    var(--corner-extra-small) corner-extra-small · .Corner.extraSmall
    Corner/Small         {N}px    var(--corner-small)       corner-small · .Corner.small
    Corner/Medium        {N}px    var(--corner-medium)      corner-medium · .Corner.medium
    Corner/Large         {N}px    var(--corner-large)       corner-large · .Corner.large
    Corner/Extra-large   28px     var(--corner-extra-large) corner-extra-large · .Corner.extraLarge
    Corner/Full          9999px   var(--corner-full)        corner-full · .Corner.full

  Elevation
    Token           Value    WEB                    ANDROID / iOS
    elevation/100   1        var(--elevation-100)   elevation-100 · .Elevation.100
    elevation/200   2        var(--elevation-200)   elevation-200 · .Elevation.200
    elevation/400   4        var(--elevation-400)   elevation-400 · .Elevation.400
    elevation/800   8        var(--elevation-800)   elevation-800 · .Elevation.800
    elevation/1600  16       var(--elevation-1600)  elevation-1600 · .Elevation.1600

──────────────────────────────────────────────────────────────────────────────────────────────
  THEME  (54 tokens · 2 modes: Light / Dark)
──────────────────────────────────────────────────────────────────────────────────────────────
  codeSyntax is set explicitly per token — NOT derived from the variable path.
  **`background/`** names the app canvas and tonal layers in Figma; ANDROID uses M3 roles in **kebab-case**; iOS uses **dot paths** (see Step 6). **`border/`** holds outline tokens. `component/*` = shadcn extensions only.

  Figma variable                  Light   Dark    WEB (Tailwind @theme–friendly)   ANDROID (M3 kebab)        iOS (semantic)
  — background/ (M3 surface roles on mobile) —
  color/background/dim            {hex}   {hex}   var(--color-background-dim)      surface-dim               .Back.dim
  color/background/default        {hex}   {hex}   var(--color-background)          surface                   .Back.default
  color/background/bright         {hex}   {hex}   var(--color-background-bright)   surface-bright            .Back.bright
  color/background/container-lowest {hex} {hex}   var(--color-background-container-lowest) surface-container-lowest .Back.lowest
  color/background/container-low  {hex}   {hex}   var(--color-background-container-low)    surface-container-low      .Back.low
  color/background/container      {hex}   {hex}   var(--color-background-container)        surface-container         .Back.mid
  color/background/container-high {hex}   {hex}   var(--color-background-container-high)   surface-container-high     .Back.high
  color/background/container-highest {hex} {hex}   var(--color-background-container-highest) surface-container-highest .Back.highest
  color/background/variant        {hex}   {hex}   var(--color-background-variant)  surface-variant            .Back.variant
  color/background/fg             {hex}   {hex}   var(--color-content)             on-surface                 .Fore.primary
  color/background/fg-subtle      {hex}   {hex}   var(--color-content-muted)       on-surface-variant          .Fore.secondary
  color/background/inverse        {hex}   {hex}   var(--color-inverse-surface)     inverse-surface            .Back.inverse
  color/background/inverse-fg     {hex}   {hex}   var(--color-inverse-content)     inverse-on-surface          .Fore.inverse
  color/background/inverse-primary {hex}  {hex}   var(--color-inverse-brand)       inverse-primary            .Primary.inverse
  color/background/scrim          rgba…   rgba…   var(--color-scrim)               scrim                     .Effect.scrim
  color/background/shadow         rgba…   rgba…   var(--color-shadow-tint)         shadow                    .Back.shadowTint
  — border/ (outline) —
  color/border/default            {hex}   {hex}   var(--color-border)              outline                   .Border.default
  color/border/subtle             {hex}   {hex}   var(--color-border-subtle)       outline-variant            .Border.subtle
  — primary/ —
  color/primary/default           {hex}   {hex}   var(--color-primary)             primary                   .Primary.default
  color/primary/fg                {hex}   {hex}   var(--color-on-primary)          on-primary                 .Primary.on
  color/primary/tint              {hex}   {hex}   var(--color-primary-soft)        primary-container          .Primary.subtle
  color/primary/fg-on-tint        {hex}   {hex}   var(--color-on-primary-soft)     on-primary-container        .Primary.onSubtle
  color/primary/fixed             {hex}   {hex}   var(--color-primary-fixed)       primary-fixed              .Primary.fixed
  color/primary/fixed-dim         {hex}   {hex}   var(--color-primary-fixed-dim)   primary-fixed-dim           .Primary.fixedDim
  color/primary/on-fixed          {hex}   {hex}   var(--color-on-primary-fixed)    on-primary-fixed            .Primary.onFixed
  color/primary/on-fixed-variant  {hex}   {hex}   var(--color-on-primary-fixed-muted) on-primary-fixed-variant  .Primary.onFixedMuted
  — secondary/ —
  color/secondary/default         {hex}   {hex}   var(--color-secondary)           secondary                 .Secondary.default
  color/secondary/fg              {hex}   {hex}   var(--color-on-secondary)        on-secondary               .Secondary.on
  color/secondary/tint            {hex}   {hex}   var(--color-secondary-soft)      secondary-container        .Secondary.subtle
  color/secondary/fg-on-tint      {hex}   {hex}   var(--color-on-secondary-soft)   on-secondary-container      .Secondary.onSubtle
  color/secondary/fixed           {hex}   {hex}   var(--color-secondary-fixed)     secondary-fixed            .Secondary.fixed
  color/secondary/fixed-dim       {hex}   {hex}   var(--color-secondary-fixed-dim) secondary-fixed-dim         .Secondary.fixedDim
  color/secondary/on-fixed        {hex}   {hex}   var(--color-on-secondary-fixed)  on-secondary-fixed          .Secondary.onFixed
  color/secondary/on-fixed-variant {hex}  {hex}   var(--color-on-secondary-fixed-muted) on-secondary-fixed-variant .Secondary.onFixedMuted
  — tertiary/ —
  color/tertiary/default          {hex}   {hex}   var(--color-accent)              tertiary                  .Tertiary.default
  color/tertiary/fg               {hex}   {hex}   var(--color-on-accent)           on-tertiary                .Tertiary.on
  color/tertiary/tint             {hex}   {hex}   var(--color-accent-soft)         tertiary-container         .Tertiary.subtle
  color/tertiary/fg-on-tint       {hex}   {hex}   var(--color-on-accent-soft)      on-tertiary-container       .Tertiary.onSubtle
  color/tertiary/fixed            {hex}   {hex}   var(--color-accent-fixed)        tertiary-fixed             .Tertiary.fixed
  color/tertiary/fixed-dim        {hex}   {hex}   var(--color-accent-fixed-dim)    tertiary-fixed-dim          .Tertiary.fixedDim
  color/tertiary/on-fixed         {hex}   {hex}   var(--color-on-accent-fixed)     on-tertiary-fixed           .Tertiary.onFixed
  color/tertiary/on-fixed-variant {hex}   {hex}   var(--color-on-accent-fixed-muted) on-tertiary-fixed-variant  .Tertiary.onFixedMuted
  — status/ —
  color/status/error              {hex}   {hex}   var(--color-danger)              error                     .Status.error
  color/status/error-fg           {hex}   {hex}   var(--color-on-danger)           on-error                   .Status.onError
  color/status/error-tint         {hex}   {hex}   var(--color-danger-soft)         error-container            .Status.errorSubtle
  color/status/error-fg-on-tint   {hex}   {hex}   var(--color-on-danger-soft)      on-error-container          .Status.onErrorSubtle
  color/status/error-fixed        {hex}   {hex}   var(--color-danger-fixed)        error-fixed                .Status.errorFixed
  color/status/error-fixed-dim    {hex}   {hex}   var(--color-danger-fixed-dim)    error-fixed-dim             .Status.errorFixedDim
  color/status/error-on-fixed     {hex}   {hex}   var(--color-on-danger-fixed)     on-error-fixed              .Status.onErrorFixed
  color/status/error-on-fixed-variant {hex} {hex} var(--color-on-danger-fixed-muted) on-error-fixed-variant    .Status.onErrorFixedMuted
  — component/ (shadcn extensions) —
  color/component/input           {hex}   {hex}   var(--color-field)               input                     .Component.field
  color/component/ring            {hex}   {hex}   var(--color-focus-ring)          ring                      .Component.ring
  color/component/sidebar         {hex}   {hex}   var(--color-sidebar)             sidebar                   .Component.sidebar
  color/component/sidebar-fg      {hex}   {hex}   var(--color-on-sidebar)          sidebar-foreground         .Component.sidebarOn

──────────────────────────────────────────────────────────────────────────────────────────────
  TYPOGRAPHY  (48 variables · 8 scale modes)
──────────────────────────────────────────────────────────────────────────────────────────────
  Body font: {bodyFont}   Display font: {displayFont}
  Syntax pattern: {slot}/{property} → kebab → WEB var(--{slot}-{property}) · ANDROID kebab · iOS dot path

  Slot          Prop          WEB syntax                      ANDROID          iOS (semantic)
  Display/LG    font-size     var(--display-lg-font-size)     display-lg-font-size     .Typography.display.lg.fontSize
                font-family   var(--display-lg-font-family)   display-lg-font-family   .Typography.display.lg.fontFamily
                font-weight   var(--display-lg-font-weight)   display-lg-font-weight   .Typography.display.lg.fontWeight
                line-height   var(--display-lg-line-height)   display-lg-line-height   .Typography.display.lg.lineHeight
  (pattern repeats for all 12 slots)

  Sizes — 100 (default) / 130 (large) / 200 (max):
  Slot           100      130      200
  Display/LG     57px     {N}px    {N}px
  Display/MD     45px     {N}px    {N}px
  Display/SM     36px     {N}px    {N}px
  Headline/LG    32px     {N}px    {N}px
  Headline/MD    28px     {N}px    {N}px
  Headline/SM    24px     {N}px    {N}px
  Body/LG        16px     {N}px    {N}px
  Body/MD        14px     {N}px    {N}px
  Body/SM        12px     {N}px    {N}px
  Label/LG       14px     {N}px    {N}px
  Label/MD       12px     {N}px    {N}px
  Label/SM       11px     {N}px    {N}px
  (font-family and font-weight constant across all 8 modes)

──────────────────────────────────────────────────────────────────────────────────────────────
  LAYOUT  (15 tokens · Default mode)
──────────────────────────────────────────────────────────────────────────────────────────────
  Token        Value    WEB                   ANDROID / iOS
  space/xs     {N}px    var(--space-xs)        space-xs · .Layout.space.xs
  space/sm     {N}px    var(--space-sm)        space-sm · .Layout.space.sm
  space/md     {N}px    var(--space-md)        space-md · .Layout.space.md
  space/lg     {N}px    var(--space-lg)        space-lg · .Layout.space.lg
  space/xl     {N}px    var(--space-xl)        space-xl · .Layout.space.xl
  space/2xl    {N}px    var(--space-2xl)       space-2xl · .Layout.space.2xl
  space/3xl    {N}px    var(--space-3xl)       space-3xl · .Layout.space.3xl
  space/4xl    {N}px    var(--space-4xl)       space-4xl · .Layout.space.4xl
  radius/none  0px      var(--radius-none)     radius-none · .Layout.radius.none
  radius/xs    {N}px    var(--radius-xs)       radius-xs · .Layout.radius.xs
  radius/sm    {N}px    var(--radius-sm)       radius-sm · .Layout.radius.sm
  radius/md    {N}px    var(--radius-md)       radius-md · .Layout.radius.md
  radius/lg    {N}px    var(--radius-lg)       radius-lg · .Layout.radius.lg
  radius/xl    28px     var(--radius-xl)       radius-xl · .Layout.radius.xl
  radius/full  9999px   var(--radius-full)     radius-full · .Layout.radius.full

──────────────────────────────────────────────────────────────────────────────────────────────
  EFFECTS  (6 tokens · 2 modes: Light / Dark)
──────────────────────────────────────────────────────────────────────────────────────────────
  Token            Light              Dark               WEB                     ANDROID / iOS
  shadow/color     rgba(0,0,0,0.10)   rgba(0,0,0,0.30)   var(--shadow-color)     shadow · .Effect.shadow.color
  shadow/sm/blur   1px                1px                var(--shadow-sm-blur)   shadow-sm-blur · .Effect.shadow.sm.blur
  shadow/md/blur   2px                2px                var(--shadow-md-blur)   shadow-md-blur · .Effect.shadow.md.blur
  shadow/lg/blur   4px                4px                var(--shadow-lg-blur)   shadow-lg-blur · .Effect.shadow.lg.blur
  shadow/xl/blur   8px                8px                var(--shadow-xl-blur)   shadow-xl-blur · .Effect.shadow.xl.blur
  shadow/2xl/blur  16px               16px               var(--shadow-2xl-blur)  shadow-2xl-blur · .Effect.shadow.2xl.blur

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Show the full hex values for all 11 stops in each color ramp — do not abbreviate. Show the computed (rounded) font sizes for the `100`, `130`, and `200` modes for every typography slot. Resolve all `{hex}` and `{N}px` values from the token data computed in Steps 5–9 — do not print placeholder text.

### 10b — Ask for approval

Call **AskUserQuestion**:

> "Does this design system look correct? Reply **yes** to push to Figma and write the CSS file, or describe any changes (e.g. 'change primary to #E63946', 'use Geist for body font', 'base radius 8px')."

**If the designer replies yes:** proceed to Step 11.

**If the designer requests changes:** identify which inputs need to change and loop back to the appropriate step:
- Color changes → recompute the affected ramp(s) in Step 5, then re-derive all Theme aliases that reference that ramp in Step 6, then re-display the updated plan section and call **AskUserQuestion** again
- Font changes → update typography values in Step 7, re-display the typography table, call **AskUserQuestion** again
- Spacing or radius changes → recompute the affected scale in Step 5 and layout aliases in Step 8, re-display the relevant sections, call **AskUserQuestion** again
- CSS path change → update `TOKEN_CSS_PATH`, re-display the header line, call **AskUserQuestion** again

Do not proceed to Step 11 until the designer has explicitly replied **yes** (or an equivalent affirmative).

---

## Step 11 — Push all collections to Figma

Assemble a single `PUT /v1/files/{TARGET_FILE_KEY}/variables` payload covering all five collections.

### Payload structure

```json
{
  "variableCollections": [
    { "id": "TEMP_COLLECTION_PRIMITIVES", "name": "Primitives", "action": "CREATE" },
    { "id": "TEMP_COLLECTION_THEME", "name": "Theme", "action": "CREATE" },
    { "id": "TEMP_COLLECTION_TYPOGRAPHY", "name": "Typography", "action": "CREATE" },
    { "id": "TEMP_COLLECTION_LAYOUT", "name": "Layout", "action": "CREATE" },
    { "id": "TEMP_COLLECTION_EFFECTS", "name": "Effects", "action": "CREATE" }
  ],
  "variableModes": [
    { "id": "TEMP_MODE_PRIM_DEFAULT",   "variableCollectionId": "TEMP_COLLECTION_PRIMITIVES", "name": "Default", "action": "CREATE" },
    { "id": "TEMP_MODE_THEME_LIGHT",    "variableCollectionId": "TEMP_COLLECTION_THEME",      "name": "Light",   "action": "CREATE" },
    { "id": "TEMP_MODE_THEME_DARK",     "variableCollectionId": "TEMP_COLLECTION_THEME",      "name": "Dark",    "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_85",        "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "85",      "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_100",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "100",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_110",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "110",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_120",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "120",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_130",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "130",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_150",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "150",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_175",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "175",     "action": "CREATE" },
    { "id": "TEMP_MODE_TYPE_200",       "variableCollectionId": "TEMP_COLLECTION_TYPOGRAPHY", "name": "200",     "action": "CREATE" },
    { "id": "TEMP_MODE_LAYOUT_DEFAULT", "variableCollectionId": "TEMP_COLLECTION_LAYOUT",     "name": "Default", "action": "CREATE" },
    { "id": "TEMP_MODE_FX_LIGHT",       "variableCollectionId": "TEMP_COLLECTION_EFFECTS",    "name": "Light",   "action": "CREATE" },
    { "id": "TEMP_MODE_FX_DARK",        "variableCollectionId": "TEMP_COLLECTION_EFFECTS",    "name": "Dark",    "action": "CREATE" }
  ],
  "variables": [ ... ],
  "variableModeValues": [ ... ]
}
```

For **UPDATE** passes (collection already exists from the registry in Step 4), use the real existing collection and mode IDs instead of `TEMP_*` strings, and set `"action": "UPDATE"` on each collection entry.

### Variables array

> **codeSyntax is MANDATORY on every variable. Never omit it, never leave it empty. A variable pushed without codeSyntax is broken — it will not resolve to any platform token name.** Use the tables in Steps 5–9 to look up each value; do NOT derive from the Figma path for Theme variables.

> **Key casing is exact:** `"WEB"`, `"ANDROID"`, `"iOS"` — the iOS key is mixed case (capital I, lowercase o, capital S). Never write `"ios"` or `"IOS"`. The Figma API silently ignores incorrectly cased keys, which is why iOS syntax disappears from variables when the case is wrong.

Each entry — showing a real Theme example:
```json
{
  "id": "TEMP_VAR_COLOR_BACKGROUND_DEFAULT",
  "name": "color/background/default",
  "variableCollectionId": "TEMP_COLLECTION_THEME",
  "resolvedType": "COLOR",
  "action": "CREATE",
  "codeSyntax": {
    "WEB":     "var(--color-background)",
    "ANDROID": "surface",
    "iOS":     ".Back.default"
  }
}
```

The `"ANDROID"` value is the **M3 `ColorScheme` role** in **kebab-case** (same role as `MaterialTheme.colorScheme.surface` in Compose — here `surface` is already a single word). Multi-word Compose properties become hyphenated (e.g. `surface-container-high`).

The `"iOS"` value is a **semantic dot path** (e.g. `.Back.default`, `.Back.high`) — not a `UIColor` symbol name. Never copy the ANDROID string into iOS; always read both columns from the Step 6 table.

Look up each variable's three codeSyntax values from the appropriate step:
- Primitives (`color/*`, `Space/*`, `Corner/*`, `elevation/*`) → Step 5 codeSyntax rules
- Theme (`color/background/*`, `color/border/*`, `color/primary/*`, `color/secondary/*`, `color/tertiary/*`, `color/status/*`, `color/component/*`) → Step 6 codeSyntax table (use the exact row — do NOT derive from path, do NOT copy ANDROID value into iOS)
- Typography (`Display/*`, `Headline/*`, `Body/*`, `Label/*`) → Step 7 codeSyntax rules
- Layout (`space/*`, `radius/*`) → Step 8 codeSyntax rules
- Effects (`shadow/*`) → Step 9 codeSyntax rules

### variableModeValues array

Each entry: `{ "variableId": "TEMP_VAR_{NAME}", "modeId": "TEMP_MODE_{...}", "value": <value> }`

For alias values: `"value": { "type": "VARIABLE_ALIAS", "id": "<primitive-variable-id>" }`
For hard-coded COLOR: `"value": { "r": 0, "g": 0, "b": 0, "a": 0.32 }` (Figma COLOR uses 0–1 float channels)
For hard-coded FLOAT: `"value": 57`

**Execution:** call the Figma Variables REST API directly — `PUT https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables` — via the Figma MCP connector.

> **Do NOT use `use_figma` for this step.** The Figma Plugin API exposes `codeSyntax` as read-only. Setting `codeSyntax` on variables requires the REST API. This is the only path that works.

### Error — partial write failure

If the API returns `200` with an `errors` array, retry each failed variable individually in a second `PUT`. If retry fails, call **AskUserQuestion**: "These variables failed after retry: {names}. Reply **skip** to continue without them, or **abort** to stop the skill."

---

## Step 12 — Verify the write

After the PUT completes, read the current variable state again via `mcp__claude_ai_Figma__get_variable_defs` or a direct REST GET:

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Confirm:
- All five collections exist: `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`
- `Theme` has exactly 2 modes: `Light` and `Dark`
- `Typography` has exactly 8 modes: `85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`
- `Primitives` contains the expected 5 color ramps (primary, secondary, tertiary, error, neutral)
- No `Web`, `Android/M3`, or separate iOS-only collections were created

**codeSyntax spot-check — verify at least these three variables have all three platform values populated with the correct casing (`"iOS"`, not `"ios"`):**

| Variable | Expected WEB | Expected ANDROID | Expected `"iOS"` key |
|---|---|---|---|
| `color/background/default` (Theme) | `var(--color-background)` | `surface` | `.Back.default` |
| `color/status/error` (Theme) | `var(--color-danger)` | `error` | `.Status.error` |
| `color/primary/500` (Primitives) | `var(--color-primary-500)` | `color-primary-500` | `.Palette.primary.500` |

If the `iOS` key is absent or its value **equals** the ANDROID value on Theme variables (e.g. both `surface` on `color/background/default` instead of iOS `.Back.default`), the write used wrong key casing or copied ANDROID into iOS. Re-issue a `PUT` with correct `"iOS"` casing on all affected variables before proceeding to Step 13.

Report any expected variables absent from the verified response.

---

## Step 13 — Write CSS token file

Using all token values resolved in Steps 5–9, generate a `tokens.css` file and write it to the local codebase. This file is the code-side source of truth that `/create-component` and `/code-connect` depend on.

### 13a — Resolve output path

Call **AskUserQuestion**:

> "Where should I write the CSS token file in your project? (default: `src/styles/tokens.css`)"

If the designer presses enter or replies with the default, use `src/styles/tokens.css`. Validate that the parent directory path is plausible. Do not create directories — if the parent does not exist, report it and ask for a different path.

Store the resolved path as `TOKEN_CSS_PATH`.

### 13b — Generate and write the CSS file

Construct the full CSS file content using this exact structure and write it to `TOKEN_CSS_PATH`. Substitute all `{…}` placeholders with the resolved brand token values from your working context.

```css
/* =============================================================================
   {PROJECT_NAME} — Design System Tokens
   Generated by /create-design-system · DO NOT EDIT MANUALLY
   Re-run /create-design-system to regenerate.
   ============================================================================= */

/* ─── Primitives ─────────────────────────────────────────────────────────── */
:root {
  /* Color — Primary */
  --color-primary-50:  {hex};
  --color-primary-100: {hex};
  --color-primary-200: {hex};
  --color-primary-300: {hex};
  --color-primary-400: {hex};
  --color-primary-500: {hex};
  --color-primary-600: {hex};
  --color-primary-700: {hex};
  --color-primary-800: {hex};
  --color-primary-900: {hex};
  --color-primary-950: {hex};

  /* Color — Secondary */
  --color-secondary-50:  {hex};
  /* …repeat for all 11 stops… */

  /* Color — Tertiary */
  --color-tertiary-50:  {hex};
  /* …repeat for all 11 stops… */

  /* Color — Error */
  --color-error-50:  {hex};
  /* …repeat for all 11 stops… */

  /* Color — Neutral */
  --color-neutral-50:  {hex};
  /* …repeat for all 11 stops… */

  /* Spacing */
  --space-100: {base * 1}px;
  --space-200: {base * 2}px;
  --space-300: {base * 3}px;
  --space-400: {base * 4}px;
  --space-500: {base * 5}px;
  --space-600: {base * 6}px;
  --space-700: {base * 7}px;
  --space-800: {base * 8}px;
  --space-900: {base * 9}px;
  --space-1000: {base * 10}px;
  --space-1100: {base * 11}px;
  --space-1200: {base * 12}px;
  --space-1600: {base * 16}px;
  --space-2000: {base * 20}px;
  --space-2400: {base * 24}px;

  /* Corner */
  --corner-none:        0px;
  --corner-extra-small: {base * 1}px;
  --corner-small:       {base * 2}px;
  --corner-medium:      {base * 3}px;
  --corner-large:       {base * 4}px;
  --corner-extra-large: 28px;
  --corner-full:        9999px;

  /* Elevation (unitless — used as px values in box-shadow) */
  --elevation-100:  1;
  --elevation-200:  2;
  --elevation-400:  4;
  --elevation-800:  8;
  --elevation-1600: 16;
}

/* ─── Layout ──────────────────────────────────────────────────────────────── */
:root {
  /* Spacing aliases */
  --space-xs:  var(--space-100);
  --space-sm:  var(--space-200);
  --space-md:  var(--space-300);
  --space-lg:  var(--space-400);
  --space-xl:  var(--space-600);
  --space-2xl: var(--space-800);
  --space-3xl: var(--space-1200);
  --space-4xl: var(--space-1600);

  /* Radius aliases */
  --radius-none: var(--corner-none);
  --radius-xs:   var(--corner-extra-small);
  --radius-sm:   var(--corner-small);
  --radius-md:   var(--corner-medium);
  --radius-lg:   var(--corner-large);
  --radius-xl:   var(--corner-extra-large);
  --radius-full: var(--corner-full);

  /* shadcn/ui base radius alias — maps to --radius-md by default */
  --radius: var(--radius-md);
}

/* ─── Theme — Light ─────────────────────────────────────────────────────── */
:root, [data-theme="light"] {
  /* Canonical WEB tokens — Tailwind v4 @theme: declare @theme { --color-*: … } mirroring these names → bg-background, text-content-muted, border-border, etc. */
  --color-background-dim:                 var(--color-neutral-100);
  --color-background:                     var(--color-neutral-50);
  --color-background-bright:              var(--color-neutral-50);
  --color-background-container-lowest:    var(--color-neutral-50);
  --color-background-container-low:       var(--color-neutral-100);
  --color-background-container:           var(--color-neutral-200);
  --color-background-container-high:      var(--color-neutral-300);
  --color-background-container-highest:   var(--color-neutral-50);
  --color-background-variant:             var(--color-neutral-100);
  --color-content:                   var(--color-neutral-900);
  --color-content-muted:             var(--color-neutral-500);
  --color-border:                    var(--color-neutral-200);
  --color-border-subtle:             var(--color-neutral-100);
  --color-inverse-surface:           var(--color-neutral-950);
  --color-inverse-content:           var(--color-neutral-50);
  --color-inverse-brand:             var(--color-primary-300);
  --color-scrim:                     rgba(0, 0, 0, 0.32);
  --color-shadow-tint:               rgba(0, 0, 0, 0.15);

  --color-primary:                   var(--color-primary-500);
  --color-on-primary:                var(--color-primary-50);
  --color-primary-soft:              var(--color-primary-100);
  --color-on-primary-soft:           var(--color-primary-900);
  --color-primary-fixed:             var(--color-primary-100);
  --color-primary-fixed-dim:         var(--color-primary-200);
  --color-on-primary-fixed:          var(--color-primary-900);
  --color-on-primary-fixed-muted:    var(--color-primary-800);

  --color-secondary:                 var(--color-secondary-500);
  --color-on-secondary:              var(--color-secondary-50);
  --color-secondary-soft:            var(--color-secondary-100);
  --color-on-secondary-soft:         var(--color-secondary-900);
  --color-secondary-fixed:           var(--color-secondary-100);
  --color-secondary-fixed-dim:       var(--color-secondary-200);
  --color-on-secondary-fixed:        var(--color-secondary-900);
  --color-on-secondary-fixed-muted:  var(--color-secondary-800);

  --color-accent:                    var(--color-tertiary-500);
  --color-on-accent:                 var(--color-tertiary-50);
  --color-accent-soft:               var(--color-tertiary-100);
  --color-on-accent-soft:            var(--color-tertiary-900);
  --color-accent-fixed:              var(--color-tertiary-100);
  --color-accent-fixed-dim:          var(--color-tertiary-200);
  --color-on-accent-fixed:           var(--color-tertiary-900);
  --color-on-accent-fixed-muted:     var(--color-tertiary-800);

  --color-danger:                    var(--color-error-600);
  --color-on-danger:                 var(--color-error-50);
  --color-danger-soft:               var(--color-error-100);
  --color-on-danger-soft:            var(--color-error-900);
  --color-danger-fixed:              var(--color-error-100);
  --color-danger-fixed-dim:          var(--color-error-200);
  --color-on-danger-fixed:           var(--color-error-900);
  --color-on-danger-fixed-muted:     var(--color-error-800);

  --color-field:                     var(--color-neutral-200);
  --color-focus-ring:                var(--color-primary-500);
  --color-sidebar:                   var(--color-neutral-100);
  --color-on-sidebar:                var(--color-neutral-900);

  /* shadcn/ui — map legacy names to --color-* (M3 roles unchanged on Android) */
  --background:              var(--color-background);
  --on-background:           var(--color-content);
  --foreground:              var(--color-content);
  --background-inverse:      var(--color-inverse-surface);
  --foreground-inverse:      var(--color-inverse-content);
  --surface-raised:          var(--color-background-variant);
  --surface-overlay:         var(--color-background-container-highest);
  --border:                  var(--color-border);
  --border-subtle:           var(--color-border-subtle);
  --primary:                 var(--color-primary);
  --on-primary:              var(--color-on-primary);
  --primary-container:       var(--color-primary-soft);
  --on-primary-container:    var(--color-on-primary-soft);
  --primary-foreground:      var(--color-on-primary);
  --primary-tint:            var(--color-primary-soft);
  --on-primary-tint:         var(--color-on-primary-soft);
  --secondary:               var(--color-secondary);
  --on-secondary:            var(--color-on-secondary);
  --secondary-container:     var(--color-secondary-soft);
  --on-secondary-container:  var(--color-on-secondary-soft);
  --secondary-foreground:    var(--color-on-secondary);
  --secondary-tint:          var(--color-secondary-soft);
  --on-secondary-tint:       var(--color-on-secondary-soft);
  --tertiary:                var(--color-accent);
  --on-tertiary:             var(--color-on-accent);
  --tertiary-container:      var(--color-accent-soft);
  --on-tertiary-container:   var(--color-on-accent-soft);
  --accent:                  var(--color-accent-soft);
  --accent-foreground:       var(--color-on-accent-soft);
  --destructive:             var(--color-danger);
  --destructive-foreground:  var(--color-on-danger);
  --error:                   var(--color-danger);
  --on-error:                var(--color-on-danger);
  --error-container:         var(--color-danger-soft);
  --on-error-container:      var(--color-on-danger-soft);
  --error-tint:              var(--color-danger-soft);
  --on-error-tint:           var(--color-on-danger-soft);
  --input:                   var(--color-field);
  --ring:                    var(--color-focus-ring);
  --sidebar:                 var(--color-sidebar);
  --sidebar-foreground:      var(--color-on-sidebar);
  --card:                    var(--color-background);
  --card-foreground:         var(--color-content);
  --popover:                 var(--color-background-container-highest);
  --popover-foreground:      var(--color-content);
  --muted:                   var(--color-background-variant);
  --muted-foreground:        var(--color-content-muted);

  /* Effects */
  --shadow-color:    rgba(0, 0, 0, 0.10);
  --shadow-sm-blur:  calc(var(--elevation-100) * 1px);
  --shadow-md-blur:  calc(var(--elevation-200) * 1px);
  --shadow-lg-blur:  calc(var(--elevation-400) * 1px);
  --shadow-xl-blur:  calc(var(--elevation-800) * 1px);
  --shadow-2xl-blur: calc(var(--elevation-1600) * 1px);
}

/* ─── Theme — Dark ───────────────────────────────────────────────────────── */
[data-theme="dark"] {
  --color-background-dim:                 var(--color-neutral-950);
  --color-background:                     var(--color-neutral-900);
  --color-background-bright:              var(--color-neutral-800);
  --color-background-container-lowest:    var(--color-neutral-950);
  --color-background-container-low:       var(--color-neutral-900);
  --color-background-container:           var(--color-neutral-800);
  --color-background-container-high:      var(--color-neutral-700);
  --color-background-container-highest:   var(--color-neutral-800);
  --color-background-variant:             var(--color-neutral-800);
  --color-content:                   var(--color-neutral-50);
  --color-content-muted:             var(--color-neutral-400);
  --color-border:                    var(--color-neutral-700);
  --color-border-subtle:             var(--color-neutral-800);
  --color-inverse-surface:           var(--color-neutral-50);
  --color-inverse-content:           var(--color-neutral-900);
  --color-inverse-brand:             var(--color-primary-700);
  --color-scrim:                     rgba(0, 0, 0, 0.32);
  --color-shadow-tint:               rgba(0, 0, 0, 0.40);

  --color-primary:                   var(--color-primary-400);
  --color-on-primary:                var(--color-primary-50);
  --color-primary-soft:              var(--color-primary-800);
  --color-on-primary-soft:           var(--color-primary-100);
  --color-primary-fixed:             var(--color-primary-300);
  --color-primary-fixed-dim:         var(--color-primary-800);
  --color-on-primary-fixed:          var(--color-primary-100);
  --color-on-primary-fixed-muted:    var(--color-primary-200);

  --color-secondary:                 var(--color-secondary-400);
  --color-on-secondary:              var(--color-secondary-50);
  --color-secondary-soft:            var(--color-secondary-800);
  --color-on-secondary-soft:         var(--color-secondary-100);
  --color-secondary-fixed:           var(--color-secondary-300);
  --color-secondary-fixed-dim:       var(--color-secondary-800);
  --color-on-secondary-fixed:        var(--color-secondary-100);
  --color-on-secondary-fixed-muted:  var(--color-secondary-200);

  --color-accent:                    var(--color-tertiary-400);
  --color-on-accent:                 var(--color-tertiary-50);
  --color-accent-soft:               var(--color-tertiary-800);
  --color-on-accent-soft:            var(--color-tertiary-100);
  --color-accent-fixed:              var(--color-tertiary-300);
  --color-accent-fixed-dim:          var(--color-tertiary-800);
  --color-on-accent-fixed:           var(--color-tertiary-100);
  --color-on-accent-fixed-muted:     var(--color-tertiary-200);

  --color-danger:                    var(--color-error-400);
  --color-on-danger:                 var(--color-error-50);
  --color-danger-soft:               var(--color-error-900);
  --color-on-danger-soft:            var(--color-error-100);
  --color-danger-fixed:              var(--color-error-300);
  --color-danger-fixed-dim:          var(--color-error-800);
  --color-on-danger-fixed:           var(--color-error-100);
  --color-on-danger-fixed-muted:     var(--color-error-200);

  --color-field:                     var(--color-neutral-700);
  --color-focus-ring:                var(--color-primary-400);
  --color-sidebar:                   var(--color-neutral-900);
  --color-on-sidebar:                var(--color-neutral-100);

  --background:              var(--color-background);
  --on-background:           var(--color-content);
  --foreground:              var(--color-content);
  --background-inverse:      var(--color-inverse-surface);
  --foreground-inverse:      var(--color-inverse-content);
  --surface-raised:          var(--color-background-variant);
  --surface-overlay:         var(--color-background-container-highest);
  --border:                  var(--color-border);
  --border-subtle:           var(--color-border-subtle);
  --primary:                 var(--color-primary);
  --on-primary:              var(--color-on-primary);
  --primary-container:       var(--color-primary-soft);
  --on-primary-container:    var(--color-on-primary-soft);
  --primary-foreground:      var(--color-on-primary);
  --primary-tint:            var(--color-primary-soft);
  --on-primary-tint:         var(--color-on-primary-soft);
  --secondary:               var(--color-secondary);
  --on-secondary:            var(--color-on-secondary);
  --secondary-container:     var(--color-secondary-soft);
  --on-secondary-container:  var(--color-on-secondary-soft);
  --secondary-foreground:    var(--color-on-secondary);
  --secondary-tint:          var(--color-secondary-soft);
  --on-secondary-tint:       var(--color-on-secondary-soft);
  --tertiary:                var(--color-accent);
  --on-tertiary:             var(--color-on-accent);
  --tertiary-container:      var(--color-accent-soft);
  --on-tertiary-container:   var(--color-on-accent-soft);
  --accent:                  var(--color-accent-soft);
  --accent-foreground:       var(--color-on-accent-soft);
  --destructive:             var(--color-danger);
  --destructive-foreground:  var(--color-on-danger);
  --error:                   var(--color-danger);
  --on-error:                var(--color-on-danger);
  --error-container:         var(--color-danger-soft);
  --on-error-container:      var(--color-on-danger-soft);
  --error-tint:              var(--color-danger-soft);
  --on-error-tint:           var(--color-on-danger-soft);
  --input:                   var(--color-field);
  --ring:                    var(--color-focus-ring);
  --sidebar:                 var(--color-sidebar);
  --sidebar-foreground:      var(--color-on-sidebar);
  --card:                    var(--color-background);
  --card-foreground:         var(--color-content);
  --popover:                 var(--color-background-container-highest);
  --popover-foreground:      var(--color-content);
  --muted:                   var(--color-background-variant);
  --muted-foreground:        var(--color-content-muted);

  --shadow-color:    rgba(0, 0, 0, 0.30);
  --shadow-sm-blur:  calc(var(--elevation-100) * 1px);
  --shadow-md-blur:  calc(var(--elevation-200) * 1px);
  --shadow-lg-blur:  calc(var(--elevation-400) * 1px);
  --shadow-xl-blur:  calc(var(--elevation-800) * 1px);
  --shadow-2xl-blur: calc(var(--elevation-1600) * 1px);
}

/* Respect system preference when no explicit data-theme is set */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-background-dim:                 var(--color-neutral-950);
    --color-background:                     var(--color-neutral-900);
    --color-background-bright:              var(--color-neutral-800);
    --color-background-container-lowest:    var(--color-neutral-950);
    --color-background-container-low:       var(--color-neutral-900);
    --color-background-container:           var(--color-neutral-800);
    --color-background-container-high:      var(--color-neutral-700);
    --color-background-container-highest:   var(--color-neutral-800);
    --color-background-variant:             var(--color-neutral-800);
    --color-content:                   var(--color-neutral-50);
    --color-content-muted:             var(--color-neutral-400);
    --color-border:                    var(--color-neutral-700);
    --color-border-subtle:             var(--color-neutral-800);
    --color-inverse-surface:           var(--color-neutral-50);
    --color-inverse-content:           var(--color-neutral-900);
    --color-inverse-brand:             var(--color-primary-700);
    --color-scrim:                     rgba(0, 0, 0, 0.32);
    --color-shadow-tint:               rgba(0, 0, 0, 0.40);
    --color-primary:                   var(--color-primary-400);
    --color-on-primary:                var(--color-primary-50);
    --color-primary-soft:              var(--color-primary-800);
    --color-on-primary-soft:           var(--color-primary-100);
    --color-primary-fixed:             var(--color-primary-300);
    --color-primary-fixed-dim:         var(--color-primary-800);
    --color-on-primary-fixed:          var(--color-primary-100);
    --color-on-primary-fixed-muted:    var(--color-primary-200);
    --color-secondary:                 var(--color-secondary-400);
    --color-on-secondary:              var(--color-secondary-50);
    --color-secondary-soft:            var(--color-secondary-800);
    --color-on-secondary-soft:         var(--color-secondary-100);
    --color-secondary-fixed:           var(--color-secondary-300);
    --color-secondary-fixed-dim:       var(--color-secondary-800);
    --color-on-secondary-fixed:        var(--color-secondary-100);
    --color-on-secondary-fixed-muted:  var(--color-secondary-200);
    --color-accent:                    var(--color-tertiary-400);
    --color-on-accent:                 var(--color-tertiary-50);
    --color-accent-soft:               var(--color-tertiary-800);
    --color-on-accent-soft:            var(--color-tertiary-100);
    --color-accent-fixed:              var(--color-tertiary-300);
    --color-accent-fixed-dim:          var(--color-tertiary-800);
    --color-on-accent-fixed:           var(--color-tertiary-100);
    --color-on-accent-fixed-muted:     var(--color-tertiary-200);
    --color-danger:                    var(--color-error-400);
    --color-on-danger:                 var(--color-error-50);
    --color-danger-soft:               var(--color-error-900);
    --color-on-danger-soft:            var(--color-error-100);
    --color-danger-fixed:              var(--color-error-300);
    --color-danger-fixed-dim:          var(--color-error-800);
    --color-on-danger-fixed:           var(--color-error-100);
    --color-on-danger-fixed-muted:     var(--color-error-200);
    --color-field:                     var(--color-neutral-700);
    --color-focus-ring:                var(--color-primary-400);
    --color-sidebar:                   var(--color-neutral-900);
    --color-on-sidebar:                var(--color-neutral-100);
    --background:              var(--color-background);
    --on-background:           var(--color-content);
    --foreground:              var(--color-content);
    --background-inverse:      var(--color-inverse-surface);
    --foreground-inverse:      var(--color-inverse-content);
    --surface-raised:          var(--color-background-variant);
    --surface-overlay:         var(--color-background-container-highest);
    --border:                  var(--color-border);
    --border-subtle:           var(--color-border-subtle);
    --primary:                 var(--color-primary);
    --on-primary:              var(--color-on-primary);
    --primary-container:       var(--color-primary-soft);
    --on-primary-container:    var(--color-on-primary-soft);
    --primary-foreground:      var(--color-on-primary);
    --primary-tint:            var(--color-primary-soft);
    --on-primary-tint:         var(--color-on-primary-soft);
    --secondary:               var(--color-secondary);
    --on-secondary:            var(--color-on-secondary);
    --secondary-container:     var(--color-secondary-soft);
    --on-secondary-container:  var(--color-on-secondary-soft);
    --secondary-foreground:    var(--color-on-secondary);
    --secondary-tint:          var(--color-secondary-soft);
    --on-secondary-tint:       var(--color-on-secondary-soft);
    --tertiary:                var(--color-accent);
    --on-tertiary:             var(--color-on-accent);
    --tertiary-container:      var(--color-accent-soft);
    --on-tertiary-container:   var(--color-on-accent-soft);
    --accent:                  var(--color-accent-soft);
    --accent-foreground:       var(--color-on-accent-soft);
    --destructive:             var(--color-danger);
    --destructive-foreground:  var(--color-on-danger);
    --error:                   var(--color-danger);
    --on-error:                var(--color-on-danger);
    --error-container:         var(--color-danger-soft);
    --on-error-container:      var(--color-on-danger-soft);
    --error-tint:              var(--color-danger-soft);
    --on-error-tint:           var(--color-on-danger-soft);
    --input:                   var(--color-field);
    --ring:                    var(--color-focus-ring);
    --sidebar:                 var(--color-sidebar);
    --sidebar-foreground:      var(--color-on-sidebar);
    --card:                    var(--color-background);
    --card-foreground:         var(--color-content);
    --popover:                 var(--color-background-container-highest);
    --popover-foreground:      var(--color-content);
    --muted:                   var(--color-background-variant);
    --muted-foreground:        var(--color-content-muted);
    --shadow-color:    rgba(0, 0, 0, 0.30);
    --shadow-sm-blur:  calc(var(--elevation-100) * 1px);
    --shadow-md-blur:  calc(var(--elevation-200) * 1px);
    --shadow-lg-blur:  calc(var(--elevation-400) * 1px);
    --shadow-xl-blur:  calc(var(--elevation-800) * 1px);
    --shadow-2xl-blur: calc(var(--elevation-1600) * 1px);
  }
}

/* ─── Typography — Default (scale 100) ──────────────────────────────────── */
:root {
  --display-lg-font-family:  {displayFont};
  --display-lg-font-size:    57px;
  --display-lg-font-weight:  400;
  --display-lg-line-height:  64px;

  --display-md-font-family:  {displayFont};
  --display-md-font-size:    45px;
  --display-md-font-weight:  400;
  --display-md-line-height:  52px;

  --display-sm-font-family:  {displayFont};
  --display-sm-font-size:    36px;
  --display-sm-font-weight:  400;
  --display-sm-line-height:  44px;

  --headline-lg-font-family: {displayFont};
  --headline-lg-font-size:   32px;
  --headline-lg-font-weight: 400;
  --headline-lg-line-height: 40px;

  --headline-md-font-family: {displayFont};
  --headline-md-font-size:   28px;
  --headline-md-font-weight: 400;
  --headline-md-line-height: 36px;

  --headline-sm-font-family: {displayFont};
  --headline-sm-font-size:   24px;
  --headline-sm-font-weight: 400;
  --headline-sm-line-height: 32px;

  --body-lg-font-family:     {bodyFont};
  --body-lg-font-size:       16px;
  --body-lg-font-weight:     400;
  --body-lg-line-height:     24px;

  --body-md-font-family:     {bodyFont};
  --body-md-font-size:       14px;
  --body-md-font-weight:     400;
  --body-md-line-height:     20px;

  --body-sm-font-family:     {bodyFont};
  --body-sm-font-size:       12px;
  --body-sm-font-weight:     400;
  --body-sm-line-height:     16px;

  --label-lg-font-family:    {bodyFont};
  --label-lg-font-size:      14px;
  --label-lg-font-weight:    500;
  --label-lg-line-height:    20px;

  --label-md-font-family:    {bodyFont};
  --label-md-font-size:      12px;
  --label-md-font-weight:    500;
  --label-md-line-height:    16px;

  --label-sm-font-family:    {bodyFont};
  --label-sm-font-size:      11px;
  --label-sm-font-weight:    500;
  --label-sm-line-height:    16px;
}

/* ─── Typography — Scale modes ───────────────────────────────────────────── */
/* Only font-size and line-height change per mode. Font family and weight are
   inherited from :root and are NOT repeated here. */

/* Scale 85 (0.85×) */
[data-font-scale="85"] {
  --display-lg-font-size:  {computed}px; --display-lg-line-height:  {computed}px;
  --display-md-font-size:  {computed}px; --display-md-line-height:  {computed}px;
  --display-sm-font-size:  {computed}px; --display-sm-line-height:  {computed}px;
  --headline-lg-font-size: {computed}px; --headline-lg-line-height: {computed}px;
  --headline-md-font-size: {computed}px; --headline-md-line-height: {computed}px;
  --headline-sm-font-size: {computed}px; --headline-sm-line-height: {computed}px;
  --body-lg-font-size:     {computed}px; --body-lg-line-height:     {computed}px;
  --body-md-font-size:     {computed}px; --body-md-line-height:     {computed}px;
  --body-sm-font-size:     {computed}px; --body-sm-line-height:     {computed}px;
  --label-lg-font-size:    {computed}px; --label-lg-line-height:    {computed}px;
  --label-md-font-size:    {computed}px; --label-md-line-height:    {computed}px;
  --label-sm-font-size:    {computed}px; --label-sm-line-height:    {computed}px;
}

/* Repeat [data-font-scale] blocks for modes: 110, 120, 130, 150, 175, 200 */
/* Use the same scaling formula from Step 7: linear below 24px or ≤1.3×,
   √(factor) nonlinear above. Round all values to the nearest integer. */
```

**Compute all `{computed}` values before writing the file.** Use the same scaling formula from Step 7. Do not write placeholder `{computed}` text — replace every `{…}` with the actual resolved value.

**File format rules:**
- The file header must include the project name (from `agent-handoff.md` `active_project_name` or the Figma file name) and a "do not edit" note.
- Use CSS custom properties only — no Sass, no PostCSS, no JavaScript.
- Primitives block comes first so that all `var(--color-*)` references in Theme/Layout/Effects resolve within the same file.
- The `@media (prefers-color-scheme: dark)` block duplicates the dark values so the system preference works without JavaScript. This duplication is intentional.

### 13c — Update agent handoff and report

After writing `tokens.css`:

1. Write `TOKEN_CSS_PATH` to `plugin/templates/agent-handoff.md` under the `token_css_path` field, and set `last_skill_run` to `create-design-system`. This lets `/create-component` and `/code-connect` find the file automatically in subsequent runs.

2. Confirm with the file path and a count of CSS custom properties written. If the write fails (e.g. directory not found), call **AskUserQuestion** with a corrected path prompt and retry once.

---

## Step 14 — Confirm success

Report using this shape:

```
Design system written to Figma file {TARGET_FILE_KEY}

Collections created or updated:
  Primitives   — {N} variables  (1 mode: Default)
  Theme        — {N} variables  (2 modes: Light, Dark)
  Typography   — {N} variables  (8 modes: 85, 100, 110, 120, 130, 150, 175, 200)
  Layout       — {N} variables  (1 mode: Default)
  Effects      — {N} variables  (2 modes: Light, Dark)

Total variables: {N}

Platform mapping is embedded as codeSyntax on every variable (WEB / ANDROID / iOS).

CSS token file written to: {TOKEN_CSS_PATH}  ({N} custom properties)

Open in Figma: https://figma.com/design/{TARGET_FILE_KEY}
```

Immediately continue to **Steps 15–18** (Figma canvas: style guide pages, MCP manifest, Token Overview updates, Cover gradient) in the same skill run — do not jump to Step 19 until those steps complete or fail with a logged warning.

---

## Step 15 — Draw Style Guide Pages

Using all token values already computed in Steps 5–9 (color ramps, Theme aliases, Typography values, Layout aliases, and Effects values), navigate to each of the five style guide pages and draw token visualizations. Execute the drawing for all five pages inside a **single `use_figma` call** — page state must carry over within one execution context. Before drawing each page, clear the content area (all frames at y > 360) to remove any previously drawn content.

**↳ Primitives page**

For each of the 5 color ramps (primary, secondary, tertiary, error, neutral), in order:

1. Draw a full-width dark section label strip: 1440×48px frame, fill `#000000`, text = ramp name (e.g. `primary`), white, Label/LG, bold.
2. Draw a row of 11 swatch cards for stops 50 through 950 (in ascending order):
   - Card size: 120×160px, 8px gap between cards.
   - Card fill: the resolved hex for that stop (e.g. `color/primary/500` hex).
   - Below the fill area, stack three text labels: stop number (e.g. `500`), resolved hex value, full token path (e.g. `color/primary/500`).

After all color ramps, draw two more sections:

3. **Space Scale section** — draw a 1440×48px dark section label strip with text `Space Scale`, then for each `Space/*` token (Space/100 through Space/2400, in ascending order): a horizontal bar rectangle whose pixel width equals the space value (capped at 800px), with a right-side label showing the token name, px value, and CSS var name (e.g. `Space/300 · 12px · var(--space-300)`). Stack bars vertically with 8px gap.
4. **Corner Radius section** — draw a 1440×48px dark section label strip with text `Corner Radius`, then for each `Corner/*` token: a 120×120px square with that `cornerRadius` value applied, filled `color/neutral/100`, with a label below showing the token name and px value. Arrange squares in a horizontal row with 16px gap.

**↳ Theme page**

For each of the 7 semantic groups (`background/`, `border/`, `primary/`, `secondary/`, `tertiary/`, `status/`, `component/`):

1. Draw a 1440×48px dark section label strip with the group name as text (e.g. `background/`), white, Label/LG, bold.
2. Draw token cards in a 3-column grid (column width ~450px, 16px gutter, 8px corner radius, 1px stroke `color/neutral/200`, 16px padding):
   - **Swatch row:** two 40×40 squares side by side — left square filled with the resolved Light mode hex, right square filled with the resolved Dark mode hex. Label `Light` and `Dark` below each square in Label/SM neutral/600.
   - **Token path:** the variable name (e.g. `color/background/default`), Label/MD, bold, on the next row.
   - **Code names:** three monospace lines in Label/SM neutral/600: `WEB: var(--color-background)`, `ANDROID: surface`, `iOS: .Back.default`. Values come from the Step 6 codeSyntax table.

**↳ Layout page**

Draw two sections:

1. **Spacing section** — draw a 1440×48px dark section label strip with text `Spacing`, then draw token cards in a 4-column grid (320×240px per card):
   - Visual: a horizontal bar/rectangle whose pixel width equals the space px value scaled at 1px:3px visual width, maximum 240px. Fill the bar with `color/primary/200`.
   - Below the bar: token name (`space/md`) in Label/MD bold; then `WEB`, `ANDROID`, `iOS` code names in Label/SM monospace; then `Value: {N}px`; then `Bound to: Space/{N}`.
2. **Border Radius section** — draw a 1440×48px dark section label strip with text `Border Radius`, then draw token cards in a 4-column grid (320×240px per card):
   - Visual: a 120×120px square with that `cornerRadius` value applied, filled `color/neutral/100`.
   - Below: token name in Label/MD bold; WEB/ANDROID/iOS code names in Label/SM monospace; value in px; bound-to primitive name.

**↳ Text Styles page**

Draw one full-width row per type slot (12 total, from Display/LG through Label/SM, top to bottom). Each row is 1440px wide with an 8px bottom border in `color/neutral/100`:

1. **Specimen text** (left, main area): render the string `The quick brown fox jumps over the lazy dog` using the actual font-family, font-size, font-weight, and line-height values from the Typography collection `100` (default) mode for that slot.
2. **Metadata column** (right-aligned, 320px wide): slot name (e.g. `Headline/LG`) in Label/MD bold; font-size, font-weight, line-height values in Label/SM monospace; CSS var (e.g. `var(--headline-lg-font-size)`) in Label/SM neutral/600; scale note in Label/SM neutral/400 (e.g. `Scales from {mode-85-value}px → {mode-200-value}px across 8 modes`).

**↳ Effects page**

For each Effects elevation group (sm, md, lg, xl, 2xl), draw a 1440×48px dark section label strip with text `shadow/{level}`, then draw two cards side by side (Light and Dark):

- Card: 200×200px, white fill, 8px corner radius, 1px stroke `color/neutral/100`.
- Inside each card, center an 80×80px white circle. Apply the shadow to the circle: blur value from the corresponding `shadow/{level}/blur` variable; shadow color from `shadow/color` resolved for that mode (Light or Dark). Label the card `Light` or `Dark` in Label/SM at the top.
- Below each card pair: token name (e.g. `shadow/md/blur`) in Label/MD; blur value; Light opacity; Dark opacity — all in Label/SM monospace.

After drawing all five pages, navigate back to the first page in the file.

---

## Step 16 — Draw MCP Tokens Page

Navigate to the `↳ MCP Tokens` page using `figma.setCurrentPageAsync`. Find and delete any existing frame named `[MCP] Token Manifest`. Then build a new root frame named `[MCP] Token Manifest` positioned at x=0, y=360 (below the doc header), width=1440, auto-height, white fill.

Inside the root frame, first create the JSON manifest text node, then create the five collection table frames stacked vertically.

**JSON manifest text node**

Create a text node named `[MCP] JSON Manifest` at the top of the root frame (y=0 within the frame). Set its content to the full token manifest as a minified JSON string in this shape — substitute all `{…}` placeholders with actual resolved values, no aliases:

```
{ "meta": { "generated": "<ISO-8601 timestamp>", "skill": "create-design-system", "file": "<TARGET_FILE_KEY>" }, "collections": { "Primitives": { "<path>": { "type": "COLOR", "value": "<hex>", "web": "<css-var>", "android": "<kebab-case>", "ios": "<dot.path>" }, ... }, "Theme": { "light": { "<path>": { "type": "COLOR", "value": "<hex>", "web": "...", "android": "...", "ios": "..." }, ... }, "dark": { ... } }, "Typography": { "100": { "<path>": { "type": "FLOAT", "value": <number>, "web": "...", "android": "...", "ios": "..." }, ... }, "130": { ... }, ... }, "Layout": { "<path>": { "type": "FLOAT", "value": <number>, "web": "...", "android": "...", "ios": "..." }, ... }, "Effects": { "<path>": { ... }, ... } } }
```

Use Label/SM monospace typeface (or the closest available font). Width: 1440px.

**Collection table frames**

Create five sub-frames stacked vertically below the JSON text node, each named as follows. Each frame has a header row and one data row per token. Every data row is also a named frame following the pattern `token/{collection}/{path}` so agents can look up individual tokens by layer name.

Column specs and row content per collection:

- **[MCP] Primitives** — columns: `PATH | TYPE | VALUE | SWATCH | WEB | ANDROID | iOS`. One row per Primitives variable. The SWATCH column is a 16×16px colored rectangle filled with the resolved color value (for COLOR type variables; leave blank for FLOAT). All text in Label/SM monospace.

- **[MCP] Theme** — columns: `PATH | MODE | TYPE | VALUE | SWATCH | WEB | ANDROID | iOS`. Two rows per Theme variable (one for `light` mode, one for `dark` mode). Row frame names: `token/theme/light/{path}` and `token/theme/dark/{path}`. VALUE is the resolved hex (not the alias variable name). SWATCH is a 16×16px colored rectangle.

- **[MCP] Typography** — columns: `PATH | PROPERTY | MODE | VALUE | WEB | ANDROID | iOS`. One row per variable per scale mode (48 variables × 8 modes = 384 rows). Row frame name: `token/typography/{mode}/{path}`. VALUE is the resolved number (font-size or line-height in px, font-weight as a number, font-family as a string).

- **[MCP] Layout** — columns: `PATH | TYPE | VALUE | BOUND TO | WEB | ANDROID | iOS`. One row per Layout variable. VALUE is the resolved px number. BOUND TO is the Primitive variable name it aliases (e.g. `Space/300`).

- **[MCP] Effects** — columns: `PATH | MODE | TYPE | VALUE | WEB | ANDROID | iOS`. Two rows per Effects variable (light and dark mode). VALUE is the resolved hex (for `shadow/color`) or resolved px number (for blur variables).

All column headers use Label/SM bold. Row text uses Label/SM monospace (or closest). Column widths: PATH column 280px, all other columns 120px, SWATCH column 40px.

---

## Step 17 — Populate Token Overview

Navigate to the `↳ Token Overview` page using `figma.setCurrentPageAsync`. The `/new-project` skill's Step 5d drew this page with placeholder content (Figma script source: `skills/new-project/phases/05d-token-overview.md`). Find placeholders and replace them with actual resolved values from the current token set.

**Architecture diagram (Section 1)**

Find the five collection box frames in the architecture flow diagram (look for frames containing the collection names: `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`). Update their fills:

- `Primitives` box: fill with the resolved hex for `color/primary/default` (Light mode).
- `Theme` box: fill with the resolved hex for `color/secondary/default` (Light mode).
- `Typography`, `Layout`, `Effects` boxes: fill with the resolved hex for `color/neutral/800`.

Leave all other frame properties (size, position, text content, arrow connectors) unchanged.

**Platform Mapping table (Section 2)**

Find the table frame in Section 2. Verify that the 8 example rows match the actual codeSyntax values written to the Figma file. For each of the following token paths, read the codeSyntax that was written in Step 11 and update the WEB, ANDROID, and iOS cells in the table row if they differ:

`color/background/default`, `color/primary/default`, `color/border/default`, `color/status/error`, `Headline/LG/font-size`, `space/md`, `radius/md`, `shadow/color`

**Phone frames (Section 3)**

Find the two phone frame rectangles in the Dark Mode column of Section 3. Set the fill of the frame labeled `Light` to the resolved hex for `color/background/default` (Light mode). Set the fill of the frame labeled `Dark` to the resolved hex for `color/background/default` (Dark mode).

**Placeholder strips from `/new-project` Step 5d**

Find every node on `↳ Token Overview` whose **name** starts with `placeholder/` (amber “run /create-design-system” notes). Delete each of these nodes after the sections above are updated — they are scaffolding only, not part of the final spec.

If any legacy text node still contains the substring `TBD`, replace `TBD` with the resolved value implied by the nearest section heading or table row; if ambiguous, use the resolved `color/primary/500` hex.

---

## Step 18 — Update Cover with Brand Colors

Navigate to the `Thumbnail` page using `figma.setCurrentPageAsync`. Find the frame named `Cover`.

**If `Cover` is found:**

1. Read the frame's current `fills` array. Locate the `GRADIENT_LINEAR` fill entry.
2. Update `gradientStops[0].color` to the resolved RGBA for `color/primary/500` from the Primitives collection (convert the hex to `{ r, g, b, a }` floats in the 0–1 range).
3. Update `gradientStops[1].color` to the resolved RGBA for `color/secondary/500` from the Primitives collection.
4. Leave `gradientTransform` completely unchanged — do not alter the gradient angle or position.
5. Write the updated fills back to the frame.
6. Call `figma.setFileThumbnailNodeAsync(coverFrame)` to re-register the frame as the file thumbnail.

**If `Cover` is not found:**

Log the warning `Cover frame not found — skipping thumbnail update` and continue to Step 19 without error.

---

## Step 19 — Offer next step

Call **AskUserQuestion**:

> "Run `/create-component` now to build UI components and wire them to `{TOKEN_CSS_PATH}`? (yes / no)"

If **yes**, pass `TOKEN_CSS_PATH` as context when invoking `/create-component`. If **no**, close the skill.

---

## Token Naming Reference

### Primitives examples
```
color/primary/50        → lightest tint
color/primary/500       → brand anchor (input hex)
color/primary/950       → darkest shade
color/error/600         → error red
color/neutral/100       → near-white gray
color/tertiary/500      → tertiary brand anchor
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
color/background/fg                Light → color/neutral/900   Dark → color/neutral/50
color/background/inverse           Light → color/neutral/950   Dark → color/neutral/50
color/border/default               Light → color/neutral/200   Dark → color/neutral/700
color/primary/fixed              Light → color/primary/100   Dark → color/primary/300
color/primary/default            Light → color/primary/500   Dark → color/primary/400
color/status/error-on-fixed      Light → color/error/900     Dark → color/error/100
color/component/ring             Light → color/primary/500   Dark → color/primary/400
```

### Typography examples
```
Headline/LG/font-size   mode 100 → 32    mode 130 → 42    mode 200 → 45 (nonlinear)
Headline/LG/font-family all modes → display font (constant)
Body/MD/font-size       mode 100 → 14    mode 150 → 21    mode 200 → 28
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
5. **iOS:** for derived tokens, use **dot paths** — see Step 5 (Primitives), Step 7 (Typography), Step 8 (Layout), Step 9 (Effects).
6. **Theme (all platforms):** codeSyntax is set EXPLICITLY per token from the table in Step 6. The Figma path is a designer label; do not derive codeSyntax from it. Example: `color/background/fg-subtle` → WEB `var(--color-content-muted)`, ANDROID `on-surface-variant`, iOS `.Fore.secondary` — path and all three codeSyntax columns are intentionally different.

### Platform exception summary

**Theme (all platforms — codeSyntax set EXPLICITLY from the Step 6 table, NOT derived from path):**

The Figma token path is a designer-friendly label. The codeSyntax name is different by design. Always read from the Step 6 table — never generate Theme codeSyntax by transforming the path. Official M3 role list: [Material Design 3 — Static baseline](https://m3.material.io/styles/color/static/baseline). ANDROID `codeSyntax` uses those roles in **kebab-case** (e.g. `surface-container-high`), not Compose API camelCase.

Selected examples showing intentional name divergence:

| Figma token path | WEB | ANDROID (M3 kebab) | iOS (semantic) |
|---|---|---|---|
| `color/background/default` | `var(--color-background)` | `surface` | `.Back.default` |
| `color/background/container-high` | `var(--color-background-container-high)` | `surface-container-high` | `.Back.high` |
| `color/background/inverse` | `var(--color-inverse-surface)` | `inverse-surface` | `.Back.inverse` |
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Back.shadowTint` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Back.variant` |
| `color/background/fg-subtle` | `var(--color-content-muted)` | `on-surface-variant` | `.Fore.secondary` |
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/fg` | `var(--color-on-primary)` | `on-primary` | `.Primary.on` |
| `color/status/error-fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.errorFixed` |
| `color/status/error` | `var(--color-danger)` | `error` | `.Status.error` |

The full Theme codeSyntax table is in Step 6 — this is just a reminder that path ≠ codeSyntax for Theme.

**Primitives color ramps:**
- `color/primary/500` → WEB `var(--color-primary-500)`, ANDROID `color-primary-500`, iOS `.Palette.primary.500`
- `color/neutral/100` → WEB `var(--color-neutral-100)`, ANDROID `color-neutral-100`, iOS `.Palette.neutral.100`

**Layout / Effects (pattern):**
- `space/md` → WEB `var(--space-md)`, ANDROID `space-md`, iOS `.Layout.space.md`
- `Display/LG/font-size` → WEB `var(--display-lg-font-size)`, ANDROID `display-lg-font-size`, iOS `.Typography.displayLg.fontSize`

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
