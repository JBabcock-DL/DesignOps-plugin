---
name: accessibility-check
description: Run a WCAG 2.1 AA accessibility check on a Figma frame, including contrast ratio checks, font size minimums, iOS Dynamic Type simulation (12-step Apple scale), and Android font scaling simulation (100/130/150/200%). Generates an inline pass/fail report and optionally writes a report frame to an Accessibility page.
argument-hint: "[node-id] — optional. e.g. /accessibility-check 123:456. If omitted, the agent prompts for the target frame."
---

# /accessibility-check

Run a WCAG 2.1 AA accessibility audit on a selected Figma frame. Checks contrast ratios and font sizes, simulates iOS Dynamic Type across all 12 Apple scale steps, simulates Android font scaling at Material 3 breakpoints, and generates a detailed inline report.

---

## Prerequisites

Before running this skill, verify the following are in place:

| Requirement | Notes |
|---|---|
| Figma MCP connector configured | The connector must be active in Claude Code. All canvas reads and writes use it — no PAT or environment variable is needed. |
| Active Figma file key available | Either passed via `plugin/templates/agent-handoff.md` or provided by the designer during the session. |
| Target frame exists in the file | The frame to audit must already exist. This skill does not create frames. |

---

## WCAG 2.1 AA Thresholds

All contrast checks use the WCAG 2.1 relative luminance formula. The conformance standard is **Level AA** — Level AAA is not enforced but failures will be noted.

| Text Type | Minimum Contrast Ratio | Definition |
|---|---|---|
| Normal text (AA) | 4.5:1 | Any text below 18pt (24px) regular weight, or below 14pt (approximately 18.67px) bold |
| Large text (AA) | 3:1 | Text at 18pt (24px) or larger (regular weight), or 14pt (approximately 18.67px) or larger (bold) |
| UI components & graphics | 3:1 | Interactive element boundaries, focus indicators, informational icons |
| Normal text (AAA, informational) | 7:1 | Not enforced — reported as advisory only |
| Large text (AAA, informational) | 4.5:1 | Not enforced — reported as advisory only |

**Luminance formula:**

```
L = 0.2126 * R + 0.7152 * G + 0.0722 * B
(where R, G, B are linearized: c/255 <= 0.04045 ? c/3294.6 : ((c/255 + 0.055)/1.055)^2.4)

Contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

---

## iOS Dynamic Type Scale Reference

Apple's Dynamic Type system defines 12 accessibility text size steps. Simulate each step by multiplying every text node's base font size by the corresponding multiplier.

| Step | Name | Multiplier |
|---|---|---|
| 1 | xSmall | 0.82 |
| 2 | Small | 0.88 |
| 3 | Medium | 0.94 |
| 4 | Large (default) | 1.00 |
| 5 | xLarge | 1.12 |
| 6 | xxLarge | 1.24 |
| 7 | xxxLarge | 1.37 |
| 8 | AX1 | 1.53 |
| 9 | AX2 | 1.76 |
| 10 | AX3 | 1.98 |
| 11 | AX4 | 2.20 |
| 12 | AX5 | 2.47 |

Step 4 (Large) is the iOS default text size. Steps 8–12 (AX1–AX5) are Accessibility sizes enabled via iOS Settings → Accessibility → Larger Text.

---

## Android Font Scale Reference

Android 14 / Material 3 defines four font scale breakpoints for accessibility simulation.

| Scale | Multiplier | Description |
|---|---|---|
| Default | 100% (1.00) | System default — baseline |
| Large | 130% (1.30) | "Large text" in Android Accessibility Settings |
| Larger | 150% (1.50) | Maximum recommended by Material 3 for layout testing |
| Largest | 200% (2.00) | Maximum Android system font scale (Android 14+) |

---

## Steps

### Step 1 — Identify the Target Frame

Check `$ARGUMENTS` first. If a node ID was passed (e.g. `/accessibility-check 123:456`), use it directly as `source_node_id` and skip the prompt below. Resolve `source_frame_name` by calling `get_metadata` on the node.

If no argument was provided, ask the designer:

```
Which frame should I audit for accessibility?

You can:
  - Paste the Figma node ID (e.g. 123:456)
  - Describe the frame name and I will locate it in the file
