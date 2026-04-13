---
name: code-connect
description: Find Figma components that are missing Code Connect mappings and publish them after designer review.
argument-hint: "[figma-file-key] — optional. If omitted, the agent reads from handoff context or prompts."
context: fork
agent: general-purpose
---

# Skill: /code-connect

Find Figma components that are missing Code Connect mappings and publish them after designer review.

---

## Prerequisites

- **Active Figma file open** — The agent needs the Figma file key for the project. This is read from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Local codebase present** — Component source files must exist locally (e.g., installed via `/create-component` or checked in to the project repo). The agent searches the filesystem by component name to find matching files.
- **Figma MCP connector authenticated** — The primary path uses `mcp__claude_ai_Figma__*` tools. No separate PAT configuration is required for the MCP path.
- **Organization-tier Figma account** — Required to publish Code Connect mappings.

---

## Agent Instructions

### Step 1 — Resolve the active Figma file key

1. Check `$ARGUMENTS` first — if a Figma file URL or key was passed directly (e.g. `/code-connect figma.com/design/abc123/...`), extract and use it.
2. If no argument was provided, check `plugin/templates/agent-handoff.md` for the `active_file_key` field.
3. If neither is available, ask the designer:

   > "What is the Figma file key for this project?
   > You can find it in the Figma URL: `figma.com/design/**{fileKey}**/...`"

### Step 2 — Get Code Connect suggestions

Call `mcp__claude_ai_Figma__get_code_connect_suggestions` with the resolved file key.

This returns a list of Figma components in the file that do not yet have Code Connect mappings.

- If the tool returns an empty list (all components are already mapped), report: "All components in this file already have Code Connect mappings. No action needed." and exit.
- If the tool returns one or more unmapped components, proceed to Step 3.

### Step 3 — Gather context for each unmapped component

For each unmapped component returned in Step 2:

1. Call `mcp__claude_ai_Figma__get_context_for_code_connect` with the component's node ID and file key.
2. This returns the component's name, variant properties, documented props, and any existing annotations.
3. Store the returned context alongside the component name for use in Step 4.

### Step 4 — Search the codebase for matching component files

For each unmapped Figma component:

1. Derive a search term from the Figma component name (e.g., Figma component `Button` → search for files named `button.tsx`, `Button.tsx`, `button/index.tsx`, etc.).
2. Search the local filesystem under `components/`, `src/components/`, and `app/components/` (common shadcn/ui install paths) for matching files.
3. If a match is found, associate the local file path with the Figma component.
4. If no match is found, mark the component as `unmatched` — it will be listed in the final report but excluded from the proposed mappings.

### Step 5 — Generate Code Connect mapping entries

For each matched component pair (Figma component + local file):

1. Using the component context from Step 3 and the matched file path from Step 4, generate a Code Connect mapping entry in the format expected by `mcp__claude_ai_Figma__send_code_connect_mappings`.
2. Each mapping entry must include:
   - Figma component node ID
   - Local component file path (relative to project root)
   - Prop mappings — map Figma variant properties to component props where names align (e.g., Figma variant `size: sm | md | lg` → code prop `size: "sm" | "md" | "lg"`)
   - A usage example snippet showing how to import and render the component

### Step 6 — Present proposed mappings for designer review

Display the proposed mappings as a structured summary. For each mapping, show:

- Figma component name and node ID
- Matched local file path
- Mapped props (if any)
- Usage example

Then ask: "Do these mappings look correct? Reply 'yes' to publish, or list any component names you want to skip or correct before publishing."

- Wait for explicit confirmation before proceeding.
- If the designer requests corrections, update the relevant mappings as instructed and re-present the corrected list for a final confirmation.
- If the designer declines entirely, exit without publishing.

### Step 7 — Publish Code Connect mappings

On designer confirmation:

Call `mcp__claude_ai_Figma__send_code_connect_mappings` with the confirmed mapping payload.

- If the publish call succeeds, record the number of mappings published.
- If the publish call fails (auth error, validation error, etc.), display the full error message and suggest corrective action (see "CLI Fallback" below if MCP publish is unavailable).

### Step 8 — Report results

Output a summary:

| Component | Status | Notes |
|---|---|---|
| `Button` | Published | 3 prop mappings |
| `Input` | Published | Default mapping only |
| `Card` | Skipped by designer | — |
| `Dialog` | Unmatched | No local file found |

Follow with:
- Total components published: N
- Skipped by designer: N
- Unmatched (no local file found): N (list names — consider running `/create-component` to install missing components)
- Publish errors: N (list errors with full messages)

---

## CLI Fallback

If the MCP path is unavailable (e.g., `send_code_connect_mappings` returns a persistent error, or the Figma MCP connector is not configured in the current session), use the `@figma/code-connect` CLI as a fallback.

### Fallback Steps

1. Confirm `@figma/code-connect` is installed:
   ```bash
   npx @figma/code-connect --version
   ```
   If not installed, run:
   ```bash
   npm install --save-dev @figma/code-connect
   ```

2. Generate Code Connect config files for each matched component:
   ```bash
   npx @figma/code-connect create --component [component-name] --file [figma-file-key]
   ```

3. Review and edit the generated `.figma.tsx` (or `.figma.ts`) files as needed.

4. Publish all mappings using the CLI:
   ```bash
   npx @figma/code-connect connect --token=[PAT]
   ```
   Replace `[PAT]` with a Figma Personal Access Token that has the `code_connect:write` scope (see PAT Scope Note below).

### CLI Scope Note

**The `@figma/code-connect` CLI requires a Figma Personal Access Token (PAT) with `code_connect:write` scope.** This scope is not automatically granted on new PATs — it must be explicitly selected when creating the token in Figma account settings under Security > Personal access tokens.

The MCP path (`send_code_connect_mappings`) handles authentication automatically via the Figma MCP connector configured in Claude Code. No PAT configuration is required for the primary MCP path.

To create a PAT with the correct scope:
1. Open Figma → Account Settings → Security → Personal access tokens.
2. Click "Generate new token."
3. Under "Scopes," enable **Code Connect** → **Write**.
4. Copy the token and use it with `--token=` in the CLI command above.
5. Do not commit the PAT to version control. Use an environment variable (`FIGMA_ACCESS_TOKEN`) or a local `.env` file excluded by `.gitignore`.

---

## Notes

- **Primary path uses Figma MCP tools exclusively.** The `get_code_connect_suggestions` → `get_context_for_code_connect` → `send_code_connect_mappings` sequence handles the full workflow without requiring a PAT or CLI install.
- **Designer confirmation is required before publishing.** The agent will never call `send_code_connect_mappings` without an explicit affirmative response.
- **Prop mapping is best-effort.** The agent maps props by matching Figma variant property names to component prop names. Review the proposed mappings before confirming — manual correction is expected for non-obvious mappings.
- **Unmatched components** are components present in Figma but not found in the local codebase. Running `/create-component [name]` will install the shadcn/ui component and make it available for mapping on the next `/code-connect` run.
