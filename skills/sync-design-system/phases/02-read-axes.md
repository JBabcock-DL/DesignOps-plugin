# Sync — Step 2 (read enabled axes)

> **When to read:** After Step 1 for `full` / `code-to-figma`. For **`figma-only`**, use [`figma-only-path.md`](./figma-only-path.md) instead — do not run this file’s Step 2 for that scope.
>
> **Token formats:** [`../reference/token-formats.md`](../reference/token-formats.md) (referenced from 2A step 2).

---

## Step 2 — Read enabled axes

Run each enabled axis's read pass. Reads may run in parallel where tooling allows; collect all results before computing diffs.

### 2A — Axis A read (full / code-to-figma scopes)

1. **Locate token source file.** Read `plugin/.claude/settings.local.json` for `token_schema_path`; if missing or file not found, call **AskUserQuestion**: "I couldn't find the token file at the path in settings.local.json. Paste the path to your token file (e.g. `src/tokens.json`, `tailwind.config.js`, or `src/styles/tokens.css`)." Repeat until you have a readable file.
2. **Parse into a flat map.** Produce `{ "collection/token/name": value }` per [`../reference/token-formats.md`](../reference/token-formats.md). Token names use forward-slash notation; values are resolved primitives (not aliases).
3. **Resolve Figma file key.** Check `$ARGUMENTS` first, then `plugin/templates/agent-handoff.md:active_file_key`, then call **AskUserQuestion**: "Paste the Figma file URL or file key for the design system file you want to sync against." Extract the key from a full URL if one is provided.
4. **Read Figma variables.** **If `plan.A.figmaVarsInMemory` is already populated** (i.e. this scope was entered via a continuation from `figma-only` at Step 11.5), **skip the REST call entirely and reuse that flat map verbatim**. The canvas chain in Step 6.figma does not mutate variables, so the in-memory snapshot is still authoritative.
   **Otherwise** (fresh entry with `scope=full` or `scope=code-to-figma`) call `GET /v1/files/:key/variables/local` and build the same flat map as [`figma-only-path.md`](./figma-only-path.md) Step 2A.figma step 1 — all collections (`Primitives`, `Theme`, `Typography`, `Layout`, `Effects`), mode-aware flattening, alias resolver (run in the parent thread against the REST JSON — not via a `use_figma` round-trip). Store the result on `plan.A.figmaVarsInMemory` so later steps can reuse it.

   **Mode-aware flattening.** For multi-mode collections, flatten per mode using `collection/mode/token-name`:
   - Theme (2 modes): `theme/light/color/background/default`, `theme/dark/…`
   - Typography (8 modes): `typography/100/Headline-LG-font-size`, etc.
   - Effects (2 modes): `effects/light/shadow/color`, `effects/dark/…`
   - Primitives + Layout (1 mode): `primitives/color-primary-500`, `layout/space-md`

   Legacy collections (`Web`, `Android/M3`, `iOS/HIG`) from pre-refactor runs are included in the read and flagged as deprecated in the diff.

   If the API call fails, report the error (see [`../reference/error-guidance.md`](../reference/error-guidance.md)) and stop.

### 2B — Axis B read

Runs only when Axis B is enabled.

