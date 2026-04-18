# Plan — Atomic composition for `/create-component`

**Status:** Draft · needs decision on phasing
**Owner:** (unassigned)
**Skills touched:** `/create-component`, `/code-connect`, `/sync-design-system`, `/create-design-system` (CONVENTIONS only)
**Related summary:** replaces today's "flat-draw" behaviour where every component — atom or composite — is emitted as an independent collection of raw shapes + text.

---

## 1. Problem statement

Today, when `/create-component` draws a composite like `button-group`, `toggle-group`, `pagination`, `breadcrumb`, or `tabs`, the specimen in the matrix is built from **raw shapes and text nodes** that happen to *look* like Buttons/Toggles/etc. There is no relationship back to the atomic ComponentSet that `/create-component` already published on `↳ Buttons` or `↳ Toggle`.

### Concrete consequences

| Symptom | Cause |
|---|---|
| Editing the `Button` paint in `↳ Buttons` does **not** update the buttons rendered inside `↳ Button Groups`. | ButtonGroup specimen has no Figma instance reference to Button — it's a detached shape cluster. |
| Code Connect for `button-group.figma.tsx` can't map children to `<Button>` — it has to hard-code variants. | The Figma tree has no `InstanceNode` children to resolve against. |
| Designers edit a ButtonGroup in one Figma file, paste it elsewhere, and the Button styling drifts silently. | No component identity on the children; they're "just rectangles" as far as Figma is concerned. |
| `/sync-design-system` Axis B detects class drift on atoms but never catches composites whose children have fallen behind. | The diff walks a composite's own cva output, not its children. |
| A new atom variant (e.g. adding `size=xl` to Button) doesn't flow into existing composites automatically. | Composites were drawn once from shapes; there's no regenerate-from-graph step. |

Of the ~45 components in `shadcn-props.json`, at least **18** are composites (toggle-group, radio-group, form, input-otp, breadcrumb, pagination, command, dropdown-menu, context-menu, navigation-menu, menubar, tabs, table, accordion, dialog, alert-dialog, sheet, sidebar). The problem is not niche.

### Why it wasn't caught during Mode A (cva extraction) work

Mode A extracts the **composite's own cva** — the outer wrapper's Tailwind classes (flex, gap, border, padding). It faithfully resolves those to tokens. But the **children** of the composite are never extracted because cva doesn't describe composition; JSX describes composition, and we don't parse JSX. So the draw step invents a plausible inner arrangement (three rectangles with labels) instead of referencing the real child component.

---

## 2. Goals and non-goals

### Goals

1. **Declare composition as data** — `shadcn-props.json` gains a `composes` field that names child components explicitly. No JSX parsing, no guessing.
2. **Draw composites as instance stacks** — composite specimens contain real `InstanceNode`s of published atoms, wrapped in the composite's own cva-derived chrome.
3. **Preserve single-source-of-truth** — editing `Button` on `↳ Buttons` propagates through every composite automatically (native Figma instance behaviour).
4. **Enable nested Code Connect** — composite `.figma.tsx` templates use `figma.children(...)` / `figma.instance(...)` to delegate to atom mappings.
5. **Detect composition drift** — `/sync-design-system` Axis B grows a `COMPOSITION_DRIFT` bucket for detached instances, deleted atoms, or stale keys.
6. **Migrate existing composites** — provide a safe, opt-in rewrite flow for the composites already drawn on the canvas, preserving frame IDs so inbound references survive.

### Non-goals

1. **Auto-detecting composition from TSX source.** Declare-it-yourself is simpler, auditable, and survives shadcn's own rewrites. JSX parsing is brittle and off-scope.
2. **Changing the page taxonomy.** Each composite still lives on its own `↳ PageName`. The Button atom is not "inside" the ButtonGroup page.
3. **Introducing a new atomic/molecule/organism ontology.** The composition graph is enough; we don't need a separate "tier" field.
4. **Prop propagation from composite to child** (e.g. `buttonGroup.variant=destructive` → children become destructive Buttons). Phase-3 uses `defaultProps` only; propagation is a later upgrade.

