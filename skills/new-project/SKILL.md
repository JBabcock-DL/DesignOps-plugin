---
name: new-project
description: Scaffold a new Detroit Labs Foundations design system file via the Figma MCP, creating the file in Drafts with the full page hierarchy from the Detroit Labs Foundations template.
argument-hint: "Optional: --team \"Team Name\" --name \"Project Name\" --platform web|android|ios|all|skip. All arguments are optional — any that are omitted will be prompted interactively."
agent: general-purpose
---

# /new-project

You are scaffolding a new Detroit Labs Foundations design system file in Figma.

> **Before drawing anything on canvas, `Read` [`../create-design-system/CONVENTIONS.md`](../create-design-system/CONVENTIONS.md)** — it defines the canvas geometry (1800px-wide `_Header` + `_PageContent`, 40px padding on TOC/Token Overview, 80px padding on style-guide pages), the page list (**no `↳ MCP Tokens`**), and naming conventions. `/new-project` scaffolds the chrome so `/create-design-system` can later redraw matching widths.

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

1. `Read` `skills/new-project/phases/05-scaffold-pages.md` before running the script.
2. Before every `use_figma` in this skill: load the **figma-use** skill if your environment requires it (see [templates/workflow.md](../../templates/workflow.md)).
3. Call `use_figma` **once** with the Step 4 `fileKey` and the JavaScript from that phase file.

### After Step 5 succeeds — progress checklist (required)

Immediately after the Step 5 `use_figma` succeeds, show the checklist below in chat. After **each** later phase succeeds, **repost the entire checklist** with updated `[x]` markers and advance the `Current:` line. Do not paste phase scripts into these progress messages. If a phase fails, leave its box `[ ]`, add a one-line note, `Read` that phase file again, and retry **only** that phase — never check later items until earlier ones succeed.

**Progress (`/new-project`)**

Current: Step 5c — Table of Contents

- [x] Step 5 — Scaffold page hierarchy
- [ ] Step 5c — Table of Contents layout
- [ ] Step 5b — Documentation headers
- [ ] Step 5d — Token Overview skeleton
- [ ] Step 5e — Cover on Thumbnail
- [ ] Step 5c-links — TOC hyperlinks
- [ ] Step 6 — Report + move instruction
- [ ] Step 7 — Offer `/create-design-system`

### Documentation and wrap-up (strict order)

Mandatory order: **5c → 5b → 5d → 5e → 5c-links → Step 6 → Step 7**.

**Why this order:** Step 5c draws the Table of Contents layout (no links). Step 5b creates the shared `_Header` and `_Content` on pages. Steps 5d and 5e build Token Overview and the Thumbnail `Cover`. Step **5c-links runs last** so the Thumbnail row can link to `Cover` and every other row links to that page’s `_Header`.

For each row below, in order:

1. `Read` the phase file path.
2. Apply placeholder rules inside that file (`PROJECT_NAME`, `FILE_KEY` where noted — project name from Step 1, file key from Step 4).
3. Run **at most one** `use_figma` when the phase file contains a fenced `javascript` block; Steps 6–7 follow their files without `use_figma`.
4. On success, repost the **Progress** checklist with the matching line checked and `Current:` set to the **next** phase (or “Complete” after Step 7).

| Order | Phase | `Read` path (repository root) |
|------|--------|------|
| 5c | Table of Contents layout | `skills/new-project/phases/05c-table-of-contents.md` |
| 5b | Documentation headers | `skills/new-project/phases/05b-documentation-headers.md` |
| 5d | Token Overview skeleton | `skills/new-project/phases/05d-token-overview.md` |
| 5e | Cover on Thumbnail page | `skills/new-project/phases/05e-cover-thumbnail.md` |
| 5c-links | TOC URL hyperlinks | `skills/new-project/phases/05f-toc-hyperlinks.md` |
| 6 | Report + move instruction | `skills/new-project/phases/06-report-and-move.md` |
| 7 | Offer `/create-design-system` | `skills/new-project/phases/07-offer-design-system.md` |

---

## Error Handling

| Error | Likely Cause | What to Say |
|---|---|---|
| `create_new_file` fails | MCP connector session expired or no active plan found. | "File creation failed. Please ensure the Figma MCP connector is active (Settings → MCP → Figma → Reconnect) and re-run `/new-project`." |
| `use_figma` page scaffold fails (Step 5) | File not yet accessible after creation. | "Page scaffolding failed. The file was created — open it in Figma and the pages can be added manually. File URL: https://www.figma.com/design/<fileKey>/" |
| `use_figma` doc headers fail (Step 5b) | Font loading error or page navigation issue. | "Header drawing failed on one or more pages. The file and pages were created successfully — headers can be added manually or by re-running Step 5b." |
| `use_figma` TOC fails (Step 5c) | Page not found or text node creation error. | "Table of Contents drawing failed. The page exists — content can be added manually or by re-running Step 5c." |
| `use_figma` TOC links fail (Step 5c-links) | Missing `FILE_KEY` in the URL, hyperlink rejected on a text node, or no `_Header` / `Cover` target on a page. | "TOC hyperlinks failed — confirm `FILE_KEY` was substituted, then re-run Step 5c-links after Steps 5b and 5e." |
| `use_figma` token overview fails (Step 5d) | Frame or text creation error. | "Token Overview skeleton drawing failed. The page exists — content can be added manually or by re-running Step 5d." |
| `use_figma` cover fails (Step 5e) | Font load error or frame/text creation error. | "Cover drawing failed. The Thumbnail page exists — add or fix the `Cover` frame manually on that page." |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured and authenticated | Required for `create_new_file` and `use_figma`. Re-authenticate at: Settings → MCP → Figma → Reconnect. |
| Team and Design-Systems/ project folder exist in Figma | The move instruction in Step 6 guides the user to create the folder if needed. |

---

## Page Structure Reference

The following pages are sourced directly from the Detroit Labs Foundations template (`rJQsr4aou5yjzUhaEM0I2f`) and hardcoded in `skills/new-project/phases/05-scaffold-pages.md`. To update them, run `use_figma` on the template file with `figma.root.children.map(p => p.name)` and replace the `pages` array in that phase file.

**Sections:**
- Thumbnail
- Table of Contents (Token Overview)
- Style Guide (Primitives, Theme, Layout, Text Styles, Effects)
- Brand Assets (Logo Marks, Vector Patterns, Icons, Imagery, Motion)
- Atoms (Typography, Text blocks, Label, Kbd, Dividers, Avatar, Badge, Chips, Tags, Counters, Aspect Ratio)
- Buttons & Controls (Buttons, Button Group, Toggle, Toggle Group, Segmented Controller) — component pages populated later by `/create-component`; see [`skills/create-component/CONVENTIONS.md` §3.3](../create-component/CONVENTIONS.md) for the drawing spec
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

## Chaining to `/create-design-system`

Step 7 **writes `templates/agent-handoff.md` locally** when the workspace allows it (each user’s own clone — not shared across the team unless committed). Then invoke `/create-design-system`. If the file cannot be written, use **`/create-design-system --file-key <Step4FileKey>`** instead. See `skills/new-project/phases/07-offer-design-system.md`.
