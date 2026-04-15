---
name: new-project
description: Scaffold a new Detroit Labs Foundations design system file via the Figma MCP, creating the file in Drafts with the full page hierarchy from the Detroit Labs Foundations template.
argument-hint: "Optional: --team \"Team Name\" --name \"Project Name\" --platform web|android|ios|all|skip. All arguments are optional — any that are omitted will be prompted interactively."
agent: general-purpose
---

# /new-project

You are scaffolding a new Detroit Labs Foundations design system file in Figma.

Your first action is to collect the required inputs using AskUserQuestion — do not output any text before the first AskUserQuestion call.

> **Platform note:** Figma's public REST API does not support creating project folders or moving files between projects. The file is created in Drafts via the Figma MCP connector and page structure is built automatically. The user receives a single move instruction at the end to place it into the correct project folder. Do not attempt any REST API calls for folder creation or file moves.

---

## Step 1 — Collect Project Details

Parse `$ARGUMENTS` for `--team`, `--name`, and `--platform`. For each value not already provided, call AskUserQuestion. Ask one at a time and wait for each reply before asking the next.

**If `--team` is missing**, call AskUserQuestion:
> "What is the name of the Figma team this project lives under? (Used for file titles.)"

**If `--name` is missing**, call AskUserQuestion:
> "What is the project name? (e.g. `Acme Mobile App`) This will appear in the title of every file created."

**If `--platform` is missing**, call AskUserQuestion:
> "What is the primary platform for this project?
> - **web** — Next.js / React (Tailwind token collection)
> - **android** — Android / Compose (Material 3 collection)
> - **ios** — iOS / SwiftUI (Apple HIG collection)
> - **all** — All platforms (web + android + ios)
> - **skip** — Set up the design system separately later"

Use the Project Name verbatim in all file titles — do not normalize or reformat it.

---

## Step 2 — Confirm the File

Before creating anything, show the user what will be created and ask for confirmation. Wait for their reply before proceeding.

> Here is what I will create for "\<Project Name\>" in the "\<Team Name\>" team:
>
> | File | Figma Type | Target Folder |
> |---|---|---|
> | \<Project Name\> — Foundations | Design | Design-Systems/ |
>
> The file will be created in your Drafts with the full Detroit Labs Foundations page hierarchy pre-built. You'll get a single move instruction at the end to place it in your Design-Systems/ project folder.
>
> Shall I proceed? (yes / no / edit)

If the designer responds `edit` or requests a change, update the plan and re-present. Only continue to Step 3 after receiving an explicit `yes`.

---

## Step 3 — Get Plan Key

Call `whoami` to retrieve the available plans. If the user has one plan, use its `key` field automatically. If multiple plans exist, call AskUserQuestion:
> "I found multiple Figma plans on your account. Which team or organization should I create the file under?"

Store the selected value as `PLAN_KEY`.

---

## Step 4 — Create the Foundations File

Call `create_new_file`:
```
fileName: "<Project Name> — Foundations"
editorType: "design"
planKey: PLAN_KEY
```

Capture the returned `fileKey`. This is the file you will scaffold in Step 5.

---

## Step 5 — Scaffold the Page Hierarchy

Immediately call `use_figma` with the `fileKey` from Step 4. This creates the full page hierarchy matching the Detroit Labs Foundations template exactly.

