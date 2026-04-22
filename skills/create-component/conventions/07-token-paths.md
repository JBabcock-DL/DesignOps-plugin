# create-component / conventions / 07-token-paths.md

> **Audience:** AI agents (Claude, Sonnet, etc.) running `/create-component` and authoring / reviewing `CONFIG.style`, `CONFIG.padH`, `CONFIG.radius`, and any other `*Var` / token-path field.
>
> **Authoritative source:** this file. When `01-config-schema.md` or any `shadcn-props/*.json` example disagrees, this file wins. Cross-file wins are resolved by `SKILL.md §4.7` (pre-flight token verification) — that step gates every draw on the live file's actual variable paths.

## 7.1 — The one rule

**A token path is the `name` of a Figma variable as returned by `figma.variables.getLocalVariables()` in the active file.** Nothing else is a token path.

All of the following are **not** token paths and must not be used as one:

- CSS custom-property names (`--color-primary`, `--radius-md`). Those are the WEB `codeSyntax` of a Figma variable, not the variable's name.
- Tailwind class names (`bg-primary`, `p-4`, `rounded-md`). Those are CSS utilities that *chain through* CSS custom properties and eventually map to Figma variables, but the chain is not reversible without `resolver/resolve-classes.mjs`.
- Guesses, inferences from prior drafts, or paths scraped from past agent transcripts. See §7.6.
- Paths from an older version of `/create-design-system` or a different project's Figma file. Each file's variable set is that file's ground truth.

## 7.2 — Where the canonical paths come from

The `/create-design-system` skill writes five Figma variable collections — **Primitives**, **Theme**, **Typography**, **Layout**, **Effects**. The paths this skill binds to live in three of them:

| Collection | Used for | Path shape | Examples |
|---|---|---|---|
| **Theme** | `CONFIG.style[*].fill`, `labelVar`, `strokeVar` (every color binding) | `color/<role>/<tier>` (two hops, always) | `color/primary/default`, `color/primary/content`, `color/primary/subtle`, `color/background/default`, `color/background/content`, `color/danger/default`, `color/danger/content`, `color/border/default`, `color/field/default` |
| **Layout** | `CONFIG.padH`, `CONFIG.radius`, any spacing / radius binding | `space/<t-shirt>`, `radius/<t-shirt>` (two hops) | `space/xs`, `space/sm`, `space/md`, `space/lg`, `radius/sm`, `radius/md`, `radius/lg` |
| **Typography** | `CONFIG.labelStyle` (indirectly via published text styles + `*/font-family` STRING) | `<Scale>/<Size>/font-family` | `Label/LG/font-family`, `Body/MD/font-family`, `Display/LG/font-family` |

Keep these shapes memorized. If a proposed CONFIG path doesn't match one of these shapes, it is almost certainly wrong.

### 7.2.1 — The `color/*/default` vs `--color-*` gotcha (most common spiral)

The WEB `codeSyntax` of `color/primary/default` is `var(--color-primary)`. The CSS alias is one hop shorter than the Figma path. If you open `tokens.css` and find

```css
--color-primary: var(--color-primary-500);
```

the Figma variable backing that CSS is **`color/primary/default`** — not `color/primary` and not `color-primary`. The same asymmetry applies to every Theme alias:

| `tokens.css` (CSS hop) | Figma path |
|---|---|
| `--color-primary` | `color/primary/default` |
| `--color-on-primary` | `color/primary/content` |
| `--color-primary-subtle` | `color/primary/subtle` |
| `--color-on-primary-subtle` | `color/primary/on-subtle` |
| `--color-background` | `color/background/default` |
| `--color-on-background` | `color/background/content` |
| `--color-border` | `color/border/default` |
| `--color-danger` | `color/danger/default` |
| `--color-field` | `color/field/default` |

Mirror rule: every Theme variable has a `default` tier; reading `tokens.css` at face value omits that tier. **Always append `/default`** to a role when the CSS alias doesn't include the tier. The canonical mapping is in [`skills/create-design-system/data/theme-aliases.json`](../../create-design-system/data/theme-aliases.json) — that file is the source `/create-design-system` consumes, so it is also the source of truth for what Figma paths exist.

## 7.3 — How to discover paths at agent runtime (pre-flight)

