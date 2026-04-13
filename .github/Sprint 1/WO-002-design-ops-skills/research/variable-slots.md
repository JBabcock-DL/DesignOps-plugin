# Variable Slots — foundations-Agent-Kit

**File key:** `rJQsr4aou5yjzUhaEM0I2f`
**Inspection date:** 2026-04-13
**Method:** `mcp__claude_ai_Figma__get_variable_defs` called against multiple nodes on the Table of Contents page (`59:78`) and descendant frames.

---

## 1. Collections Summary

The `get_variable_defs` MCP tool returns a flat merged map of all variable aliases currently bound to the inspected node tree. It does not expose the underlying collection objects by name (that requires the Figma REST Variables API: `GET /v1/files/:key/variables`). The token naming prefixes observed across all probed nodes reveal **four inferred collections**:

| Inferred Collection | Naming Prefix | Observed Variables | Token Type(s) |
|---|---|---|---|
| **Primitives** (raw scale values) | `Space/`, `elevation/`, `Corner/` | `Space/600`, `elevation/400`, `Corner/Extra-large` | FLOAT |
| **Web** (semantic CSS custom properties) | `var(--…)` | All `var(--*)` tokens (colors, spacing, radius, padding, border) | COLOR, FLOAT |
| **Typography** (text style variables) | `Title/`, `Label/`, `Headline/` | All font size, family, weight, line-height tokens | STRING, FLOAT |
| **Native** (composite font tokens for native platforms) | `Native/Title/`, `Native/Label/` | `Native/Title/Title LG`, `Native/Label/Label LG` | STRING (Font composite) |
| **Shadow** | `var--{shadow-default)`, `elevation/default/` | Shadow color + drop-shadow effect | COLOR, EFFECT |

> Note: The closing bracket typo `var--{shadow-default)` is present verbatim in the file — this is a naming bug in the source file, not a transcription error.

---

## 2. Per-Collection Variable Tables

### 2a. Primitives Collection — Raw Scale Values

| Variable Name | Type | Default / Current Value |
|---|---|---|
| `Space/600` | FLOAT | `24` |
| `elevation/400` | FLOAT | `4` |
| `Corner/Extra-large` | FLOAT | `28` |

### 2b. Web Collection — Semantic CSS Custom Properties

| Variable Name | Type | Default / Current Value |
|---|---|---|
| `var(--background)` | COLOR | `#f5f7fa` |
| `var(--background-inverse)` | COLOR | `#000000` |
| `var(--on-background-primary)` | COLOR | `#f2f9ff` |
| `var(--on-button-secondary)` | COLOR | `#000000` |
| `var(--border-primary)` | COLOR | `#006bc3` |
| `var(--border-secondary)` | COLOR | `#c7cfd9` |
| `var(--gap-xs)` | FLOAT | `4` |
| `var(--gap-sm)` | FLOAT | `8` |
| `var(--gap-md)` | FLOAT | `12` |
| `var(--gap-lg)` | FLOAT | `16` |
| `var(--p-xs)` | FLOAT | `4` |
| `var(--padding-md)` | FLOAT | `12` |
| `var(--radius-none)` | FLOAT | `0` |
| `var(--radius-md)` | FLOAT | `12` |

### 2c. Typography Collection — Text Style Variables

| Variable Name | Type | Default / Current Value |
|---|---|---|
| `Title/LG/Font Family` | STRING | `"Inter"` |
| `Title/LG/Font Size` | FLOAT | `22` |
| `Title/LG/Font Weight` | FLOAT | `600` |
| `Title/LG/Line Height` | FLOAT | `28` |
| `Label/LG/Font Family` | STRING | `"Inter"` |
| `Label/LG/Font Size` | FLOAT | `14` |
| `Label/LG/Line Height` | FLOAT | `20` |
| `Headline/MD/Font Family` | STRING | `"Inter"` |
| `Headline/MD/Font Size` | FLOAT | `30` |
| `Headline/MD/Font Weight` | FLOAT | `600` |
| `Headline/MD/Line Height` | FLOAT | `36` |

### 2d. Native Collection — Composite Font Tokens

| Variable Name | Type | Default / Current Value |
|---|---|---|
| `Native/Title/Title LG` | STRING (Font) | `Font(family: "Title/LG/Font Family", style: Semi Bold, size: Title/LG/Font Size, weight: Title/LG/Font Weight, lineHeight: Title/LG/Line Height, letterSpacing: -1)` |
| `Native/Label/Label LG` | STRING (Font) | `Font(family: "Label/LG/Font Family", style: Semi Bold, size: Label/LG/Font Size, weight: Title/LG/Font Weight, lineHeight: Label/LG/Line Height, letterSpacing: 0)` |
| `Native/Headline/Headline MD` | STRING (Font) | `Font(family: "Headline/MD/Font Family", style: Semi Bold, size: Headline/MD/Font Size, weight: Headline/MD/Font Weight, lineHeight: Headline/MD/Line Height, letterSpacing: -2.5)` |

