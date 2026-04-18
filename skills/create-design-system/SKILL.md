---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives (including `typeface/display` + `typeface/body` STRING primitives), Theme (Light/Dark modes), Typography (M3 baseline — 15 slots × 4 properties × 8 Android-curve scale modes; font-family aliases typeface primitives), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections. Local tokens.css is optional (explicit opt-in after variables are pushed).
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

- [ ] Building Primitives (color ramps, space, radius, elevation, typeface strings)
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
- [ ] Filling Token Overview from live variables (Step 17)
- [ ] Updating Thumbnail cover (brand gradient) (Step 18)
- [ ] Offering next step (`/create-component`)

**Maps to skill steps:** rows 1–5 → Steps 5–9 · row 6 → Step 10 · rows 7–8 → Steps 11–12 · row 9 → Step 12.5 + Step 13 (`tokens.css`, skip row 9 body if declined) · row 10 → Step 14 · rows 11–13 → Steps 15a–15c · rows 14–15 → Steps 17–18 · row 16 → Step 19.

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
   - Body font family name (maps to Primitives **`typeface/body`** and Step 7 body slots)
   - Display/heading font family name (maps to Primitives **`typeface/display`** and Step 7 display slots)
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
3. Write `codeSyntax` on each new variable per §7b pattern before publishing.
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
    Corner/Extra-small   {N}px    var(--corner-extra-small) corner-extra-small · .Corner.extra.small
    Corner/Small         {N}px    var(--corner-small)       corner-small · .Corner.small
    Corner/Medium        {N}px    var(--corner-medium)      corner-medium · .Corner.medium
    Corner/Large         {N}px    var(--corner-large)       corner-large · .Corner.large
    Corner/Extra-large   28px     var(--corner-extra-large) corner-extra-large · .Corner.extra.large
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
  color/background/shadow         rgba…   rgba…   var(--color-shadow-tint)         shadow                    .Background.shadow.tint
  — border/ (outline) —
  color/border/default            {hex}   {hex}   var(--color-border)              outline                   .Border.default
  color/border/subtle             {hex}   {hex}   var(--color-border-subtle)       outline-variant            .Border.subtle
  — primary/ —
  color/primary/default           {hex}   {hex}   var(--color-primary)             primary                   .Primary.default
  color/primary/content                {hex}   {hex}   var(--color-on-primary)          on-primary                 .Primary.on
  color/primary/subtle              {hex}   {hex}   var(--color-primary-subtle)        primary-container          .Primary.subtle
  color/primary/on-subtle        {hex}   {hex}   var(--color-on-primary-subtle)     on-primary-container        .Primary.on.subtle
  color/primary/fixed             {hex}   {hex}   var(--color-primary-fixed)       primary-fixed              .Primary.fixed
  color/primary/fixed-dim         {hex}   {hex}   var(--color-primary-fixed-dim)   primary-fixed-dim           .Primary.fixed.dim
  color/primary/on-fixed          {hex}   {hex}   var(--color-on-primary-fixed)    on-primary-fixed            .Primary.on.fixed
  color/primary/on-fixed-variant  {hex}   {hex}   var(--color-on-primary-fixed-muted) on-primary-fixed-variant  .Primary.on.fixed.muted
  — secondary/ —
  color/secondary/default         {hex}   {hex}   var(--color-secondary)           secondary                 .Secondary.default
  color/secondary/content              {hex}   {hex}   var(--color-on-secondary)        on-secondary               .Secondary.on
  color/secondary/subtle            {hex}   {hex}   var(--color-secondary-subtle)      secondary-container        .Secondary.subtle
  color/secondary/on-subtle      {hex}   {hex}   var(--color-on-secondary-subtle)   on-secondary-container      .Secondary.on.subtle
  color/secondary/fixed           {hex}   {hex}   var(--color-secondary-fixed)     secondary-fixed            .Secondary.fixed
  color/secondary/fixed-dim       {hex}   {hex}   var(--color-secondary-fixed-dim) secondary-fixed-dim         .Secondary.fixed.dim
  color/secondary/on-fixed        {hex}   {hex}   var(--color-on-secondary-fixed)  on-secondary-fixed          .Secondary.on.fixed
  color/secondary/on-fixed-variant {hex}  {hex}   var(--color-on-secondary-fixed-muted) on-secondary-fixed-variant .Secondary.on.fixed.muted
  — tertiary/ —
  color/tertiary/default          {hex}   {hex}   var(--color-accent)              tertiary                  .Tertiary.default
  color/tertiary/content               {hex}   {hex}   var(--color-on-accent)           on-tertiary                .Tertiary.on
  color/tertiary/subtle             {hex}   {hex}   var(--color-accent-subtle)         tertiary-container         .Tertiary.subtle
  color/tertiary/on-subtle       {hex}   {hex}   var(--color-on-accent-subtle)      on-tertiary-container       .Tertiary.on.subtle
  color/tertiary/fixed            {hex}   {hex}   var(--color-accent-fixed)        tertiary-fixed             .Tertiary.fixed
  color/tertiary/fixed-dim        {hex}   {hex}   var(--color-accent-fixed-dim)    tertiary-fixed-dim          .Tertiary.fixed.dim
  color/tertiary/on-fixed         {hex}   {hex}   var(--color-on-accent-fixed)     on-tertiary-fixed           .Tertiary.on.fixed
  color/tertiary/on-fixed-variant {hex}   {hex}   var(--color-on-accent-fixed-muted) on-tertiary-fixed-variant  .Tertiary.on.fixed.muted
  — error/ —
  color/error/default              {hex}   {hex}   var(--color-danger)              error                     .Status.error
  color/error/content           {hex}   {hex}   var(--color-on-danger)           on-error                   .Status.on.error
  color/error/subtle         {hex}   {hex}   var(--color-danger-subtle)         error-container            .Status.error.subtle
  color/error/on-subtle   {hex}   {hex}   var(--color-on-danger-subtle)      on-error-container          .Status.on.error.subtle
  color/error/fixed        {hex}   {hex}   var(--color-danger-fixed)        error-fixed                .Status.error.fixed
  color/error/fixed-dim    {hex}   {hex}   var(--color-danger-fixed-dim)    error-fixed-dim             .Status.error.fixed.dim
  color/error/on-fixed     {hex}   {hex}   var(--color-on-danger-fixed)     on-error-fixed              .Status.on.error.fixed
  color/error/on-fixed-variant {hex} {hex} var(--color-on-danger-fixed-muted) on-error-fixed-variant    .Status.on.error.fixed.muted
  — component/ (shadcn extensions) —
  color/component/input           {hex}   {hex}   var(--color-field)               input                     .Component.field
  color/component/ring            {hex}   {hex}   var(--color-focus-ring)          ring                      .Component.ring
  color/component/sidebar         {hex}   {hex}   var(--color-sidebar)             sidebar                   .Component.sidebar
  color/component/sidebar-content      {hex}   {hex}   var(--color-on-sidebar)          sidebar-foreground         .Component.sidebar.on

