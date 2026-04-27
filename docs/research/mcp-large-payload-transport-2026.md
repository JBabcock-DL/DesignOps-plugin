# Large `use_figma` transport — research and spike (2026-04-27)

**Closure (continue vs pivot, bottom line):** [`mcp-transport-closure-report.md`](./mcp-transport-closure-report.md)

**Solution architecture + spike compile + ideation:** [`mcp-transport-solution-architecture-2026.md`](./mcp-transport-solution-architecture-2026.md) (see §3.2–3.3 measured table, §5 closure, **§6 solution ideation**)

This document implements the **MCP large-payload research** plan: measure where `use_figma` arguments can fail, document host workarounds, and record go/no-go decisions for gzip-in-plugin and a file-path proxy. It does **not** replace [`AGENTS.md`](../../AGENTS.md) or [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs); it adds evidence and cross-links.

---

## Phase 0 — Baseline (probe emit, validation, model-mediated `call_mcp`)

**What we ran**

- `node scripts/probe-parent-transport.mjs` emitted JSON at **25,000** bytes `code` (total serialized MCP args **25,435** UTF-8 bytes) to `figTest/draw-transport-research/probe-args.json` (sibling design repo, outside this plugin’s git tree on purpose).
- `node scripts/check-use-figma-mcp-args.mjs` on that file: **PASS** (full object JSON round-trips).
- **Model-mediated** `call_mcp` / `use_figma` in Cursor (this agent) with **2,000** and **5,000** byte `code` fields: responses were **Figma file access** errors for `fileKey: PROBE_NO_FIGMA_FILE_REQUIRED`, **not** `Unexpected end of JSON input` or other host parse errors. That pattern indicates the **Cursor → MCP JSON envelope** accepted the full tool arguments.
- **2026-04-27 follow-up (real `fileKey`):** **5,000** and **10,000** byte `code` **synthetic** probes in **one** parent `call_mcp` with file `uCpQaRsW4oiXW3DsC6cLZm` — **Figma** returns `ok: true` with correct `observedCodeBytes` — see `.transport-proof.json` **`maxProvenSize` = 10,279** (sibling `figTest/draw-transport-research/`).
- A **25,000** byte `code` in a **single** `call_mcp` invocation from this **Agent** interface was **not** completed (embedding the full **~25.4k** UTF-8 serialized `arguments` in one assistant **tool** call hits **output** / **bridge** limits here); the **on-disk** probe is still valid. Re-try 25k in **Composer** (or a non-model client) to raise `maxProvenSize` toward **25,429+**; full narrative in [solution architecture §3.3, §5](./mcp-transport-solution-architecture-2026.md).

**Recorded proof**

- **Example draw dir (this spike):** `figTest/draw-transport-research/.transport-proof.json` on the machine that ran the probe (sibling folder to this repo; add that tree to the workspace if you need `Read` access from Cursor). The file includes `maxProvenSize` for successful `--record` calls and `sessionContext` / `onDisk25kProbe` metadata for 25k disk validation and follow-up.
- **End-to-end Figma (real `fileKey`, not the synthetic `PROBE_` key):** Use `probe-parent-transport.mjs --file-key <key>`. For Foundations file `uCpQaRsW4oiXW3DsC6cLZm`, a parent `use_figma` with the emitted probe returned `{"ok":true,"observedCodeBytes":2000,"probe":"parent-transport"}` (2000B `code`, 2198B full args). The **25k** variant for the same file is `probe-args-real-25k.json` (25429B); one parent `Read` + `use_figma`, then `--record --size 25000 --observed-bytes 25429` on success. Total `--observed-bytes` may differ by a few bytes if `fileKey` length changes.
- If you re-run: `node scripts/probe-parent-transport.mjs --record --size 25000 --observed-bytes 25435 --target <draw-dir>` after a **parent** 25k `call_mcp` succeeds (Figma file error or `ok: true` in plugin return) — use the script’s printed `total-mcp-args` for the exact `--observed-bytes` value.

**Claude Code A/B (optional, same day)**

- Not run in this session. To compare, repeat **Read** + **one** `use_figma` with the same `probe-args.json` in Claude Code; compare error class (JSON vs Figma) and byte counts.

**Gate**

- Infrastructural “can’t send N bytes” is **not** supported by our Phase 0 evidence for **N ≤ 5,000** `code` on this host. Full **25k** parent proof is still the recommended next step; absence of 25k in one automated run is **not** a license to default `Task` runners without [`probe-parent-transport`](../../scripts/probe-parent-transport.mjs) and proof.

---

## Phase 1 — Cursor host ( `@file` , non-LLM MCP invoke )

**1.1 — `@file` in MCP tool `code` (or full args)**

