---
skill: sync-design-system
invocation: /sync-design-system
description: >
  One reconcile pass across three design-system axes — Variables (A),
  Components (B), and Code Connect mappings (C). Reads every enabled axis,
  presents every drift together, collects every decision in a single bundled
  prompt, then executes in strict dependency order (A → B → C) with a
  pre-execution validation pass that catches cascading drift without silent
  re-decisioning.
arguments: {}
auth: Figma MCP connector via Claude Code (no PAT required)
api: Figma Variables REST API — GET /v1/files/:key/variables/local, PUT /v1/files/:key/variables; Figma Connect API for Axis C published mapping state
requires_figma_tier: Organization
---

# Skill — /sync-design-system

**One reconcile, three axes.**

This skill audits every design-system surface in a single pass: tokens (**Axis A**), components (**Axis B**), and Code Connect mappings (**Axis C**). It presents every drift together, collects all directions in **one bundled decision prompt**, and executes in strict dependency order (A → B → C). A **pre-execution validation pass** runs between axes so that upstream writes (tokens changing Figma, components changing mapping targets) never silently decide on drift the user never saw — new or altered items always trigger a targeted re-prompt.

**MCP repo policy:** [`../../AGENTS.md`](../../AGENTS.md) — inline tool payloads only (no `.mcp-*` / scratch staging files under the repo).

> **First time in a session?** Post a liveness line, then `Read` these **only** (not the full old monolith): [`../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md`](../create-design-system/conventions/03-through-07-geometry-and-doc-styles.md) (geometry + pages + body variants + naming), [`../create-design-system/conventions/02-codesyntax.md`](../create-design-system/conventions/02-codesyntax.md) (iOS dot-path / WEB / ANDROID rules), and **§0** in [`../create-design-system/SKILL.md`](../create-design-system/SKILL.md) — including **§0.9** before any **6.Canvas.9d** work so **↳ Token Overview** platform-mapping does not regain stacked shadows. Index: [`../create-design-system/CONVENTIONS.md`](../create-design-system/CONVENTIONS.md). Axis A's canvas redraws (Steps 6 / 9b / 9d / 9e below) **must** match those conventions.

> **Tokens-only projects** — on a project with a token file but no `components.json`, preflight auto-enables only Axis A when scope is `full` or `code-to-figma`. The experience is then byte-identical to prior versions of this skill: one diff, one direction prompt, one push + canvas chain. Scope **`figma-only`** is a different beast — it deliberately ignores `tokens.css` / `tokens.json` entirely and only refreshes in-Figma docs from current Figma variables.

---

## Interactive input contract

Whenever this skill needs interactive input — **scope selection** (Step 0), **token file path**, **Figma file key or URL**, **bundled direction choice** (Step 5), **per-item resolutions** in R mode or validation pauses, **push confirmations**, **continuation choice** (Step 11.5), **Figma → code write confirmation** (Step 11.5b), or **corrected paths after an error** — use **AskUserQuestion**. **One tool call per decision moment.** Wait for each answer before the next.

Bundled decisions are one **tool call** with multiple sub-questions (e.g. Step 5: one sub-question per axis with drift). That is still one decision moment, one `AskUserQuestion`.

Do not dump multiple decision prompts as plain markdown without calling **AskUserQuestion**.

---

## Global flow (one reconcile)

```
 0.    Scope               — ONE AskUserQuestion: figma-only | full | code-to-figma

 ─── scope = figma-only (short-circuit) ───────────────────────────
  1.5  Figma-only preflight — resolve Figma file key only (no code probes)
  2A.figma  Read Figma vars — GET /v1/files/:key/variables/local (ONE time)
                              → stored on plan.A.figmaVarsInMemory
  4.figma   Summary         — variable counts per collection
  5.figma   Page picker     — all | select | cancel
  6.figma   Canvas refresh  — 9b/9d/9e on selected pages
  11.figma  Report          — scope, file key, pages refreshed
  11.5      Continuation    — continue-figma-to-code | continue-full
                              | continue-code-to-figma | done
  11.5b     Direct push     — (continue-figma-to-code only)
            Figma → tokens.css write. Reuses plan.A.figmaVarsInMemory.
            NO second Figma fetch, NO diff, NO canvas chain.

 ─── scope = full | code-to-figma ─────────────────────────────────
  1. Preflight              — detect enabledAxes ∈ {A, B, C}
  2. Read                   — enabled axes only (parallel where possible)
  3. Diff                   — per axis, every item tagged with a stable key
  4. Present                — all diffs in one block
  5. Decide (bundled)       — ONE AskUserQuestion, N sub-questions (collapsed in scope=code-to-figma)
  6. Execute Axis A         — tokens + canvas chain (9b/9d/9e)
  7. Validate Axis B        — reclassify B's plan; pause + re-prompt only on ALTERED or NEW
  8. Execute Axis B         — redraw / PR / review as planned
  9. Validate Axis C        — reclassify C's plan; pause + re-prompt only on ALTERED or NEW
 10. Execute Axis C         — publish / refresh / review as planned
 11. Unified report         — scope, upstream-resolved + validation-pause counts
```

In a clean `figma-only` run the user answers **two** `AskUserQuestion` calls (scope at Step 0, page picker at Step 5.figma) plus one continuation prompt at Step 11.5. The `continue-figma-to-code` branch adds **one** more confirmation (Step 11.5b) and finishes — no second Figma fetch, no diff. In a clean `full` / `code-to-figma` run the user answers **two** (scope at Step 0, direction at Step 5); if entered via continuation from figma-only, the Figma variable read is reused from `plan.A.figmaVarsInMemory` rather than re-fetched. Validation pauses (Steps 7, 9) are exception-driven and fire only when an upstream write has introduced or altered drift items the user never decided on.

### Plan state object

From Step 0 onward, the skill holds a `plan` object:

```
plan = {
  scope: 'figma-only' | 'full' | 'code-to-figma',
  continuation: 'continue-figma-to-code' | 'continue-full' | 'continue-code-to-figma' | 'done' | null,
  A: {
    direction: 'F'|'C'|'R'|'S'|null,
    items: [...],
    figmaVarsInMemory: null,   // populated by Step 2A.figma (or Step 2A when scope !== 'figma-only');
                               // reused by Steps 6.figma, 11.5b, and any post-11.5 continuation
                               // path. NEVER refetched within a single session.
  },
  B: { direction: ..., items: [...] },
  C: { direction: ..., items: [...] },
  upstreamResolvedDropped: [],
  validationPausesTriggered: 0,
}
```

Every item across every axis carries a **stable key**: `{axis}.{subject}.{bucket}.{id}` (e.g. `A.tokens.color/primary.conflict`, `B.button.variant-axis.mismatch`, `B.pagination.composition.button.detached-instance`, `C.badge.mapping.stale`). The validation passes in Steps 7 / 9 use these keys to classify post-write diff items as UNCHANGED / RESOLVED / ALTERED / NEW without false positives.

---

## Step 0 — Scope selection

Before any file probes, reads, or diffs, call **AskUserQuestion** once to pin the scope of this run. The skill does heavy work — reading every token, scanning every component page, fetching published Code Connect state — so ask up front how far the user actually wants to go. Do not read tokens, call Figma, or run extractors before this answer lands.

**Prompt**

> "What do you want this sync to cover?
> - **figma-only** — Refresh the Figma style-guide docs (↳ Primitives / Theme / Layout / Text Styles / Effects / Token Overview / Thumbnail) so they reflect the current Figma variables. Stays entirely inside Figma. **No** `tokens.css` / `tokens.json` read, **no** component scan, **no** Code Connect, **no** code-side writes. When it finishes, the skill asks whether to continue to a code-side reconcile.
> - **full** — Full reconcile across Variables (code ↔ Figma), Components, and Code Connect. Direction is chosen per axis at Step 5. May open a drift-report PR (Axis B F-wins) and/or publish mappings (Axis C C-wins).
> - **code-to-figma** — One-way push of code as source of truth: tokens push up to Figma, drifted components get redrawn via `/create-component`, mappings get republished via `/code-connect`. Skips the per-axis direction prompt and asks a single confirmation instead."

