# Sync — Step 9f (optional ↳ changelog in Figma)

> **When to read:** After all execution for this scope is done **except** the unified chat report — i.e. after **6.figma** (figma-only) or after **Step 10** (full / code-to-figma), **before** Step **11** / **11.figma** report blocks.
>
> **Tooling:** [`../../../scripts/assemble-sync-changelog-figma.mjs`](../../../scripts/assemble-sync-changelog-figma.mjs) + `npm run check-payload` + parent **`Read`** → **`use_figma`** (same transport pattern as Step **9e** Thumbnail cover — not `canvas-bundle-runner`).

---

## Goal

Optionally replace the body of **`↳ changelog`** (`_PageContent` only) with a readable summary of **this run**, including **`MM/DD/YYYY`** and a **display name**. The page uses the same **`_Header`** instance pattern as other documentation pages (see `/new-project` Phase **05b**). **Do not append** — each successful draw **replaces** prior `_PageContent`.

---

## Step 9f.1 — Designer opt-in

Call **`AskUserQuestion` once** (dedicated decision moment):

> "Update the **`↳ changelog`** page in this Figma file with a summary of this sync run?
> - **Skip changelog** — Continue to the completion report only.
> - **Update changelog** — Replace `_PageContent` with this run's summary (date + name + axes)."

If the user skips (or equivalent empty choice), log:

> `Changelog: skipped`

…then jump to the normal **Step 11** / **11.figma** report **without** running assembly or `use_figma`.

---

## Step 9f.2 — Display name (only if opted in)

If **Update changelog** was chosen, call **`AskUserQuestion` once** (or one multi-sub-question call if the host supports it):

> "How should your name appear on the changelog line (`MM/DD/YYYY · <name> · scope: …`)?
> - **Use OS username** — Agent uses `process.env.USER`, `USERNAME`, or `LOGNAME` (first non-empty) as the display string.
> - **Anonymous** — Use the literal `Anonymous`."

Do **not** rely on Figma REST for the human display name.

---

## Step 9f.3 — Build JSON payload

Write a **small UTF-8 JSON** file to a **consumer-repo** `draw/` / `tmp/` path or OS temp (ephemeral — delete after `use_figma` per [`AGENTS.md`](../../../AGENTS.md)). Shape:

```json
{
  "displayName": "<from 9f.2>",
  "dateMmDdYyyy": "<MM/DD/YYYY for local \"today\">",
  "isFirstRecordedSync": <true if ↳ changelog had no `_PageContent` before this script run — agent sets false if unsure>,
  "scope": "<plan.scope>",
  "axisALines": ["<one bullet per line, mirror Step 11 Axis A>"],
  "axisBLines": ["…"],
  "axisCLines": ["…"],
  "canvasLines": ["9b …", "9d …", "9e … or figma-only per-page done/skipped"]
```

- **`figma-only`:** Fill from the **11.figma**-shaped summary you are about to print (variable counts, pages refreshed, canvas checklist). Axis B/C lines can be a single **"— (not in scope)"** each.
- **`full` / `code-to-figma`:** Fill from the same facts as [`11-report-and-R-mode.md`](./11-report-and-R-mode.md) Step **11** block (Axis A/B/C + canvas checklist). Truncate long comma lists with **"+ N more"** if needed to keep the assembled `code` under the Figma **`code`** budget (~50k).

**`isFirstRecordedSync`:** Set **`true`** when the agent knows this is the first time `_PageContent` is being created on **`↳ changelog`** (e.g. page was just created by the script, or page existed with no `_PageContent`). Otherwise **`false`**.

---

## Step 9f.4 — Assemble, validate, invoke

From the DesignOps plugin repo root:

```bash
node scripts/assemble-sync-changelog-figma.mjs --in <path-to-json> --out <path-to-payload.js>
npm run check-payload -- <path-to-payload.js>
```

Then **parent** thread: **`Read`** the generated `<path-to-payload.js>` in full → **`use_figma`** with `fileKey` + `code` = verbatim file contents + `skillNames` including **`figma-use`** per host rules.

On success, log:

> `Changelog: updated (↳ changelog).`

On failure, log the error and continue to Step **11** (do not block the skill on changelog).

Delete the ephemeral JSON and payload file paths when done.

---

## Step 9f.5 — Continue

Proceed to **Step 11** unified report ([`11-report-and-R-mode.md`](./11-report-and-R-mode.md)) or **11.figma** ([`figma-only-path.md`](./figma-only-path.md)) as appropriate.
