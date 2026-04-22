# Sync — Step 1 (preflight: detect enabled axes)

> **When to read:** After **Step 0** in [`../SKILL.md`](../SKILL.md) when `plan.scope` is **`full`** or **`code-to-figma`**.
>
> **If `plan.scope === 'figma-only`:** Do **not** read this file. Use [`figma-only-path.md`](./figma-only-path.md) instead.
>
> **Next:** [`02-read-axes.md`](./02-read-axes.md) (Step 2).

---

## Step 1 — Preflight: detect enabled axes

Probe the file system silently — no blocking prompts, no warnings unless partial state is found.

| Axis | Enable condition |
|---|---|
| **A — Variables** | `plugin/.claude/settings.local.json:token_schema_path` resolves to an existing file, **or** a canonical tokens file exists (`src/styles/tokens.css`, `tokens.json`, `tailwind.config.{js,ts}`) |
| **B — Components** | `components.json` at repo root **and** ≥ 1 `.tsx` under the `aliases.ui` path from `components.json` |
| **C — Code Connect mappings** | Axis B is enabled **and** ≥ 1 `**/*.figma.tsx` file exists anywhere in the repo |

**Clip by `plan.scope`.** After the raw detect:

- `plan.scope === 'figma-only'` → **do not use this file** — you should be on [`figma-only-path.md`](./figma-only-path.md).
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

**Next:** [`02-read-axes.md`](./02-read-axes.md) (Step 2).
