# Canvas template verification notes

**Distribution §:** Bundled MCP payloads, regen script, and upstream RFC context — [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) **§12** ([anchor link](./MCP-PAYLOAD-RESEARCH.md#12-distribution-and-bundled-code-stable-workflow)). Phase orchestration for when to use bundles vs concat — [`phases/07-steps15a-15c.md`](./phases/07-steps15a-15c.md) **§ Distribution § (MCP — bundles and source root)**.

## Payload size (source bytes, 2026)

Measured with `wc -c` on committed templates. The Figma `use_figma` `code` string is `[_lib.js] + [template] + ctx`; add a margin for `JSON.stringify(ctx)`.

**`variableMap` in `ctx`:** Size is **file-dependent** (every local variable `name` → `id`). One measured Foundations file had **~11.2k characters** for `JSON.stringify(variableMap)` at **268** variables ([`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md)). If you are near the **50k** `code` cap, measure your map or **omit `variableMap` from `ctx`** — templates call **`ensureLocalVariableMapOnCtx`** in [`canvas-templates/_lib.js`](./canvas-templates/_lib.js) and hydrate in Figma. The **static** `_lib.js` + template pair remains the largest slice for Step 15a (~30.5k source bytes before `ctx`).

| Call | `_lib.js` + template (bytes) | Under ~50k? |
|------|------------------------------|-------------|
| Step 15a — `primitives.js` | ~30,485 | Yes |
| Step 15a — **bundle** `bundles/step-15a-primitives.mcp.js` (regen via [`scripts/bundle-canvas-mcp.mjs`](./scripts/bundle-canvas-mcp.mjs)) | **~36,079** bytes (Apr 2026; under ~50k `code` cap) | Yes |
| Step 15b — `theme.js` | ~20,653 | Yes |
| Step 15c — `layout.js` | ~21,156 | Yes |
| Step 15c — `text-styles.js` | ~19,897 | Yes |
| Step 15c — `effects.js` | ~22,807 | Yes |

Re-measure after any template or fragment edit (from repo root): `wc -c skills/create-design-system/canvas-templates/bundles/step-15a-primitives.mcp.js` (or run `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs` then `wc -c` on the output file).

Concatenating **all** page templates into one script (single `use_figma`, C4-style) would approach **~55k** bytes of source alone before `ctx`, so **multi-page single sweep is not recommended** — keep **separate calls** per the phase file (15a, 15b, three for 15c).

The committed **Step 15a** bundle (`bundles/step-15a-primitives.mcp.js`) is **under** a ~45k-character precautionary line in current measurements; **no minify pipeline or `ctx.batch` split** is required for 15a until that file grows materially or real files fail MCP validation — see [`MCP-PAYLOAD-RESEARCH.md`](./MCP-PAYLOAD-RESEARCH.md) §12.

## Human QA

- **Gate — Step 15a:** Run a full `/create-design-system` (or targeted agent session) on a scratch file through Step 15a and apply the read-only checklist in [`conventions/14-audit.md`](./conventions/14-audit.md).
- **After 15b/15c land:** Repeat audit on Theme, Layout, Text Styles, and Effects pages.

## Token / wall-clock baselines

Optional: record before/after token counts and stopwatch timings in your team’s wiki or issue tracker when benchmarking — not stored automatically in git.
