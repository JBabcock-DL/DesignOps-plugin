# Sync — Step 6 (execute Axis A + canvas chain)

> **When to read:** After Step 5 for `full` / `code-to-figma`.
>
> **Next:** [`07-10-axes-BC.md`](./07-10-axes-BC.md) (Steps 7–10).

---

## Step 6 — Execute Axis A

> **Trigger rule.** Runs for scope `full` and `code-to-figma` only. Its internal branches depend on `plan.A.direction` and on whether the resolved plan writes ≥ 1 token to Figma. Scope `figma-only` uses **Step 6.figma** in [`figma-only-path.md`](./figma-only-path.md) (canvas refresh only, no token push) instead.

### 6.F — Axis A, direction F (Figma wins)

For each token in the MISSING bucket and each token in the CONFLICTS bucket (using the Figma value), update the local token file:

- Write the token back into the same file format it was read from.
- Preserve all existing tokens that were already in sync.
- Report: `Axis A: updated N tokens in <token-file-path>.`

**No canvas redraw runs** — Figma is unchanged.

### 6.C — Axis A, direction C (Code wins)

For each token in the NEW bucket and each token in the CONFLICTS bucket (using the code value), call:

```
PUT /v1/files/:key/variables
```

Payload (Figma Variables bulk write format):

```json
{
  "variableModeValues": [
    { "variableId": "<resolved-or-new>", "modeId": "<mode-id>", "value": "<token-value>" }
  ]
}
```

- For NEW tokens, create the variable in the correct collection before setting its value. Collection inference rules:
  - `color/{ramp}/{stop}` → `Primitives`
  - `Space/*`, `Corner/*`, `elevation/*`, `typeface/*` → `Primitives`
  - `color/{group}/{token}` → `Theme` (write values for both Light and Dark modes)
  - `Display/*`, `Headline/*`, `Title/*`, `Body/*`, `Label/*` → `Typography` (write values for all 8 modes: `85`, `100`, `110`, `120`, `130`, `150`, `175`, `200`)
  - `space/*`, `radius/*` (lowercase) → `Layout`
  - `shadow/*` → `Effects`
- For CONFLICT tokens, update the existing variable's value.
- Report: `Axis A: pushed N tokens to Figma.`

**Canvas chain runs** — proceed to 6.Canvas below.

### 6.R — Axis A, direction R

Apply per-item resolutions from `plan.A.items`:
- Each `F`-resolved item is written to the local token file (same as 6.F but scoped to that item).
- Each `C`-resolved item is pushed to Figma (same as 6.C but scoped to that item).
- Each `S`-resolved item is left untouched and logged as skipped.

Report: `Axis A: pushed N tokens to Figma; updated M tokens in code; skipped K.`

**Canvas chain runs iff ≥ 1 token was actually written to Figma.**

### 6.S — Axis A, direction S

No writes. No canvas redraw. Log: `Axis A: skipped by user (no writes).`

### 6.Canvas — the canvas-redraw chain (blocking)

Runs only when Step 6 wrote **≥ 1 token to Figma** (directions C or R-with-any-C, in 6.C or 6.R). Skipped for 6.F, 6.S, or R-with-zero-Figma-writes.

**Blocking checklist.** The skill cannot end until each of these rows has logged either `done` or `skipped (<reason>)`:

| Step | Log line (example) |
|---|---|
| 9b | `Canvas: Step 9b style guide — done` or `… skipped (reason)` |
| 9d | `Canvas: Step 9d ↳ Token Overview — done` or `… skipped (reason)` |
| 9e | `Canvas: Step 9e Thumbnail Cover — done` or `… skipped (reason)` |

Step numbering (9b / 9d / 9e) is preserved from prior skill versions so existing `create-design-system` cross-references remain valid.

#### 6.Canvas.9b — Redraw affected style guide pages

Inspect the push payload from 6.C / 6.R (the set of tokens actually written). Map each token path to its collection:

| Token path pattern | Collection | Style Guide page to redraw |
|---|---|---|
| `color/{ramp}/{stop}` (e.g. `color/primary/500`) | Primitives | `↳ Primitives` |
| `Space/*`, `Corner/*`, `elevation/*`, `typeface/*` | Primitives | `↳ Primitives` |
| `color/{group}/{token}` (e.g. `color/background/default`) | Theme | `↳ Theme` |
| `Display/*`, `Headline/*`, `Title/*`, `Body/*`, `Label/*` | Typography | `↳ Text Styles` |
| `space/*`, `radius/*` (lowercase) | Layout | `↳ Layout` |
| `shadow/*` | Effects | `↳ Effects` |

Build a deduplicated list of affected pages. Then:

1. **Re-read affected collections from Figma.** `GET /v1/files/:key/variables/local`, filter to only variables in affected collections. Resolve alias tokens. Use the live post-write state — not the pre-diff snapshot.

2. Before any `use_figma` call, **`Read`** [`../../create-design-system/SKILL.md`](../../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§§ **A–G**). Token-bound doc chrome (**§ C**), token-demo bindings (**§ D**), auto-layout hug rules (**§ E**), row hierarchy (**§ F**), and premium visual language (**§ G**) must match that spec.

