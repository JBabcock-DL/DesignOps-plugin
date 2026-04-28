# Component draw orchestrator (parent thread)

This document is the **runbook** for **Step 6**: **one** sequential `use_figma` per machine slug in [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs) (default: **12** base slugs — five scaffold + `cc-variants` + six doc-sequence slugs including **two** `cc-doc-props-*` chunks that share the step3 engine), each assembled per [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md) **§0.1 / §2**. You may **extend** the ladder with **more** slugs for smaller payloads — see [`19-micro-phase-ladder.md`](./19-micro-phase-ladder.md) (row/cell granularity, layout invariants). The **parent** owns scheduling, merges `handoffJson` between calls, returns for `SKILL.md` §9, and registry **5.2**. **Do not** default to `Task` subagents for slices whose **full** `code` the subagent cannot pass in `call_mcp` (common for ~26–30K+ payloads) — see [`../EXECUTOR.md`](../EXECUTOR.md) **§0**. The **parent** may `Read` min engines and preamble in the main thread for this path. **Transport + ephemeral staging:** **[`21`](./21-mcp-ephemeral-payload-protocol.md)**; **`designops-step6-engine` manifests:** **[`23`](./23-designops-step6-engine.md)**; session policy **`AGENTS.md`**.

**Non-negotiables (imported, do not paraphrase away):** [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) **§2.2–2.2.1** — no empty table bodies, no “delete the whole table to add rows” mid-ladder, placeholder row geometry as needed so the 1640px table layout does not collapse. **Scaffold → component → fill:** the first doc slice places the **Properties** table with **placeholder** body rows and dashed reserves; **`cc-doc-component`** lands the live ComponentSet; **`cc-doc-props-1`** / **`cc-doc-props-2`** **fill** cell text in place only (see [04](./04-doc-pipeline-contract.md) **§2.2.1**).

---

## 1 — Fixed DAG (machine order)

Run **exactly** this sequence, **in order** — **sequential only**: one slice finishes (handoff merged on disk) before the **next** `use_figma` starts. **Do not** run draw slices **in parallel**, batch them, or overlap them with unrelated canvas `use_figma` in the same parent turn. The order is a **hard dependency chain** (**scaffold → variants** → **component** → **fill (props)** → matrix → usage → finalize), not an optimization hint.

**`cc-doc-scaffold-shell` is always first** among the draw slugs. By the time **`cc-doc-scaffold-placeholders`** completes, `_PageContent`, the header, placeholder **Properties** table, and dashed section reserves exist **before** `cc-variants` adds the staging frame. **Intermediate canvas states** after each scaffold sub-slice (must stay valid per **04** §2.2 for the union of completed slugs):

| Slug (order) | Figma result after the slice | Notes |
|-------------|-----------------------------|--------|
| `cc-doc-scaffold-shell` | `_PageContent` on the page; `doc/component/<name>` root frame; **no** header, table, or dashed reserves yet | Ids for `pageContentId` + `docRootId` are valid for the next handoff. |
| `cc-doc-scaffold-header` | Header frame + title + summary under `docRoot` | No table; placeholder row count not required until table slices. |
| `cc-doc-scaffold-table-chrome` | **Properties** group, table frame, **header** row only (no body) | Figma return should include `propertiesTableId` for the table node so the body slice can `append` rows. |
| `cc-doc-scaffold-table-body` | **N** placeholder body rows (N = `CONFIG.properties.length`) | Requires prior merge with `doc.propertiesTableId`. Matches step1 table contract (with chrome) before `cc-variants`. |
| `cc-doc-scaffold-placeholders` | Three dashed reserve frames under `docRoot` (component-set, matrix, usage) | Same end state as the legacy **one-call** `create-component-engine-doc.step1` / single-merge scaffold before variants. |

**`cc-variants` runs only after** the last scaffold row (`cc-doc-scaffold-placeholders` merged). The global DAG is unchanged: all scaffold sub-slugs complete before `cc-variants`.

