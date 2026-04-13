# Plan — WO-002: Add Design Ops Skills

## Context

Detroit Labs designers currently have no programmatic way to scaffold Figma projects, set up design systems, sync tokens with code, or run accessibility checks — all these tasks are manual and repeated from scratch each project. This ticket implements seven skill-based commands as a **Claude Code plugin** — a set of SKILL.md instruction files that tell the Claude agent how to perform each design ops task using the Figma MCP server and other available tools. No TypeScript plugin code, no install scripts; installation is handled entirely by Claude Code prompts.

**Plugin file structure target:**
```
plugin/
  .claude/settings.local.json
  .claude-plugin/marketplace.json
  plugin.json
  skills/
    new-project/SKILL.md
    create-design-system/SKILL.md
    sync-design-system/SKILL.md
    create-component/SKILL.md
    code-connect/SKILL.md
    new-language/SKILL.md
    accessibility-check/SKILL.md
  templates/
    agent-handoff.md
  workflow.md
```

**Resolved blockers (from research):**
- Project structure confirmed: `Strategy/`, `Design-Systems/`, `Master-Files/` folder hierarchy
- Token schema: Tailwind-derived primitives + platform alias collections (Web, Android/M3, iOS/HIG)
- Localization: agent-driven inline translation via Claude (no external API needed — agent CAN read filesystem)
- Foundations file: clone foundations-Agent-Kit (`rJQsr4aou5yjzUhaEM0I2f`), then fill variable slots

**Key architectural shift vs. earlier research:** Because this is a Claude Code plugin (not a Figma sandbox plugin), the agent has full filesystem access. This eliminates the companion CLI constraint for `/sync-design-system` — the agent reads local token files directly. All Figma operations use the Figma MCP server (`mcp__claude_ai_Figma__*`) tools.

**One pre-build gate:** Variable slots in the Agent Kit must be cataloged via `get_variable_defs` before `/create-design-system` SKILL.md can be written with correct variable collection names.

---

## Approach

Build in four sequential phases. Phase 1 establishes the plugin scaffold and shared context files. Phase 2 is a short Figma inspection gate to catalog the Agent Kit's variable slots. Phase 3 writes all seven SKILL.md files — most are independent and can be parallelized across multiple doc-build agents. Phase 4 finalizes plugin metadata and handoff docs.

---

## Steps

### Plugin Scaffold
- [x] Step 1 — Write `plugin/plugin.json`: plugin name, description, version, author, skill manifest listing all seven skills with their invocation names and argument schemas
- [x] Step 2 — Write `plugin/.claude-plugin/marketplace.json`: plugin metadata for marketplace listing (name, description, tags, preview)
- [x] Step 3 — Write `plugin/.claude/settings.local.json`: default plugin settings (default team ID, token schema path, preferred platform default — no PAT config needed; auth handled by Figma MCP connector via Claude Code)
- [x] Step 4 — Write `plugin/workflow.md`: plugin-level agent context doc — how the plugin works, skill overview, Figma MCP usage conventions, PAT setup instructions
- [x] Step 5 — Write `plugin/templates/agent-handoff.md`: standardized handoff template for passing context between skill invocations (current file key, active project, last skill run, open variables)

### Pre-build Figma Gate
- [x] Step 6 — **[Live Figma session]** Run `get_variable_defs` on foundations-Agent-Kit (`rJQsr4aou5yjzUhaEM0I2f`); document all variable collections and slot names in `research/variable-slots.md` — this catalog is required input for writing the `/create-design-system` SKILL.md

