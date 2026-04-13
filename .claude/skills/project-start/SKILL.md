---
name: project-start
description: Initialize a new project repo with the full claude-ops workflow structure — folder layout, templates, GitHub labels, and project board. Use when starting a brand new project that should follow this workflow.
argument-hint: "[project-name]"
context: fork
agent: general-purpose
---

You are initializing a new project using the claude-ops workflow system.

Project name: $ARGUMENTS

## Collect missing context

If $ARGUMENTS is empty, ask the user using AskUserQuestion:

- **Project name** — "What is the name of this project?"

Then ask the user using AskUserQuestion:

- **Project goal** — "What is the goal of this project? This will be written into workflow.md as the source-of-truth description for all agents working in this repo."

Do not proceed until both values are confirmed.

Read this file first to understand the full system you are replicating:
.github/templates/workflow.md

Then scaffold the following in the current working directory:

1. Folder structure:
   - .github/templates/
   - .github/Sprint 1/
   - .claude/skills/new-agent/
   - .claude/skills/create-ticket/
   - .claude/skills/research/
   - .claude/skills/plan/
   - .claude/skills/build/
   - .claude/skills/code-build/
   - .claude/skills/doc-build/
   - .claude/skills/script-build/
   - .claude/skills/api-build/
   - .claude/skills/figma-build/
   - .claude/skills/project-start/
   - .claude/skills/vqa/

2. Copy all template files from .github/templates/ into the new project's .github/templates/

3. Copy all skill SKILL.md files from .claude/skills/ into the new project's .claude/skills/

4. Create a CLAUDE.md in the repo root with:
   - Project name
   - Pointer to .github/templates/workflow.md as the source of truth
   - Note that skills are available in .claude/skills/

5. GitHub setup (using gh CLI):
   - Create label: bug (#d73a4a)
   - Create label: work-order (#0075ca)
   - Create a new GitHub Project named "$ARGUMENTS" for the repo owner
   - Determine the new project's **number** (integer) and **owner login** (user or org), e.g. `gh project list --owner <OWNER_LOGIN> --format json` and match on `title` / `number`

5a. **Set up custom status columns** on the new project board — the default GitHub Project board has generic options (Todo, In Progress, Done) that do NOT match our workflow. You must replace them with the correct statuses using the GitHub GraphQL API:

   - Run `gh project field-list <PROJECT_NUMBER> --owner <OWNER_LOGIN> --format json` to get the Status field's node ID (`PVTSSF_...`). The Status field has `"type": "ProjectV2SingleSelectField"`.
   - Call `gh api graphql` with the `updateProjectV2Field` mutation to replace all options with the 6 workflow statuses. Use this exact shape:

   ```
   gh api graphql -f query='
   mutation {
     updateProjectV2Field(input: {
       fieldId: "<STATUS_FIELD_ID>"
       singleSelectOptions: [
         { name: "Context Backlog", color: BLUE,   description: "" }
         { name: "In Research",     color: PURPLE, description: "" }
         { name: "In Planning",     color: YELLOW, description: "" }
         { name: "In Build",        color: ORANGE, description: "" }
         { name: "In Review",        color: RED,    description: "" }
         { name: "Completed",       color: GREEN,  description: "" }
       ]
     }) {
       projectV2Field {
         ... on ProjectV2SingleSelectField {
           id
           options { id name }
         }
       }
     }
   }'
   ```

   - Parse the returned `options` array from the mutation response. For each option, record its `id` keyed by `name`. These are the IDs you will write into `workflow.md` — do not re-query; use the mutation response directly.

6. **You** (the agent) must update `.github/templates/workflow.md` in place—this is not a separate script. Treat the following as your task prompt:

   - Run `gh repo view --json owner,nameWithOwner` from the **new repo root** and record `owner.login` and `nameWithOwner` for the **Key Commands** section.
   - Run `gh project view <PROJECT_NUMBER> --owner <OWNER_LOGIN> --format json` and read `title`, `id` (Project node id), and `number`.
   - Use the Status field ID and the 6 option IDs captured from the mutation in step 5a — do not run field-list again.
   - Open `.github/templates/workflow.md` and **edit the file**: replace every `[CONFIGURE: ...]` placeholder under **## GitHub Project** and inside the **Key Commands** `bash` block with the real values (project title, `PVT_…` project id, owner, status field id, each status option id, project number, full `owner/repo`). Use the exact string values returned by `gh`; do not invent IDs.
   - Replace the `[ADD YOUR GOAL HERE]` placeholder under **## Project Goal** with the project goal provided by the user.
   - Re-read the updated sections and confirm there are **no** remaining `[CONFIGURE:` tokens in **## GitHub Project** or that **Key Commands** block, and no `[ADD YOUR GOAL HERE]` placeholder remaining, before you finish.

7. **Create two starter tickets** using the Skill tool. Do this only after step 6 is complete and `workflow.md` has no unresolved `[CONFIGURE: ...]` tokens.

   Use the Skill tool exactly as follows — do not invent titles, do not create GitHub issues yourself, do not add anything to the project board yourself. The `create-ticket` skill handles all of that.

   First call — pass this argument string exactly:
   ```
   wo "Configure project goal in workflow.md"
   ```

   Wait for it to complete and confirm a ticket folder was created under `.github/Sprint 1/` before continuing.

   Second call — pass this argument string exactly:
   ```
   bug "Sample bug report"
   ```

   Wait for it to complete. Both tickets must appear in `.github/Sprint 1/` with a `ticket.md`, `plan.md`, a GitHub issue number, and a project board item ID before you proceed to step 8.

8. Report back:
   - Folder structure created
   - GitHub labels created
   - Project board name, number, and node id
   - Confirmation that `.github/templates/workflow.md` was edited and the GitHub Project / Key Commands placeholders are fully resolved
   - Reminder: do not create tickets until that workflow file has no unresolved `[CONFIGURE: ...]` in those sections
   - **Manual step required — Board view:** GitHub's API does not expose a mutation for creating project views. After setup is complete, the user must add the Board view manually:
     1. Open the project on GitHub
     2. Click **+ New view** (tab row at the top)
     3. Select **Board**
     The 6 status columns will appear automatically since the Status field is already configured.
