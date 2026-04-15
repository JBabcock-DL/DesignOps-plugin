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
- **Figma MCP connector authenticated** — The primary MCP path uses `mcp__claude_ai_Figma__*` tools and requires no PAT. If `get_code_connect_suggestions` returns empty after two retries (common on Professional/Starter plans), the skill automatically escalates to the CLI path (Step 3b).
- **Figma Personal Access Token (CLI path only)** — Required only when the CLI path is used. The PAT must have `Code Connect → Write` scope. The designer creates it during Step 3b-3; it is not needed up front.

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

### Step 3 — Enumerate components via design context

> **Why not `get_code_connect_suggestions`?**  
> `get_code_connect_suggestions` only surfaces components that already have _some_ Code Connect metadata attached (partial mappings, stale links, etc.). It returns empty for net-new components that have never been mapped — which is the normal state after `/create-component`. Use `get_design_context` to enumerate components directly instead.

Call `mcp__claude_ai_Figma__get_design_context` with the resolved file key.

Walk the returned node tree and collect every node whose type is `COMPONENT` or `COMPONENT_SET`. For each, record:
- `nodeId` (the node ID, used in the Code Connect URL)
- `name` (the component name as it appears in Figma)
- `variantProperties` (if present — the variant dimension names and their allowed values)

If the file has no `COMPONENT` or `COMPONENT_SET` nodes, call **AskUserQuestion**: "No components were found in this file. Components must be drawn to the canvas first — run `/create-component` and then re-run `/code-connect`." Then exit.

If `get_design_context` is unavailable or returns an error, fall through to the **CLI path** (Step 3b).

### Step 3b — CLI path (escalation when MCP tools are unavailable)

Use this path when `get_design_context` returns an error or is unavailable, or when `send_code_connect_mappings` returns a persistent error.

#### 3b-1 — Collect component node IDs from Figma

The CLI needs a Figma URL with a node ID for each component to map. For each component the designer wants to wire:

Call `mcp__claude_ai_Figma__get_design_context` on the target file to enumerate top-level components. Extract each component's `nodeId`. If `get_design_context` is unavailable, call **AskUserQuestion**:
> "I need the Figma node IDs for each component to wire up Code Connect. In Figma, right-click each component frame → Copy link. Paste all the links here, one per line."

Parse each URL to extract the node ID from the `node-id=` query parameter (URL-decode `%3A` → `:`).

#### 3b-2 — Install the CLI

Check whether `@figma/code-connect` is installed:
```bash
npx figma connect --version
```
If the command fails, install it:
```bash
npm install --save-dev @figma/code-connect
```

#### 3b-3 — Get a PAT from the designer

Call **AskUserQuestion**:
> "The CLI path needs a Figma Personal Access Token with **Code Connect → Write** scope to publish mappings.
>
> To create one:
> 1. Open Figma → Account Settings → Security → Personal access tokens
> 2. Click **Generate new token**
> 3. Under Scopes, enable **Code Connect → Write**
> 4. Copy the token and paste it here.
>
> (The token is used only for this publish step and is not saved anywhere.)"

Store the token as `FIGMA_PAT` for the publish command. Do not log it.

#### 3b-4 — Search the codebase for matching component files

For each component to wire:
1. Derive a search term from the component name (e.g., `Button` → look for `button.tsx`, `Button.tsx`, `button/index.tsx`).
2. Search under `components/`, `src/components/`, and `app/components/`.
3. Mark unmatched components — they will be skipped.

#### 3b-5 — Generate `.figma.tsx` files

For each matched component, write a `.figma.tsx` file alongside the component source file.

The file must follow this structure — adjust props to match the actual component interface:

