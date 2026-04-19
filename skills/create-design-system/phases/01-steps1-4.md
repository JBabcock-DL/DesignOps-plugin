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