---

## 3. Schema change — the `composes` field

New optional field on every entry in `shadcn-props.json`:

```jsonc
"button-group": {
  "pageName": "↳ Button Groups",
  "labelKey": "variant",
  "summary": "Group of Buttons rendered as a single control.",
  "componentProps": { "label": false, "leadingIcon": false, "trailingIcon": false },

  // NEW ↓
  "composes": [
    {
      "component": "button",
      "slot": "children",
      "cardinality": "many",
      "count": 3,
      "defaultProps": { "variant": "outline", "size": "default" }
    }
  ],
  // NEW ↑

  "properties": [ /* … */ ]
}
```

### Field contract

| Field | Type | Required | Meaning |
|---|---|---|---|
| `component` | `string` (kebab-case) | yes | Must resolve to another key in `shadcn-props.json`. Topological sort rejects cycles. |
| `slot` | `string` | yes | Semantic slot name. Becomes the Figma frame name (`slot/children`, `slot/trigger`, etc.) and matches the Code Connect `figma.children(name)` lookup. |
| `cardinality` | `"one"` \| `"many"` | yes | `"one"` → exactly one instance in the specimen (e.g. dialog → trigger). `"many"` → repeat `count` times. |
| `count` | `number` | only when `cardinality="many"` | Defaults to 3. Controls specimen repetition, not runtime behaviour. |
| `defaultProps` | `Record<string, string \| number \| boolean>` | no | Variant/size preset passed to `instance.setProperties(...)`. Keys must match the child's own Figma component properties. |

### Validation rules (enforced in `/create-component` Step 4.5)

1. Every `composes[].component` **must** exist as another top-level key in the same `shadcn-props.json`.
2. The graph **must** be acyclic. (Tarjan's SCC, failure aborts the run with a ranked list of cycle members.)
3. Every `defaultProps` key **must** be declared in the child's resolved variant/size axes (checked against the child's post-merge CONFIG).
4. `cardinality: "one"` **must not** carry a `count` field.
5. Unknown extra fields are tolerated (forward-compat), but a warning is logged.

### Cross-page composites (the important one)

When `button-group` composes `button`, and `button` lives on `↳ Buttons` while `button-group` lives on `↳ Button Groups`, instance references cross pages. Figma supports this natively **if** we resolve the child component by a stable handle. Two options for the handle:

- **Option A (name-match, simple, fragile):** `figma.root.findOne(n => n.type === 'COMPONENT_SET' && n.name === 'Button — ComponentSet')`. Fine until someone renames the set.
- **Option B (registry, robust, more moving parts):** `/create-component` writes `.designops-registry.json` at the repo root at the end of every successful atom draw, mapping `component → { nodeId, key, pageName, publishedAt, version }`. Composite draws read this file and use `figma.getNodeByIdAsync(...)` or `figma.importComponentByKeyAsync(...)`.

**Recommendation: B.** It's the same pattern Code Connect already relies on (component keys), it survives renames, and it gives `/sync-design-system` a manifest to diff against. A runs into trouble the first time a designer duplicates the ComponentSet for a dark-mode spike. See §5.

---

## 4. Runtime pipeline changes

### 4.1 — Dependency resolver

New helper in `/create-component`, called during Step 4.5 after CONFIG assembly and **before** any drawing:

```
resolveDependencies(componentName)
  → read shadcn-props.json
  → build directed graph from `composes[]`
  → topological sort
  → for every node in the sort, assert the child's CONFIG is already assembled
  → assert (registry has entry OR the child is in the current run's batch)
  → return ordered list of components to draw
```

If a composite is invoked standalone (`/create-component button-group`) but its atoms are not yet drawn, the resolver **expands the request** to include the atoms first. The user sees a summary like:

