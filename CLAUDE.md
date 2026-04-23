# DesignOps-plugin — Claude Code project context

**Always load at session start when working in this repository** (no user reminder required):

1. Read **[`memory.md`](memory.md)** — token-light workflow map, skill routing, session rules, and what to open next.
2. Apply **[`AGENTS.md`](AGENTS.md)** for MCP policy (inline payloads, no scratch staging), canvas **subagent** rules, cache sync, and host-specific notes.

Do **not** wait for the user to say “read memory” — treat **`memory.md` + `AGENTS.md`** as default constraints for every substantive request in this project.

When a task clearly matches a single skill (e.g. `/sync-design-system`), still honor **`memory.md`** choreography (subagents, session splits, lazy-loading) before loading long `SKILL.md` bodies wholesale.

**`/create-component`:** Prefer **six** sequential **`Task` → `create-component-figma-slice-runner`** for Step 6 whenever `Task` exists — parent follows [`skills/create-component/conventions/13-component-draw-orchestrator.md`](skills/create-component/conventions/13-component-draw-orchestrator.md) and passes **`configBlock`**, **`layout`**, registry, and **`handoffJson`** per slice runner §0. **Legacy:** one **`Task` → `create-component-figma-runner`**. Do not `Read` minified `*.min.figma.js` into the parent thread; inline `use_figma` in the parent only when `Task` is unavailable ([`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) §0).
