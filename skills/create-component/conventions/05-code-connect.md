# create-component / conventions / 05-code-connect.md

> Scope: the **code side** of Mode A — extracting cva configuration from installed shadcn source files, resolving Tailwind classes against `tokens.css` to Figma variable paths, and merging the results with the curated [`shadcn-props.json`](../shadcn-props.json) entry to produce a complete `CONFIG` object. This is what makes Figma a **derived mirror** of the code instead of a hand-authored doppelgänger.
>
> **Related**: [`00-overview.md`](./00-overview.md) (Mode A vs Mode B contract). [`01-config-schema.md`](./01-config-schema.md) (the CONFIG fields this pipeline populates). [`06-audit-checklist.md`](./06-audit-checklist.md) §14.0 (the Mode A audit assertions this content gates against). The resolver scripts live in [`skills/create-component/resolver/`](../resolver/).

## 2.5 — Source extraction (Mode A)

> Scope: applies only when Step 4.5 preconditions pass (shadcn installed, source file present, `tokens.css` resolvable, `shadcn-props.json` has the component). In Mode B, skip this section entirely — CONFIG is hand-written from the synthetic template.

### 2.5.1 — The two scripts

Both scripts live under [`skills/create-component/resolver/`](../resolver/) and are invoked as subprocesses from `SKILL.md` §4.5. Agents **never edit them inline in a `use_figma` call** — they are standalone Node ESM modules and must be spawned.

| Script | Input | Output (stdout JSON) | Exit behavior |
|---|---|---|---|
| `extract-cva.mjs` | absolute path to `components/ui/{component}.tsx` | `{ source: "runtime" \| "parsed", exportName, base, variants, defaultVariants, compoundVariants, displayName }` | `0` on success · `1` on import + parse failure (object includes `error`, `runtimeTier1`) |
| `resolve-classes.mjs` | absolute path to `tokens.css` + a whitespace-separated class string (or `-` for stdin) | `{ fills, strokes, radii, spacing, typography, effects, layout, unresolved }` | `0` always (unresolved classes are data, not errors) |

### 2.5.2 — Extractor strategy (tiered)

`extract-cva.mjs` runs a two-tier strategy automatically:

1. **Tier 1 — runtime import.** `await import(pathToFileURL(absPath))`, then scan every function-valued export for a `.variants` own property. cva@0.7+ exposes it this way. This is the preferred path because it handles TS paths, re-exports, and conditional assignments transparently.
2. **Tier 2 — source parse.** If the runtime import fails or no `.variants` property is found, the script reads the source text, locates `const X = cva(...)`, scans the two argument expressions with a balanced-bracket parser that respects strings + nested brackets, and evaluates them inside `node:vm.createContext()` with no globals. The sandbox has a 250 ms CPU timeout; it throws on any unresolved identifier reference (e.g. a helper function imported at the top of the file).

Agents should not try to force one tier over the other — the script picks automatically and emits `source: "runtime"` or `source: "parsed"` so the run report can note which tier won.

### 2.5.3 — Resolver strategy (deterministic)

`resolve-classes.mjs` is a pure function — same inputs produce the same outputs. It parses `tokens.css` once per invocation (cheap, and the skill runs it many times in a loop), builds `aliasToLeaf` by following every `var()` chain to its leaf, then dispatches each class token through a utility classifier. See §3.4 for the full Tailwind-to-Figma mapping.