### 2e. Shadow / Elevation Collection

| Variable Name | Type | Default / Current Value |
|---|---|---|
| `var--{shadow-default)` | COLOR | `#000000` |
| `elevation/default/400` | STRING (Effect) | `Effect(type: DROP_SHADOW, color: var--{shadow-default), offset: (0, elevation/400), radius: 0, spread: 0)` |

---

## 3. Naming Conventions

The file uses a mix of two naming schemes, reflecting its dual Web + Native coverage:

### 3a. Web tokens — CSS custom property format
```
var(--{category}-{variant})
```
Examples:
- `var(--background)` — base surface color
- `var(--background-inverse)` — inverted surface
- `var(--on-background-primary)` — content color on background
- `var(--on-button-secondary)` — content color on secondary button
- `var(--border-primary)` / `var(--border-secondary)` — border colors
- `var(--gap-xs/sm/md/lg)` — gap/spacing scale (xs=4, sm=8, md=12, lg=16)
- `var(--p-xs)` — padding shorthand
- `var(--padding-md)` — padding scale
- `var(--radius-none)` / `var(--radius-md)` — corner radius scale

### 3b. Primitive tokens — slash-delimited category/scale
```
{Category}/{Scale}
```
Examples:
- `Space/600` → 24px (scale 600 = 24 in a 4-base system)
- `elevation/400` → 4 (shadow offset)
- `Corner/Extra-large` → 28px

### 3c. Typography tokens — slash-delimited path with property leaf
```
{Style}/{Size}/{Property}
```
Examples:
- `Title/LG/Font Size` = 22
- `Title/LG/Font Family` = "Inter"
- `Title/LG/Font Weight` = 600
- `Title/LG/Line Height` = 28
- `Label/LG/Font Size` = 14
- `Headline/MD/Font Size` = 30

### 3d. Native composite tokens — platform namespace
```
Native/{StyleCategory}/{StyleName}
```
Examples:
- `Native/Title/Title LG` — references `Title/LG/*` primitives with letter-spacing -1
- `Native/Label/Label LG` — references `Label/LG/*` with letter-spacing 0
- `Native/Headline/Headline MD` — references `Headline/MD/*` with letter-spacing -2.5

### 3e. Effect tokens — mixed scheme (known bug)
- `var--{shadow-default)` — malformed token name (missing opening parenthesis, uses `{` instead of `(--`). The correct CSS custom property form would be `var(--shadow-default)`. This is a naming defect in the source file.
- `elevation/default/400` — composite effect referencing both `var--{shadow-default)` and `elevation/400`.

---

## 4. Mapping Guide — Observed Slots to Planned Token Architecture

The plan targets four Figma variable collections: **Primitives**, **Web**, **Android/M3**, and **iOS/HIG**. Here is how the observed Agent Kit slots map to each.

### 4a. Primitives Collection → Tailwind-Scale Raw Values

| Observed Slot | Tailwind Equivalent | Notes |
|---|---|---|
| `Space/600` = 24 | `spacing.6` (24px) | Tailwind default scale: 6 = 1.5rem = 24px |
| `elevation/400` = 4 | `boxShadow` offset, not a spacing token | Maps to shadow y-offset |
| `Corner/Extra-large` = 28 | `borderRadius.2xl` (not standard) or `borderRadius['2xl']` | Tailwind default `2xl` = 1rem (16px); 28px is a custom value |

When writing the Primitives collection the `/create-design-system` skill should populate:
- `Space/{scale}` slots using Tailwind's default spacing scale (multiples of 4: `Space/100`=4, `Space/200`=8, `Space/300`=12, `Space/400`=16, `Space/500`=20, `Space/600`=24, etc.)
- `Corner/{size}` slots for all Tailwind `borderRadius` values
- `elevation/{scale}` slots for shadow offsets

### 4b. Web Collection → Semantic Tailwind Aliases

The `var(--*)` CSS custom property tokens are the semantic alias layer. Each maps to a Tailwind utility class or config key:

| Observed Slot | Tailwind Semantic Alias | CSS Output |
|---|---|---|
| `var(--background)` (#f5f7fa) | `bg-background` | `background-color: var(--background)` |
| `var(--background-inverse)` (#000000) | `bg-background-inverse` | `background-color: var(--background-inverse)` |
| `var(--on-background-primary)` (#f2f9ff) | `text-on-background-primary` | `color: var(--on-background-primary)` |
| `var(--on-button-secondary)` (#000000) | `text-on-button-secondary` | `color: var(--on-button-secondary)` |
| `var(--border-primary)` (#006bc3) | `border-border-primary` | `border-color: var(--border-primary)` |
| `var(--border-secondary)` (#c7cfd9) | `border-border-secondary` | `border-color: var(--border-secondary)` |
| `var(--gap-xs/sm/md/lg)` | `gap-*` utilities | `gap: var(--gap-xs)` etc. |
| `var(--padding-md)`, `var(--p-xs)` | `p-*` / `px-*` / `py-*` utilities | `padding: var(--padding-md)` |
| `var(--radius-none)`, `var(--radius-md)` | `rounded-none`, `rounded-md` | `border-radius: var(--radius-*)` |

The `/create-design-system` skill should accept brand color inputs and write them into these `var(--*)` slots in the Web collection via the Figma Variables REST API.

### 4c. Android/M3 Collection → Material Design 3 `md.sys.*` Aliases

The Agent Kit does not currently expose an `Android/M3` collection via the nodes inspected. The `/create-design-system` skill will need to **create this collection** from scratch in the cloned file. Map observed slots to M3 role names:

| Observed Web Slot | M3 Role Token | M3 Variable Name |
|---|---|---|
| `var(--background)` | `md.sys.color.background` | `md/sys/color/background` |
| `var(--on-background-primary)` | `md.sys.color.on-background` | `md/sys/color/on-background` |
| `var(--border-primary)` | `md.sys.color.outline` | `md/sys/color/outline` |
| `var(--border-secondary)` | `md.sys.color.outline-variant` | `md/sys/color/outline-variant` |
| `var(--gap-md)` (12) | `md.sys.spacing.medium` | `md/sys/spacing/medium` |
| `var(--radius-md)` (12) | `md.sys.shape.corner.medium` | `md/sys/shape/corner/medium` |
| `Native/Title/Title LG` | `md.sys.typescale.title-large` | `md/sys/typescale/title-large` |
| `Native/Label/Label LG` | `md.sys.typescale.label-large` | `md/sys/typescale/label-large` |

### 4d. iOS/HIG Collection → Apple HIG Semantic Aliases

Similarly, the Agent Kit does not expose a distinct iOS/HIG collection. The skill creates it. Observed slots map to UIKit/SwiftUI semantic names:

| Observed Web Slot | HIG Semantic Name | iOS Variable Name |
|---|---|---|
| `var(--background)` | `systemBackground` | `ios/color/system-background` |
| `var(--background-inverse)` | `label` (primary label) | `ios/color/label` |
| `var(--on-background-primary)` | `secondaryLabel` | `ios/color/secondary-label` |
| `var(--border-primary)` | `tintColor` | `ios/color/tint` |
| `var(--border-secondary)` | `separator` | `ios/color/separator` |
| `var(--gap-sm)` (8) | `NSLayoutConstraint` minimum spacing | `ios/spacing/small` |
| `var(--gap-md)` (12) | Standard group inset | `ios/spacing/medium` |
| `var(--radius-md)` (12) | `UIRoundedRectMaskLayer` standard | `ios/shape/corner-medium` |
| `Native/Title/Title LG` | `.title2` (UIFont.TextStyle) | `ios/typescale/title2` |
| `Native/Label/Label LG` | `.callout` (UIFont.TextStyle) | `ios/typescale/callout` |
| `Native/Headline/Headline MD` | `.largeTitle` approximate | `ios/typescale/large-title` |

---

## 5. Notes for the `/create-design-system` SKILL.md

1. **Runtime verification required.** The `get_variable_defs` tool returns only variables bound to currently visible/selected nodes, not the full file variable registry. The SKILL.md must instruct the agent to call `get_variable_defs` at runtime on the cloned file (after duplication) to confirm actual slot names before writing.

2. **Collection names are inferred.** The Figma REST Variables API (`GET /v1/files/:key/variables`) would expose true collection names. Until that endpoint is called at runtime, treat the collection names in sections 4a–4d as canonical hypotheses to be validated.

3. **Shadow token naming bug.** The token `var--{shadow-default)` has a malformed name in the source file. When writing shadow variables the skill should use a corrected name `var(--shadow-default)` and update the reference in `elevation/default/400`.

4. **Android/M3 and iOS/HIG collections must be created.** No such collection nodes were surfaced during inspection — the skill must call the Figma Variables REST API to create these collection stubs before populating aliases.

5. **Typography tokens are shared across platforms.** The `Title/`, `Label/`, and `Headline/` tokens appear to be shared primitives. The `Native/*` composites reference them. Both Android/M3 and iOS/HIG alias collections should resolve to the same underlying typography primitives.

6. **Full variable registry.** For a complete enumeration of all variables (including those not bound to the Table of Contents page), the `/create-design-system` skill should call:
   ```
   GET https://api.figma.com/v1/files/rJQsr4aou5yjzUhaEM0I2f/variables/local
   ```
   This endpoint returns all collections and variables regardless of which nodes reference them.
