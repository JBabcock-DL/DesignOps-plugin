---
name: new-project
description: Scaffold a new Detroit Labs Figma project by duplicating the standard template files into the correct team folder hierarchy (Strategy/, Design-Systems/, Master-Files/).
argument-hint: "Optional: --team \"Team Name\" --name \"Project Name\" --platform web|android|ios|all|skip. All arguments are optional — any that are omitted will be prompted interactively."
agent: general-purpose
---

# /new-project

You are scaffolding a new Detroit Labs Figma project.

Your first action is to collect the required inputs using AskUserQuestion — do not output any text before the first AskUserQuestion call.

## Step 1 — Collect Project Details

Parse `$ARGUMENTS` for `--team`, `--name`, and `--platform`. For each value not already provided, call AskUserQuestion. Ask one at a time and wait for each reply before asking the next.

**Always ask first — PAT is required before any API calls can proceed.** Call AskUserQuestion:
> "I need a Figma Personal Access Token to create project folders and files via the Figma REST API. To generate one: Figma → Account Settings → Security → Personal access tokens → Generate new token.
>
> **Required scopes:** File content (read + write), Projects (read + write), and Teams (read).
>
> Please paste your token here."

Store the token as `FIGMA_PAT`. Use it as a Bearer token in all REST API calls: `Authorization: Bearer <FIGMA_PAT>`.

**If `--team` is missing**, call AskUserQuestion:
> "What is the exact name of the Figma team this project lives under? (Case-sensitive — must match exactly as it appears in Figma.)"

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

#---

## Step 2 — Confirm the File List

Before creating anything, show the user the full file list and ask for confirmation. Wait for their reply before proceeding.

Present the following table (substituting the actual Project Name and Team Name). The Masterfile rows are conditional — only include the rows for platforms the user selected:

Here is the full list of files I will create for "\<Project Name\>" in the "\<Team Name\>" team:

| # | File Title | Figma Type | Folder | Source |
|---|---|---|---|---|
| 1 | \<Project Name\> — Discovery Workshop | FigJam | Strategy/ | Clone from template |
| 2 | \<Project Name\> — Discovery Summary | Slides | Strategy/ | Clone from template |
| 3 | \<Project Name\> — Wireframes | Design | Strategy/ | New blank file |
| 4 | \<Project Name\> — Foundations | Design | Design-Systems/ | Clone from template |
| 5 _(if platform = ios or all)_ | \<Project Name\> — iOS Masterfile | Design | Master-Files/ | Clone from template |
| 6 _(if platform = android or all)_ | \<Project Name\> — Android Masterfile | Design | Master-Files/ | Clone from template |
| 7 _(if platform = web or all)_ | \<Project Name\> — Web Masterfile | Design | Master-Files/ | Clone from template |

Omit any Masterfile row whose platform condition is not met. If platform is `skip`, omit all three Masterfile rows.

Shall I proceed? (yes / no / edit)

If the designer responds `edit` or requests a change, update the plan and re-present the table. Only continue to Step 3 after receiving an explicit `yes`.

---

### Step 3 — Resolve the Team and Project Folder IDs

Use the Figma MCP tool `get_metadata` (or `use_figma`) to look up the team ID for the named team. You need the team ID to create project folders via the REST API.

Use the Figma REST API to list existing projects in the team:

```
GET /v1/teams/:team_id/projects
```

Check whether `Strategy`, `Design-Systems`, and `Master-Files` folders already exist. If they do, record their project IDs. If any folder does not exist, create it:

```
POST /v1/teams/:team_id/projects
Body: { "name": "Strategy" }
POST /v1/teams/:team_id/projects
Body: { "name": "Design-Systems" }
POST /v1/teams/:team_id/projects
Body: { "name": "Master-Files" }
```

Record the project ID for each folder. You will need these IDs when placing duplicated files.

---

### Step 4 — Clone Template Files

For each of the template-based files, call the Figma REST API duplicate endpoint via `use_figma` or the REST connector.

**Do not use `team_id` in the duplicate body — it does not place the file in a project folder. Instead, resolve the project IDs in Step 3 first and pass `project_id` directly so the file lands in the correct folder in one call.**

```
POST /v1/files/:templateKey/duplicate
```

Use the following request body for each call:

```json
{
  "name": "<Project Name> — <File Title>",
  "project_id": "<resolved project ID for this file's folder>"
}
```

If the Figma API does not accept `project_id` on the duplicate endpoint (returns 400 or ignores it), fall back to the two-step move:
1. Duplicate with just `name` in the body — the file lands in Drafts.
2. Immediately move it using:
   ```
   PUT /v1/files/:new_file_key
   Body: { "name": "<Project Name> — <File Title>", "project_id": "<folder_project_id>" }
   ```
   **You must include `name` in every PUT body — omitting it silently clears the file name on some Figma API versions and the move may be ignored.**