- **Official Cursor MCP docs** ([cursor.com/docs/mcp](https://cursor.com/docs/mcp)) describe transports (`stdio`, SSE, HTTP), `mcp.json`, OAuth, and Resources — **not** a feature where the agent passes `@path` inside tool arguments to avoid large JSON. Chat “context @file” is separate from **tool-argument** indirection.
- **Spike result (documentation review, Apr 2026):** treat **`@file` inside `use_figma.code` as not supported** unless a future Cursor or Figma MCP release documents it. The shipping Figma tool schema has **only** inline `code` (see `mcps/**/use_figma.json` in the project’s MCP tree).

**1.2 — Non-model / CLI `call_mcp` with a JSON file path**

- Cursor’s documented workflow is **MCP in Agent chat**; debugging involves running the **server’s** `command` from `mcp.json` in a shell to see stdio/HTTP errors — **not** a supported “invoke tool with args file” one-liner in the public docs.
- **Implication:** CI/human paths that bypass the model still have to get a full `use_figma` payload onto the wire (custom stdio client, or a **proxy** — Phase 3).

**1.3 — 08 / EXECUTOR after 1.1**

- **No** change to the default “parent `Read` → `call_mcp` with full object” contract; any future `@file` or `codePath` support would need an explicit Figma/Cursor schema update before skills assume it.

---

## Phase 2 — Gzip + base64 in the Figma plugin VM

- [`skills/create-component/conventions/08-cursor-composer-mcp.md`](../../skills/create-component/conventions/08-cursor-composer-mcp.md) **already** states the plugin sandbox does **not** expose `fetch`, and names **`atob` / `DecompressionStream`**-style workarounds as an anti-pattern for assembled slices.
- **Policy (unchanged):** do **not** add a gzip+base64 default to [`scripts/assemble-slice.mjs`](../../scripts/assemble-slice.mjs) unless [`AGENTS.md`](../../AGENTS.md) is updated with a measured exception and a proven decoder path in the Figma plugin environment. The **2026-04-27** file-proxy + docs milestone **did not** change `assemble-slice` defaults; any future **`--compress-code`**-style flag stays a **separate** research ticket after `DecompressionStream` and cap semantics are measured in-plugin.
- **50k cap:** Figma’s tool schema applies to the **as-passed** `code` string (`maxLength` 50,000 in the published descriptor). Base64 would **grow** the script body, not shrink the wire through the same string — so “base64 to beat the 50k cap” is a non-starter unless the host adds a different parameter.

---

## Phase 3 — File-path proxy + upstream Figma MCP

**Integration**

- Marketplace Figma MCP in Cursor uses **Streamable HTTP** to **https://mcp.figma.com/mcp** with **OAuth** (see Cursor docs). The connector is not exposed as a trivial **stdio** command the repo can `spawn` to “chain” a second custom server in front of the same session without replicating OAuth and protocol details.

**Go / no-go**

- **Chaining a local stdio proxy to Cursor’s *internal* Figma server instance:** **No** in current architecture — the parent agent does not have a public API to forward arbitrary bytes to the already-authenticated Figma session.
- **A standalone local MCP that reads a file and calls Figma’s HTTP MCP** with a **user-supplied** bearer token: **Shipped** as [`../tools/mcp-figma-file-proxy`](../tools/mcp-figma-file-proxy/README.md) (`use_figma_from_mcp_args_file`); auth model in [`mcp-figma-proxy-auth-spike.md`](./mcp-figma-proxy-auth-spike.md). Still duplicates token handling vs the IDE connector — optional only.

---

## Phase 4 — Build specs (this repo)

- [`AGENTS.md`](../../AGENTS.md) — pointer to this research and fallback doc.
- [`skills/create-component/EXECUTOR.md`](../../skills/create-component/EXECUTOR.md) — short pointer.
- [`skills/create-component/conventions/08-cursor-composer-mcp.md`](../../skills/create-component/conventions/08-cursor-composer-mcp.md) — research pointer (gzip section unchanged as normative).
- [`tools/mcp-figma-file-proxy/README.md`](../tools/mcp-figma-file-proxy/README.md) — optional stdio package (go/no-go on chaining Cursor above unchanged).
- [`CHANGELOG.md`](../../CHANGELOG.md) — one-liner for transport documentation.

---

## Phase 5 — Fallbacks and ownership

- **Runbook (Cursor):** [`docs/mcp-transport-cursor-fallback.md`](../mcp-transport-cursor-fallback.md).
- **MCP registration** for any proxy remains **per developer** in `.cursor/mcp.json` (not committed with secrets).
- If skills text changes, run `npm run sync-cache` and `npm run verify` per [`AGENTS.md`](../../AGENTS.md).

---

## Risks (for later specs)

- **Proxy maintenance** vs upstream Figma MCP.
- **Dual tools** — `use_figma` vs a hypothetical `use_figma_from_file` must stay clear in [`create-component-figma-slice-runner`](../../skills/create-component-figma-slice-runner/SKILL.md) defaults; parent path remains default.
- **Verification** — `scripts/check-use-figma-mcp-args.mjs` on any file a proxy would read before forward.

---

## Artifacts (paths)

| Item | Path |
|------|------|
| Transport proof (example) | Sibling `figTest/draw-transport-research/.transport-proof.json` (not in this repo) |
| 25k probe args (example) | Sibling `figTest/draw-transport-research/probe-args.json` |
| Probe script | [`scripts/probe-parent-transport.mjs`](../../scripts/probe-parent-transport.mjs) |
| Full args check | [`scripts/check-use-figma-mcp-args.mjs`](../../scripts/check-use-figma-mcp-args.mjs) |
| Optional proxy notes | [`tools/mcp-figma-file-proxy/README.md`](../../tools/mcp-figma-file-proxy/README.md) |