```

If the designer provides a name, use `get_design_context` or `get_metadata` to locate it in the file. If multiple candidates match, list them and ask the designer to confirm.

Store the resolved values as `source_node_id` and `source_frame_name`.

---

### Step 2 — Get the Figma File Key

Check `plugin/templates/agent-handoff.md` for `active_file_key`. If it is set, use that value.

If no file key is available, ask:

```
What is the Figma file key for this file?

You can find it in the Figma URL:
  https://www.figma.com/design/<FILE_KEY>/...
```

Store the value as `file_key`.

---

### Step 3 — WCAG AA Contrast Checks

Use `get_design_context` on `source_node_id` to retrieve the complete node tree for the frame.

Walk the node tree and for each `TEXT` node:

1. **Read the text node's fill color.** Use the node's `fills` array — take the topmost solid fill. If the fill is a variable alias, resolve it to its bound hex/RGB value.

2. **Find the effective background color.** Walk up the node tree to find the nearest ancestor with a solid `fills` or `background` value. If no background is found, assume white (`#FFFFFF`).

3. **Compute the contrast ratio** using the WCAG 2.1 relative luminance formula defined in the thresholds section above.

4. **Determine text size category:**
   - **Large text**: `fontSize >= 24` (18pt) at regular weight, or `fontSize >= 18.67` (14pt) at bold weight (`fontWeight >= 700`)
   - **Normal text**: all other text nodes

5. **Apply the appropriate threshold:**
   - Normal text: fail if contrast < 4.5:1
   - Large text: fail if contrast < 3:1

6. **Record each result** in the issues list:

```
{
  element_name: <layer name>,
  node_id: <node ID>,
  issue_type: "contrast",
  text_color: <hex>,
  background_color: <hex>,
  contrast_ratio: <computed ratio, e.g. "3.2:1">,
  required_ratio: <"4.5:1" or "3:1">,
  text_size_category: <"normal" or "large">,
  result: <"PASS" or "FAIL">
}
```

---

### Step 4 — Font Size Checks

While walking the node tree in Step 3, also check each `TEXT` node's `fontSize`:

- Flag any text node with `fontSize < 12` as a potential accessibility concern (too small to read reliably on most screens).
- This is not a direct WCAG criterion but is a widely-used UX heuristic and flagged as a warning.

Record each flagged node:

```
{
  element_name: <layer name>,
  node_id: <node ID>,
  issue_type: "font-size",
  current_value: <fontSize in px>,
  required_value: "12px minimum recommended",
  result: "WARNING"
}
```

---

### Step 5 — iOS Dynamic Type Simulation

Clone the source frame 12 times — once for each Dynamic Type step.

For each clone:

1. Use the Figma MCP write tool to duplicate `source_node_id`.
2. Walk the cloned node tree and multiply every `TEXT` node's `fontSize` by the step's multiplier (see iOS Dynamic Type Scale Reference table). Round to the nearest 0.5px.
3. Rename the cloned frame: `[source_frame_name] — iOS [Step Name]`
   Example: `Home Screen — iOS AX3`
4. Record the clone's node ID.

After all 12 clones are created:

5. Create a new page in the Figma file named: `Accessibility — iOS Dynamic Type`
6. Move all 12 cloned frames to that page.
7. Arrange them in two rows of 6, left to right in step order (xSmall through AX5), with 40px gaps between frames.

---

### Step 6 — Android Font Scaling Simulation

Clone the source frame 4 times — once for each Android scale breakpoint.

For each clone:

1. Duplicate `source_node_id`.
2. Multiply every `TEXT` node's `fontSize` by the scale multiplier (1.00, 1.30, 1.50, 2.00).
3. Rename the cloned frame: `[source_frame_name] — Android [Scale]%`
   Example: `Home Screen — Android 150%`
4. Record the clone's node ID.

After all 4 clones are created:

5. Create a new page named: `Accessibility — Android Font Scale`
6. Move all 4 cloned frames to that page.
7. Arrange them in a single row, left to right in scale order (100% → 200%), with 40px gaps.

---

### Step 7 — Generate the Inline Report

Present the full findings in the plugin panel. Use the following format:

