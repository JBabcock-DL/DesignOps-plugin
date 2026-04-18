---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives, Theme (Light/Dark modes), Typography (8 Android-curve scale modes), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections. Local tokens.css is optional (explicit opt-in after variables are pushed).
argument-hint: "Optional: --theme brand|baseline (default brand). Optional: --file-key <key-or-figma-design-url> (e.g. when chaining from /new-project). Baseline uses Material 3 static baseline seed hues for Primitives ramps; Brand uses wizard or pasted hexes."
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

---

## Optional — Parse `$ARGUMENTS` for theme source

Before Step 1, parse `$ARGUMENTS` for `--theme` and `--file-key`:

**`--theme`**

- `--theme baseline` → set `THEME_SOURCE` to **`baseline`** and `THEME_FROM_CLI` to **true** (Material 3 static baseline seed colors for Primitives ramps — see Step 5).
- `--theme brand` → set `THEME_SOURCE` to **`brand`** and `THEME_FROM_CLI` to **true**.
- Flag absent or invalid → set `THEME_FROM_CLI` to **false** and leave `THEME_SOURCE` unset until Step 2.5 (wizard path only).

When `THEME_FROM_CLI` is **true** and Step 2 was **no**, skip Step 2.5. When Step 2 is **yes** (pasted tokens), always use **`brand`** for Primitives color ramps (ignore `--theme baseline` for colors).

**`--file-key`** (optional; e.g. read-only plugin install, or when handoff was not written)

- Accept `--file-key <value>` or `--file-key=<value>`. Strip quotes.
- If `<value>` matches `figma.com/design/<KEY>/` or `figma.com/file/<KEY>/`, set `FILE_KEY_FROM_ARGS` to `<KEY>` (the path segment only: letters, digits, hyphens).
- Otherwise treat the whole value as a bare file key. If it matches `^[A-Za-z0-9-]+$`, set `FILE_KEY_FROM_ARGS`. If invalid, ignore the flag (Step 1 will prompt).

---

## Interactive input contract

- For **Steps 1–4**, **Step 2.5** (theme source, when needed), **Step 10** (plan approval), **Step 11** when the API returns partial write errors, **Step 12.5** (optional `tokens.css`), **Step 13** (path prompt in 13a when CSS is opted in), and **Step 19**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
- **Do not** print a block of multiple questions as plain markdown before the first AskUserQuestion.
- After any AskUserQuestion, you may show a brief acknowledgment in prose; do not bundle the next question in that same message — call AskUserQuestion again.
- Follow **Progress checklist** below so the designer sees liveness during long wizard and API runs.

---

## Progress checklist (required)

**While collecting answers (Steps 1–4):** After **each** Step 3 `AskUserQuestion` answer, send **one** short line before the next question, e.g. `Collected: base border radius (px)` — no big checklist yet.

**After Step 4 finishes** (current Figma variable state is read), the long work begins. Immediately post the **“Building your design system”** checklist below with **every** line `[ ]` and `Current:` on the **first** row. Then **repost the entire checklist** after each listed item completes (Steps 5–19), updating `[x]` and moving `Current:` to the next row. Do **not** paste JSON, CSS blobs, or full API payloads into these messages.

If a row is **skipped** by skill logic (e.g. no canvas step), mark it `[x]` once and note `(skipped)` in `Current:` when you skip forward.

**On failure**, leave that row `[ ]`, add one line of context, retry that unit before checking later rows.

### Template — use after Step 4 (copy and update)

**Building your design system**

Current: Building Primitives…

- [ ] Building Primitives (color ramps, space, radius, elevation)
- [ ] Building Theme (semantic colors — Light & Dark)
- [ ] Building Typography (type styles × 8 scale modes)
- [ ] Building Layout (spacing & radius aliases)
- [ ] Building Effects (shadows & blur per mode)
- [ ] Preparing plan — waiting for your approval
- [ ] Pushing variable collections to Figma (REST API)
- [ ] Verifying variables wrote correctly
- [ ] Optional: write `tokens.css` (your choice — Step 12.5, then Step 13 if yes)
- [ ] Summarizing results (counts & file links)
- [ ] Drawing ↳ Primitives style guide (Step 15a)
- [ ] Drawing ↳ Theme style guide (Step 15b)
- [ ] Drawing ↳ Layout + ↳ Text Styles + ↳ Effects (Step 15c)
- [ ] Drawing MCP Tokens manifest page (Step 16)
- [ ] Filling Token Overview from live variables (Step 17)
- [ ] Updating Thumbnail cover (brand gradient) (Step 18)
- [ ] Offering next step (`/create-component`)

**Maps to skill steps:** rows 1–5 → Steps 5–9 · row 6 → Step 10 · rows 7–8 → Steps 11–12 · row 9 → Step 12.5 + Step 13 (`tokens.css`, skip row 9 body if declined) · row 10 → Step 14 · rows 11–13 → Steps 15a–15c + Step 16 · rows 14–15 → Steps 17–18 · row 16 → Step 19.

---

## Step 1 — Resolve the Figma file key

Resolve `TARGET_FILE_KEY` in this order. **`--file-key` takes precedence** when present (explicit invocation). Otherwise `/new-project` usually leaves **`active_file_key`** in local `templates/agent-handoff.md` for smoother follow-on skills.

1. **If `FILE_KEY_FROM_ARGS` is set** (parsed from `--file-key` before Step 1), call **AskUserQuestion**:

   > "I'll use this Foundations file key: `<FILE_KEY_FROM_ARGS>` (passed with `/create-design-system`). Use this file? Reply **yes** or paste a different Figma file key."

   - If **yes**, set `TARGET_FILE_KEY` to `FILE_KEY_FROM_ARGS`.
   - If the reply is a different key string, validate it (alphanumerics and hyphens only, or extract from a pasted Figma URL). If valid, set `TARGET_FILE_KEY`. If invalid, call **AskUserQuestion** again until valid.

2. **Else**, read `templates/agent-handoff.md` at the repository root (YAML front matter) if the file exists. If `active_file_key` is set, call **AskUserQuestion**:

   > "I'll use the Foundations file from handoff: `<active_file_key>`. Use this file? Reply **yes** or paste a different Figma file key."

   - If **yes**, set `TARGET_FILE_KEY` to `active_file_key`.
   - If the reply is a different key string, validate as above.

