# DesignOps Step 6 engine — contract

**Canonical script:** [`scripts/designops-step6-engine.mjs`](../../../scripts/designops-step6-engine.mjs)  
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
- **`strategy`** — always **`disk`**.
- **`assembleArgv`** — exact argv used for `assemble-slice` subprocess (absolute paths); includes **`--emit-mcp-args`** to staging.
- **`payload.mode`** — always **`disk`**: **`mcpArgsJson`** + **`codeJs`** under **`.designops/staging/`**.
- **`finalizeHint`** — pipe return JSON to **`finalize-slice`** (see **`scripts/finalize-slice.mjs`**).
- **`parent_actions`** — exactly **four** ops in order (execute literally):

```json
[
  { "op": "RUN_SHELL", "argv": ["…assemble-slice…"], "cwd": "<REPO_ROOT>", "exitOnFail": [10, 11, 17] },
  { "op": "READ_PATH", "path": "<drawDir>/.designops/staging/mcp-<slug>.json", "purpose": "mcp-args" },
  { "op": "CALL_MCP_USE_FIGMA", "fromMcpJson": "<absolute path to same mcp-*.json>" },
  { "op": "FINALIZE_STDIN", "slug": "<slug>", "handoffPath": "<handoff.json>" }
]
```

The parent thread **`Read`**s the **`mcp-*.json`** file in full (no chat paste), then **`call_mcp` → `use_figma`** with the parsed **`fileKey`**, **`code`**, **`description`**, **`skillNames`**.

---

## Canvas bundle manifest (optional)

**`npm run designops:canvas:manifest`** → writes **`current-canvas-session.manifest.json`** at repo root (override with **`--out`**) listing Steps **15a / 15b / 15c×3 / 17** bundle paths — same slugs as [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) §2.

---

## CONFIG projection (Tier 1)

**[`scripts/config-projection-map.json`](../../../scripts/config-projection-map.json)** — default **`allowTopLevelKeys: null`** (identity). [`assemble-slice`](../../../scripts/assemble-slice.mjs) applies projection after loading CONFIG and embeds the projected object as `const CONFIG = …` when using the **generate-ops** path.
