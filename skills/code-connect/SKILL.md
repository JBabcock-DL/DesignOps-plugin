---
name: code-connect
description: Find Figma components that are missing Code Connect mappings and publish them after designer review.
argument-hint: "[figma-file-key] — optional. If omitted, the agent reads from handoff context or prompts."
agent: general-purpose
---

# Skill: /code-connect

Find Figma components that are missing Code Connect mappings and publish them after designer review.

---

## Interactive input contract

When you need a Figma file key or publish confirmation, use **AskUserQuestion** — **one question per tool call**. Wait for each answer before the next. Do not print multiple questions as plain markdown before the first AskUserQuestion.

---

## Prerequisites

- **Active Figma file open** — The agent needs the Figma file key for the project. This is read from the handoff context (`plugin/templates/agent-handoff.md`) or prompted from the designer.
- **Library published** — Components must be published to a Figma team library before Code Connect can map them. The Figma REST API does not support programmatic publishing — the designer must publish manually from the Figma UI. See Step 2 for the exact steps and the agent gate.
- **Local codebase present** — Component source files must exist locally (e.g., installed via `/create-component` or checked in to the project repo). The agent searches the filesystem by component name to find matching files.
- **Figma MCP connector authenticated** — The primary path uses `mcp__claude_ai_Figma__*` tools. No separate PAT configuration is required for the MCP path.
- **Organization-tier Figma account** — Required to publish Code Connect mappings.

---

## Agent Instructions

### Step 1 — Resolve the active Figma file key

1. Check `$ARGUMENTS` first — if a Figma file URL or key was passed directly (e.g. `/code-connect figma.com/design/abc123/...`), extract and use it.
2. If no argument was provided, check `plugin/templates/agent-handoff.md` for the `active_file_key` field.
3. If neither is available, call **AskUserQuestion**: "What is the Figma file key for this project? (Segment after `figma.com/design/` in the URL.)"

### Step 2 — Gate: confirm the library is published

Code Connect requires every component to be published to a Figma team library. The Figma REST API has no endpoint for programmatic publishing — this must be done manually in the Figma UI. Do not call `get_code_connect_suggestions` until the designer confirms the library is published; the tool returns no results (or unreliable results) for unpublished components.

Display the following instructions as a markdown block, then call **AskUserQuestion**:

---

> **Before Code Connect can run, publish the Foundations file as a team library.**
>
> 1. Open the Foundations file in Figma (file key: `{TARGET_FILE_KEY}`)
> 2. Click the **main menu** (☰ top-left) → **"Publish styles and components…"**
> 3. In the publish dialog, review the components listed — confirm your Button, Badge, and any other components created by `/create-component` appear in the list.
> 4. Click **Publish** (or **Publish changes** if re-publishing).
> 5. Wait for the "Published" confirmation toast in Figma.
>
> Once published, reply **done** to continue — or **skip** if this file is already published.

---

Call **AskUserQuestion**:
> "Reply **done** once the library is published in Figma, or **skip** if it was already published."

- If the designer replies **done** or **skip**, proceed to Step 3.
- If the designer replies with a question or an error, answer it and call **AskUserQuestion** again — do not proceed until they explicitly confirm.

### Step 3 — Get Code Connect suggestions

Call `mcp__claude_ai_Figma__get_code_connect_suggestions` with the resolved file key.

This returns a list of Figma components in the file that do not yet have Code Connect mappings.

- If the tool returns an empty list, it may mean all components are already mapped **or** the library is still being indexed by Figma (indexing can take up to 60 seconds after publishing). Call **AskUserQuestion**: "The component list came back empty. If you just published, Figma may still be indexing — wait 30–60 seconds and reply **retry**. Or reply **done** if all components are already mapped."
  - On **retry**, repeat the `get_code_connect_suggestions` call. If it returns results, proceed. If empty again, report that no unmapped components were found and exit.
  - On **done**, report "All components in this file already have Code Connect mappings. No action needed." and exit.