### Skills
- [x] Step 7 — Write `plugin/skills/new-project/SKILL.md`: instructs agent to (a) prompt for team name and project name, (b) duplicate template files via Figma REST `POST /v1/files/:key/duplicate` using these confirmed file keys: Workshop/FigJam → `hnCK8gpGtxzBoBakRX8QLn`, Summary/Slides → `8YBZtQLCnt7sbmlCKpMO1Y`, Foundations/Design → `rJQsr4aou5yjzUhaEM0I2f`, Master Files → `C9C0XpIdj1WS3klOugVzGM`; (c) place files into the correct team folder hierarchy (`Strategy/`, `Design-Systems/`, `Master-Files/`); (d) report created file links back to the designer
- [x] Step 8 — Write `plugin/skills/create-design-system/SKILL.md`: instructs agent to (a) accept `web`, `android`, or `ios` argument, (b) prompt for brand tokens (colors, fonts, spacing) if not supplied, (c) map tokens to the correct collection schema (Tailwind → Primitives + Web; M3 → Android alias; HIG → iOS alias), (d) use `get_variable_defs` to verify Agent Kit slot names from `research/variable-slots.md`, (e) push variable collections to the target Figma file using `mcp__claude_ai_Figma__*` write tools
- [x] Step 9 — Write `plugin/skills/sync-design-system/SKILL.md`: instructs agent to (a) read local token file (e.g., `tailwind.config.js`, `tokens.json`) from the filesystem, (b) call Figma Variables REST API to read current Figma variable state, (c) compute diff, (d) present changes to designer with push-to-Figma or push-to-code options, (e) execute the chosen action
- [x] Step 10 — Write `plugin/skills/create-component/SKILL.md`: instructs agent to (a) accept a list of shadcn/ui component names, (b) install components at the local file level via shadcn CLI (`npx shadcn@latest add [component]`) or shadcn MCP, (c) draw component structure to the Figma canvas using Figma MCP write tools, (d) apply token variable bindings, (e) optionally invoke `/code-connect` skill to link components after placement — no manual Figma kit import required
- [x] Step 11 — Write `plugin/skills/code-connect/SKILL.md`: instructs agent to (a) call `get_code_connect_suggestions` MCP tool to list unmapped components, (b) call `get_context_for_code_connect` per component, (c) generate Code Connect mappings, (d) confirm with designer before publishing, (e) call `send_code_connect_mappings` to publish; include note on `@figma/code-connect` CLI as manual fallback
- [x] Step 12 — Write `plugin/skills/new-language/SKILL.md`: instructs agent to (a) accept a locale string (e.g., `es`, `fr`, `ar`), (b) duplicate selected frame to a new Figma page named for the locale, (c) extract all text node strings, (d) translate inline using Claude's language capabilities, (e) write translated strings back to cloned text nodes via Figma MCP; flag RTL languages (Arabic, Hebrew, Urdu) with layout mirroring warning
- [x] Step 13 — Write `plugin/skills/accessibility-check/SKILL.md`: instructs agent to (a) traverse all text/fill pairs in selected frame and compute WCAG 2.1 AA contrast ratios, (b) check text node font sizes against WCAG minimums, (c) simulate iOS Dynamic Type — clone frame and apply all 12 Dynamic Type scale steps to text nodes, (d) simulate Android font scaling — clone frame at 100/130/150/200% text scale, (e) generate inline pass/fail report and optionally write a report frame to an "Accessibility" page

### Documentation & Plugin Metadata
- [x] Step 14 — Write plugin user guide section in `plugin/workflow.md`: skill invocation syntax, required arguments, prerequisites per skill, PAT setup, shadcn kit import note
- [x] Step 15 — Update `plugin/plugin.json` with final skill argument schemas, descriptions, and example invocations after all SKILL.md files are written

---

## Build Agents

### Phase 1 — Plugin Scaffold (sequential, blocks everything)
- `doc-build` — Steps 1–5: Write plugin.json, marketplace.json, settings.local.json, workflow.md, agent-handoff.md

### Phase 2 — Pre-build Figma Gate (sequential, after Phase 1)
- `figma-build` — Step 6: Live Figma session — run `get_variable_defs` on foundations-Agent-Kit, write variable slot catalog to `research/variable-slots.md`

### Phase 3 — Skills (parallel, after Phases 1+2)
- `doc-build` agent A — Step 7: `plugin/skills/new-project/SKILL.md`
- `doc-build` agent B — Step 8: `plugin/skills/create-design-system/SKILL.md` (requires variable slot catalog from Phase 2)
- `doc-build` agent C — Step 9: `plugin/skills/sync-design-system/SKILL.md`
- `doc-build` agent D — Steps 10–11: `plugin/skills/create-component/SKILL.md` + `plugin/skills/code-connect/SKILL.md`
- `doc-build` agent E — Steps 12–13: `plugin/skills/new-language/SKILL.md` + `plugin/skills/accessibility-check/SKILL.md`

