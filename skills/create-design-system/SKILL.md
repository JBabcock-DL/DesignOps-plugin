---
name: create-design-system
description: Push brand tokens into the Primitives variable collection and the target platform alias collection (Web, Android/M3, or iOS/HIG) in a Figma file. Accepts web, android, ios, or all (web then android then ios on the same file).
argument-hint: "[web|android|ios|all]"
agent: general-purpose
---

# Skill — `/create-design-system [web|android|ios|all]`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, map them to the correct Figma variable collections, and push the result to the target Figma file.

---

## Interactive input contract

- For **Steps 1-4**, **Step 8** when the API returns partial write errors, and **Step 11**, collect designer input **only** using **AskUserQuestion**. Use **one AskUserQuestion call per question** and wait for each answer before the next call.
- **Do not** print a block of multiple questions as plain markdown before the first AskUserQuestion.
- After any AskUserQuestion, you may show a brief acknowledgment in prose; do not bundle the next question in that same message — call AskUserQuestion again.

---

## Multi-platform (`all`)

If the resolved platform is **`all`** (from `$ARGUMENTS` or AskUserQuestion):

1. Complete **Steps 2-4 once** (file key and tokens). Do not re-prompt Steps 2-4 between passes.
2. Set `PLATFORM_QUEUE = [web, android, ios]`. Before Step 5, set **`EFFECTIVE_PLATFORM`** to the first queue entry. After each full Step 10 for that entry, shift the queue: set `EFFECTIVE_PLATFORM` to the next platform until the queue is exhausted.
3. Run **Steps 5-10** once per `EFFECTIVE_PLATFORM` value. Each pass uses the same `TARGET_FILE_KEY` and the same token values. Throughout Steps 5-10, use **`EFFECTIVE_PLATFORM`** anywhere this skill refers to the platform from Step 1 (especially Step 7).
4. On the **second and third** passes, Step 5 re-reads the registry; Step 6 should **update** existing Primitives in place (idempotent) rather than failing on duplicate names. Step 7 always targets the alias collection for the **current** `EFFECTIVE_PLATFORM` (`Web`, `Android/M3`, or `iOS/HIG`).
5. **Step 10** reports after **each** pass which collections were updated, then a **final** short summary listing all three platforms when the queue finishes.
6. Run **Step 11 once** after the queue is exhausted (do not offer `/create-component` between web/android/ios passes).

If the resolved platform is **not** `all`, set **`EFFECTIVE_PLATFORM`** to that single platform and run Steps 5-10 once, then Step 11 once.

---

## Step 1 — Resolve the platform argument

Parse `$ARGUMENTS` (first token, case-insensitive) for a platform: `web`, `android`, `ios`, or `all`.

If a valid value is present, use it and proceed to Step 2.

If `$ARGUMENTS` is empty or unrecognized, call **AskUserQuestion**:

> "Which platform are you targeting?
> - **web** — Web / Tailwind-style `var(--*)` aliases
> - **android** — Android / Material 3 (`md/sys/*`)
> - **ios** — iOS / HIG (`ios/*`)
> - **all** — Run web, then android, then ios on the same file (shared Primitives, three alias collections)"

Do not proceed until a valid platform is confirmed.

---

## Step 2 — Resolve the Figma file key

1. Check `plugin/templates/agent-handoff.md` for `active_file_key`.

2. **If `active_file_key` is set**, call **AskUserQuestion**:

   > "I'll use the Foundations file from the last `/new-project` run: `<active_file_key>`. Use this file? Reply **yes** or paste a different Figma file key."

   - If the reply is **yes** (or equivalent), set `TARGET_FILE_KEY` to `active_file_key`.
   - If the reply is a different key string, validate it (alphanumerics and hyphens only). If valid, set `TARGET_FILE_KEY`. If invalid, call **AskUserQuestion** again with the same prompt shape until you have a valid key.

3. **If `active_file_key` is missing**, call **AskUserQuestion**:

   > "What is the Figma file key for your design system file? (The segment after `figma.com/design/` in the file URL, before the next `/`.)"

   Validate the reply. If malformed, call **AskUserQuestion** again (same question) until `TARGET_FILE_KEY` is valid.