```
button-group depends on: button
  ✓ button is present in registry (last published 2026-03-14)
  → will draw button-group only

pagination depends on: button
  ✗ button is not in registry
  → will draw button first, then pagination
Continue? [y/N]
```

### 4.2 — `buildVariant` fork

Today `buildVariant(variantKey, sizeKey, state)` emits:

```
frame(variant-chrome)
  ├── (optional) icon-slot/leading
  ├── (optional) text(label)
  └── (optional) icon-slot/trailing
```

When `CONFIG.composes` is non-empty, the inner arrangement is replaced:

```
frame(variant-chrome)   ← still uses composite's own cva classes → tokens
  └── slot/{slotName}   ← auto-layout matching composite's cva gap/direction
       ├── instance(child) ← figma.createInstance(childComponent)
       ├── instance(child) ← repeated `count` times for cardinality:many
       └── instance(child)
```

Key invariants:

- The **outer frame chrome** (fill, stroke, radius, padding, itemSpacing, layoutMode) always comes from the composite's own resolved cva. That behaviour is unchanged.
- The **inner children** never come from cva. They come from `composes`.
- If the composite's cva specifies padding/gap but `composes` is present, cva wins for the wrapper; `composes.defaultProps` wins for child variants.
- If `composes` is empty/absent, buildVariant falls back to today's behaviour exactly. No regressions on atoms.

### 4.3 — Registry file format

New file at repo root: `.designops-registry.json`.

```jsonc
{
  "$schema": "./skills/create-component/registry.schema.json",
  "fileKey": "BLcvn6UptGIgtNzNfLU4TU",
  "components": {
    "button": {
      "nodeId": "12:345",
      "key": "8f3a…",           // published ComponentSet key from Figma
      "pageName": "↳ Buttons",
      "publishedAt": "2026-04-17T14:20:11Z",
      "version": 3,             // incremented every redraw
      "cvaHash": "sha256:…"     // for /sync-design-system drift detection
    },
    "button-group": { /* … */ }
  }
}
```

- Written by `/create-component` Step 8 (run report) after successful draw.
- Consumed by `/create-component` (resolve dependencies), `/sync-design-system` Axis B (COMPOSITION_DRIFT), and `/code-connect` (resolve child component keys for nested mappings).
- Committed to the repo — it's the bridge between the Figma file and the codebase.
- Multi-file support: if `fileKey` at the top doesn't match the active file, `/create-component` refuses to run until the registry is reset (prevents cross-file key pollution).

### 4.4 — CONVENTIONS updates

`skills/create-component/CONVENTIONS.md` grows a new section (between current §3 and §3.1):

> **§3.05 — Composition via `composes`**
>
> When a component declares `composes[]`, its matrix cells are instance stacks, not shape stacks. The inner layout frame is named `slot/{slotName}` and uses the composite's own cva-derived layout. Children are `InstanceNode`s of atoms published on other pages. Detaching an instance is a drift signal — see `/sync-design-system` Axis B.

And `skills/create-design-system/CONVENTIONS.md` §3 grows a row for the new `.designops-registry.json` file.

---

## 5. `/code-connect` implications

### 5.1 — Emission

When `/code-connect` generates a `.figma.tsx` for a component with `composes[]`, instead of hard-coding child specimens, it emits:

```tsx
// button-group.figma.tsx  (generated)
import figma from '@figma/code-connect'
import { ButtonGroup } from '@/components/ui/button-group'

figma.connect(ButtonGroup, 'https://figma.com/…/BLcvn6UptGIgtNzNfLU4TU?node-id=…', {
  props: {
    children: figma.children('children')   // ← slot name from composes[].slot
  },
  example: ({ children }) => <ButtonGroup>{children}</ButtonGroup>
})
```

The `figma.children('children')` call resolves against the slot's real `InstanceNode` children in the matrix, each of which has its own `button.figma.tsx` mapping. Nested Code Connect works natively once the Figma tree contains real instances.

