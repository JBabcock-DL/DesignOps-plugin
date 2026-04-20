# MCP canvas bundles (`*.mcp.js` / `*.min.mcp.js`)

**Purpose:** One **committed** file per canvas `use_figma` call so agents `Read` a single path and pass the entire contents as the tool's `code` argument — no ad-hoc concatenation of `_lib.js` + template + `ctx` in chat, and no `.mcp-*` / `*-payload.json` staging files in the repo.

## Two variants per step

- **`step-*.mcp.js`** — readable. Comments + indentation preserved. Use when reviewing, diffing against the source templates, or debugging in a terminal.
- **`step-*.min.mcp.js`** — wire size. Comments stripped, leading/trailing line whitespace removed, blank lines collapsed. **This is what agents `Read` and pass as `use_figma` → `code`.** Functionally identical to the readable variant — the minifier is a strip-only state machine (see below), not an ESM parse.

Both variants normalize newlines to LF before writing, so committed bundles stay consistent even when fragment sources were saved with CRLF on Windows.

## Regenerate

```bash
# from repository root
node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
```

Regenerate after editing any of:

- [`../_lib.js`](../_lib.js)
- Any page template in [`../`](../) (`primitives.js`, `theme.js`, `layout.js`, `text-styles.js`, `effects.js`)
- Any `_step*-runner.fragment.js` in this directory

Commit both the `.mcp.js` and `.min.mcp.js` outputs.

## Shipped bundles

| Step | Readable | Minified (use this at runtime) |
|------|----------|--------------------------------|
| 15a ↳ Primitives    | [`step-15a-primitives.mcp.js`](./step-15a-primitives.mcp.js)       | [`step-15a-primitives.min.mcp.js`](./step-15a-primitives.min.mcp.js) |
| 15b ↳ Theme         | [`step-15b-theme.mcp.js`](./step-15b-theme.mcp.js)                 | [`step-15b-theme.min.mcp.js`](./step-15b-theme.min.mcp.js) |
| 15c ↳ Layout        | [`step-15c-layout.mcp.js`](./step-15c-layout.mcp.js)               | [`step-15c-layout.min.mcp.js`](./step-15c-layout.min.mcp.js) |
| 15c ↳ Text Styles   | [`step-15c-text-styles.mcp.js`](./step-15c-text-styles.mcp.js)     | [`step-15c-text-styles.min.mcp.js`](./step-15c-text-styles.min.mcp.js) |
| 15c ↳ Effects       | [`step-15c-effects.mcp.js`](./step-15c-effects.mcp.js)             | [`step-15c-effects.min.mcp.js`](./step-15c-effects.min.mcp.js) |

Each bundle concatenates `_lib.js` + the page template + the per-step runner fragment. The runner resolves variables, mode IDs, Doc/* style IDs, and the target page **inside the plugin** and calls `await build(ctx)`. `ctx.variableMap` is never passed inline — [`ensureLocalVariableMapOnCtx`](../_lib.js) hydrates it on entry to `build(ctx)`.

## Minifier rules (why strip-only, not esbuild)

The runner fragments use **top-level `await`** and **top-level `return`**. The Figma MCP host tolerates both; esbuild as ESM does **not** accept `return` at module scope. So the bundle script (see [`../../scripts/bundle-canvas-mcp.mjs`](../../scripts/bundle-canvas-mcp.mjs)) uses a state-machine strip-minifier that:

- Removes `// line` and `/* block */` comments.
- Strips leading/trailing whitespace on every line and drops blank lines.
- Preserves string literals (`'`, `"`), template literals (including `${…}` interpolations with nested strings), regex literals, and all inter-token whitespace inside a single line — which keeps ASI-sensitive constructs intact.
- Never reparses the source as ESM, so `await` / `return` at script scope pass through untouched.

**Do not swap this for esbuild / terser** on the combined bundle unless you wrap every runner body in an IIFE and convert every top-level `return` to an IIFE return — that's a larger change. If you need a smaller wire size, add a second strip pass (e.g. collapse runs of inner whitespace) with matching parse-time tests, not a different parser.

## Size check (50k `use_figma` cap)

After regen, from repo root:

```bash
wc -c skills/create-design-system/canvas-templates/bundles/*.min.mcp.js
```

Every `.min.mcp.js` must stay well under **50k**. If any approaches **45k**, re-measure and consider the conditional paths in [`../../VERIFICATION.md`](../../VERIFICATION.md) and [`../../MCP-PAYLOAD-RESEARCH.md`](../../MCP-PAYLOAD-RESEARCH.md).

## Anti-pattern reminder

If an inline `use_figma` → `code` payload feels too big to pass, the correct next move is to **`Read` the `.min.mcp.js` variant and retry**. **Do not** create a `.mcp-*`, `*-payload.json`, `_tmp*`, or any scratch file to hold the payload — that pattern caused the loop this whole pipeline was built to avoid. See [`../../../../AGENTS.md`](../../../../AGENTS.md).
