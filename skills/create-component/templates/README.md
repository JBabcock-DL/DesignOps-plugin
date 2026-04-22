# create-component / templates / README.md

Runtime JavaScript templates inlined into the `use_figma` call by `/create-component`. Agents `Read` and concatenate these files verbatim — **no editing in the `code` string**.

See [`../SKILL.md`](../SKILL.md) for the canonical **Script-assembly order** table; the summary below is a quick reference only.

## Payload shape (three ordered pieces)

Every `use_figma` payload is concatenated in this order. Skipping any step throws a clear `ReferenceError` at the engine bundle's preamble-presence gate (§0a).

| # | Source | Size | What it contributes |
|---|---|---|---|
| 1 | **§0 CONFIG** (authored inline per component from SKILL.md §0) | 1–4 KB | `CONFIG` object — the only per-component edit surface |
| 2 | **[`preamble.figma.js`](./preamble.figma.js)** (read and inlined verbatim) | ~2 KB | `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS`, `usesComposes`, `logFileKeyMismatch()`, `_fileKeyObserved`, `_fileKeyMismatch` + the soft file-key mismatch warning side-effect |
| 3 | **one per-archetype engine bundle** (picked by `CONFIG.layout`, table below) | ~26–33 KB | scaffold, token binders, archetype builder, §6 doc pipeline, §6.9a return payload |

## Which file does the agent inline for step 3?

One of the eight **per-archetype bundles**, picked by `CONFIG.layout`:

| `CONFIG.layout` | Inline this file | Size | Covers components |
|---|---|---|---|
| `chip` | `create-component-engine-chip.min.figma.js` | ~26 KB | Button, Badge, Toggle, Kbd, Label, Pagination, … |
| `surface-stack` | `create-component-engine-surface-stack.min.figma.js` | ~32 KB | Card, Alert, Dialog, Sheet, Popover, Tooltip, … |
| `field` | `create-component-engine-field.min.figma.js` | ~32 KB | Input, Textarea, Select, Combobox, Form, … |
| `row-item` | `create-component-engine-row-item.min.figma.js` | ~31 KB | MenuItem, Breadcrumb, Dropdown, Menubar, … |
| `tiny` | `create-component-engine-tiny.min.figma.js` | ~32 KB | Separator, Skeleton, Progress, Avatar, Slider, … |
| `control` | `create-component-engine-control.min.figma.js` | ~31 KB | Checkbox, Radio, Switch |
| `container` | `create-component-engine-container.min.figma.js` | ~32 KB | Accordion, Tabs, Collapsible, Resizable, … |
| `__composes__` (filename: `composed`) | `create-component-engine-composed.min.figma.js` | ~31 KB | Any component with `CONFIG.composes[]` that instantiates other registered ComponentSets |

Every per-archetype bundle leaves **17–23 KB of headroom** under `use_figma.code`'s 50 000-char ceiling for steps 1 + 2 (§0 CONFIG + `preamble.figma.js`).

### Debug-only siblings (never inline at runtime)

| File | Purpose |
|---|---|
| `create-component-engine.min.figma.js` | Full 7-archetype bundle (~50 KB). Sits right at the `use_figma.code` hard limit — no room for CONFIG. Useful for eyeballing "what would the full engine look like" while debugging. |
| `draw-engine.min.figma.js` | Standalone minified draw-engine, no archetype builders. Identifier names preserved (not mangled) for readability. |
| `archetype-builders.min.figma.js` | Standalone minified archetype-builders, no draw-engine. Identifier names preserved. |

## How the per-archetype bundles are assembled

The build script (`scripts/build-min-templates.mjs`) does the following for every bundle:

1. **Split `draw-engine.figma.js`** on the two banner lines:
   ```
   // ↓↓↓  INLINE archetype-builders.figma.js HERE  ↓↓↓
   // ↑↑↑  END archetype-builders.figma.js insertion point  ↑↑↑
   ```
   The prose between those lines is discarded. Result: `drawTop` (§§0–5.7) + `drawBottom` (§§6.0–6.9a).
2. **Parse `archetype-builders.figma.js`** into `sharedHelpers` (everything before the first `function build…Variant`) and each `function build…Variant` block.
3. **Concatenate** for the target archetype:
   - `chip` → `drawTop + drawBottom` (no archetype-builders needed; chip uses `buildVariant` in draw-engine §5.7).
   - any other archetype → `drawTop + sharedHelpers + builders[name] + drawBottom` where `name` is the one builder for the layout.