──────────────────────────────────────────────────────────────────────────────────────────────
  TYPOGRAPHY  (60 variables · 8 scale modes)
──────────────────────────────────────────────────────────────────────────────────────────────
  Primitives typeface: typeface/display = "{displayFont}" · typeface/body = "{bodyFont}" (STRING; all Typography */font-family alias these)
  Syntax pattern: {Category}/{Size}/{property} → kebab → WEB var(--{kebab}) · ANDROID kebab · iOS .Typography.{category}.{size}.{propertyCamel}

  Slot          Prop          WEB syntax                      ANDROID          iOS (semantic)
  Display/LG    font-size     var(--display-lg-font-size)     display-lg-font-size     .Typography.display.lg.font.size
                font-family   var(--display-lg-font-family)   display-lg-font-family   .Typography.display.lg.font.family
                font-weight   var(--display-lg-font-weight)   display-lg-font-weight   .Typography.display.lg.font.weight
                line-height   var(--display-lg-line-height)   display-lg-line-height   .Typography.display.lg.line.height
  (pattern repeats for all 15 slots — iOS always `.Typography.{category}.{size}.{propertyCamel}`)

  Sizes — 100 (default) / 130 (large) / 200 (max):
  Slot           100      130      200
  Display/LG     57px     {N}px    {N}px
  Display/MD     45px     {N}px    {N}px
  Display/SM     36px     {N}px    {N}px
  Headline/LG    32px     {N}px    {N}px
  Headline/MD    28px     {N}px    {N}px
  Headline/SM    24px     {N}px    {N}px
  Title/LG       22px     {N}px    {N}px
  Title/MD       16px     {N}px    {N}px
  Title/SM       14px     {N}px    {N}px
  Body/LG        16px     {N}px    {N}px
  Body/MD        14px     {N}px    {N}px
  Body/SM        12px     {N}px    {N}px
  Label/LG       14px     {N}px    {N}px
  Label/MD       12px     {N}px    {N}px
  Label/SM       11px     {N}px    {N}px
  (font-family aliases Primitives typeface; font-weight constant across all 8 modes)

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
- Font changes → update **`typeface/display`** and **`typeface/body`** in Step 5 (and any slot metrics in Step 7 if sizes/weights should change), re-display the typography table, call **AskUserQuestion** again
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
- Primitives (`color/*`, `Space/*`, `Corner/*`, `elevation/*`, `typeface/*`) → Step 5 codeSyntax rules
- Theme (`color/background/*`, `color/border/*`, `color/primary/*`, `color/secondary/*`, `color/tertiary/*`, `color/error/*`, `color/component/*`) → Step 6 codeSyntax table (use the exact row — do NOT derive from path, do NOT copy ANDROID value into iOS)
- Typography (`Display/*`, `Headline/*`, `Title/*`, `Body/*`, `Label/*`) → Step 7 codeSyntax rules
- Layout (`space/*`, `radius/*`) → Step 8 codeSyntax rules
- Effects (`shadow/*`) → Step 9 codeSyntax rules

### variableModeValues array

Each entry: `{ "variableId": "TEMP_VAR_{NAME}", "modeId": "TEMP_MODE_{...}", "value": <value> }`

For alias values: `"value": { "type": "VARIABLE_ALIAS", "id": "<primitive-variable-id>" }`
For hard-coded COLOR: `"value": { "r": 0, "g": 0, "b": 0, "a": 0.32 }` (Figma COLOR uses 0–1 float channels)
For hard-coded FLOAT: `"value": 57`
For Primitives **STRING** (`typeface/display`, `typeface/body`): `"value": "Inter"` (the resolved family name from Step 3 — quote per Figma API string rules)

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
| `typeface/display` (Primitives) | `var(--typeface-display)` | `typeface-display` | `.Typeface.display` |

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

  /* Typeface — STRING primitives; Typography font-family tokens alias these in Figma */
  --typeface-display: {displayFont};
  --typeface-body:    {bodyFont};
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

