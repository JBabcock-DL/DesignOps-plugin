# Composer 2 canvas playbook (Cursor / short-output agents)

Canonical policy remains [`AGENTS.md`](../AGENTS.md) and [`skills/create-component/EXECUTOR.md`](../skills/create-component/EXECUTOR.md) §0. This page is a **checklist** for Composer-class hosts.

## Classify failure

| Symptom | Likely class | First action |
|---------|----------------|-------------|
| `Unexpected end of JSON`, truncated `call_mcp` payload | **Transport A** — IDE/model serializing tool args | Disk `Read` → `use_figma`; [`probe-parent-transport`](../scripts/probe-parent-transport.mjs); fallback [`figma:mcp-invoke`](../scripts/figma-mcp-invoke-from-file.mjs) ([`buildable-figma-payload-path`](buildable-figma-payload-path.md)) |
| Figma runs but slow / hot context | **Axis B** orchestration | Fewer files in one turn; [`18` north star](../skills/create-component/conventions/18-mcp-payload-budget.md) |
| `ok: false` structured return | **Figma/plugin** | Handoff diagnostics; exit 19 semantics in [`finalize-slice`](../scripts/finalize-slice.mjs) |

## Mandatory Step 6 sequence (per slice)

1. **`npm run designops:step6:prepare`** — or `assemble-slice … --emit-mcp-args` writing **`.designops/staging/mcp-<slug>.json`** in the consumer `draw-dir`.
2. **Parent `Read`** that JSON (full file — no chat-composed `code`).
3. **`call_mcp`** → `use_figma` with `{ fileKey, code, description, skillNames }` from the file. Resolve Figma MCP **server id** from workspace `mcps/**/SERVER_METADATA.json` — do not hardcode server name.
4. **`Write`** the MCP tool result JSON to **`return-<slug>.json`**.
5. **`npm run finalize-slice`** — `node scripts/finalize-slice.mjs <slug> <handoff> --return-path …`

**Not allowed:** `Task` subagent as runner for `use_figma`; model-only emission of 15–30 KB inside `call_mcp` without disk `Read`.

## Fallback when IDE cannot carry full JSON

After a **failed** probe or known Composer truncation:

```bash
FIGMA_DESKTOP_MCP_URL="<Dev Mode MCP URL>" npm run figma:mcp-invoke -- --file path/to/mcp-<slug>.json > return-<slug>.json
node scripts/finalize-slice.mjs <slug> path/to/handoff.json --return-path path/to/return-<slug>.json
```

Same bytes as the IDE path; see manifest **`finalizeHint.fallbackShellPipe`** in [`23-designops-step6-engine`](../skills/create-component/conventions/23-designops-step6-engine.md).

## Operations

- **`npm install`** — includes `@modelcontextprotocol/sdk` for `figma:mcp-invoke` QA.
- **`npm run sync-cache`** — if you use the Claude Code marketplace copy of this plugin ([`AGENTS.md`](../AGENTS.md) skill edits).

## Measurement (before changing architecture)

1. **Transport:** Emit probe JSON → parent **`call_mcp` succeeds** → then **`--record`** (CLI-only emit+record **without** a real Figma round-trip does **not** prove Composer — do **not** commit **`.transport-proof.json`** unless it follows a verified parent invocation). Commands: [`test fixture README`](../scripts/test-fixtures/composer2-probe-draw/README.md).

2. **Per-slug wire sizes (`mcp-<slug>.json` UTF-8):** [`npm run qa:assembled-size`](../package.json) on a consumer `draw-dir` with merged handoff as needed (fixture `handoff.json` = `{}` only exercises **`cc-doc-scaffold-shell`** — see README).

3. **Delegated min engines (no full handoff):** [`npm run report:delegate-sizes`](../package.json) — static byte ranks for **`cc-variants`** / doc step `.min.figma.js` ([`22-delegate-blob-hotspots`](../skills/create-component/conventions/22-delegate-blob-hotspots.md)).

## Blob reduction pointers

Delegated engines (`cc-variants`, doc steps **`cc-doc-component` … `cc-doc-finalize`**) dominate wire size vs tuple scaffold path — see [`22-delegate-blob-hotspots`](../skills/create-component/conventions/22-delegate-blob-hotspots.md) and long-term [**24 tuple-expand roadmap**](../skills/create-component/conventions/24-tuple-expand-delegated-roadmap.md).

## Pre-release QA

**Not wired into `npm run verify`** — needs consumer paths. Run locally after meaningful assembly / slice-map / template edits:

```bash
npm run qa:assembled-size -- --draw-dir "<abs consumer draw-dir>" --layout chip \
  --config-block "<path to CONFIG block>" --registry "{}" --file-key "<key>"
npm run report:delegate-sizes
npm run qa:step-bundles
```

Outputs:

- **`qa-assembled-size`** — stdout JSON with **`mcpWrapperBytes`** per slug that assembled successfully.
- **`report:delegate-sizes`** — delegated template byte ranks (`cc-variants` layouts + doc steps).
- Compare slug sizes to the **live** **`probe-parent-transport`** **`maxProvenSize`** in your consumer draw-dir (do **not** cite synthetic fixture proofs as host limits).

## CI / verify

Full repo gate stays **`npm run verify`** (`build:*:check`, `qa:merge-consistency`, `qa:op-interpreter`, `qa:lively-oasis-contract`, …). Composer-specific checks remain **manual** above unless you add a project draw-dir CI fixture later.
