# Foundations shell, registry, and pre-flight (Tier 3)

Canonical decisions and schemas for deferred style-guide leaf pages, `pluginData` slugs, collection id registry, and the read-only pre-flight snapshot. **Do not** duplicate conflicting rules in other shards — link here from phase docs.

## Locked product decisions (formerly open items)

1. **TOC rows (Style Guide band):** Keep the five child **page names** in [`05c-table-of-contents.figma.js`](../../new-project/phases/05c-table-of-contents.figma.js) so `toc-link/↳ …` rows exist after `/new-project` Phase 05c. **Scaffold** omits the five `PAGE` nodes (see [`pages.json`](../../shared/pages.json)). [`05f-toc-hyperlinks.md`](../../new-project/phases/05f-toc-hyperlinks.md) skips rows whose destination page is missing (`continue`). **`/create-design-system`** Foundations shell (Phase 06b) creates the five pages, `_Header` instances, writes the collection registry, then wires **only** those hyperlinks (same URL shape as 05f). If there is no `_Header` `COMPONENT` on `Documentation components`, Phase 06b still writes registry/slugs/links and returns `headerMasterMissing: true`; the parent agent runs **`AskUserQuestion`** per [`phases/06b-foundations-shell.md`](../phases/06b-foundations-shell.md) (build real header via `/new-project` Phase 05b, skip, or stop) — no substitute placeholder header inside the shell script.

2. **Registry node:** A `FRAME` named **`_DesignOpsRegistry`** on the **`Documentation components`** page, off-canvas at `x: -4000`, `y: -4000`, minimal size. `pluginData` key **`labs.designops/collectionRegistry`** holds a JSON string: `{ "primitives": "<id>", "theme": "<id>", "typography": "<id>", "layout": "<id>", "effects": "<id>" }` (omit keys if collection not found).

3. **Page slug `pluginData` key:** **`labs.designops/pageSlug`** on each `PAGE` for the five leaves (values: `primitives`, `theme`, `layout`, `text-styles`, `effects`).

4. **Typography in registry:** Included as **`typography`** when the Typography collection exists (matches canvas variable push order).

## Pre-flight snapshot — `schemaVersion: 1`

Returned from read-only `use_figma` (see [`phases/preflight-snapshot.md`](../phases/preflight-snapshot.md)). Agents paste a short summary; full JSON optional if under host limits.

| Field | Type | Meaning |
|-------|------|---------|
| `schemaVersion` | `1` | Bump only on breaking shape changes |
| `fileKey` | string | Echo from caller when provided |
| `pages` | array | `{ id, name, slug, hasHeaderInstance }` per `PAGE` |
| `collections` | array | `{ id, name, variableCount }` |
| `registry` | object | `present`, `raw`, `parsed` (map logicalKey → id) |
| `axisC` | object | `docCorePresent`, `effectShadowPresent`, `typographySlotsPresent` |
| `manifestVersion` | string \| null | From [`designops-foundations-shell.json`](../../shared/designops-foundations-shell.json) when embedded |
| `warnings` | string[] | Non-fatal probes; see prefixes below |
| `shellCandidateBranch` | string | `skip_shell` \| `partial_shell` \| `legacy_stamp` \| `fresh_shell` \| **`blocked_ambiguous`** |

`blocked_ambiguous` is set when the file must not proceed to an automated mutating shell without human/agent resolution: duplicate `labs.designops/pageSlug` on multiple pages (`duplicate_slug:`…), multiple `PAGE` nodes sharing one manifest display title (`duplicate_legacy_match:`…, plan §5.1 example), or `registry_json_parse_error`. It **overrides** the lighter hints (`skip_shell`, etc.).

### Warning prefixes (normative)

| Prefix | Meaning |
|--------|---------|
| `duplicate_slug:<slug>:<n>` | §5.3 row 5 — `n` pages share the same slug value |
| `duplicate_legacy_match:<name>:<n>` | §5.3 row 3 — `n` pages share the same `PAGE.name` matching a manifest display title |
| `registry_json_parse_error` | Registry frame `pluginData` is not valid JSON |

### `hasHeaderInstance`

True when a direct child named `_Header` is an `INSTANCE` or `COMPONENT` with `|x| < 1` and `|y| < 1` (Documentation components uses the COMPONENT master at `(0,0)` — counts as header for that page).

### `axisC` probes (align with Step 11 close)

- **`docCorePresent`:** all of `Doc/Section`, `Doc/TokenName`, `Doc/Code`, `Doc/Caption` exist in local text styles (exact name).
- **`effectShadowPresent`:** all of `Effect/shadow-sm`, `-md`, `-lg`, `-xl`, `-2xl` exist in local effect styles.
- **`typographySlotsPresent`:** `local text styles` count where `name` matches `/^(Headline|Body|Label)\//` is ≥ **20** (heuristic for slot styles published at Step 11 close).

## Manifest

Single file: [`skills/shared/designops-foundations-shell.json`](../../shared/designops-foundations-shell.json). Shell script in Phase 06b must use the **same** `shellPages` array (agent `Read` + embed, or copy-paste per run).
