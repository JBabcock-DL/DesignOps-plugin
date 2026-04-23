# create-component / phases / 00 — Index (ordered run)

**Purpose:** Time-ordered **orchestration** for `/create-component`. For rules and geometry, see [`conventions/`](../conventions/00-overview.md). For step numbers, assembly, and MCP caps, see [`EXECUTOR.md`](../EXECUTOR.md). If anything here disagrees with **EXECUTOR** or **conventions**, **EXECUTOR + conventions win.**

**Phases 04–10** decompose **EXECUTOR Step 6** (one `Task` + one `use_figma` per phase via [`create-component-figma-slice-runner`](../../create-component-figma-slice-runner/SKILL.md)) — same idea as style-guide work split across 15a / 15b / 15c, not a single opaque “draw” step.

**Inline / preassembled** Step 6 (no seven `Task`s) → [`EXECUTOR.md`](../EXECUTOR.md) **§0** items 2a / 2b — not a separate phase file in v1.

---

## Phase list (read in order)

| # | File | What happens |
|---|------|----------------|
| 01 | [`01-setup.md`](./01-setup.md) | List, `tokens.css`, shadcn init, icon-pack (EXECUTOR 1–3, 3b) |
| 02 | [`02-install.md`](./02-install.md) | Install, peer audit, icon rewrite, token preflight, Mode A/B CONFIG (EXECUTOR 4, 4.3, 4.4, 4.7; SKILL §4.5) |
| 03 | [`03-figma-prep.md`](./03-figma-prep.md) | `fileKey`, registry / preamble injection (EXECUTOR 5; SKILL 5.1) |
| 04 | [`04-slice-cc-variants.md`](./04-slice-cc-variants.md) | First draw slice: `cc-variants` |
| 05 | [`05-slice-cc-doc-scaffold.md`](./05-slice-cc-doc-scaffold.md) | `cc-doc-scaffold` — doc frame + **Properties** table shell with **placeholder** body rows |
| 06 | [`06-slice-cc-doc-props.md`](./06-slice-cc-doc-props.md) | `cc-doc-props` — **fill** table cells from `CONFIG.properties` in place |
| 07 | [`07-slice-cc-doc-component.md`](./07-slice-cc-doc-component.md) | `cc-doc-component` |
| 08 | [`08-slice-cc-doc-matrix.md`](./08-slice-cc-doc-matrix.md) | `cc-doc-matrix` |
| 09 | [`09-slice-cc-doc-usage.md`](./09-slice-cc-doc-usage.md) | `cc-doc-usage` |
| 10 | [`10-slice-cc-doc-finalize.md`](./10-slice-cc-doc-finalize.md) | `cc-doc-finalize` (then §9 on this return) |
| 11 | [`11-closeout.md`](./11-closeout.md) | §9, registry 5.2, reporting (EXECUTOR 7; SKILL §8) |

---

## Flow

```mermaid
flowchart LR
  P01[01-setup] --> P02[02-install]
  P02 --> P03[03-figma-prep]
  P03 --> P04[04-cc-variants]
  P04 --> P05[05-cc-doc-scaffold]
  P05 --> P06[06-cc-doc-props]
  P06 --> P07[07-cc-doc-component]
  P07 --> P08[08-cc-doc-matrix]
  P08 --> P09[09-cc-doc-usage]
  P09 --> P10[10-cc-doc-finalize]
  P10 --> P11[11-closeout]
```

DAG order and handoff rules: [`conventions/13-component-draw-orchestrator.md`](../conventions/13-component-draw-orchestrator.md) **§1**–**§4**.
