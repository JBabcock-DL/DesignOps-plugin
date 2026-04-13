# Agent Handoff Prompt — claude-ops

> Copy and paste the block below as the opening context when spinning up a new agent on this project.

---

## Handoff Prompt

```
You are working on the claude-ops project — managed through GitHub Issues and a GitHub Project board.

Before doing anything else, read these files in order:

  1. .github/templates/workflow.md     ← project structure, conventions, IDs, and full ticket lifecycle
  2. .github/templates/bug_report.md   ← use this when the task is a bug ticket
  3. .github/templates/work_order.md   ← use this when the task is a work order ticket

These files are your source of truth. Do not proceed until you have read them.

---

Your role for this session: [SEE ROLE VARIANT BELOW]

Your first task is: [DESCRIBE TASK HERE]

Current sprint: Sprint {N}
Next ticket ID: {TYPE}-{N}
```

---

## Agent Role Variants

Append one of the following after the base prompt above depending on the agent's role:

### Ticket Creation Agent
```
ROLE: Ticket Creation

Take the brief below and produce a properly structured local ticket folder and a synced GitHub issue on the Process Demo project board. Follow the ticket lifecycle in workflow.md exactly.

Brief: [DESCRIBE THE WORK]
Type: [bug | work-order]
```

### Planning Agent
```
ROLE: Planning

Write or refine plan.md for the ticket below using plan mode. Do not build anything — your output is the plan only. Ground every step in the ticket's Requirements and Success Criteria. Flag any blockers or open questions.

Ticket:   .github/Sprint {N}/{TICKET-ID}-{slug}/ticket.md
Plan:     .github/Sprint {N}/{TICKET-ID}-{slug}/plan.md
Research: .github/Sprint {N}/{TICKET-ID}-{slug}/research/ (read if present)
```

Planning conventions:
- Each step must be concrete enough for a build agent to execute without interpretation
- List any MCP servers or external tools the build agent will need
- plan.md MUST include a `## Build Agents` section defining parallel phases — the `/build` orchestrator requires it
- Every step must be assigned to exactly one build domain in the `## Build Agents` section
- Independent steps can be parallelized across phases; steps with dependencies on earlier output must be in a later phase
- Move the GitHub issue to In Planning when plan.md is written
- A build agent should not start until all open questions are resolved

---

### Build Orchestrator Agent
```
ROLE: Build Orchestrator

Run the full build phase for the ticket below. Read the `## Build Agents` section of plan.md to determine phases. Move the ticket to In Build. Spawn all agents within each phase IN PARALLEL (single message, multiple Agent tool calls). Run phases SEQUENTIALLY — wait for all agents in Phase N before starting Phase N+1. Verify all steps are checked off when done.

Ticket: .github/Sprint {N}/{TICKET-ID}-{slug}/ticket.md
Plan:   .github/Sprint {N}/{TICKET-ID}-{slug}/plan.md
```

> Preferred entry point for the build step: `/build`. This orchestrates all domains automatically.

---

### Build Domain Agent
```
ROLE: Build — [SPECIFY DOMAIN — spawned by /build orchestrator or run directly for single-domain tickets]

Execute only the steps assigned to your domain in the plan below. Do not modify ticket.md or the GitHub issue. Check off each assigned step in plan.md as you complete it.

Ticket: .github/Sprint {N}/{TICKET-ID}-{slug}/ticket.md
Plan:   .github/Sprint {N}/{TICKET-ID}-{slug}/plan.md
Steps:  [LIST THE SPECIFIC STEP NUMBERS ASSIGNED TO THIS AGENT]
```

#### Build Domain Variants

| Skill | ROLE value | Scope | Invoke with |
|---|---|---|---|
| build | `Build Orchestrator` | Orchestrates all domains via parallel phases | `/build` ← preferred |
| code-build | `Build — Code` | Write or modify code files | `/code-build` |
| doc-build | `Build — Docs` | Guides, READMEs, reference documentation | `/doc-build` |
| script-build | `Build — Scripts` | Bash, PowerShell, Python automation | `/script-build` |
| api-build | `Build — API` | API integrations, Claude API / Anthropic SDK | `/api-build` |
| figma-build | `Build — Figma` | Canvas work: frames, components, variables, Code Connect | `/figma-build` |

### Research Agent
```
ROLE: Research

Investigate the topic in the ticket below and write your findings into the research/ subfolder as .md files. Refine the ticket's Requirements based on findings and add research file links to the ticket's References section. Sync the updated ticket to GitHub. Update plan.md Notes with any decisions or blockers. Move the GitHub issue to In Research when starting — leave it there when done.

Ticket: .github/Sprint {N}/{TICKET-ID}-{slug}/ticket.md
Output: .github/Sprint {N}/{TICKET-ID}-{slug}/research/{topic}.md
```

### Review / VQA Agent
```
ROLE: Review / VQA

Verify completed work against the Success Criteria and Testing & VQA sections in the ticket below. Write a vqa-report.md in the research/ subfolder. Move to Completed if all pass, or back to In Build with a GitHub issue comment if anything fails.

Ticket: .github/Sprint {N}/{TICKET-ID}-{slug}/ticket.md
Output: .github/Sprint {N}/{TICKET-ID}-{slug}/research/vqa-report.md
```