1. **Enumerate Figma ComponentSets per page.** For each page listed in the `/create-component` [`SKILL.md`](../../create-component/SKILL.md) §6 component-to-page routing table, call `mcp__claude_ai_Figma__get_metadata` (scoped to that page). From the returned node tree, collect every `COMPONENT_SET`. For each ComponentSet record:
   - `componentSetId`
   - `name` (Figma component name)
   - `componentPropertyDefinitions` — especially the unified element properties (`Label`, `Leading icon`, `Trailing icon`) and the variant axes (`variant`, `size`, etc.)
   - Default variant (the ComponentSet's `defaultVariant`, if discoverable; otherwise the first variant)

2. **Extract cva config per source file.** For each `*.tsx` under `components.json:aliases.ui`, shell out to the already-shipped extractor:

   ```bash
   npx tsx <abs-path>/skills/create-component/resolver/extract-cva.mjs <abs-path>/components/ui/<component>.tsx
   ```

   The extractor returns JSON:
   ```json
   {
     "displayName": "Button",
     "base": "inline-flex items-center …",
     "variants": { "variant": { "default": "…", "destructive": "…" }, "size": { "default": "…", "sm": "…" } },
     "defaultVariants": { "variant": "default", "size": "default" },
     "compoundVariants": []
   }
   ```

   If the extractor exits non-zero (unextractable component — custom composition, no cva, etc.), record the component as `unresolvable` and carry on. It will appear in the diff under a `code-side unreadable` note instead of a drift bucket.

3. **Pair code ↔ Figma.** Two modes depending on whether Axis C is enabled:

   **When Axis C is enabled (preferred).** Read every `.figma.tsx` and parse each `figma.connect()` call. The first argument is the imported code component; the second is a Figma URL containing `?node-id=<componentSetId>`; the `props` block maps Figma property names to code prop names. Use these as authoritative pairings — `componentSetId ↔ source path ↔ prop translation`.

   **When Axis C is disabled (fallback).** Pair by name matching — same heuristic `/create-component` uses today (kebab-case → PascalCase, e.g. `button.tsx` ↔ `Button` ComponentSet). Emit **one** info line so the user knows prop-level diffs may be imprecise:

   > `Axis B: pairing by name matching (no .figma.tsx files found). Prop-level drift may under-report when Figma property names don't match code prop names.`

4. **Composition registry read (for §3B.1).** If repo-root `.designops-registry.json` exists, parse it. Read [`../../create-component/shadcn-props.json`](../../create-component/shadcn-props.json) and cache every top-level key whose `composes` array is non-empty. For those composites, keep both the composite registry row and each referenced child's row (`version`, `key`, `nodeId`, optional `composedChildVersions` on the composite).

### 2C — Axis C read

Runs only when Axis C is enabled.

1. **Local mapping set.** Glob `**/*.figma.tsx` under the repo. For each file, extract from the `figma.connect()` call:
   - Imported code component symbol
   - Imported source path (e.g. `./button`)
   - Target `componentSetId` (parsed from the URL's `?node-id=` query parameter; URL-decode `%3A` → `:`)
   - Mapped props object (keys = Figma property names, values = code prop names and translation kind)
   - File modification timestamp (`mtime`)

2. **Published mapping state (per-node, authoritative).** For **each** local `.figma.tsx` collected in step 1, call the Figma MCP **`get_code_connect_map`** tool with that file's `componentSetId` and the current `fileKey`:

   ```
   mcp__claude_ai_Figma__get_code_connect_map({
     nodeId: "<componentSetId>",
     fileKey: "<fileKey>",
   })
   ```

   Return shape is `{ [nodeId]: { codeConnectSrc, codeConnectName } }` — populated if the node **has** a published mapping, **empty** (no entry for `nodeId`) if it does not. This is the authoritative published-state check; classify `publishedState` for each local mapping as:

   | Result | `publishedState` |
   |---|---|
   | Entry present, `codeConnectSrc` + `codeConnectName` match the local `.figma.tsx` | `in-sync` |
   | Entry present but `codeConnectSrc` / `codeConnectName` disagree with local | `stale` |
   | No entry returned for `nodeId` | `unpublished` |
   | Tool call failed / timed out / threw | `indeterminate` — **skip this mapping from the diff entirely** (do not default to `unpublished`); log its name under the info line below so the user knows why it's absent from the drift report |

   > **Do not use `get_code_connect_suggestions` for this check.** That tool returns AI-suggested mappings for **unmapped** components — its response shape cannot be interpreted as a published-state listing. Historical bug: using it here caused every already-published `.figma.tsx` (e.g. `button.figma.tsx`) to be misclassified as `unpublished`, which then triggered a redundant `send_code_connect_mappings` call that the Figma side correctly rejected with *"Component is already mapped to code."* The per-node `get_code_connect_map` avoids this entirely by asking the authoritative question: "is this specific node already mapped?"

   **Batch size & parallelism.** `get_code_connect_map` is per-node, so this is N tool calls where N = local `.figma.tsx` count. Run them in parallel where the MCP transport allows (typical cap ~10 concurrent); otherwise serial is fine since N is small on realistic design-system repos.

   **CLI fallback.** If the MCP tool is unavailable for the entire session (not just one intermittent failure — e.g. the `plugin-figma-figma` MCP is not installed), fall back to bulk CLI listing:

   ```bash
   npx figma connect list --published --token=<PAT>
   ```

   (See [`../../code-connect/SKILL.md`](../../code-connect/SKILL.md) §3b for PAT setup. The PAT is read-only here; scope `Code Connect → Read` is sufficient.) Build the same `publishedState` classification from the bulk result — but treat entries absent from the CLI listing as `unpublished` only if the CLI returned a **non-empty** listing (a zero-row response means the endpoint is degraded, not that nothing is published; in that case mark everything `indeterminate`).

   For every mapping that resolved to a non-`indeterminate` state, record:
   - `componentSetId`
   - `publishedState` (one of the four above)
   - Source path on record (from `codeConnectSrc`)
   - Published prop mapping shape (from bulk CLI listing if available; the MCP per-node call does not return prop mappings — prop-level drift falls back to name / source-path comparison in that mode)
   - Publish timestamp (CLI path only; MCP per-node call does not return this)

   If any mappings ended up `indeterminate`, emit one info line before the Step 4 diff presentation:

   > `Axis C: N mapping(s) could not be verified against published state (tool unavailable): <comma-separated component names>. They are omitted from the drift report.`

**Next:** [`03-diff.md`](./03-diff.md) (Step 3).