Record the answer as `plan.scope`.

### How scope shapes the rest of the run

| `plan.scope` | What runs | Interaction |
|---|---|---|
| **figma-only** | **Short-circuit path — Figma only.** Resolve the Figma file key, read `GET /v1/files/:key/variables/local` **once** (stored on `plan.A.figmaVarsInMemory`), present a variable summary, ask which style-guide doc pages to refresh, run the canvas chain (6.Canvas.9b/9d/9e) on the chosen pages. **No** tokens file read, no Axis A / B / C diff, no direction prompt. Steps 2A token parse, 3A–3C diff, 5 bundled direction, 7/8/9/10 axis execution are all **skipped**. After the canvas chain completes, Step 11.5 offers four continuation options: `continue-figma-to-code` (direct Figma → tokens.css write via Step 11.5b, reusing the in-memory read — no second Figma fetch), `continue-full`, `continue-code-to-figma`, or `done`. | Step 0 (scope) → Step 1.5 (figma file key only) → Step 2A.figma (read vars once, store on plan) → Step 4.figma (variable summary) → Step 5.figma (page picker) → Step 6.figma (canvas refresh) → Step 11 (report) → Step 11.5 (continuation prompt) → *optional* Step 11.5b (Figma → code write) |
| **full** | All axes preflight detects (today's default). | One sub-question per drifted axis at Step 5, four options each (F / C / R / S). |
| **code-to-figma** | All axes preflight detects. | Single confirmation sub-question per drifted axis (**Apply C** / **Review per item** / **Skip this axis**). Direction is pre-locked to **C** for every axis with drift. Axis A → push + canvas redraws. Axis B → `/create-component --components=<list>`. Axis C → `/code-connect` publish. No drift-report PR, no code-side file writes. |

If the user later realizes the scope was wrong (e.g. picked `full` but wants to start with `figma-only`), they re-run `/sync-design-system` with the intended scope. The only automatic up-scope path is Step 11.5 after a successful `figma-only` run.

---

## Step 1 — Preflight: detect enabled axes

Probe the file system silently — no blocking prompts, no warnings unless partial state is found.

| Axis | Enable condition |
|---|---|
| **A — Variables** | `plugin/.claude/settings.local.json:token_schema_path` resolves to an existing file, **or** a canonical tokens file exists (`src/styles/tokens.css`, `tokens.json`, `tailwind.config.{js,ts}`) |
| **B — Components** | `components.json` at repo root **and** ≥ 1 `.tsx` under the `aliases.ui` path from `components.json` |
| **C — Code Connect mappings** | Axis B is enabled **and** ≥ 1 `**/*.figma.tsx` file exists anywhere in the repo |

**Clip by `plan.scope`.** After the raw detect:

- `plan.scope === 'figma-only'` → **jump to the Figma-only short-circuit** (Step 1.5 below). Do **not** run the detection table above. No `tokens.css` / `tokens.json` lookup, no `components.json` probe, no `.figma.tsx` glob. The only prerequisite is a Figma file key.
- `plan.scope === 'full'` or `'code-to-figma'` → run the detection table above and keep the raw result.

Report the detected set once:

```
Scope: <full | code-to-figma>
Enabled axes: A (Variables), B (Components), C (Code Connect)
```

If an axis looks like it should be enabled but a prerequisite is missing, emit **one** info line and continue — do not block:

- `components.json` present but no `.tsx` under `aliases.ui` → `Axis B skipped — aliases.ui path is empty.`
- Axis B enabled but no `.figma.tsx` → `Axis C skipped — no Code Connect mapping files found.`

If **no** axes are active after detection (e.g. scope = `full` but no token file, no components, no mappings), stop and tell the user what to fix before re-running.

---

## Step 1.5 — Figma-only preflight (scope = `figma-only` only)

Skip Step 1's axis-detection table entirely — it's predicated on code-side sources the Figma-only flow never touches.

1. **Resolve Figma file key.** Check `$ARGUMENTS` first, then `plugin/templates/agent-handoff.md:active_file_key`, then call **AskUserQuestion**: "Paste the Figma file URL or file key for the design system file to refresh." Extract the key from a full URL if one is provided.
2. Log: `Scope: figma-only — Figma file <key> will be read; no code-side files will be opened.`

Then jump to **Step 2A.figma** (Figma-only variable read). The normal Steps 2A/2B/2C, 3, 4, 5, 7–10 are skipped in this scope.

---

## Step 2 — Read enabled axes

Run each enabled axis's read pass. Reads may run in parallel where tooling allows; collect all results before computing diffs.

### 2A — Axis A read (full / code-to-figma scopes)

1. **Locate token source file.** Read `plugin/.claude/settings.local.json` for `token_schema_path`; if missing or file not found, call **AskUserQuestion**: "I couldn't find the token file at the path in settings.local.json. Paste the path to your token file (e.g. `src/tokens.json`, `tailwind.config.js`, or `src/styles/tokens.css`)." Repeat until you have a readable file.
2. **Parse into a flat map.** Produce `{ "collection/token/name": value }` per the **Supported Token File Formats** section below. Token names use forward-slash notation; values are resolved primitives (not aliases).
3. **Resolve Figma file key.** Check `$ARGUMENTS` first, then `plugin/templates/agent-handoff.md:active_file_key`, then call **AskUserQuestion**: "Paste the Figma file URL or file key for the design system file you want to sync against." Extract the key from a full URL if one is provided.
4. **Read Figma variables.** **If `plan.A.figmaVarsInMemory` is already populated** (i.e. this scope was entered via a continuation from `figma-only` at Step 11.5), **skip the REST call entirely and reuse that flat map verbatim**. The canvas chain in Step 6.figma does not mutate variables, so the in-memory snapshot is still authoritative.
   **Otherwise** (fresh entry with `scope=full` or `scope=code-to-figma`) call `GET /v1/files/:key/variables/local` and build the same flat map as 2A.figma step 1 — all collections (`Primitives`, `Theme`, `Typography`, `Layout`, `Effects`), mode-aware flattening, alias resolver from 2A.figma (run in the parent thread against the REST JSON — not via a `use_figma` round-trip). Store the result on `plan.A.figmaVarsInMemory` so later steps can reuse it.

   **Mode-aware flattening.** For multi-mode collections, flatten per mode using `collection/mode/token-name`:
   - Theme (2 modes): `theme/light/color/background/default`, `theme/dark/…`
   - Typography (8 modes): `typography/100/Headline-LG-font-size`, etc.
   - Effects (2 modes): `effects/light/shadow/color`, `effects/dark/…`
   - Primitives + Layout (1 mode): `primitives/color-primary-500`, `layout/space-md`

   Legacy collections (`Web`, `Android/M3`, `iOS/HIG`) from pre-refactor runs are included in the read and flagged as deprecated in the diff.

   If the API call fails, report the error (see **Error Guidance**) and stop.

### 2A.figma — Figma-only variable read (scope = `figma-only` only)

This is the **only** read that runs in the Figma-only short-circuit. It's a subset of 2A.

1. **Read Figma variables.** Call `GET /v1/files/:key/variables/local` with the key resolved in Step 1.5. Build the same flat map `{ "collection/token/name": value }` across `Primitives`, `Theme`, `Typography`, `Layout`, `Effects`, with the same mode-aware flattening rules as 2A step 4 (Theme light/dark, Typography 8 modes, Effects light/dark, Primitives + Layout 1 mode). Resolve aliases to **final primitive values** (see resolver below).
2. Tally per collection (e.g. `{ primitives: 124, theme: 72, typography: 60, layout: 18, effects: 14 }`) and **store the flat map on `plan.A.figmaVarsInMemory`**. This map is the authoritative Figma-side read for the rest of the session — Steps 6.figma (canvas chain), 11.5 (continuation), and any follow-on code-side write path **must** reuse it. **Do not** call `GET /v1/files/:key/variables/local` again. **Do not** script a separate alias resolver via `use_figma` to "fill in missing values" — that round-trip is what was dropping light/dark hexes on the floor.
3. Do **not** read `tokens.css`, `tokens.json`, or `tailwind.config.*`. Do **not** call the extractor. Do **not** probe `components.json` or `.figma.tsx`.

**Alias resolver (run once here, entirely in the parent thread against the REST response — no `use_figma` trip).** The REST response shape is:

```
{
  variables: { <variableId>: { name, valuesByMode, resolvedType, variableCollectionId, codeSyntax } },
  variableCollections: { <collectionId>: { name, modes: [{ modeId, name }], defaultModeId } }
}
```

Each `valuesByMode[modeId]` is either (a) a raw value — `{ r, g, b, a? }` for color, `number` for float, `string` for string, `boolean` — or (b) an alias `{ type: 'VARIABLE_ALIAS', id: '<targetVariableId>' }`. To resolve:

```
function resolve(varId, modeId, depth = 0) {
  if (depth > 10) return null;                          // cycle guard
  const v = variables[varId];
  if (!v) return null;
  const val = v.valuesByMode[modeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const target = variables[val.id];
    if (!target) return null;
    // Cross-collection alias: pick the target collection's matching-name mode
    // if one exists, otherwise its default mode. (Theme → Primitives: Primitives
    // is single-mode, always use that mode.)
    const targetColl = variableCollections[target.variableCollectionId];
    const sameName = targetColl.modes.find(m => m.name === modeName(modeId));
    const nextMode = sameName ? sameName.modeId : targetColl.defaultModeId;
    return resolve(val.id, nextMode, depth + 1);
  }
  return val;                                            // raw value, done
}
```

The flat-map entry for each mode/variable pair stores both the **resolved primitive value** (the raw `{r,g,b,a}` / number / string returned above, formatted as a hex string `#RRGGBB` or `#RRGGBBAA` for colors, `px` / unitless for floats) **and** the **first-hop alias path** (target variable's `name`, or `null` if the Theme variable holds a raw value). Both are needed downstream: the resolved value for `tokens.css` writes (Step 11.5b), the alias path for canvas L/D labels (now handled live by the canvas bundle since the 15b fix — skill doesn't pass this through anymore, but keep it on the map for reporting).

If the API call fails, report the error (see **Error Guidance**) and stop.

### 2B — Axis B read

Runs only when Axis B is enabled.

1. **Enumerate Figma ComponentSets per page.** For each page listed in the `/create-component` SKILL.md §6 component-to-page routing table, call `mcp__claude_ai_Figma__get_metadata` (scoped to that page). From the returned node tree, collect every `COMPONENT_SET`. For each ComponentSet record:
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

4. **Composition registry read (for §3B.1).** If repo-root `.designops-registry.json` exists, parse it. Read [`skills/create-component/shadcn-props.json`](../create-component/shadcn-props.json) and cache every top-level key whose `composes` array is non-empty. For those composites, keep both the composite registry row and each referenced child's row (`version`, `key`, `nodeId`, optional `composedChildVersions` on the composite).

### 2C — Axis C read

Runs only when Axis C is enabled.

1. **Local mapping set.** Glob `**/*.figma.tsx` under the repo. For each file, extract from the `figma.connect()` call:
   - Imported code component symbol
   - Imported source path (e.g. `./button`)
   - Target `componentSetId` (parsed from the URL's `?node-id=` query parameter; URL-decode `%3A` → `:`)
   - Mapped props object (keys = Figma property names, values = code prop names and translation kind)
   - File modification timestamp (`mtime`)

2. **Published mapping state.** Fetch the currently published Code Connect mappings for the Figma file. Prefer the MCP path:

   ```
   mcp__claude_ai_Figma__get_code_connect_suggestions  (published state listing)
   ```

   If unavailable or if a broader listing is needed, shell out to the CLI:

   ```bash
   npx figma connect list --published --token=<PAT>
   ```

   (See [`../code-connect/SKILL.md`](../code-connect/SKILL.md) §3b for PAT setup. The PAT is read-only here; scope `Code Connect → Read` is sufficient.)

   For each published mapping, record:
   - `componentSetId`
   - Source path on record
   - Published prop mapping shape
   - Publish timestamp

---

## Step 3 — Compute diffs (all axes)

### 3A — Axis A diff

Categorize every token into exactly one bucket:

| Bucket | Condition | Stable key |
|---|---|---|
| **new** (code → Figma) | in code, NOT in Figma | `A.tokens.<path>.new` |
| **missing** (Figma → code) | in Figma, NOT in code | `A.tokens.<path>.missing` |
| **conflict** | in BOTH but values differ | `A.tokens.<path>.conflict` |

In-sync tokens are omitted from the diff.

### 3B — Axis B diff

For each paired `(ComponentSet, source file)` compute:

| Bucket | Condition | Stable key |
|---|---|---|
| **variant-axis mismatch** | cva variant-axis names or values differ from `componentPropertyDefinitions` | `B.<component>.variant-axis.<axisName>` |
| **default mismatch** | cva `defaultVariants` differ from ComponentSet `defaultVariant` | `B.<component>.default.<axisName>` |
| **prop mismatch** | element component props (`Label`, `Leading icon`, `Trailing icon`, plus any Axis-C-documented code props) disagree | `B.<component>.prop.<propName>` |
| **token-binding drift** | cva class tokens resolve (via `resolve-classes.mjs`) to different Figma variable paths than the ComponentSet's actual paint/spacing/text-style bindings | `B.<component>.binding.<elementPath>.<bucket>` |
| **composition drift** | `shadcn-props.json` declares `composes[]` for `<component>` **and** repo `.designops-registry.json` exists: (a) a specimen `INSTANCE` under `slot/*` is detached or missing, (b) `mainComponent.key` on a nested instance disagrees with the registry entry for that child atom, (c) a composed child is absent from the registry, or (d) the child's registry `version` / `publishedAt` is newer than the last recorded composite redraw hint | `B.<component>.composition.<child>.<reason>` |
| **code-only** | source file present, no matching ComponentSet in Figma | `B.<component>.code-only` |
| **figma-only** | ComponentSet present, no matching source file | `B.<component>.figma-only` |

Token-binding drift uses the already-shipped resolver:

```bash
npx tsx <abs-path>/skills/create-component/resolver/resolve-classes.mjs \
  --classes "<cva class string>" \
  --tokens <abs-path>/tokens.css
```

The resolver returns `{ fills, strokes, radii, spacing, typography, unresolved }` keyed by Tailwind state (`base`, `hover`, `focus-visible`, `disabled`, `dark`). Compare each resolved path to the Figma-side binding on the corresponding element. Unresolvable classes are recorded in the Axis B diff as informational (not a bucketed drift item).

Components marked `unresolvable` in Step 2B surface as a separate informational row, not a drift bucket.

### 3B.1 — Composition drift (`COMPOSITION_DRIFT` / `composition` bucket)

Run this sub-pass **only** for components that have a non-empty `composes[]` in `shadcn-props.json` **and** for which Step 2B.4 loaded a registry file. Emit drift rows using stable keys `B.<composite>.composition.<child>.<reason>` (reason examples: `detached`, `wrong-main`, `missing-registry-child`, `stale-vs-child`).

**A — Registry-only checks (no Figma tree walk):**

1. For each composite `C` with `composes[]`, require registry entries for `C` and every child `K` in `composes[].component`. If any `K` is missing → emit **missing-registry-child**.
2. **Stale vs child:** Let `vK` = `registry.components[K].version`. If `registry.components[C].composedChildVersions[K]` exists and `vK > registry.components[C].composedChildVersions[K]` → emit **stale-vs-child** (child redrawn after composite last captured child versions; remediation: redraw composite via `/create-component --components=C` or C-wins).

**B — Figma structure checks (requires metadata / design context on composite `COMPONENT_SET`):**

Using the composite's `registry.components[C].nodeId`, fetch children (`COMPONENT` variant masters). For **each** variant master node:

3. For each `composes[]` row with `slot: S`, require a direct child frame named **`slot/S`**. If missing or not `FRAME` → emit **missing-slot** (treat as composition drift; legacy flat layout).
4. Depth-first under `slot/S`: collect nodes of type `INSTANCE`.
   - If there are **zero** instances → emit **no-instances** under child key `K`.
   - For each `INSTANCE`, if `mainComponent` is **null** or the node is a non-instance frame where an instance was expected → **detached**.
   - If `mainComponent` exists: let `kid = mainComponent.parent` (must be `COMPONENT_SET`). Compare `kid.id` to `registry.components[K].nodeId` **or** compare published `mainComponent.key` to `registry.components[K].key`. Mismatch → **wrong-main**.

**C — Reporting:** Map every emitted row into the Axis B summary table under **COMPOSITION DRIFT** (see Step 4 example line). Actions in Steps 7–8 match other Axis B buckets (`F` / `C` / `R` / `S`); **C-wins** on composition drift is usually `/create-component --components=<composite>` after children are healthy.

### 3C — Axis C diff

| Bucket | Condition | Stable key |
|---|---|---|
| **missing** | ComponentSet exists in Figma, no local `.figma.tsx` references its ID | `C.<componentName>.mapping.missing` |
| **stale** | local `.figma.tsx` references a Figma variant/property that no longer exists | `C.<componentName>.mapping.stale` |
| **orphaned** | local `.figma.tsx` exists, imported source file does not | `C.<componentName>.mapping.orphaned` |
| **unpublished** | local `.figma.tsx` mtime newer than published timestamp (or not in published set) | `C.<componentName>.mapping.unpublished` |

In-sync mappings are omitted.

---

## Figma-only short-circuit (Steps 4.figma / 5.figma / 6.figma / 11.figma)

When `plan.scope === 'figma-only'`, Steps 3 / 4 / 5 / 7 / 8 / 9 / 10 of the normal flow are **skipped**. The skill goes directly from Step 2A.figma to the short-circuit steps below, then to Step 11 and Step 11.5.

### 4.figma — Variable summary (no diff)

Print a compact, non-blocking summary derived from the Step 2A.figma read. There is no code-side to diff against, so this is informational only:

```
── Figma variable summary ─────────────────────────────────────────
File: <figma file key>
  Primitives:   124 variables
  Theme:         72 variables  (Light + Dark)
  Typography:    60 variables  (8 Android-curve scale modes)
  Layout:        18 variables
  Effects:       14 variables  (Light + Dark)
  Total:        288 variables
───────────────────────────────────────────────────────────────────
```

If any legacy collections (`Web`, `Android/M3`, `iOS/HIG` from pre-refactor runs) are still present, list them as a one-line deprecation note — the Figma-only scope does not rewrite legacy collections; it only refreshes doc pages that render from the current collections.

### 5.figma — Page picker (short-circuit decision)

Call **AskUserQuestion** **once**, with **`allow_multiple: true`**, listing all seven style-guide pages as options. Do **not** split this into a mode picker ("all/select/cancel") followed by a per-page selector — agents flatten that into a single-select UI and drop options. One question, one multi-select.

Prompt body:

> "Refresh the Figma style-guide docs to reflect the current variables. Select every page you want redrawn — you can pick any combination, or Skip to redraw nothing."

Options (all seven, in this order):

1. `↳ Primitives`
2. `↳ Theme`
3. `↳ Layout`
4. `↳ Text Styles`
5. `↳ Effects`
6. `↳ Token Overview`
7. `Thumbnail Cover`

All seven options **must** be present in the tool call even when you believe only a subset is affected — the user is the source of truth for scope, not the agent's inference.

**Result handling:**

- Any non-empty selection → record as the affected-page set; advance to Step 6.figma.
- Empty selection or user-skipped the question → record an empty set; skip Step 6.figma entirely and advance directly to Step 11 (zero redraw rows) and Step 11.5. Do **not** re-prompt.

If you want to hint at a recommended subset (e.g. "given the primitive / theme edits observed in 2A.figma, `↳ Primitives` and `↳ Theme` are the likely minimum"), put that in a one-line comment **above** the prompt body — never as a separate question. The picker itself stays flat.

### 6.figma — Canvas refresh only

Run the canvas chain (6.Canvas.9b / 9d / 9e) **scoped to the user's selection** from Step 5.figma. No Axis A token push happens — the Figma variables are already the source of truth; only the rendered docs are being refreshed.

- For each selected style-guide page (↳ Primitives / Theme / Layout / Text Styles / Effects), run 6.Canvas.9b's matching canvas-bundle-runner subagent Task (slug mapping table in Step 6.Canvas.9b). 15c pages fire as three sequential Tasks in Layout → Text Styles → Effects order when multiple are selected.
- If `↳ Token Overview` is in the selection, run 6.Canvas.9d.
- If `Thumbnail Cover` is in the selection, run 6.Canvas.9e.
- Everything else about the canvas chain (AGENTS.md inline-payload rule, subagent delegation, §0.9 platform-mapping flatness, codeSyntax hygiene) is unchanged — see [`AGENTS.md`](../../AGENTS.md) § *Canvas bundles — subagent delegation*.

Log one checklist row per executed page (same format as 6.Canvas's blocking checklist). Pages not selected are logged as `skipped (not selected)`.

### 11.figma — Report (Figma-only shape)

Skip the Axis A / B / C sub-blocks of Step 11. Emit:

```
Figma-only sync complete.

  Scope:                       figma-only
  Figma file:                  <file key>
  Variables read:              <n>
  Style-guide pages refreshed: <comma-separated or "—">
  Canvas checklist:            <per-page done/skipped lines>
```

Then run **Step 11.5** unconditionally (it runs even when no pages were refreshed — the user may still want to continue to code).

---

## Step 11.5 — Continuation prompt (Figma-only only)

This step runs **only** when `plan.scope === 'figma-only'`. For `full` and `code-to-figma` runs, skip it entirely.

Call **AskUserQuestion** once:

> "Figma-only sync finished. Do you want to continue with a code-side reconcile now?
> - **continue-figma-to-code** — **Fastest path.** Push the Figma variables already in memory (from 2A.figma) directly into the code-side token file (e.g. `tokens.css`). **No** second Figma fetch, **no** diff, **no** per-axis prompt — just overwrite the token file with the current Figma values and show the write summary. Pick this when you know Figma is right and you only want to update code.
> - **continue-full** — Re-enter the skill with `scope = full`. Reads `tokens.css` / `tokens.json` / components / Code Connect, diffs against the in-memory Figma state, and asks per-axis direction at Step 5. The Figma read is reused — no second REST call.
> - **continue-code-to-figma** — Re-enter the skill with `scope = code-to-figma`. Pushes code as source of truth back into Figma with a single confirmation per axis. The Figma read is reused for the diff.
> - **done** — Stop here. Re-run `/sync-design-system` later if you want a code reconcile."

Record the answer:

- **continue-figma-to-code** → keep `plan.scope = 'figma-only'` (this is a Figma-only variant, not a scope flip) and jump to **Step 11.5b** below. Do **not** re-enter Step 1.
- **continue-full** → set `plan.scope = 'full'` and jump to **Step 1** (the normal preflight axis-detection table). `plan.A.figmaVarsInMemory` from 2A.figma is reused by Step 2A step 4 — do not re-fetch.
- **continue-code-to-figma** → set `plan.scope = 'code-to-figma'` and jump to **Step 1**. Same reuse rule.
- **done** → finish the skill. Print: `Figma-only sync closed without code reconcile.`

For **continue-full** / **continue-code-to-figma**, the recursive entry at Step 1 runs axis-detect, read (Step 2A/2B/2C — Axis A reuses `plan.A.figmaVarsInMemory`), diff (Step 3), present (Step 4), bundled decision (Step 5), and executes the rest of the flow normally with the chosen scope. Do **not** re-prompt Step 0; `plan.scope` is already pinned. When the second pass reaches Step 11, its report block supersedes the Figma-only summary printed earlier.

If the user picks a continuation path and the code-side preflight finds zero axes active (e.g. no `tokens.css` and no `components.json`), stop with a clear message and do not loop back to Step 11.5.

---

## Step 11.5b — Direct Figma → code write (continue-figma-to-code only)

This step runs **only** when the user picked `continue-figma-to-code` at Step 11.5. It is the fastest path from "figma-only sync finished" to "code stylesheet updated" — one token-file locate, one write, one report. No Figma round-trip. No diff. No per-axis prompt.

**Preconditions.** `plan.A.figmaVarsInMemory` must be populated from Step 2A.figma (it always is if you reached Step 11.5). If it isn't, this step is a bug — fail fast with `Step 11.5b: no in-memory Figma variables (plan.A.figmaVarsInMemory missing). Refusing to write.`

### 1. Locate the token source file

Same locator as Step 2A step 1:

1. Read `plugin/.claude/settings.local.json` for `token_schema_path`.
2. If missing or file not found, call **AskUserQuestion**: "Paste the path to the token file you want me to write the Figma variables into (e.g. `src/tokens.json`, `tailwind.config.js`, or `src/styles/tokens.css`)."
3. Detect the format (CSS custom properties, JSON, Tailwind config) via the **Supported Token File Formats** section. If the format can't be determined, ask: "I can't tell what format this file uses. Is it (1) CSS custom properties, (2) JSON, (3) Tailwind config, or (4) something else — I should stop?"

### 2. Render the new file content

Build the new token-file body **locally** from `plan.A.figmaVarsInMemory`. Do **not** call `use_figma`. Do **not** re-fetch variables.

- **CSS custom properties** (`tokens.css`): one `--token-name: value;` per resolved entry, grouped by collection as `/* === Primitives === */`, etc. Theme variables in multi-mode collections emit one selector per mode (`:root { --color-… }` for Light, `.dark { --color-… }` or `@media (prefers-color-scheme: dark) { :root { --color-… } }` for Dark — match the existing file's convention; if the file is empty / new, use `:root` + `.dark` class-based scoping).
- **JSON** (`tokens.json`): nested object following the existing file's shape, or flat `{ "collection/token/name": value }` if the existing file is flat.
- **Tailwind config** (`tailwind.config.js` / `.ts`): emit into the `theme.extend.colors` / `theme.extend.spacing` / etc. namespaces per existing conventions. If the file mixes code and data in a way the agent can't round-trip safely, **stop** and recommend `continue-full` instead.

Preserve any non-token content the existing file contained outside the collection regions (header comments, `@import`s, custom utilities). Only overwrite the variable section — never rewrite the whole file verbatim if other content is present.

### 3. Confirm before writing

Call **AskUserQuestion** once with a **single** sub-question:

> "Ready to write `N` tokens from Figma into `<token-file-path>`. Diff summary:
> - Unchanged: `U` tokens (already match Figma)
> - Updated: `M` tokens (values differ)
> - Added: `A` tokens (not in code yet)
> - Removed: `R` tokens (in code, not in Figma) — `keep` | `delete`
>
> Proceed?"

Options: `yes` | `yes + delete removed` | `preview full diff` | `cancel`.

- `preview full diff` → print a unified diff (code file → new file), then re-prompt with the same three remaining options.
- `cancel` → stop. Print `Step 11.5b: write cancelled. Figma state unchanged, code file unchanged.`

### 4. Write the file

On `yes` or `yes + delete removed`, write the rendered content to the token-file path atomically (write to a temp, rename, or use the host writer's atomic mode). If the repo is a git worktree, leave the write uncommitted — the user stages / commits / PRs it themselves per repo conventions.

### 5. Report

Print:

```
── Step 11.5b report ─────────────────────────────────────────────
scope:                 figma-only → continue-figma-to-code
file written:          <token-file-path>
updated:               M tokens
added:                 A tokens
removed:               R tokens (deleted: yes/no)
unchanged:             U tokens
figma re-fetches:      0   ← in-memory reuse only
canvas redraws:        0   ← code-side write only
elapsed:               <s>
```

Then finish the skill. Do **not** run the 6.Canvas chain (nothing changed in Figma).

---

## Step 4 — Present all diffs

Print **one** markdown block with three sub-sections, in order. This happens before any `AskUserQuestion` call — the user sees the complete reconcile picture before deciding anything.

```
── Reconcile summary ──────────────────────────────────────────────

Axis A — Variables

  NEW (in code, not in Figma): 12 tokens
    color/brand/500        #1D4ED8
    color/brand/600        #1E40AF
    …

  MISSING (in Figma, not in code): 3 tokens
    color/deprecated/red   #EF4444
    …

  CONFLICTS (different values): 5 tokens
    Token                  Code         Figma
    color/primary          #2563EB      #1D4ED8
    …

  In sync: 247 tokens.

Axis B — Components

  VARIANT-AXIS MISMATCH: 1
    button.variant — code has [default, destructive, outline, secondary, ghost, link]; Figma has [default, destructive, outline, secondary, ghost]
  DEFAULT MISMATCH: 0
  PROP MISMATCH: 2
    badge.prop.Leading icon — missing in Figma
    card.prop.asChild — code-only
  TOKEN-BINDING DRIFT: 1
    button.binding.bg.base — code → color/primary/default, Figma → color/primary/subtle
  CODE-ONLY: 0
  FIGMA-ONLY: 1
    switch — no source file
  COMPOSITION DRIFT: 1
    pagination.composition.button.detached-instance — matrix cell uses detached shapes instead of Button instances
  Unresolvable (skipped): 0

  In sync: 12 components.

Axis C — Code Connect mappings

  MISSING: 1
    alert.mapping.missing — ComponentSet `Alert` has no .figma.tsx
  STALE: 0
  ORPHANED: 0
  UNPUBLISHED: 2
    button.mapping.unpublished, badge.mapping.unpublished

  In sync: 7 mappings.

────────────────────────────────────────────────────────────────────
```

Clean axes collapse to one line (`Axis C — Code Connect mappings: in sync (7 mappings checked).`). Axes that were disabled by preflight are not printed.

If every enabled axis is in sync (diff is empty everywhere), stop:

> "All axes are in sync. No changes are needed."

---

## Step 5 — Bundled decision

**This is the only mandatory direction decision in a clean run.** Shape depends on `plan.scope`. Scope `figma-only` does not reach this step — it runs the short-circuit (see **Figma-only short-circuit** section below).

### 5.a — `plan.scope === 'full'`

Call **AskUserQuestion** with **one sub-question per axis that has drift**. Axes in sync are omitted. Each sub-question offers the same four options:

| Reply | Meaning |
|---|---|
| **F** | Figma wins for this axis — pull Figma state into code |
| **C** | Code wins for this axis — push code state into Figma |
| **R** | Review each drift item one at a time |
| **S** | Skip this axis — record decision, make no writes |

The question body for each sub-question is:

> "**Axis {name}** — {n} drift items.
> - **F** Figma wins (pull into code)
> - **C** Code wins (push to Figma)
> - **R** Review each item
> - **S** Skip this axis"

### 5.b — `plan.scope === 'code-to-figma'`

Direction is pre-locked to **C** on every axis that has drift. Call **AskUserQuestion** with one sub-question per drifted axis, each offering **three** options:

| Reply | Meaning |
|---|---|
| **Apply C** | Confirm code-wins push for this axis (equivalent to direction `C`) |
| **Review** | Walk each drift item one at a time, deciding **C** (push) or **S** (skip) per item — **F** is not offered in this scope |
| **Skip** | Skip this axis — record decision, make no writes |

The question body for each sub-question is:

> "**Axis {name}** — {n} drift items. Scope is code → Figma, so every drift defaults to pushing the code value up.
> - **Apply C** Push code as-is for this axis
> - **Review** Review each item (C or S only)
> - **Skip** Skip this axis"

Record `Apply C` as `plan.{axis}.direction = 'C'`, `Review` as `'R'` with a scope-hint that suppresses the **F** option in the per-item loop, and `Skip` as `'S'`.

### Post-bundle: per-item review for any axis that got R

Any axis where the user replied **R** (or **Review** in scope = `code-to-figma`) now runs a per-item review loop **immediately**, before any execution. For each drifted item in stable-key order, call **AskUserQuestion**:

> "**{axis} — item {i} of {N}** — `{stable-key}`
> - Code side: `{code-value}`
> - Figma side: `{figma-value}`
> Reply **F** (Figma wins → update code), **C** (Code wins → update Figma), or **S** (skip)."

When `plan.scope === 'code-to-figma'`, omit the **F** option from the per-item prompt — that direction is out of scope for this run. Offer only **C** and **S**.

Record each decision at the item level. At the end of Step 5, `plan.{A,B,C}.items` holds one resolution per drift item on every non-skipped axis.

**Axis A's existing F / C / Both / Review prompt is superseded by this bundled prompt.** There is no longer a standalone Step 7 axis-A direction question — the bundled Step 5 is the single source of all direction decisions.

---

## Step 6 — Execute Axis A

> **Trigger rule.** Runs for scope `full` and `code-to-figma` only. Its internal branches depend on `plan.A.direction` and on whether the resolved plan writes ≥ 1 token to Figma. Scope `figma-only` uses **Step 6.figma** (canvas refresh only, no token push) instead.

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

2. Before any `use_figma` call, **`Read`** [`../create-design-system/SKILL.md`](../create-design-system/SKILL.md) section **Canvas documentation visual spec** (§§ **A–G**). Token-bound doc chrome (**§ C**), token-demo bindings (**§ D**), auto-layout hug rules (**§ E**), row hierarchy (**§ F**), and premium visual language (**§ G**) must match that spec.

3. **Reliability — delegate to the canvas runner subagent (parity with create-design-system phase 07):** For each affected page, emit **one `Task(subagent_type: "generalPurpose")`** that loads the [`../canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) skill with `step=<slug>`, `fileKey`, `description`. The subagent `Read`s the matching `.min.mcp.js` and calls `use_figma` with it verbatim — **this thread must not `Read` the bundle or call `use_figma` for canvas redraws itself** (same rule as [`../create-design-system/phases/07-steps15a-15c.md`](../create-design-system/phases/07-steps15a-15c.md) and [`../create-design-system/conventions/16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) § *Canvas runner subagent*). Do **not** invent ad-hoc concatenated scripts, one mega-call across unrelated pages, throwaway `.mcp-*` / `*-payload.json` / scratch `.js` ([`AGENTS.md`](../../AGENTS.md)). Parse each returned `{ ok, step, pageName, … }` summary and log one checklist row per page.

| If this page is in the affected set | `step` slug (pass to subagent) | Bundle the subagent reads (parent does NOT `Read`) |
|-------------------------------------|--------------------------------|-----------------------------------------------------|
| `↳ Primitives`  | `15a-primitives`    | [`../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js) |
| `↳ Theme`       | `15b-theme`         | [`../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js) |
| `↳ Layout`      | `15c-layout`        | [`../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js) |
| `↳ Text Styles` | `15c-text-styles`   | [`../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js) |
| `↳ Effects`     | `15c-effects`       | [`../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js) |

**15c split:** If **Layout**, **Text Styles**, and **Effects** are **all** affected, run **three** sequential subagent Tasks (one `step` slug each, strictly in order) — same ordering as [`../create-design-system/phases/07-steps15a-15c.md`](../create-design-system/phases/07-steps15a-15c.md). If only one or two of those pages are affected, fire only the matching Task(s). Do **not** merge them into a single custom script.

Each committed bundle performs full-page redraw under `_PageContent` for its target page (navigate → clear below header → rebuild per template). Authoritative geometry and cell rules: [`../create-design-system/SKILL.md`](../create-design-system/SKILL.md) §0 + **Canvas documentation visual spec**.

**↳ Primitives** — Step 15a: `_PageContent` shell; `doc/primitives/ramp-row/*`; variable-bound swatches (§0.7); § E text rules.

**↳ Theme** — Step 15b: `doc/theme/card-row-*`; Light/Dark previews; `Doc/*` + live `codeSyntax`.

**↳ Text Styles** — Step 15c typography table: `doc/typography/row/{slot}`; specimen `textStyleId`; `Doc/*`.

**↳ Layout** — Step 15c: `doc/layout/row/{token}`; bound previews; `Doc/*`.

**↳ Effects** — Step 15c: `doc/effects/card/{tier}`; Light/Dark; `Effect/shadow-*`; `shadow/color`.

After every redraw, apply **create-design-system §0.1** hygiene where applicable; **`codeSyntax.iOS`** (not `IOS`) for iOS cells; optional gates in [`../create-design-system/conventions/14-audit.md`](../create-design-system/conventions/14-audit.md).

Report: `Style guide updated: {comma-separated redrawn page names}.` Log the 9b checklist row.

#### 6.Canvas.9d — Refresh `↳ Token Overview`

If the page does not exist, log `Canvas: Step 9d ↳ Token Overview — skipped (page missing)` and continue to 9e.

**Happy path:** one [`../canvas-bundle-runner`](../canvas-bundle-runner/SKILL.md) subagent Task with `step=17-token-overview`, `fileKey`, `description`. The subagent `Read`s [`../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js) and calls `use_figma` with it verbatim — this thread does not `Read` the bundle. Same transport rules as 9b ([`../create-design-system/conventions/17-table-redraw-runbook.md`](../create-design-system/conventions/17-table-redraw-runbook.md), [`AGENTS.md`](../../AGENTS.md)). If the subagent returns `{ ok: false, skipped: 'page missing' }`, treat that as **9d skipped (page missing)** — do not fail the canvas chain.

The bundle implements **create-design-system Step 17** — behavior and edge cases: [`../create-design-system/phases/08-steps17-appendix.md`](../create-design-system/phases/08-steps17-appendix.md). It upgrades `Doc/*` on text under `_PageContent`, refreshes platform-mapping `codeSyntax` cells, clears §0.9 shadows on the platform-mapping subtree, applies `Effect/shadow-sm` only to eligible section shells, deletes `placeholder/*`, and replaces `TBD` where possible. Use live variables from 6.Canvas.9b's fetch when already in memory; the script also resolves from the file via the Plugin API.

**Token Overview platform-mapping (same rule as Step 17):** **Do not** assign **`Effect/shadow-sm`** to **`doc/table/token-overview/platform-mapping`** or any descendant. After any pass that touches effects or styles, ensure every node in that subtree stays **flat**: set **`effects = []`** *and* clear **`effectStyleId`** on each affected frame or text node — clearing only the style link can leave a baked **`DROP_SHADOW`** in **`effects`** (**create-design-system** `SKILL.md` §0.9).

Report: `Token Overview page refreshed.` Log the 9d checklist row.

#### 6.Canvas.9e — Refresh `Thumbnail` cover

In `use_figma`, go to the `Thumbnail` page. Find the frame named `Cover`.

Apply the same logic as **create-design-system Step 18**: update the linear gradient stop colors to resolved `color/primary/500` and `color/secondary/500` from **Primitives**; do not change `gradientTransform`. If `Cover` is missing, log a warning, skip paint changes, and still log the checklist row as skipped.

Report: `Thumbnail Cover updated.` (or `skipped` if no `Cover` frame). Log the 9e checklist row.

---

## Step 7 — Validate Axis B (pre-execution)

**Trigger.** Runs iff Axis B was enabled at preflight AND `plan.B.direction !== 'S'`. When `direction === 'S'`, no validation and no prompt — skipped axes do not receive cascade scrutiny.

When the validation runs but no upstream writes occurred in Step 6, classification is 100% UNCHANGED and the pass completes silently (no pause, no prompt). When upstream writes did occur, classification may produce RESOLVED / ALTERED / NEW items; the pause fires only if ALTERED or NEW items are present.

### 7.1 — Re-compute Axis B diff

Re-run Step 3B against the current state of the world:

- `tokens.css` may have changed from 6.F (Figma-wins) writes. Re-run `resolve-classes.mjs` for each component.
- Figma variables may have changed from 6.C / 6.R writes. Re-run Step 2B's `get_metadata` calls for the affected pages (scoped to components that could bind to any pushed token — in practice, re-read every component page that was originally scanned, since cross-bindings are cheap to re-check).

### 7.2 — Classify each item in `plan.B.items` against the fresh diff

| Classification | Condition | Action |
|---|---|---|
| **UNCHANGED** | same stable key present in both plans, same code/Figma values | execute as planned, no prompt |
| **RESOLVED** | key was in original plan, **absent** from fresh diff | drop silently, append to `plan.upstreamResolvedDropped` with a note: `"A→B: {stable-key} resolved by Axis A"` |
| **ALTERED** | same stable key, values changed (e.g. Figma value now differs from what the user saw) | add to **pause batch** |
| **NEW** | stable key absent from original plan, present in fresh diff | add to **pause batch** |

### 7.3 — Validation pause (fires only if pause batch is non-empty)

One **AskUserQuestion** tool call titled **"Axis B — upstream changes introduced new or altered drift"**. List only the pause-batch items with their diff bucket, code value, and Figma value. Offer three options:

| Reply | Meaning |
|---|---|
| **Same as B** (default) | Take the axis-level direction from `plan.B.direction` and apply it to every pause-batch item |
| **Per item** | Inline F / C / S decision per item |
| **Stop B** | Abandon Axis B (keep UNCHANGED items planned but do not execute anything in B), continue to Axis C |

If the user picks **Per item**, loop through the pause batch with per-item `AskUserQuestion` (same format as Step 5 R-mode loop).

Increment `plan.validationPausesTriggered`. Merge answers into `plan.B.items` with an `addedByValidation: true` flag for reporting.

### 7.4 — No pause batch → proceed silently

If RESOLVED items were dropped but nothing was ALTERED or NEW, log (not prompt):

> `Axis B: {n} items resolved by upstream Axis A writes; no re-prompt needed.`

---

## Step 8 — Execute Axis B

### 8.F — Axis B, direction F (Figma wins → PR)

**Emit a drift-report PR. Do NOT auto-regenerate TSX.**

1. **Render drift markdown.** Use the template at [`./drift-report-template.md`](./drift-report-template.md). One section per drifted component, with:
   - cva variants expected vs. Figma variants present
   - Default variant diff
   - Prop diff (element component properties, code-only props, figma-only props)
   - Token-binding drift (code resolver output vs. Figma binding paths)
   - Bucket: `code-only` / `figma-only` / `variant-axis` / `default` / `prop` / `binding` / `composition`

2. **Write the file.**
   - Preferred path: `.changeset/design-drift-{YYYYMMDD-HHmm}.md` if a `.changeset/` directory exists at the repo root.
   - Fallback: `docs/design-drift/design-drift-{YYYYMMDD-HHmm}.md`, creating the directory if needed.

3. **Open a PR.**
   ```bash
   git checkout -b sync/design-drift-{YYYYMMDD-HHmm}
   git add <drift-file>
   git commit -m "chore(sync): design drift report $(date +%Y-%m-%d)"
   git push -u origin HEAD
   gh pr create --title "Design drift — {YYYY-MM-DD HH:mm}" --body "$(cat <<'EOF'
## Summary
Figma is source of truth for components this run. This report lists every drift the reconciler surfaced so code can be updated manually.

## Drift report
See `<drift-file>` in this PR.

## Recommended actions
- For `code-only` components with no matching ComponentSet, run `/create-component <name>` to draw them.
- For `figma-only` components, scaffold the source in `components/ui/<name>.tsx` using shadcn conventions, then run `/code-connect` to wire the mapping.
- For prop / variant / binding drift, edit the component source or its cva config to match the Figma side.
EOF
)"
   ```

   Record the PR URL.

4. **Do NOT run any Figma writes.** Axis B F-wins is code-side-only.

### 8.C — Axis B, direction C (Code wins → scoped redraw)

Delegate to `/create-component` with the new `--components` argument:

```
/create-component --components=<comma-separated-list-of-drifted-components>
```

Scope:
- Step 4.5 extraction runs only for the named subset.
- Step 6 draw runs only for the named subset (redraws the targeted ComponentSets in place on their `↳ {Page}` pages).
- Other Figma pages are untouched.

Log redrawn components + variant counts.

For **composition drift** items (`B.*.composition.*`), prefer scoping `/create-component --components=<composite>` after every referenced child atom is healthy in the registry; use `--migrate-to-instances` only when the composite page is still on the **flat** specimen layout and the designer explicitly chose migration over a full redraw.

### 8.R — Axis B, direction R

Apply `plan.B.items` resolutions:
- F-resolved items → roll into the drift-report PR (8.F mechanism, scoped to those items).
- C-resolved items → invoke `/create-component --components=<list>` scoped to their components.
- S-resolved items → skip and log.

If the resolutions are mixed (some F, some C) and both are non-empty, run the PR writer first (code side) and then the redraw (Figma side) — the drift-report PR only documents F-resolved items, so there is no conflict with the redraw.

### 8.S — Axis B, direction S

No writes. Log: `Axis B: skipped by user.`

---

## Step 9 — Validate Axis C (pre-execution)

**Trigger.** Same shape as Step 7: runs iff Axis C was enabled at preflight AND `plan.C.direction !== 'S'`. Same classification machinery against **post-B** state instead of post-A state.

### 9.1 — Re-compute Axis C diff

Re-run Step 3C. Triggers likely to appear:

- **Axis B C-wins added a new element component property** → an existing `.figma.tsx` no longer lists all Figma properties → `stale` entry appears → **ALTERED** if the stable key was already in the plan, **NEW** if not.
- **Axis B C-wins removed a variant** → an existing `.figma.tsx` references a deleted variant → **ALTERED** or **NEW** depending on original plan.
- **Axis B C-wins redrew a ComponentSet with a new ID** (normally IDs are stable; this is rare) → mapping becomes `stale` by ID.
- **Axis B F-wins path** → no Figma changes → usually all items remain **UNCHANGED**.

### 9.2 — Classify each item in `plan.C.items` against the fresh diff

Same four-bucket classification as 7.2: UNCHANGED / RESOLVED / ALTERED / NEW.

### 9.3 — Validation pause (fires only if pause batch non-empty)

One **AskUserQuestion** titled **"Axis C — upstream changes introduced new or altered drift"**. Same three options: **Same as C** (default), **Per item**, **Stop C**. Increment `plan.validationPausesTriggered`.

### 9.4 — No pause batch → proceed silently (log dropped items)

---

## Step 10 — Execute Axis C

### 10.F — Axis C, direction F (Figma wins → sync local)

For each item in `plan.C.items`:
- **missing** → no local file exists; a Figma mapping does → generate a new `.figma.tsx` from the published state (component symbol import, URL, props). Write to disk.
- **stale** → local `.figma.tsx` references something that no longer exists → regenerate that file from published state.
- **orphaned** → local `.figma.tsx` has no matching source file → **delete** the `.figma.tsx` (the source it referenced is gone).
- **unpublished** → local is newer than published; F wins means **discard local changes** → regenerate from published.

Present the set of file writes / deletes before executing via **AskUserQuestion**:

> "Axis C F-wins will write/delete N files under `**/*.figma.tsx`. Reply **yes** to apply, or **no** to abandon Axis C writes."

On `yes`, execute. On `no`, log `Axis C: F-wins abandoned at confirm.` and continue.

Report: `Axis C: refreshed N mappings locally; deleted M orphans.`

### 10.C — Axis C, direction C (Code wins → publish)

Delegate to the `/code-connect` skill. Pass the drifted components as the working set:

> Invoke `/code-connect` with the scoped set derived from `plan.C.items`. The skill runs its existing publish flow (Steps 6–8 of `/code-connect` — generate mapping entries, present for review, `send_code_connect_mappings`).

If `/code-connect` requires interactive confirmation (library-publish gate at its Step 2, per-mapping review at its Step 7), those interactions remain — they are inside `/code-connect`, not re-implemented here.

Record published counts.

### 10.R — Axis C, direction R

Apply `plan.C.items` resolutions. F-resolved items → file writes/deletes (10.F mechanism). C-resolved items → `/code-connect` publish scoped to those items. S-resolved → skip.

### 10.S — Axis C, direction S

No writes. Log.

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

---

## Supported Token File Formats (Axis A read)

### tokens.json (W3C Design Token Community Group format)

```json
{
  "color": { "primary": { "$value": "#2563EB", "$type": "color" } },
  "spacing": { "4": { "$value": "1rem", "$type": "dimension" } }
}
```

Traverse the nested object, constructing token names with `/` separators. Use the `$value` field as the token value. Ignore `$type`, `$description`, and other metadata for diff purposes.

### tailwind.config.js

```js
module.exports = {
  theme: {
    extend: {
      colors: { primary: '#2563EB' },
      spacing: { '14': '3.5rem' }
    }
  }
}
```

Read as text, evaluate the `theme.extend` (or `theme`) object. Map `colors.*` → `color/*`, `spacing.*` → `spacing/*`, `fontSize.*` → `typography/font-size/*`, etc. When writing back to Figma `codeSyntax` (iOS), flatten to dot-separated lowercase — e.g. `Headline/LG/font-size` → `.Typography.headline.lg.font.size`. Never emit camelCase.

> Note: If the config uses `require()` or references external modules, parse only literal values and skip dynamic expressions. Warn the designer if values were skipped.

### CSS custom properties (.css / .scss)

```css
:root {
  --color-primary: #2563EB;
  --spacing-4: 1rem;
}
```

Parse all `--<name>: <value>` declarations inside `:root` blocks. Convert kebab-case to slash-notation: `--color-primary` → `color/primary`, `--spacing-4` → `spacing/4`.

When parsing CSS custom properties that match Theme semantic token names, map them to the grouped Figma token paths using this reverse-lookup table. **Canonical keys** are the Tailwind-friendly `--color-*` names from `tokens.css` / Figma `codeSyntax.WEB` — duplicate shadcn / legacy vars are skipped during diff:

- `--color-background-dim` → `color/background/dim`
- `--color-background` → `color/background/default`
- `--color-background-bright` → `color/background/bright`
- `--color-background-container-lowest` → `color/background/container-lowest`
- `--color-background-container-low` → `color/background/container-low`
- `--color-background-container` → `color/background/container`
- `--color-background-container-high` → `color/background/container-high`
- `--color-background-container-highest` → `color/background/container-highest`
- `--color-background-variant` → `color/background/variant`
- `--color-content` → `color/background/content`
- `--color-content-muted` → `color/background/content-muted`
- `--color-border` → `color/border/default`
- `--color-border-subtle` → `color/border/subtle`
- `--color-inverse-surface` → `color/background/inverse`
- `--color-inverse-content` → `color/background/inverse-content`
- `--color-inverse-brand` → `color/background/inverse-primary`
- `--color-scrim` → `color/background/scrim`
- `--color-shadow-tint` → `color/background/shadow`
- `--color-primary` → `color/primary/default`
- `--color-on-primary` → `color/primary/content`
- `--color-primary-subtle` → `color/primary/subtle`
- `--color-on-primary-subtle` → `color/primary/on-subtle`
- `--color-primary-fixed` → `color/primary/fixed`
- `--color-primary-fixed-dim` → `color/primary/fixed-dim`
- `--color-on-primary-fixed` → `color/primary/on-fixed`
- `--color-on-primary-fixed-muted` → `color/primary/on-fixed-variant`
- `--color-secondary` → `color/secondary/default`
- `--color-on-secondary` → `color/secondary/content`
- `--color-secondary-subtle` → `color/secondary/subtle`
- `--color-on-secondary-subtle` → `color/secondary/on-subtle`
- `--color-secondary-fixed` → `color/secondary/fixed`
- `--color-secondary-fixed-dim` → `color/secondary/fixed-dim`
- `--color-on-secondary-fixed` → `color/secondary/on-fixed`
- `--color-on-secondary-fixed-muted` → `color/secondary/on-fixed-variant`
- `--color-accent` → `color/tertiary/default`
- `--color-on-accent` → `color/tertiary/content`
- `--color-accent-subtle` → `color/tertiary/subtle`
- `--color-on-accent-subtle` → `color/tertiary/on-subtle`
- `--color-accent-fixed` → `color/tertiary/fixed`
- `--color-accent-fixed-dim` → `color/tertiary/fixed-dim`
- `--color-on-accent-fixed` → `color/tertiary/on-fixed`
- `--color-on-accent-fixed-muted` → `color/tertiary/on-fixed-variant`
- `--color-danger` → `color/error/default`
- `--color-on-danger` → `color/error/content`
- `--color-danger-subtle` → `color/error/subtle`
- `--color-on-danger-subtle` → `color/error/on-subtle`
- `--color-danger-fixed` → `color/error/fixed`
- `--color-danger-fixed-dim` → `color/error/fixed-dim`
- `--color-on-danger-fixed` → `color/error/on-fixed`
- `--color-on-danger-fixed-muted` → `color/error/on-fixed-variant`
- `--color-field` → `color/component/input`
- `--color-focus-ring` → `color/component/ring`
- `--color-sidebar` → `color/component/sidebar`
- `--color-on-sidebar` → `color/component/sidebar-content`

**Skip during diff** — shadcn/ui and legacy names that duplicate `--color-*`:
`--background`, `--on-background`, `--foreground`, `--background-inverse`, `--foreground-inverse`, `--surface-raised`, `--surface-overlay`, `--border`, `--border-subtle`, `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--primary-foreground`, `--primary-subtle`, `--on-primary-subtle`, `--secondary`, `--on-secondary`, `--secondary-container`, `--on-secondary-container`, `--secondary-foreground`, `--secondary-subtle`, `--on-secondary-subtle`, `--tertiary`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container`, `--accent`, `--accent-foreground`, `--error`, `--on-error`, `--error-container`, `--on-error-container`, `--destructive`, `--destructive-foreground`, `--error-subtle`, `--on-error-subtle`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`

Platform-prefixed names (`--md-sys-*`, `--ios-*`) are legacy — skip them with a warning.

---

## Error Guidance

### File not found

> "The token file at `<path>` could not be found. Please check the path in `plugin/.claude/settings.local.json` or provide the correct file path."

If the path is still wrong after reporting the error, call **AskUserQuestion** to collect a corrected path before continuing.

### Malformed token file

> "The token file at `<path>` could not be parsed. It may contain a syntax error or an unsupported format.
>
> Supported formats: `tokens.json` (W3C DTCG), `tailwind.config.js`, CSS custom properties (`.css` / `.scss`).
>
> Please fix the file and run `/sync-design-system` again, or provide an alternative token file path."

Then call **AskUserQuestion** asking whether to paste a new token file path or stop the skill.

### API write permission error (403 / insufficient permissions)

> "The Figma API returned a permission error when trying to write variables. This usually means one of:
>
> - Your Figma account is not on an Organization tier plan (required for REST Variables API write access).
> - The Figma MCP connector needs to be re-authenticated in Claude Code settings.
> - You do not have edit access to the Figma file (`<file-key>`).
>
> Please verify your plan tier and connector auth, then retry."

### API read error (4xx / 5xx on GET variables)

> "Could not read variables from Figma file `<file-key>`. HTTP `<status>`: `<message>`.
>
> Check that the file key is correct and that your Figma MCP connector is authenticated. If the error persists, try re-authenticating the connector in Claude Code settings."

### Axis B extractor failure

If `extract-cva.mjs` exits non-zero for a component (custom composition, no cva, Radix-only file, etc.), record the component as `unresolvable` in the Axis B diff:

> `Axis B: {component} — source is not cva-based, cannot extract variant structure. Included in the diff as informational only; direction prompts will not target this component.`

### Axis C Connect API failure

If both the MCP path and `npx figma connect list --published` fail, fall back to a `local-only` Axis C — diff buckets `missing` / `stale` become unavailable (they require the published side), and only `orphaned` is reported (source file deleted). Emit:

> `Axis C: published-state read unavailable; diff limited to orphaned mappings (source files deleted).`

The user can still push in the C-wins direction (delegates to `/code-connect`, which has its own auth path); F-wins on an axis without published-state read is disabled for this run.
