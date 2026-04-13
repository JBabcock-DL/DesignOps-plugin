---
name: new-language
description: Duplicate a Figma frame into a new page for a target locale and translate all text nodes inline using Claude's language capabilities. No external translation API required. Flags RTL languages (Arabic, Hebrew, Urdu, Persian) with a layout mirroring warning.
argument-hint: "[locale] [node-id] — e.g. /new-language es 123:456. Both are optional — any omitted values will be prompted interactively."
---

# /new-language

Duplicate a Figma frame into a new locale-specific page and translate every text node to the target language — entirely inline, with no external translation API.

---

## Prerequisites

Before running this skill, verify the following are in place:

| Requirement | Notes |
|---|---|
| Figma MCP connector configured | The connector must be active in Claude Code. All Figma canvas operations are performed through it — no PAT or environment variable is needed. |
| Active Figma file key available | Either passed via `plugin/templates/agent-handoff.md` or provided by the designer during the session. |
| Designer has the target frame open or can provide its node ID | The frame to duplicate must already exist in the Figma file. |

---

## Supported Locales

Common locale codes the agent accepts. This list is non-exhaustive — any valid BCP 47 language tag may be used.

| Code | Language | RTL? |
|---|---|---|
| `ar` | Arabic | Yes |
| `de` | German | No |
| `es` | Spanish | No |
| `fa` | Persian (Farsi) | Yes |
| `fr` | French | No |
| `he` | Hebrew | Yes |
| `hi` | Hindi | No |
| `it` | Italian | No |
| `ja` | Japanese | No |
| `ko` | Korean | No |
| `nl` | Dutch | No |
| `pl` | Polish | No |
| `pt` | Portuguese | No |
| `ru` | Russian | No |
| `sv` | Swedish | No |
| `tr` | Turkish | No |
| `ur` | Urdu | Yes |
| `zh-Hans` | Chinese (Simplified) | No |
| `zh-Hant` | Chinese (Traditional) | No |

---

## RTL Languages

The following locales are right-to-left script languages and receive special handling during this skill:

| Code | Language |
|---|---|
| `ar` | Arabic |
| `fa` | Persian (Farsi) |
| `he` | Hebrew |
| `ur` | Urdu |

**Why auto-flip is not applied:** Mirroring a Figma frame for RTL requires inverting layout direction on auto-layout frames, reversing icon placement, flipping margin/padding logic, and adjusting component variants — none of which can be done reliably without designer review. Automated flipping produces broken layouts more often than usable ones. Instead, this skill adds a prominent warning banner on the new page so that designers know manual RTL work is required.

---

## Steps

### Step 1 — Accept or Prompt for the Locale

Parse `$ARGUMENTS`. The first token (if present) is the locale code; the second token (if present and matches the pattern `\d+:\d+`) is the source frame node ID — store it for Step 2 and skip that prompt.

If no locale was provided in `$ARGUMENTS`, ask:

```
Which locale should I translate this frame to?

Common codes:
  es — Spanish        fr — French         de — German
  ar — Arabic (RTL)   he — Hebrew (RTL)   ur — Urdu (RTL)
  fa — Persian (RTL)  ja — Japanese       zh-Hans — Chinese (Simplified)
  ko — Korean         pt — Portuguese     ru — Russian

Enter a locale code, or type any BCP 47 language tag (e.g. pt-BR for Brazilian Portuguese).
```

Validate that the input is a plausible locale code (2–10 characters, alphanumeric with optional hyphens). If the input cannot be identified as a known language, warn the designer and ask them to confirm before continuing.

Store the locale code as `target_locale`.

---

### Step 2 — Identify the Source Frame

If a node ID was parsed from `$ARGUMENTS` in Step 1, use it directly — skip the prompt below.

Otherwise ask the designer:

```
Which frame should I duplicate for this translation?

You can:
  - Paste the Figma node ID (e.g. 123:456)
  - Describe the frame name and I will locate it in the file
```

If the designer provides a node ID, use it directly. If they provide a name or description, use the Figma MCP tool `get_design_context` or `get_metadata` to search the file for a frame matching that name. Confirm the correct frame with the designer before proceeding if more than one candidate is found.

Store the resolved node ID as `source_node_id` and the frame name as `source_frame_name`.

---

### Step 3 — Get the Figma File Key

Check `plugin/templates/agent-handoff.md` for `active_file_key`. If it is set, use that value.

If no file key is available in handoff context, ask:

```
What is the Figma file key for this file?

You can find it in the URL:
  https://www.figma.com/design/<FILE_KEY>/...
```

Store the resolved value as `file_key`.

---

### Step 4 — Duplicate the Frame and Create a New Page

Use Figma MCP tools to perform the following canvas operations in sequence:

#### 4a — Clone the source frame

Call the Figma MCP write tool (via `use_figma` or equivalent) to duplicate the source frame node. The clone should be placed temporarily on the current page or a scratch location — it will be moved in the next sub-step.

```
Clone node: source_node_id
File: file_key
```

Record the cloned node ID as `cloned_node_id`.

#### 4b — Create a new page

Create a new page in the Figma file named using the pattern:

```
[locale] — [original frame name]
```

For example, if the locale is `es` and the frame is named `Home Screen`, the new page name is:

```
es — Home Screen
```

