# Sync — Step 9f + Step 11 + R-mode reference

> **When to read:** After Steps 7–10 complete (or axes skipped) for `full` / `code-to-figma`.
>
> **Before Step 11:** Read [`./09f-changelog-optional.md`](./09f-changelog-optional.md) and run **Step 9f** (optional `↳ changelog` in Figma).
>
> **Errors:** [`../reference/error-guidance.md`](../reference/error-guidance.md).

---

## Step 9f — Optional `↳ changelog`

See [`./09f-changelog-optional.md`](./09f-changelog-optional.md). Run **before** printing Step **11** so the page can mirror the same execution facts as the chat report.

---

## Step 11 — Unified completion report

After Axis C finishes (or is skipped), print a single report block. No sync was executed? Say so.

```
Sync complete.

  Scope: {figma-only | full | code-to-figma}

  Axis A — Variables
    Tokens pushed to Figma:         {N}
    Tokens updated in code:         {M}
    Style guide pages redrawn:      {comma-separated or "—"}
    Canvas checklist:               9b {done|skipped(reason)}, 9d {…}, 9e {…}

  Axis B — Components
    Components redrawn in Figma:    {comma-separated or "—"}
    PRs opened:                     {url or "—"}
    Items reviewed per-item:        {count or 0}

  Axis C — Code Connect
    Mappings published:             {N}
    Mappings refreshed locally:     {M}
    Mappings deleted (orphans):     {K}

  Upstream-resolved items dropped:  {count} ({list of stable-keys or "—"})
  Validation pauses triggered:      {count} (before {axis} — {n} NEW, {m} ALTERED)
```

Axes that were disabled in preflight are omitted from the report.

---

## Conflict / per-item resolution — R mode

When the user picks **R** at Step 5 for an axis, or **Per item** at a validation pause (Steps 7.3 / 9.3), walk through each item **one at a time**. For **each** item, call **AskUserQuestion** with:

> "**{Axis} — item {i} of {N}** — `{stable-key}`
> - Code side: `{code-value}`
> - Figma side: `{figma-value}`
> Reply **F** (Figma wins → update code), **C** (Code wins → update Figma), or **S** (skip)."

Record each decision into `plan.{axis}.items[i].resolution`. Move to the next. At the end of the per-item loop, present a resolution summary (counts for F / C / S), then call **AskUserQuestion**:

> "Push these resolutions now? (**yes** / **no**)"

On `yes`, the executor (Step 6 / 8 / 10) uses the resolutions. On `no`, record as `deferred` and skip writes for that axis.
