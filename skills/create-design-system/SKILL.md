---
name: create-design-system
description: Push brand tokens into five Figma variable collections — Primitives, Theme (Light/Dark modes), Typography (8 Android-curve scale modes), Layout, and Effects. Platform mapping (Web/Android/iOS) is encoded as codeSyntax on every variable instead of separate alias collections.
argument-hint: ""
agent: general-purpose
---

# Skill — `/create-design-system`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, build five variable collections with proper Light/Dark and typography scale modes, and push the result to the target Figma file.

---

## Interactive input contract

- For **Steps 1–4**, **Step 10** when the API returns partial write errors, and **Step 13**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
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

1. Call **AskUserQuestion** asking them to paste tokens in any readable format (JSON, CSS variables, Figma token JSON, or a plain list).
2. Parse what you can. For **each** required value still missing after parsing, call **AskUserQuestion** for that single field only (one tool call per missing field):
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

**If no:** Go to Step 3.

---

## Step 3 — Interactive setup wizard (when no tokens supplied)

Collect each value with **AskUserQuestion**, one call at a time, in this order. Use the stated default only when the designer explicitly asks for the default or leaves the answer empty.

1. **AskUserQuestion**: "What is your primary brand color? (hex, e.g. `#3B82F6`)" — required, no default.
2. **AskUserQuestion**: "What is your secondary or accent color? (hex)" — required, no default.
3. **AskUserQuestion**: "What is your neutral or gray base color? (hex, e.g. `#6B7280`)" — required, no default.
4. **AskUserQuestion**: "What is your tertiary or third accent color? (hex, optional — press enter to use secondary color)"
5. **AskUserQuestion**: "What is your error or danger color? (hex, optional — default `#EF4444`)"
6. **AskUserQuestion**: "What font family for body text? (e.g. `Inter`, `Roboto`; default `Inter` if unspecified)"
7. **AskUserQuestion**: "What font family for display and headings? (default: same as body if unspecified)"
8. **AskUserQuestion**: "Base font size in px? (default: 16)"
9. **AskUserQuestion**: "Base spacing unit in px? (default: 4)"
10. **AskUserQuestion**: "Base border radius in px? (default: 4)"

Then call **AskUserQuestion** to confirm:

> "Collected: Primary `{…}` · Secondary `{…}` · Neutral `{…}` · Tertiary `{…}` · Error `{…}` · Body `{…}` · Display `{…}` · Font size `{…}px` · Spacing `{…}px` · Radius `{…}px`. Proceed with **yes**, or reply **edit** and name which fields to change."

If the designer replies **edit**, call **AskUserQuestion** once per field they name to change, then AskUserQuestion for confirmation again until they answer **yes**.

---

## Step 4 — Read current Figma variable state

Before writing anything, call the Figma Variables REST API to read the full variable registry of the target file:

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Execute via `mcp__claude_ai_Figma__use_figma` or the REST endpoint directly.

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

For tertiary: if the designer skipped the tertiary input, alias each `color/tertiary/{stop}` to the corresponding `color/secondary/{stop}` value.
For error: use the provided hex or `#EF4444` as the `500` anchor.

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
| `color/primary/500` | `var(--color-primary-500)` | `colorPrimary500` | `colorPrimary500` |
| `Space/400` | `var(--space-400)` | `space400` | `space400` |
| `Corner/Medium` | `var(--corner-medium)` | `cornerMedium` | `cornerMedium` |
| `elevation/400` | `var(--elevation-400)` | `elevation400` | `elevation400` |

**Derivation rule:** strip the collection name, join all path segments with `-`, lowercase → WEB `var(--result)`. CamelCase (capitalize each word after the first, join) → ANDROID and iOS.

---

## Step 6 — Generate the Theme collection (Light / Dark modes)

Create (or update) the `Theme` collection with **two modes: `Light` and `Dark`**.

Every Theme variable is a COLOR type that aliases a Primitive variable by ID. Use the table below — `Light →` and `Dark →` columns name the Primitive path to alias.

### Backgrounds & Foregrounds (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/background` | `color/neutral/50` | `color/neutral/950` |
| `color/background-inverse` | `color/neutral/950` | `color/neutral/50` |
| `color/foreground` | `color/neutral/900` | `color/neutral/100` |
| `color/foreground-inverse` | `color/neutral/50` | `color/neutral/900` |

### Primary (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/primary` | `color/primary/500` | `color/primary/400` |
| `color/primary-foreground` | `color/primary/50` | `color/primary/50` |
| `color/primary-container` | `color/primary/100` | `color/primary/800` |
| `color/on-primary-container` | `color/primary/900` | `color/primary/100` |

