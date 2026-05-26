# Theme `codeSyntax` — derivation rules (Step 6 supplement)

Use this file alongside **Step 6** in the main skill. The **authoritative triple** for each Theme variable remains the row cells in Step 6 (`WEB` / `ANDROID` / `iOS` columns). This document explains **why** those strings look that way and lists **exceptions** where a naive path→string transform would be wrong.

## ANDROID (Material 3 `ColorScheme` roles)

- **Cannot** be inferred from the Figma path alone — the kebab string is the Compose `ColorScheme` role (hyphenated), not a 1:1 copy of slash segments.
- **Source of truth:** the **ANDROID** column in Step 6’s tables (`background/`, `border/`, brand rows, `error/`, `component/`).
- When implementing codegen, treat the Step 6 ANDROID cell as a lookup value, not a derivation.

## WEB (CSS custom properties)

- **Default pattern:** designer-oriented `--color-*` names aligned to Tailwind v4 `@theme` (see Step 6 prose). Many rows use `var(--color-…)` where the token name reflects **role** (e.g. `var(--color-background)`, `var(--color-danger)`), not a mechanical kebab of the full Figma path.
- **Exceptions (non-exhaustive — always verify Step 6):**
  - `color/error/*` → `var(--color-danger…)` family (not `var(--color-error…)`).
  - `color/tertiary/*` → often `var(--color-accent…)` per Step 6.
  - Component extension rows → `var(--color-field)`, `var(--color-focus-ring)`, `var(--color-sidebar…)` as tabulated.

## iOS (semantic dot paths)

- **Never** copy the ANDROID string into iOS.
- **Domains** group related roles: `.Background.*`, `.Foreground.*`, `.Primary.*`, `.Border.*`, `.Status.*`, `.Component.*`, etc., per Step 6.
- **Exceptions** exist where Figma grouping (`color/background/content`) maps to `.Foreground.primary` — follow the **iOS** column exactly.

## State group (`color/state/*`)

State layer tokens are `rawLiterals` (RGBA with alpha) — they cannot alias a Primitive because opacity cannot ride on a variable alias.

The M3-strict model: the state layer always carries the **foreground (on-color) of the container it sits on**. Two overlay families cover every component variant:

- **`color/state/on-{role}/{state}`** — filled variants. RGB = `color/{role}/content` (Light and Dark identical, both alias `color/{role}/50`). Roles: `on-primary`, `on-secondary`, `on-tertiary`, `on-error`.
- **`color/state/on-surface/{state}`** — outline / ghost / transparent variants. RGB = `color/background/content` (Light = `color/neutral/900`, Dark = `color/neutral/50`; RGB differs between modes).

Per-state alpha: `hover` 0.08, `pressed` 0.12, `focus` 0.12.

- **WEB:** `var(--color-state-on-{role-kebab}-{state})` — e.g. `var(--color-state-on-primary-pressed)`, `var(--color-state-on-surface-hover)`
- **ANDROID:**
  - `hover` / `focus` → `state-layer-on-{role-kebab}` (e.g. `state-layer-on-primary`, `state-layer-on-surface`)
  - `pressed` → `ripple-on-{role-kebab}` (e.g. `ripple-on-primary`, `ripple-on-surface`)
- **iOS:** `.State.on{Role}.{state}` — e.g. `.State.onPrimary.pressed`, `.State.onSurface.focus`

`{role-kebab}` is `primary`, `secondary`, `tertiary`, `error`, `surface`. iOS `{Role}` uses PascalCase (`Primary`, `Secondary`, `Tertiary`, `Error`, `Surface`).

Total: 15 state-layer variables (4 on-roles × 3 states + on-surface × 3 states).

The legacy `color/state/{role}/{state}` family (role color × alpha) is **removed** — see `theme-aliases.json` history. Outline/ghost variants no longer get a brand-tinted hover; they get a neutral on-surface tint per M3 spec.

## Verification

- After push, Step 12 spot-checks (`color/background/default`, `color/error/default`, …) must match Step 6 **and** this file’s exception rules.
