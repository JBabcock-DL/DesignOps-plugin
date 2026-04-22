# Sync — Step 3 (compute diffs)

> **When to read:** After Step 2 completes for `full` / `code-to-figma`.
>
> **Next:** [`04-present-05-decide.md`](./04-present-05-decide.md).

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
| **stale** | local `.figma.tsx` exists **AND** Step 2C's per-node `get_code_connect_map` returned `publishedState: 'stale'` (entry present but `codeConnectSrc` / `codeConnectName` disagree) **OR** the mapping references a Figma variant/property that no longer exists in the ComponentSet | `C.<componentName>.mapping.stale` |
| **orphaned** | local `.figma.tsx` exists, imported source file does not | `C.<componentName>.mapping.orphaned` |
| **unpublished** | Step 2C's per-node `get_code_connect_map` returned `publishedState: 'unpublished'` (authoritative: the Figma side has **no** entry for this `nodeId`) **AND** the local `.figma.tsx` mtime is newer than its last-known publish hint (if any). A mere mtime delta without a confirmed-empty per-node lookup is **not** sufficient — that's how the false-positive "Button needs publish" regression happened. | `C.<componentName>.mapping.unpublished` |

**`indeterminate` mappings** (from Step 2C — per-node tool unavailable / threw / timed out) are **omitted from this diff**. Do not fall them through to `unpublished`. Step 2C already logged their names under the info line; repeating them here would re-introduce the same false-positive class.

In-sync mappings are omitted.