```javascript
const pages = [
  // ── Meta ──────────────────────────────────────────
  "Thumbnail",

  // ── Token & Style Docs ────────────────────────────
  "---",
  "📝 Table of Contents",
  "↳ Token Overview",
  "↳ MCP Tokens",

  // ── Style Guide ───────────────────────────────────
  "---",
  "🖍️ Style Guide",
  "↳ Primitives",
  "↳ Theme",
  "↳ Layout",
  "↳ Text Styles",
  "↳ Effects",

  // ── Brand ─────────────────────────────────────────
  "---",
  "🖼️ Brand Assets",
  "↳ Logo Marks",
  "↳ Vector Patterns",
  "↳ Icons",
  "↳ Imagery",
  "↳ Motion",

  // ── Atoms ─────────────────────────────────────────
  "---",
  "⚛️ Atoms",
  "↳ Typography",
  "↳ Text blocks",
  "↳ Label",
  "↳ Kbd",
  "↳ Dividers",
  "↳ Avatar",
  "↳ Badge",
  "↳ Chips",
  "↳ Tags",
  "↳ Counters",
  "↳ Aspect Ratio",

  // ── Buttons & Controls ────────────────────────────
  "---",
  "🔘 Buttons & Controls",
  "↳ Buttons",
  "↳ Button Group",
  "↳ Toggle",
  "↳ Toggle Group",
  "↳ Segmented Controller",

  // ── Inputs & Forms ────────────────────────────────
  "---",
  "📝 Inputs & Forms",
  "↳ Text Field",
  "↳ Textarea",
  "↳ Number Input",
  "↳ Input Group",
  "↳ Input OTP",
  "↳ Checkbox",
  "↳ Radio",
  "↳ Switch",
  "↳ Select",
  "↳ Native Select",
  "↳ Combobox",
  "↳ Slider",
  "↳ Keypad",
  "↳ Image Select",
  "↳ Calendar",
  "↳ Date Picker",
  "↳ Field",
  "↳ Form Composite Groups",

  // ── Feedback & Status ─────────────────────────────
  "---",
  "💬 Feedback & Status",
  "↳ Alerts",
  "↳ Toast",
  "↳ Sonner",
  "↳ Notifications",
  "↳ Progress Bar",
  "↳ Progress Dial",
  "↳ Loaders",
  "↳ Skeleton",
  "↳ Spinner",
  "↳ Blank states",
  "↳ Error States",

  // ── Overlays ──────────────────────────────────────
  "---",
  "🗂️ Overlays",
  "↳ Dialogue",
  "↳ Drawer",
  "↳ Sheets",
  "↳ Sheet Sockets",
  "↳ Popover",
  "↳ Hover Card",
  "↳ Tooltips",
  "↳ Context Menu",
  "↳ Dropdown Menu",
  "↳ Command",

  // ── Navigation ────────────────────────────────────
  "---",
  "🧭 Navigation",
  "↳ Top Navigation",
  "↳ Bottom Navigation",
  "↳ Tablet Navigation",
  "↳ Sidebar",
  "↳ Navigation Menu",
  "↳ Menubar",
  "↳ Action bars",
  "↳ Tabs bar",
  "↳ Breadcrumb",
  "↳ Pagination",
  "↳ Intra-app Navigation",

  // ── Data Display ──────────────────────────────────
  "---",
  "📊 Data Display",
  "↳ Data Table",
  "↳ Lists",
  "↳ Chart",
  "↳ Stat block",
  "↳ Widgets",
  "↳ Video player",

  // ── Content Containers ────────────────────────────
  "---",
  "🗃️ Content Containers",
  "↳ Cards",
  "↳ Tiles",
  "↳ Select Tile",
  "↳ Carousel",
  "↳ Scroll Area",
  "↳ Accordion",
  "↳ Collapsible",
  "↳ Resizable",

  // ── Native & Platform ─────────────────────────────
  "---",
  "📱 Native & Platform",
  "↳ Native Device Parts",

  // ── Utility ───────────────────────────────────────
  "---",
  "Documentation components",
  "Grids",
  "parking lot"
];

// Rename the default first page rather than deleting it
figma.root.children[0].name = pages[0];

// Create remaining pages in order
for (let i = 1; i < pages.length; i++) {
  const page = figma.createPage();
  page.name = pages[i];
}
```

---

## Step 6 — Report Result and Move Instruction

Present the result and move instruction:

```
✅ Foundations file created for "<Project Name>".

| File | Target Folder | URL |
|---|---|---|
| <Project Name> — Foundations | Design-Systems/ | https://www.figma.com/design/<fileKey>/ |

**One last step — move the file into your team project folder:**

1. Open Figma and go to your Drafts
2. Right-click **<Project Name> — Foundations** → Move to Project
3. Select your team's **Design-Systems/** project
   (If Design-Systems/ doesn't exist yet, right-click your team → New Project → name it "Design-Systems" first)
```

---

## Step 7 — Offer Design System Initialization