/* ─── Typography — Default (scale 100) — M3 roles + semantic HTML aliases ─ */
:root {
  /* Role tokens (match Figma Typography variable WEB codeSyntax) */
  --display-lg-font-family:  var(--typeface-display);
  --display-lg-font-size:    57px;
  --display-lg-font-weight:  400;
  --display-lg-line-height:  64px;

  --display-md-font-family:  var(--typeface-display);
  --display-md-font-size:    45px;
  --display-md-font-weight:  400;
  --display-md-line-height:  52px;

  --display-sm-font-family:  var(--typeface-display);
  --display-sm-font-size:    36px;
  --display-sm-font-weight:  400;
  --display-sm-line-height:  44px;

  --headline-lg-font-family: var(--typeface-display);
  --headline-lg-font-size:   32px;
  --headline-lg-font-weight: 400;
  --headline-lg-line-height: 40px;

  --headline-md-font-family: var(--typeface-display);
  --headline-md-font-size:   28px;
  --headline-md-font-weight: 400;
  --headline-md-line-height: 36px;

  --headline-sm-font-family: var(--typeface-display);
  --headline-sm-font-size:   24px;
  --headline-sm-font-weight: 400;
  --headline-sm-line-height: 32px;

  --title-lg-font-family:    var(--typeface-display);
  --title-lg-font-size:      22px;
  --title-lg-font-weight:    400;
  --title-lg-line-height:    28px;

  --title-md-font-family:    var(--typeface-display);
  --title-md-font-size:      16px;
  --title-md-font-weight:    500;
  --title-md-line-height:    24px;

  --title-sm-font-family:    var(--typeface-display);
  --title-sm-font-size:      14px;
  --title-sm-font-weight:    500;
  --title-sm-line-height:    20px;

  --body-lg-font-family:     var(--typeface-body);
  --body-lg-font-size:       16px;
  --body-lg-font-weight:     400;
  --body-lg-line-height:     24px;

  --body-md-font-family:     var(--typeface-body);
  --body-md-font-size:       14px;
  --body-md-font-weight:     400;
  --body-md-line-height:     20px;

  --body-sm-font-family:     var(--typeface-body);
  --body-sm-font-size:       12px;
  --body-sm-font-weight:     400;
  --body-sm-line-height:     16px;

  /* Body variants (Step 7b) — size / line / family alias the base body; only weight + decoration differ. */
  --font-weight-medium:      500;

  --body-lg-emphasis-font-family: var(--body-lg-font-family);
  --body-lg-emphasis-font-size:   var(--body-lg-font-size);
  --body-lg-emphasis-font-weight: var(--font-weight-medium);
  --body-lg-emphasis-line-height: var(--body-lg-line-height);
  --body-md-emphasis-font-family: var(--body-md-font-family);
  --body-md-emphasis-font-size:   var(--body-md-font-size);
  --body-md-emphasis-font-weight: var(--font-weight-medium);
  --body-md-emphasis-line-height: var(--body-md-line-height);
  --body-sm-emphasis-font-family: var(--body-sm-font-family);
  --body-sm-emphasis-font-size:   var(--body-sm-font-size);
  --body-sm-emphasis-font-weight: var(--font-weight-medium);
  --body-sm-emphasis-line-height: var(--body-sm-line-height);

  --body-lg-italic-font-family: var(--body-lg-font-family);
  --body-lg-italic-font-size:   var(--body-lg-font-size);
  --body-lg-italic-font-weight: var(--body-lg-font-weight);
  --body-lg-italic-line-height: var(--body-lg-line-height);
  --body-md-italic-font-family: var(--body-md-font-family);
  --body-md-italic-font-size:   var(--body-md-font-size);
  --body-md-italic-font-weight: var(--body-md-font-weight);
  --body-md-italic-line-height: var(--body-md-line-height);
  --body-sm-italic-font-family: var(--body-sm-font-family);
  --body-sm-italic-font-size:   var(--body-sm-font-size);
  --body-sm-italic-font-weight: var(--body-sm-font-weight);
  --body-sm-italic-line-height: var(--body-sm-line-height);

  --body-lg-link-font-family: var(--body-lg-font-family);
  --body-lg-link-font-size:   var(--body-lg-font-size);
  --body-lg-link-font-weight: var(--body-lg-font-weight);
  --body-lg-link-line-height: var(--body-lg-line-height);
  --body-md-link-font-family: var(--body-md-font-family);
  --body-md-link-font-size:   var(--body-md-font-size);
  --body-md-link-font-weight: var(--body-md-font-weight);
  --body-md-link-line-height: var(--body-md-line-height);
  --body-sm-link-font-family: var(--body-sm-font-family);
  --body-sm-link-font-size:   var(--body-sm-font-size);
  --body-sm-link-font-weight: var(--body-sm-font-weight);
  --body-sm-link-line-height: var(--body-sm-line-height);

  --body-lg-strikethrough-font-family: var(--body-lg-font-family);
  --body-lg-strikethrough-font-size:   var(--body-lg-font-size);
  --body-lg-strikethrough-font-weight: var(--body-lg-font-weight);
  --body-lg-strikethrough-line-height: var(--body-lg-line-height);
  --body-md-strikethrough-font-family: var(--body-md-font-family);
  --body-md-strikethrough-font-size:   var(--body-md-font-size);
  --body-md-strikethrough-font-weight: var(--body-md-font-weight);
  --body-md-strikethrough-line-height: var(--body-md-line-height);
  --body-sm-strikethrough-font-family: var(--body-sm-font-family);
  --body-sm-strikethrough-font-size:   var(--body-sm-font-size);
  --body-sm-strikethrough-font-weight: var(--body-sm-font-weight);
  --body-sm-strikethrough-line-height: var(--body-sm-line-height);

  /* Decoration + color coupling for link / strikethrough (Figma text styles carry the
     text-decoration; these custom properties are the canonical web surface). */
  --body-link-text-decoration:          underline;
  --body-strikethrough-text-decoration: line-through;
  --body-link-color:                    var(--color-primary-default);
  --body-strikethrough-color:           var(--color-content-muted);

  --label-lg-font-family:    var(--typeface-body);
  --label-lg-font-size:      14px;
  --label-lg-font-weight:    500;
  --label-lg-line-height:    20px;

  --label-md-font-family:    var(--typeface-body);
  --label-md-font-size:      12px;
  --label-md-font-weight:    500;
  --label-md-line-height:    16px;

  --label-sm-font-family:    var(--typeface-body);
  --label-sm-font-size:      11px;
  --label-sm-font-weight:    500;
  --label-sm-line-height:    16px;

  /* Semantic WEB — H1–H6, body, caption, small (alias M3 roles; use in app CSS) */
  --text-display-lg-font-family: var(--display-lg-font-family);
  --text-display-lg-font-size:   var(--display-lg-font-size);
  --text-display-lg-font-weight: var(--display-lg-font-weight);
  --text-display-lg-line-height: var(--display-lg-line-height);
  --text-display-md-font-family: var(--display-md-font-family);
  --text-display-md-font-size:   var(--display-md-font-size);
  --text-display-md-font-weight: var(--display-md-font-weight);
  --text-display-md-line-height: var(--display-md-line-height);
  --text-display-sm-font-family: var(--display-sm-font-family);
  --text-display-sm-font-size:   var(--display-sm-font-size);
  --text-display-sm-font-weight: var(--display-sm-font-weight);
  --text-display-sm-line-height: var(--display-sm-line-height);

  --text-h1-font-family: var(--headline-lg-font-family);
  --text-h1-font-size:   var(--headline-lg-font-size);
  --text-h1-font-weight: var(--headline-lg-font-weight);
  --text-h1-line-height: var(--headline-lg-line-height);
  --text-h2-font-family: var(--headline-md-font-family);
  --text-h2-font-size:   var(--headline-md-font-size);
  --text-h2-font-weight: var(--headline-md-font-weight);
  --text-h2-line-height: var(--headline-md-line-height);
  --text-h3-font-family: var(--headline-sm-font-family);
  --text-h3-font-size:   var(--headline-sm-font-size);
  --text-h3-font-weight: var(--headline-sm-font-weight);
  --text-h3-line-height: var(--headline-sm-line-height);
  --text-h4-font-family: var(--title-lg-font-family);
  --text-h4-font-size:   var(--title-lg-font-size);
  --text-h4-font-weight: var(--title-lg-font-weight);
  --text-h4-line-height: var(--title-lg-line-height);
  --text-h5-font-family: var(--title-md-font-family);
  --text-h5-font-size:   var(--title-md-font-size);
  --text-h5-font-weight: var(--title-md-font-weight);
  --text-h5-line-height: var(--title-md-line-height);
  --text-h6-font-family: var(--title-sm-font-family);
  --text-h6-font-size:   var(--title-sm-font-size);
  --text-h6-font-weight: var(--title-sm-font-weight);
  --text-h6-line-height: var(--title-sm-line-height);

  --text-body-lg-font-family: var(--body-lg-font-family);
  --text-body-lg-font-size:   var(--body-lg-font-size);
  --text-body-lg-font-weight: var(--body-lg-font-weight);
  --text-body-lg-line-height: var(--body-lg-line-height);
  --text-body-font-family:    var(--body-md-font-family);
  --text-body-font-size:      var(--body-md-font-size);
  --text-body-font-weight:    var(--body-md-font-weight);
  --text-body-line-height:    var(--body-md-line-height);
  --text-body-sm-font-family: var(--body-sm-font-family);
  --text-body-sm-font-size:   var(--body-sm-font-size);
  --text-body-sm-font-weight: var(--body-sm-font-weight);
  --text-body-sm-line-height: var(--body-sm-line-height);

  /* Semantic body-variant aliases — use these in prose / component CSS. Pair each variant
     with its decoration + color custom property (below) so <a class="text-body-link"> renders
     with underline + brand color in one line. */
  --text-body-lg-emphasis-font-family: var(--body-lg-emphasis-font-family);
  --text-body-lg-emphasis-font-size:   var(--body-lg-emphasis-font-size);
  --text-body-lg-emphasis-font-weight: var(--body-lg-emphasis-font-weight);
  --text-body-lg-emphasis-line-height: var(--body-lg-emphasis-line-height);
  --text-body-emphasis-font-family:    var(--body-md-emphasis-font-family);
  --text-body-emphasis-font-size:      var(--body-md-emphasis-font-size);
  --text-body-emphasis-font-weight:    var(--body-md-emphasis-font-weight);
  --text-body-emphasis-line-height:    var(--body-md-emphasis-line-height);
  --text-body-sm-emphasis-font-family: var(--body-sm-emphasis-font-family);
  --text-body-sm-emphasis-font-size:   var(--body-sm-emphasis-font-size);
  --text-body-sm-emphasis-font-weight: var(--body-sm-emphasis-font-weight);
  --text-body-sm-emphasis-line-height: var(--body-sm-emphasis-line-height);

  --text-body-lg-italic-font-family: var(--body-lg-italic-font-family);
  --text-body-lg-italic-font-size:   var(--body-lg-italic-font-size);
  --text-body-lg-italic-font-weight: var(--body-lg-italic-font-weight);
  --text-body-lg-italic-line-height: var(--body-lg-italic-line-height);
  --text-body-italic-font-family:    var(--body-md-italic-font-family);
  --text-body-italic-font-size:      var(--body-md-italic-font-size);
  --text-body-italic-font-weight:    var(--body-md-italic-font-weight);
  --text-body-italic-line-height:    var(--body-md-italic-line-height);
  --text-body-sm-italic-font-family: var(--body-sm-italic-font-family);
  --text-body-sm-italic-font-size:   var(--body-sm-italic-font-size);
  --text-body-sm-italic-font-weight: var(--body-sm-italic-font-weight);
  --text-body-sm-italic-line-height: var(--body-sm-italic-line-height);
  --text-body-italic-font-style:     italic;

  --text-body-lg-link-font-family: var(--body-lg-link-font-family);
  --text-body-lg-link-font-size:   var(--body-lg-link-font-size);
  --text-body-lg-link-font-weight: var(--body-lg-link-font-weight);
  --text-body-lg-link-line-height: var(--body-lg-link-line-height);
  --text-body-link-font-family:    var(--body-md-link-font-family);
  --text-body-link-font-size:      var(--body-md-link-font-size);
  --text-body-link-font-weight:    var(--body-md-link-font-weight);
  --text-body-link-line-height:    var(--body-md-link-line-height);
  --text-body-sm-link-font-family: var(--body-sm-link-font-family);
  --text-body-sm-link-font-size:   var(--body-sm-link-font-size);
  --text-body-sm-link-font-weight: var(--body-sm-link-font-weight);
  --text-body-sm-link-line-height: var(--body-sm-link-line-height);
  --text-body-link-text-decoration: var(--body-link-text-decoration);
  --text-body-link-color:           var(--body-link-color);

  --text-body-lg-strikethrough-font-family: var(--body-lg-strikethrough-font-family);
  --text-body-lg-strikethrough-font-size:   var(--body-lg-strikethrough-font-size);
  --text-body-lg-strikethrough-font-weight: var(--body-lg-strikethrough-font-weight);
  --text-body-lg-strikethrough-line-height: var(--body-lg-strikethrough-line-height);
  --text-body-strikethrough-font-family:    var(--body-md-strikethrough-font-family);
  --text-body-strikethrough-font-size:      var(--body-md-strikethrough-font-size);
  --text-body-strikethrough-font-weight:    var(--body-md-strikethrough-font-weight);
  --text-body-strikethrough-line-height:    var(--body-md-strikethrough-line-height);
  --text-body-sm-strikethrough-font-family: var(--body-sm-strikethrough-font-family);
  --text-body-sm-strikethrough-font-size:   var(--body-sm-strikethrough-font-size);
  --text-body-sm-strikethrough-font-weight: var(--body-sm-strikethrough-font-weight);
  --text-body-sm-strikethrough-line-height: var(--body-sm-strikethrough-line-height);
  --text-body-strikethrough-text-decoration: var(--body-strikethrough-text-decoration);
  --text-body-strikethrough-color:           var(--body-strikethrough-color);

  --text-label-font-family:  var(--label-lg-font-family);
  --text-label-font-size:    var(--label-lg-font-size);
  --text-label-font-weight:  var(--label-lg-font-weight);
  --text-label-line-height:  var(--label-lg-line-height);
  --text-caption-font-family: var(--label-md-font-family);
  --text-caption-font-size:    var(--label-md-font-size);
  --text-caption-font-weight:  var(--label-md-font-weight);
  --text-caption-line-height:  var(--label-md-line-height);
  --text-small-font-family:   var(--label-sm-font-family);
  --text-small-font-size:     var(--label-sm-font-size);
  --text-small-font-weight:   var(--label-sm-font-weight);
  --text-small-line-height:   var(--label-sm-line-height);
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
  --title-lg-font-size:    {computed}px; --title-lg-line-height:    {computed}px;
  --title-md-font-size:    {computed}px; --title-md-line-height:    {computed}px;
  --title-sm-font-size:    {computed}px; --title-sm-line-height:    {computed}px;
  --body-lg-font-size:     {computed}px; --body-lg-line-height:     {computed}px;
  --body-md-font-size:     {computed}px; --body-md-line-height:     {computed}px;
  --body-sm-font-size:     {computed}px; --body-sm-line-height:     {computed}px;
  --label-lg-font-size:    {computed}px; --label-lg-line-height:    {computed}px;
  --label-md-font-size:    {computed}px; --label-md-line-height:    {computed}px;
  --label-sm-font-size:    {computed}px; --label-sm-line-height:    {computed}px;
}