4. **Minify as a single compilation unit** with esbuild: whitespace + syntax + identifiers all minified. Identifier names are renamed consistently across the three source fragments (they live in the same compilation unit), so the runtime `typeof build<Archetype>Variant === 'function'` assertion at the bottom still passes — the name gets mangled to the same short token on both sides.
5. **Enforce a budget** — the build refuses to write any per-archetype bundle larger than `HARD_LIMIT - CONFIG_HEADROOM` (40 000 bytes, i.e. 50 000 minus 10 000 reserved for CONFIG). A growth regression surfaces at build time, not at the agent's run time.

### Why identifier mangling is safe here

- **Boundary identifiers** declared by step 1 (§0 CONFIG) and step 2 ([`preamble.figma.js`](./preamble.figma.js)) — `CONFIG`, `ACTIVE_FILE_KEY`, `REGISTRY_COMPONENTS`, `usesComposes`, `logFileKeyMismatch`, `_fileKeyObserved`, `_fileKeyMismatch` — appear in the templates as *references only*. esbuild treats undeclared references as free variables and leaves their names untouched. The mangled bundle still reads `CONFIG.variants`, `REGISTRY_COMPONENTS[spec.component]`, etc.
- **Cross-fragment identifiers** (e.g. `bindColor`, `labelFont`, `makeFrame`, each builder) are declared somewhere in the concatenated source and referenced elsewhere in the same source. esbuild renames declaration + all references together, keeping the lookup chain intact.
- **No dynamic name lookups** — templates never do `globalThis['buildSurfaceStackVariant']()` or similar, so there's no hidden string-indexed access that mangling could break (verified at build time via grep).

### Regenerating `.min` files

```bash
npm run build:min           # regenerate all 11 outputs (8 per-archetype + 1 full + 2 standalones)
npm run build:min:check     # exit non-zero if any output is stale
```

`scripts/verify-cache.sh` fails if any `*.figma.js` source is newer than any of its generated outputs. A commit that edits a source template without running `npm run build:min` will fail the cache verification step.

## Function contracts the templates rely on

Each template declares functions at the top level, which hoists them into the plugin sandbox. The runtime `typeof` assertion at the bottom of every bundle checks that the archetype-specific builder is present (its name gets mangled, but so does the `typeof` check — mangling is consistent within a compilation unit).

### Scaffold + doc helpers (from `draw-engine.figma.js`)

`makeFrame` · `makeText` · `buildVariant` · `buildPropertiesTable` · `buildComponentSetSection` · `buildMatrix` · `buildUsageNotes`

### Archetype builders (from `archetype-builders.figma.js`)

`buildSurfaceStackVariant` · `buildFieldVariant` · `buildRowItemVariant` · `buildTinyVariant` · `buildControlVariant` · `buildContainerVariant` · `buildComposedVariant`

### Shared helpers (from `archetype-builders.figma.js`)

`makeDashedSlot` · `makeSampleText` · `makeIconSlotShared` · `wireIconSwapProp` · `bindColor` · `bindNum` · `labelFont`

Each per-archetype bundle ships **one** archetype builder + all shared helpers + every scaffold/doc helper. The other six archetype builders are absent from that bundle — but the runtime `typeof` check only fires for the one builder the current layout needs, so the absences are invisible at run time.

## Editing these templates

1. Edit in the workspace (`c:/Users/jbabc/Documents/GitHub/DesignOps-plugin/skills/create-component/templates/...`).
2. Keep the top-of-file section banners (`// §0`, `// §6.2a`, etc.) intact — the `typeof` assertions and the Script-assembly order block in `SKILL.md` both reference those section IDs by name. **Do not remove the two banner lines** (`↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` / `↑↑↑ END archetype-builders.figma.js insertion point ↑↑↑`) — the build script uses them to split draw-engine when assembling bundles; removing them causes `npm run build:min` to throw before writing anything.
3. Every top-level `function build<Name>Variant(` in `archetype-builders.figma.js` must start at column 0. The bundle parser splits on `\nfunction <Name>(` — nested functions are fine (they're indented), but a top-level builder whose `function` keyword isn't at column 0 will not be extracted and the build will throw for the missing builder name.
4. Run `npm run build:min` to regenerate all eleven minified artifacts. If your edit also touches `shadcn-props.json` / `shadcn-props/*.json`, also run `node scripts/build-create-component-docs.mjs` so `SKILL.md`'s generated blocks stay in sync.
5. Run `bash scripts/sync-cache.sh` to propagate into the `.claude` marketplace cache, then `bash scripts/verify-cache.sh` to confirm zero drift.
6. Smoke-test by running `/create-component` against a live Figma file and verifying the `§6.9a` self-check assertions pass on the return payload.

Do **not** `Read` a template into chat context unless you need to debug — the whole point of these files is to be inlined by agents at run time, not read by humans.
