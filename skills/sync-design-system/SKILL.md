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
pairs covering all variable collections in the file (Primitives, Web,
Android/M3, iOS/HIG). Resolve alias tokens to their final primitive values for
diff purposes.

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
  its value. Infer the collection from the token name prefix
  (`color/*`, `spacing/*`, etc. → Primitives; semantic aliases → Web/Android/iOS
  per the active platform).
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
