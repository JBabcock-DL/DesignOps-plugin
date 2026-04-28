# DesignOps-plugin — Claude Code project context

**Always load at session start when working in this repository** (no user reminder required):

1. Read **[`memory.md`](memory.md)** — token-light workflow map, skill routing, session rules, and what to open next.
2. Apply **[`AGENTS.md`](AGENTS.md)** for MCP policy (prefer inline payloads; ephemeral staging per policy), canvas **subagent** rules, cache sync, and host-specific notes.

Do **not** wait for the user to say “read memory” — treat **`memory.md` + `AGENTS.md`** as default constraints for every substantive request in this project.

**CLI:** Run documented **`node scripts/…`** / **`npm run …`** (**`bundle-component`**, **`verify`**, **`create-component-step6`**, etc.) yourself from this repo root unless blocked (no MCP, interactive auth); see **`AGENTS.md`** (*Agents run plugin CLI* — **do not** push manual terminal homework to designers when you can execute). **`memory.md`** (session choreography).

When a task clearly matches a single skill (e.g. `/sync-design-system`), still honor **`memory.md`** choreography (subagents, session splits, lazy-loading) before loading long skill bodies wholesale — for `/create-component`, **`EXECUTOR.md`** first, then convention shards (`conventions/00-overview.md`, etc.) only as needed.

**`/create-component`:** **Step 6 = 5** `use_figma` invocations — **`Task` → [`canvas-bundle-runner`](skills/canvas-bundle-runner/SKILL.md)** with **`assembledCodePath`** after [`assemble-component-use-figma-code.mjs`](scripts/assemble-component-use-figma-code.mjs) + **`check-payload`** per [`EXECUTOR.md`](skills/create-component/EXECUTOR.md) **§0** (same pattern as style-guide canvas). Batch prep: **`npm run create-component-step6 -- --ctx-file <path>`** ([`scripts/create-component-step6-all.mjs`](scripts/create-component-step6-all.mjs)); **never** parallel **`Task`** for two **`cc-*`** steps ([`canvas-bundle-runner/SKILL.md`](skills/canvas-bundle-runner/SKILL.md) §6.1). **Fallback:** parent **`Read`** → **`call_mcp`**. Writer subagents may run assembly + `check-payload` only.
