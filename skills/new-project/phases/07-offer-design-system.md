# Phase 07 — Offer design system initialization

## Goal
Offer `/create-design-system`, optionally write `templates/agent-handoff.md`, and invoke the next skill.

## Prerequisites
- Phase 06 presented to the user.

## Placeholders
Use real `<Foundations file key>` and `<Project Name>` in the YAML when writing the handoff.

## Instructions
No `use_figma`. Follow the step text exactly (AskUserQuestion, handoff path, chain or decline).

## Step 7 — Offer Design System Initialization

After presenting the result, call AskUserQuestion:

> "Would you like to run /create-design-system now to populate the Foundations file with your brand tokens? (yes / no)"

Wait for the reply. If the designer responds **yes**:

1. **Write the handoff file first** — populate `templates/agent-handoff.md` (repository root) with the fields below before invoking the next skill. This ensures `create-design-system` picks up the correct file and does not prompt for a new key.

   ```yaml
   ---
   active_file_key: "<Foundations file key>"
   active_project_name: "<Project Name>"
   last_skill_run: "new-project"
   variable_slot_catalog_path: ""
   token_css_path: ""
   open_items:
     - "Foundations file is ready for /create-design-system — file key: <key>"
     - "File is in Drafts — user needs to move it to Design-Systems/ in their team."
   ---
   ```

2. **Invoke `/create-design-system`** — no arguments needed. The skill reads `active_file_key` from the handoff and will ask "Use this file?" — the designer should confirm with **yes**.

If the designer responds **no**, conclude the skill run. Remind them they can run `/create-design-system` at any time — it will read the file key from the handoff automatically.

