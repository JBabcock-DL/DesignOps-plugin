# Roadmap — tuple ops for delegated doc / variant engines

**Status:** **In progress.** Delegated **`cc-variants`** and **`create-component-engine-doc.step2..6`** bundles remain the default wire payload (canonical UTF-8 via [`tryTupleFirstDelegatedEngine`](../../../scripts/op-generators/tuple-delegate-pipeline.mjs) → filesystem read until a slug is ported to tuple ops).

## Shipped (Phase 1 hook + CI)

- **Golden harness baseline** — [`qa-tuple-parity.mjs`](../../../scripts/qa-tuple-parity.mjs): for each delegated slug, verifies `assembleOpsBody` output **byte-matches** the committed `*.min.figma.js` and passes `check-payload` on that body. Writes **`.designops/qa-tuple-parity/tuple-parity-report.json`** at repo root (gitignored recommended).
- **`npm run qa:tuple-parity`** is part of **`npm run verify`**.
- **Single resolver** — [`generate-ops assembleOpsBody`](../../../scripts/generate-ops.mjs) resolves delegated slices only through [`tryTupleFirstDelegatedEngine`](../../../scripts/op-generators/tuple-delegate-pipeline.mjs), which reads [`readDelegatedMinUtf8`](../../../scripts/op-generators/lib/read-delegated-min.mjs) today; per-slug tuple emitters replace that string when ported (post-parity only).

## Goal

Replace **raw** delegated `.min.figma.js` bodies with **JSON tuple ops** plus shared [`op-interpreter.min.figma.js`](../templates/op-interpreter.min.figma.js) runtime for those steps — same observable canvas behavior as today’s min engines (**pixel / structure parity** enforced by fixtures).

## Phases

1. **Golden harness per slug** — **Partially done:** byte + `check-payload` parity vs on-disk min ([`qa-tuple-parity`](../../../scripts/qa-tuple-parity.mjs)). **Next:** Figma golden `handoffJson` invariants per slug (`--legacy-bundles` vs tuple) before flipping a slug.
2. **Port order** — **`cc-doc-component`** (step2.min) — then **matrix / usage / finalize**, **props** splits, lastly **`cc-variants`** (step0).
3. **Generator layout** — Modules under [`scripts/op-generators/`](../../../scripts/op-generators/) mirroring **draw-engine** semantics; reuse [`compact-scaffold-ops`](../../../scripts/op-generators/compact-scaffold-ops.mjs) where ops compress.
4. **QA gates** — [`qa:tuple-parity`](../../../scripts/qa-tuple-parity.mjs) (shipped); extend with structural diff / Figma fixture when tuple bodies exist.

## Phase 5 — micro-ladder (conditional)

If, **after** tuple migration, `qa:assembled-size` still exceeds **proven** parent transport ([`probe-parent-transport`](../../../scripts/probe-parent-transport.mjs)), add ladder splits per [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md). **Do not** add splits pre-emptively while delegated min bodies remain the default.

## Out of scope here

[`figma.clientStorage`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) stitching for executable code — not part of this roadmap unless Figma MCP **re-verifies** `clientStorage` semantics for MCP-injected **`use_figma`**.

**Related:** [`22-delegate-blob-hotspots`](./22-delegate-blob-hotspots.md), [`18-mcp-payload-budget`](./18-mcp-payload-budget.md).
