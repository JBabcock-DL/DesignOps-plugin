# Phase 07 — Offer design system initialization

## Goal
Offer `/create-design-system` and chain into it with the correct Figma file key. Prefer updating **`templates/agent-handoff.md` in the user’s local workspace** (each teammate’s clone or project checkout — nothing is shared unless they commit it). If that file is missing or not writable, fall back to invoking **`/create-design-system --file-key …`** so the flow still works from a read-only plugin install.

## Prerequisites
- Phase 06 presented to the user.
- **Foundations `fileKey`** from Step 4 and **Project Name** from Step 1.

## Placeholders
Substitute real values for `<Foundations file key>`, `<Project Name>`, and `<key>` in the YAML and commands below.

## Instructions
No `use_figma`. Follow the step text exactly.

## Step 7 — Offer Design System Initialization

After presenting the result, call AskUserQuestion:

> "Would you like to run /create-design-system now to populate the Foundations file with your brand tokens? (yes / no)"

Wait for the reply. If the designer responds **yes**:

1. **Write handoff when possible** — Try to write `templates/agent-handoff.md` at the **repository root** with the YAML below. This is **local to that machine’s checkout**; it helps `/create-design-system` (and later `/create-component` / `/code-connect`) resolve the file and paths with fewer prompts. If the write fails (read-only install, sandbox, or no template file), skip to step 2 only with `--file-key`.

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

2. **Invoke `/create-design-system`**
   - If the handoff write **succeeded**, invoke `/create-design-system` with **no** file-key argument. Step 1 of that skill will read `active_file_key` from handoff and ask **"Use this file?"** — the designer should reply **yes**.
   - If the handoff write **failed or was skipped**, invoke:

     ```
     /create-design-system --file-key <Step 4 fileKey>
     ```

3. Briefly confirm which path was used (handoff vs `--file-key`).

If the designer responds **no**, conclude the skill run. Remind them they can run `/create-design-system` anytime (with optional `--file-key`, or after filling handoff locally).