- If the tool returns one or more unmapped components, proceed to Step 4.

### Step 4 — Gather context for each unmapped component

For each unmapped component returned in Step 3:

1. Call `mcp__claude_ai_Figma__get_context_for_code_connect` with the component's node ID and file key.
2. This returns the component's name, variant properties, documented props, and any existing annotations.
3. Store the returned context alongside the component name for use in Step 5.

### Step 5 — Search the codebase for matching component files

For each unmapped Figma component:

1. Derive a search term from the Figma component name (e.g., Figma component `Button` → search for files named `button.tsx`, `Button.tsx`, `button/index.tsx`, etc.).
2. Search the local filesystem under `components/`, `src/components/`, and `app/components/` (common shadcn/ui install paths) for matching files.
3. If a match is found, associate the local file path with the Figma component.
4. If no match is found, mark the component as `unmatched` — it will be listed in the final report but excluded from the proposed mappings.

### Step 6 — Generate Code Connect mapping entries

For each matched component pair (Figma component + local file):

1. Using the component context from Step 4 and the matched file path from Step 5, generate a Code Connect mapping entry in the format expected by `mcp__claude_ai_Figma__send_code_connect_mappings`.
2. Each mapping entry must include:
   - Figma component node ID
   - Local component file path (relative to project root)
   - Prop mappings — map Figma variant properties to component props where names align (e.g., Figma variant `size: sm | md | lg` → code prop `size: "sm" | "md" | "lg"`)
   - A usage example snippet showing how to import and render the component

### Step 7 — Present proposed mappings for designer review

Display the proposed mappings as a structured summary. For each mapping, show:

- Figma component name and node ID
- Matched local file path
- Mapped props (if any)
- Usage example

Then call **AskUserQuestion**: "Do these mappings look correct? Reply **yes** to publish, **no** to cancel, or list component names to skip or correct before publishing."

- Wait for explicit confirmation before proceeding.
- If the designer requests corrections, update the relevant mappings as instructed and re-present the corrected list, then call **AskUserQuestion** again for final confirmation.
- If the designer declines entirely, exit without publishing.

### Step 8 — Publish Code Connect mappings

On designer confirmation:

Call `mcp__claude_ai_Figma__send_code_connect_mappings` with the confirmed mapping payload.

- If the publish call succeeds, record the number of mappings published.
- If the publish call fails with a "component not found" or "unpublished component" error, the library may not have finished indexing. Call **AskUserQuestion**: "The publish call returned a component-not-found error. Wait 60 seconds and reply **retry**, or reply **skip** to skip the failing component." On retry, re-attempt `send_code_connect_mappings`. On skip, remove that component from the payload and re-attempt without it.
- For all other errors (auth, validation, etc.), display the full error message and suggest corrective action (see "CLI Fallback" below if MCP publish is unavailable).

### Step 9 — Report results

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

- **Library must be published before this skill can run.** Step 2 is an explicit gate — the agent displays publish instructions and waits for confirmation before calling any Figma Code Connect API. Skipping this step causes `get_code_connect_suggestions` to return empty results or stale data.
- **Figma library indexing delay.** After publishing, Figma can take up to 60 seconds to index components. Step 3 handles the retry loop if `get_code_connect_suggestions` comes back empty immediately after publishing.
- **Primary path uses Figma MCP tools exclusively.** The `get_code_connect_suggestions` → `get_context_for_code_connect` → `send_code_connect_mappings` sequence handles the full workflow without requiring a PAT or CLI install.
- **Designer confirmation is required before publishing.** The agent will never call `send_code_connect_mappings` without an explicit affirmative response.
- **Prop mapping is best-effort.** The agent maps props by matching Figma variant property names to component prop names. Review the proposed mappings before confirming — manual correction is expected for non-obvious mappings.
- **Unmatched components** are components present in Figma but not found in the local codebase. Running `/create-component [name]` will install the shadcn/ui component and make it available for mapping on the next `/code-connect` run.
