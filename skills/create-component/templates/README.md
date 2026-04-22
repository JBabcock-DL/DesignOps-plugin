# create-component / templates / README.md

Runtime JavaScript templates inlined into the `use_figma` call by `/create-component`. Agents `Read` and concatenate these files verbatim — **no editing in the `code` string**.

See [`../SKILL.md`](../SKILL.md) for the canonical **Script-assembly order** block; the table below is a quick reference only.

## Which file does the agent inline?

**Always `create-component-engine.min.figma.js`** — the pre-bundled engine. The standalone `.min` siblings are kept as debugging artifacts; they are **not safe to use as a pair at runtime** because the comment marker that tells agents where to splice `archetype-builders.min` into `draw-engine.min` gets stripped by minification. The build script does the splice at build time instead.

| Template (inline this) | Source (edit this) | Savings | Insertion point | Required when |
|---|---|---|---|---|
| [`create-component-engine.min.figma.js`](./create-component-engine.min.figma.js) | `draw-engine.figma.js` + `archetype-builders.figma.js` | -51% (128 KB → 63 KB) | after the §0 CONFIG block | **always** — canonical runtime artifact |
| [`draw-engine.min.figma.js`](./draw-engine.min.figma.js) | [`draw-engine.figma.js`](./draw-engine.figma.js) | -58% (77 KB → 32 KB) | n/a (debugging only) | **deprecated for runtime** — replaced by the bundle above |
| [`archetype-builders.min.figma.js`](./archetype-builders.min.figma.js) | [`archetype-builders.figma.js`](./archetype-builders.figma.js) | -42% (53 KB → 30 KB) | n/a (debugging only) | **deprecated for runtime** — rolled into the bundle above |
| [`migrate-composed-variants.figma.js`](./migrate-composed-variants.figma.js) | (small — no min variant) | n/a | replaces the draw engine entirely (legacy flat composites → instance stacks) | only when invoked via `--migrate-to-instances` per [`plans/create-component_atomic-composition.plan.md`](../../../plans/create-component_atomic-composition.plan.md) §7 |

## How the bundle is assembled

The build script splits `draw-engine.figma.js` on the two banner lines:

```
// ↓↓↓  INLINE archetype-builders.figma.js HERE  ↓↓↓
// ↑↑↑  END archetype-builders.figma.js insertion point  ↑↑↑
```

The prose between those two lines is discarded. The three resulting fragments — **draw-engine top half**, **archetype-builders**, **draw-engine bottom half** — are minified independently then concatenated. This order is the same one the source file documents, and it is hoisting-safe: archetype-builders are pure `function` declarations and only read closed-over variables (`bindColor`, `bindNum`, `labelFont`, `CONFIG`, `REGISTRY_COMPONENTS`, `DEFAULT_ICON_COMPONENT`, …) when they are actually called, by which time the bottom half of draw-engine has initialized every one of them.

The runtime `typeof buildSurfaceStackVariant === 'function'` assertion at the start of the bottom half (§6.2a) therefore always passes in the bundle — the assertion only ever fires in the deprecated two-file flow when an agent paste the files in the wrong order.

### Regenerating `.min` files

```bash
npm run build:min           # writes all three .min outputs (bundle + 2 standalones)
npm run build:min:check     # non-zero exit if any output is stale
```

`scripts/verify-cache.sh` fails if any `*.figma.js` is newer than any of its generated `*.min.figma.js` outputs — so a commit that edits a source template without regenerating the minified files will fail the cache verification step.

The minifier (`scripts/build-min-templates.mjs`) uses esbuild in whitespace-and-syntax mode only (**identifier renaming is disabled**) so every function name the runtime `typeof` asserts reference survives intact. Each source fragment is wrapped in an `(async()=>{ … })()` before minification (so esbuild can parse the top-level `await` + `return` the plugin sandbox expects) then unwrapped on the way out — the emitted `.min` files are bare script bodies, byte-equivalent to the sources for agent-inlining purposes.

## Function contracts the templates rely on

Each template declares functions at the top level, which hoists them into the plugin sandbox. The runtime `typeof` assertions at `draw-engine.figma.js §6.2a` and §6.9a check that these names survived whatever concatenation path the agent used; if a `throw new Error('[create-component] CONFIG.layout=... requires X(), but it is not defined ...')` fires, the script-assembly order was wrong.

### Scaffold + doc helpers (from `draw-engine.figma.js`)

`makeFrame` · `makeText` · `buildVariant` · `buildPropertiesTable` · `buildComponentSetSection` · `buildMatrix` · `buildUsageNotes`

### Archetype builders (from `archetype-builders.figma.js`)

`buildSurfaceStackVariant` · `buildFieldVariant` · `buildRowItemVariant` · `buildTinyVariant` · `buildControlVariant` · `buildContainerVariant` · `buildComposedVariant`

### Shared helpers (from `archetype-builders.figma.js`)

`makeDashedSlot` · `makeSampleText` · `makeIconSlotShared` · `wireIconSwapProp` · `bindColor` · `bindNum` · `labelFont`

## Editing these templates

1. Edit in the workspace (`c:/Users/jbabc/Documents/GitHub/DesignOps-plugin/skills/create-component/templates/...`).
2. Keep the top-of-file section banners (`// §0`, `// §6.2a`, etc.) intact — the `typeof` assertions and the Script-assembly order block in `SKILL.md` both reference those section IDs by name. Changing a section ID is a breaking change for the whole skill. **Do not remove the two banner lines** (`↓↓↓ INLINE archetype-builders.figma.js HERE ↓↓↓` / `↑↑↑ END archetype-builders.figma.js insertion point ↑↑↑`) — the build script uses them to split draw-engine when assembling the bundle; removing them causes `npm run build:min` to throw before writing anything.
3. Run `npm run build:min` to regenerate all three minified artifacts, then `node scripts/build-create-component-docs.mjs` if your edit also touches `shadcn-props.json` / `shadcn-props/*.json` (keeps `SKILL.md`'s generated blocks in sync).
4. Run `bash scripts/sync-cache.sh` to propagate into the `.claude` marketplace cache, then `bash scripts/verify-cache.sh` to confirm zero drift.
5. Smoke-test by running `/create-component` against a live Figma file and verifying the `§6.9a` self-check assertions pass on the return payload.

Do **not** `Read` a template into chat context unless you need to debug — the whole point of these files is to be inlined by agents at run time, not read by humans.