### 5.2 — Lookup

When `/code-connect` resolves the Figma node-id for the composite's ComponentSet, it reads `.designops-registry.json` rather than walking the Figma tree each time. This drops wall-clock for large files from ~10s per component to ~constant.

### 5.3 — Validation

`/code-connect` asserts that every child component referenced via `figma.children()` has its own published `.figma.tsx`. Missing children block emission with a clear error (`pagination references button, but button.figma.tsx does not exist — run /code-connect button first`).

---

## 6. `/sync-design-system` Axis B — new bucket

Axis B today reports four buckets: `UNCHANGED`, `RESOLVED`, `ALTERED`, `NEW`. Add a fifth:

**`COMPOSITION_DRIFT`** — fires when any of:

1. A composite specimen contains a detached Figma node where an `InstanceNode` of a registered atom was expected.
2. The `mainComponent` key on an instance inside a composite doesn't match the current registry entry for that atom.
3. An atom referenced by a composite's `composes[]` is missing from the registry entirely.
4. The atom has been redrawn (registry `version` bumped) since the composite was last drawn (composite's `cvaHash` embedded in the registry predates the atom's `publishedAt`).

The Axis B executor for `COMPOSITION_DRIFT` offers the same four actions as other buckets: `F-wins` (rewrite composite in-place), `C-wins` (regenerate from schema via `/create-component --redraw`), `R` (record only), `S` (skip). `F-wins` in this bucket is just re-running the composite's redraw — the cost is bounded.

---

## 7. Migration for already-drawn composites

This is the riskiest phase because existing composites on the canvas may be referenced from:

- Prototype flows (source nodes in Figma prototypes)
- Cross-file component instances (designers copied the ButtonGroup into a product file)
- Inbound Code Connect URLs (hard-coded in existing `.figma.tsx` files)

Destroying and recreating the composite frame breaks all three.

### 7.1 — Strategy: in-place rewrite preserving the outer frame ID

```
/create-component button-group --migrate-to-instances
  1. figma.getNodeByIdAsync(registry.button-group.nodeId)
  2. Walk matrix; for each cell:
       a. Record current cell frame's (x, y, width, height) and autoLayout config
       b. Remove all descendants
       c. Create slot frame + instances of button with defaults
       d. Replace cell contents
  3. Preserve outer ComponentSet node — do not delete, do not clone
  4. Update registry: bump version, write new cvaHash
```

`nodeId` stability is what keeps prototypes + cross-file instances pointing at the same component. Figma treats in-place child replacement as a normal edit; inbound references survive.

### 7.2 — Fallback: dual-page deprecation window

If in-place rewrite fails (e.g. the outer frame was moved to a non-matching page), `/create-component --migrate-to-instances` falls back to:

1. Create `↳ Button Groups (v2)` page.
2. Draw new instance-based composite there.
3. On `↳ Button Groups`, add a deprecation banner linking to v2.
4. After 2 weeks, delete `↳ Button Groups` and rename v2 → primary.

The agent prompts the user to pick in-place or dual-page; default is in-place.

### 7.3 — Pre-migration audit

Before any write, the migration command runs a read-only audit that reports:

- Count of incoming prototype edges into the composite frame
- Count of cross-file instances (if the `get_metadata` MCP tool exposes this; otherwise "unknown — proceed with caution")
- Whether any `.figma.tsx` points at the specific node-id

Audit results are printed and the user confirms before writes proceed.

---

## 8. Phased delivery

