---
active_file_key: ""
active_project_name: ""
last_skill_run: ""
variable_slot_catalog_path: ""
open_items: []
---

# Agent Handoff

This document is the standardized context transfer template for the DesignOps Plugin. When one skill invocation concludes and a subsequent skill needs to pick up where it left off, populate this file and pass it to the next invocation.

## Frontmatter Fields

| Field | Description |
|---|---|
| `active_file_key` | The Figma file key currently being worked on (e.g. `aBcDeFgHiJkL`). Find this in the Figma file URL: `figma.com/design/<file_key>/...` |
| `active_project_name` | The human-readable project name as it appears (or will appear) in the Figma team space (e.g. `Acme Mobile App`). |
| `last_skill_run` | The skill that was last executed (e.g. `new-project`, `create-design-system`). |
| `variable_slot_catalog_path` | Path to `research/variable-slots.md` if the Figma Agent Kit variable slots have been cataloged (required before running `/create-design-system`). Leave empty if Step 6 has not been completed. |
| `open_items` | A list of things the next skill invocation should be aware of — unresolved questions, manual steps the designer still needs to take, or decisions deferred from the previous run. |

## How to Use This Handoff

1. **At the end of a skill run**, populate the frontmatter fields with the current state.
2. **Add any open items** that the next skill needs to know about — be specific (e.g. "Foundations file has not been renamed yet", "Android alias collection was skipped — M3 role mapping needs review").
3. **Pass this file to the next skill invocation** by including it in your Claude Code prompt:
   ```
   /create-design-system web
   # or: /create-design-system all
   Context: see plugin/templates/agent-handoff.md
   ```
4. **The receiving agent** should read this file first, incorporate the open items into its execution plan, and update the frontmatter before it concludes.

## Example — Populated Handoff

```yaml
---
active_file_key: "aBcDeFgHiJkLmNoP"
active_project_name: "Acme Mobile App"
last_skill_run: "new-project"
variable_slot_catalog_path: ""
open_items:
  - "Foundations file created and page-scaffolded in Drafts — designer still needs to move it to Design-Systems/ in the team."
  - "Designer confirmed web platform only for this project — skip android and ios alias collections."
  - "Brand primary color: #E63946. All other tokens use Tailwind defaults."
---
```

## Open Items (Current Run)

- None
