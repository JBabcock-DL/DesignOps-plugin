# Delegate engine blob hotspots (`use_figma` wire size)

**Purpose:** Identify which Step 6 slugs ship **whole** committed **`.min.figma.js`** engines (delegated path) vs the **tuple / op-interpreter** path ([`generate-ops`](../../../scripts/generate-ops.mjs), [`delegate-legacy-min`](../../../scripts/op-generators/lib/delegate-legacy-min.mjs)).

**North star:** [`18-mcp-payload-budget`](./18-mcp-payload-budget.md) (~8–10 kB **`code`** per slice). **Figma cap:** ~50 000 **`code`** characters — delegated slices often sit **between** those two ([`npm run qa:step-bundles`](../../../package.json) wrapper sim lists worst cases).

## Delegated slugs → min bundle

| Machine slug | Delegated template (same bytes as `--legacy-bundles` delegate) |
|--------------|----------------------------------------------------------------|
| `cc-variants` | `create-component-engine-{archetype}.step0.min.figma.js` per `CONFIG.layout` |
| `cc-doc-component` | `create-component-engine-doc.step2.min.figma.js` |
| `cc-doc-props-1`, `cc-doc-props-2` | `create-component-engine-doc.step3.min.figma.js` (same file; props row partition) |
| `cc-doc-matrix` | `create-component-engine-doc.step4.min.figma.js` |
| `cc-doc-usage` | `create-component-engine-doc.step5.min.figma.js` |
| `cc-doc-finalize` | `create-component-engine-doc.step6.min.figma.js` (**largest doc step** in typical CI listings) |

**Tuple path (smaller assemble — see [`npm run qa:op-interpreter`](../../../scripts/qa-op-interpreter.mjs)):** `cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`.

**Tuple-first migration (delegated slugs):** [`24-tuple-expand-delegated-roadmap`](./24-tuple-expand-delegated-roadmap.md). **`npm run qa:tuple-parity`** guards that `assembleOpsBody` delegated output still matches on-disk `*.min.figma.js` until [`tuple-delegate-pipeline`](../../../scripts/op-generators/tuple-delegate-pipeline.mjs) returns non-`null` for a slug.

## Reduction levers (priority)

1. **Transport proof** — if parent `call_mcp` succeeds at measured size ([`probe-parent-transport`](../../../scripts/probe-parent-transport.mjs)), delegated **~23–27 kB wrappers** remain valid for **Composer** when using **disk Read** feeding `call_mcp` — classify **transport vs blob** ([`composer2-canvas-playbook`](../../../../docs/composer2-canvas-playbook.md)).
2. **Fallback** — [`npm run figma:mcp-invoke`](../../../scripts/figma-mcp-invoke-from-file.mjs) when IDE serialization fails independently of Figma.
3. **More ladder splits** — [`.partN`](./13-component-draw-orchestrator.md) or extra machine slugs on the hottest delegates (`cc-doc-finalize`, **`cc-variants`**) before rewriting engines.
4. **Tuple parity for delegates** — long-term roadmap: [`24-tuple-expand-delegated-roadmap`](./24-tuple-expand-delegated-roadmap.md).

**Measure locally:** [`npm run report:delegate-sizes`](../../../package.json) (committed min byte lengths + [`npm run qa:assembled-size`](../../../package.json) against a consumer `draw-dir`).