3. **If still unset**, call **AskUserQuestion**:

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
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Background.shadowTint` |

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
| `color/primary/on-subtle` | `var(--color-on-primary-subtle)` | `on-primary-container` | `.Primary.onSubtle` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/fixed-dim` | `var(--color-primary-fixed-dim)` | `primary-fixed-dim` | `.Primary.fixedDim` |
| `color/primary/on-fixed` | `var(--color-on-primary-fixed)` | `on-primary-fixed` | `.Primary.onFixed` |
| `color/primary/on-fixed-variant` | `var(--color-on-primary-fixed-muted)` | `on-primary-fixed-variant` | `.Primary.onFixedMuted` |
| `color/secondary/default` | `var(--color-secondary)` | `secondary` | `.Secondary.default` |
| `color/secondary/content` | `var(--color-on-secondary)` | `on-secondary` | `.Secondary.on` |
| `color/secondary/subtle` | `var(--color-secondary-subtle)` | `secondary-container` | `.Secondary.subtle` |
| `color/secondary/on-subtle` | `var(--color-on-secondary-subtle)` | `on-secondary-container` | `.Secondary.onSubtle` |
| `color/secondary/fixed` | `var(--color-secondary-fixed)` | `secondary-fixed` | `.Secondary.fixed` |
| `color/secondary/fixed-dim` | `var(--color-secondary-fixed-dim)` | `secondary-fixed-dim` | `.Secondary.fixedDim` |
| `color/secondary/on-fixed` | `var(--color-on-secondary-fixed)` | `on-secondary-fixed` | `.Secondary.onFixed` |
| `color/secondary/on-fixed-variant` | `var(--color-on-secondary-fixed-muted)` | `on-secondary-fixed-variant` | `.Secondary.onFixedMuted` |
| `color/tertiary/default` | `var(--color-accent)` | `tertiary` | `.Tertiary.default` |
| `color/tertiary/content` | `var(--color-on-accent)` | `on-tertiary` | `.Tertiary.on` |
| `color/tertiary/subtle` | `var(--color-accent-subtle)` | `tertiary-container` | `.Tertiary.subtle` |
| `color/tertiary/on-subtle` | `var(--color-on-accent-subtle)` | `on-tertiary-container` | `.Tertiary.onSubtle` |
| `color/tertiary/fixed` | `var(--color-accent-fixed)` | `tertiary-fixed` | `.Tertiary.fixed` |
| `color/tertiary/fixed-dim` | `var(--color-accent-fixed-dim)` | `tertiary-fixed-dim` | `.Tertiary.fixedDim` |
| `color/tertiary/on-fixed` | `var(--color-on-accent-fixed)` | `on-tertiary-fixed` | `.Tertiary.onFixed` |
| `color/tertiary/on-fixed-variant` | `var(--color-on-accent-fixed-muted)` | `on-tertiary-fixed-variant` | `.Tertiary.onFixedMuted` |
| `color/error/default` | `var(--color-danger)` | `error` | `.Status.error` |
| `color/error/content` | `var(--color-on-danger)` | `on-error` | `.Status.onError` |
| `color/error/subtle` | `var(--color-danger-subtle)` | `error-container` | `.Status.errorSubtle` |
| `color/error/on-subtle` | `var(--color-on-danger-subtle)` | `on-error-container` | `.Status.onErrorSubtle` |
| `color/error/fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.errorFixed` |
| `color/error/fixed-dim` | `var(--color-danger-fixed-dim)` | `error-fixed-dim` | `.Status.errorFixedDim` |
| `color/error/on-fixed` | `var(--color-on-danger-fixed)` | `on-error-fixed` | `.Status.onErrorFixed` |
| `color/error/on-fixed-variant` | `var(--color-on-danger-fixed-muted)` | `on-error-fixed-variant` | `.Status.onErrorFixedMuted` |

#### Extensions (not in core M3 baseline diagram — shadcn alignment)

| Figma variable | WEB | ANDROID (extension) | iOS (semantic) |
|---|---|---|---|
| `color/component/input` | `var(--color-field)` | `input` | `.Component.field` |
| `color/component/ring` | `var(--color-focus-ring)` | `ring` | `.Component.ring` |
| `color/component/sidebar` | `var(--color-sidebar)` | `sidebar` | `.Component.sidebar` |
| `color/component/sidebar-content` | `var(--color-on-sidebar)` | `sidebar-foreground` | `.Component.sidebarOn` |

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

**iOS** — **nested dot path** `.Typography.{category}.{size}.{property}`: `category` = first segment as lowercase word (`Display` → `display`, `Headline` → `headline`, `Body` → `body`, `Label` → `label`); `size` = second segment lowercased (`LG` → `lg`, `MD` → `md`, `SM` → `sm`); `property` = tail in **lowerCamel** (`font-size` → `fontSize`, `font-family` → `fontFamily`, `font-weight` → `fontWeight`, `line-height` → `lineHeight`). Example: `Display/LG/font-size` → `.Typography.display.lg.fontSize`.

Every variable in all 12 slots follows this pattern — apply to all 48 variables:

| Property | WEB example | ANDROID | iOS (semantic) |
|---|---|---|---|
| `Display/LG/font-family` | `var(--display-lg-font-family)` | `display-lg-font-family` | `.Typography.display.lg.fontFamily` |
| `Display/LG/font-size` | `var(--display-lg-font-size)` | `display-lg-font-size` | `.Typography.display.lg.fontSize` |
| `Display/LG/font-weight` | `var(--display-lg-font-weight)` | `display-lg-font-weight` | `.Typography.display.lg.fontWeight` |
| `Display/LG/line-height` | `var(--display-lg-line-height)` | `display-lg-line-height` | `.Typography.display.lg.lineHeight` |
| `Headline/LG/font-size` | `var(--headline-lg-font-size)` | `headline-lg-font-size` | `.Typography.headline.lg.fontSize` |
| `Body/MD/font-family` | `var(--body-md-font-family)` | `body-md-font-family` | `.Typography.body.md.fontFamily` |
| `Label/SM/font-weight` | `var(--label-sm-font-weight)` | `label-sm-font-weight` | `.Typography.label.sm.fontWeight` |

