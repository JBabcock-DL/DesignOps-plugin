# DesignOps-plugin — Claude Code project context

**Always load at session start when working in this repository** (no user reminder required):

1. Read **[`memory.md`](memory.md)** — token-light workflow map, skill routing, session rules, and what to open next.
2. Apply **[`AGENTS.md`](AGENTS.md)** for MCP policy (inline payloads, no scratch staging), canvas **subagent** rules, cache sync, and host-specific notes.

Do **not** wait for the user to say “read memory” — treat **`memory.md` + `AGENTS.md`** as default constraints for every substantive request in this project.

When a task clearly matches a single skill (e.g. `/sync-design-system`), still honor **`memory.md`** choreography (subagents, session splits, lazy-loading) before loading long `SKILL.md` bodies wholesale.

**`/create-component`:** Prefer **`Task` → `create-component-figma-runner`** for Step 6 whenever `Task` exists — hand off **`configBlock`** + **`layout`** per runner §0; do not inline the minified engine in the parent unless `Task` is unavailable ([`skills/create-component/EXECUTOR.md`](skills/create-component/EXECUTOR.md) §0).