Execute template clones in this order. Masterfile rows are conditional — only clone the files whose platform condition is met:

| # | Title | Template Key | Project Folder | Condition |
|---|---|---|---|---|
| 1 | `<Project Name> — Discovery Workshop` | `hnCK8gpGtxzBoBakRX8QLn` | `Strategy/` project ID | Always |
| 2 | `<Project Name> — Discovery Summary` | `8YBZtQLCnt7sbmlCKpMO1Y` | `Strategy/` project ID | Always |
| 3 | `<Project Name> — Foundations` | `rJQsr4aou5yjzUhaEM0I2f` | `Design-Systems/` project ID | Always |
| 4 | `<Project Name> — iOS Masterfile` | `C9C0XpIdj1WS3klOugVzGM` | `Master-Files/` project ID | platform = `ios` or `all` |
| 5 | `<Project Name> — Android Masterfile` | `C9C0XpIdj1WS3klOugVzGM` | `Master-Files/` project ID | platform = `android` or `all` |
| 6 | `<Project Name> — Web Masterfile` | `C9C0XpIdj1WS3klOugVzGM` | `Master-Files/` project ID | platform = `web` or `all` |

If platform is `skip`, skip all three Masterfile rows entirely.

Record the new file key returned by each duplicate call. You will use these keys to build file URLs in Step 6.

**Verification:** After each duplicate+move, call `GET /v1/projects/:project_id/files` and confirm the new file key appears in the project. If it does not appear, the file is still in Drafts — retry the PUT move before continuing.

---

### Step 5 — Create the Wireframes File (No Template)

The `Strategy/Wireframes` file has no template source. Create a new blank Design file using the Figma REST API:

```
POST /v1/files
Body:
{
  "name": "<Project Name> — Wireframes",
  "project_id": "<Strategy folder project ID>"
}
```

Alternatively, use the Figma MCP tool `create_new_file` if the REST endpoint is unavailable:

```
mcp__claude_ai_Figma__create_new_file
Arguments: { "name": "<Project Name> — Wireframes", "file_type": "design" }
```

If using `create_new_file`, move the resulting file into the `Strategy/` project folder using:

```
PUT /v1/files/:new_file_key
Body: { "name": "<Project Name> — Wireframes", "project_id": "<Strategy project ID>" }
```

**Always include `name` in the PUT body — omitting it may silently clear the file name on some Figma API versions.**

Record the file key of the new Wireframes file.

---

### Step 6 — Report Created File URLs

Once all files have been created, collect each file key and construct the Figma URL:

```
https://www.figma.com/design/<file_key>/
```

Present a results table to the designer. Only include Masterfile rows for platforms that were selected:

```
All files have been created for "<Project Name>" in the "<Team Name>" team.

| File | Folder | URL |
|---|---|---|
| <Project Name> — Discovery Workshop | Strategy/ | https://www.figma.com/design/<key>/ |
| <Project Name> — Discovery Summary | Strategy/ | https://www.figma.com/design/<key>/ |
| <Project Name> — Wireframes | Strategy/ | https://www.figma.com/design/<key>/ |
| <Project Name> — Foundations | Design-Systems/ | https://www.figma.com/design/<key>/ |
| <Project Name> — iOS Masterfile (if created) | Master-Files/ | https://www.figma.com/design/<key>/ |
| <Project Name> — Android Masterfile (if created) | Master-Files/ | https://www.figma.com/design/<key>/ |
| <Project Name> — Web Masterfile (if created) | Master-Files/ | https://www.figma.com/design/<key>/ |
```

---

### Step 7 — Offer Design System Initialization

After presenting the results table, call AskUserQuestion:

> "Would you like to run /create-design-system now to populate the Foundations file with your brand tokens? (yes / no)"

Wait for the reply. If the designer responds **yes**, invoke the `/create-design-system` skill:
- Pass the file key for `<Project Name> — Foundations` as the active file context.
- Use `plugin/templates/agent-handoff.md` to carry state: set `active_file_key` to the Foundations file key, `active_project_name` to the Project Name, and `last_skill_run` to `new-project`.
- If platform is `all`, invoke `/create-design-system all` once with the same Foundations file key in handoff context (that skill runs web → android → ios internally).
- If platform is a single value (`web`, `android`, or `ios`), pass it directly (e.g. `/create-design-system web`). If platform is `skip` or unset, prompt the designer for a platform before proceeding.

If the designer responds **no**, conclude the skill run. Remind them they can run `/create-design-system` at any time by passing the Foundations file key.

---

## Error Handling

If any API call fails, do not abort the entire run silently. Report the failure inline, skip that file, and continue with the remaining files. After completing all remaining steps, show a summary of any failures at the end.

