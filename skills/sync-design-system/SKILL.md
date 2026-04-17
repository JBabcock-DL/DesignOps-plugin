---
skill: sync-design-system
invocation: /sync-design-system
description: >
  Diff a local token file against the current Figma variable state and push
  changes in either direction — code-to-Figma or Figma-to-code.
arguments: {}
auth: Figma MCP connector via Claude Code (no PAT required)
api: Figma Variables REST API — GET /v1/files/:key/variables/local, PUT /v1/files/:key/variables
requires_figma_tier: Organization
---

# Skill — /sync-design-system

Reads the local token file directly from the filesystem, reads the live Figma
variable state via the Figma Variables REST API, computes a three-way diff
(new / missing / conflicting), presents the diff to the designer, and executes
the chosen sync direction.

---

## Interactive input contract

Whenever this skill needs a **token file path**, **Figma file key or URL**, **sync direction** (Step 7), **per-conflict resolution** (F / C / S), **whether to push after manual conflict review**, or a **corrected path after an error**, use **AskUserQuestion** — **one tool call per question**. Wait for each answer before the next.

Do not dump multiple decision prompts as plain markdown without calling **AskUserQuestion** for each decision turn.

---

## Step 1 — Locate the Token Source File

1. Read `plugin/.claude/settings.local.json` and look for the `token_schema_path` key.
2. If `token_schema_path` is present and the file exists at that path, use it.
3. If `token_schema_path` is missing or the file does not exist, call **AskUserQuestion**:

   > "I couldn't find the token file at the path in settings.local.json. Paste the path to your token file (e.g. `src/tokens.json`, `tailwind.config.js`, or `src/styles/tokens.css`)."

4. Accept the path from the AskUserQuestion reply and proceed. Do not assume a default path that has not been confirmed. If the path is still invalid, call **AskUserQuestion** again until you have a readable file.

---

## Step 2 — Parse the Token File into a Normalized Flat Map

