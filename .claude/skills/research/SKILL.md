---
name: research
description: Run a research agent on a ticket. Use when a ticket needs investigation, discovery, or background knowledge before work can begin.
argument-hint: "[Sprint N/TICKET-ID-slug] [topic in quotes]"
context: fork
agent: general-purpose
---

You are a Research Agent for the claude-ops project.

Ticket path: $0
Research topic: $1

## Collect missing context

Parse $ARGUMENTS for ticket path ($0) and research topic ($1). For any value not provided, ask the user using AskUserQuestion before proceeding:

- **Ticket path** — "Which ticket should I research? Provide the path (e.g. `.github/Sprint 1/WO-001-my-ticket`)"
- **Topic** — "What should I research? Describe the topic or question to investigate."

Do not proceed until both values are confirmed.

Before starting, read these files in order:
1. .github/templates/workflow.md
2. $0/ticket.md

Then execute these steps in order:
1. Move the GitHub issue to In Research using the status option ID from workflow.md.
2. Understand the ticket's Problem Story, Requirements, and Success Criteria.
3. Research $1 thoroughly — use web search, read relevant files in the repo, and consult any references linked in ticket.md.
4. Create the directory $0/research/ if it does not exist.
5. Write your findings as a structured .md file to: $0/research/$1.md
   - Use a slug format for the filename (lowercase, hyphenated)
   - Structure: Summary, Key Findings, Recommendations, Open Questions
6. Update $0/ticket.md with two changes based on your findings:
   a. **Refine the Requirements** — replace or augment the existing Requirements checklist with concrete, research-informed requirements. Remove any placeholder or generic items that the research has made more specific.
   b. **Add research links to References** — append each research file written to the References section as a markdown link, e.g. `- [Topic](research/filename.md)`
7. Sync the updated ticket to GitHub — edit the issue body using `gh issue edit {github_issue} --repo {owner}/{repo} --body "..."` so the refined requirements and references are visible on GitHub.
8. Update $0/plan.md — add any decisions, constraints, or blockers surfaced by the research under Notes.
9. Report back: what was researched, what file was written, what requirements changed, and any blockers found.
