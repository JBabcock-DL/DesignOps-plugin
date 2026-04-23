# Phased payload research — one summary for planning

**Purpose:** Single source for designing **phase-scoped config** (separate, smaller `CONFIG` slices per MCP call instead of repeating one giant object) and matching **preamble** / handoff. Grounded in `templates/draw-engine.figma.js` and `templates/preamble.figma.js` as of this doc.

**Related:** `09-mcp-multi-step-doc-pipeline.md`, `04-doc-pipeline-contract.md`, `../EXECUTOR.md` (inline phased / preassembled), `create-component-figma-slice-runner` + `13-component-draw-orchestrator` (delegated six-slice), `templates/draw-engine.figma.js` phase markers.

---

## 1. What we are really splitting

- **Figma state (persistent between calls):** `_PageContent` + doc shell from **`cc-doc-scaffold` first**; then staging `_ccVariantBuild/...` after **`cc-variants`**; then after `cc-doc-component`, `COMPONENT_SET` inside the doc section. Passed as **ids** (`__PHASE_1_VARIANT_HOLDER_ID__`, optional `__CC_HANDOFF_COMP_SET_ID__` after component step, `__CC_HANDOFF_PAGE_CONTENT_ID__`, `__CC_HANDOFF_DOC_ROOT_ID__`, etc.) and rehydrated with `getNodeByIdAsync` in `__ccDocResumeFromHandoff()` / phase-2 entry.
- **Config state (injected script input):** Today one **`const CONFIG = {…}`** read across the whole engine. Re-sending the full object every call is a **contract** choice, not a Figma requirement.
- **Preamble (registry / file key):** `preamble.figma.js` runs **after** `CONFIG` and **reads** `CONFIG.composes` to set `usesComposes` (line 61). Full `REGISTRY_COMPONENTS` + `ACTIVE_FILE_KEY` are replaced at assembly time.

**Misconception to avoid:** “45 KB ÷ 6 steps ≈ 7.5 KB per call.” Each `use_figma` runs a **new** full script. Per-call size is `|preamble| + |CONFIG| + |engine step| + |globals|`, not total work ÷ 6. The win from phase-specific CONFIG is **shrinking the CONFIG line item**, not the minified engine (unless the engine is also split to reference only smaller objects).

---

## 2. Two different outer limits (why both “50K” and “~28K” show up)

| Limit | What it bounds | How we align today |
|--------|----------------|---------------------|
| Figma / MCP `code` | ~50,000 characters per `code` string | `build-min-templates.mjs` + `qa-step-bundles.mjs` use **50K − 10K CONFIG headroom** on the **naked** `.min.figma.js` file |
| Agent / Task tool JSON | Stricter (observed ~28K class in some paths) | **Not** the same as the naked-file QA pass; a **transport** cap on the **whole** `use_figma` arguments object |

**Planning implication:** A future “phase config” QA should size **`CONFIG + patched preamble + step bundle + handoff lines`**, not the step file alone.

---

## 3. Execution order (what always runs on every call)

**Every** invocation executes from the top of `draw-engine.figma.js` through the shared setup, including:

- **§0a preamble gate** — requires `CONFIG`, `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS`, `usesComposes`, etc.
- **§1** — `CONFIG.pageName` for `setCurrentPageAsync`
- **§2–5** — variable collections, `bindColor` / `bindNum`, font loading, `allTextStyles`
- **§5.6** — `CONFIG.iconPack` (optional) for default icon resolution
- **§5.7+** — chip `buildVariant` or helpers as applicable (layout-dependent; doc-only tail may omit)
- **§6.0+** — `_ccPhase` handling, page clear, then **`hasSizeAxis` / `sizeList` / `padFallback` / `radiusVar` / `labelStyle` / `iconSlots` / `cp` / `defaultLabelText`** — all from **`CONFIG` lines ~764+**
- **§6.2a** — `layoutKey` from `CONFIG.layout` and `usesComposes`
- **Then** either: load `compSet` for `_ccPhase === 2`, or build variants from `CONFIG.variants` / `CONFIG.style` / `CONFIG.label` / …

