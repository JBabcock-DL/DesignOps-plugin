# create-component / templates / README.md

Runtime JavaScript templates inlined into the `use_figma` call by `/create-component`. Agents `Read` and concatenate these files verbatim — **no editing in the `code` string**.

See [`../SKILL.md`](../SKILL.md) for the canonical **Script-assembly order** block; the table below is a quick reference only. **Prefer the `*.min.figma.js` sibling** for every `use_figma` inline — it is the canonical runtime artifact and is ~40–60% smaller. `Read` the non-min source file only for debugging or when editing.

| Template (inline this) | Source (edit this) | Savings | Insertion point | Required when |
|---|---|---|---|---|
| [`draw-engine.min.figma.js`](./draw-engine.min.figma.js) | [`draw-engine.figma.js`](./draw-engine.figma.js) | -58% (77 KB → 32 KB) | after the §0 CONFIG block | always |
| [`archetype-builders.min.figma.js`](./archetype-builders.min.figma.js) | [`archetype-builders.figma.js`](./archetype-builders.figma.js) | -42% (53 KB → 30 KB) | at the `↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` marker inside `draw-engine` (between §5.7 and §6.0) | `CONFIG.layout !== 'chip'` |
| [`migrate-composed-variants.figma.js`](./migrate-composed-variants.figma.js) | (small — no min variant) | n/a | replaces the draw engine entirely (legacy flat composites → instance stacks) | only when invoked via `--migrate-to-instances` per [`plans/create-component_atomic-composition.plan.md`](../../../plans/create-component_atomic-composition.plan.md) §7 |

### Regenerating `.min` files

```bash
npm run build:min           # writes both .min siblings
npm run build:min:check     # non-zero exit if any source is newer than its .min
```

`scripts/verify-cache.sh` fails if any `*.figma.js` is newer than its `*.min.figma.js` sibling — so a commit that edits a source template without regenerating the min file will fail the cache verification step.

The minifier (`scripts/build-min-templates.mjs`) uses esbuild in whitespace-and-syntax mode only (**identifier renaming is disabled**) so every function name the runtime `typeof` asserts at `draw-engine.figma.js §6.2a` / `§6.9a` reference survives intact. Source files are wrapped in an `(async()=>{ … })()` before minification (so esbuild can parse the top-level `await` + `return` the plugin sandbox expects) then unwrapped on the way out — the emitted `.min` is a bare script body, byte-equivalent to the source for agent-inlining purposes.

## Function contracts the templates rely on

Each template exports functions into the plugin sandbox by declaring them at the top level. The runtime `typeof` assertions at `draw-engine.figma.js §6.2a` and §6.9a check that these names survived whatever concatenation path the agent used; if a `throw new Error('[draw-engine §6.2a] builder "X" not found — ...')` fires, the script-assembly order was wrong.

### Scaffold + doc helpers (from `draw-engine.figma.js`)

`makeFrame` · `makeText` · `buildVariant` · `buildPropertiesTable` · `buildComponentSetSection` · `buildMatrix` · `buildUsageNotes`

### Archetype builders (from `archetype-builders.figma.js`)

`buildSurfaceStackVariant` · `buildFieldVariant` · `buildRowItemVariant` · `buildTinyVariant` · `buildControlVariant` · `buildContainerVariant` · `buildComposedVariant`

### Shared helpers (from `archetype-builders.figma.js`)

`makeDashedSlot` · `makeSampleText` · `makeIconSlotShared` · `wireIconSwapProp` · `bindColor` · `bindNum` · `labelFont`

## Editing these templates

1. Edit in the workspace (`c:/Users/jbabc/Documents/GitHub/DesignOps-plugin/skills/create-component/templates/...`).
2. Keep the top-of-file section banners (`// §0`, `// §6.2a`, etc.) intact — the `typeof` assertions and the Script-assembly order block in `SKILL.md` both reference those section IDs by name. Changing a section ID is a breaking change for the whole skill.
3. Run `node scripts/build-create-component-docs.mjs` if your edit also touches `shadcn-props.json` (keeps `SKILL.md`'s generated blocks in sync).
4. Run `bash scripts/sync-cache.sh` to propagate into the `.claude` marketplace cache, then `bash scripts/verify-cache.sh` to confirm zero drift. (Phase 7 will add `scripts/build-min-templates.mjs` + a mtime freshness check here.)
5. Smoke-test by running `/create-component` against a live Figma file and verifying the `§6.9a` self-check assertions pass on the return payload.

Do **not** `Read` a template into chat context unless you need to debug — the whole point of these files is to be inlined by agents at run time, not read by humans.