### Phase 4 — Finalize (sequential, after Phase 3)
- `doc-build` — Steps 14–15: User guide additions to workflow.md + finalize plugin.json schemas

---

## Dependencies & Tools

| Dependency | Used By | Notes |
|---|---|---|
| Figma MCP connector (Claude Code) | All Figma steps | Handles all Figma auth — no PAT config or env var required |
| Figma MCP server (`mcp__claude_ai_Figma__*`) | Steps 6, 8, 10, 11, 12, 13 | `get_variable_defs`, `get_code_connect_suggestions`, `send_code_connect_mappings`, write tools |
| Figma Variables REST API | Steps 8, 9 | Organization tier — bulk write available |
| Figma REST Files API (`POST /v1/files/:key/duplicate`) | Step 7 | Auth via MCP connector |
| shadcn CLI (`npx shadcn@latest add`) or shadcn MCP | Step 10 | Installs at local file level; agent draws result to canvas |
| `@figma/code-connect` CLI | Step 11 | Manual fallback only — not primary path |
| Workshop template (`hnCK8gpGtxzBoBakRX8QLn`) | Step 7 | Discovery Workshop Template (FigJam) |
| Summary template (`8YBZtQLCnt7sbmlCKpMO1Y`) | Step 7 | Discovery Summary Template (Slides) |
| foundations-Agent-Kit (`rJQsr4aou5yjzUhaEM0I2f`) | Steps 6, 7, 8 | Clone source for Foundations; variable slots cataloged in Step 6 |
| Masterfile-template (`C9C0XpIdj1WS3klOugVzGM`) | Step 7 | Clone source for iOS/Android/RIVE master files |
| Local filesystem (read) | Step 9 | Agent reads `tokens.json`/`tailwind.config.js` directly |

---

## Open Questions

~~1. Workshop/Summary template file keys~~ ✅ Resolved
~~2. Figma plan tier~~ ✅ Resolved — Organization tier (REST Variables API write available)
~~3. PAT management convention~~ ✅ Resolved — Figma MCP connector via Claude Code handles auth (no env var / PAT storage needed)
~~4. Plugin distribution~~ ✅ Resolved — internal distribution via Git repo (`private: true`)
~~5. shadcn/ui Figma kit file key~~ ✅ Resolved — install via shadcn CLI/MCP at file level, draw to canvas (no manual kit import prerequisite)

---

## Notes

- This is a **Claude Code plugin** — all skill logic lives in SKILL.md instruction files, not TypeScript code. No bundler, no install scripts, no Figma sandbox.
- **Auth:** Figma MCP connector via Claude Code handles all Figma authentication. No PAT env var, no `clientStorage`, no settings configuration needed by the designer.
- **Distribution:** Internal Git repo, `private: true`. No public marketplace submission.
- **Token architecture:** `Primitives` (raw Tailwind-scale values) → `Web`, `Android/M3`, `iOS/HIG` alias collections using Figma variable aliasing. All collections live in the same Figma file. Organization tier confirms REST Variables API write is available.
- **Template file keys (confirmed):** Workshop → `hnCK8gpGtxzBoBakRX8QLn` | Summary → `8YBZtQLCnt7sbmlCKpMO1Y` | Foundations → `rJQsr4aou5yjzUhaEM0I2f` | Master Files → `C9C0XpIdj1WS3klOugVzGM`
- `/create-component` uses shadcn CLI or MCP to install at local file level, then the agent draws the component structure to the Figma canvas — no manual Figma community kit import required.
- `/sync-design-system` reads local token files directly — no companion CLI needed (agent has filesystem access).
- `/new-language` translation is handled by Claude inline — no DeepL/Google Translate required.
- `/accessibility-check` targets WCAG 2.1 AA. iOS Dynamic Type: 12-step Apple scale table. Android: 100/130/150/200% per Material 3 / Android 14 guidelines.
- Phase 2 (Step 6) is a mandatory short gate — variable slot names must be accurate in the `/create-design-system` SKILL.md.