The separator is an em dash (`—`, Unicode U+2014) with a single space on each side, consistent with the Detroit Labs naming standard.

Record the new page ID as `target_page_id`.

#### 4c — Move the cloned frame to the new page

Move `cloned_node_id` onto `target_page_id`. Position it at the same coordinates as the original frame on its source page (x: 0, y: 0 if the original was at the canvas origin; otherwise preserve the original x/y).

---

### Step 5 — Extract All Text Node Strings

Use the Figma MCP tool `get_design_context` on the cloned frame (`cloned_node_id`) to retrieve the full node tree.

Walk the node tree and collect every node of type `TEXT`. For each text node, record:

| Field | Description |
|---|---|
| `node_id` | The text node's Figma node ID |
| `node_name` | The text node's Figma layer name |
| `original_text` | The current string content of the text node |

Build an ordered list of all `(node_id, original_text)` pairs. This is your translation source list.

If no text nodes are found, inform the designer:

```
No text nodes were found in the selected frame. Nothing to translate.
```

and stop.

---

### Step 6 — Translate All Strings Using Claude

Translate each `original_text` value from its source language to `target_locale` using Claude's built-in language capabilities. Do not call DeepL, Google Translate, or any external translation API.

**Translation rules:**

- Translate the meaning accurately and naturally — do not transliterate.
- Preserve formatting markers (e.g. `{name}`, `%s`, `{{count}}`, `<br>`) exactly as they appear; translate the surrounding prose only.
- Preserve all-caps casing if the original is all-caps (e.g. `SUBMIT` → `ENVIAR`).
- Preserve emoji characters in place — do not translate or remove them.
- For strings that are clearly non-translatable (version numbers, URLs, email addresses, numeric codes, placeholder tokens like `—`, `N/A`, `...`), leave them unchanged and mark them as `untranslated`.
- For strings that are ambiguous or highly technical (e.g. `API key`, `OAuth`, `UUID`), flag them for designer review in the final report and leave them unchanged unless a clean translation is obvious.

Build an ordered list of `(node_id, translated_text)` pairs, matching the order of the source list from Step 5.

---

### Step 7 — Write Translated Strings Back to Text Nodes

For each `(node_id, translated_text)` pair, use the Figma MCP write tool to update the text content of that node in the cloned frame on the new page.

Process updates sequentially to avoid race conditions. If any individual write fails, log the failure, skip that node, and continue. Do not abort the entire operation on a single node failure.

---

### Step 8 — RTL Warning Banner (Conditional)

If `target_locale` is one of `ar`, `fa`, `he`, `ur`:

Create a visible warning text frame at the top of the new page (above the cloned frame, not overlapping it) with the following content:

```
⚠️ RTL language — manual layout mirroring required
```

Style the warning frame with:
- Background fill: `#FFF3CD` (amber/warning yellow)
- Text color: `#664D03`
- Font size: 16px, bold
- Padding: 12px on all sides
- Width: match the cloned frame width

Place the warning at y-position `-80` relative to the cloned frame's top edge (or at the canvas top if the frame is at y: 0).

---

### Step 9 — Report

Present a summary to the designer in the plugin panel:

```
Translation complete for locale: [target_locale]

New page: [es — Home Screen]
Page URL: https://www.figma.com/design/<file_key>/?page-id=<target_page_id>

Text nodes translated: [N]
Strings left unchanged (non-translatable): [N]
Strings flagged for review: [N]

[If any strings flagged:]
Strings flagged for review:
  - "[original_text]" (node: [node_name], ID: [node_id]) — reason: [technical/ambiguous]

[If any write failures:]
Write failures:
  - Node [node_id] ("[node_name]") — [error message]
```

If any untranslated or flagged strings exist, append:

```
Please review the flagged strings. They were left in their original language
because they appear to be technical identifiers, error codes, or placeholders
that may not have a direct translation.
```

---

## Limitations

- **Translation quality depends on Claude's training data.** Common UI strings in major languages (Spanish, French, German, Japanese, etc.) translate reliably. Low-resource languages, highly idiomatic phrases, or domain-specific technical terminology may produce imperfect results. Designer review is recommended before shipping translated screens.
- **Technical strings may need manual attention.** Labels like `Toast.makeText`, `R.string.app_name`, or error codes from backend systems are flagged for review and left untranslated. A human translator or developer should verify these.
- **RTL layout is not automatically mirrored.** See the RTL Languages section above.
- **Text overflow is not auto-resolved.** Translated strings (especially German, Finnish, or Russian) are often longer than English originals. Text nodes may overflow their containers. The designer must adjust text boxes or reflow layouts manually after translation.
- **Font availability.** Some locales (e.g. Arabic, Japanese, Chinese, Hindi) require fonts to be available in the Figma file. If the translated text renders as tofu (missing glyph boxes), the designer must apply an appropriate font for that script.

---

## Handoff

After a successful run, update `plugin/templates/agent-handoff.md`:

```yaml
---
active_file_key: "<file_key>"
active_project_name: "<derived from file or prior context>"
last_skill_run: "new-language"
open_items:
  - "Locale page created: [locale] — [source_frame_name] (page ID: <target_page_id>)"
  - "Flagged strings for review: <N>"
  - "[If RTL] RTL layout mirroring required — manual designer action needed"
---
```
