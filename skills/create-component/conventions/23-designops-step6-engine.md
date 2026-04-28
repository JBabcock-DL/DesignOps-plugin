# DesignOps Step 6 engine — contract

**Canonical script:** [`scripts/designops-step6-engine.mjs`](../../../scripts/designops-step6-engine.mjs)

**Default invoke path:** **Cursor or Claude Code Figma MCP** — parent **`Read`** **`.designops/staging/mcp-<slug>.json`**, **`call_mcp`** **`use_figma`**. **Optional fallback** (same JSON on disk — Node MCP client): [`scripts/figma-mcp-invoke-from-file.mjs`](../../../scripts/figma-mcp-invoke-from-file.mjs) **`npm run figma:mcp-invoke`** + **`finalizeHint.fallbackShellPipe`** in the manifest.

**Operator doc:** [`docs/buildable-figma-payload-path.md`](../../../docs/buildable-figma-payload-path.md)  
**Status helper:** [`scripts/lib/designops-step6-status.mjs`](../../../scripts/lib/designops-step6-status.mjs)  
**Related:** [`08-cursor-composer-mcp`](./08-cursor-composer-mcp.md), [`21-mcp-ephemeral-payload-protocol`](./21-mcp-ephemeral-payload-protocol.md), [`EXECUTOR`](../EXECUTOR.md).

---

## Subcommands

| Command | Purpose |
|---------|---------|
| `status --draw-dir <abs>` | JSON: `nextSlug`, `completedSlugs`, `terminal`, `phaseState` (or error with `remediation` for corrupt `phase-state.json`). Fresh draw = no `phase-state.json`, `nextSlug` = **`cc-doc-scaffold-shell`**. |
| `validate-draw-dir --draw-dir <abs>` | Optional `--config-block`; ensures `handoff.json` (+ paths if supplied) exist; prints resolved paths. |
| `prepare --draw-dir … --layout … --config-block … --registry … --file-key …` | Writes **`draw-dir/current-step.manifest.json`**, **`draw-dir/.designops/staging/mcp-<slug>.json`** and assembled `code`, runs **`assemble-slice`** unless **`--no-run`**. **Disk-only** — **`--strategy inline`** is rejected. **`--slug`** must match **`phase-state.nextSlug`** unless **`--force`**. |

**npm shortcuts:** **`npm run designops:step6:status`**, **`npm run designops:step6:prepare`** (see repo root **`package.json`**).

---

## `current-step.manifest.json` v1

- **`version`** — integer `1`
- **`strategy`** — always **`disk`**
- **`assembleArgv`** — exact argv used for `assemble-slice` subprocess (absolute paths); includes **`--emit-mcp-args`** to staging
- **`payload.mode`** — always **`disk`**: **`mcpArgsJson`** + **`codeJs`** under **`.designops/staging/`**
- **`finalizeHint`** — **`mode`:** **`return-path`**; **`exampleFinalize`** (shell line for **`finalize-slice`** only); **`fallbackShellPipe`** (Node **`figma:mcp-invoke`** redirect + **`finalize-slice`** when IDE cannot **`call_mcp`**); **`examplePipeNotes`**
- **`parent_actions`** — four ops in order (execute literally):

```json
[
  {
    "op": "RUN_SHELL",
    "argv": ["…assemble-slice…"],
    "cwd": "<REPO_ROOT>",
    "exitOnFail": [10, 11, 17]
  },
  {
    "op": "READ_PATH",
    "path": "<drawDir>/.designops/staging/mcp-<slug>.json",
    "purpose": "Parent Read full staging JSON (assemble-slice --emit-mcp-args output)."
  },
  {
    "op": "CALL_MCP_USE_FIGMA",
    "stagingJsonPath": "<same as READ_PATH.path>",
    "writeToolResultTo": "<drawDir>/return-<slug>.json",
    "purpose": "Parse { fileKey, code, description, skillNames }; call_mcp use_figma via Cursor or Claude Code Figma MCP (mcps/…/SERVER_METADATA.json). Writes tool result JSON to disk before finalize.",
    "note": "Not standalone Node MCP — optional escape: finalizeHint.fallbackShellPipe"
  },
  {
    "op": "FINALIZE_SLICE",
    "slug": "<slug>",
    "handoffPath": "<handoff.json>",
    "returnPath": "<drawDir>/return-<slug>.json",
    "argv": ["node", "scripts/finalize-slice.mjs", "<slug>", "<handoff.json>", "--return-path", "<drawDir>/return-<slug>.json"],
    "cwd": "<REPO_ROOT>"
  }
]
```

**`writeToolResultTo`:** Must contain the same JSON shape IDE **`use_figma`** would return (what **`merge-one`** expects). For **fallbackShellPipe**, **`npm run figma:mcp-invoke`** prints an unwrapped tool result — same merge shape.

**`parent_actions[2]` vs Node script:** The **default** product path is **IDE MCP** — the same Desktop/remote Figma session the designer authorized in Cursor or Claude. **`figma:mcp-invoke`** only bypasses **IDE tool-arg serialization** (or runs in CI); it is **not** “the” integration when the editor already hosts Figma MCP.

---

## Canvas bundle manifest (optional)

**`npm run designops:canvas:manifest`** → writes **`current-canvas-session.manifest.json`** at repo root (override with **`--out`**) listing Steps **15a / 15b / 15c×3 / 17** bundle paths — same slugs as [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) §2.

---

## CONFIG projection (Tier 1)

**[`scripts/config-projection-map.json`](../../../scripts/config-projection-map.json)** — default **`allowTopLevelKeys: null`** (identity). [`assemble-slice`](../../../scripts/assemble-slice.mjs) applies projection after loading CONFIG and embeds the projected object as `const CONFIG = …` when using the **generate-ops** path.
