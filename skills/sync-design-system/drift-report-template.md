<!--
  Template used by /sync-design-system Step 8.F (Axis B — Figma wins → PR).
  Renderer substitutes {{TOKENS}} with real values and emits one file under
  `.changeset/design-drift-{timestamp}.md` (or `docs/design-drift/` fallback).

  The PR body points readers to this file. Each drifted component becomes one
  level-2 section. In-sync components are omitted.

  DO NOT hand-edit generated reports. Re-run /sync-design-system to regenerate.
-->

# Design drift — {{YYYY-MM-DD HH:mm}}

**Figma is source of truth for components this run.** This report lists every drift the reconciler surfaced so the codebase can be updated manually.

## Summary

| Axis B bucket | Count |
|---|---:|
| variant-axis mismatch | {{N_VARIANT_AXIS}} |
| default mismatch | {{N_DEFAULT}} |
| prop mismatch | {{N_PROP}} |
| token-binding drift | {{N_BINDING}} |
| code-only (no Figma component) | {{N_CODE_ONLY}} |
| figma-only (no source file) | {{N_FIGMA_ONLY}} |
| Unresolvable (skipped in diff) | {{N_UNRESOLVABLE}} |

Stable-key scheme: `B.{component}.{bucket}.{id}`.

## Recommended actions

- **`code-only` components** — Figma has no matching ComponentSet. Run `/create-component <name>` to draw them on the canvas.
- **`figma-only` components** — source file is missing. Scaffold `components/ui/<name>.tsx` using shadcn conventions, then run `/code-connect` to wire the mapping.
- **`variant-axis` / `default` / `prop` drift** — edit the cva config and element props in the component source to match the Figma side.
- **`token-binding` drift** — update the Tailwind classes in cva's `base` / `variants` so `resolve-classes.mjs` resolves to the Figma-side variable paths listed below.
- **`unresolvable` components** — these are not cva-based (custom composition, Radix-only, etc.). No action required from this report; they are flagged so you know they were skipped.

---

<!-- Per-component sections below. Repeat once per drifted component. -->

## `{{component-name}}`

- **Source file:** `{{relative/path/to/components/ui/component.tsx}}`
- **Figma ComponentSet:** `{{ComponentSetName}}` (id `{{componentSetId}}`)
- **Pairing method:** {{"Code Connect mapping (authoritative)" | "name match (heuristic)"}}
- **Buckets drifted:** `{{comma-separated bucket names}}`

### Variant axes

| Axis | Code (cva) | Figma | Stable key |
|---|---|---|---|
| `{{axisName}}` | `{{code-values-list}}` | `{{figma-values-list}}` | `B.{{component}}.variant-axis.{{axisName}}` |

> Notes about any renames, removals, or additions.

### Default variant

| Axis | Code `defaultVariants` | Figma `defaultVariant` | Stable key |
|---|---|---|---|
| `{{axisName}}` | `{{code-default}}` | `{{figma-default}}` | `B.{{component}}.default.{{axisName}}` |

### Props

| Prop | Kind | Code side | Figma side | Stable key |
|---|---|---|---|---|
| `{{Label}}` | TEXT | `{{code}}` | `{{figma}}` | `B.{{component}}.prop.Label` |
| `{{Leading icon}}` | BOOLEAN | `{{code}}` | `{{figma}}` | `B.{{component}}.prop.Leading icon` |
| `{{asChild}}` | BOOLEAN (code-only) | `{{code}}` | — | `B.{{component}}.prop.asChild` |

> "code-only" props are valid — not every code prop must appear in Figma (e.g. `asChild`, `className`, `type`). This table lists them for completeness.

### Token bindings

Source of truth for token resolution: the cva class strings from `{{source-file}}` run through `skills/create-component/resolver/resolve-classes.mjs` against the current `tokens.css`.

| Element path | State | Code class | Code → token | Figma binding | Stable key |
|---|---|---|---|---|---|
| `bg` | `base` | `bg-primary` | `color/primary/default` | `color/primary/subtle` | `B.{{component}}.binding.bg.base` |
| `bg` | `hover` | `hover:bg-primary/90` | `color/primary/default` (opacity 90) | `color/primary/hover` | `B.{{component}}.binding.bg.hover` |
| `text` | `base` | `text-primary-foreground` | `color/primary/content` | `color/primary/content` ✓ | _in sync_ |
| `radius` | `base` | `rounded-md` | `radius/md` | `radius/lg` | `B.{{component}}.binding.radius.base` |

Unresolved classes (resolver could not map to a Figma path — add a note in `resolve-classes.mjs`'s LEAF_TO_FIGMA if these should be recognized):

```
{{unresolved-class-list-or-"none"}}
```

### Raw diff payload (for machine consumption)

```json
{
  "component": "{{component}}",
  "componentSetId": "{{componentSetId}}",
  "sourcePath": "{{source-path}}",
  "buckets": {
    "variant-axis": [ { "axis": "variant", "code": [...], "figma": [...] } ],
    "default":      [ { "axis": "variant", "code": "default", "figma": "primary" } ],
    "prop":         [ { "name": "Leading icon", "code": true, "figma": false } ],
    "binding":      [ { "element": "bg", "state": "base", "code": "color/primary/default", "figma": "color/primary/subtle" } ],
    "code-only":    false,
    "figma-only":   false
  }
}
```

---

<!-- End per-component section. Next component repeats. -->

## Notes for reviewers

- This report is **advisory**. The reconciler did not modify `components/ui/*.tsx` — that's a human decision.
- If Figma's direction is wrong (e.g. someone edited the ComponentSet in Figma by mistake), close this PR and re-run `/sync-design-system` choosing **C** (code wins) for Axis B instead.
- Unresolved token-binding rows usually mean the resolver's `LEAF_TO_FIGMA` map at `skills/create-component/resolver/resolve-classes.mjs` is missing an alias. Add the mapping and re-run.
- PR body is generated; do not merge without a human reviewer going through each component section.