/* Repeat [data-font-scale] blocks for modes: 110, 120, 130, 150, 175, 200 */
/* Include the same 15 slot × (font-size + line-height) property pairs as scale 85. */
/* Use the same scaling formula from Step 7: linear below 24px or ≤1.3×,
   √(factor) nonlinear above. Round all values to the nearest integer. */
```

**Compute all `{computed}` values before writing the file.** Use the same scaling formula from Step 7. Do not write placeholder `{computed}` text — replace every `{…}` with the actual resolved value.

Semantic **`--text-h1-*`** (and related) aliases reference the role variables (`--headline-lg-*`, etc.), so they automatically track **`[data-font-scale]`** overrides without duplicating computed numbers.

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
| 17 | `Canvas: Step 17 ↳ Token Overview — done` or `… skipped (reason)` |
| 18 | `Canvas: Step 18 Thumbnail Cover — done` or `… skipped (reason)` |

---

## Canvas documentation visual spec

Agents **must read this section** before executing Steps **15a–18** and any `use_figma` script that draws token documentation. **`/sync-design-system`** Steps **9b–9e** must follow the **same** structure, binding, and Dev Mode rules (**§ A–G**; see [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md)).

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

## Step 15a — Draw Style Guide: ↳ Primitives

Run **one** `use_figma` execution against **`↳ Primitives` only**. All tables drawn here MUST follow **§ H** (hierarchy, auto-layout rules, column widths, binding map, build order). The agent does not re-derive geometry — it reads § H and emits frames accordingly.

**Script skeleton**

1. `figma.setCurrentPageAsync` → `↳ Primitives`.
2. Delete every node on the page **other than `_Header`** (the doc header instance stays). The `_Header` occupies `y: 0–320`; the old cream `y > 360` cutoff is obsolete now that `_PageContent` starts at `y: 320`.
3. Ensure the `_Header` instance has `layoutMode: VERTICAL`, `cornerRadius: 0`, `width: 1800` (see § A `_Header component`). If it is an instance, detaching is **not** allowed — edit its main component on the `Documentation components` page once, per § A; here, just assert and `resize(1800, 320)` on the instance if the width differs.
4. Create **`_PageContent`** at `(0, 320)` — **VERTICAL**, `primaryAxisSizingMode: AUTO`, `counterAxisSizingMode: FIXED`, **width 1800**, **padding 80 on all four sides** (`paddingTop/Bottom/Left/Right = 80`), `itemSpacing 48`, `layoutAlign: STRETCH`. **Fill: literal `#FFFFFF` (not token-bound).** Inner content width = **1640** for every table/section child.
5. Resolve Primitives variable IDs once (read from Step 4 REST snapshot or live `figma.variables.getLocalVariablesAsync('COLOR' | 'FLOAT' | 'STRING')`). Cache `{ path → variableId }` keyed by canonical path.
6. For each **table spec row** below, call the shared `buildTable(spec)` helper (see § H.7 checklist) with the slug, group title, caption, column spec from § H.3, and the row list resolved from the cached Primitives variables.

