---
id: WO-002
title: Add Design Ops Skills
type: work-order
sprint: 1
status: Context Backlog
github_issue: 3
project_item_id: PVTI_lAHOD9B30s4BUhODzgp0je4
---

## Problem Story

As a Detroit Labs designer, I need a library of design ops skills available in the DesignOps plugin so that I can run commands that assist with Figma design tasks efficiently and consistently.

## Hypothesis

We believe that building a set of skills-based design ops commands for designers at Detroit Labs will streamline their Figma workflows and reduce manual, repetitive tasks. We'll know we're right when designers can invoke a skill from the plugin and complete a design ops task without leaving Figma or switching tools.

## Requirements

### Shared Infrastructure
- [ ] Build a plugin UI shell with skill routing, settings storage (`figma.clientStorage`), and Figma PAT management
- [ ] Define and document the Detroit Labs canonical design token schema (color, typography, spacing, radius) before building token-dependent skills
- [ ] Implement a Variables API wrapper (Plugin API + REST API) shared by `/new-project`, `/create-design-system`, and `/sync-design-system`
- [ ] Implement shared frame/node traversal utilities used by `/new-language` and `/accessibility-check`

### `/new-project`
- [ ] Scaffold a new Figma file with DL-standard pages (Foundations, Components, Master Files) using `figma.createFrame()` and `figma.createComponent()`
- [ ] Create a base variable collection using `figma.variables.createVariableCollection()` for token scaffolding
- [ ] Drive structure from a version-controlled JSON project template config
- [ ] Confirm canonical DL project structure with designers before implementation

### `/create-design-system [web|android|ios]`
- [ ] Accept `web`, `android`, or `ios` as the platform argument
- [ ] For `web`: map Tailwind CSS v3/v4 tokens (color, spacing, typography) into Figma variables and styles
- [ ] For `android`: map Material Design 3 tokens into Figma variables; support export to Kotlin/Compose format via Style Dictionary
- [ ] For `ios`: map Apple HIG color and typography tokens; support Dynamic Type scale mapping
- [ ] Implement an interactive plugin UI wizard to collect brand colors, fonts, and spacing if not supplied
- [ ] Use `figma.variables.createVariable()` and `figma.createTextStyle()` / `figma.createPaintStyle()` to push tokens to canvas

### `/sync-design-system`
- [ ] Read current Figma variables via `figma.variables.getLocalVariablesAsync()` or REST `GET /v1/files/:key/variables/local`
- [ ] Compare against a code-side token source (tokens.json / Tailwind config)
- [ ] Because the plugin sandbox cannot read local files, implement a companion Node.js CLI script to perform the diff and call the Figma REST API
- [ ] Present diff results in the plugin UI with options to push changes to Figma or to code
- [ ] Handle conflict detection when both Figma and code have diverged on the same token

### `/create-component [component types]`
- [ ] Accept a list of shadcn/ui component names as arguments
- [ ] Document prerequisite: the official shadcn/ui Figma community kit must be manually duplicated into the project before running the skill (community files cannot be imported programmatically)
- [ ] Place, rename, and apply token bindings to components on the Figma canvas
- [ ] Optionally invoke Code Connect CLI or MCP to link components to codebase files after placement

### `/code-connect`
- [ ] Use Figma MCP tools (`get_code_connect_suggestions`, `get_context_for_code_connect`, `send_code_connect_mappings`) to find and publish missing Code Connect mappings
- [ ] Alternatively, invoke the `@figma/code-connect` CLI via a companion script for non-MCP environments
- [ ] Require a Figma PAT with `code_connect:write` scope; surface clear error if PAT is missing or insufficient
- [ ] List unmapped components and prompt confirmation before publishing

### `/new-language [language]`
- [ ] Accept a language/locale string as input (e.g., `es`, `fr`, `ar`)
- [ ] Duplicate the selected frame to a new page named for the target language using `node.clone()` and `figma.createPage()`
- [ ] Traverse all text nodes (`figma.currentPage.findAll`) and list them for translation
- [ ] Phase 1: scaffold only (no auto-translate). Phase 2: integrate a translation API (DeepL or Google Translate) as an enhancement
- [ ] Flag RTL languages (Arabic, Hebrew, Urdu) and warn the designer about layout mirroring requirements

### `/accessibility-check`
- [ ] Check all text/fill pairs in the selected frame for WCAG 2.1 AA contrast ratios using the Plugin API (`node.fills`, `node.strokes`)
- [ ] Check text node sizes against WCAG minimum font size and weight requirements
- [ ] Simulate iOS Dynamic Type scaling: clone the frame and apply each of the 12 Dynamic Type size steps to all text nodes
- [ ] Simulate Android font scaling: clone the frame and apply scale factors (100%, 130%, 150%, 200%) to text nodes
- [ ] Generate an inline accessibility report in the plugin panel with pass/fail per element
- [ ] Optionally write a report frame to a dedicated "Accessibility" page in the Figma file

## Success Criteria

- [ ] All defined design ops skills are implemented and callable from the plugin
- [ ] Each skill produces the expected output for a given set of inputs
- [ ] Skills are documented and discoverable by plugin users

## Testing & VQA

### Functional
- [ ] Each skill can be invoked without errors in the plugin environment

### Visual / Design QA
- [ ] Skill outputs that affect the Figma canvas render correctly
- [ ] No unintended side effects on existing Figma file structure
- [ ] Skill UI/UX (if any) matches design intent

### Accessibility
- [ ] Any skill-generated UI elements meet accessibility standards
- [ ] Skill commands are keyboard accessible
- [ ] Error messages are clear and actionable

## References

<!-- Figma links, related issues, documentation, or design tokens -->
- Related: WO-001 (configure project goal & workflow)
- [WO-002 Research Findings](research/WO-002.md)
- [Figma Plugin API Reference](https://developers.figma.com/docs/plugins/api/api-reference/)
- [Figma Variables REST API](https://developers.figma.com/docs/rest-api/)
- [Figma Code Connect Docs](https://developers.figma.com/docs/code-connect/)
- [Code Connect MCP Integration](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/)
- [shadcn/ui Figma Kit](https://ui.shadcn.com/docs/figma)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [Material Design 3 Tokens](https://m3.material.io/foundations/design-tokens/how-to-use-tokens)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
