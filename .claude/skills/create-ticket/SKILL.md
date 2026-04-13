---
name: create-ticket
description: Create a new bug or work order ticket locally and sync it to the GitHub Project board. Use when creating a new ticket, issue, or task for the project.
argument-hint: "[bug|wo] [title in quotes]"
context: fork
agent: general-purpose
---

You are creating a new ticket for the claude-ops project.

Arguments received: $ARGUMENTS
- $0 = ticket type (bug or wo)
- $1 = ticket title

Before doing anything, read these files in order:
1. .github/templates/workflow.md
2. .github/templates/bug_report.md (if $0 is "bug")
3. .github/templates/work_order.md (if $0 is "wo")

## Collect missing context

Parse $ARGUMENTS for ticket type ($0) and title ($1). For any value not provided, ask the user using AskUserQuestion before proceeding:

- **Type** — "What type of ticket is this? (bug or wo)"
- **Title** — "What is the ticket title?"

Do not proceed until both values are confirmed.

Then execute the full ticket lifecycle from workflow.md:

1. Determine the current sprint folder and next sequential ticket ID by checking what already exists under .github/Sprint */
2. Generate the ticket slug from the title (lowercase, hyphenated, max 5 words)
3. Create the folder: .github/Sprint {N}/{TICKET-ID}-{slug}/
4. Write ticket.md using the correct template — populate all sections based on the title provided. Set github_issue and project_item_id frontmatter fields to TBD for now.
5. Write a stub plan.md
6. Create the GitHub issue using gh CLI with the correct label (bug or work-order)
7. Capture the issue number and update the github_issue field in ticket.md
8. Add the issue to the project board using the project number and owner from the **Key Commands** section of workflow.md; capture the returned project item ID (PVTI_...)
9. Update the project_item_id field in ticket.md with the captured project item ID
10. Report back: ticket folder path, GitHub issue URL, and project item ID