(Pattern repeats for all 12 slots: Display/LG, Display/MD, Display/SM, Headline/LG, Headline/MD, Headline/SM, Body/LG, Body/MD, Body/SM, Label/LG, Label/MD, Label/SM — each with the same 4 properties; iOS always `.Typography.{category}.{size}.{propertyCamel}`.)

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
  CSS file: optional (offered after variables are pushed — default `src/styles/tokens.css` if you accept)
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
  color/background/dim            {hex}   {hex}   var(--color-background-dim)      surface-dim               .Background.dim
  color/background/default        {hex}   {hex}   var(--color-background)          surface                   .Background.default
  color/background/bright         {hex}   {hex}   var(--color-background-bright)   surface-bright            .Background.bright
  color/background/container-lowest {hex} {hex}   var(--color-background-container-lowest) surface-container-lowest .Background.lowest
  color/background/container-low  {hex}   {hex}   var(--color-background-container-low)    surface-container-low      .Background.low
  color/background/container      {hex}   {hex}   var(--color-background-container)        surface-container         .Background.mid
  color/background/container-high {hex}   {hex}   var(--color-background-container-high)   surface-container-high     .Background.high
  color/background/container-highest {hex} {hex}   var(--color-background-container-highest) surface-container-highest .Background.highest
  color/background/variant        {hex}   {hex}   var(--color-background-variant)  surface-variant            .Background.variant
  color/background/content             {hex}   {hex}   var(--color-content)             on-surface                 .Foreground.primary
  color/background/content-muted      {hex}   {hex}   var(--color-content-muted)       on-surface-variant          .Foreground.secondary
  color/background/inverse        {hex}   {hex}   var(--color-inverse-surface)     inverse-surface            .Background.inverse
  color/background/inverse-content     {hex}   {hex}   var(--color-inverse-content)     inverse-on-surface          .Foreground.inverse
  color/background/inverse-primary {hex}  {hex}   var(--color-inverse-brand)       inverse-primary            .Primary.inverse
  color/background/scrim          rgba…   rgba…   var(--color-scrim)               scrim                     .Effect.scrim
  color/background/shadow         rgba…   rgba…   var(--color-shadow-tint)         shadow                    .Background.shadowTint
  — border/ (outline) —
  color/border/default            {hex}   {hex}   var(--color-border)              outline                   .Border.default
  color/border/subtle             {hex}   {hex}   var(--color-border-subtle)       outline-variant            .Border.subtle
  — primary/ —
  color/primary/default           {hex}   {hex}   var(--color-primary)             primary                   .Primary.default
  color/primary/content                {hex}   {hex}   var(--color-on-primary)          on-primary                 .Primary.on
  color/primary/subtle              {hex}   {hex}   var(--color-primary-subtle)        primary-container          .Primary.subtle
  color/primary/on-subtle        {hex}   {hex}   var(--color-on-primary-subtle)     on-primary-container        .Primary.onSubtle
  color/primary/fixed             {hex}   {hex}   var(--color-primary-fixed)       primary-fixed              .Primary.fixed
  color/primary/fixed-dim         {hex}   {hex}   var(--color-primary-fixed-dim)   primary-fixed-dim           .Primary.fixedDim
  color/primary/on-fixed          {hex}   {hex}   var(--color-on-primary-fixed)    on-primary-fixed            .Primary.onFixed
  color/primary/on-fixed-variant  {hex}   {hex}   var(--color-on-primary-fixed-muted) on-primary-fixed-variant  .Primary.onFixedMuted
  — secondary/ —
  color/secondary/default         {hex}   {hex}   var(--color-secondary)           secondary                 .Secondary.default
  color/secondary/content              {hex}   {hex}   var(--color-on-secondary)        on-secondary               .Secondary.on
  color/secondary/subtle            {hex}   {hex}   var(--color-secondary-subtle)      secondary-container        .Secondary.subtle
  color/secondary/on-subtle      {hex}   {hex}   var(--color-on-secondary-subtle)   on-secondary-container      .Secondary.onSubtle
  color/secondary/fixed           {hex}   {hex}   var(--color-secondary-fixed)     secondary-fixed            .Secondary.fixed
  color/secondary/fixed-dim       {hex}   {hex}   var(--color-secondary-fixed-dim) secondary-fixed-dim         .Secondary.fixedDim
  color/secondary/on-fixed        {hex}   {hex}   var(--color-on-secondary-fixed)  on-secondary-fixed          .Secondary.onFixed
  color/secondary/on-fixed-variant {hex}  {hex}   var(--color-on-secondary-fixed-muted) on-secondary-fixed-variant .Secondary.onFixedMuted
  — tertiary/ —
  color/tertiary/default          {hex}   {hex}   var(--color-accent)              tertiary                  .Tertiary.default
  color/tertiary/content               {hex}   {hex}   var(--color-on-accent)           on-tertiary                .Tertiary.on
  color/tertiary/subtle             {hex}   {hex}   var(--color-accent-subtle)         tertiary-container         .Tertiary.subtle
  color/tertiary/on-subtle       {hex}   {hex}   var(--color-on-accent-subtle)      on-tertiary-container       .Tertiary.onSubtle
  color/tertiary/fixed            {hex}   {hex}   var(--color-accent-fixed)        tertiary-fixed             .Tertiary.fixed
  color/tertiary/fixed-dim        {hex}   {hex}   var(--color-accent-fixed-dim)    tertiary-fixed-dim          .Tertiary.fixedDim
  color/tertiary/on-fixed         {hex}   {hex}   var(--color-on-accent-fixed)     on-tertiary-fixed           .Tertiary.onFixed
  color/tertiary/on-fixed-variant {hex}   {hex}   var(--color-on-accent-fixed-muted) on-tertiary-fixed-variant  .Tertiary.onFixedMuted
  — error/ —
  color/error/default              {hex}   {hex}   var(--color-danger)              error                     .Status.error
  color/error/content           {hex}   {hex}   var(--color-on-danger)           on-error                   .Status.onError
  color/error/subtle         {hex}   {hex}   var(--color-danger-subtle)         error-container            .Status.errorSubtle
  color/error/on-subtle   {hex}   {hex}   var(--color-on-danger-subtle)      on-error-container          .Status.onErrorSubtle
  color/error/fixed        {hex}   {hex}   var(--color-danger-fixed)        error-fixed                .Status.errorFixed
  color/error/fixed-dim    {hex}   {hex}   var(--color-danger-fixed-dim)    error-fixed-dim             .Status.errorFixedDim
  color/error/on-fixed     {hex}   {hex}   var(--color-on-danger-fixed)     on-error-fixed              .Status.onErrorFixed
  color/error/on-fixed-variant {hex} {hex} var(--color-on-danger-fixed-muted) on-error-fixed-variant    .Status.onErrorFixedMuted
  — component/ (shadcn extensions) —
  color/component/input           {hex}   {hex}   var(--color-field)               input                     .Component.field
  color/component/ring            {hex}   {hex}   var(--color-focus-ring)          ring                      .Component.ring
  color/component/sidebar         {hex}   {hex}   var(--color-sidebar)             sidebar                   .Component.sidebar
  color/component/sidebar-content      {hex}   {hex}   var(--color-on-sidebar)          sidebar-foreground         .Component.sidebarOn

──────────────────────────────────────────────────────────────────────────────────────────────
  TYPOGRAPHY  (48 variables · 8 scale modes)
──────────────────────────────────────────────────────────────────────────────────────────────
  Body font: {bodyFont}   Display font: {displayFont}
  Syntax pattern: {Category}/{Size}/{property} → kebab → WEB var(--{kebab}) · ANDROID kebab · iOS .Typography.{category}.{size}.{propertyCamel}

  Slot          Prop          WEB syntax                      ANDROID          iOS (semantic)
  Display/LG    font-size     var(--display-lg-font-size)     display-lg-font-size     .Typography.display.lg.fontSize
                font-family   var(--display-lg-font-family)   display-lg-font-family   .Typography.display.lg.fontFamily
                font-weight   var(--display-lg-font-weight)   display-lg-font-weight   .Typography.display.lg.fontWeight
                line-height   var(--display-lg-line-height)   display-lg-line-height   .Typography.display.lg.lineHeight
  (pattern repeats for all 12 slots — iOS always `.Typography.{category}.{size}.{propertyCamel}`)

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

> "Does this design system look correct? Reply **yes** to push all five variable collections to Figma (REST API only — no local files yet), or describe any changes (e.g. 'change primary to #E63946', 'use Geist for body font', 'base radius 8px')."

**If the designer replies yes:** proceed to Step 11.

**If the designer requests changes:** identify which inputs need to change and loop back to the appropriate step:
- Color changes → recompute the affected ramp(s) in Step 5, then re-derive all Theme aliases that reference that ramp in Step 6, then re-display the updated plan section and call **AskUserQuestion** again
- Font changes → update typography values in Step 7, re-display the typography table, call **AskUserQuestion** again
- Spacing or radius changes → recompute the affected scale in Step 5 and layout aliases in Step 8, re-display the relevant sections, call **AskUserQuestion** again