**Before** assembling the `use_figma` payload for a component draw, the agent MUST enumerate what paths actually exist in the active file. Two options, pick whichever is available:

1. **`get_variable_defs`** (MCP tool) — pass the active file key and any `nodeId` in that file (the doc frame of a previously-drawn component is ideal; otherwise `0:0`). The response is a `{ 'color/primary/default': '#...', ... }` map of paths the target node references. For full file enumeration, pass the root frame of the page `/create-design-system` built (typically named `Theme` or `Tokens`).
2. **`use_figma` one-liner** — run a 5-line script that calls `figma.variables.getLocalVariables()` and returns `.map(v => ({ collection, name }))`. This is the only strategy that guarantees a full enumeration regardless of which node you picked. Use when `get_variable_defs` returns an incomplete set.

Cache the result as `AVAILABLE_TOKEN_PATHS: Set<string>` for the duration of the run. Validate every `CONFIG.style[*].fill`, `labelVar`, `strokeVar`, every `padH` value, `CONFIG.radius`, and every `surface.*Var` / `field.*Var` / `control.indicatorVar` against the set before the `use_figma` draw. Any miss: stop and ask the user — do not let the draw engine silently fall back to hex.

SKILL.md Step 4.7 bundles this into a single required gate.

## 7.4 — The draw-engine tells you when you're wrong

Even after Step 4.7, a typo can slip through. The draw engine (`templates/draw-engine.figma.js §2.5`) intercepts every `bindColor` / `bindNum` call and collects unresolved paths. The `use_figma` return payload surfaces them as:

```jsonc
{
  "unresolvedTokenPaths": {
    "total": 6,
    "uniquePaths": 2,
    "collectionsPresent": { "Theme": true, "Layout": true, "Typography": true },
    "topMisses": [
      { "kind": "color", "path": "color/primary", "count": 4, "fallbackSample": "#1a1a1a", "firstNodeName": "surface/primary" },
      { "kind": "num:paddingLeft", "path": "space/medium", "count": 2, "fallbackSample": 16, "firstNodeName": "chip" }
    ],
    "samples": [ /* up to 20 raw miss records */ ]
  }
}
```

**Post-draw assertion.** Agents MUST treat `unresolvedTokenPaths.total > 0` as a hard failure of the draw, same severity as `propErrorsCount > 0` — redraw with the fixes before claiming the component "drawn." The only acceptable non-zero case is when the designer explicitly authored a `tokens.css`-less run (`TOKEN_CSS_PATH === null`), in which case the absence of Theme/Layout collections is expected and `collectionsPresent` flags surface it. [`EXECUTOR.md` §0.2](./EXECUTOR.md) and [`SKILL.md` §9](./SKILL.md) both include this assertion.

## 7.5 — Tooling: local validator

A standalone validator ships at [`scripts/validate-tokens.mjs`](../../../scripts/validate-tokens.mjs). It takes a CONFIG (or a bundle of CONFIGs) and a variable-defs JSON (the literal output of `get_variable_defs` or a paste of `figma.variables.getLocalVariables().map(v => ({name}))`) and prints every unresolved path before you open `use_figma`. Usage:

```bash
node scripts/validate-tokens.mjs <config.json> <variable-defs.json>
# non-zero exit code on unresolved paths
```

Run it on a staged CONFIG before drawing. Exit code ≠ 0 means the draw will fall back to hex — fix CONFIG first.

## 7.6 — Banned strategies

> **Not allowed as a source of truth for token paths:**
>
> - Inferring paths from past `use_figma` code found in conversation history, transcripts, or cached agent logs. Paths may have changed between drafts, drifted between projects, or been wrong to begin with.
> - Copying paths from a different Figma file (e.g. a reference project's Button CONFIG) without re-enumerating via `get_variable_defs` in the active file.
> - Using Tailwind class names (`bg-primary`) or CSS var names (`--color-primary`) directly as Figma paths — see §7.1.
> - Falling back to hex to "unblock" the draw when a Theme path doesn't resolve. The hex draw renders, but the component ships without variable bindings and silently diverges from the design system on the first theme switch. If a path is missing, surface it to the designer in Step 8 Notes and fix the design system before drawing.

If any of these feel tempting, stop. Run the §7.3 pre-flight and the §7.5 validator — the correct path will be obvious once you see the live file's actual variable set.
