# DesignOps-plugin — Claude Code project context

**Always load at session start when working in this repository** (no user reminder required):

1. Read **[`memory.md`](memory.md)** — token-light workflow map, skill routing, session rules, and what to open next.
2. Apply **[`AGENTS.md`](AGENTS.md)** for MCP policy (prefer inline payloads; ephemeral staging per policy), canvas **subagent** rules, cache sync, and host-specific notes.

Do **not** wait for the user to say “read memory” — treat **`memory.md` + `AGENTS.md`** as default constraints for every substantive request in this project.

**CLI:** Run documented **`node scripts/…`** / **`npm run …`** (**`bundle-component`**, **`verify`**, etc.) yourself from this repo root unless blocked (no MCP, interactive auth); see **`AGENTS.md`** and **`memory.md`** (session choreography).

When a task clearly matches a single skill (e.g. `/sync-design-system`), still honor **`memory.md`** choreography (subagents, session splits, lazy-loading) before loading long skill bodies wholesale — for `/create-component`, **`EXECUTOR.md`** first, then convention shards (`conventions/00-overview.md`, etc.) only as needed.

**`/create-component`:** **Step 6 = 5** `use_figma` invocations in the **parent** by default (**`scaffold` → `properties` → `component-*` → `matrix` → `usage`**) per [`EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0** and committed **`.min.mcp.js`** bundles; do **not** default `Task` subagents for large `call_mcp` payloads. **Optional** writer subagent assembles `code` to disk; parent still **`Read` → `call_mcp`**.
