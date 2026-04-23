# MCP multi-step doc pipeline (target architecture)

**Audience:** Maintainers and agents implementing the min-slice ladder ([`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md) + parent orchestrator [§13](./13-component-draw-orchestrator.md)) and the `build-min-templates.mjs` outputs those slices consume. **Canonical canvas geometry** for what each step draws stays in [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md).

**Purpose:** Keep each Figma MCP `use_figma` **`code`** payload **small and fast** by splitting work into **separate Plugin API runs**, each carrying only the helpers needed for that slice. This is **not** the same as “two phases that both upload the full engine” — each step should ship a **dedicated min bundle** (or a gated slice) so **no** call pays for unrelated sections.

**Authority:** [`SKILL.md`](../SKILL.md) wins on CONFIG and §9. This file wins on **dependency order** and **handoff** between min-slice calls. **Default transport** is **seven** `use_figma` invocations in the **parent** ([§13](./13-component-draw-orchestrator.md) DAG, assembly per [slice runner §0.1](../create-component-figma-slice-runner/SKILL.md)) — one variant slice + **six** doc slices including **scaffold** then **table fill** before component/matrix/usage. **Do not** default to `Task` subagents for payloads they cannot `call_mcp`. **Parent** two-phase or single-call full engine — [`EXECUTOR.md`](../EXECUTOR.md) **§0** (same bytes).

**See also** — line-level `CONFIG` / phase map, preamble deps, and shared-prefix constraints for **phase-scoped config objects:** [`10-phased-payload-research.md`](./10-phased-payload-research.md).

---

## 1 — Dependency order (must not be violated)

The **Variants × States matrix** needs live `InstanceNode`s of the ComponentSet’s variant masters. Therefore:

| Order | Step (name) | What it does | Hard dependency |
|------|----------------|--------------|-----------------|
| **0** | **Variant plane** | Clear page (except `_Header`), build variant masters, `combineAsVariants`, expose `compSet`, `propsAdded`, `variantByKey` | CONFIG + preamble + archetype builder for `CONFIG.layout` |
| **1** (shipped) | **Scaffold: page + header + table placeholders** | `_PageContent`, `docRoot`, title + summary, properties table with **`properties.length` placeholder** rows — `doc.step1` | Phase **2** globals + `compSet` from step **0**; no `__CC_HANDOFF_*` |
| **2** (shipped) | **Fill properties table** | In-place cell text from `CONFIG.properties` — `doc.step2` | **Handoff** from step **1** |
| **3** | **Component section** | Section + **reparent** `ComponentSet` (`§6.6B`) | Same handoff chain |
| **4** | **Variants × States matrix** | Matrix + `applyStateOverride` (`§6.7`) | Same handoff chain |
| **5** | **Usage Do / Don’t** | Two cards (`§6.8`) | Same handoff chain |
| **6** | **Finalize** | §6.9 + `returnPayload` | Same handoff chain |

**Note:** **Steps 1–2** surface the “documentation scaffold with placeholders, then **fill the table**, then add **each** later section (component → matrix → usage → finalize)” on the canvas. Single-pass: `__ccDocStep === null` in [`04`](./04-doc-pipeline-contract.md) **§2.2.1** path B.

### 1.1 — Layout preservation (do not “grenade” the table)

Splitting work across calls is **not** permission to ship an empty auto-layout tree. Empty bodies collapse to tiny strips and break **1640px** alignment — the same failure modes as [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) §2.1–§2.2.

**Agents and runners must:**

- Keep the **properties table shell** (group + 1640px table + uppercase **header row**) from the first step that touches the doc. **Shipped multistep:** step **1** = placeholder body rows, step **2** = in-place **fill** only — see [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) **§2.2.1** paths A–C. Do not leave a header floating over a vacuum.
- Reserve **section frames** for header, component-set-group, matrix, and usage early enough that **`docRoot` child order and `itemSpacing`** match the final five-section stack; use short placeholder copy or empty titled frames with **explicit sizing hints** where the template would otherwise collapse.
- **Never** delete and redraw the whole table mid-ladder just to “add rows” unless you are intentionally resetting the page; prefer in-place updates so column widths and bindings stay stable.

Canonical detail: **04** §2.2 and §4 (table row invariants).

---

## 2 — Handoff object (between `use_figma` calls)

The **runner** (or parent, if inline) is responsible for **JSON-serializing** handoffs into injected globals on the next call. Shape (evolve with implementation):

```jsonc
{
  "fileKey": "<same file>",
  "step": 3,
  "pageContentId": "123:456",
  "docRootId": "123:789",
  "propertiesTableGroupId": "…",
  "compSetId": "…",
  "propsAdded": { "label": false, "leadingIcon": false, "trailingIcon": false },
  "variantByKey": { "unchecked": "nodeId", "checked=true": "nodeId" },
  "unresolvedTokenMisses": []
}
```

**Rules:**

- **Never** guess ids — only ids returned from the previous step’s `return` payload or from `figma` after a successful run.
- **`variantByKey`** may be omitted if the next bundle recomputes from `compSet.children` + `CONFIG.sizes` (same logic as today’s phase-2 head).
- Keep handoff **small**; large blobs belong in **committed bundles**, not chat.

---

## 3 — Bundle strategy (build system)

**Shipped (`npm run build:min`):**

| Artifact | Role |
|----------|------|
| `create-component-engine-{layout}.step0.min.figma.js` | Per archetype — variant plane only (truncates at `__CREATE_COMPONENT_ENGINE_SPLIT_PHASE2__`). ~14–21 KB. |
| `create-component-engine-doc.step1.min.figma.js` … **`step6`** | **Layout-agnostic** — slim phase-2 doc ladder: `stripDocSlimChipBuilder` + `stripDocSlimVariantElse` in `scripts/build-min-templates.mjs` removes chip `buildVariant`, archetype builders, and the variant-build `else` branch; **terser** (`compress.unused`) drops dead doc-step branches so sizes **vary by step** (run `npm run qa:step-bundles` for current numbers; vs ~32–38 KB full engine). |

**Ideal (future):** per-step size differentiation via esbuild `build` graph or hand-split helpers.

[`draw-engine.figma.js`](../templates/draw-engine.figma.js): markers `__CC_DOC_SLIM_OMIT_*` + phase-2-only asserts; `__CREATE_COMPONENT_ENGINE_SPLIT_PHASE2__` remains the **step 0** cut line.

---

## 4 — Runner contract (behavior)

1. **Seven-slice path:** When step bundles exist, the **parent** runs **seven** `use_figma` invocations in DAG order, assembly per [`create-component-figma-slice-runner` §0.1 / §2](../../create-component-figma-slice-runner/SKILL.md): **cc-variants (step0)** then **doc steps 1 → 6**, **`check-payload`** (and full MCP args check if used) **per call**; the parent **merges** the next `handoffJson`. **Default:** parent carries each `use_figma` — not `Task` when the subagent cannot emit full tool args. Optional `Task` per slice only if the host is **proven** to support it.
2. **Parent thread:** Passes **`configBlock`** + **`layout`** + registry + **handoff state** — **never** `Read`s all step min bundles into the main thread.
3. **§9:** Final assertions run on the **return payload of the last doc step** (`cc-doc-finalize` / step 5, or the final `use_figma` in an inline run), with the same fields as [`SKILL.md`](../SKILL.md) §9.

---

## 5 — Anti-patterns

- **One giant `code` string** that includes variant build **and** full doc pipeline for every MCP call.
- **Duplicating** the same ~30K min engine on “phase 1” and “phase 2” when both uploads could instead use **different** trimmed bundles.
- **Starting the matrix** before the ComponentSet exists or before `variantByKey` is consistent.
- **Renaming** doc sections or column headers — still governed by [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md).
- **Header-only or empty-body properties tables** in an intermediate step — layout will collapse; use **placeholder rows** and the same row/cell rules as production until real data is bound (§1.1, **04** §2.2).

---

## 6 — Cross-references

| Topic | Where |
|--------|--------|
| Doc frame section order and naming | [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) |
| EXECUTOR quickstart + 50k cap | [`../EXECUTOR.md`](../EXECUTOR.md) |
| Orchestrator (parent) + slice runner | [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md), [`../../create-component-figma-slice-runner/SKILL.md`](../../create-component-figma-slice-runner/SKILL.md) |
| Cursor / Composer transport | [`08-cursor-composer-mcp.md`](./08-cursor-composer-mcp.md) |
| Generic MCP workflow | [`../../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