**Critical for plan:** For **`_ccPhase === 2`** (all doc work, including multistep `__ccDocStep` 1–6), the engine **does not** rebuild variants, but it **still executes** the block that defines `hasSizeAxis`, `defaultLabelText`, `layoutKey`, etc. So any phase-specific `CONFIG` for “doc only” must still supply **every key that this shared prefix reads** unless the engine is **refactored** to branch earlier or use smaller typed objects. That is the main engineering cost: **slicing CONFIG is a source + binding refactor**, not only the parent omitting keys in the string.

---

## 4. `preamble.figma.js` — dependencies

| Output | How it is determined |
|--------|------------------------|
| `usesComposes` | `Array.isArray(CONFIG.composes) && CONFIG.composes.length > 0` (requires **`CONFIG` in scope** with at least `composes`, or a changed preamble contract) |
| `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS` | Replaced at assembly from `.designops-registry.json` — **large** in bytes if many components |
| `logFileKeyMismatch`, `_fileKeyObserved`, `_fileKeyMismatch` | File-key soft gate |

**Planning implication:** A “thin preamble” for early phases may need either **minimal `composes: []`** in CONFIG or a preamble variant that takes **`usesComposes`** as an injected boolean without reading the full `composes` array. **Full `REGISTRY_COMPONENTS`** is most needed for **registryEntry / version / composed child versions** at **finalize**; earlier steps might use a **smaller** registry map if the engine is taught not to read sibling entries before finalize.

---

## 5. `CONFIG.*` key → first consumer (line-level map)

| Key / pattern | Where used (first / primary) |
|---------------|------------------------------|
| `pageName` | Early: navigate to page (`~115`); return payload / registry (`~1813`, `~1843`) |
| `iconPack` | `§5.6` icon resolution (`~289`) — runs on **all** paths that include that block |
| `sizes`, `length` | `hasSizeAxis`, `sizeList` (`~764+`); matrix; icon-only checks; `simpleCvaHash` |
| `padH` | Defaults + per-size (`~766`, `~965`) |
| `radius` | `radiusVar` (`~767`) |
| `labelStyle` | Defaults + per-size (`~769`, `~966`) |
| `iconSlots` | `leading`/`trailing`/`size` (`~770+`); finalize checks `~1712+` |
| `componentProps` | `cp` for chip prop wiring (`~774`, `~1016+`) |
| `label` | **function or string** — `defaultLabelText` (`~778+`), builder loops (`~962+`), icon-only test (`~1751+`) |
| `title` | `compSet` name (`~1030`), `makeText` header (`~1200`), default labels |
| `layout` | `layoutKey` / archetype (`~855+`) — except `usesComposes` wins |
| `component` | Frame naming (`~1177+`), logging, errors (`~1009`), return payload, registry |
| `variants` | Builder loops (`~957+`), matrix (`~1454`), `simpleCvaHash` (`~1764`) |
| `style` | Per-variant `st` (`~959+`), `simpleCvaHash` |
| `summary` | Header only (`~1204`) — **not** read in phase-1 early return path if doc tail omitted |
| `properties` | `buildPropertiesTable` (`~1377`) — doc step 1+ |
| `states` | Matrix (`~1456`) — doc step 3+ |
| `applyStateOverride` | **function** — matrix only (`~1591+`) — doc step 3+ |
| `usageDo` / `usageDont` | Usage section (`~1635+`) — doc step 4+ |
| `composes` | Preamble `usesComposes` (`preamble.61`); `layoutKey === __composes__`; builder; `returnPayload` / registry (`~1837–1850`) |
| `_source` | `cvaHash` branch (`~1846`) — finalize |
| (implicit) | `REGISTRY_COMPONENTS[CONFIG.component]` for `prevReg` / `nextVersion` (`~1771`) — finalize |

---

## 6. Phases in the product today vs ideal CONFIG slices

