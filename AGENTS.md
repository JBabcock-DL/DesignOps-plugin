# Agent instructions — DesignOps Plugin

These notes apply to **any** AI agent or automation working in this repository (Cursor, Claude Code, CI bots with repo access, etc.).

## MCP payloads: inline in the tool call — never repo staging files

When a tool accepts an **inline** argument (e.g. Figma **`use_figma`** → `code`, or similar “pass the script/blob here” parameters):

1. Put the payload **directly in that tool’s arguments** for the invocation.
2. If the payload is too large for one call, split work across **multiple sequential invocations**, each with a **fresh, self-contained** payload.
3. **Do not** create files in this repo **only** to hold, minify, bundle, or JSON-escape that payload before calling MCP. Examples of disallowed throwaways: `.mcp-*`, `_mcp-*`, `*-once.js`, `*-payload.json`, `_mcp-args*.json`, `_tmp*`, or scratch folders under `skills/` used purely as a clipboard for tool input. Shell snippets whose only job is writing those files are the same anti-pattern.

**Exception:** When a skill document **explicitly** names a **committed** path to read (e.g. `skills/new-project/phases/*.md` fenced blocks, `skills/create-component/templates/*.figma.js`, `skills/create-design-system/canvas-templates/*.js`), follow it. Those files are maintained skill artifacts — do **not** mirror them into a parallel `.mcp-*` copy “for convenience.”

If you accidentally create a staging file, **delete it** before finishing; the deliverable is tool/Figma state, not extra repo noise.

### Where this is spelled out for canvas

- [`skills/create-design-system/conventions/16-mcp-use-figma-workflow.md`](skills/create-design-system/conventions/16-mcp-use-figma-workflow.md) — read templates/data, plain `code`, ~50k cap, split calls, MCP host limits
- [`skills/create-design-system/phases/07-steps15a-15c.md`](skills/create-design-system/phases/07-steps15a-15c.md) — § *Agent-driven only — no workspace scripts*
- [`skills/create-design-system/SKILL.md`](skills/create-design-system/SKILL.md) — Canvas (Steps 15a–17)
- [`skills/sync-design-system/SKILL.md`](skills/sync-design-system/SKILL.md) — canvas redraw reliability bullet

### Table fidelity — all models (Sonnet, Composer, etc.)

MCP comparison of a **golden** style-guide table vs a regressed one showed: **header cells** were built with the **body** auto-layout recipe (VERTICAL + Hug + `resize(w,1)`), which collapses header chrome to **1px** while text stays `textAutoResize: 'NONE'`; body rows looked “tall enough” but **code columns** stayed **~9px** tall; **Primitives swatch** `RECTANGLE`s often shipped with **resolved hex only** (no `boundVariables.color`) instead of **`setBoundVariableForPaint`** to the row’s **`Primitives`** variable. **Authoritative fix:** read [`skills/create-design-system/conventions/00-gotchas.md`](skills/create-design-system/conventions/00-gotchas.md) **§0.5–0.7** and [`skills/create-design-system/conventions/14-audit.md`](skills/create-design-system/conventions/14-audit.md) before declaring canvas work done. Do **not** infer header geometry from “the row looks fine,” or swatch correctness from “it shows the right color.”

### IDE rule (Cursor)

Project rule file (always on in Cursor): [`.cursor/rules/mcp-inline-payloads.mdc`](.cursor/rules/mcp-inline-payloads.mdc)