```
Accessibility check complete for: [source_frame_name]
Checked against: WCAG 2.1 Level AA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total issues found: [N]
  Contrast failures (FAIL): [N]
  Font size warnings (WARNING): [N]

Pages created:
  Accessibility — iOS Dynamic Type
  Accessibility — Android Font Scale

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTRAST ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[For each contrast FAIL:]
  FAIL  [element_name] (node: [node_id])
        Text color: [hex]  |  Background: [hex]
        Ratio: [computed]:1  |  Required: [threshold]:1
        Size: [normal / large text]

[If no contrast failures:]
  All text nodes pass WCAG 2.1 AA contrast.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONT SIZE WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[For each font size WARNING:]
  WARN  [element_name] (node: [node_id])
        Font size: [N]px  |  Recommended minimum: 12px

[If no font size warnings:]
  All text nodes meet the 12px minimum size recommendation.
```

---

### Step 8 — Optional: Write Report Frame to Figma (Conditional)

After presenting the inline report, ask:

```
Would you like me to write a report frame to an "Accessibility" page in the Figma file?
This creates a permanent record of the findings directly on the canvas. (yes / no)
```

If the designer says **yes**:

1. Check whether an `Accessibility` page already exists in the file. If not, create it.
2. Create a new frame on the `Accessibility` page titled: `A11y Report — [source_frame_name] — [YYYY-MM-DD]`
3. Inside the report frame, create text frames containing:
   - Report header: file name, frame audited, date, standard (WCAG 2.1 AA)
   - Summary counts
   - Full contrast issues table (element name, node ID, text color, background, ratio, required, pass/fail)
   - Full font size warnings table (element name, node ID, current size, recommended minimum)
   - Note about the iOS and Android simulation pages

Style the report frame with:
   - White background
   - Font: any sans-serif available in the file (Inter, Roboto, or SF Pro preferred)
   - Headers at 18px bold, body at 14px regular
   - Fail items in red (`#D32F2F`), warning items in amber (`#F57C00`), pass items in green (`#388E3C`)

If the designer says **no**, conclude without writing to canvas.

---

### Step 9 — Final Report

After all steps complete, present a closing summary:

```
Audit complete.

Frame audited: [source_frame_name] (node: [source_node_id])
Standard: WCAG 2.1 AA

Contrast issues: [N] (FAIL)
Font size warnings: [N] (WARNING)

iOS simulation page: Accessibility — iOS Dynamic Type
  https://www.figma.com/design/<file_key>/?page-id=<ios_page_id>

Android simulation page: Accessibility — Android Font Scale
  https://www.figma.com/design/<file_key>/?page-id=<android_page_id>

[If report frame written:]
Accessibility report frame written to: Accessibility page
  Frame: A11y Report — [source_frame_name] — [date]
```

---

## Layout Simulation Note

**Auto-layout frames** will reflow correctly during iOS and Android text scaling simulation — their content will expand to accommodate larger text sizes, making overflow problems visible as intended.

**Absolutely-positioned text nodes** (those not inside an auto-layout frame) will overlap surrounding elements when scaled up. This is expected behavior that reveals real layout breakage. Review these overlaps manually — they indicate places where the design does not adapt to larger text.

This note should be included in any report frame written to the canvas.

---

## Error Handling

If any individual step fails, do not abort the entire skill run silently. Log the failure inline and continue.

| Error | Likely Cause | What to Say |
|---|---|---|
| Cannot resolve background color for a text node | Background is a gradient, image, or unfilled frame | "Could not determine background for '[node_name]' (node: [node_id]). Skipping contrast check — manual review required." |
| Text node `fontSize` is `null` or `0` | Mixed font sizes or unsupported text node type | "Font size could not be read for '[node_name]'. Skipping size check." |
| Frame clone fails | MCP write tool error or file permissions | "Could not clone frame for [iOS/Android] simulation. Error: [message]. Continuing with remaining steps." |
| Page creation fails | Duplicate page name or plan-tier restriction | "Could not create page '[page name]'. Error: [message]. Simulation frames were not moved." |
| Report frame write fails | MCP write tool error | "Could not write the report frame to the Accessibility page. The inline report above contains all findings." |

---

## Handoff

After a successful run, update `plugin/templates/agent-handoff.md`:

```yaml
---
active_file_key: "<file_key>"
active_project_name: "<derived from file or prior context>"
last_skill_run: "accessibility-check"
open_items:
  - "Accessibility audit complete for: [source_frame_name] (node: [source_node_id])"
  - "Contrast failures: <N> — designer action required"
  - "Font size warnings: <N> — designer review recommended"
  - "iOS Dynamic Type simulation on page: Accessibility — iOS Dynamic Type"
  - "Android font scale simulation on page: Accessibility — Android Font Scale"
---
```