Do not proceed without `TARGET_FILE_KEY`.

**If the designer cannot find the file key:** In the AskUserQuestion prompt text, remind them to open the file in a browser and copy only the segment between `/design/` and the next `/`.

---

## Step 3 — Check for existing brand tokens

Call **AskUserQuestion**:

> "Do you have brand tokens ready to paste? (colors, fonts, spacing) Reply **yes** to paste them next, or **no** to run the guided wizard one question at a time."

**If yes:**

1. Call **AskUserQuestion** asking them to paste tokens in any readable format (JSON, CSS variables, Figma token JSON, or a plain list).
2. Parse what you can. For **each** required value still missing after parsing, call **AskUserQuestion** for that single field only (one tool call per missing field):
   - Primary brand color (hex)
   - Secondary/accent color (hex)
   - Neutral/gray base color (hex)
   - Body font family name
   - Display/heading font family name
   - Base font size in px
   - Base spacing unit in px
   - Border radius base in px

**If no:** Go to Step 4 and use AskUserQuestion for each wizard field (do not paste Step 4’s full question list into chat at once).

---

## Step 4 — Interactive setup wizard (when no tokens supplied)

When Step 3 was **no**, collect each value with **AskUserQuestion**, one call at a time, in this order. Use the stated default only when the designer explicitly asks for the default or leaves the answer empty (treat empty as default where noted).

1. Call **AskUserQuestion**: "What is your primary brand color? (hex, e.g. `#3B82F6`)" — required, no default.
2. Call **AskUserQuestion**: "What is your secondary or accent color? (hex)" — required, no default.
3. Call **AskUserQuestion**: "What is your neutral or gray base color? (hex, e.g. `#6B7280`)" — required, no default.
4. Call **AskUserQuestion**: "What font family for body text? (e.g. `Inter`, `Roboto`; default `Inter` if unspecified)"
5. Call **AskUserQuestion**: "What font family for display and headings? (default: same as body if unspecified)"
6. Call **AskUserQuestion**: "Base font size in px? (default: 16)"
7. Call **AskUserQuestion**: "Base spacing unit in px? (default: 4)"
8. Call **AskUserQuestion**: "Base border radius in px? (default: 4)"

Then call **AskUserQuestion** to confirm the full summary:

> "Collected: Primary `{…}` · Secondary `{…}` · Neutral `{…}` · Body `{…}` · Display `{…}` · Font size `{…}px` · Spacing `{…}px` · Radius `{…}px`. Proceed with **yes**, or reply **edit** and name which fields to change."

If the designer replies **edit**, call **AskUserQuestion** once per field they name to change, then AskUserQuestion for confirmation again until they answer **yes**.

---

## Step 5 — Read current Figma variable state

Before writing anything for the current `EFFECTIVE_PLATFORM` pass, call the Figma Variables REST API to read the full variable registry of the target file. This is required to know which collections and variable IDs already exist.

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Execute this via the Figma MCP connector using `mcp__claude_ai_Figma__use_figma` or an equivalent REST call.

Parse the response and identify:
- Existing collection names and their IDs
- Existing variable names and their IDs within each collection
- Any collections that match `Primitives`, `Web`, `Android/M3`, or `iOS/HIG`

Also call `mcp__claude_ai_Figma__get_variable_defs` on the file's Table of Contents node (or main page) to cross-check slot names visible on canvas against the REST registry.

**Error — permission denied (403):**
> "The Figma MCP connector does not have write access to this file. Check that:
> 1. You are authenticated in Claude Code's Figma MCP connector.
> 2. Your Figma account has edit access to the file.
> 3. Your Figma organization is on an Organization or Enterprise tier (required for Variables REST API write).
> Re-authenticate the Figma MCP connector in Claude Code settings, then run this skill again."

Abort if a 403 is returned.

**Error — file not found (404):**
> "The file key `{TARGET_FILE_KEY}` was not found. Double-check the key from the Figma URL and run the skill again."

Abort on 404.

---

## Step 6 — Generate the Primitives collection variables

Using the collected brand tokens, generate the full set of Primitive variables. Write these into the `Primitives` collection (create it if it does not exist in the registry from Step 5).

### Color ramp generation

