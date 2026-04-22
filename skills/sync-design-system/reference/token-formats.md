# Sync — Supported token file formats (Axis A read / Step 11.5b)

> **Linked from:** [`../phases/02-read-axes.md`](../phases/02-read-axes.md), [`../phases/figma-only-path.md`](../phases/figma-only-path.md).

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