Read the file and parse it according to its format (see "Supported Token File
Formats" below). Produce a flat map of `{ "token-name": "value" }` pairs where:

- Token names use forward-slash notation: `color/primary`, `spacing/4`,
  `typography/font-size/base`.
- Values are the resolved primitive strings or numbers (not aliases or
  JavaScript expressions).

If the file cannot be read or is malformed, stop and report the error to the
designer (see "Error Guidance" below).

---

## Step 3 — Get the Figma File Key

1. Check `$ARGUMENTS` first — if a Figma file URL or key was passed directly (e.g. `/sync-design-system figma.com/design/abc123/...`), extract and use it.
2. If no argument was provided, check `plugin/templates/agent-handoff.md` for the `active_file_key` field.
3. If neither is available, call **AskUserQuestion**:

   > "Paste the Figma file URL or file key for the design system file you want to sync against."

4. Extract the file key from the URL if a full URL was provided
   (`figma.com/design/:fileKey/...`).

---

## Step 4 — Read Current Figma Variables

Call the Figma Variables REST API via the Figma MCP connector:

```
GET /v1/files/:key/variables/local
```

Parse the response to build a flat map of `{ "collection/token-name": "value" }`
pairs covering all variable collections in the file (`Primitives`, `Theme`,
`Typography`, `Layout`, `Effects`). Resolve alias tokens to their final
primitive values for diff purposes.

**Mode-aware flattening:** For collections with multiple modes, flatten each
mode into a separate key using the pattern `collection/mode/token-name`:
- Theme (2 modes): `theme/light/color/background/default`, `theme/dark/color/background/default`, `theme/light/color/background/variant`, `theme/light/color/error/default`, etc.
- Typography (8 modes): `typography/100/Headline-LG-font-size`, `typography/200/Headline-LG-font-size`, etc.
- Effects (2 modes): `effects/light/shadow/color`, `effects/dark/shadow/color`
- Primitives and Layout (1 mode each): `primitives/color-primary-500`, `layout/space-md`

If the file contains legacy collections (`Web`, `Android/M3`, `iOS/HIG`) from a
pre-refactor run, include them in the read but flag them in the diff output as
deprecated.

If the API call fails, report the error to the designer (see "Error Guidance").

---

## Step 5 — Compute the Diff

Compare the code flat map from Step 2 against the Figma flat map from Step 4.
Categorize every token into exactly one bucket:

| Bucket | Condition |
|---|---|
| **New tokens (code → Figma)** | Token exists in code but NOT in Figma |
| **Missing tokens (Figma → code)** | Token exists in Figma but NOT in code |
| **Value conflicts** | Token exists in BOTH but values differ |

Tokens that match exactly in both name and value are in sync — do not include
them in the diff output.

---

## Step 6 — Present the Diff Summary

Report the diff to the designer in three clearly labeled sections. Use this
format:

```
--- Token Diff Summary ---

NEW (in code, not in Figma): 12 tokens
  color/brand/500        #1D4ED8
  color/brand/600        #1E40AF
  spacing/14             3.5rem
  ... (show all; truncate with count if >20)

MISSING (in Figma, not in code): 3 tokens
  color/deprecated/red   #EF4444
  spacing/legacy/1       4px
  typography/display/xl  4rem

CONFLICTS (different values): 5 tokens
  Token                  Code Value    Figma Value
  color/primary          #2563EB       #1D4ED8
  spacing/4              1rem          16px
  ...

In sync: 247 tokens (no changes needed)
```

If all tokens are in sync (diff is empty), report that and stop:

> "All tokens are in sync. No changes are needed."

---

## Step 7 — Choose sync direction

Call **AskUserQuestion**. Include the following text in the question body. If any **CONFLICTS** exist in the diff, **omit option 3** from the question text entirely.

> "Which direction should I sync? Reply **1**, **2**, **3**, or **4**:
>
> 1. **Push to Figma** — overwrite Figma variables with code token values (NEW + CONFLICTS use code)
> 2. **Push to code** — overwrite the local token file with Figma values (MISSING + CONFLICTS use Figma)
> 3. **Push both** — NEW → Figma and MISSING → code (only when there are zero CONFLICTS)
> 4. **Review conflicts manually** — resolve each conflict one at a time before pushing"

Parse the reply (`1`–`4`) before Step 8. If the reply is ambiguous, call **AskUserQuestion** again with the same options.

---

## Step 8 — Execute the Chosen Action

### Option 1 — Push to Figma

For each token in the NEW bucket and each token in the CONFLICTS bucket (using
the code value), call the Figma Variables REST API:

```
PUT /v1/files/:key/variables
```

Payload structure (Figma Variables bulk write format):

```json
{
  "variableModeValues": [
    {
      "variableId": "<resolved-or-new-variable-id>",
      "modeId": "<mode-id>",
      "value": "<token-value>"
    }
  ]
}
```

- For NEW tokens, create the variable in the correct collection before setting
  its value. Infer the collection from the token name prefix using these rules:
  - `color/{ramp}/{stop}` (e.g. `color/primary/500`) → `Primitives`
  - `Space/*`, `Corner/*`, `elevation/*` → `Primitives`
  - `color/{group}/{token}` (e.g. `color/background/default`, `color/background/content`, `color/border/default`, `color/primary/default`) → `Theme`
  - `Display/*`, `Headline/*`, `Body/*`, `Label/*` → `Typography`
  - `space/*`, `radius/*` (lowercase) → `Layout`
  - `shadow/*` → `Effects`
  - When creating a Theme variable, write values for both `Light` and `Dark` modes.
  - When creating a Typography variable, write values for all 8 modes (`85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`).
- For CONFLICT tokens, update the existing variable's value.
- Report: "Pushed N tokens to Figma."

### Option 2 — Push to code

For each token in the MISSING bucket and each token in the CONFLICTS bucket
(using the Figma value), update the local token file:

- Write the token back into the same file format it was read from.
- Preserve all existing tokens that were already in sync.
- Report: "Updated N tokens in `<token-file-path>`."

### Option 3 — Push both (no conflicts only)

Execute Option 1 for all NEW tokens and Option 2 for all MISSING tokens
simultaneously. Report: "Pushed N tokens to Figma and updated M tokens in code."

### Option 4 — Review conflicts manually

Follow the manual conflict resolution flow in the **Conflict Resolution** section below. That section ends with one **AskUserQuestion** to confirm pushing resolved changes. If the designer answers **yes**, execute the push using the decisions recorded during resolution.

---

## Step 9 — Confirm Completion

After any push operation, report a final summary:

```
Sync complete.
  Tokens pushed to Figma:   N
  Tokens updated in code:   M
  Conflicts resolved:       K
  Tokens skipped:           J
```

**Canvas follow-up (same skill run, after the summary above):** when Step **9b**’s trigger applies (Figma received token writes in Step 8), execute **Step 9b**, then **Step 9c**, then **Step 9d**, then **Step 9e** before ending the skill — in that order. When Step 9b is skipped (direction **2** only, or zero tokens written to Figma), skip **9c**, **9d**, and **9e** as well.

**Canvas checklist (blocking before the skill ends — log one line per step when 9b’s trigger applies):**

| Step | Log line (example) |
|---|---|
| 9b | `Canvas: Step 9b style guide — done` or `… skipped (reason)` |
| 9c | `Canvas: Step 9c ↳ MCP Tokens — done` or `… skipped (reason)` |
| 9d | `Canvas: Step 9d ↳ Token Overview — done` or `… skipped (reason)` |
| 9e | `Canvas: Step 9e Thumbnail Cover — done` or `… skipped (reason)` |

---

## Step 9b — Redraw Affected Style Guide Pages

**Trigger:** Run this step only when the designer chose direction **1** (Push to Figma), **3** (Push both), or **4** (manual conflict review with a confirmed push). Skip entirely for direction **2** (Push to code) or if no tokens were written to Figma.

### 1. Determine which collections were affected

Inspect the push payload — the set of tokens that were actually written to Figma in Step 8. Map each token path to its collection using these rules:

| Token path pattern | Collection | Style Guide page to redraw |
|---|---|---|
| `color/{ramp}/{stop}` (e.g. `color/primary/500`) | Primitives | `↳ Primitives` |
| `Space/*`, `Corner/*`, `elevation/*` | Primitives | `↳ Primitives` |
| `color/{group}/{token}` (e.g. `color/background/default`) | Theme | `↳ Theme` |
| `Display/*`, `Headline/*`, `Body/*`, `Label/*` | Typography | `↳ Text Styles` |
| `space/*`, `radius/*` (lowercase) | Layout | `↳ Layout` |
| `shadow/*` | Effects | `↳ Effects` |

Build a deduplicated list of affected pages (e.g. if ten `color/primary/*` tokens were pushed, `↳ Primitives` appears in the list once).

### 2. Re-read affected collections from Figma

For each collection in the affected list, call:

```
GET /v1/files/:key/variables/local
```

Read only the variables belonging to affected collections. Resolve all alias tokens to their final primitive values (hex, px numbers). Do not use the pre-diff snapshot — fetch the current live state so the redrawn pages reflect what was just pushed.

### 3. Redraw each affected page

Before any `use_figma` canvas work, **`Read`** [`skills/create-design-system/SKILL.md`](../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§ **A–D**). Token-bound doc chrome (**§ C**) and token-demo bindings (**§ D**) must match that spec.

**Reliability:** run **one `use_figma` call per affected page** (same split as create-design-system **Steps 15a–15c**), not one mega-call across all pages — each call: navigate → delete `y > 360` → redraw that page only.

| Affected page(s) | `use_figma` batch |
|---|---|
| `↳ Primitives` only | One execution: **Primitives** redraw (create-design-system **Step 15a** spec). |
| `↳ Theme` only | One execution: **Theme** redraw (**Step 15b** spec). |
| `↳ Layout`, `↳ Text Styles`, and/or `↳ Effects` | One execution can redraw **all three** in sequence if all are in the affected list (**Step 15c** spec). If only one or two of these three are affected, still use one execution but only redraw those pages. |

Per page:

1. Navigate: `figma.setCurrentPageAsync(page)` — exact page name (e.g. `↳ Primitives`).
2. Delete all nodes with **`y > 360`** (keep doc header `y ≤ 360`).
3. Redraw using the same spec as **create-design-system Steps 15a–15c** for that page. Authoritative detail: [`skills/create-design-system/SKILL.md`](../create-design-system/SKILL.md).

**↳ Primitives** — per **create-design-system Step 15a**: **56px** strips; **120×160** ramp cards with **variable-bound** fills to each **`color/{ramp}/{stop}`**; Space bars with **width** bound to **`Space/*`** when supported; Corner squares with **`cornerRadius`** bound to **`Corner/*`** when supported; literals only if **`Doc/*`** styles are absent (first run).

**↳ Theme** — per **Step 15b**: **56px** group strips; **2-column** premium token cards (**24px** padding, **12px** radius); **80×80** Light/Dark swatch pairs with **`setExplicitVariableModeForCollection`** on **`doc/theme-preview/light|dark`** wrappers and **bound** Theme variable fills; visible **LIGHT/DARK** labels; **`Doc/*`** text styles when present; WEB/ANDROID/iOS from live **`codeSyntax`**.

**↳ Text Styles** — per **Step 15c**: **12** rows; specimen **`textStyleId`** → published slot style (`Display/LG` …); metadata **`Doc/Code`**; dividers bound to **`color/border/subtle`**; republish **`Doc/*`** + slot styles in **§0** when Typography changed.

**↳ Layout** — per **Step 15c**: **56px** strips; spacing/radius sections with bound bars / **`cornerRadius`** where supported; **`Doc/*`** labels.

**↳ Effects** — per **Step 15c**: **~240×260** cards, **96×96** specimen, Light/Dark via **Effects** explicit modes; maintain **`Effect/shadow-*`** local effect styles; **`shadow/color`** swatch card as specified in create **Step 15c**.

### 4. Report

After all redraws complete, output:

> "Style guide updated: {comma-separated list of redrawn page names}"

Log the **Canvas checklist** row for Step 9b.

---

## Step 9c — Redraw MCP Tokens Page

**Trigger:** Same condition as Step 9b — run only when direction was **1**, **3**, or **4** (push to Figma occurred). Skip for direction **2**.

### 1. Navigate to the MCP Tokens page

In a `use_figma` call, navigate to the `↳ MCP Tokens` page: `figma.setCurrentPageAsync(page)` — locate by exact name `↳ MCP Tokens`.

### 2. Delete the existing manifest frame

If a frame named `[MCP] Token Manifest` exists on the page, delete it entirely. Do not delete the doc header (y ≤ 360).

### 3. Rebuild the manifest from scratch

Create a new root frame named `[MCP] Token Manifest` at x=0, y=360, width=1440 — **`layoutMode: VERTICAL`**, padding and `itemSpacing` per **create-design-system Step 16** and **Canvas documentation visual spec** § A–C (root fill → `color/background/default`, not a detached white-only fill). Build its contents using the same spec as **create-design-system Step 16**, with the following two overrides:

- In the `[MCP] JSON Manifest` text node, set `"skill": "sync-design-system"` (not `"create-design-system"`).
- Set `"generated"` to the current ISO-8601 datetime at the time this step executes.

The manifest structure is:

**[MCP] JSON Manifest text node** (at y=0 within the root frame) — a single monospaced Label/SM text block named `[MCP] JSON Manifest` containing the full token manifest as a minified JSON string in this shape:

```json
{
  "meta": { "generated": "<ISO-8601 now>", "skill": "sync-design-system", "file": "<TARGET_FILE_KEY>" },
  "collections": {
    "Primitives": { "<path>": { "type": "COLOR|FLOAT", "value": "<resolved>", "web": "...", "android": "...", "ios": "..." }, ... },
    "Theme": {
      "light": { "<path>": { "type": "COLOR", "value": "<resolved>", "web": "...", "android": "...", "ios": "..." }, ... },
      "dark": { ... }
    },
    "Typography": { "<mode>": { "<path>": { "type": "FLOAT", "value": "<resolved>", ... } }, ... },
    "Layout": { "<path>": { "type": "FLOAT", "value": "<resolved>", ... }, ... },
    "Effects": { "<mode>": { "<path>": { "type": "COLOR|FLOAT", "value": "<resolved>", ... } }, ... }
  }
}
```

All values are fully resolved (no alias references). Use the same live variable data fetched in Step 9b if available; otherwise call `GET /v1/files/:key/variables/local` once to get current values for all collections.

**Five collection table sub-frames** stacked vertically below the JSON node, each following **create-design-system Step 16** (including **`ALIAS →`**, **`MODE`**, **32px** bound **SWATCH** cells for COLOR rows, **`Doc/*`** typography, row **minHeight ~44**, and the **`MODE` = collection mode** caption).

- `[MCP] Primitives` — `PATH | TYPE | VALUE | SWATCH | WEB | ANDROID | iOS` — **SWATCH** variable-bound for COLOR.
- `[MCP] Theme` — `PATH | MODE | TYPE | ALIAS → | VALUE | SWATCH | WEB | ANDROID | iOS` — two rows per token (`light` / `dark`); explicit mode on row or swatch wrapper when used in create.
- `[MCP] Typography` — `PATH | PROPERTY | MODE | ALIAS → | VALUE | WEB | ANDROID | iOS`.
- `[MCP] Layout` — `PATH | TYPE | VALUE | ALIAS → | WEB | ANDROID | iOS` (**`ALIAS →`** = Primitive target, replaces legacy **BOUND TO** header).
- `[MCP] Effects` — `PATH | MODE | TYPE | ALIAS → | VALUE | SWATCH | WEB | ANDROID | iOS` (**SWATCH** for `shadow/color` only).

All table body text **≥13px** mono (**`Doc/Code`** when available). Column headers bold (**`Doc/TokenName`** / **`Doc/Code`**).

### 4. Report

> "MCP Tokens page updated."

Log the **Canvas checklist** row for Step 9c.

---

## Step 9d — Refresh Token Overview

**Trigger:** Same as Step 9b — run only when a push to Figma occurred (directions **1**, **3**, or **4** with confirmed push). Skip for direction **2** or when Step 9b was skipped.

### 1. Navigate

In `use_figma`, go to the `↳ Token Overview` page (`figma.setCurrentPageAsync`). If the page does not exist, log `Canvas: Step 9d ↳ Token Overview — skipped (page missing)` and continue to Step 9e.

### 2. Refresh content

Execute the same population and rebinding logic as **create-design-system Step 17** (architecture diagram fills, platform-mapping table rows and `codeSyntax` cells, Dark Mode phone fills, delete `placeholder/*`, fix `TBD`, **rebind documentation chrome** on `_PageContent` and `token-overview/*` per **Canvas documentation visual spec § A–D**). Use live variable data from Step 9b’s fetch when available; otherwise `GET /v1/files/:key/variables/local` once.

### 3. Report

> "Token Overview page refreshed."

Log the **Canvas checklist** row for Step 9d.

---

## Step 9e — Refresh Thumbnail Cover

**Trigger:** Same as Step 9b — run only when a push to Figma occurred. Skip for direction **2** or when Step 9b was skipped.

### 1. Navigate

In `use_figma`, go to the `Thumbnail` page. Find the frame named `Cover`.

### 2. Update gradient (or skip)

Apply the same logic as **create-design-system Step 18**: update the linear gradient stop colors to resolved `color/primary/500` and `color/secondary/500` from **Primitives**; do not change `gradientTransform`. If `Cover` is missing, log a warning, skip paint changes, and still log the checklist row as skipped.

### 3. Report

> "Thumbnail Cover updated." (or skipped if no `Cover` frame.)

Log the **Canvas checklist** row for Step 9e.

---

## Conflict Resolution

When the designer chooses "Review conflicts manually" (Option 4), walk through
each conflict token **one at a time**. For **each** conflict, call **AskUserQuestion** with a body like:

> "Conflict [i] of [N] — `[token-name]`
> - Code value: `[code-value]`
> - Figma value: `[figma-value]`
> Reply **F** (use Figma → update code), **C** (use code → update Figma), or **S** (skip)."

Record each decision and move to the next conflict. After all conflicts have been reviewed, present a resolution summary (counts for Figma vs code vs skipped), then call **AskUserQuestion**:

> "Push these resolutions to Figma and/or code now? (yes / no)"

---

## Supported Token File Formats

### tokens.json (W3C Design Token Community Group format)

```json
{
  "color": {
    "primary": { "$value": "#2563EB", "$type": "color" }
  },
  "spacing": {
    "4": { "$value": "1rem", "$type": "dimension" }
  }
}
```

Traverse the nested object, constructing token names with `/` separators.
Use the `$value` field as the token value. Ignore `$type`, `$description`,
and other metadata fields for diff purposes.

### tailwind.config.js

```js
module.exports = {
  theme: {
    extend: {
      colors: { primary: '#2563EB' },
      spacing: { '14': '3.5rem' }
    }
  }
}
```

Read the file as text and evaluate the `theme.extend` (or `theme`) object.
Map `colors.*` → `color/*`, `spacing.*` → `spacing/*`,
`fontSize.*` → `typography/font-size/*`, etc.

> Note: If the config uses `require()` or references external modules, parse
> only the literal values and skip dynamic expressions. Warn the designer
> if values were skipped.

### CSS custom properties (.css / .scss)

```css
:root {
  --color-primary: #2563EB;
  --spacing-4: 1rem;
}
```

Parse all `--<name>: <value>` declarations inside `:root` blocks.
Convert kebab-case names to slash-notation:
`--color-primary` → `color/primary`, `--spacing-4` → `spacing/4`.

When parsing CSS custom properties that match Theme semantic token names, map them to the grouped Figma token paths using this reverse-lookup table. **Canonical keys** are the Tailwind-friendly **`--color-*`** names from `tokens.css` / Figma `codeSyntax.WEB` — duplicate shadcn / legacy vars are skipped during diff:

- `--color-background-dim` → `color/background/dim`
- `--color-background` → `color/background/default`
- `--color-background-bright` → `color/background/bright`
- `--color-background-container-lowest` → `color/background/container-lowest`
- `--color-background-container-low` → `color/background/container-low`
- `--color-background-container` → `color/background/container`
- `--color-background-container-high` → `color/background/container-high`
- `--color-background-container-highest` → `color/background/container-highest`
- `--color-background-variant` → `color/background/variant`
- `--color-content` → `color/background/content`
- `--color-content-muted` → `color/background/content-muted`
- `--color-border` → `color/border/default`
- `--color-border-subtle` → `color/border/subtle`
- `--color-inverse-surface` → `color/background/inverse`
- `--color-inverse-content` → `color/background/inverse-content`
- `--color-inverse-brand` → `color/background/inverse-primary`
- `--color-scrim` → `color/background/scrim`
- `--color-shadow-tint` → `color/background/shadow`
- `--color-primary` → `color/primary/default`
- `--color-on-primary` → `color/primary/content`
- `--color-primary-subtle` → `color/primary/subtle`
- `--color-on-primary-subtle` → `color/primary/on-subtle`
- `--color-primary-fixed` → `color/primary/fixed`
- `--color-primary-fixed-dim` → `color/primary/fixed-dim`
- `--color-on-primary-fixed` → `color/primary/on-fixed`
- `--color-on-primary-fixed-muted` → `color/primary/on-fixed-variant`
- `--color-secondary` → `color/secondary/default`
- `--color-on-secondary` → `color/secondary/content`
- `--color-secondary-subtle` → `color/secondary/subtle`
- `--color-on-secondary-subtle` → `color/secondary/on-subtle`
- `--color-secondary-fixed` → `color/secondary/fixed`
- `--color-secondary-fixed-dim` → `color/secondary/fixed-dim`
- `--color-on-secondary-fixed` → `color/secondary/on-fixed`
- `--color-on-secondary-fixed-muted` → `color/secondary/on-fixed-variant`
- `--color-accent` → `color/tertiary/default`
- `--color-on-accent` → `color/tertiary/content`
- `--color-accent-subtle` → `color/tertiary/subtle`
- `--color-on-accent-subtle` → `color/tertiary/on-subtle`
- `--color-accent-fixed` → `color/tertiary/fixed`
- `--color-accent-fixed-dim` → `color/tertiary/fixed-dim`
- `--color-on-accent-fixed` → `color/tertiary/on-fixed`
- `--color-on-accent-fixed-muted` → `color/tertiary/on-fixed-variant`
- `--color-danger` → `color/error/default`
- `--color-on-danger` → `color/error/content`
- `--color-danger-subtle` → `color/error/subtle`
- `--color-on-danger-subtle` → `color/error/on-subtle`
- `--color-danger-fixed` → `color/error/fixed`
- `--color-danger-fixed-dim` → `color/error/fixed-dim`
- `--color-on-danger-fixed` → `color/error/on-fixed`
- `--color-on-danger-fixed-muted` → `color/error/on-fixed-variant`
- `--color-field` → `color/component/input`
- `--color-focus-ring` → `color/component/ring`
- `--color-sidebar` → `color/component/sidebar`
- `--color-on-sidebar` → `color/component/sidebar-content`

**Skip during diff** — shadcn/ui and legacy names that duplicate `--color-*`:
`--background`, `--on-background`, `--foreground`, `--background-inverse`, `--foreground-inverse`, `--surface-raised`, `--surface-overlay`, `--border`, `--border-subtle`, `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--primary-foreground`, `--primary-subtle`, `--on-primary-subtle`, `--secondary`, `--on-secondary`, `--secondary-container`, `--on-secondary-container`, `--secondary-foreground`, `--secondary-subtle`, `--on-secondary-subtle`, `--tertiary`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container`, `--accent`, `--accent-foreground`, `--error`, `--on-error`, `--error-container`, `--on-error-container`, `--destructive`, `--destructive-foreground`, `--error-subtle`, `--on-error-subtle`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`

Platform-prefixed names (`--md-sys-*`, `--ios-*`) are legacy — skip them with a warning.

---

## Error Guidance

### File not found

> "The token file at `<path>` could not be found. Please check the path in
> `plugin/.claude/settings.local.json` or provide the correct file path."

If the path is still wrong after reporting the error, call **AskUserQuestion** to collect a corrected path before continuing.

### Malformed token file

> "The token file at `<path>` could not be parsed. It may contain a syntax
> error or an unsupported format.
>
> Supported formats: `tokens.json` (W3C DTCG), `tailwind.config.js`,
> CSS custom properties (`.css` / `.scss`).
>
> Please fix the file and run `/sync-design-system` again, or provide an
> alternative token file path."

Then call **AskUserQuestion** asking whether to paste a new token file path or stop the skill.

### API write permission error (403 / insufficient permissions)

> "The Figma API returned a permission error when trying to write variables.
> This usually means one of the following:
>
> - Your Figma account is not on an Organization tier plan (required for
>   REST Variables API write access).
> - The Figma MCP connector needs to be re-authenticated in Claude Code
>   settings.
> - You do not have edit access to the Figma file (`<file-key>`).
>
> Please verify your plan tier and connector auth, then retry."

### API read error (4xx / 5xx on GET variables)

> "Could not read variables from Figma file `<file-key>`.
> HTTP `<status>`: `<message>`.
>
> Check that the file key is correct and that your Figma MCP connector is
> authenticated. If the error persists, try re-authenticating the connector
> in Claude Code settings."