For each brand color (primary, secondary, neutral), generate a 10-stop ramp using the Tailwind lightness interpolation approach described in the "Tailwind Color Ramp Generation" section at the bottom of this file. Produce stops: `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`.

Use the following variable name pattern: `color/{name}/{stop}`

Examples:
- `color/primary/50`, `color/primary/100`, … `color/primary/950`
- `color/secondary/50`, … `color/secondary/950`
- `color/neutral/50`, … `color/neutral/950`

### Spacing scale

Using the base spacing unit (default 4px), generate the Tailwind 4px-base spacing scale. Use `Space/{scale}` naming where the scale number equals the value in multiples of 4 (matching the Agent Kit convention observed in the variable slot catalog):

| Variable Name | Value |
|---|---|
| `Space/100` | base × 1 (e.g. 4px) |
| `Space/200` | base × 2 (e.g. 8px) |
| `Space/300` | base × 3 (e.g. 12px) |
| `Space/400` | base × 4 (e.g. 16px) |
| `Space/500` | base × 5 (e.g. 20px) |
| `Space/600` | base × 6 (e.g. 24px) |
| `Space/700` | base × 7 (e.g. 28px) |
| `Space/800` | base × 8 (e.g. 32px) |
| `Space/900` | base × 9 (e.g. 36px) |
| `Space/1000` | base × 10 (e.g. 40px) |
| `Space/1100` | base × 11 (e.g. 44px) |
| `Space/1200` | base × 12 (e.g. 48px) |
| `Space/1600` | base × 16 (e.g. 64px) |
| `Space/2000` | base × 20 (e.g. 80px) |
| `Space/2400` | base × 24 (e.g. 96px) |

### Border radius scale

Use `Corner/{size}` naming:

| Variable Name | Value |
|---|---|
| `Corner/None` | 0 |
| `Corner/Extra-small` | base × 1 (e.g. 4px) |
| `Corner/Small` | base × 2 (e.g. 8px) |
| `Corner/Medium` | base × 3 (e.g. 12px) |
| `Corner/Large` | base × 4 (e.g. 16px) |
| `Corner/Extra-large` | 28px |
| `Corner/Full` | 9999px |

### Typography scale

Use the collected font families and the base font size to populate the Typography collection slots. Use the `{Style}/{Size}/{Property}` naming convention observed in the Agent Kit:

| Variable Name | Type | Value |
|---|---|---|
| `Title/LG/Font Family` | STRING | display font |
| `Title/LG/Font Size` | FLOAT | base × 1.375 (e.g. 22px at 16 base) |
| `Title/LG/Font Weight` | FLOAT | 600 |
| `Title/LG/Line Height` | FLOAT | base × 1.75 (e.g. 28px) |
| `Label/LG/Font Family` | STRING | body font |
| `Label/LG/Font Size` | FLOAT | base × 0.875 (e.g. 14px) |
| `Label/LG/Font Weight` | FLOAT | 500 |
| `Label/LG/Line Height` | FLOAT | base × 1.25 (e.g. 20px) |
| `Headline/MD/Font Family` | STRING | display font |
| `Headline/MD/Font Size` | FLOAT | base × 1.875 (e.g. 30px) |
| `Headline/MD/Font Weight` | FLOAT | 600 |
| `Headline/MD/Line Height` | FLOAT | base × 2.25 (e.g. 36px) |

### Shadow / Elevation

| Variable Name | Type | Value |
|---|---|---|
| `var(--shadow-default)` | COLOR | `#000000` |
| `elevation/100` | FLOAT | 1 |
| `elevation/200` | FLOAT | 2 |
| `elevation/400` | FLOAT | 4 |
| `elevation/800` | FLOAT | 8 |
| `elevation/1600` | FLOAT | 16 |

Note: If the target file contains the malformed token `var--{shadow-default)`, write the corrected name `var(--shadow-default)` and update any effect references that previously pointed to the malformed name.

---

## Step 7 — Create or update the platform alias collection

Based on **`EFFECTIVE_PLATFORM`** (see Multi-platform section), write the corresponding alias collection. Each alias variable must reference its Primitives counterpart by variable ID (Figma alias), not by hard-coded hex value.

