# Labs design-ops plugin

## Project Overview

This project is a skills-based systems operation plugin to enable designers at Detroit Labs to run commands that assist with Figma design tasks.

## Source of Truth

All agents operating in this repo should read `.github/templates/workflow.md` first. That file defines the project goal, ticket lifecycle, GitHub Project board configuration, and key commands.

## Skills

Reusable skills are available in `.claude/skills/`. Each subfolder contains a `SKILL.md` that defines the skill's purpose and usage. Invoke skills via the Skill tool (or `/skill-name` shorthand in Claude Code).

Available skills:
- `new-agent` — Orient a new agent on an existing ticket
- `create-ticket` — Create a bug or work order ticket and sync to GitHub
- `research` — Investigate a ticket's problem domain
- `plan` — Write or refine a plan.md for a ticket
- `build` — Orchestrate the full build phase across all domains
- `code-build` — Execute code implementation work
- `doc-build` — Write or update documentation
- `script-build` — Write automation or shell scripts
- `api-build` — Build API integrations
- `figma-build` — Execute Figma canvas work
- `project-start` — Initialize a new project with this workflow structure
- `vqa` — Run visual and functional QA on completed work