**Tables to draw (in order)**

| Order | `{slug}` | Group title | Caption (`Doc/Caption`) | Rows |
|---|---|---|---|---|
| 1 | `primitives/color/primary` | Primary | Brand anchor — used for the most prominent actions, links, and focus. | 11 stops `color/primary/{50 … 950}` |
| 2 | `primitives/color/secondary` | Secondary | Supporting brand color for secondary actions and decorative surfaces. | 11 stops `color/secondary/*` |
| 3 | `primitives/color/tertiary` | Tertiary | Accent hue for highlights, chips, and illustrative moments. | 11 stops `color/tertiary/*` |
| 4 | `primitives/color/error` | Error | Destructive and error feedback — do not use for incidental UI. | 11 stops `color/error/*` |
| 5 | `primitives/color/neutral` | Neutral | Greyscale foundation for text, borders, and calm surfaces. | 11 stops `color/neutral/*` |
| 6 | `primitives/space` | Space | Spacing scale on a 4px base grid. | All `Space/*` FLOATs |
| 7 | `primitives/radius` | Corner Radius | Corner rounding primitives from square through pill. | All `Corner/*` FLOATs |
| 8 | `primitives/elevation` | Elevation | Raw blur steps consumed by `shadow/*/blur` aliases in Effects. | All `elevation/*` FLOATs |
| 9 | `primitives/typeface` | Typeface | Font family primitives. Display for headings, Body for paragraph text. | 2 rows (`typeface/display`, `typeface/body`) |