The resolver **never throws** on unknown classes. Anything it cannot map lands in `unresolved[]` with a reason string, and the skill surfaces the list in the Step 8 run report. Mode A tolerates unresolved classes (they just miss a token binding and fall back to hex/px); [`06-audit-checklist.md` §14.0](./06-audit-checklist.md#140--mode-a-extraction-skip-in-mode-b) treats `unresolved.length === 0` as the audit goal but not a hard failure.

### 2.5.4 — CONFIG assembly order

For each component, Mode A builds CONFIG by merging three inputs in this exact order so fields resolve deterministically even when the extractor and `shadcn-props.json` disagree:

1. Start from the `shadcn-props.json[component]` entry (this seeds `pageName`, `componentProps`, `iconSlots`, `properties`, `usageDo`, `usageDont`, `labelKey`, `summary`, `category`, optional `composes`).
2. Overwrite `variants` with `Object.keys(cvaOutput.variants[labelKey])` and `sizes` with `Object.keys(cvaOutput.variants.size ?? {})`.
3. For each `(variantKey, sizeKey = defaultSize)` tuple, concatenate `base + variants.variant[variantKey] + variants.size[sizeKey]` (+ any compound-variant classes whose predicate matches), run the resolver, and project the resulting buckets onto `style[variantKey]`, `padH[sizeKey]`, `radius`, and `labelStyle[sizeKey]` per `SKILL.md` §4.5.d.
4. Set `defaultVariant = cvaOutput.defaultVariants[labelKey]` and `defaultSize = cvaOutput.defaultVariants.size`, and wire them into the ComponentSet default-instance step in `draw-engine.figma.js §6.6D`.
5. Stamp `CONFIG._source = 'shadcn-1:1'` and `CONFIG._extractSource = cvaOutput.source` (`"runtime"` or `"parsed"`) for the run report.

### 2.5.5 — Error recovery

| Extractor outcome | Action |
|---|---|
| exit 0, `source: "runtime"` | Proceed with `CONFIG._extractSource = "runtime"`. |
| exit 0, `source: "parsed"` | Proceed with `CONFIG._extractSource = "parsed"`. Log a note: "cva .variants not exposed; used source-text fallback" in the run report. |
| exit 1, any error | Abort Mode A **for this component only**. Log `error` verbatim in the run report. Fall back to Mode B synthetic CONFIG with `_source = 'synthetic-fallback'`. Never crash the overall run. |

For the resolver, any `unresolved[]` entries ship in the run report; the agent never re-runs the resolver with different inputs hoping to "fix" them — the fix is either (a) a missing alias in `tokens.css` (which the design-system owner addresses) or (b) a missing entry in the resolver's `LEAF_TO_FIGMA` table (which is a skill update).

---

## 3.4 — Class-to-token resolution map (Mode A)

> Authoritative: [`resolver/resolve-classes.mjs`](../resolver/resolve-classes.mjs). This section documents the resolution tables so an agent can predict a binding outcome without reading the script and reviewers can spot missing entries quickly.

### 3.4.1 — Alias chain (`tokens.css` → leaf → Figma path)

The resolver parses every `--name: value;` declaration in `tokens.css` (regardless of `:root` / `.dark` / other wrapping selectors) and builds two maps:

- `declarations[name] = rawValue` — raw right-hand-side strings.
- `aliasToLeaf[name] = leafName` — follow `var(--xxx)` chains until the right-hand side is no longer a single `var()` call (a literal color, a `calc()`, or an unknown name). Cycles are broken by a `seen` set.

The **leaf names** are the shadcn-naming-convention bottom layer (e.g. `color-primary`, `color-on-primary`, `color-background-variant`, `corner-medium`). The resolver's static `LEAF_TO_FIGMA` table reverse-maps leaves to Figma variable paths, mirroring the create-design-system semantic tables.

Examples:

| `tokens.css` alias | Leaf (from chain) | Figma path (from `LEAF_TO_FIGMA`) |
|---|---|---|
| `--primary: var(--color-primary)` | `color-primary` | `color/primary/default` |
| `--primary-foreground: var(--color-on-primary)` | `color-on-primary` | `color/primary/content` |
| `--destructive: var(--color-danger)` | `color-danger` | `color/error/default` |
| `--accent: var(--color-accent-subtle)` | `color-accent-subtle` | `color/tertiary/subtle` |
| `--muted: var(--color-background-variant)` | `color-background-variant` | `color/background/variant` |
| `--border: var(--color-border)` | `color-border` | `color/border/default` |
| `--ring: var(--color-focus-ring)` | `color-focus-ring` | `color/component/ring` |
| `--radius: var(--radius-md) → var(--corner-medium)` | `corner-medium` | `radius/md` |

If the user renames an alias or stops re-exporting `--color-*` leaves in their `tokens.css`, those rows fall through to `unresolved[]` — the resolver never guesses.

### 3.4.2 — Tailwind utility patterns (what the classifier matches)

| Pattern | Dispatch bucket | Notes |
|---|---|---|
| `bg-{alias}[/n]` | `fills[]` | `n/100` is passed as `opacity` alongside the bound variable. |
| `text-{size}` (`xs` … `9xl`) | `typography[]` with `token` | Mapped to `Label/*` / `Body/*` / `Title/*` / `Headline/*` / `Display/*` per Step 3.4.3. |
| `text-{alias}` | `fills[]` with `role: 'text'` | Falls back to an unresolved row if alias chain dies. |
| `border` (bare) | `strokes[]` | Resolves `--border` alias to `color/border/default`. |
| `border-{alias}` | `strokes[]` | Alias form. |
| `border-{n}` | `strokes[]` with `weight: n` | Numeric weight; no color binding. |
| `ring-{n}` | `effects[] { kind: focus-ring, weight }` | |
| `ring-offset-{n}` | `effects[] { kind: focus-ring-offset, offset }` | |
| `ring` / `ring-{alias}` | `effects[] { kind: focus-ring, token }` | |
| `rounded[-{side}][-{size}]` | `radii[]` | `size ∈ { '', none, sm, md, lg, xl, 2xl, 3xl, full }`; per-side optional. |
| `h-{n} / w-{n} / size-{n} / min-\|max-*-{n}` | `layout[]` | `n × 4 px`; the skill matches against Layout space tokens at CONFIG-assembly time. |
| `p/m/gap[-axis]-{n}` | `spacing[]` with `tokenHint` | Hint uses the foundations defaults (4→xs, 8→sm, 12→md, 16→lg, 24→xl, 32→2xl, 48→3xl, 64→4xl). |
| `font-{weight}` | `typography[]` with `fontWeight` | `thin`…`black`. |
| `opacity-{n}` | `effects[] { kind: opacity, value }` | `value = n/100`. |
| `shadow[-{size}]` | `effects[] { kind: drop-shadow }` | Drop-shadow preset bucketed by size. |
| `inline-flex / items-* / overflow-* / …` | `layout[] { prop: passthrough }` | Recorded for audit; applied at node-creation time by the draw engine. |

### 3.4.3 — Typography scale mapping

The resolver maps Tailwind `text-*` size tokens directly onto Typography slots published by `/create-design-system`:

| Tailwind | Typography slot |
|---|---|
| `text-xs` | `Label/SM/default` |
| `text-sm` | `Label/MD/default` |
| `text-base` | `Body/MD/default` |
| `text-lg` | `Body/LG/default` |
| `text-xl` | `Title/SM/default` |
| `text-2xl` | `Title/MD/default` |
| `text-3xl` | `Title/LG/default` |
| `text-4xl` | `Headline/SM/default` |
| `text-5xl` | `Headline/MD/default` |
| `text-6xl` | `Headline/LG/default` |
| `text-7xl` | `Display/SM/default` |
| `text-8xl` | `Display/MD/default` |
| `text-9xl` | `Display/LG/default` |

If a published text style with that exact name is not present in the file, the draw engine falls back to raw `fontSize` inferred from the Tailwind step (`xs: 12`, `sm: 14`, `base: 16`, `lg: 18`, …) so the matrix still renders.

### 3.4.4 — State prefixes

The classifier strips Tailwind state prefixes before matching the utility head. The first non-responsive, non-`dark` prefix becomes the `state` field on every emitted bucket entry:

- `hover`, `focus`, `focus-visible`, `focus-within`, `active`, `disabled`, `aria-disabled`, `aria-selected`, `aria-expanded`
- `data-[state=open|closed|checked|unchecked|active|on|off]`, `data-[disabled]`
- `group-hover`, `peer-disabled`, `peer-focus`, `peer-checked`, `placeholder`, `first`, `last`

Responsive prefixes (`sm`, `md`, `lg`, `xl`, `2xl`) are captured separately under `responsive` and dropped when projecting onto CONFIG (Figma components don't model viewport axes). `dark:` is recorded as a flag; the Theme collection already inherits light/dark via Figma variable modes, so `dark:` variants project onto the same token as their base-state pair.

---

## Code Connect integration

Once `/create-component` has drawn a component, the `/code-connect` skill maps each published `ComponentSet` to its `.figma.tsx` source file. The outputs of this pipeline (specifically `CONFIG.variants` / `CONFIG.sizes` / `CONFIG.componentProps` / `composes[]`) are the knobs Code Connect reads when resolving a template. Keep these contracts stable:

- `variant` and `size` Figma properties on the `ComponentSet` must match the cva axis names used by Code Connect's `figma.properties.enum('variant', { ... })` calls.
- Element component properties (`Label`, `Leading icon`, `Trailing icon`) map to `figma.properties.string('Label')` / `figma.properties.boolean('Leading icon')` in `.figma.tsx` templates.
- Composite components (`composes.length > 0`) use `figma.children('<slot>')` lookups keyed on the `slot/{name}` frames created by `buildComposedVariant`; renaming a slot breaks the Code Connect mapping until the `.figma.tsx` template is updated in lockstep.

The `/sync-design-system` Axis C reconciles Figma `ComponentSet` signatures against `.figma.tsx` templates and flags drift — see that skill's §3C.