3. **Reliability — delegate to the canvas runner subagent (parity with create-design-system phase 07):** For each affected page, emit **one `Task(subagent_type: "generalPurpose")`** that loads the [`../../canvas-bundle-runner/SKILL.md`](../../canvas-bundle-runner/SKILL.md) skill with `step=<slug>`, `fileKey`, `description`. The subagent `Read`s the matching `.min.mcp.js` and calls `use_figma` with it verbatim — **this thread must not `Read` the bundle or call `use_figma` for canvas redraws itself** (same rule as [`../../create-design-system/phases/07-steps15a-15c.md`](../../create-design-system/phases/07-steps15a-15c.md) and [`../../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../../create-design-system/conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*). Do **not** invent ad-hoc concatenated scripts, one mega-call across unrelated pages, throwaway `.mcp-*` / `*-payload.json` / scratch `.js` ([`../../../AGENTS.md`](../../../AGENTS.md)). Parse each returned `{ ok, step, pageName, … }` summary and log one checklist row per page.

| If this page is in the affected set | `step` slug (pass to subagent) | Bundle the subagent reads (parent does NOT `Read`) |
|-------------------------------------|--------------------------------|-----------------------------------------------------|
| `↳ Primitives`  | `15a-primitives`    | [`../../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js) |
| `↳ Theme`       | `15b-theme`         | [`../../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js) |
| `↳ Layout`      | `15c-layout`        | [`../../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js) |
| `↳ Text Styles` | `15c-text-styles`   | [`../../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js) |
| `↳ Effects`     | `15c-effects`       | [`../../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js) |

**15c split:** If **Layout**, **Text Styles**, and **Effects** are **all** affected, run **three** sequential subagent Tasks (one `step` slug each, strictly in order) — same ordering as [`../../create-design-system/phases/07-steps15a-15c.md`](../../create-design-system/phases/07-steps15a-15c.md). If only one or two of those pages are affected, fire only the matching Task(s). Do **not** merge them into a single custom script.

**After each canvas-bundle-runner Task returns:** run the parent-thread gate in [`../../create-design-system/conventions/14-audit.md`](../../create-design-system/conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* before logging the page done.

Each committed bundle performs full-page redraw under `_PageContent` for its target page (navigate → clear below header → rebuild per template). Authoritative geometry and cell rules: [`../../create-design-system/SKILL.md`](../../create-design-system/SKILL.md) §0 + **Canvas documentation visual spec**.

**↳ Primitives** — Step 15a: `_PageContent` shell; `doc/primitives/ramp-row/*`; variable-bound swatches (§0.7); § E text rules.

**↳ Theme** — Step 15b: `doc/theme/card-row-*`; Light/Dark previews; `Doc/*` + live `codeSyntax`.

**↳ Text Styles** — Step 15c typography table: `doc/typography/row/{slot}`; specimen `textStyleId`; `Doc/*`.

**↳ Layout** — Step 15c: `doc/layout/row/{token}`; bound previews; `Doc/*`.

**↳ Effects** — Step 15c: `doc/effects/card/{tier}`; Light/Dark; `Effect/shadow-*`; `shadow/color`.

After every redraw, apply **create-design-system §0.1** hygiene where applicable; **`codeSyntax.iOS`** (not `IOS`) for iOS cells; optional gates in [`../../create-design-system/conventions/14-audit.md`](../../create-design-system/conventions/14-audit.md).

Report: `Style guide updated: {comma-separated redrawn page names}.` Log the 9b checklist row.

#### 6.Canvas.9d — Refresh `↳ Token Overview`

If the page does not exist, log `Canvas: Step 9d ↳ Token Overview — skipped (page missing)` and continue to 9e.

**Happy path:** one [`../../canvas-bundle-runner/SKILL.md`](../../canvas-bundle-runner/SKILL.md) subagent Task with `step=17-token-overview`, `fileKey`, `description`. The subagent `Read`s [`../../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js`](../../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js) and calls `use_figma` with it verbatim — this thread does not `Read` the bundle. Same transport rules as 9b ([`../../create-design-system/conventions/17-table-redraw-runbook.md`](../../create-design-system/conventions/17-table-redraw-runbook.md), [`../../../AGENTS.md`](../../../AGENTS.md)). If the subagent returns `{ ok: false, skipped: 'page missing' }`, treat that as **9d skipped (page missing)** — do not fail the canvas chain.

**After the Task returns:** run the §14 parent gate in [`../../create-design-system/conventions/14-audit.md`](../../create-design-system/conventions/14-audit.md) § *After canvas-bundle-runner (parent thread)* (Token Overview / §0.9 items) before logging 9d done.

The bundle implements **create-design-system Step 17** — behavior and edge cases: [`../../create-design-system/phases/08-steps17-appendix.md`](../../create-design-system/phases/08-steps17-appendix.md). It upgrades `Doc/*` on text under `_PageContent`, refreshes platform-mapping `codeSyntax` cells, clears §0.9 shadows on the platform-mapping subtree, applies `Effect/shadow-sm` only to eligible section shells, deletes `placeholder/*`, and replaces `TBD` where possible. Use live variables from 6.Canvas.9b's fetch when already in memory; the script also resolves from the file via the Plugin API.

**Token Overview platform-mapping (same rule as Step 17):** **Do not** assign **`Effect/shadow-sm`** to **`doc/table/token-overview/platform-mapping`** or any descendant. After any pass that touches effects or styles, ensure every node in that subtree stays **flat**: set **`effects = []`** *and* clear **`effectStyleId`** on each affected frame or text node — clearing only the style link can leave a baked **`DROP_SHADOW`** in **`effects`** (**create-design-system** `SKILL.md` §0.9).

Report: `Token Overview page refreshed.` Log the 9d checklist row.

#### 6.Canvas.9e — Refresh `Thumbnail` cover

In `use_figma`, go to the `Thumbnail` page. Find the frame named `Cover`.

Apply the same logic as **create-design-system Step 18**: update the linear gradient stop colors to resolved `color/primary/500` and `color/secondary/500` from **Primitives**; do not change `gradientTransform`. If `Cover` is missing, log a warning, skip paint changes, and still log the checklist row as skipped.

Report: `Thumbnail Cover updated.` (or `skipped` if no `Cover` frame). Log the 9e checklist row.