### Secondary (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/secondary` | `color/secondary/500` | `color/secondary/400` |
| `color/secondary-foreground` | `color/secondary/50` | `color/secondary/50` |
| `color/secondary-container` | `color/secondary/100` | `color/secondary/800` |
| `color/on-secondary-container` | `color/secondary/900` | `color/secondary/100` |

### Tertiary / Accent (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/tertiary` | `color/tertiary/500` | `color/tertiary/400` |
| `color/on-tertiary` | `color/tertiary/50` | `color/tertiary/50` |
| `color/tertiary-container` | `color/tertiary/100` | `color/tertiary/800` |
| `color/on-tertiary-container` | `color/tertiary/900` | `color/tertiary/100` |

### Error / Destructive (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/error` | `color/error/600` | `color/error/400` |
| `color/on-error` | `color/error/50` | `color/error/50` |
| `color/error-container` | `color/error/100` | `color/error/900` |
| `color/on-error-container` | `color/error/900` | `color/error/100` |

### Muted & Accent (4 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/muted` | `color/neutral/100` | `color/neutral/800` |
| `color/muted-foreground` | `color/neutral/500` | `color/neutral/400` |
| `color/accent` | `color/tertiary/100` | `color/tertiary/800` |
| `color/accent-foreground` | `color/tertiary/900` | `color/tertiary/100` |

### Surface Hierarchy (9 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/surface` | `color/neutral/50` | `color/neutral/900` |
| `color/on-surface` | `color/neutral/900` | `color/neutral/50` |
| `color/surface-variant` | `color/neutral/100` | `color/neutral/800` |
| `color/on-surface-variant` | `color/neutral/700` | `color/neutral/300` |
| `color/surface-container-lowest` | `color/neutral/50` | `color/neutral/900` |
| `color/surface-container-low` | `color/neutral/100` | `color/neutral/800` |
| `color/surface-container` | `color/neutral/200` | `color/neutral/800` |
| `color/surface-container-high` | `color/neutral/200` | `color/neutral/700` |
| `color/surface-container-highest` | `color/neutral/300` | `color/neutral/700` |

### Outline / Border (2 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/outline` | `color/neutral/300` | `color/neutral/600` |
| `color/outline-variant` | `color/neutral/200` | `color/neutral/700` |

### UI Component Tokens — Tailwind/shadcn (8 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/card` | `color/neutral/50` | `color/neutral/900` |
| `color/card-foreground` | `color/neutral/900` | `color/neutral/50` |
| `color/popover` | `color/neutral/50` | `color/neutral/900` |
| `color/popover-foreground` | `color/neutral/900` | `color/neutral/50` |
| `color/input` | `color/neutral/200` | `color/neutral/700` |
| `color/ring` | `color/primary/500` | `color/primary/400` |
| `color/sidebar` | `color/neutral/100` | `color/neutral/900` |
| `color/sidebar-foreground` | `color/neutral/900` | `color/neutral/100` |

### Inverse / Dark Surfaces (3 variables)

| Variable | Light → | Dark → |
|---|---|---|
| `color/inverse-surface` | `color/neutral/900` | `color/neutral/100` |
| `color/inverse-on-surface` | `color/neutral/100` | `color/neutral/900` |
| `color/inverse-primary` | `color/primary/300` | `color/primary/700` |

### Overlay (1 variable)

| Variable | Light | Dark |
|---|---|---|
| `color/scrim` | `color/neutral/950` at 32% opacity | `color/neutral/950` at 32% opacity |

Write `color/scrim` as a hard-coded COLOR value (not an alias) with `#000000` at 32% alpha in both modes. Figma variable aliases cannot carry opacity; use the resolved RGBA.

### codeSyntax for Theme

Strip the `color/` prefix, convert remaining path to kebab, wrap in `var(--)` for WEB; camelCase for ANDROID and iOS. The `color/` prefix is dropped from all three outputs.

| Variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `color/background` | `var(--background)` | `background` | `background` |
| `color/primary-container` | `var(--primary-container)` | `primaryContainer` | `primaryContainer` |
| `color/on-surface-variant` | `var(--on-surface-variant)` | `onSurfaceVariant` | `onSurfaceVariant` |
| `color/surface-container-high` | `var(--surface-container-high)` | `surfaceContainerHigh` | `surfaceContainerHigh` |
| `color/error-container` | `var(--error-container)` | `errorContainer` | `errorContainer` |

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

Strip `/`, lowercase, kebab the slot+property: `Display/LG/font-size` → `display-lg-font-size`
- WEB: `var(--display-lg-font-size)`, ANDROID: `displayLgFontSize`, iOS: `displayLgFontSize`

Full derivation: split name on `/`, `-`, and spaces → lowercase each word → join with `-` for WEB `var(--result)` → CamelCase (capitalize each word after the first, join) for ANDROID and iOS.

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

| Variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `space/xs` | `var(--space-xs)` | `spaceXs` | `spaceXs` |
| `space/2xl` | `var(--space-2xl)` | `space2xl` | `space2xl` |
| `radius/md` | `var(--radius-md)` | `radiusMd` | `radiusMd` |
| `radius/full` | `var(--radius-full)` | `radiusFull` | `radiusFull` |

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

| Variable | WEB | ANDROID | iOS |
|---|---|---|---|
| `shadow/color` | `var(--shadow-color)` | `shadowColor` | `shadowColor` |
| `shadow/sm/blur` | `var(--shadow-sm-blur)` | `shadowSmBlur` | `shadowSmBlur` |
| `shadow/2xl/blur` | `var(--shadow-2xl-blur)` | `shadow2xlBlur` | `shadow2xlBlur` |

---

## Step 10 — Push all collections to Figma

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

Each entry: `{ "id": "TEMP_VAR_{NAME}", "name": "...", "variableCollectionId": "...", "resolvedType": "COLOR|FLOAT|STRING", "action": "CREATE", "codeSyntax": { "WEB": "...", "ANDROID": "...", "iOS": "..." } }`

### variableModeValues array

Each entry: `{ "variableId": "TEMP_VAR_{NAME}", "modeId": "TEMP_MODE_{...}", "value": <value> }`

For alias values: `"value": { "type": "VARIABLE_ALIAS", "id": "<primitive-variable-id>" }`
For hard-coded COLOR: `"value": { "r": 0, "g": 0, "b": 0, "a": 0.32 }` (Figma COLOR uses 0–1 float channels)
For hard-coded FLOAT: `"value": 57`

**Execution:** call `mcp__claude_ai_Figma__use_figma` or the REST endpoint directly.

### Error — partial write failure

If the API returns `200` with an `errors` array, retry each failed variable individually in a second `PUT`. If retry fails, call **AskUserQuestion**: "These variables failed after retry: {names}. Reply **skip** to continue without them, or **abort** to stop the skill."

---

## Step 11 — Verify the write

After the PUT completes, call the GET endpoint again:

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Confirm:
- All five collections exist: `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`
- `Theme` has exactly 2 modes: `Light` and `Dark`
- `Typography` has exactly 8 modes: `85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`
- `Primitives` contains the expected 5 color ramps (primary, secondary, tertiary, error, neutral)
- No `Web`, `Android/M3`, or `iOS/HIG` collections were created

Report any expected variables absent from the verified response.

---

## Step 12 — Confirm success

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

Open in Figma: https://figma.com/design/{TARGET_FILE_KEY}
```

---

## Step 13 — Offer next step

Call **AskUserQuestion**:

> "Run `/create-component` now to build UI components with these tokens? (yes / no)"

If **yes**, invoke `/create-component` with the same Figma file context. If **no**, close the skill.

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
color/background        Light → color/neutral/50    Dark → color/neutral/950
color/primary           Light → color/primary/500   Dark → color/primary/400
color/on-surface        Light → color/neutral/900   Dark → color/neutral/50
color/surface-container Light → color/neutral/200   Dark → color/neutral/800
color/error             Light → color/error/600     Dark → color/error/400
color/outline           Light → color/neutral/300   Dark → color/neutral/600
color/ring              Light → color/primary/500   Dark → color/primary/400
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

1. Take the full variable name: e.g. `color/on-surface-variant` or `Display/LG/font-size`
2. Split on `/`, `-`, and spaces into word tokens: `["color","on","surface","variant"]` or `["Display","LG","font","size"]`
3. **WEB:** lowercase all tokens, join with `-`, wrap: `var(--color-on-surface-variant)` / `var(--display-lg-font-size)`
   - Exception for Theme: drop the leading `color` word, so `color/background` → `var(--background)` not `var(--color-background)`
4. **ANDROID / iOS:** lowercase all tokens, capitalize each word after the first, join (camelCase): `colorOnSurfaceVariant` / `displayLgFontSize`
   - Exception for Theme: drop the leading `color` word, so `color/background` → `background`, `color/primary-container` → `primaryContainer`

### Theme exception summary

For all Theme variables the `color/` prefix is invisible in codeSyntax outputs:
- `color/background` → WEB `var(--background)`, ANDROID `background`, iOS `background`
- `color/on-surface-variant` → WEB `var(--on-surface-variant)`, ANDROID `onSurfaceVariant`, iOS `onSurfaceVariant`

For Primitives, the `color/` prefix is retained:
- `color/primary/500` → WEB `var(--color-primary-500)`, ANDROID `colorPrimary500`, iOS `colorPrimary500`

---

## Color Ramp Generation

When the designer provides a single hex color as the brand anchor, generate the full 11-stop ramp (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) using the Tailwind lightness interpolation approach:

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
