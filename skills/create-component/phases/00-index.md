# create-component / phases / 00 — Index (ordered run)

**Purpose:** Time-ordered **orchestration** for `/create-component`. For rules and geometry, see [`conventions/`](../conventions/00-overview.md). For step numbers, assembly, and MCP caps, see [`EXECUTOR.md`](../EXECUTOR.md). If anything here disagrees with **EXECUTOR** or **conventions**, **EXECUTOR + conventions win.**

**Linear rule:** There are **ten** phases **01–10**. **Finish phase N completely** (including merges, handoffs, and — for phase 10 — closeout) **before** opening phase **N+1**. **No parallel** work across phases.

**Draw ladder (phases 04–10):** **Scaffold first** — phase **04** is **`cc-doc-scaffold`** (doc shell + placeholder table + dashed reserves); phase **05** is **`cc-variants`** (staging `COMPONENT`s). Then **component** → **props** → matrix → usage → finalize + closeout in **10**. Transport: [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md).

**Inline / preassembled** Step 6 → [`EXECUTOR.md`](../EXECUTOR.md) **§0** — still finish prep **01–03** first; monolithic draw still builds variants before the doc tail inside **one** script execution (implementation detail); the **seven-slice** ladder is the canonical **scaffold → variants → …** order.

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
| 07 | [`07-slice-cc-doc-props.md`](./07-slice-cc-doc-props.md) | 08 |
| 08 | [`08-slice-cc-doc-matrix.md`](./08-slice-cc-doc-matrix.md) | 09 |
| 09 | [`09-slice-cc-doc-usage.md`](./09-slice-cc-doc-usage.md) | 10 |
| 10 | [`10-slice-cc-doc-finalize.md`](./10-slice-cc-doc-finalize.md) | *(component done)* |

---

## Flow

```mermaid
flowchart LR
  P01[01-setup] --> P02[02-install]
  P02 --> P03[03-figma-prep]
  P03 --> P04[04-scaffold]
  P04 --> P05[05-variants]
  P05 --> P06[06-component]
  P06 --> P07[07-props]
  P07 --> P08[08-matrix]
  P08 --> P09[09-usage]
  P09 --> P10[10-finalize-plus-closeout]
```

DAG detail and `handoffJson`: [`conventions/13-component-draw-orchestrator.md`](../conventions/13-component-draw-orchestrator.md) **§1**–**§4**.
