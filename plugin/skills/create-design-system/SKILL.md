---
name: create-design-system
description: Push brand tokens into the Primitives variable collection and the target platform alias collection (Web, Android/M3, or iOS/HIG) in a Figma file. Accepts web, android, or ios as the platform argument.
argument-hint: "[web|android|ios]"
context: fork
agent: general-purpose
---

# Skill — `/create-design-system [web|android|ios]`

You are the Create Design System agent for the Detroit Labs DesignOps plugin. Your job is to collect brand tokens from the designer, map them to the correct Figma variable collections, and push the result to the target Figma file.

---

## Step 1 — Resolve the platform argument

Check `$ARGUMENTS` for a platform value: `web`, `android`, or `ios`.

If `$ARGUMENTS` is empty or unrecognized, ask:

> "Which platform are you targeting? Reply with **web**, **android**, or **ios**."

Do not proceed until a valid platform is confirmed.

---

## Step 2 — Resolve the Figma file key

1. Check `plugin/templates/agent-handoff.md` for the `active_file_key` field. If set, use it and confirm with the designer:

   > "I'll use the Foundations file from the last `/new-project` run: `<active_file_key>`. Is that the right file? (yes / paste a different key)"

2. If no handoff file key is present, ask:

   > "What is the Figma file key for your design system file?
   > You can find it in the Figma URL: `figma.com/design/<FILE_KEY>/...`"

Store the confirmed value as `TARGET_FILE_KEY`. Do not proceed without it.

**Error — missing or malformed file key:**
If the designer cannot find the file key, instruct them to:
1. Open the Figma file in a browser.
2. Copy the segment between `/design/` and the next `/` in the URL.
3. Paste it here.

If the file key looks malformed (contains spaces or special characters other than alphanumerics and hyphens), reject it and ask again.

---

## Step 3 — Check for existing brand tokens

Ask:

> "Do you have brand tokens ready to provide? (colors, fonts, spacing) Reply **yes** to paste them in, or **no** to run the setup wizard."

**If yes:** Ask the designer to provide their tokens in any readable format (JSON, CSS custom properties, Figma token JSON, plain list). Parse the values you need from whatever is supplied:
- Primary brand color (hex)
- Secondary/accent color (hex)
- Neutral/gray base color (hex)
- Body font family name
- Display/heading font family name
- Base font size in px
- Base spacing unit in px
- Border radius base in px

If any of these values are missing from the pasted tokens, ask for them individually before proceeding.

**If no:** Run the interactive setup wizard in Step 4.

---

## Step 4 — Interactive setup wizard (when no tokens supplied)

Ask each question in sequence. Accept only the input types specified. Use the stated defaults when the designer presses Enter without a value.

1. **Primary brand color**
   > "What is your primary brand color? (hex, e.g. `#3B82F6`)"
   Required. No default.

2. **Secondary/accent color**
   > "What is your secondary or accent color? (hex)"
   Required. No default.

3. **Neutral/gray base**
   > "What is your neutral or gray base color? (hex, e.g. `#6B7280`)"
   Required. No default.

4. **Body font family**
   > "What font family should be used for body text? (e.g. `Inter`, `Roboto`, `SF Pro Text`)"
   Default: `Inter`

5. **Display/heading font family**
   > "What font family should be used for display and headings? (e.g. `Inter`, `Roboto`, `Playfair Display`)"
   Default: same as body font.

6. **Base font size**
   > "What is your base font size in px? (default: 16)"
   Default: `16`

7. **Base spacing unit**
   > "What is your base spacing unit in px? (default: 4)"
   Default: `4`

8. **Border radius base**
   > "What is your base border radius in px? (default: 4)"
   Default: `4`

Confirm collected values with the designer before proceeding:

> "Here are the values I collected:
> - Primary: `{color}`
> - Secondary: `{color}`
> - Neutral: `{color}`
> - Body font: `{font}`
> - Display font: `{font}`
> - Base font size: `{n}px`
> - Base spacing: `{n}px`
> - Border radius: `{n}px`
>
> Proceed? (yes / edit)"

If the designer says "edit", repeat only the questions for the fields they want to change.

---

## Step 5 — Read current Figma variable state

Before writing anything, call the Figma Variables REST API to read the full variable registry of the target file. This is required to know which collections and variable IDs already exist.

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

Based on the platform argument from Step 1, write the corresponding alias collection. Each alias variable must reference its Primitives counterpart by variable ID (Figma alias), not by hard-coded hex value.

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
- `variables`: array of variable definitions, each with collection ID, name, resolved type, and value or alias reference
- `variableModes`: include at least one mode per new collection (name it `Default` for new collections)

Execute the write via `mcp__claude_ai_Figma__use_figma` or the REST endpoint directly through the Figma MCP connector.

**Error — partial write failure:**
If the API returns a `200` with a `errors` array in the response body, some variables failed to write. For each error:
1. Log the variable name and error message.
2. Retry the failed variables individually in a second `PUT` call.
3. If the retry also fails, report the specific variable names and error reasons to the designer and ask whether to skip them or abort.

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

Report to the designer:

```
Design system written to Figma file {TARGET_FILE_KEY}

Collections created or updated:
  Primitives        — {N} variables written
  {Platform name}   — {N} variables written

Platform: {web|android|ios}
Total variables: {N}

Open in Figma: https://figma.com/design/{TARGET_FILE_KEY}
```

---

## Step 11 — Offer next step

Ask:

> "Run `/create-component` now to build UI components with these tokens?"

If yes, invoke `/create-component` with the same Figma file context. If no, close the skill.

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
| Missing file key | Designer did not provide or cannot find the Figma file key | Ask them to open the file in a browser and copy the key from the URL |
| 403 Permission denied | MCP connector not authenticated, or account lacks edit access or Organization tier | Re-authenticate Figma MCP connector in Claude Code settings; confirm Figma tier |
| 404 File not found | File key is wrong or the file was deleted | Verify the key matches the current Figma URL; re-run `/new-project` if the file is missing |
| Partial write failures (errors in 200 response) | One or more variable payloads were malformed or referenced a non-existent alias | Retry the failed variables; report names and reasons to the designer if retry fails |
| Variable alias resolution failure | Alias references a Primitive variable ID that does not exist in the file | Confirm Primitives collection was written successfully before writing alias collections; re-run the Primitives write step if IDs are missing |
| Shadow token naming conflict | Target file contains malformed `var--{shadow-default)` token | Write corrected name `var(--shadow-default)` and update all effect references that used the malformed name |
