# DesignOps Step 6 engine — contract

**Canonical script:** [`scripts/designops-step6-engine.mjs`](../../../scripts/designops-step6-engine.mjs)  
**Status helper:** [`scripts/lib/designops-step6-status.mjs`](../../../scripts/lib/designops-step6-status.mjs)  
**Related:** [`22-deterministic-agent-flows`](./22-deterministic-agent-flows.md), [`21-mcp-ephemeral-payload-protocol`](./21-mcp-ephemeral-payload-protocol.md), [`EXECUTOR`](../EXECUTOR.md) §0.

---

## Subcommands

| Command | Purpose |
|---------|---------|
| `status --draw-dir <abs>` | JSON: `nextSlug`, `completedSlugs`, `terminal`, `phaseState` (or error with `remediation` for corrupt `phase-state.json`). Fresh draw = no `phase-state.json`, `nextSlug` = **`cc-doc-scaffold-shell`**. |
| `validate-draw-dir --draw-dir <abs>` | Optional `--config-block`; ensures `handoff.json` (+ paths if supplied) exist; prints resolved paths. |
| `prepare --draw-dir … --layout … --config-block … --registry … --file-key …` | Writes **`draw-dir/current-step.manifest.json`**, **`draw-dir/.designops/staging/`** (disk strategy adds `mcp-<slug>.json`), runs **`assemble-slice`** unless **`--no-run`**. Use **`--strategy inline`** or default **`disk`**. **`--slug`** must match **`phase-state.nextSlug`** unless **`--force`**. |

**npm shortcuts:** **`npm run designops:step6:status`**, **`npm run designops:step6:prepare`** (see repo root **`package.json`**).

---

## `current-step.manifest.json` v1

- **`version`** — integer `1`
- **`assembleArgv`** — exact argv used for `assemble-slice` subprocess (absolute paths).
- **`payload`** — **`disk`** mode (`mcpArgsJson` + `codeJs`) or **`inline`** (read `codeJs` only).
- **`finalizeHint`** — pipe return JSON to **`finalize-slice`** (see **`scripts/finalize-slice.mjs`**).
- **`parent_actions`** — ordered ops: **`RUN_SHELL`**, **`READ_PATH`**, **`CALL_MCP_USE_FIGMA`**, **`FINALIZE_STDIN`** — agents follow **literally**; parent still invokes MCP.

---

## Canvas bundle manifest (optional)

**`npm run designops:canvas:manifest`** → writes **`current-canvas-session.manifest.json`** at repo root (override with **`--out`**) listing Steps **15a / 15b / 15c×3 / 17** bundle paths — same slugs as [`canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) §2.

---

## CONFIG projection (Tier 1)

**[`scripts/config-projection-map.json`](../../../scripts/config-projection-map.json)** — default **`allowTopLevelKeys: null`** (identity). [`assemble-slice`](../../../scripts/assemble-slice.mjs) applies projection after loading CONFIG and embeds the projected object as `const CONFIG = …` when using the **generate-ops** path.

---

## Wire-size follow-on

See [`24-thin-doc-engine-split-plan`](./24-thin-doc-engine-split-plan.md) for optional thin **`build-min`** doc engines after projection stabilizes.