If the collection does not exist in the registry from Step 5, create it first using `PUT /v1/files/{TARGET_FILE_KEY}/variables` with a `variableCollections` create payload before writing the aliases.

### Platform: `web` — Web Collection (`var(--*)` pattern)

Write or update the `Web` collection. Map semantic roles to Primitives using variable aliases:

| Variable Name | Aliases → Primitive |
|---|---|
| `var(--background)` | `color/neutral/50` |
| `var(--background-inverse)` | `color/neutral/950` |
| `var(--foreground)` | `color/neutral/900` |
| `var(--foreground-inverse)` | `color/neutral/50` |
| `var(--on-background-primary)` | `color/primary/50` |
| `var(--on-button-secondary)` | `color/secondary/950` |
| `var(--primary)` | `color/primary/500` |
| `var(--primary-foreground)` | `color/primary/50` |
| `var(--secondary)` | `color/secondary/500` |
| `var(--secondary-foreground)` | `color/secondary/50` |
| `var(--muted)` | `color/neutral/100` |
| `var(--muted-foreground)` | `color/neutral/500` |
| `var(--border-primary)` | `color/primary/500` |
| `var(--border-secondary)` | `color/neutral/200` |
| `var(--gap-xs)` | `Space/100` |
| `var(--gap-sm)` | `Space/200` |
| `var(--gap-md)` | `Space/300` |
| `var(--gap-lg)` | `Space/400` |
| `var(--p-xs)` | `Space/100` |
| `var(--padding-md)` | `Space/300` |
| `var(--radius-none)` | `Corner/None` |
| `var(--radius-sm)` | `Corner/Extra-small` |
| `var(--radius-md)` | `Corner/Medium` |
| `var(--radius-lg)` | `Corner/Large` |
| `var(--shadow-default)` | `var(--shadow-default)` (Primitives) |

### Platform: `android` — Android/M3 Collection

Create the `Android/M3` collection if it does not exist. Write Material Design 3 `md/sys/*` role aliases pointing to Primitives:

| Variable Name | Aliases → Primitive |
|---|---|
| `md/sys/color/primary` | `color/primary/500` |
| `md/sys/color/on-primary` | `color/primary/50` |
| `md/sys/color/primary-container` | `color/primary/100` |
| `md/sys/color/on-primary-container` | `color/primary/900` |
| `md/sys/color/secondary` | `color/secondary/500` |
| `md/sys/color/on-secondary` | `color/secondary/50` |
| `md/sys/color/secondary-container` | `color/secondary/100` |
| `md/sys/color/on-secondary-container` | `color/secondary/900` |
| `md/sys/color/background` | `color/neutral/50` |
| `md/sys/color/on-background` | `color/primary/50` |
| `md/sys/color/surface` | `color/neutral/100` |
| `md/sys/color/on-surface` | `color/neutral/900` |
| `md/sys/color/surface-variant` | `color/neutral/200` |
| `md/sys/color/on-surface-variant` | `color/neutral/700` |
| `md/sys/color/outline` | `color/primary/500` |
| `md/sys/color/outline-variant` | `color/neutral/200` |
| `md/sys/color/error` | `color/primary/700` |
| `md/sys/color/on-error` | `color/primary/50` |
| `md/sys/spacing/extra-small` | `Space/100` |
| `md/sys/spacing/small` | `Space/200` |
| `md/sys/spacing/medium` | `Space/300` |
| `md/sys/spacing/large` | `Space/400` |
| `md/sys/spacing/extra-large` | `Space/600` |
| `md/sys/shape/corner/extra-small` | `Corner/Extra-small` |
| `md/sys/shape/corner/small` | `Corner/Small` |
| `md/sys/shape/corner/medium` | `Corner/Medium` |
| `md/sys/shape/corner/large` | `Corner/Large` |
| `md/sys/shape/corner/extra-large` | `Corner/Extra-large` |
| `md/sys/shape/corner/full` | `Corner/Full` |
| `md/sys/typescale/title-large/font-family` | `Title/LG/Font Family` |
| `md/sys/typescale/title-large/font-size` | `Title/LG/Font Size` |
| `md/sys/typescale/title-large/font-weight` | `Title/LG/Font Weight` |
| `md/sys/typescale/title-large/line-height` | `Title/LG/Line Height` |
| `md/sys/typescale/label-large/font-family` | `Label/LG/Font Family` |
| `md/sys/typescale/label-large/font-size` | `Label/LG/Font Size` |
| `md/sys/typescale/label-large/font-weight` | `Label/LG/Font Weight` |
| `md/sys/typescale/label-large/line-height` | `Label/LG/Line Height` |
| `md/sys/typescale/headline-medium/font-family` | `Headline/MD/Font Family` |
| `md/sys/typescale/headline-medium/font-size` | `Headline/MD/Font Size` |
| `md/sys/typescale/headline-medium/font-weight` | `Headline/MD/Font Weight` |
| `md/sys/typescale/headline-medium/line-height` | `Headline/MD/Line Height` |