| Phase | Deliverable | Risk | Reversibility | Unblocks |
|---|---|---|---|---|
| **1 — Schema** | Add `composes` to `shadcn-props.json` schema + validation in `/create-component` Step 4.5. No runtime draw change. | Low — JSON-only. | Trivial (delete field). | Designers can start annotating composites immediately. |
| **2 — Registry** | `/create-component` writes `.designops-registry.json` after every successful atom draw. No one consumes it yet. | Low — new file. | Delete the file. | Phase 3 and `/code-connect` lookup speedup. |
| **3 — Composite runtime** | `buildVariant` forks on `composes[]`. New composites drawn as instance stacks. Existing composites untouched. | Medium — new draw path, but side-by-side with legacy path. | Remove the fork; legacy path still works. | Real atomic composition for any new or redrawn composite. |
| **4 — Nested Code Connect** | `/code-connect` emits `figma.children(...)` templates for composites. | Medium — depends on Phase 3 for Figma tree to contain instances. | Regenerate with flat templates. | True code-to-design parity for composites. |
| **5 — Axis B drift** | `/sync-design-system` Axis B grows `COMPOSITION_DRIFT` bucket. | Low — additive to existing diff. | Disable the bucket. | Continuous detection of detached instances. |
| **6 — Migration** | `--migrate-to-instances` flag on `/create-component`. | **High** — touches already-published composites with inbound references. | Dual-page fallback covers catastrophic cases; in-place rewrite is reversible via Figma version history. | One-time rewrite of the existing 18 composites. |

### Recommended order

Ship **1 → 2 → 3 → 5 → 4 → 6**. The Axis B drift detection (5) should land before the Code Connect work (4) so we have a monitoring signal the moment composites start drawing as instances. Migration (6) lands last, after the new draw path has been proven on at least three composites on a fresh file.

### Smallest useful stand-alone slice

If only one phase is shipped, ship **Phase 1 (schema + validation)**. It costs almost nothing and creates the contract that everything else hangs off. Designers can annotate composites immediately, and the annotations stay correct even before the runtime understands them.

---

## 9. Test scenarios

Scenarios to run on a throwaway Figma file (not the main Foundations file) before each phase is declared done.

### Phase 1

| # | Setup | Action | Expected |
|---|---|---|---|
| 1.1 | Add `composes: [{component: "nonexistent"}]` to button-group | Run `/create-component button-group` | Validation error with message pointing to the bad key |
| 1.2 | Add `composes: [{component: "button"}]` to both a and b where a composes b and b composes a | Run `/create-component a` | Cycle error listing both components |
| 1.3 | Add valid `composes: [{component: "button", cardinality: "many", count: 3, defaultProps: {variant: "outline", size: "default"}}]` to button-group | Run `/create-component button-group` | Validates successfully, draws today's flat shapes (Phase 1 does not change draw path) |
| 1.4 | `defaultProps: {variant: "nonexistent"}` | Run | Error: "variant 'nonexistent' not in button.variants" |

### Phase 2

| # | Setup | Action | Expected |
|---|---|---|---|
| 2.1 | Fresh file, empty registry | Run `/create-component button` | Registry written with one entry; `version: 1` |
| 2.2 | Registry exists, button drawn | Re-run `/create-component button` | Registry `version: 2`, new `publishedAt`, same `nodeId` |
| 2.3 | Registry has `fileKey: X`, current file key is Y | Run any `/create-component` | Refuses to run; prints instructions to reset |

### Phase 3

| # | Setup | Action | Expected |
|---|---|---|---|
| 3.1 | Button drawn (registry has it), button-group has `composes` | Run `/create-component button-group` | Specimen cells contain 3 real `InstanceNode`s of Button; `mainComponent` resolves to the button ComponentSet on `↳ Buttons` |
| 3.2 | Edit Button's default paint, re-publish | Re-open file | Button-group specimen reflects new paint without re-drawing |
| 3.3 | Button-group composes Button, Button not yet drawn | Run `/create-component button-group` | Resolver expands the request; draws Button first, then button-group. User confirmed the expansion. |
| 3.4 | Toggle-group composes toggle (similar setup) | Run | Same behaviour as 3.1 with Toggle children |
| 3.5 | Composite with `cardinality: "one"` (dialog → button trigger) | Run | Exactly one Button instance in the trigger slot |

