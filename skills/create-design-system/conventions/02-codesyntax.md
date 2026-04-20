# 2. `codeSyntax` is explicit and MANDATORY on every variable

Figma API fact: `codeSyntax` is **not** applied via raw variable creation in the Plugin API for this workflow. After variables exist, set `codeSyntax` with a compact **REST `PUT`** whose body is **only** `variables` entries (`action: "UPDATE"` + `codeSyntax`) — see [`../phases/04-step11-push.md`](../phases/04-step11-push.md).

Every variable carries three strings: **WEB**, **ANDROID**, **iOS**.

## WEB — Tailwind-friendly CSS custom property

```
var(--color-background-container-high)
var(--headline-lg-font-size)
var(--space-md)
```

Single `--color-*` namespace so values drop straight into [Tailwind v4 `@theme`](https://tailwindcss.com/docs/theme).

## ANDROID — kebab-case M3 role

```
surface-container-high
on-primary
headline-lg-font-size
space-md
```

Same semantic roles as [Jetpack Compose `ColorScheme`](https://developer.android.com/jetpack/compose/designsystems/material3), but **kebab-case**, never Compose API camelCase (`surfaceContainerHigh` is wrong).

## iOS — fully dot-separated lowercase path (NEVER camelCase)

The rule: **every word is its own segment separated by a period.** Split on both `/` and kebab `-`; lowercase every tail segment; keep only the top-level domain capitalized.

```
.Background.container.high
.Status.on.error.fixed.muted
.Typography.headline.lg.font.size
.Corner.extra.small
.Font.weight.medium
```

**Wrong:** `.Background.containerHigh` · `.Status.onErrorFixedMuted` · `.Typography.headline.lg.fontSize` · `.Corner.extraSmall` · `.FontWeight.medium`

If you find yourself typing a camelCase segment in an iOS codeSyntax string, stop and flatten it.

## Theme codeSyntax is set from a **table**, not derived from the path

The Figma path (`color/background/content-muted`) is a **designer label**. The three `codeSyntax` values are **independent**:

| Figma path                      | WEB                            | ANDROID              | iOS                      |
| ------------------------------- | ------------------------------ | -------------------- | ------------------------ |
| `color/background/content-muted` | `var(--color-content-muted)`  | `on-surface-variant` | `.Foreground.secondary`  |
| `color/primary/subtle`          | `var(--color-primary-subtle)`  | `primary-container`  | `.Primary.subtle`        |
| `color/error/default`           | `var(--color-danger)`          | `error`              | `.Status.error`          |

Always read Theme codeSyntax from **Step 6** in [`../phases/02-steps5-9.md`](../phases/02-steps5-9.md), with the supplement [`../phases/02b-theme-codesyntax.md`](../phases/02b-theme-codesyntax.md). Never transform the path.