### Platform: `ios` — iOS/HIG Collection

Create the `iOS/HIG` collection if it does not exist. Write Apple HIG semantic aliases pointing to Primitives:

| Variable Name | Aliases → Primitive |
|---|---|
| `ios/color/system-background` | `color/neutral/50` |
| `ios/color/secondary-system-background` | `color/neutral/100` |
| `ios/color/tertiary-system-background` | `color/neutral/200` |
| `ios/color/label` | `color/neutral/950` |
| `ios/color/secondary-label` | `color/primary/50` |
| `ios/color/tertiary-label` | `color/neutral/500` |
| `ios/color/tint` | `color/primary/500` |
| `ios/color/separator` | `color/neutral/200` |
| `ios/color/opaque-separator` | `color/neutral/300` |
| `ios/color/system-fill` | `color/neutral/100` |
| `ios/color/secondary-system-fill` | `color/neutral/200` |
| `ios/color/system-red` | `color/primary/600` |
| `ios/spacing/extra-small` | `Space/100` |
| `ios/spacing/small` | `Space/200` |
| `ios/spacing/medium` | `Space/300` |
| `ios/spacing/large` | `Space/400` |
| `ios/spacing/extra-large` | `Space/600` |
| `ios/shape/corner-small` | `Corner/Small` |
| `ios/shape/corner-medium` | `Corner/Medium` |
| `ios/shape/corner-large` | `Corner/Large` |
| `ios/shape/corner-full` | `Corner/Full` |
| `ios/typescale/large-title/font-family` | `Headline/MD/Font Family` |
| `ios/typescale/large-title/font-size` | `Headline/MD/Font Size` |
| `ios/typescale/large-title/line-height` | `Headline/MD/Line Height` |
| `ios/typescale/title1/font-family` | `Title/LG/Font Family` |
| `ios/typescale/title1/font-size` | `Title/LG/Font Size` |
| `ios/typescale/title1/line-height` | `Title/LG/Line Height` |
| `ios/typescale/title2/font-family` | `Title/LG/Font Family` |
| `ios/typescale/title2/font-size` | `Title/LG/Font Size` |
| `ios/typescale/title2/line-height` | `Title/LG/Line Height` |
| `ios/typescale/callout/font-family` | `Label/LG/Font Family` |
| `ios/typescale/callout/font-size` | `Label/LG/Font Size` |
| `ios/typescale/callout/line-height` | `Label/LG/Line Height` |

---

## Step 8 — Push variables to Figma

Assemble the full `PUT /v1/files/{TARGET_FILE_KEY}/variables` payload. The payload must include:

- `variableCollections`: array of collections to create or update, each with `id` (use existing ID from Step 5 registry, or `"TEMP_COLLECTION_{NAME}"` for new ones), `name`, and `action` (`CREATE` or `UPDATE`)
- `variables`: array of variable definitions, each with collection ID, name, resolved type, value or alias reference, **and `codeSyntax`**
- `variableModes`: include at least one mode per new collection (name it `Default` for new collections)

### Code Syntax Generation

Include a `codeSyntax` object on every variable using the rules below. Platforms are `WEB`, `ANDROID`, and `iOS`.

**Conversion rules (apply to all collections):**

1. Strip collection-specific wrappers: remove `var(--` prefix and `)` suffix from Web variable names before deriving ANDROID/iOS values.
2. **Kebab form**: replace `/` and spaces with `-`, lowercase everything → used for WEB (`var(--kebab-form)`).
3. **Camel form**: split on `/`, `-`, and spaces, capitalize each word after the first, join → used for ANDROID and iOS.

