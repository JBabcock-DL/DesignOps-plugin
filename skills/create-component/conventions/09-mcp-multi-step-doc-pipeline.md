# MCP multi-step doc pipeline (target architecture)

**Audience:** Maintainers and agents implementing [`create-component-figma-runner`](../../create-component-figma-runner/SKILL.md) + `build-min-templates.mjs`. **Canonical canvas geometry** for what each step draws stays in [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md).

**Purpose:** Keep each Figma MCP `use_figma` **`code`** payload **small and fast** by splitting work into **separate Plugin API runs**, each carrying only the helpers needed for that slice. This is **not** the same as “two phases that both upload the full engine” — each step should ship a **dedicated min bundle** (or a gated slice) so **no** call pays for unrelated sections.

**Authority:** [`SKILL.md`](../SKILL.md) wins on CONFIG and §9. This file wins on **how many MCP calls** the runner makes and **what handoff** passes between them once the build emits step bundles. Until those bundles exist, [`EXECUTOR.md`](../EXECUTOR.md) documents the **interim** consolidated calls.

---

## 1 — Dependency order (must not be violated)

The **Variants × States matrix** needs live `InstanceNode`s of the ComponentSet’s variant masters. Therefore:

| Order | Step (name) | What it does | Hard dependency |
|------|----------------|--------------|-----------------|
| **0** | **Variant plane** | Clear page (except `_Header`), build variant masters, `combineAsVariants`, expose `compSet`, `propsAdded`, `variantByKey` | CONFIG + preamble + archetype builder for `CONFIG.layout` |
| **1** (shipped) | **Page + header + properties** | `_PageContent`, `docRoot`, title + summary (`§6.4`), full properties table (`§6.6`) — one MCP call in current `draw-engine` | Phase **2** globals + live `compSet` from step **0** |
| **2** | **Component section** | Section frame + captions + **reparent** live `ComponentSet` into the doc (`§6.6B`) | Handoff: `pageContentId`, `docRootId`, `compSetId` |
| **3** | **Variants × States matrix** | Full matrix grid + instance cells + `applyStateOverride` (`§6.7`) | Same handoff chain |
| **4** | **Usage Do / Don’t** | Two cards (`§6.8`) | Same handoff chain |
| **5** | **Finalize** | §6.9 checks + full skill `returnPayload` | Same handoff chain |

**Note:** The narrative “properties skeleton” vs “doc header” as **two** calls is still valid for placeholders (§1.1 / **04** §2.2); the **committed** engine merges header + table into **step 1** to match canvas order and reduce handoff surface.

### 1.1 — Layout preservation (do not “grenade” the table)

Splitting work across calls is **not** permission to ship an empty auto-layout tree. Empty bodies collapse to tiny strips and break **1640px** alignment — the same failure modes as [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) §2.1–§2.2.

**Agents and runners must:**

- Keep the **properties table shell** (group + 1640px table + uppercase **header row**) from the first step that touches the doc; if data rows come later, insert **placeholder body rows** with real row geometry (`minHeight`, `textAutoResize: 'HEIGHT'`, filler like `—` or `…`) and **replace** cell content (or swap rows) when props are available — do not leave a header floating over a vacuum.
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
| `create-component-engine-doc.step1.min.figma.js` … **`step5`** | **Layout-agnostic** — slim phase-2 doc ladder: `stripDocSlimChipBuilder` + `stripDocSlimVariantElse` in `scripts/build-min-templates.mjs` removes chip `buildVariant`, archetype builders, and the variant-build `else` branch; **terser** (`compress.unused`) drops dead doc-step branches so sizes **vary by step** (typically **~17 KB** steps **1** / **~17.5 KB** **2–4** / **~23 KB** **5** committed bytes including banner — run `npm run qa:step-bundles` for current numbers; vs ~32–38 KB full engine). |

**Ideal (future):** per-step size differentiation via esbuild `build` graph or hand-split helpers.

[`draw-engine.figma.js`](../templates/draw-engine.figma.js): markers `__CC_DOC_SLIM_OMIT_*` + phase-2-only asserts; `__CREATE_COMPONENT_ENGINE_SPLIT_PHASE2__` remains the **step 0** cut line.

---

## 4 — Runner contract (behavior)

1. **Default:** When step bundles exist, [`create-component-figma-runner`](../../create-component-figma-runner/SKILL.md) runs **`use_figma` once per step** (0 → 5), **`check-payload`** (and full MCP args check if used) **per step**, merges handoff into the next assembly.
2. **Parent thread:** Still passes only **`configBlock`** + **`layout`** + registry paths — **never** the concatenation of all step bundles.
3. **§9:** Final assertions run on the **return payload of the last doc step** (today: phase 2; target: step 5), with the same fields as [`SKILL.md`](../SKILL.md) §9.

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
| Runner orchestration | [`../../create-component-figma-runner/SKILL.md`](../../create-component-figma-runner/SKILL.md) |
| Cursor / Composer transport | [`08-cursor-composer-mcp.md`](./08-cursor-composer-mcp.md) |
| Generic MCP workflow | [`../../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) |