Do not skip, reorder, or interleave. On any `ok: false` from a slice, **stop**; do not start the next slug. **Scaffold (5 `use_figma` calls):** one phase file covers the run — [`phases/04-slice-cc-doc-scaffold.md`](../phases/04-slice-cc-doc-scaffold.md). **Later rows:** through [`11-slice-cc-doc-finalize.md`](../phases/11-slice-cc-doc-finalize.md) (one machine slug per `use_figma` for doc steps `cc-doc-component` … `cc-doc-finalize`).

1. `cc-doc-scaffold-shell` — `_PageContent` + `doc` root
2. `cc-doc-scaffold-header` — title + summary
3. `cc-doc-scaffold-table-chrome` — **Properties** group, table frame, header row (no body rows)
4. `cc-doc-scaffold-table-body` — **N** placeholder body rows (append to table from chrome; merge must supply `doc.propertiesTableId` for the next `assemble-slice`)
5. `cc-doc-scaffold-placeholders` — dashed reserves for later sections — [`phases/04-slice-cc-doc-scaffold.md`](../phases/04-slice-cc-doc-scaffold.md) (orchestrates 1–5)
6. `cc-variants` — variant plane (staging `COMPONENT`s in `_ccVariantBuild/…`) — [`phases/05-slice-cc-variants.md`](../phases/05-slice-cc-variants.md)
7. `cc-doc-component` — live ComponentSet into doc — [`phases/06-slice-cc-doc-component.md`](../phases/06-slice-cc-doc-component.md)
8. `cc-doc-props-1` — **first half** of Properties table rows (in place) — [`phases/07-slice-cc-doc-props-1.md`](../phases/07-slice-cc-doc-props-1.md)
9. `cc-doc-props-2` — **second half** of rows (same `create-component-engine-doc.step3` engine; `assemble-slice` sets `__CC_PROPS_ROW_*__`) — [`phases/08-slice-cc-doc-props-2.md`](../phases/08-slice-cc-doc-props-2.md)
10. `cc-doc-matrix` — Variants × States matrix — [`phases/09-slice-cc-doc-matrix.md`](../phases/09-slice-cc-doc-matrix.md)
11. `cc-doc-usage` — Do / Don’t — [`phases/10-slice-cc-doc-usage.md`](../phases/10-slice-cc-doc-usage.md)
12. `cc-doc-finalize` — finalize + `returnPayload` for §9 — [`phases/11-slice-cc-doc-finalize.md`](../phases/11-slice-cc-doc-finalize.md)

**Twelve** `use_figma` invocations for one component draw (parent default): **five** for scaffold (tuple ops + op-interpreter) + **one** for variants (`step0`) + **two** for Property fills (`step3` **×2** with row-range globals) + **three** for matrix / usage / finalize (`step4`…`step6`). Optional **one** `Task` per slug only if the subagent can emit the full tool args; otherwise stay in the parent.

---

## 2 — Friendly aliases (UX / docs)

| Friendly alias (what humans say) | Machine slug (`step=` in assembly / `Task` prompt) |
|----------------------------------|----------------------------------------|
| Doc shell (page + root) | `cc-doc-scaffold-shell` |
| Doc header (title + summary) | `cc-doc-scaffold-header` |
| Properties table (chrome) | `cc-doc-scaffold-table-chrome` |
| Properties table (body rows) | `cc-doc-scaffold-table-body` |
| Dashed section reserves | `cc-doc-scaffold-placeholders` |
| Variant plane (staging components) | `cc-variants` |
| Component section (reparent) | `cc-doc-component` |
| Properties table (fill, first half of rows) | `cc-doc-props-1` |
| Properties table (fill, second half of rows) | `cc-doc-props-2` |
| Variants × States matrix | `cc-doc-matrix` |
| Do / Don’t (usage) | `cc-doc-usage` |
| Finalize (full return) | `cc-doc-finalize` |

**Implementation note:** The five scaffold sub-slugs together replace the legacy single step `create-component-engine-doc.step1` (header + table with `…` placeholders + reserves). `cc-doc-component` is `step2` (ComponentSet into doc). **`cc-doc-props-1` / `cc-doc-props-2`** are both **`step3`** (in-place cell updates) with `__CC_PROPS_ROW_START__` / `__CC_PROPS_ROW_END__` from [`assemble-slice.mjs`](../../../scripts/assemble-slice.mjs). `cc-doc-finalize` is `step6` — min bundle map in [slice runner §2](../../create-component-figma-slice-runner/SKILL.md).