**Primitives collection** — set all three platforms:

| Example variable name | WEB | ANDROID | iOS |
|---|---|---|---|
| `color/primary/500` | `var(--color-primary-500)` | `colorPrimary500` | `colorPrimary500` |
| `Space/400` | `var(--space-400)` | `space400` | `space400` |
| `Corner/Medium` | `var(--corner-medium)` | `cornerMedium` | `cornerMedium` |
| `Title/LG/Font Family` | `var(--title-lg-font-family)` | `titleLgFontFamily` | `titleLgFontFamily` |
| `elevation/400` | `var(--elevation-400)` | `elevation400` | `elevation400` |

**Web collection** — variable names are already CSS custom properties:

| Example variable name | WEB | ANDROID | iOS |
|---|---|---|---|
| `var(--background)` | `var(--background)` | `background` | `background` |
| `var(--primary)` | `var(--primary)` | `primary` | `primary` |
| `var(--gap-md)` | `var(--gap-md)` | `gapMd` | `gapMd` |
| `var(--radius-sm)` | `var(--radius-sm)` | `radiusSm` | `radiusSm` |

**Android/M3 collection** — camelCase path for ANDROID, kebab `var(--)` for WEB, same camelCase for iOS:

| Example variable name | WEB | ANDROID | iOS |
|---|---|---|---|
| `md/sys/color/primary` | `var(--md-sys-color-primary)` | `mdSysColorPrimary` | `mdSysColorPrimary` |
| `md/sys/spacing/medium` | `var(--md-sys-spacing-medium)` | `mdSysSpacingMedium` | `mdSysSpacingMedium` |

**iOS/HIG collection** — camelCase path for iOS, kebab `var(--)` for WEB, same camelCase for ANDROID:

| Example variable name | WEB | ANDROID | iOS |
|---|---|---|---|
| `ios/color/system-background` | `var(--ios-color-system-background)` | `iosColorSystemBackground` | `iosColorSystemBackground` |
| `ios/spacing/medium` | `var(--ios-spacing-medium)` | `iosSpacingMedium` | `iosSpacingMedium` |

Execute the write via `mcp__claude_ai_Figma__use_figma` or the REST endpoint directly through the Figma MCP connector.

**Error — partial write failure:**
If the API returns a `200` with a `errors` array in the response body, some variables failed to write. For each error:
1. Log the variable name and error message.
2. Retry the failed variables individually in a second `PUT` call.
3. If the retry also fails, call **AskUserQuestion**: "These variables failed after retry: {names}. Reply **skip** to continue without them, or **abort** to stop the skill."

Do not silently suppress partial failures.

---

## Step 9 — Verify the write

After the PUT completes, call the GET endpoint again to verify:

```
GET https://api.figma.com/v1/files/{TARGET_FILE_KEY}/variables/local
```

Confirm that:
- The Primitives collection exists and contains the expected color, spacing, radius, and typography variables.
- The platform alias collection (`Web`, `Android/M3`, or `iOS/HIG`) exists and its variables alias the correct Primitives.

Report any variables present in the expected set but absent in the verified response.

---

## Step 10 — Confirm success

After each **Steps 5-9** pass, report to the designer using this shape (substitute real counts and the current `EFFECTIVE_PLATFORM`):

```
Design system written to Figma file {TARGET_FILE_KEY}

Collections created or updated:
  Primitives        — {N} variables written
  {Platform alias collection name}   — {N} variables written

Platform (this pass): {EFFECTIVE_PLATFORM}
Total variables (this pass): {N}

Open in Figma: https://figma.com/design/{TARGET_FILE_KEY}
```

When the original request was **`all`**, after the **third** pass add one line: `All platforms complete: web, android, ios.`

---

## Step 11 — Offer next step

Call **AskUserQuestion**:

> "Run `/create-component` now to build UI components with these tokens? (yes / no)"

If **yes**, invoke `/create-component` with the same Figma file context. If **no**, close the skill.

---

## Token Naming Reference

### Primitives collection — examples

