# MCP canvas bundles (`*.mcp.js`)

**Purpose:** One **committed** file per canvas `use_figma` call so agents can `Read` a single path and pass the entire contents as the tool’s `code` argument — no ad-hoc concatenation of `_lib.js` + template in chat.

**Regenerate** after editing [`../_lib.js`](../_lib.js), [`../primitives.js`](../primitives.js), or [`_step15a-runner.fragment.js`](./_step15a-runner.fragment.js):

```bash
# from repository root
node skills/create-design-system/scripts/bundle-canvas-mcp.mjs
```

Then commit the updated `step-15a-primitives.mcp.js`.

## Shipped bundles

| File | Step | Contents |
|------|------|----------|
| [`step-15a-primitives.mcp.js`](./step-15a-primitives.mcp.js) | 15a ↳ Primitives | `_lib.js` + `primitives.js` + in-plugin row resolver (`_step15a-runner.fragment.js`). Omits `ctx.variableMap`; [`ensureLocalVariableMapOnCtx`](../_lib.js) hydrates inside Figma. |

**15b / 15c:** Follow the same pattern when in-plugin row builders exist (`_step15b-runner.fragment.js`, etc.); extend [`../scripts/bundle-canvas-mcp.mjs`](../scripts/bundle-canvas-mcp.mjs). Until then, phase 07 may still assemble `_lib` + template + `JSON.stringify(ctx)` from the skill tree.

## Minify / esbuild caveat

Do **not** run `esbuild` on the combined MCP bundle as a single **ES module** if the script ends with top-level `await` and top-level `return` (Figma MCP host wraps the script, but esbuild may reject `return` at module scope). **Safe default:** this repo’s bundle script uses **plain concatenation** only. If you add minification, use a path that preserves Figma execution semantics (e.g. whitespace-only collapse, or document an IIFE exception **only** for the bundle file).

## Size check (50k `use_figma` cap)

After regen, from repo root:

```bash
wc -c skills/create-design-system/canvas-templates/bundles/step-15a-primitives.mcp.js
```

If the character count approaches **45k**, re-measure and consider the conditional paths in [`../VERIFICATION.md`](../VERIFICATION.md) and [`../MCP-PAYLOAD-RESEARCH.md`](../MCP-PAYLOAD-RESEARCH.md).
