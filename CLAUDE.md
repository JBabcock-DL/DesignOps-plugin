# DesignOps-plugin — Claude Code project context

**Always load at session start when working in this repository** (no user reminder required):

1. Read **[`memory.md`](memory.md)** — token-light workflow map, skill routing, session rules, and what to open next.
2. Apply **[`AGENTS.md`](AGENTS.md)** for MCP policy (inline payloads, no scratch staging), canvas **subagent** rules, cache sync, and host-specific notes.

Do **not** wait for the user to say “read memory” — treat **`memory.md` + `AGENTS.md`** as default constraints for every substantive request in this project.

**CLI:** Run documented **`node scripts/…`** / **`npm run …`** (**`assemble-slice`**, **`merge-handoff`**, **`figma:mcp-invoke`**, **`verify`**, etc.) yourself from this repo root unless blocked (missing env, interactive auth); see **`AGENTS.md`** and **`memory.md`** (session choreography).

When a task clearly matches a single skill (e.g. `/sync-design-system`), still honor **`memory.md`** choreography (subagents, session splits, lazy-loading) before loading long `SKILL.md` bodies wholesale.

**`/create-component`:** **Step 6 = 10** `use_figma` invocations in the **parent** by default (assembly + `handoffJson` per [`13`](skills/create-component/conventions/13-component-draw-orchestrator.md) and [`create-component-figma-slice-runner`](skills/create-component-figma-slice-runner/SKILL.md)); do **not** default `Task` subagents for large `call_mcp` payloads. **Optional** `Task` if the host is proven. Alternatives: [`EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0** (phased / preassembled on disk).
