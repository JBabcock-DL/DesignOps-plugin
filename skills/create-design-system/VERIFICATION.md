# Canvas template verification notes

**Distribution §:** Bundled MCP payloads, regen script, and upstream RFC context — [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) **§12** ([anchor link](./MCP-PAYLOAD-RESEARCH.md#12-distribution-and-bundled-code-stable-workflow)). If **Cursor** never completes a draw despite a good file, read **§12.1** (MCP server id, no `.mcp-*` staging, inline payload size). Phase orchestration — [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) **§ Distribution § (MCP — bundles and source root)**.

## Payload size — committed bundles (2026-04-20)

Every Step 15 canvas `use_figma` call now reads a committed bundle from [`canvas-templates/bundles/`](./canvas-templates/bundles/) and passes its contents verbatim as `code`. `ctx` is assembled **in the plugin** by the runner fragment — nothing is JSON-stringified on the wire.

`wc -c` after `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs`:

| Bundle | Readable `.mcp.js` | Minified `.min.mcp.js` (wire) | Under 50k cap? |
|--------|--------------------:|-------------------------------:|----------------|
| `step-15a-primitives`      | 33,290 | **25,351** | Yes |
| `step-15b-theme`           | 36,220 | **30,303** | Yes |
| `step-15c-layout`          | 24,895 | **19,359** | Yes |
| `step-15c-text-styles`     | 23,545 | **17,941** | Yes |
| `step-15c-effects`         | 26,267 | **20,188** | Yes |

Bundles stay well under the ~50k `code` cap with headroom; the wire variant is what agents pass in each `use_figma` call. **`ctx.variableMap`** is never passed inline — [`ensureLocalVariableMapOnCtx`](./canvas-templates/_lib.js) hydrates inside `build(ctx)`.

Re-measure after any template, runner fragment, or `_lib.js` edit:

```bash
node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
wc -c skills/create-design-system/canvas-templates/bundles/*.min.mcp.js
```

If any `.min.mcp.js` approaches **45k** bytes, audit the corresponding runner fragment for inlined data that could be trimmed. Do **not** add cross-step concatenation (single-sweep all pages in one call) — the step-per-call split is intentional.

## Parse check

Every minified bundle must parse under an `async () => { … }` wrapper (the Figma MCP host wraps similarly before execution). From repo root:

```bash
for f in skills/create-design-system/canvas-templates/bundles/*.min.mcp.js; do
  node -e "const fs=require('fs');new Function('figma','return (async()=>{'+fs.readFileSync('$f','utf8')+'})();');" && echo "OK $f" || echo "FAIL $f"
done
```

All five must print `OK`.

## Human QA

- **Gate — Step 15a:** Run a full `/create-design-system` (or targeted agent session) on a scratch file through Step 15a and apply the read-only checklist in [`conventions/14-audit.md`](./conventions/14-audit.md).
- **After 15b/15c land:** Repeat audit on Theme, Layout, Text Styles, and Effects pages.

## Token / wall-clock baselines

Optional: record before/after token counts and stopwatch timings in your team’s wiki or issue tracker when benchmarking — not stored automatically in git.