---

## 3 — Parent materializes per draw

Before the first slice, the parent (after Steps 1–5, 4.7) has:

- `fileKey`, `layout` (= `CONFIG.layout`), `createComponentRoot` (path to `skills/create-component/`), `configBlock` (verbatim `const CONFIG = { … };`), registry per [`create-component-figma-slice-runner`](../create-component-figma-slice-runner/SKILL.md) **§0**.

**`layout` filename mapping:** the committed step0 file uses `create-component-engine-<name>.step0.min.figma.js` where `<name>` is `chip`, `surface-stack`, `field`, `row-item`, `tiny`, `control`, `container`, or `composed` when `CONFIG.layout === '__composes__'`.

Each slice (parent assembly or optional `Task` prompt) must have: `step` (slug), `fileKey`, `layout`, `createComponentRoot`, `configBlock`, registry fields, and **`handoffJson`** (see §4) — a single JSON object string or fenced block, updated from the **previous** slice return.

---

## 4 — `handoffJson` shape (between slices)

`handoffJson` is **the parent’s** serialized state; the slice runner only **injects** it as globals. Start with the empty object **`{}` before** `cc-doc-scaffold-shell` (first draw slice).

**Checkpoint (`phase-state.json` — default next to `handoff.json` on disk):** After each successful slice, run [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs) — it writes **`phase-state.json`** with `nextSlug`, `completedSlugs`, `lastCodeSha256`, and `lastSliceOk` for resuming without chat context. The merge script **rejects** out-of-DAG or duplicate step merges (exits 13 / 14). If `nextSlug` is non-null, the agent can continue from that slice using the on-disk `handoff.json` plus `Read` the matching phase file (see [`phases/04`](../phases/04-slice-cc-doc-scaffold.md)–`11` resume lines). After `cc-doc-finalize`, `nextSlug` is `null`.

**After the first successful scaffold sub-slice that returns** `pageContentId` and `docRootId` (shell), copy them into `handoffJson.doc` and refresh after every merge through **`cc-doc-scaffold-placeholders`** and all later slices.

**After `cc-variants` succeeds** (fifth draw slice in [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs)), copy from the `use_figma` return into `handoffJson.afterVariants` at minimum:

- `variantHolderId` (string) — staging `FRAME` id for `__PHASE_1_VARIANT_HOLDER_ID__` (loose variant `COMPONENT`s; **no** `COMPONENT_SET` until `cc-doc-component`)
- `propsAdded` (object) — for `__CC_PHASE1_PROPS_ADDED__`
- `unresolvedTokenMisses` (array) — for `__CC_PHASE1_UNRESOLVED__` (or `[]`)

**After every subsequent doc slice** (`cc-doc-component` … `cc-doc-finalize`), refresh `handoffJson.doc` — at least `pageContentId`, `docRootId` from each return. **`compSetId`** is added to `doc` **starting with the `cc-doc-component` return** (`combineAsVariants` into the doc section). **Doc steps 4–6** (matrix / usage / finalize) need `doc.compSetId` for `__CC_HANDOFF_COMP_SET_ID__`; **scaffold** (step 1) omits it; **`cc-doc-props-1` / `cc-doc-props-2`** (step 3) run after component and **should** carry merged `compSetId` for a consistent handoff chain.

**Config slice:** the parent **does not** split `configBlock` per step in v1; the same verbatim `const CONFIG` is passed to every slice. If a future build introduces step-specific `CONFIG` trimming, that would be an explicit follow-up; until then, one block for all **12** `use_figma` invocations in the default ladder.

---

## 5 — After the ladder

