# create-component / phases / 00 — Index (ordered run)

**Purpose:** Time-ordered **orchestration** for `/create-component`. For rules and geometry, see [`conventions/`](../conventions/00-overview.md). For step numbers, assembly, and MCP caps, see [`EXECUTOR.md`](../EXECUTOR.md). If anything here disagrees with **EXECUTOR** or **conventions**, **EXECUTOR + conventions win.**

**Linear rule:** There are **eleven** phase files **01–11** for time-ordered work: prep **01–03**, then **04–11** for Step 6. **Step 6** is **twelve** machine `use_figma` slugs in [`SLUG_ORDER`](../../../scripts/merge-create-component-handoff.mjs) — not always 1:1 with phase numbers (e.g. **phase 04** is one doc that orchestrates **five** scaffold sub-slugs; **phases 07** + **08** are **two** files for the **two** `cc-doc-props-*` slugs). The ladder is **extensible** — add **`.part2`+** sub-slugs, more scaffold or doc steps, and tuple op splits so each **`use_figma` stays small** (north star **8–10 kB** `code` + wrapper UTF-8, [`18-mcp-payload-budget.md`](../conventions/18-mcp-payload-budget.md)). **Finish phase N completely** (including merges and handoffs) **before** opening phase **N+1** where phases align to slugs. **No parallel** work across concurrent slices in the same component draw.

**Draw ladder (phases 04–11):** **Scaffold first** — phase **04** runs **`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`**. Prefer **as many tiny `use_figma` calls as needed** (one small visible change at a time) so payloads stay in the **8–10 kB** class; phase **05** is **`cc-variants`**. Then **component** → **two props fill phases** (07 + 08) → matrix → usage → **finalize + closeout in 11**. When a base slug is still too large, register **`cc-doc-matrix.part2`-style** steps in the merge DAG **or** add first-class slugs to `SLUG_ORDER` — see [`19-micro-phase-ladder.md`](../conventions/19-micro-phase-ladder.md). Transport: [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md).

**Inline / preassembled** Step 6 → [`EXECUTOR.md`](../EXECUTOR.md) **§0** — still finish prep **01–03** first; monolithic draw still builds variants before the doc tail inside **one** script execution (implementation detail); the **12-slice** ladder is the canonical **scaffold → variants → …** order.

---

## Phase list (strict order)

| Phase | File | Finish this before… |
|------|------|---------------------|
| 01 | [`01-setup.md`](./01-setup.md) | 02 |
| 02 | [`02-install.md`](./02-install.md) | 03 |
| 03 | [`03-figma-prep.md`](./03-figma-prep.md) | 04 |
| 04 | [`04-slice-cc-doc-scaffold.md`](./04-slice-cc-doc-scaffold.md) | 05 |
| 05 | [`05-slice-cc-variants.md`](./05-slice-cc-variants.md) | 06 |
| 06 | [`06-slice-cc-doc-component.md`](./06-slice-cc-doc-component.md) | 07 |
| 07 | [`07-slice-cc-doc-props-1.md`](./07-slice-cc-doc-props-1.md) | 08 |
| 08 | [`08-slice-cc-doc-props-2.md`](./08-slice-cc-doc-props-2.md) | 09 |
| 09 | [`09-slice-cc-doc-matrix.md`](./09-slice-cc-doc-matrix.md) | 10 |
| 10 | [`10-slice-cc-doc-usage.md`](./10-slice-cc-doc-usage.md) | 11 |
| 11 | [`11-slice-cc-doc-finalize.md`](./11-slice-cc-doc-finalize.md) | *(component done)* |

---

## Flow

```mermaid
flowchart LR
  P01[01-setup] --> P02[02-install]
  P02 --> P03[03-figma-prep]
  P03 --> P04[04-scaffold]
  P04 --> P05[05-variants]
  P05 --> P06[06-component]
  P06 --> P07[07-props-1]
  P07 --> P08[08-props-2]
  P08 --> P09[09-matrix]
  P09 --> P10[10-usage]
  P10 --> P11[11-finalize-plus-closeout]
```

DAG detail and `handoffJson`: [`conventions/13-component-draw-orchestrator.md`](../conventions/13-component-draw-orchestrator.md) **§1**–**§4**.