**Column definitions per slug** are in **§ H.3**. Cell content patterns are in **§ H.4** (use the *swatch chip + hex* pattern for the 5 color-ramp tables, *preview bar* for Space, *preview square* for Radius, *mono line* for Elevation, *specimen* for Typeface).

**Swatch binding (color ramp tables):** the 48×48 rect in the `SWATCH` cell must bind `boundVariables.color` → `figma.variables.createVariableAlias(primitiveVariable)` for the row's own Primitives variable (§ D / § H.5). The `HEX` column prints the resolved hex.

On completion, log the **Canvas checklist** row for Step 15a, including total table count (**9**) and total row count.

---

## Step 15b — Draw Style Guide: ↳ Theme

Run **one** `use_figma` execution against **`↳ Theme` only`. All tables follow **§ H**.

**Script skeleton**

1. `figma.setCurrentPageAsync` → `↳ Theme`.
2. Delete every node other than `_Header`.
3. Ensure `_Header` has `layoutMode: VERTICAL`, `cornerRadius: 0`, `width: 1800` (§ A). Resize instance to 1800 if needed.
4. Create **`_PageContent`** per Step 15a rules (1800 wide, `x: 0, y: 320`, 80 padding all sides, white fill).
5. Resolve the Theme collection's `light` and `dark` `modeId` once via `figma.variables.getVariableCollectionByIdAsync(themeCollectionId)` → `modes`. Cache.
6. For each semantic group, call `buildTable(spec)` with slug `theme/{group}`, columns per § H.3, rows = the group's Theme variables.

**Tables to draw (in order)**

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `theme/background` | Background | Surfaces, containers, scrims, and overlays. | 16 (`color/background/*`) |
| 2 | `theme/border` | Border | Stroke tokens for dividers and outlines. | 2 (`color/border/*`) |
| 3 | `theme/primary` | Primary | Primary brand roles and their on-color companions. | 8 (`color/primary/*`) |
| 4 | `theme/secondary` | Secondary | Secondary brand roles for supporting actions. | 8 (`color/secondary/*`) |
| 5 | `theme/tertiary` | Tertiary | Tertiary / decorative accent roles. | 8 (`color/tertiary/*`) |
| 6 | `theme/error` | Error | Feedback color for destructive and error states. | 8 (`color/error/*`) |
| 7 | `theme/component` | Component | shadcn-aligned component tokens (ring, input, muted, popover). | 4 (`color/component/*`) |

**Per-row cell content:**

- `TOKEN` cell → `Doc/Code` with the Figma path (e.g. `color/background/default`).
- `LIGHT` cell → follow § H.4 **Theme** swatch pattern exactly: the cell is a HORIZONTAL `AUTO` frame with **two siblings** — [a] inner wrapper **`doc/theme-preview/light`** that calls `setExplicitVariableModeForCollection(themeCollection, lightModeId)` and contains **only** the 28×28 chip (bound to the row's Theme variable, § D), and [b] the `Doc/Code` hex text node placed as a **sibling** of the wrapper, **not a child**. The hex text's fill binds to `color/background/content` and must resolve in the page's normal mode.
- `DARK` cell → same structure, wrapper **`doc/theme-preview/dark`** + Dark `modeId`. **Critical:** never parent the hex text under the Dark-scoped wrapper — inside that wrapper `color/background/content` resolves to white and the text disappears on the white cell. This is the single most common Theme-table bug; § H.4 and this step spell out the fix.
- `ALIAS →` cell → resolved Primitives path for Light and Dark. If both modes alias the same primitive, print one line; if different, print two `Doc/Code` lines `light · {path}` / `dark · {path}`.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code`, pulled from Step 6 `codeSyntax` — never derived.

**Fallback:** when `setExplicitVariableModeForCollection` throws, bind only the LIGHT chip, add a `Doc/Caption` line under the DARK chip with the resolved Dark hex, and log `Theme dual-preview: explicit mode unsupported` once per table.

On completion, log the **Canvas checklist** row for Step 15b.

---

## Step 15c — Draw Style Guide: ↳ Layout, ↳ Text Styles, ↳ Effects

Run **one** `use_figma` execution that visits three pages in order: `↳ Layout` → `↳ Text Styles` → `↳ Effects`. **Before** navigating to any page, publish **Doc / slot / effect styles** (subsection **0** below) so tables on all three pages can assign `textStyleId` and `effectStyleId` without fallbacks.

### 0 — Publish `Doc/*`, slot Text styles, and Effect styles (idempotent)

Use `figma.getLocalTextStylesAsync()` / `figma.getLocalEffectStylesAsync()`; `loadFontAsync` for every `fontName` you set.

1. **`Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption`** — find or `figma.createTextStyle()`. Bind fields to the Documentation type ramp in § **A** (`Headline/LG/*`, `Label/LG/*`, `Label/SM/*`, `Body/SM/*` or `Label/MD/*` at Typography mode **100**) via `setBoundVariable('fontSize', variable)` and parallel fields when the API allows; otherwise set resolved literals from mode **100**.
2. **Slot text styles (15 base + 12 body variants = 27)** — for each slot in order below, find or create `{Slot}`, then bind `{Slot}/font-size`, `{Slot}/font-family`, `{Slot}/font-weight`, `{Slot}/line-height` (Typography · mode **100**) with `setBoundVariable`. Collection variables and Text styles are different objects — every slot needs its own Text style.

   **Important naming rule for Body slots:** the three base body **text styles** are named `Body/LG/regular`, `Body/MD/regular`, `Body/SM/regular` (not `Body/LG`) so they nest inside the size folder alongside the 4 variants in Figma's Text Styles panel. The underlying **variable** paths stay `Body/LG/font-size`, `Body/LG/font-weight`, `Body/LG/font-family`, `Body/LG/line-height` — text-style names and variable names are separate namespaces, so the bindings are unchanged. If an earlier run created `Body/LG`, `Body/MD`, `Body/SM` at the root of the Body folder, rename them to `Body/{size}/regular` during this step.

   **Base slot order (15 — variable group path · text style name):**
   - `Display/LG` · `Display/LG`
   - `Display/MD` · `Display/MD`
   - `Display/SM` · `Display/SM`
   - `Headline/LG` · `Headline/LG`
   - `Headline/MD` · `Headline/MD`
   - `Headline/SM` · `Headline/SM`
   - `Title/LG` · `Title/LG`
   - `Title/MD` · `Title/MD`
   - `Title/SM` · `Title/SM`
   - `Body/LG` · **`Body/LG/regular`**
   - `Body/MD` · **`Body/MD/regular`**
   - `Body/SM` · **`Body/SM/regular`**
   - `Label/LG` · `Label/LG`
   - `Label/MD` · `Label/MD`
   - `Label/SM` · `Label/SM`

   **Body variant slots (12 — per § 7b):** `Body/LG/emphasis`, `Body/LG/italic`, `Body/LG/link`, `Body/LG/strikethrough`, `Body/MD/emphasis`, `Body/MD/italic`, `Body/MD/link`, `Body/MD/strikethrough`, `Body/SM/emphasis`, `Body/SM/italic`, `Body/SM/link`, `Body/SM/strikethrough`. These combined with `Body/{size}/regular` yield five text styles per body size, all nested inside the `Body/{size}/` folder: `regular`, `emphasis`, `italic`, `link`, `strikethrough`.

   For each variant style, after binding the 4 typography variables:
   - `emphasis` — set `fontName = { family, style: 'Medium' }` (loadFontAsync first). If the Medium face isn't available, leave the base `Regular` family+style and rely on the bound `font-weight = 500` variable.
   - `italic` — set `fontName = { family, style: 'Italic' }`. On error (face missing), fall back to `{ family, style: 'Regular' }` and `console.warn('italic face not loaded for ' + family + ' — Body/' + size + '/italic style created without italic glyph; add the Italic font face to the Figma file to resolve')`.
   - `link` — `fontName.style = 'Regular'`, `textDecoration = 'UNDERLINE'`.
   - `strikethrough` — `fontName.style = 'Regular'`, `textDecoration = 'STRIKETHROUGH'`.

   Text styles **do not** carry fill; the `link` / `strikethrough` color lives on the text node (see § 7b coupling rule and the Text Styles page row-rendering rule below).

3. **Effect styles** — for each tier in `sm`, `md`, `lg`, `xl`, `2xl`, create or update `Effect/shadow-{tier}`: `effects` = one `DROP_SHADOW` built from resolved `shadow/color` + resolved `shadow/{tier}/blur` (Effects · Light). Remove any legacy duplicates after migrating references.

### ↳ Layout page

1. `figma.setCurrentPageAsync` → `↳ Layout`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules (1800 wide, `x: 0, y: 320`, 80 padding all sides, white fill).
2. Call `buildTable(spec)` **twice** with § H tables:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `layout/spacing` | Spacing | Semantic spacing aliases mapped to Primitive space steps. | All `space/*` |
| 2 | `layout/radius` | Radius | Semantic radius aliases mapped to Primitive corner steps. | All `radius/*` |

- `VALUE` cell → `Doc/Code` resolved px.
- `ALIAS →` cell → `Doc/Code` primitive path (e.g. `Space/400`).
- `PREVIEW` cell → *preview bar* (spacing) or *preview square* (radius) per § H.4, bound to the row's own Layout variable.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code` from Step 8 `codeSyntax`.

### ↳ Text Styles page

1. `figma.setCurrentPageAsync` → `↳ Text Styles`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules.
2. Call `buildTable(spec)` **once** with `{slug}` = `typography/styles`.
3. Insert **5 category sub-header rows** (§ H.4 *category sub-header row* pattern, full-width 1640 × 40) in this order: **Display**, **Headline**, **Title**, **Body**, **Label**. Each sub-header precedes its specimen rows for that category.
4. Specimen rows (**27 total** — 3 Display + 3 Headline + 3 Title + **15 Body** + 3 Label), in this order within each category:
   - **Display / Headline / Title / Label:** `{Category}/LG`, `{Category}/MD`, `{Category}/SM` (3 rows each).
   - **Body:** each size emits **5 rows in a block** — `Body/{size}/regular`, `Body/{size}/emphasis`, `Body/{size}/italic`, `Body/{size}/link`, `Body/{size}/strikethrough` — then the next size repeats. 3 sizes × 5 variants = 15 Body rows. **Order inside each block is fixed** — regular first so the reader sees the default before the decorated variants below it. The regular row binds to the `Body/{size}/regular` text style (§ 8 step 2).

Common cell content for every specimen row:

| Column | Cell content |
|---|---|
| `SLOT` | `Doc/TokenName` — the published text-style name, e.g. `Headline/LG`, `Body/LG/regular`, `Body/LG/link`. For Body rows always use the 3-segment `Body/{size}/{variant}` form so the label matches the style name shown in the Text Styles panel. |
| `SPECIMEN` | TEXT node with `textStyleId` → the published slot or variant style; `characters` = the slot name prose (`Headline LG`, `Body LG emphasis`, `Body LG link`, …). `resize(420, 1)` then `textAutoResize = 'HEIGHT'`. Row `primaryAxisSizingMode: AUTO` so Display/LG (~96px) expands naturally while Body variants stay compact. **Fill binding (variants only — critical):** for any `/link` row the specimen text node's `fills[0]` **must** be bound to **`color/primary/default`** via `setBoundVariableForPaint` (the brand hue — **not** `color/primary/content`, which is the text-on-primary pairing and is invisible on neutral backgrounds); for `/strikethrough` rows bind to **`color/background/content-muted`**. For base / `/emphasis` / `/italic` rows leave fill as the default `color/background/content`. Without this binding the styles publish correctly but the preview lies about the intended presentation. |
| `SIZE / LINE` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontSize}px` / `{lineHeight}px` at mode **100**. Variants resolve through their base-body alias, so values match the base row in the block. |
| `WEIGHT / FAMILY` | VERTICAL stack — two `Doc/Code` lines: resolved `{fontWeight}` / `{fontFamily}`. `/emphasis` rows resolve to `500` (via `font/weight/medium`); other variants share the base weight. |
| `WEB` | `Doc/Code` — from Step 7 / 7b `codeSyntax`. Variants show the 4-segment `var(--body-{size}-{variant}-font-size)`. |
| `ANDROID` | `Doc/Code` — matching kebab for the slot (e.g. `body-lg-link-font-size`). |
| `iOS` | `Doc/Code` — 5-segment dot path for variants (e.g. `.Typography.body.lg.link.font.size`). |

Caption under the table title: `Doc/Caption` — "Specimen renders at mode 100 — full 8-mode scale (85 → 200) ships via the Typography collection. Body variants extend each size with emphasis / italic / link / strikethrough per §7b." This tells the reader the table shows base values only, while Dev Mode surfaces all 8 modes.

### ↳ Effects page

1. `figma.setCurrentPageAsync` → `↳ Effects`. Delete every node **other than `_Header`** (or whose `y >= 320`). Build `_PageContent` per § A rules.
2. Resolve Effects collection `light` / `dark` `modeId` as in Step 15b.
3. Call `buildTable(spec)` twice:

| Order | `{slug}` | Group title | Caption | Rows |
|---|---|---|---|---|
| 1 | `effects/shadows` | Shadows | Drop shadow tiers — each alias points to an Elevation primitive. | 5 (`sm`, `md`, `lg`, `xl`, `2xl`) |
| 2 | `effects/color` | Shadow Color | Shared shadow color referenced by every tier. | 1 (`shadow/color`) |

- `effects/shadows` `LIGHT` / `DARK` cells → 88×88 `cornerRadius 12` card inside `doc/effect-preview/{mode}/{tier}` wrapper with explicit Effects mode set; card fill `color/background/default` + `effectStyleId = Effect/shadow-{tier}` + a small inner `Doc/Code` label showing the tier name.
- `effects/shadows` `BLUR` / `ALIAS →` → `Doc/Code` (blur value in px; alias path `elevation/{step}`).
- `effects/color` `LIGHT` / `DARK` cells → *swatch chip + hex* pattern, 32×32 chip bound to `shadow/color` in the wrapper's mode.
- `WEB` / `ANDROID` / `iOS` cells → `Doc/Code` from Step 9 `codeSyntax`.

Log the **Canvas checklist** row for Step 15c.

---

*If any instruction in an earlier section of this file conflicts with § H or with the step rewrites above, § H and the rewrites win (stable table hierarchy, Light doc mode, Dev Mode bindings, auto-layout hug rules).*

---

## Step 17 — Populate Token Overview

Follow **Canvas documentation visual spec § A–G** for any new or updated frames/text on this page.

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

`color/background/default`, `color/background/content`, `color/background/content-muted`, `color/background/variant`, `color/border/default`, `color/border/subtle`, `color/primary/default`, `color/primary/content`, `color/primary/subtle`, `color/secondary/default`, `color/tertiary/default`, `color/error/default`, `color/component/ring`, `Headline/LG/font-size`, `Title/LG/font-size`, `Body/MD/font-size`, `typeface/display`, `space/md`, `space/lg`, `radius/md`, `radius/lg`, `shadow/color`

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