When `cc-doc-finalize` returns `ok: true`, run **`SKILL.md` §9** and **Step 5.2** registry on **that** return payload only (final slice; same assertions as a full inline two-phase or single-call run would surface on the last `use_figma` return). **Procedure** is **Part B** of [`phases/11-slice-cc-doc-finalize.md`](../phases/11-slice-cc-doc-finalize.md) — same phase file as the finalize slice; finish Part A before Part B.

### 5.1 — One machine slug, one Figma call, one optional `Task` (never batch doc legs)

- **One** machine `step` = **one** `use_figma` = **one** Figma return (and one writer output / merge if you merge after each call). **Do not** put **`cc-doc-props-1`**, **`cc-doc-props-2`**, **`cc-doc-matrix`**, **`cc-doc-usage`**, and **`cc-doc-finalize`** into a **single** `Task` prompt to “save turns” — you lose a clear per-slice success trail and on-disk return files.
- If you use **`Task`** for any slice, use **at most one `Task` per slug**; the **parent** runs [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs) and advances `handoffJson` **between** tasks. Never nest `Task` inside `Task` for the same draw ladder. See [`08-cursor-composer-mcp.md`](./08-cursor-composer-mcp.md) **§D.1** (writer subagent) and [`../EXECUTOR.md`](../EXECUTOR.md) **§0** (parent / preassembled fallbacks).

### 5.2 — Atomic write+merge with `finalize-slice` (recommended Step 6 finalizer)

After the parent's `call_mcp` returns, prefer a single command over a manual `Write` then `merge-create-component-handoff` chain:

```bash
echo '<return-json>' | node scripts/finalize-slice.mjs <slug> handoff.json
```

[`scripts/finalize-slice.mjs`](../../../scripts/finalize-slice.mjs) writes `return-<slug>.json` next to `handoff.json` (canonical name), waits for the file system to flush, then runs the merge with the full DAG / consistency / schema checks. Saves one tool call per slice (×12 slices = **12 fewer round trips per draw** in the default ladder vs manual merge per slice).

For larger returns (>~32 KB on Windows shells), prefer pipe-from-stdin or write the file first and pass `--return-path`. See the script header for all flags.

### 5.3 — Recovering a broken ladder

If a session crashes mid-draw or someone reset `handoff.json={}` after returns existed, run:

```bash
node scripts/resume-handoff.mjs <draw-dir>
```

[`scripts/resume-handoff.mjs`](../../../scripts/resume-handoff.mjs) inspects `handoff.json` + `phase-state.json` + sibling `return-<slug>.json` files, validates DAG contiguity, replays missing merges in order, and prints `next slug: <slug>`. Use `--dry-run` first to preview.

The merge script's own consistency check (exit 15) emits this same command in its remediation message.

### 5.4 — `phase-state.json` schema

[`schema/phase-state.schema.json`](./schema/phase-state.schema.json) is the canonical structure (validated on every merge — exit 18 on violation). Notable rules:

- `lastCodeSha256` must be `null` or a 64-char lowercase hex SHA-256. **Placeholder strings like `"pending"` are rejected** — do not hand-fill the field; let the merge script set it.
- `completedSlugs` must be a contiguous prefix of [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs) ending at `lastSliceOk`.
- `nextSlug` is cross-validated against `lastSliceOk` (must equal `SLUG_ORDER[indexOf(lastSliceOk) + 1]` or `null` at terminal).

If you see exit 18, the file was hand-edited or written by a non-conforming script. Delete it and re-run [`resume-handoff`](../../../scripts/resume-handoff.mjs) to rebuild from the on-disk return files.

---

## 6 — What this supersedes

- **Default** twelve-slice transport: **12** parent `use_figma` invocations (`SLUG_ORDER` in [`merge-create-component-handoff.mjs`](../../../scripts/merge-create-component-handoff.mjs); assembly per `create-component-figma-slice-runner` — this doc). **Optional** `Task` per slice only if subagent **call_mcp** can pass full `code`. Parent **inline** / **preassembled** full-engine work stays in [`EXECUTOR.md`](../EXECUTOR.md) **§0**; do **not** require `Task` when subagents cannot materialize the payload.

**Cross-refs:** [`16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) (canvas vs component slice), [`AGENTS.md`](../../../AGENTS.md) (session runbook).
