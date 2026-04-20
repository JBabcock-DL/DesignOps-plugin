# Agent handoff — issues encountered (Figma MCP / Step 15 / `use_figma`)

Use this list to spin up another agent on **create-design-system** canvas steps (especially **15a–15c**), **bundle transport**, and **`use_figma`** reliability.

**Related docs:** [`../RFC-figma-mcp-bundle-transport.md`](../RFC-figma-mcp-bundle-transport.md) (withdrawn stub) · [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md) · [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) · [`README.md`](./README.md)

---

## 1. MCP / Plugin API surface

| Issue | Symptom | Notes / fix |
|--------|---------|-------------|
| **`figma.clientStorage.setAsync` / `getAsync` unsupported** | Error like `clientStorage.setAsync is not yet supported` (or similar) when chunking large scripts via storage. | Do **not** use multi-part uploads through `clientStorage` for `use_figma` in this environment. Prefer one self-contained `code` string (from **`Read`** of the committed `.min.mcp.js`). See [`../conventions/16-mcp-use-figma-workflow.md`](../conventions/16-mcp-use-figma-workflow.md) § MCP host constraints. |
| **`loadAllPagesAsync` not available** | Runtime error: `loadAllPagesAsync` is not a supported API. | Not part of the Plugin API surface used here; use `figma.root.children` / `setCurrentPageAsync` per docs. |
| **`figma.notify` unsupported** | Throws "not implemented" | Per **figma-use** skill — use `return` for output, not `notify`. |
| **`getPluginData` / `setPluginData` unsupported** | Documented as unsupported in `use_figma` | Use `getSharedPluginData` / `setSharedPluginData` or return IDs from the script. |

---

## 2. Bundle size and transport (`code` argument)

| Issue | Symptom | Notes / fix |
|--------|---------|-------------|
| **`use_figma` `code` max length** | Rejection or truncation if over schema cap (~50 000 chars). | Regenerate min bundles; split steps (15c = three calls: layout, text styles, effects). See phase 07. |
| **Large inline `code` in `call_mcp_tool`** | Agent struggles to pass ~18–25k characters in one tool invocation; oscillation between temp JSON, base64, etc. | **Happy path:** `Read` committed `.min.mcp.js` → pass **verbatim** as `code` (no shell `cat`). Do **not** assume a file-path MCP parameter — it is not in the shipping schema. |
| **Shell stdout truncation** | Bundle corrupted when copied from `cat` / `type` / long `node -e` output. | Never use terminal dump as source of truth for full bundle; use editor **`Read`** on the file. |
| **Base64-wrapped bundles + `atob` / `TextDecoder` / `AsyncFunction`** | Extra complexity; possible host incompatibilities. | Conventions prefer **plain UTF-8 source** from repo; avoid decode wrappers unless host is verified. |

---

## 3. Cursor / agent host

| Issue | Symptom | Notes / fix |
|--------|---------|-------------|
| **No `cursor` CLI subcommand for MCP invoke** | Cannot `cursor mcp call …` from shell to replay `use_figma`. | MCP is driven through the IDE/agent **`call_mcp_tool`** (or equivalent); shell cannot replace that without a full MCP client. |
| **Shell / sandbox command rejection** | e.g. `Rejected: Review cancelled or failed` on `node -e`, `env`, etc. | Breaks workflows that depend on Node writing temp JSON then reading back. Prefer **`Read`** on committed paths; avoid fragile shell pipelines. |
| **Wrong MCP `server` identifier** | Tool not found or wrong server. | Use workspace `mcps/**/SERVER_METADATA.json` → `serverIdentifier` (e.g. `plugin-figma-figma`), not a guessed slug. |

---

## 4. Repo policy vs workarounds

| Issue | Symptom | Notes / fix |
|--------|---------|-------------|
| **Scratch `_mcp-*` / `*-payload.json` in repo** | Violates [`.cursor/rules/mcp-inline-payloads.mdc`](../../../.cursor/rules/mcp-inline-payloads.mdc) and [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) § No workspace scripts. | Deliverable is **Figma file state**, not staging files. If generated artifacts are required, use a **committed script** + **gitignored `out/`** with a **fixed contract** (team decision — not yet in repo unless added). |
| **Hand-rolled chunk files (e.g. `clientStorage` + partial base64)** | Partial scripts, unclear reassembly, fails if storage unsupported. | Treat as **invalid** approach for MCP; use one bundle per `use_figma` call. |

---

## 5. Skill / phase expectations (happy path)

| Issue | Symptom | Notes / fix |
|--------|---------|-------------|
| **Assembling `ctx` or `variableMap` in the tool call** | Bloated payloads; contradicts bundle design. | Bundles resolve live variables **in-plugin** (`ensureLocalVariableMapOnCtx`). **Never** inline full `variableMap` in MCP args. |
| **Wrong bundle for step** | Wrong page or missing tables. | Map: 15a → `step-15a-primitives.min.mcp.js`, 15b → `step-15b-theme.min.mcp.js`, 15c → layout / text-styles / effects bundles (three calls). See [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md). |
| **Stale bundles after template edits** | Canvas drift vs `_lib` / templates. | Run `node skills/create-design-system/scripts/bundle-canvas-mcp.mjs` after changing `_lib.js`, templates, or runner fragments. |

---

## 6. Test file / session context (from original task)

| Item | Value |
|------|--------|
| **Example file key (non-normative)** | `uCpQaRsW4oiXW3DsC6cLZm` — historical research session only; **do not** use as a team default or copy into runbooks. Always use a **designer-authorized** `fileKey` per run. |
| **Target page (Step 15c text)** | `↳ Text Styles` (Unicode arrow U+21B3; bundle searches `'\u21B3 Text Styles'`) |
| **MCP sanity** | Listing `figma.root.children` / page names works when `use_figma` is wired correctly |

---

## 7. Success criteria for the next agent

1. **One `Read`** per bundle — **no** shell-sourced bundle bytes.
2. **One `use_figma` per bundle** for happy path; **no** `clientStorage` stitching.
3. Return payload includes **`ok`**, **`step`**, **`tableGroups`** / **`rowCount`** as defined in bundle; verify on canvas + [`../conventions/14-audit.md`](../conventions/14-audit.md) where applicable.
4. If the host cannot pass the full string into `call_mcp_tool`, **document** the failure mode (host/tool limit) rather than inventing new encodings; a **plugin-side runner** remains a product direction outside this doc.

---

*Generated for agent handoff; extend with new rows as you discover additional failure modes.*