```
color/primary/50        → #EFF6FF  (lightest tint)
color/primary/500       → #3B82F6  (brand anchor — input hex)
color/primary/900       → #1E3A8A  (darkest shade)
color/secondary/500     → #8B5CF6
color/neutral/100       → #F3F4F6
color/neutral/900       → #111827
Space/400               → 16px
Space/600               → 24px
Corner/Medium           → 12px
Corner/Extra-large      → 28px
Title/LG/Font Size      → 22
Title/LG/Font Family    → "Inter"
Headline/MD/Font Weight → 600
elevation/400           → 4
var(--shadow-default)   → #000000
```

### Web collection — examples

```
var(--background)           → aliases color/neutral/50
var(--foreground)           → aliases color/neutral/900
var(--primary)              → aliases color/primary/500
var(--primary-foreground)   → aliases color/primary/50
var(--border-primary)       → aliases color/primary/500
var(--border-secondary)     → aliases color/neutral/200
var(--gap-md)               → aliases Space/300
var(--radius-md)            → aliases Corner/Medium
```

### Android/M3 collection — examples

```
md/sys/color/primary                    → aliases color/primary/500
md/sys/color/primary-container          → aliases color/primary/100
md/sys/color/on-primary                 → aliases color/primary/50
md/sys/color/background                 → aliases color/neutral/50
md/sys/color/outline                    → aliases color/primary/500
md/sys/shape/corner/medium              → aliases Corner/Medium
md/sys/spacing/medium                   → aliases Space/300
md/sys/typescale/title-large/font-size  → aliases Title/LG/Font Size
```

### iOS/HIG collection — examples

```
ios/color/system-background     → aliases color/neutral/50
ios/color/label                 → aliases color/neutral/950
ios/color/tint                  → aliases color/primary/500
ios/color/separator             → aliases color/neutral/200
ios/spacing/medium              → aliases Space/300
ios/shape/corner-medium         → aliases Corner/Medium
ios/typescale/large-title/font-size → aliases Headline/MD/Font Size
ios/typescale/callout/font-family   → aliases Label/LG/Font Family
```

---

## Tailwind Color Ramp Generation

When the designer provides a single hex color as the brand anchor, generate the full 11-stop ramp (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) using the following lightness interpolation approach:

1. Convert the input hex to HSL. The input hex becomes the `500` stop.
2. Assign target lightness values for each stop (approximating Tailwind's perceptual scale):

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

3. Keep the hue (H) constant across all stops. Slightly desaturate lighter stops (S − 2% per stop above 500) and slightly increase saturation for darker stops (S + 2% per stop below 500), clamped to [10%, 100%].
4. Clamp L to [5%, 98%] to avoid pure black or white.
5. Convert each HSL value back to hex.

**When to deviate:** If the designer provides explicit hex values for specific stops (e.g., "use `#1D4ED8` for 700"), use those exact values and interpolate only the unspecified stops. Always prefer designer-supplied values over generated ones.

The lightness interpolation is a practical approximation — it is not required to be mathematically perfect. The goal is a usable ramp, not a colorimetrically precise one. If the designer is unsatisfied with the generated ramp, they can override individual stops after the write.

---

## Error Guidance Summary

| Error Condition | Cause | Resolution |
|---|---|---|
| Missing file key | Designer did not provide or cannot find the Figma file key | Call **AskUserQuestion** with instructions to open the file in a browser and copy the key from the URL |
| 403 Permission denied | MCP connector not authenticated, or account lacks edit access or Organization tier | Re-authenticate Figma MCP connector in Claude Code settings; confirm Figma tier |
| 404 File not found | File key is wrong or the file was deleted | Verify the key matches the current Figma URL; re-run `/new-project` if the file is missing |
| Partial write failures (errors in 200 response) | One or more variable payloads were malformed or referenced a non-existent alias | Retry the failed variables; report names and reasons to the designer if retry fails |
| Variable alias resolution failure | Alias references a Primitive variable ID that does not exist in the file | Confirm Primitives collection was written successfully before writing alias collections; re-run the Primitives write step if IDs are missing |
| Shadow token naming conflict | Target file contains malformed `var--{shadow-default)` token | Write corrected name `var(--shadow-default)` and update all effect references that used the malformed name |
