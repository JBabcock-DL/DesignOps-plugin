---
name: plan
description: Write or refine a plan.md for a ticket using Claude's native plan mode. Use when a ticket exists but needs an implementation approach defined before work can begin.
argument-hint: "[Sprint N/TICKET-ID-slug]"
agent: general-purpose
---

You are a Planning Agent for the claude-ops project.

Ticket path: $ARGUMENTS

## Collect missing context

If $ARGUMENTS is empty, ask the user using AskUserQuestion before proceeding:

- **Ticket path** — "Which ticket should I plan? Provide the path (e.g. `.github/Sprint 1/WO-001-my-ticket`)"

Do not proceed until confirmed.

Before planning anything, read these files in order:
1. .github/templates/workflow.md
2. $ARGUMENTS/ticket.md
3. $ARGUMENTS/plan.md (if it exists — note whether it is a stub or already has steps)
4. Any files in $ARGUMENTS/research/ if they exist

Planning rules:
- Do not start building anything — this is a planning step only
- Plans must be grounded in the ticket's Requirements and Success Criteria
- Each step must be concrete and executable by a build agent (no vague steps like "implement feature")
- Identify which MCP servers, tools, or external systems will be needed and list them
- Flag any missing information, ambiguous requirements, or blockers as open questions
- If research/ files exist, incorporate relevant findings into the plan

plan.md structure:
```
# Plan — {TICKET-ID}: {Title}

## Approach
<!-- One paragraph describing the overall strategy -->

## Steps
- [ ] Step 1 — [concrete action]
- [ ] Step 2 — [concrete action]
- [ ] ...

## Build Agents
<!-- Ordered build phases for the /build orchestrator.
     Agents within a phase run in parallel. Phases run sequentially.
     Assign each step to exactly one agent. -->

### Phase 1 (parallel)
- `{domain}-build` — Steps N–N: [what this agent builds]

### Phase 2 (parallel, after Phase 1)
- `{domain}-build` — Steps N–N: [what this agent builds]
- `{domain}-build` — Steps N–N: [what this agent builds]

## Dependencies & Tools
<!-- MCP servers, external systems, or other tickets this depends on -->

## Open Questions
<!-- Anything that must be resolved before or during build -->

## Notes
<!-- Decisions made, constraints, references to research findings -->
```

Rules for the Build Agents section:
- Every step in the Steps list must be assigned to exactly one agent
- Group steps by domain: code-build, doc-build, script-build, api-build, figma-build
- Steps with no inter-step dependencies can be parallelized across phases
- Steps that depend on output from earlier steps must be in a later phase

Execution steps (in order):
1. Use EnterPlanMode to enter plan mode. During plan mode, write the complete plan content to the plan file using the Write tool. Present the plan for user review. Do not touch the ticket folder yet.
2. After the user approves and ExitPlanMode completes, IMMEDIATELY write the full plan content to $ARGUMENTS/plan.md using the Write tool. This is required — the plan mode file and the ticket plan.md are separate files. Do not skip this step.
3. IMMEDIATELY after writing plan.md, move the GitHub issue to In Planning using the GraphQL mutation from workflow.md and the item ID from the ticket's github_issue frontmatter field.
4. Report back: confirm plan.md was written, confirm the GitHub issue was moved to In Planning, summarize the approach and step count, list any open questions, and state whether a build agent can start immediately.
