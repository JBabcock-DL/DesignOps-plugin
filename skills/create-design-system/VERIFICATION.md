# Canvas template verification notes

**Distribution §:** Bundled MCP payloads, regen script, and upstream RFC context — [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) **§12** ([anchor link](./MCP-PAYLOAD-RESEARCH.md#12-distribution-and-bundled-code-stable-workflow)). If **Cursor** never completes a draw despite a good file, read **§12.1** (MCP server id, no `.mcp-*` staging, inline payload size). Phase orchestration — [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) **§ Distribution § (MCP — bundles and source root)**.

## Payload size — committed bundles (re-measure after regen)

Every style-guide + Token Overview canvas `use_figma` call reads a committed bundle from [`canvas-templates/bundles/`](./canvas-templates/bundles/) and passes its contents verbatim as `code`. `ctx` is assembled **in the plugin** by the runner fragment where applicable — nothing is JSON-stringified on the wire for Step 15 / 17.

`wc -c` after `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs` (2026-04-20 regen):

| Bundle | Readable `.mcp.js` | Minified `.min.mcp.js` (wire) | Under 50k cap? |
|--------|--------------------:|-------------------------------:|----------------|
| `step-15a-primitives`      | 33,716 | **25,719** | Yes |
| `step-15b-theme`           | 36,551 | **30,572** | Yes |
| `step-15c-layout`          | 25,226 | **19,626** | Yes |
| `step-15c-text-styles`     | 23,876 | **18,213** | Yes |
| `step-15c-effects`         | 26,598 | **20,459** | Yes |
| `step-17-token-overview`   | 26,177 | **19,834** | Yes |

Bundles stay well under the ~50k `code` cap with headroom; the wire variant is what agents pass in each `use_figma` call. **`ctx.variableMap`** is never passed inline for Step 15 — [`ensureLocalVariableMapOnCtx`](./canvas-templates/_lib.js) hydrates inside `build(ctx)`. Step 17 uses the same `_lib` prelude + [`token-overview.js`](./canvas-templates/token-overview.js).

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