### Common Errors

| Error | Likely Cause | What to Say |
|---|---|---|
| `401 Unauthorized` on any REST call | Missing or invalid PAT. | "The Figma REST API returned a 401. Your Personal Access Token may be missing, expired, or lack the required scope. Please generate a new token (File content + write scope) and re-run `/new-project`." |
| `403 Forbidden` on `POST /v1/files/:key/duplicate` | The authenticated user does not have access to the template file, or the Organization tier is not active. | "I was unable to duplicate the [file title] template (`<key>`). This usually means the Figma MCP connector account does not have access to the source template, or your Figma plan does not permit file duplication via API. Please verify your account tier and that the template is shared with your organization, then retry." |
| `404 Not Found` on the template key | The template file has been moved or deleted. | "The template file for [file title] could not be found (key: `<key>`). The source file may have been deleted or its key may have changed. Please check `plugin/.claude/settings.local.json` and verify the key against the current Figma file." |
| `404 Not Found` on `POST /v1/teams/:team_id/projects` | PAT is missing the Projects write scope — this is the most common cause even on Org accounts. A 404 here does **not** mean the team wasn't found (GET worked) or that the plan is insufficient. | "Project folder creation returned 404. This almost always means the Personal Access Token is missing the **Projects (read + write)** scope. Please regenerate the token with File content, Projects, and Teams scopes enabled, then re-run `/new-project`." |
| `403 Forbidden` on project folder creation | The PAT user does not have Editor access to the team. | "I could not create the '[folder name]' project folder in the '[Team Name]' team. Please verify that your Figma account has Editor access to this team, then retry." |
| `400 Bad Request` on file creation | Malformed request body or unsupported file type for the account tier. | "The request to create [file title] was rejected by Figma. This may indicate a plan limitation or a malformed request. Check the Figma API response for details and retry, or create the file manually in Figma." |
| MCP connector auth error | Figma MCP connector session has expired. | "The Figma MCP connector returned an authentication error. Please re-authenticate the Figma connector in Claude Code settings (Settings → MCP → Figma → Reconnect) and then re-run `/new-project`." |

### Partial Completion

If some files were created successfully and others failed, present the results table with a status column:

```
| File | Folder | Status | URL |
|---|---|---|---|
| <Project Name> — Discovery Workshop | Strategy/ | Created | https://... |
| <Project Name> — Discovery Summary | Strategy/ | FAILED — see error above | — |
| ... | | | |
```

Tell the designer which files need to be created manually or retried.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured | The connector must be active in Claude Code for canvas operations (screenshots, node reads). |
| Figma Personal Access Token (PAT) | Required for all Figma REST API calls (folder creation, file duplication, file moves). Collected interactively at the start of Step 1. Generate at: Figma → Account Settings → Security → Personal access tokens. Required scopes: **File content (read + write)**, **Projects (read + write)**, **Teams (read)**. Missing Projects scope is the most common cause of 404 on project folder creation. |
| Organization-tier Figma account | Required to use the Figma REST Files API `duplicate` endpoint and to create files in team project folders. |
| Team already exists in Figma | The target team must already be created in the Figma organization. This skill creates folders and files within an existing team — it does not create the team itself. |

---

## Template Keys Reference

| Template | File Key | Figma File Type | Destination Folder |
|---|---|---|---|
| Discovery Workshop | `hnCK8gpGtxzBoBakRX8QLn` | FigJam | `Strategy/` |
| Discovery Summary | `8YBZtQLCnt7sbmlCKpMO1Y` | Slides | `Strategy/` |
| Foundations / Agent Kit | `rJQsr4aou5yjzUhaEM0I2f` | Design | `Design-Systems/` |
| Masterfile (iOS / Android / Web) | `C9C0XpIdj1WS3klOugVzGM` | Design | `Master-Files/` |

These keys are also stored in `plugin/.claude/settings.local.json` under `template_file_keys`.

---

## File Naming Convention

All file titles follow this pattern: `<Project Name> — <File Type>`

The separator is an **em dash** (`—`, Unicode U+2014) with a single space on each side — not a hyphen or double-dash. This matches the Detroit Labs Figma naming standard documented in `plugin/workflow.md`.

---

## Handoff

At the end of a successful run, populate `plugin/templates/agent-handoff.md` with the current state so that subsequent skills (e.g. `/create-design-system`) can pick up where this skill left off:

```yaml
---
active_file_key: "<Foundations file key>"
active_project_name: "<Project Name>"
last_skill_run: "new-project"
variable_slot_catalog_path: ""
open_items:
  - "Foundations file is ready for /create-design-system — file key: <key>"
  - "iOS, Android, and Web Masterfiles (whichever were created) duplicated from the same source template — verify naming is correct in Figma before distributing to the team."
---
```