**A. Two-phase: `_ccPhase === 1` (variant only, return early ~1057)**  
**Dereferences before return:** Everything through variant build: `pageName`, `iconPack`, all of `~764+` through `~1053`, and **`summary` / `properties` / `states` / `applyStateOverride` / `usageDo` / `usageDont` are *not* used on this path** in the code that runs if the file includes the early return.  
**Caveat:** The **source file** as shipped still **parses** the full `CONFIG` object literal if the parent passes it; only a **smaller object + unused keys removed** shrinks the string. The **engine** must not reference removed keys in the shared prefix, or the prefix must be **split** so doc-only keys are not in scope for the phase-1 bundle.

**B. Two-phase: `_ccPhase === 2` (doc tail)**  
Needs: `title`, `summary`, `component`, `pageName`, `properties`, `variants`, `sizes`, `states`, `style`, `label`, `applyStateOverride`, `usageDo`/`usageDont`, `iconSlots` (for §6.9 checks), `layout`, `composes`, `_source`, `component`, and everything the **shared prefix** still evaluates (`iconPack` if block present, `hasSizeAxis`, etc.).

**C. Six-step: `__ccDocStep` 1…5 (phase 2 + doc ladder)**  
| Step | What runs (`__ccDocDispatch`) | CONFIG keys *unique* to that slice (conceptual; see §3) |
|------|-------------------------------|--------------------------------------------------------|
| 1 | `__ccDocPageHeader` + `__ccDocAppendProperties` | `title`, `summary`, `component`, **`properties`**, plus shared naming |
| 2 | resume + `__ccDocAppendComponentSection` | mostly **ids**; `component` for paths |
| 3 | resume + `__ccDocAppendMatrix` | `variants`, `sizes`, `states`, `style`, **`applyStateOverride`**, `label` |
| 4 | resume + `__ccDocAppendUsage` | `usageDo`, `usageDont`, `component` |
| 5 | resume + `__ccDocFinalizeAndReturn` | `pageName`, `component`, `layout`, `composes`, `_source`, **registry** fields; `iconSlots` for checks; `variants`/`states`/`sizes` for log line |

**D. Function-valued keys**

| Key | Phases that need the real function |
|-----|------------------------------------|
| `label` | Variant build, matrix, icon-only diagnostics, `simpleCvaHash` input |
| `applyStateOverride` | Matrix only (step 3 in ladder) |

These **cannot** be round-tripped as pure JSON; the phase that needs them must still receive **JavaScript** (or a **declarative** substitute — separate product work).

---

## 7. Gaps a plan must close

1. **Shared prefix (§1–5 + ~764+)** still references a **wide** `CONFIG` on every call unless the engine is **split** into multiple entrypoints (e.g. `draw-engine.header-only.figma.js` for a future “config-light” second call) or uses **`Object.assign(CONFIG, handoffPatch)`** with a **minimal base**.
2. **`preamble.figma.js`** must be **sliced** or **duplicated in tiers** (full vs finalize-only) so we do not ship the full `REGISTRY_COMPONENTS` JSON when only `ACTIVE_FILE_KEY` + small map is needed.
3. **Authoring in `/create-component`:** Mode A/B today produces **one** `configBlock`. A phased plan needs either **one generator emitting N JSON+JS files** (with functions only on steps that need them) or a **build step** that projects the full `CONFIG` into `CONFIG@variant`, `CONFIG@doc1`, … with **proven** key subsets.
4. **Verification:** Per-phase `check-payload` (or a successor) should assert each emitted file only references **declared** keys and matches the **right** minified engine entrypoint.

---

## 8. Suggested planning sequence (no implementation order implied)

1. **Freeze** a **CONFIG@phase** key matrix from §5–6 and mark **must-duplicate** shared-prefix keys (§3).
2. **Decide** preamble strategy: `usesComposes` without full `composes` in early phases vs always passing minimal `composes: []` / real array.
3. **Split or duplicate** the **top of draw-engine** so doc-only min bundles do not **evaluate** `iconPack` / variant `layoutKey` if not needed (largest code savings live here + smaller CONFIG).
4. **Emit** phased configs from the same resolved component definition (parent skill), then wire runner §0 to assemble **N** scripts with **N** `CONFIG` sizes.
5. Re-run **MCP** sizing on **`CONFIG + preamble + step`**, not on `.min.figma.js` alone.

This document is the handoff: extend it with ADR-style decisions as the contract hardens.