Do not proceed to Step 11 until the designer has explicitly replied **yes** (or an equivalent affirmative). **Do not** bundle the optional `tokens.css` write into this approval — that is a separate opt-in in Step 12.5 after the Figma push succeeds.

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
    "iOS":     ".Background.default"
  }
}
```

The `"ANDROID"` value is the **M3 `ColorScheme` role** in **kebab-case** (same role as `MaterialTheme.colorScheme.surface` in Compose — here `surface` is already a single word). Multi-word Compose properties become hyphenated (e.g. `surface-container-high`).

The `"iOS"` value is a **semantic dot path** (e.g. `.Background.default`, `.Background.high`) — not a `UIColor` symbol name. Never copy the ANDROID string into iOS; always read both columns from the Step 6 table.

Look up each variable's three codeSyntax values from the appropriate step:
- Primitives (`color/*`, `Space/*`, `Corner/*`, `elevation/*`) → Step 5 codeSyntax rules
- Theme (`color/background/*`, `color/border/*`, `color/primary/*`, `color/secondary/*`, `color/tertiary/*`, `color/error/*`, `color/component/*`) → Step 6 codeSyntax table (use the exact row — do NOT derive from path, do NOT copy ANDROID value into iOS)
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
| `color/background/default` (Theme) | `var(--color-background)` | `surface` | `.Background.default` |
| `color/error/default` (Theme) | `var(--color-danger)` | `error` | `.Status.error` |
| `color/primary/500` (Primitives) | `var(--color-primary-500)` | `color-primary-500` | `.Palette.primary.500` |

If the `iOS` key is absent or its value **equals** the ANDROID value on Theme variables (e.g. both `surface` on `color/background/default` instead of iOS `.Background.default`), the write used wrong key casing or copied ANDROID into iOS. Re-issue a `PUT` with correct `"iOS"` casing on all affected variables before proceeding to Step 13.

Report any expected variables absent from the verified response.

---

## Step 12.5 — Optional: write `tokens.css` to the codebase

Figma variables are the source of truth in the file. A local **`tokens.css`** mirrors them as CSS custom properties for **`/create-component`** and **`/code-connect`** — not every designer needs it.

Call **AskUserQuestion**:

> "Write a `tokens.css` file into this codebase (mirrors Figma variables as CSS custom properties)? **yes** — I will ask for the path next (default `src/styles/tokens.css`). **no** — keep Figma-only; you can run `/create-design-system` again later and accept the CSS step when you need it for code."

- **yes** → set `WRITE_TOKENS_CSS` to **true** and continue to **Step 13**.
- **no** → set `WRITE_TOKENS_CSS` to **false**, state one line that `/create-component` expects `tokens.css` (or a handoff `token_css_path`) when you wire components — then **skip Step 13 entirely** (no 13a / 13b / 13c) and go to **Step 14**.

---

## Step 13 — Write CSS token file

**Run this step only when `WRITE_TOKENS_CSS` is true** (Step 12.5). If **false**, you already skipped here — go to Step 14.

Using all token values resolved in Steps 5–9, generate a `tokens.css` file and write it to the local codebase. When written, this file is the code-side source of truth that `/create-component` and `/code-connect` depend on.

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
  --color-primary-subtle:              var(--color-primary-100);
  --color-on-primary-subtle:           var(--color-primary-900);
  --color-primary-fixed:             var(--color-primary-100);
  --color-primary-fixed-dim:         var(--color-primary-200);
  --color-on-primary-fixed:          var(--color-primary-900);
  --color-on-primary-fixed-muted:    var(--color-primary-800);

  --color-secondary:                 var(--color-secondary-500);
  --color-on-secondary:              var(--color-secondary-50);
  --color-secondary-subtle:            var(--color-secondary-100);
  --color-on-secondary-subtle:         var(--color-secondary-900);
  --color-secondary-fixed:           var(--color-secondary-100);
  --color-secondary-fixed-dim:       var(--color-secondary-200);
  --color-on-secondary-fixed:        var(--color-secondary-900);
  --color-on-secondary-fixed-muted:  var(--color-secondary-800);

  --color-accent:                    var(--color-tertiary-500);
  --color-on-accent:                 var(--color-tertiary-50);
  --color-accent-subtle:               var(--color-tertiary-100);
  --color-on-accent-subtle:            var(--color-tertiary-900);
  --color-accent-fixed:              var(--color-tertiary-100);
  --color-accent-fixed-dim:          var(--color-tertiary-200);
  --color-on-accent-fixed:           var(--color-tertiary-900);
  --color-on-accent-fixed-muted:     var(--color-tertiary-800);

  --color-danger:                    var(--color-error-600);
  --color-on-danger:                 var(--color-error-50);
  --color-danger-subtle:               var(--color-error-100);
  --color-on-danger-subtle:            var(--color-error-900);
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
  --primary-container:       var(--color-primary-subtle);
  --on-primary-container:    var(--color-on-primary-subtle);
  --primary-foreground:      var(--color-on-primary);
  --primary-subtle:            var(--color-primary-subtle);
  --on-primary-subtle:         var(--color-on-primary-subtle);
  --secondary:               var(--color-secondary);
  --on-secondary:            var(--color-on-secondary);
  --secondary-container:     var(--color-secondary-subtle);
  --on-secondary-container:  var(--color-on-secondary-subtle);
  --secondary-foreground:    var(--color-on-secondary);
  --secondary-subtle:          var(--color-secondary-subtle);
  --on-secondary-subtle:       var(--color-on-secondary-subtle);
  --tertiary:                var(--color-accent);
  --on-tertiary:             var(--color-on-accent);
  --tertiary-container:      var(--color-accent-subtle);
  --on-tertiary-container:   var(--color-on-accent-subtle);
  --accent:                  var(--color-accent-subtle);
  --accent-foreground:       var(--color-on-accent-subtle);
  --destructive:             var(--color-danger);
  --destructive-foreground:  var(--color-on-danger);
  --error:                   var(--color-danger);
  --on-error:                var(--color-on-danger);
  --error-container:         var(--color-danger-subtle);
  --on-error-container:      var(--color-on-danger-subtle);
  --error-subtle:              var(--color-danger-subtle);
  --on-error-subtle:           var(--color-on-danger-subtle);
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
  --color-primary-subtle:              var(--color-primary-800);
  --color-on-primary-subtle:           var(--color-primary-100);
  --color-primary-fixed:             var(--color-primary-300);
  --color-primary-fixed-dim:         var(--color-primary-800);
  --color-on-primary-fixed:          var(--color-primary-100);
  --color-on-primary-fixed-muted:    var(--color-primary-200);

  --color-secondary:                 var(--color-secondary-400);
  --color-on-secondary:              var(--color-secondary-50);
  --color-secondary-subtle:            var(--color-secondary-800);
  --color-on-secondary-subtle:         var(--color-secondary-100);
  --color-secondary-fixed:           var(--color-secondary-300);
  --color-secondary-fixed-dim:       var(--color-secondary-800);
  --color-on-secondary-fixed:        var(--color-secondary-100);
  --color-on-secondary-fixed-muted:  var(--color-secondary-200);

  --color-accent:                    var(--color-tertiary-400);
  --color-on-accent:                 var(--color-tertiary-50);
  --color-accent-subtle:               var(--color-tertiary-800);
  --color-on-accent-subtle:            var(--color-tertiary-100);
  --color-accent-fixed:              var(--color-tertiary-300);
  --color-accent-fixed-dim:          var(--color-tertiary-800);
  --color-on-accent-fixed:           var(--color-tertiary-100);
  --color-on-accent-fixed-muted:     var(--color-tertiary-200);

  --color-danger:                    var(--color-error-400);
  --color-on-danger:                 var(--color-error-50);
  --color-danger-subtle:               var(--color-error-900);
  --color-on-danger-subtle:            var(--color-error-100);
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
  --primary-container:       var(--color-primary-subtle);
  --on-primary-container:    var(--color-on-primary-subtle);
  --primary-foreground:      var(--color-on-primary);
  --primary-subtle:            var(--color-primary-subtle);
  --on-primary-subtle:         var(--color-on-primary-subtle);
  --secondary:               var(--color-secondary);
  --on-secondary:            var(--color-on-secondary);
  --secondary-container:     var(--color-secondary-subtle);
  --on-secondary-container:  var(--color-on-secondary-subtle);
  --secondary-foreground:    var(--color-on-secondary);
  --secondary-subtle:          var(--color-secondary-subtle);
  --on-secondary-subtle:       var(--color-on-secondary-subtle);
  --tertiary:                var(--color-accent);
  --on-tertiary:             var(--color-on-accent);
  --tertiary-container:      var(--color-accent-subtle);
  --on-tertiary-container:   var(--color-on-accent-subtle);
  --accent:                  var(--color-accent-subtle);
  --accent-foreground:       var(--color-on-accent-subtle);
  --destructive:             var(--color-danger);
  --destructive-foreground:  var(--color-on-danger);
  --error:                   var(--color-danger);
  --on-error:                var(--color-on-danger);
  --error-container:         var(--color-danger-subtle);
  --on-error-container:      var(--color-on-danger-subtle);
  --error-subtle:              var(--color-danger-subtle);
  --on-error-subtle:           var(--color-on-danger-subtle);
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
    --color-primary-subtle:              var(--color-primary-800);
    --color-on-primary-subtle:           var(--color-primary-100);
    --color-primary-fixed:             var(--color-primary-300);
    --color-primary-fixed-dim:         var(--color-primary-800);
    --color-on-primary-fixed:          var(--color-primary-100);
    --color-on-primary-fixed-muted:    var(--color-primary-200);
    --color-secondary:                 var(--color-secondary-400);
    --color-on-secondary:              var(--color-secondary-50);
    --color-secondary-subtle:            var(--color-secondary-800);
    --color-on-secondary-subtle:         var(--color-secondary-100);
    --color-secondary-fixed:           var(--color-secondary-300);
    --color-secondary-fixed-dim:       var(--color-secondary-800);
    --color-on-secondary-fixed:        var(--color-secondary-100);
    --color-on-secondary-fixed-muted:  var(--color-secondary-200);
    --color-accent:                    var(--color-tertiary-400);
    --color-on-accent:                 var(--color-tertiary-50);
    --color-accent-subtle:               var(--color-tertiary-800);
    --color-on-accent-subtle:            var(--color-tertiary-100);
    --color-accent-fixed:              var(--color-tertiary-300);
    --color-accent-fixed-dim:          var(--color-tertiary-800);
    --color-on-accent-fixed:           var(--color-tertiary-100);
    --color-on-accent-fixed-muted:     var(--color-tertiary-200);
    --color-danger:                    var(--color-error-400);
    --color-on-danger:                 var(--color-error-50);
    --color-danger-subtle:               var(--color-error-900);
    --color-on-danger-subtle:            var(--color-error-100);
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
    --primary-container:       var(--color-primary-subtle);
    --on-primary-container:    var(--color-on-primary-subtle);
    --primary-foreground:      var(--color-on-primary);
    --primary-subtle:            var(--color-primary-subtle);
    --on-primary-subtle:         var(--color-on-primary-subtle);
    --secondary:               var(--color-secondary);
    --on-secondary:            var(--color-on-secondary);
    --secondary-container:     var(--color-secondary-subtle);
    --on-secondary-container:  var(--color-on-secondary-subtle);
    --secondary-foreground:    var(--color-on-secondary);
    --secondary-subtle:          var(--color-secondary-subtle);
    --on-secondary-subtle:       var(--color-on-secondary-subtle);
    --tertiary:                var(--color-accent);
    --on-tertiary:             var(--color-on-accent);
    --tertiary-container:      var(--color-accent-subtle);
    --on-tertiary-container:   var(--color-on-accent-subtle);
    --accent:                  var(--color-accent-subtle);
    --accent-foreground:       var(--color-on-accent-subtle);
    --destructive:             var(--color-danger);
    --destructive-foreground:  var(--color-on-danger);
    --error:                   var(--color-danger);
    --on-error:                var(--color-on-danger);
    --error-container:         var(--color-danger-subtle);
    --on-error-container:      var(--color-on-danger-subtle);
    --error-subtle:              var(--color-danger-subtle);
    --on-error-subtle:           var(--color-on-danger-subtle);
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
- The file header must include the project name (from `templates/agent-handoff.md` `active_project_name` if present, or the Figma file name) and a "do not edit" note.
- Use CSS custom properties only — no Sass, no PostCSS, no JavaScript.
- Primitives block comes first so that all `var(--color-*)` references in Theme/Layout/Effects resolve within the same file.
- The `@media (prefers-color-scheme: dark)` block duplicates the dark values so the system preference works without JavaScript. This duplication is intentional.

### 13c — Update agent handoff and report

After writing `tokens.css` successfully:

1. If `templates/agent-handoff.md` exists and is writable in the workspace, write `TOKEN_CSS_PATH` there under the `token_css_path` field and set `last_skill_run` to `create-design-system` so `/create-component` and `/code-connect` can pick it up. If the file is missing or not writable (e.g. read-only plugin install), skip the write and state the `TOKEN_CSS_PATH` value explicitly in the Step 14 report so the designer can paste it into the next command.

2. Confirm with the file path and a count of CSS custom properties written. If the write fails (e.g. directory not found), call **AskUserQuestion** with a corrected path prompt and retry once.

---

## Step 14 — Confirm success

Report using this shape. **If `WRITE_TOKENS_CSS` is false**, omit the `CSS token file` line and instead include: `CSS token file: not written (Figma-only — opt in next time if you need tokens for /create-component).`

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

Immediately continue to **Steps 15a–18** (Figma canvas) in the same skill run — do not jump to Step 19 until those steps complete or fail with a logged warning.

**Canvas follow-up checklist (blocking — log one line per row before Step 19):**

| Step | Log line (example) |
|---|---|
| 15a | `Canvas: Step 15a ↳ Primitives — done` or `… skipped (reason)` |
| 15b | `Canvas: Step 15b ↳ Theme — done` or `… skipped (reason)` |
| 15c | `Canvas: Step 15c ↳ Layout + ↳ Text Styles + ↳ Effects — done` or `… skipped (reason)` |
| 16 | `Canvas: Step 16 ↳ MCP Tokens — done` or `… skipped (reason)` |
| 17 | `Canvas: Step 17 ↳ Token Overview — done` or `… skipped (reason)` |
| 18 | `Canvas: Step 18 Thumbnail Cover — done` or `… skipped (reason)` |

---

## Canvas documentation visual spec

Agents **must read this section** before executing Steps **15a–18** and any `use_figma` script that draws token documentation. **`/sync-design-system`** Steps **9b–9e** must follow the **same** structure, binding, and Dev Mode rules (**§ A–D**; see [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md)).

### A — Structure (geometry, naming; stable across all files)

| Rule | Value |
|---|---|
| Content width | 1440px canvas column under doc header (`y > 360` body) |
| Outer padding | 40px horizontal, 40px top / 80px bottom where a `_PageContent` wrapper exists |
| Vertical rhythm | 8px grid (`itemSpacing` / gaps use multiples of 8) |
| Section frames | Auto-layout `VERTICAL`, `primaryAxisSizingMode` `AUTO`, `counterAxisSizingMode` `FIXED`, width `1360` inside 1440 padded parent; `layoutAlign` `STRETCH` where stacking |
| Section shell | `cornerRadius` 16, `strokeWeight` 1, `itemSpacing` 20 inside section (slightly roomier than legacy 16) |
| Section group headers | Full-width strip **1440×56px** (was 48px); title text **20–24px** semibold via **`Doc/Section`** (see **Documentation type ramp** below) |
| Theme token grid | **2 columns** within the 1360px content width: horizontal auto-layout on the section body with **`itemSpacing` 24**; each **token card** is `layoutAlign: STRETCH`, min height driven by content, **24px** internal padding, **12px** card `cornerRadius`, stroke bound to **`color/border/subtle`** |
| Theme swatch previews | **80×80px** minimum per swatch frame, **`cornerRadius` 12**; pair laid out **HORIZONTAL** with **24px** gap; each swatch has a visible **“Light”** / **“Dark”** label (pill or caption, **12–13px**, uppercase optional) |
| Primitives ramp cards | **120×160px** cards, **8px** gap (unchanged); color **fill must bind** to the Primitives variable for that stop (§ **Token demonstration**) |
| MCP table rows | Row frames **min height 44–48px**; cell `paddingLeft`/`paddingRight` **12px**; vertical **`itemSpacing`** on column stacks where used; **PATH** column **min 320px**; table body text **13px** monospace minimum |
| Layer naming | Token Overview: `token-overview/{section}`, `_PageContent`; MCP: `[MCP] Token Manifest`, `token/{collection}/…`; Theme preview wrappers: `doc/theme-preview/light` and `doc/theme-preview/dark` (or suffixed per card); style guide: optional `doc/styleguide/…` prefix |

**Documentation type ramp** (create/update local **Text styles** in Step 15c before drawing pages that need them):

| Style name | Role | Typical binding / source |
|---|---|---|
| `Doc/Section` | Semantic group strips + page section titles | Prefer **`setBoundVariable`** to **`Headline/LG/font-size`**, **`Headline/LG/font-family`**, **`Headline/LG/font-weight`**, **`Headline/LG/line-height`** (Typography · mode **100**). Strip text fill → **`color/neutral/50`** (Primitives); on light cards use **`color/background/content`**. |
| `Doc/TokenName` | Token path on cards, MCP PATH column emphasis | Bind to **`Label/LG/font-size`** (and matching family/weight/line) or **`Headline/SM/*`** Typography vars at mode **100**; **16–18px** effective minimum. |
| `Doc/Code` | WEB / ANDROID / iOS code lines, MCP dense cells | Bind to **`Label/SM/font-size`** (and matching family/weight/line) at mode **100**; **13–14px** mono; **line-height ≥ 1.45**. |
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
| MCP manifest root / table chrome background | `color/background/default` | Theme · Light |
| MCP table header row background | `color/background/variant` | Theme · Light |

**Typography:** After **`Doc/*`** and **slot text styles** exist (Step 15c), **all** style guide headings, token names, code, and MCP table body text must use **`textStyleId`** pointing at those styles — not one-off Inter with arbitrary sizes.

**Fallback:** if a path is missing, log a warning and resolve `color/neutral/200` / `color/neutral/800` from **this file’s** Primitives only.

### D — Token demonstration (Dev Mode inspect)

Layers that **represent** a token’s value must expose that token in **Dev Mode → Variables**, not only a matching hex.

| Surface | Binding rule |
|---|---|
| **Primitives** color ramp card fill | Bind **`boundVariables.color`** on the solid paint to the **Primitives** variable for `color/{ramp}/{stop}` (same path as the label). |
| **Theme** color swatch | Bind paint to the **Theme** variable for that semantic path (e.g. `color/background/default`). To show **Light and Dark** side‑by‑side **while both stay bound to the same variable**: wrap each swatch in a frame and call **`wrapper.setExplicitVariableModeForCollection(themeCollection, lightModeId)`** (and parallel for **Dark**) — **Light** wrapper → Theme collection’s **Light** `modeId`, **Dark** wrapper → **Dark** `modeId` (`ExplicitVariableModesMixin` on frames). Inner rectangle fill uses **`boundVariables.color` → `figma.variables.createVariableAlias(themeVariable)`**. If the API is unavailable or throws, **fallback:** bind **one** swatch only + print the other mode’s resolved hex as text + log `Theme dual-preview: explicit mode unsupported — single bound swatch + hex fallback`. |
| **MCP** SWATCH column (Primitives COLOR + Theme COLOR) | Same as above: **variable-bound** fills, not detached solids. |
| **Layout** spacing bars | Bind **`width`** / **`minWidth`** to the **`space/*`** Layout variable where `setBoundVariable` accepts it; else resolved px + label. |
| **Typography** specimen | **`textStyleId`** → published **`Display/LG`** … styles whose fields bind to Typography variables (below). |

**MODE column (MCP):** For Theme, Typography, and Effects tables, **`MODE`** is the **authoritative scope** for multi‑mode collections (`light` / `dark` or `85` … `200`). Headers must spell that out (“Mode = collection mode”).

---

## Step 15a — Draw Style Guide: ↳ Primitives

Using values from Steps 5–9, run **one** `use_figma` execution for **`↳ Primitives` only**.

1. `figma.setCurrentPageAsync` → page named exactly `↳ Primitives`.
2. Delete every node with **`y > 360`** (keep doc header `y ≤ 360`).
3. Redraw per **Canvas documentation visual spec § A–D**: section label strips **1440×56px**, strip BG/text per **binding map**. Typography: if **`Doc/*`** text styles already exist in the file (from a prior run), assign **`textStyleId`**; otherwise use literal sizes matching the § **A** ramp (**strip title ~22px semibold**, token labels **14–16px**, code lines **13px** mono) — Step **15c** will publish **`Doc/*`** for subsequent passes.

**↳ Primitives page content**

For each of the 5 color ramps (primary, secondary, tertiary, error, neutral), in order:

1. Draw a full-width **section label strip** (**1440×56px**), **binding map** strip BG/text.
2. Draw a row of 11 swatch cards for stops 50 through 950 (in ascending order):
   - Card size: **120×160px**, **8px** gap.
   - **Card color fill:** bind **`boundVariables.color`** on the solid paint to the **Primitives** variable named exactly `color/{ramp}/{stop}` (§ **D**). Do not leave a detached hex fill if the variable exists.
   - Below the fill area, stack three text nodes (**`Doc/TokenName`** / **`Doc/Code`**): stop label (e.g. `500`), resolved hex (for quick read), full path `color/primary/500`.

After all color ramps, draw two more sections:

3. **Space Scale section** — strip **`Doc/Section`** title `Space Scale`; for each `Space/*` token: horizontal bar; **bind `width`** to the **`Space/*`** primitive FLOAT variable when `setBoundVariable('width', …)` succeeds; else width = resolved px (capped **800px**). Metadata column: name, px, WEB from `codeSyntax`, **`Doc/Code`**.
4. **Corner Radius section** — strip title `Corner Radius`; for each `Corner/*` token: **120×120px** square, **`cornerRadius`** = resolved value, fill per **binding map** (`color/neutral/100`); bind **`cornerRadius`** to **`Corner/*`** variable when supported.

Log the **Canvas checklist** row for Step 15a.

---

## Step 15b — Draw Style Guide: ↳ Theme

Run **one** `use_figma` execution for **`↳ Theme` only** (same delete `y > 360` rule, then redraw).

**↳ Theme page**

For each of the 7 semantic groups (`background/`, `border/`, `primary/`, `secondary/`, `tertiary/`, `error/`, `component/`):

1. Draw a **1440×56px** section label strip with the human-readable group name (e.g. `Background`) — **binding map** strip BG/text; title uses **`Doc/Section`**.
2. Under the strip, create a **horizontal** auto-layout row (`layoutAlign: STRETCH`, **`itemSpacing` 24**) holding **two** token cards per row (**2-column** grid). Each **card**:
   - **Frame:** `VERTICAL` auto-layout, **`padding` 24**, **`itemSpacing` 16**, **`cornerRadius` 12**, stroke **1px** bound to **`color/border/subtle`**, fill bound to **`color/background/variant`** (Theme · Light for chrome).
   - **Token path** line first: **`Doc/TokenName`**, full Figma path (e.g. `color/background/default`).
   - **Swatch row:** `HORIZONTAL`, **`itemSpacing` 24**. Two children, each a **`VERTICAL`** stack:
     - **Wrapper frame** (name e.g. `doc/theme-preview/light` or `…/dark`): **no fill**. Immediately call **`lightWrap.setExplicitVariableModeForCollection(themeCollection, lightModeId)`** and **`darkWrap.setExplicitVariableModeForCollection(themeCollection, darkModeId)`** on the respective wrappers so children resolve the correct mode. Inside: a **80×80** rounded rect (**`cornerRadius` 12**) whose **fill paint** uses **`boundVariables.color` → `figma.variables.createVariableAlias(themeVariable)`** for this token path; below it a **`Doc/Caption`** text node **`LIGHT`** / **`DARK`** (or “Light” / “Dark”).
     - If explicit mode APIs fail, use one bound swatch + second line showing resolved hex for the other mode per § **D** fallback.
   - **Caption (optional, at most once per semantic group, not per card):** **`Doc/Caption`** — e.g. `Same token — wrappers set explicit Theme Light / Dark.`
   - **Code block:** three lines **`Doc/Code`** — WEB / ANDROID / iOS from Step 6 **`codeSyntax`** (Light row uses Light `codeSyntax`; duplicate ANDROID/iOS on both previews is acceptable; WEB often shared).

3. After each row of two cards, wrap the pair in a **`STRETCH`** horizontal frame so the next pair stacks **`VERTICAL`** with **24px** gap.

Log the **Canvas checklist** row for Step 15b.

---

## Step 15c — Draw Style Guide: ↳ Layout, ↳ Text Styles, ↳ Effects

Run **one** `use_figma` execution that visits **three pages in order** (`↳ Layout` → `↳ Text Styles` → `↳ Effects`). At the **start** of the script (before page navigation), publish **local Text styles** and **Effect styles** so later drawing can assign **`textStyleId`** / **`effectStyleId`**. On **each** page: delete `y > 360`, then redraw.

### 0 — Publish `Doc/*`, slot Text styles, and Effect styles (idempotent)

Use `figma.getLocalTextStyles()` / `figma.getLocalEffectStyles()`; **`loadFontAsync`** for any `fontName` you set.

1. **`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`** — For each name, **`find` or `figma.createTextStyle()`**. Bind typography fields per § **A** Documentation type ramp (`Headline/LG/*`, `Label/LG/*`, `Label/SM/*`, `Body/SM/*` or `Label/MD/*` at Typography mode **100**) via **`setBoundVariable('fontSize', variable)`** (and parallel fields) where the API allows; otherwise set resolved literals from mode **100** once.
2. **Slot text styles (12)** — Names **exactly** `Display/LG`, `Display/MD`, `Display/SM`, `Headline/LG`, `Headline/MD`, `Headline/SM`, `Body/LG`, `Body/MD`, `Body/SM`, `Label/LG`, `Label/MD`, `Label/SM`. Each style aggregates the four variables `{Slot}/font-size`, `{Slot}/font-family`, `{Slot}/font-weight`, `{Slot}/line-height` with **`setBoundVariable`** when supported so **Dev Mode** shows Typography variable links. If a style already exists, **update** bindings/values to match current variables.
3. **Effect styles** — For each shadow tier **`sm`**, **`md`**, **`lg`**, **`xl`**, **`2xl`**, create or update a local **`Effect/shadow-{tier}`** style: **`effects`** = one **`DROP_SHADOW`** built from resolved **`shadow/color`** (Effects · **Light**) + resolved **`shadow/{tier}/blur`** at **Light** (opacity/spread tuned to match the Foundations recipe used on canvas). **`Effect/shadow-color-only`** optional: single **`DROP_SHADOW`** or color chip note for `shadow/color` education. If duplicate names exist from an old run, **`remove()`** the older duplicate after migrating references, or update in place.

### ↳ Layout page

Two sections (**Spacing**, **Border Radius**); strips **1440×56px** with **`Doc/Section`**. Spacing bars: fill **`color/primary/200`** (bind Primitives variable); **bind `width`** to `space/*` when possible. Radius squares: fill per binding map; **`cornerRadius`** bound to `radius/*` when possible. Labels **`Doc/Code`** / **`Doc/Caption`** for WEB + px + **`ALIAS →`** primitive name.

### ↳ Text Styles page

- **12 vertical rows** (`itemSpacing` **24**). Each row: **`HORIZONTAL`** auto-layout, **`itemSpacing` 32**.
- **Specimen column:** Text **`Display LG`** (or slot-appropriate sample string) with **`textStyleId`** set to the **slot** style (`Display/LG`, …) — **never** assign raw `fontSize` / `fontName` on the specimen.
- **Metadata column:** **`Doc/Code`** lines listing the four variable paths (`…/font-size`, …). Optional second line: scale range “Typography modes **85–200**”.
- **Row divider:** bottom **`stroke`** bound to **`color/border/subtle`**.

### ↳ Effects page

- **Premium cards:** outer preview frame **~240×260px**, **`cornerRadius` 16**, fill/stroke per **binding map**; inner **96×96** circle (or rounded square) carrying the shadow.
- For each **`shadow/{tier}/blur`**, show **Light** and **Dark** previews using **`setExplicitVariableModeForCollection`** on **Effects** collection wrappers (same pattern as Theme § **D**). Apply matching **`Effect/shadow-{tier}`** to a pinned demo node via **`effectStyleId`** where the tier matches.
- **`shadow/color`:** dedicated small card explaining RGBA + bound **`shadow/color`** variable fill on a swatch rect if separate from blur tiers.

Log the **Canvas checklist** row for Step 15c.

---

*Detail for swatch geometry, Theme card layout, Layout/Text/Effects rows is in Steps **15a–15c** above. If any legacy instruction elsewhere in this file conflicts with **Canvas documentation visual spec § A–D**, the spec wins (token-bound chrome, Light doc mode, Dev Mode bindings).*

---

## Step 16 — Draw MCP Tokens Page

Navigate to the `↳ MCP Tokens` page using `figma.setCurrentPageAsync`. Find and delete any existing frame named `[MCP] Token Manifest`. Then build a new root frame named `[MCP] Token Manifest` positioned at x=0, y=360 (below the doc header), width=1440, **`layoutMode: VERTICAL`**, `primaryAxisSizingMode: AUTO`, `counterAxisSizingMode: FIXED`, padding 24, `itemSpacing` 24 — fill and strokes per **Canvas documentation visual spec § C** (root background → `color/background/default`, not detached `#FFFFFF` unless binding fails).

Inside the root frame, first create the JSON manifest text node, then create the five collection table frames stacked vertically (each sub-frame also **VERTICAL** auto-layout with padding **16**, `itemSpacing` **10**, row frames **minHeight ~44** per § **A**).

**JSON manifest text node**

Create a text node named `[MCP] JSON Manifest` at the top of the root frame (y=0 within the frame). Set its content to the full token manifest as a minified JSON string in this shape — substitute all `{…}` placeholders with actual resolved values, no aliases:

```
{ "meta": { "generated": "<ISO-8601 timestamp>", "skill": "create-design-system", "file": "<TARGET_FILE_KEY>" }, "collections": { "Primitives": { "<path>": { "type": "COLOR", "value": "<hex>", "web": "<css-var>", "android": "<kebab-case>", "ios": "<dot.path>" }, ... }, "Theme": { "light": { "<path>": { "type": "COLOR", "value": "<hex>", "web": "...", "android": "...", "ios": "..." }, ... }, "dark": { ... } }, "Typography": { "100": { "<path>": { "type": "FLOAT", "value": <number>, "web": "...", "android": "...", "ios": "..." }, ... }, "130": { ... }, ... }, "Layout": { "<path>": { "type": "FLOAT", "value": <number>, "web": "...", "android": "...", "ios": "..." }, ... }, "Effects": { "<path>": { ... }, ... } } }
```

Apply **`Doc/Code`** (`textStyleId`) if that style exists from Step **15c**; otherwise use the closest monospace at **≥13px**. Width: 1440px.

**Collection table frames**

Create five sub-frames stacked vertically below the JSON text node, each named as follows. Each frame has a header row and one data row per token. Every data row is also a named frame following the pattern `token/{collection}/{path}` (include **`/{mode}/`** where applicable) so agents can look up individual tokens by layer name.

**`ALIAS →` column (human + Dev Mode context):** For each variable, inspect `valuesByMode[modeId]` from the Plugin API (or REST `variables/local`). If the value is **`VARIABLE_ALIAS`**, resolve the **target variable’s `name`** (Figma path, e.g. `color/neutral/50`, `Space/300`, `elevation/400`) and print that string in **`ALIAS →`**. If the value is a **raw COLOR / FLOAT / STRING** (no alias), print **`— (raw)`** or **`— (RGBA)`** for hard-coded Theme tokens (`color/background/scrim`, `shadow/color`, etc.). If Typography aliases another token (unusual), show that path; else **`—`**.

**`MODE` column:** First header row note (small **`Doc/Caption`** above the table or subtitle inside the collection frame): **`MODE` = Figma variable collection mode** (`light` / `dark` for Theme & Effects; `85` … `200` for Typography).

**SWATCH column (Theme + Primitives COLOR only):** **`≥28×28px`** (use **32×32** when space allows). Fill paint must use **`boundVariables.color` → `figma.variables.createVariableAlias(variable)`** for the **same variable** as that row (§ **D**). Do **not** use a detached solid for COLOR swatches.

Column specs and row content per collection:

- **[MCP] Primitives** — `PATH | TYPE | VALUE | SWATCH | WEB | ANDROID | iOS`. One row per Primitives variable. **SWATCH:** variable-bound **Primitives** color for COLOR types; blank for FLOAT. Text: **`Doc/Code`** or **13px** mono.

- **[MCP] Theme** — `PATH | MODE | TYPE | ALIAS → | VALUE | SWATCH | WEB | ANDROID | iOS`. **Two rows** per Theme variable (`light`, `dark`). Row names `token/theme/light/{path}`, `token/theme/dark/{path}`. **`MODE`** cell literal `light` / `dark`. **`VALUE`** resolved hex still shown for quick reading. **`SWATCH`** uses **explicit `setExplicitVariableModeForCollection` on the row frame** OR the swatch wrapper so the bound Theme color resolves in that mode (same technique as Step **15b**). If that is too heavy, bind swatch without explicit mode and keep **`VALUE`** authoritative — log once per table.

- **[MCP] Typography** — `PATH | PROPERTY | MODE | ALIAS → | VALUE | WEB | ANDROID | iOS`. One row per variable × mode (**384** rows). **`ALIAS →`** per rule above.

- **[MCP] Layout** — `PATH | TYPE | VALUE | ALIAS → | WEB | ANDROID | iOS`. **`ALIAS →`** = aliased Primitive (`Space/300`, `Corner/Medium`, …).

- **[MCP] Effects** — `PATH | MODE | TYPE | ALIAS → | VALUE | SWATCH | WEB | ANDROID | iOS`. **`SWATCH`** only for **`shadow/color`** (bound variable). Blur rows leave SWATCH blank or use a neutral **`—`**. **`ALIAS →`**: blur rows → **`elevation/*`** target; `shadow/color` → **`— (RGBA)`**.

**Column widths (guideline, adjust if needed):** PATH **320px**, MODE **64px**, TYPE **56px**, ALIAS → **200px**, VALUE **96px**, SWATCH **40px** (cell fits **32px** rect + padding), WEB **200px**, ANDROID **200px**, iOS **220px**.

All column headers: **`Doc/TokenName`** or bold **`Doc/Code`**; header row backgrounds **`color/background/variant`** (bound per § **C**). Add a **`Doc/Caption`** table subtitle: **“MODE = collection mode name in Figma.”**

Log the **Canvas checklist** row for Step 16.

---

## Step 17 — Populate Token Overview

Follow **Canvas documentation visual spec § A–D** for any new or updated frames/text on this page.

Navigate to the `↳ Token Overview` page using `figma.setCurrentPageAsync`. The `/new-project` skill's Step 5d drew this page (Figma script: [`skills/new-project/phases/05d-token-overview.md`](skills/new-project/phases/05d-token-overview.md)). **Rebind documentation chrome** on `_PageContent` and each `token-overview/*` section shell: `fills` / `strokes` / text fills per the **Token binding map § C** (Theme Light + Primitives), or resolved equivalents from **this file** — so the overview reflects **this** design system, not generic grays.

**Architecture diagram (Section 1)**

Find the five collection box frames in the architecture flow diagram (look for frames containing the collection names: `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`). Update their fills:

- `Primitives` box: fill with the resolved hex for `color/primary/default` (Light mode).
- `Theme` box: fill with the resolved hex for `color/secondary/default` (Light mode).
- `Typography`, `Layout`, `Effects` boxes: fill with the resolved hex for `color/neutral/800`.

Prefer **variable bindings** to those Theme/Primitive variables when the Plugin API allows (so the diagram updates on sync). Leave sizes, positions, and arrow connectors unchanged unless rebinding requires no layout change.

**Platform Mapping table (Section 2)**

Find the platform-mapping table (Section `token-overview/platform-mapping` or the table stack created in Step 5d). For **every** row that displays a Figma token path, read **live** `codeSyntax` from Step 11 (WEB / ANDROID / iOS) and update the WEB, ANDROID, and iOS cells if they differ.

**Minimum row set** (must all be verified — add rows for any additional tokens the table already shows):

`color/background/default`, `color/background/content`, `color/background/content-muted`, `color/background/variant`, `color/border/default`, `color/border/subtle`, `color/primary/default`, `color/primary/content`, `color/primary/subtle`, `color/secondary/default`, `color/tertiary/default`, `color/error/default`, `color/component/ring`, `Headline/LG/font-size`, `Body/MD/font-size`, `space/md`, `space/lg`, `radius/md`, `radius/lg`, `shadow/color`

If the table physically has fewer rows, insert additional auto-layout rows to match the section layout spec (§ A) before filling cells.

**Phone frames (Section 3)**

Find the two phone frame rectangles in the Dark Mode column of Section 3. Set the fill of the frame labeled `Light` to the resolved hex for `color/background/default` (Light mode). Set the fill of the frame labeled `Dark` to the resolved hex for `color/background/default` (Dark mode). Prefer variable binding to `color/background/default` with mode overrides if supported.

**Placeholder strips from `/new-project` Step 5d**

Find every node on `↳ Token Overview` whose **name** starts with `placeholder/` (amber “run /create-design-system” notes). Delete each of these nodes after the sections above are updated — they are scaffolding only, not part of the final spec.

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
5. **iOS:** use **dot paths** — Step 5 (Primitives), Step 8 (Layout), Step 9 (Effects). **Typography:** for `Category/Size/property` variables, emit **`.Typography.{category}.{size}.{propertyCamel}`** (see Step 7 iOS rule — e.g. `Headline/MD/line-height` → `.Typography.headline.md.lineHeight`).
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
| `color/background/shadow` | `var(--color-shadow-tint)` | `shadow` | `.Background.shadowTint` |
| `color/background/variant` | `var(--color-background-variant)` | `surface-variant` | `.Background.variant` |
| `color/background/content-muted` | `var(--color-content-muted)` | `on-surface-variant` | `.Foreground.secondary` |
| `color/border/default` | `var(--color-border)` | `outline` | `.Border.default` |
| `color/primary/fixed` | `var(--color-primary-fixed)` | `primary-fixed` | `.Primary.fixed` |
| `color/primary/content` | `var(--color-on-primary)` | `on-primary` | `.Primary.on` |
| `color/error/fixed` | `var(--color-danger-fixed)` | `error-fixed` | `.Status.errorFixed` |
| `color/error/default` | `var(--color-danger)` | `error` | `.Status.error` |

The full Theme codeSyntax table is in Step 6 — this is just a reminder that path ≠ codeSyntax for Theme.

**Primitives color ramps:**
- `color/primary/500` → WEB `var(--color-primary-500)`, ANDROID `color-primary-500`, iOS `.Palette.primary.500`
- `color/neutral/100` → WEB `var(--color-neutral-100)`, ANDROID `color-neutral-100`, iOS `.Palette.neutral.100`

**Layout / Effects (pattern):**
- `space/md` → WEB `var(--space-md)`, ANDROID `space-md`, iOS `.Layout.space.md`
- `Display/LG/font-size` → WEB `var(--display-lg-font-size)`, ANDROID `display-lg-font-size`, iOS `.Typography.display.lg.fontSize`

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