After presenting the result, call AskUserQuestion:

> "Would you like to run /create-design-system now to populate the Foundations file with your brand tokens? (yes / no)"

Wait for the reply. If the designer responds **yes**, invoke the `/create-design-system` skill:
- Pass the Foundations `fileKey` as the active file context.
- Use `plugin/templates/agent-handoff.md` to carry state: set `active_file_key` to the Foundations file key, `active_project_name` to the Project Name, and `last_skill_run` to `new-project`.
- If platform is `all`, invoke `/create-design-system all`.
- If platform is a single value (`web`, `android`, or `ios`), pass it directly.
- If platform is `skip`, prompt the designer for a platform before proceeding.

If the designer responds **no**, conclude the skill run. Remind them they can run `/create-design-system` at any time by passing the Foundations file key.

---

## Error Handling

| Error | Likely Cause | What to Say |
|---|---|---|
| `create_new_file` fails | MCP connector session expired or no active plan found. | "File creation failed. Please ensure the Figma MCP connector is active (Settings → MCP → Figma → Reconnect) and re-run `/new-project`." |
| `use_figma` page scaffold fails | File not yet accessible after creation. | "Page scaffolding failed. The file was created — open it in Figma and the pages can be added manually. File URL: https://www.figma.com/design/<fileKey>/" |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured and authenticated | Required for `create_new_file` and `use_figma`. Re-authenticate at: Settings → MCP → Figma → Reconnect. |
| Team and Design-Systems/ project folder exist in Figma | The move instruction in Step 6 guides the user to create the folder if needed. |

---

## Page Structure Reference

The following pages are sourced directly from the Detroit Labs Foundations template (`rJQsr4aou5yjzUhaEM0I2f`) and hardcoded in Step 5. To update them, run `use_figma` on the template file with `figma.root.children.map(p => p.name)` and replace the array in Step 5.

**Sections:**
- Thumbnail
- Table of Contents (Token Overview, MCP Tokens)
- Style Guide (Primitives, Theme, Layout, Text Styles, Effects)
- Brand Assets (Logo Marks, Vector Patterns, Icons, Imagery, Motion)
- Atoms (Typography, Text blocks, Label, Kbd, Dividers, Avatar, Badge, Chips, Tags, Counters, Aspect Ratio)
- Buttons & Controls (Buttons, Button Group, Toggle, Toggle Group, Segmented Controller)
- Inputs & Forms (Text Field, Textarea, Number Input, Input Group, Input OTP, Checkbox, Radio, Switch, Select, Native Select, Combobox, Slider, Keypad, Image Select, Calendar, Date Picker, Field, Form Composite Groups)
- Feedback & Status (Alerts, Toast, Sonner, Notifications, Progress Bar, Progress Dial, Loaders, Skeleton, Spinner, Blank states, Error States)
- Overlays (Dialogue, Drawer, Sheets, Sheet Sockets, Popover, Hover Card, Tooltips, Context Menu, Dropdown Menu, Command)
- Navigation (Top Navigation, Bottom Navigation, Tablet Navigation, Sidebar, Navigation Menu, Menubar, Action bars, Tabs bar, Breadcrumb, Pagination, Intra-app Navigation)
- Data Display (Data Table, Lists, Chart, Stat block, Widgets, Video player)
- Content Containers (Cards, Tiles, Select Tile, Carousel, Scroll Area, Accordion, Collapsible, Resizable)
- Native & Platform (Native Device Parts)
- Documentation components, Grids, parking lot

---

## File Naming Convention

All file titles follow this pattern: `<Project Name> — <File Type>`

The separator is an **em dash** (`—`, Unicode U+2014) with a single space on each side — not a hyphen or double-dash.

---

## Handoff

At the end of a successful run, populate `plugin/templates/agent-handoff.md`:

```yaml
---
active_file_key: "<Foundations file key>"
active_project_name: "<Project Name>"
last_skill_run: "new-project"
variable_slot_catalog_path: ""
open_items:
  - "Foundations file is ready for /create-design-system — file key: <key>"
  - "File is in Drafts — user needs to move it to Design-Systems/ in their team."
---
```