```tsx
import figma from '@figma/code-connect'
import { {ComponentName} } from './{ComponentName}'

figma.connect(
  {ComponentName},
  'https://www.figma.com/design/{TARGET_FILE_KEY}?node-id={NODE_ID}',
  {
    props: {
      // Map Figma variant properties to component props.
      // Use figma.enum() for variant props, figma.boolean() for toggles,
      // figma.string() for text layer content.
      // Example:
      // variant: figma.enum('Variant', { default: 'default', secondary: 'secondary' }),
      // disabled: figma.boolean('Disabled'),
    },
    example: (props) => <{ComponentName} {...props} />,
  }
)
```

Rules for prop mapping:
- Read the component's TypeScript interface (or JSDoc) from the matched source file to know available props.
- Match Figma variant property names to component prop names where they align (case-insensitive).
- Use `figma.enum()` for string union props; `figma.boolean()` for boolean props; `figma.string()` for text content.
- If a Figma property has no matching code prop, omit it rather than guessing.

Present all generated `.figma.tsx` file contents to the designer before writing. Call **AskUserQuestion**: "Here are the proposed Code Connect files. Reply **yes** to write them, or paste corrections."

On confirmation, write each file to disk.

#### 3b-6 — Publish

Run:
```bash
npx figma connect publish --token={FIGMA_PAT}
```

- If publish succeeds, proceed to Step 9 (results report).
- If publish fails with an auth error, the PAT may be missing the `code_connect:write` scope — show the error and ask the designer to regenerate the token with the correct scope.
- If publish fails with a node-not-found error, the component node ID may be wrong or the library may not be published — show the error and the affected node ID.

### Step 4 — Gather Code Connect context for each component

For each component collected in Step 3:

1. Call `mcp__claude_ai_Figma__get_context_for_code_connect` with the component's `nodeId` and file key.
2. This returns richer metadata: documented props, interaction annotations, any existing partial Code Connect config.
3. Merge this with the `variantProperties` already captured from `get_design_context`.
4. Store the combined context alongside the component name for use in Step 5.

If `get_context_for_code_connect` fails for a specific component, fall back to the variant properties from Step 3 alone — do not skip the component.

### Step 5 — Search the codebase for matching component files

For each Figma component:

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

## CLI Path Notes

The CLI path (Step 3b) uses `npx figma connect publish` from the `@figma/code-connect` package.

Key commands:
```bash
# Check CLI is available
npx figma connect --version

# Publish all .figma.tsx files found in the project
npx figma connect publish --token=<PAT>

# Unpublish mappings (if needed)
npx figma connect unpublish --token=<PAT>
```

**PAT scope required:** `Code Connect → Write`. The MCP path (`send_code_connect_mappings`) does not need a PAT — it uses the Figma MCP connector's OAuth session. Only the CLI path requires a PAT.

Do not commit the PAT. If the project has a `.env` file, store it there as `FIGMA_ACCESS_TOKEN` and pass `--token=$FIGMA_ACCESS_TOKEN` instead.

---

## Notes

- **Library must be published before this skill can run.** Step 2 is an explicit gate — the agent displays publish instructions and waits for confirmation before calling any Figma Code Connect API. Skipping this step causes `get_code_connect_suggestions` to return empty results or stale data.
- **Figma library indexing delay.** After publishing, Figma can take up to 60 seconds to index components. Step 3 handles the retry loop if `get_code_connect_suggestions` comes back empty immediately after publishing.
- **Primary path uses Figma MCP tools exclusively.** The `get_design_context` → `get_context_for_code_connect` → `send_code_connect_mappings` sequence handles the full workflow without a PAT or CLI. `get_code_connect_suggestions` is not used — it only surfaces components with pre-existing Code Connect metadata, not net-new components.
- **Designer confirmation is required before publishing.** The agent will never call `send_code_connect_mappings` without an explicit affirmative response.
- **Prop mapping is best-effort.** The agent maps props by matching Figma variant property names to component prop names. Review the proposed mappings before confirming — manual correction is expected for non-obvious mappings.
- **Unmatched components** are components present in Figma but not found in the local codebase. Running `/create-component [name]` will install the shadcn/ui component and make it available for mapping on the next `/code-connect` run.