### Phase 4

| # | Setup | Action | Expected |
|---|---|---|---|
| 4.1 | Button + button-group drawn; button.figma.tsx published | Run `/code-connect button-group` | Emits template using `figma.children('children')`; points at button's existing mapping |
| 4.2 | button.figma.tsx missing | Run `/code-connect button-group` | Blocks with clear error |

### Phase 5

| # | Setup | Action | Expected |
|---|---|---|---|
| 5.1 | Composite drawn with instances; manually detach one in Figma | Run `/sync-design-system` | `COMPOSITION_DRIFT` bucket reports 1 item pointing at the detached node |
| 5.2 | Delete Button ComponentSet; button-group still references it | Run | `COMPOSITION_DRIFT` reports missing atom with remediation (redraw button) |
| 5.3 | Redraw Button (bumps registry.version); button-group not yet redrawn | Run | `COMPOSITION_DRIFT` reports stale composite with remediation (redraw button-group) |

### Phase 6

| # | Setup | Action | Expected |
|---|---|---|---|
| 6.1 | Existing flat-shape button-group on canvas | Run `/create-component button-group --migrate-to-instances` | In-place rewrite preserves outer frame node-id; cells now contain real Button instances |
| 6.2 | Prototype connections into button-group's matrix | Run migration | Pre-migration audit flags the prototype edges; user confirms; edges survive in-place rewrite |
| 6.3 | Simulate outer frame on wrong page | Run migration | Falls back to dual-page strategy; creates `↳ Button Groups (v2)` |

---

## 10. Open questions

1. **Prop propagation.** Should `composes` support declarations like `propagateProps: ["variant", "size"]` so that `buttonGroup.variant=destructive` forces children to `destructive`? Phase 3 says no. When does this become mandatory?
2. **Slot naming collisions.** If a composite has two slots with the same child component (e.g. dialog with a primary button and a cancel button), do they get `slot/primary` and `slot/cancel` with separate `composes[]` entries? Yes — `slot` is the disambiguator and must be unique per composite. Validation rule TBD in Phase 1.
3. **Registry ownership across branches.** What happens when branch A redraws Button and branch B redraws ButtonGroup? The registry merges by `nodeId`; `cvaHash` diverges. Probably fine but warrants a conflict note in Phase 2.
4. **Atom renames.** If a designer renames the Button ComponentSet, the registry's `key` and `nodeId` survive (Figma keeps them), but any Code Connect mapping pinned on the old name needs an update. Do we add a `/code-connect --relink` command, or is that separate?
5. **Cross-file atoms.** Some teams will want to compose across Figma files (Foundations Button inside a Product composite). Figma supports this via Library imports; the registry would need `libraryKey` per entry. Out of scope for Phase 1–6; worth a note for a future "v2 registry."
6. **What about `children` that are plain text, not instances?** (e.g. Breadcrumb items are mostly text with a separator icon between.) Plan: `composes[].component` may also be a primitive like `"text"` or `"icon"` with a reserved meaning — but this re-invites the cva-draw problem. Alternative: for breadcrumb-style composites, declare `composes: [{component: "button", cardinality: "many", defaultProps: {variant: "ghost"}}]` and let the Button atom handle the text. Needs a worked example before Phase 3 ships.

---

## 11. Decision requested

Two live decisions before build agents are spawned:

1. **Phasing.** Ship all six phases as one body of work, or land Phase 1 alone first as a schema contract? Recommendation: land Phase 1 first — it's reversible, lets designers start annotating, and de-risks Phase 3 by building a real corpus of `composes[]` entries to validate against.

2. **Registry vs. name-match (§3).** Option B (registry file) or Option A (findOne by name)? Recommendation: B.

Once decided, this plan is handed to `/build` which will spawn code-build and doc-build agents per phase.
