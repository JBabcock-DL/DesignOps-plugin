// ═══════════════════════════════════════════════════════════════════════════
// create-component / draw-engine.figma.js
// ═══════════════════════════════════════════════════════════════════════════
// Scaffold + chip archetype builder + §6 documentation pipeline for the
// create-component skill. Agents running `create-component` MUST Read this
// file in full (no `limit`) and inline it VERBATIM inside their `use_figma`
// script IMMEDIATELY AFTER the §0 CONFIG block (see EXECUTOR.md + SKILL.md §6 template) and BEFORE the
// archetype-builders.figma.js template.
//
// The extraction exists because SKILL.md grew past the context-window slice
// that agents typically inline. The §6 doc pipeline (buildPropertiesTable /
// buildMatrix / buildUsageNotes) was silently dropping out mid-file, which
// caused Cards to render with forked property tables and missing Variants
// × States matrices. See the audit write-up in chat history for details.
//
// ───────────────────────────────────────────────────────────────────────────
// Required script-assembly order for a `use_figma` component draw:
//
//   1.  CONFIG                          — from EXECUTOR.md §0 (per-component)
//   2.  THIS FILE (draw-engine)         — scaffold + chip builder + §6 flow
//   3.  archetype-builders.figma.js     — injected at the marker inside this
//                                         file between §§5.7 (chip) and §6.0
//                                         (clear page); required for any
//                                         CONFIG.layout other than 'chip'
//   4.  (no further wrapping needed)    — §6.9a self-check is at the tail
//                                         of this file; it `return`s the
//                                         returnPayload for the skill runner
//
// Do NOT paraphrase. Do NOT inline only the helpers you think you need —
// the §6.2a dispatch references every builder by name and will throw
// `ReferenceError` if any is missing. The runtime `typeof` asserts further
// down in §6.2a catch accidental omissions with actionable error messages.
//
// Dependencies provided by the agent-assembled payload ABOVE the insertion point
// (do not re-declare them in this file; they come from §0 CONFIG):
//
//   CONFIG                         — Step 0 component config (from EXECUTOR.md §0)
//   REGISTRY_COMPONENTS            — registry map (if applicable)
//
// What this file provides (all hoisted, so §6.2a dispatch resolves regardless
// of the order archetype-builders.figma.js is inlined at the marker):
//
//   bindColor, bindNum             — §5.2 token binders
//   labelFont, labelFontVar        — §5.3 font resolver
//   allTextStyles                  — §5.5 published text styles
//   DEFAULT_ICON_COMPONENT         — §5.6 icon pack resolver
//   buildVariant(...)              — §5.7 chip archetype (Button / Badge)
//   makeFrame(...)                 — §6 frame factory
//   makeText(...)                  — §6 text node w/ published style
//   buildPropertiesTable(rows)     — §6.6 canonical 1640px properties table
//   buildComponentSetSection()     — §6.7 inline live ComponentSet section
//   buildMatrix()                  — §6.8 variants × states specimen matrix
//   buildUsageNotes()              — §6.9 Do / Don't cards
//   §6.2a dispatch                 — routes CONFIG.layout to the right builder
//   §6.9a self-check               — builds the returnPayload for S9.1–S9.9
//
// If you catch yourself editing anything in THIS file per-component, stop —
// you are forking, not configuring. Extend the CONFIG schema in
// EXECUTOR.md §0 / conventions/01-config-schema.md §3 instead.
// ═══════════════════════════════════════════════════════════════════════════


// ── §0a. Preamble-presence gate — runs before any identifier access ────
//
// The engine references seven identifiers that MUST be declared upstream
// by the agent-assembled payload, in this order:
//
//   1. CONFIG                  (from EXECUTOR.md §0, per component)
//   2. ACTIVE_FILE_KEY         (from templates/preamble.figma.js)
//   3. REGISTRY_COMPONENTS     (from templates/preamble.figma.js)
//   4. usesComposes            (from templates/preamble.figma.js)
//   5. logFileKeyMismatch      (from templates/preamble.figma.js)
//   6. _fileKeyObserved        (from templates/preamble.figma.js)
//   7. _fileKeyMismatch        (from templates/preamble.figma.js)
//
// If ANY are missing — usually because the agent truncated SKILL.md past
// §0 Quickstart and forgot to Read+inline `preamble.figma.js` between the
// CONFIG block and this engine bundle — the draw would throw an opaque
// `ReferenceError: X is not defined` somewhere mid-loop (most commonly in
// the return-payload builder at §6.9a, ~1500 lines deep). That surface is
// impossible to diagnose from the thrown error alone.
//
// This gate fires BEFORE anything else and lists every missing identifier
// with an actionable recovery path. `typeof <undeclaredName>` is safe —
// it returns 'undefined' without throwing — which is the only JS idiom
// that lets us probe an unseen identifier.
{
  const preambleGate = {
    CONFIG:                typeof CONFIG,
    ACTIVE_FILE_KEY:       typeof ACTIVE_FILE_KEY,
    REGISTRY_COMPONENTS:   typeof REGISTRY_COMPONENTS,
    usesComposes:          typeof usesComposes,
    logFileKeyMismatch:    typeof logFileKeyMismatch,
    _fileKeyObserved:      typeof _fileKeyObserved,
    _fileKeyMismatch:      typeof _fileKeyMismatch,
  };
  const missing = Object.entries(preambleGate)
    .filter(([, t]) => t === 'undefined')
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `[create-component] Preamble-presence gate: missing identifier(s) [${missing.join(', ')}]. ` +
      `Read and inline skills/create-component/templates/preamble.figma.js VERBATIM ` +
      `between the §0 CONFIG block and this engine bundle. The preamble file declares ` +
      `ACTIVE_FILE_KEY, REGISTRY_COMPONENTS, usesComposes, logFileKeyMismatch, ` +
      `_fileKeyObserved, and _fileKeyMismatch in one ~60-line block. ` +
      `See the "Script-assembly order" block in skills/create-component/EXECUTOR.md — runtime payload is ` +
      `CONFIG → preamble.figma.js → create-component-engine-{CONFIG.layout}.min.figma.js.`
    );
  }
}


// ── 1. Navigate to target page (must be in same call as creation) ──────
const targetPage = figma.root.children.find(p => p.name === CONFIG.pageName)
  ?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);

// ── 2. Resolve variable collections ─────────────────────────────────────
const collections = figma.variables.getLocalVariableCollections();
const allVars = figma.variables.getLocalVariables();

// Theme → color tokens  (color/primary/default, color/background/default, color/background/content, …)
const themeCol = collections.find(c => c.name === 'Theme');
const themeVars = themeCol ? allVars.filter(v => v.variableCollectionId === themeCol.id) : [];
const getColorVar = name => themeVars.find(v => v.name === name) ?? null;

// Layout → spacing and radius tokens  (space/xs, space/md, radius/md, …)
const layoutCol = collections.find(c => c.name === 'Layout');
const layoutVars = layoutCol ? allVars.filter(v => v.variableCollectionId === layoutCol.id) : [];
const getLayoutVar = name => layoutVars.find(v => v.name === name) ?? null;

// Typography → font-family STRING tokens  (Label/LG/font-family, Body/MD/font-family, …)
const typoCol = collections.find(c => c.name === 'Typography');
const typoVars = typoCol ? allVars.filter(v => v.variableCollectionId === typoCol.id) : [];
const getTypoVar = name => typoVars.find(v => v.name === name) ?? null;

// ── 2.5. Unresolved-token-path collector (agent observability) ──────────
//
// Every call to bindColor / bindNum / readTypoString silently falls back
// to a hex/number/default string when the requested Figma variable path is
// not in the file. That fallback is intentional — draws should succeed even
// against partial design systems — but it also *masks misconfigured CONFIG
// token paths*, which is how the sign-in draw debacle happened: the agent
// guessed at token paths, nothing resolved, and every fill landed on its
// hex fallback while the agent thought it had bound variables.
//
// Fix: collect every miss here, bucket by `(kind, path)`, and surface the
// aggregate in §6.9a's return payload so the agent sees the list the moment
// `use_figma` returns instead of having to eyeball the drawn component.
//
// A miss is not a throw — downstream code still uses the fallback. The
// payload lets the agent decide whether to patch CONFIG and redraw.
const _unresolvedTokenMisses = []; // { kind, path, fallback, nodeName }
// Two-phase draw (optional): phase 2 prepends __CC_PHASE1_UNRESOLVED__ so
// bindColor misses from phase 1 still appear in the final §6.9a aggregate.
if (typeof __CC_PHASE1_UNRESOLVED__ !== 'undefined' && Array.isArray(__CC_PHASE1_UNRESOLVED__)) {
  for (const m of __CC_PHASE1_UNRESOLVED__) _unresolvedTokenMisses.push(m);
}
function _recordUnresolved(kind, path, fallback, node) {
  _unresolvedTokenMisses.push({
    kind, path, fallback,
    nodeName: (node && typeof node.name === 'string') ? node.name : null,
  });
}

// ── 3. Read font-family names from Typography collection ─────────────────
// We must know the actual font family name before calling loadFontAsync.
// Read the base mode ("100") value; fall back to "Inter" if absent.
function readTypoString(variable) {
  if (!variable || !typoCol) return null;
  const baseMode = typoCol.modes.find(m => m.name === '100');
  if (!baseMode) return null;
  const val = variable.valuesByMode[baseMode.modeId];
  return (typeof val === 'string' && val.length > 0) ? val : null;
}

const labelFontVar   = getTypoVar('Label/LG/font-family');
const displayFontVar = getTypoVar('Display/LG/font-family');
const labelFont   = readTypoString(labelFontVar)   ?? 'Inter';
const displayFont = readTypoString(displayFontVar) ?? labelFont;

// ── 4. Load fonts (must precede any text.characters assignment) ──────────
await figma.loadFontAsync({ family: labelFont,   style: 'Regular' });
await figma.loadFontAsync({ family: labelFont,   style: 'Medium'  });
if (displayFont !== labelFont) {
  await figma.loadFontAsync({ family: displayFont, style: 'Regular' });
  await figma.loadFontAsync({ family: displayFont, style: 'Medium'  });
}

// ── 5. Binding helpers ───────────────────────────────────────────────────

// Color binding: fills/strokes must use boundVariables on the paint object.
// varName is a Theme path e.g. 'color/primary/default', 'color/background/default'.
// Do NOT use setBoundVariable for color — that API is for numeric fields only.
//
// When the Theme variable is not found we still apply the hex fallback so the
// draw succeeds, but we also record the miss in _unresolvedTokenMisses so the
// agent sees it in the return payload (see §2.5).
function bindColor(node, varName, fallbackHex, target = 'fills') {
  const variable = varName ? getColorVar(varName) : null;
  const hex = fallbackHex.replace('#', '');
  const paint = {
    type: 'SOLID',
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
  if (variable) {
    paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
  } else if (varName) {
    _recordUnresolved('color', varName, fallbackHex, node);
  }
  node[target] = [paint];
}

// Spacing / radius binding: varName is a Layout path e.g. 'space/md', 'radius/md'.
// Always set the fallback number first so the node has a valid value even if
// the Layout collection is absent or setBoundVariable throws.
//
// Misses recorded into _unresolvedTokenMisses — see §2.5.
function bindNum(node, field, varName, fallback) {
  node[field] = fallback;
  const variable = varName ? getLayoutVar(varName) : null;
  if (variable) {
    try { node.setBoundVariable(field, variable); } catch (_) {}
  } else if (varName) {
    _recordUnresolved('num:' + field, varName, fallback, node);
  }
}

// ── 5.5. Pre-resolve published Doc/* + Label/* text styles (ASYNC, ONCE) ─
//
// CRITICAL ORDERING RULE — DO NOT MOVE / DO NOT INLINE:
//   `figma.getLocalTextStylesAsync()` is async and MUST be awaited at the
//   top level of the script (which runs in an async IIFE per the MCP
//   plugin execution model). It MUST be resolved BEFORE `buildVariant`
//   is declared in §6 so the synchronous `buildVariant` / `makeLabel`
//   closure can read `allTextStyles` without needing `await` itself.
//
//   DO NOT move this block inside `buildVariant`, `makeLabel`, or any
//   other non-async helper. A naive "just move the fetch to where it's
//   used" refactor will insert `await` inside a non-async function and
//   the whole script fails to parse with a SyntaxError before any draw
//   happens. If you need the text styles at a new site, read them from
//   THIS closure variable — never re-fetch.
//
// Also: §6.1 (Doc/* resolver + makeText) reuses this same `allTextStyles`
// array — do NOT call `figma.getLocalTextStylesAsync()` a second time.
const allTextStyles = await figma.getLocalTextStylesAsync();

// ── 5.6. Resolve default icon component (ASYNC, ONCE, OPTIONAL) ──────────
//
// When the designer configured a default icon in `designops.config.json`
// (Step 3b), every `icon-slot/*` in this component becomes an INSTANCE of
// that icon AND gets an INSTANCE_SWAP component property — designers pick
// any icon from the library via the right-panel dropdown on a per-instance
// basis.
//
// When no default is configured OR resolution fails, `DEFAULT_ICON_*`
// stays null and `makeIconSlot` falls back to the original empty 24×24
// dashed placeholder (current behavior — nothing changes for projects
// without a library).
//
// Two resolution paths (try in order; first success wins):
//   1. `defaultIconRef.componentKey` (40-hex hash) → `importComponentByKeyAsync`.
//      Works for local AND cross-file published library components.
//   2. `defaultIconRef.nodeId` (e.g. '417:9815') → `getNodeByIdAsync`. Runs
//      only when the ref is known to be same-file: `kind === 'node-id'`
//      (no fileKey was ever captured — implicitly current file) OR
//      `kind === 'url' && ref.fileKey === currentFileKey`. Cross-file
//      URLs cannot be resolved by node-id — `getNodeByIdAsync` sees only
//      the current file. Those fall through to 'failed:cross-file-needs-key'
//      and require the designer to paste a componentKey instead.
//
//      If the resolved node is a COMPONENT_SET we pick its first variant
//      (the first child ComponentNode) so INSTANCE_SWAP targets a leaf.
//      If it's already a COMPONENT we use it directly.
//
// Back-compat: if an old config shape has a flat `defaultIconKey` string,
// treat it as `defaultIconRef.componentKey`.
//
// Same ordering rule as §5.5: all awaits MUST resolve at the top level
// BEFORE `buildVariant` is declared; the resolved component is captured
// via closure. DO NOT inline these awaits inside `makeIconSlot` — it's a
// synchronous helper.
const ICON_PACK_CFG = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.iconPack) || null;
let DEFAULT_ICON_COMPONENT = null;
let DEFAULT_ICON_RESOLUTION = 'none';  // 'by-key' | 'by-node-id' | 'failed:<reason>' | 'none'

if (ICON_PACK_CFG) {
  // Normalize: accept new `defaultIconRef` object OR legacy flat `defaultIconKey` string.
  const ref = ICON_PACK_CFG.defaultIconRef
    || (ICON_PACK_CFG.defaultIconKey
      ? { kind: 'component-key', componentKey: ICON_PACK_CFG.defaultIconKey, nodeId: null, fileKey: null, rawInput: ICON_PACK_CFG.defaultIconKey }
      : null);

  // Decide whether a URL's fileKey points at the CURRENT file so we can
  // try `getNodeByIdAsync` (only works intra-file). When the URL points
  // at a different file, `getNodeByIdAsync` would return null and we'd
  // need a componentKey — which Step 3b.d asks for as the recovery path.
  const currentFileKey = (typeof figma.fileKey === 'string' && figma.fileKey) || ACTIVE_FILE_KEY || null;

  if (ref) {
    // --- Path 1: resolve by componentKey (preferred — intra OR cross-file) ---
    if (ref.componentKey && typeof ref.componentKey === 'string' && /^[a-f0-9]{40}$/.test(ref.componentKey)) {
      try {
        DEFAULT_ICON_COMPONENT = await figma.importComponentByKeyAsync(ref.componentKey);
        DEFAULT_ICON_RESOLUTION = 'by-key';
      } catch (err) {
        DEFAULT_ICON_RESOLUTION = 'failed:key-unreachable:' + (err && err.message ? err.message : String(err));
        console.warn('importComponentByKeyAsync failed for defaultIconRef.componentKey:', err);
      }
    }

    // --- Path 2: resolve by nodeId (CURRENT FILE only) ------------------
    // 'node-id' kind always means current file (no fileKey was ever captured).
    // 'url' kind needs its fileKey to match this file's key to be resolvable;
    // cross-file URLs fall through to the 'cross-file-needs-key' branch.
    const nodeIdIsCurrentFile =
      ref.nodeId && (
        ref.kind === 'node-id' ||
        (ref.kind === 'url' && (!ref.fileKey || (currentFileKey && ref.fileKey === currentFileKey)))
      );
    if (!DEFAULT_ICON_COMPONENT && nodeIdIsCurrentFile) {
      try {
        const node = await figma.getNodeByIdAsync(ref.nodeId);
        if (!node) {
          DEFAULT_ICON_RESOLUTION = 'failed:node-not-found:' + ref.nodeId;
        } else if (node.type === 'COMPONENT') {
          DEFAULT_ICON_COMPONENT = node;
          DEFAULT_ICON_RESOLUTION = 'by-node-id';
        } else if (node.type === 'COMPONENT_SET') {
          // Component sets have N variants. Pick the default variant
          // (first child ComponentNode) so INSTANCE_SWAP targets a leaf.
          const firstVariant = node.children.find(ch => ch.type === 'COMPONENT');
          if (firstVariant) {
            DEFAULT_ICON_COMPONENT = firstVariant;
            DEFAULT_ICON_RESOLUTION = 'by-node-id-variant';
          } else {
            DEFAULT_ICON_RESOLUTION = 'failed:component-set-empty:' + ref.nodeId;
          }
        } else {
          DEFAULT_ICON_RESOLUTION = 'failed:node-wrong-type:' + node.type + ':' + ref.nodeId;
        }
      } catch (err) {
        DEFAULT_ICON_RESOLUTION = 'failed:node-lookup:' + (err && err.message ? err.message : String(err));
        console.warn('getNodeByIdAsync failed for defaultIconRef.nodeId:', err);
      }
    }

    // --- Cross-file URL without componentKey → can't resolve ------------
    if (
      !DEFAULT_ICON_COMPONENT
      && ref.kind === 'url'
      && ref.fileKey
      && currentFileKey
      && ref.fileKey !== currentFileKey
      && !ref.componentKey
    ) {
      DEFAULT_ICON_RESOLUTION = 'failed:cross-file-needs-key';
    }

    // --- URL without a node-id AND without a componentKey → can't resolve
    if (
      !DEFAULT_ICON_COMPONENT
      && ref.kind === 'url'
      && !ref.nodeId
      && !ref.componentKey
      && DEFAULT_ICON_RESOLUTION === 'none'
    ) {
      DEFAULT_ICON_RESOLUTION = 'failed:url-missing-node-id';
    }
  }
}

const ICON_SLOT_MODE = DEFAULT_ICON_COMPONENT ? 'instance-swap' : 'placeholder';

// Build one fully complete ComponentNode — layout, spacing, radius, color,
// icon slots, text label, AND element component properties all applied
// and bound before this function returns. Call once per variant. Pass
// the `.component` values to combineAsVariants afterward.
//
// Children are appended in reading order:
//   [icon-slot/leading] → [text label] → [icon-slot/trailing]
// OR (when `label` is null AND at least one slot is enabled):
//   [icon-slot/center]
//
// Icon slots are 24×24 placeholder frames with no fill and a 1px dashed
// stroke bound to `color/border/default` (hex fallback #d4d4d8),
// cornerRadius 4, layoutMode NONE. The dashed outline is visible in the
// Figma editor so designers can locate drop targets on canvas, and sits
// behind any child the designer adds — final renders show the child, not
// the placeholder. Slots preserve their 24×24 footprint in auto-layout
// even while empty. See conventions/01-config-schema.md §3.3.1 for the authoritative spec.
//
// Per the Plugin API docs, element component properties (TEXT / BOOLEAN /
// INSTANCE_SWAP) MUST be added to each variant component BEFORE combining.
// After `combineAsVariants`, the ComponentSet merges identically-named
// properties across variants into a single ComponentSet-level property
// that designers see in the right panel.
//
// Return shape:
//   { component, slots: { leading?, trailing?, center?, label? }, propKeys }
//
// name:         Figma variant name — single-property 'variant=default' or
//               cross-product 'variant=default, size=sm' (comma+space separator)
// fillVar:      Theme path for background fill e.g. 'color/primary/default'
// fallbackFill: hex used when Theme collection is absent
// options:
//   label          — text inside the component; null / '' → icon-only mode
//   labelVar       — Theme path for label text color
//   strokeVar      — Theme path for stroke (null = no stroke)
//   radiusVar      — Layout path for corner radius
//   padH           — Layout path for horizontal padding
//   padV           — Layout path for vertical padding
//   labelStyleName — published text style e.g. 'Label/MD'
//   leadingSlot    — render icon-slot/leading before the label
//   trailingSlot   — render icon-slot/trailing after the label
//   iconSlotSize   — slot width/height in px (default 24)
//   addLabelProp   — add TEXT "Label" property bound to the text node
//   addLeadingProp — add BOOLEAN "Leading icon" property bound to leading slot visibility
//   addTrailingProp— add BOOLEAN "Trailing icon" property bound to trailing slot visibility
//   propLabelText  — default string for the TEXT "Label" property
//
// NOTE: `buildVariant` is intentionally synchronous. `makeLabel` below
// reads `allTextStyles` via CLOSURE from the §5.5 top-level await. DO NOT
// add `async` to this function and DO NOT insert `await figma.getLocal*
// *Async()` calls inside it — the correct fetch site is §5.5, above the
// function declaration. See the §5.5 comment block for the full rule.
// __CC_DOC_SLIM_OMIT_CHIP_BUILDER_START__
function buildVariant(name, fillVar, fallbackFill, {
  label            = null,
  labelVar         = 'color/background/content',
  strokeVar        = null,
  radiusVar        = 'radius/md',
  padH             = 'space/md',
  padV             = 'space/xs',
  labelStyleName   = null,
  leadingSlot      = false,
  trailingSlot     = false,
  iconSlotSize     = 24,
  addLabelProp     = false,
  addLeadingProp   = false,
  addTrailingProp  = false,
  propLabelText    = 'Label',
} = {}) {
  const c = figma.createComponent();
  c.name = name;

  // Auto-layout
  c.layoutMode            = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  // Icon-only mode: no label → render a single centered slot, force square
  // padding so the component ends up square (matches shadcn `size=icon`).
  const hasLabel   = !!(label && String(label).length > 0);
  const anySlot    = leadingSlot || trailingSlot;
  const iconOnly   = !hasLabel && anySlot;
  const padHEff    = iconOnly ? padH : padH;      // same for both axes when icon-only
  const padVEff    = iconOnly ? padH : padV;      // square padding

  // Spacing — bind via Layout collection before combining
  bindNum(c, 'paddingLeft',   padHEff,     16);
  bindNum(c, 'paddingRight',  padHEff,     16);
  bindNum(c, 'paddingTop',    padVEff,      8);
  bindNum(c, 'paddingBottom', padVEff,      8);
  bindNum(c, 'itemSpacing',  'space/sm',    8);

  // Border radius — all four corners individually (Figma requires each separately)
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));

  // Fill
  bindColor(c, fillVar, fallbackFill, 'fills');

  // Optional stroke
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  // --- Helpers scoped to this variant -----------------------------------
  // Two modes, selected by the top-level §5.6 resolver:
  //
  //   'instance-swap' (DEFAULT_ICON_COMPONENT is set): slot is an INSTANCE
  //       of the designer's chosen default library icon. Back at the
  //       variant-property block below, each slot gets an INSTANCE_SWAP
  //       component property so designers can swap per-instance via the
  //       right-panel dropdown without detaching the component.
  //
  //   'placeholder' (DEFAULT_ICON_COMPONENT is null): slot is a 24×24
  //       transparent frame with a 1px dashed stroke bound to
  //       `color/border/default`. Invisible in renders, discoverable on the
  //       canvas and layers panel. Designers drop SVG content into it later
  //       (stroke hides behind the child) or toggle the slot off via the
  //       matching Boolean property. cornerRadius: 4 keeps the placeholder
  //       visually distinct from the parent component chrome.
  //
  // DO NOT call `figma.importComponentByKeyAsync` here — that's an async
  // fetch and would break `buildVariant`'s sync contract. The default
  // component is resolved once at §5.6 and captured via closure.
  function makeIconSlot(slotName) {
    if (DEFAULT_ICON_COMPONENT) {
      const inst = DEFAULT_ICON_COMPONENT.createInstance();
      inst.name = slotName;
      try { inst.resize(iconSlotSize, iconSlotSize); } catch (_) {}
      inst.layoutPositioning = 'AUTO';
      return inst;
    }
    const f = figma.createFrame();
    f.name          = slotName;
    f.layoutMode    = 'NONE';       // children, if any, are positioned manually
    f.resize(iconSlotSize, iconSlotSize);
    f.fills         = [];
    bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
    f.strokeWeight  = 1;
    f.dashPattern   = [4, 3];
    f.cornerRadius  = 4;
    f.clipsContent  = false;
    // Keep the slot from stretching with the auto-layout row
    f.layoutPositioning = 'AUTO';
    return f;
  }

  function makeLabel(text) {
    const txt = figma.createText();
    txt.fontName   = { family: labelFont, style: 'Medium' };
    txt.characters = text;
    // Prefer a published text style (Label/XS · Label/SM · Label/MD · Label/LG)
    // so every component label stays in sync with the Typography system.
    // Falls back to raw fontSize + bound font-family variable if the style
    // doesn't exist in the file yet.
    const ts = labelStyleName
      ? allTextStyles.find(s => s.name === labelStyleName)
      : null;
    if (ts) {
      txt.textStyleId = ts.id;
    } else {
      txt.fontSize = 14;
      if (labelFontVar) {
        try { txt.setBoundVariable('fontFamily', labelFontVar); } catch (_) {}
      }
    }
    bindColor(txt, labelVar, '#000000', 'fills');
    return txt;
  }

  // --- Assemble children -------------------------------------------------
  const slots = { leading: null, trailing: null, center: null, label: null };

  if (iconOnly) {
    slots.center = makeIconSlot('icon-slot/center');
    c.appendChild(slots.center);
  } else {
    if (leadingSlot) {
      slots.leading = makeIconSlot('icon-slot/leading');
      c.appendChild(slots.leading);
    }
    if (hasLabel) {
      slots.label = makeLabel(label);
      c.appendChild(slots.label);
    }
    if (trailingSlot) {
      slots.trailing = makeIconSlot('icon-slot/trailing');
      c.appendChild(slots.trailing);
    }
  }

  // --- Element component properties -------------------------------------
  // Added on THIS variant component BEFORE combineAsVariants (the API
  // contract — see figma-use/component-patterns.md). After combining,
  // the ComponentSet merges identically-named properties across variants
  // into a single set-level property that designers see in the Properties
  // panel. Each variant has its own key; we store them on `propKeys` only
  // for optional debugging / reporting downstream.
  const propKeys = {};
  try {
    if (addLabelProp && slots.label) {
      propKeys.label = c.addComponentProperty('Label', 'TEXT', String(propLabelText));
      slots.label.componentPropertyReferences = { characters: propKeys.label };
    }
    if (addLeadingProp && slots.leading) {
      propKeys.leadingIcon = c.addComponentProperty('Leading icon', 'BOOLEAN', true);
      slots.leading.componentPropertyReferences = { visible: propKeys.leadingIcon };
    }
    if (addTrailingProp && slots.trailing) {
      propKeys.trailingIcon = c.addComponentProperty('Trailing icon', 'BOOLEAN', false);
      slots.trailing.componentPropertyReferences = { visible: propKeys.trailingIcon };
    }

    // INSTANCE_SWAP wiring — only when §5.6 resolved a default library icon.
    // Each `icon-slot/*` instance gets its own INSTANCE_SWAP property bound
    // to `mainComponent` so designers can swap to any icon from the library
    // via the right-panel dropdown. The default value is the same library
    // component id for every slot; designers override per-instance at the
    // canvas usage site, not here.
    //
    // Per Figma API: INSTANCE_SWAP property defaultValue is the component
    // id of the default target. The `preferredValues` hint scopes the
    // dropdown to the same library the default came from, when available.
    if (DEFAULT_ICON_COMPONENT) {
      const swapDefault = DEFAULT_ICON_COMPONENT.id;
      const preferred = DEFAULT_ICON_COMPONENT.key
        ? [{ type: 'COMPONENT', key: DEFAULT_ICON_COMPONENT.key }]
        : undefined;
      const swapOpts = preferred ? { preferredValues: preferred } : undefined;
      if (slots.leading) {
        propKeys.leadingSwap = c.addComponentProperty('Icon: leading', 'INSTANCE_SWAP', swapDefault, swapOpts);
        slots.leading.componentPropertyReferences = {
          ...(slots.leading.componentPropertyReferences || {}),
          mainComponent: propKeys.leadingSwap,
        };
      }
      if (slots.trailing) {
        propKeys.trailingSwap = c.addComponentProperty('Icon: trailing', 'INSTANCE_SWAP', swapDefault, swapOpts);
        slots.trailing.componentPropertyReferences = {
          ...(slots.trailing.componentPropertyReferences || {}),
          mainComponent: propKeys.trailingSwap,
        };
      }
      if (slots.center) {
        propKeys.centerSwap = c.addComponentProperty('Icon', 'INSTANCE_SWAP', swapDefault, swapOpts);
        slots.center.componentPropertyReferences = {
          ...(slots.center.componentPropertyReferences || {}),
          mainComponent: propKeys.centerSwap,
        };
      }
    }
  } catch (err) {
    console.warn(`addComponentProperty failed on variant '${name}':`, err && err.message ? err.message : err);
  }

  // Append to current page before any combining
  figma.currentPage.appendChild(c);
  return { component: c, slots, propKeys };
}
// __CC_DOC_SLIM_OMIT_CHIP_BUILDER_END__


// ═══════════════════════════════════════════════════════════════════════════
// ↓↓↓  INLINE archetype-builders.figma.js HERE  ↓↓↓
// ═══════════════════════════════════════════════════════════════════════════
//
// Agents assembling this script for a `use_figma` call MUST Read
// `skills/create-component/templates/archetype-builders.figma.js` in full
// and paste its contents VERBATIM at THIS point, between §5.7 (the chip
// `buildVariant` ending immediately above) and §6.0 (the clear-page block
// starting immediately below).
//
// Skip this only when CONFIG.layout === 'chip' (Button, Badge, Toggle,
// Kbd, Switch). Every other archetype (surface-stack, field, row-item,
// tiny, container, control, __composes__) requires the builders provided
// by archetype-builders.figma.js. The runtime typeof assert in §6.2a
// (below) will throw with a descriptive error if the template is missing
// when CONFIG.layout needs it.
//
// ═══════════════════════════════════════════════════════════════════════════
// ↑↑↑  END archetype-builders.figma.js insertion point  ↑↑↑
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6. DEFAULT DRAW FLOW — matrix documentation frame (every component)
// ═══════════════════════════════════════════════════════════════════════════
// Every component renders the same 5-section doc frame per conventions/04-doc-pipeline-contract.md §1:
//   1. Header         — title + summary + source link
//   2. Properties     — Properties + Types table
//   3. Component Set  — live, editable ComponentSet (horizontal-wrap grid)
//   4. Matrix         — Variant × State specimen matrix (grouped by size)
//   5. Usage          — Do / Don't cards
//
// The ComponentSet is reparented INTO the doc frame as §3 (Component Set)
// so designers can see and edit the live variants in place — not parked
// off-canvas. The matrix below contains instances of it that update
// automatically when the designer edits the source ComponentSet.
//
// Every variant is assembled as:
//   [icon-slot/leading 24×24] → [text label] → [icon-slot/trailing 24×24]
// (OR a single `icon-slot/center 24×24` when `label()` returns null — the
//  icon-only mode used by shadcn's `size=icon`).
//
// Icon slots are 24×24 placeholder frames with no fill and a 1px dashed
// stroke bound to `color/border/default` (fallback #d4d4d8), cornerRadius
// 4, layoutMode NONE. The dashed outline is discoverable on canvas and in
// the layers panel; it sits behind any child the designer drops in, so
// final renders show the icon and not the placeholder. See
// conventions/01-config-schema.md §3.3.1 for the authoritative slot spec.
//
// The ComponentSet exposes three element component properties so
// designers edit instances WITHOUT DETACHING:
//   • TEXT     "Label"         → bound to every variant's text characters
//   • BOOLEAN  "Leading icon"  → bound to icon-slot/leading visibility
//   • BOOLEAN  "Trailing icon" → bound to icon-slot/trailing visibility
//
// Everything below reads from the CONFIG object defined at §0. No
// hardcoded component-specific constants are permitted past this point.

const DOC_FRAME_WIDTH  = 1640;
const GUTTER_W_SIZE    = 60;
const GUTTER_W_VARIANT = 160;

// --- Two-phase draw (optional MCP chunking) -------------------------------
// Omitted or 0 = single `use_figma` (legacy). 1 = build ComponentSet only
// and return early. 2 = doc pipeline only — skips §6.0 clear and variant
// build; requires __PHASE_1_COMP_SET_ID__, __CC_PHASE1_PROPS_ADDED__, and
// optionally __CC_PHASE1_UNRESOLVED__ injected before this engine. See
// skills/create-component/EXECUTOR.md (inline two-phase) + figma-slice-runner (six-slice).
const _ccPhase = typeof __CREATE_COMPONENT_PHASE__ === 'undefined' ? 0 : __CREATE_COMPONENT_PHASE__;
if (_ccPhase !== 0 && _ccPhase !== 1 && _ccPhase !== 2) {
  throw new Error(
    `[create-component] __CREATE_COMPONENT_PHASE__ must be 0, 1, 2, or omitted; got ${_ccPhase}`,
  );
}

// --- 6.0  Clear page (except _Header) -----------------------------------
// Wipe EVERYTHING except _Header — orphan ComponentSets, half-drawn doc
// frames, abandoned variant components from a prior failed run.
// Phase 2 must NOT clear — the ComponentSet from phase 1 still lives here.

if (_ccPhase !== 2) {
  for (const node of [...figma.currentPage.children]) {
    if (node.name !== '_Header') node.remove();
  }
}

// --- 6.1  Resolve published Doc/* text styles + makeText ----------------
// conventions/04-doc-pipeline-contract.md §7 — every doc text node must assign textStyleId.
//
// REUSE — do NOT re-fetch. `allTextStyles` is already populated by §5.5
// (see that block's comment for why the await must live above buildVariant).
// Calling `figma.getLocalTextStylesAsync()` a second time here is safe but
// wasteful; inlining it inside any helper is a syntax error.

const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
  section:   getDocStyle('Doc/Section'),
  tokenName: getDocStyle('Doc/TokenName'),
  code:      getDocStyle('Doc/Code'),
  caption:   getDocStyle('Doc/Caption'),
};

// 4-arg makeText — the 4th arg is a Theme var path bound to the text fill.
// bindColor is defined at §5 above.
function makeText(chars, styleKey, fallbackSize = 13, fillVar = 'color/background/content') {
  const t = figma.createText();
  t.fontName = { family: labelFont, style: 'Regular' };
  t.characters = String(chars);
  if (DOC[styleKey]) t.textStyleId = DOC[styleKey].id;
  else t.fontSize = fallbackSize;
  t.textAutoResize = 'HEIGHT';   // CRITICAL — prevents 10px row collapse
  bindColor(t, fillVar, '#0a0a0a', 'fills');
  return t;
}

// --- 6.2  Build the ComponentSet (variant x size only — NOT state) ------
// State (hover/pressed/disabled) is an instance override in the matrix,
// not a Figma variant property. conventions/04-doc-pipeline-contract.md §13.1 explains why.

const hasSizeAxis = CONFIG.sizes && CONFIG.sizes.length > 0;
const sizeList    = hasSizeAxis ? CONFIG.sizes : [null];
const padFallback = CONFIG.padH?.default ?? 'space/md';
const radiusVar   = CONFIG.radius ?? 'radius/md';

const labelStyleFallback = CONFIG.labelStyle?.default ?? null;
const iconSlots          = CONFIG.iconSlots || {};
const iconSlotSize       = iconSlots.size ?? 24;
const leadingGlobal      = !!iconSlots.leading;
const trailingGlobal     = !!iconSlots.trailing;
const cp                 = CONFIG.componentProps || {};

// Pick a sensible default string for the TEXT "Label" property —
// first non-null label across sizes/variants, or fall back to CONFIG.title.
const defaultLabelText = (() => {
  if (typeof CONFIG.label !== 'function') return String(CONFIG.label ?? CONFIG.title ?? 'Label');
  for (const s of sizeList) {
    const l = CONFIG.label(s, CONFIG.variants[0]);
    if (l) return String(l);
  }
  return String(CONFIG.title ?? 'Label');
})();

// --- 6.2a  Archetype dispatch ------------------------------------------
// Each CONFIG.layout value routes to a dedicated builder. All builders
// return the same `{ component, slots, propKeys }` shape so downstream
// code (combineAsVariants, matrix renderer, property-definition readout)
// stays archetype-agnostic.
//
// 🚨 PREREQUISITE 🚨 Before the switch below can resolve, the
// archetype builders from
// `skills/create-component/templates/archetype-builders.figma.js`
// MUST already be inlined above this line (see the pointer block just
// above §6). If you skip the template inline, every non-chip layout
// falls through the `default:` branch and renders as a chip — which is
// what caused Inputs/Cards to draw as buttons in earlier runs.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🚨 ARCHETYPE BUILDER CONTRACT — READ BEFORE WRITING / MODIFYING ANY BUILDER
// ═══════════════════════════════════════════════════════════════════════════
// Builders produce ONE THING: a single Figma COMPONENT node (the master for
// one variant) plus a `slots` / `propKeys` bag for later wiring. That is the
// ENTIRE scope of a builder. Specifically, every builder MUST:
//
//   ✅ Create and return `{ component, slots, propKeys }`.
//   ✅ Use shared helpers (`makeDashedSlot`, `makeSampleText`,
//      `makeIconSlotShared`, `wireIconSwapProp`) for placeholders, text,
//      and icon-slot instances so visual language stays uniform.
//   ✅ Honor Figma auto-layout enum rules (§ guardrail block below).
//
// And MUST NOT:
//
//   ❌ Create any `doc/*`, `doc/table/*`, `doc/table-group/*`,
//      `doc/component/*`, `doc/component-set-group`, `doc/matrix*`,
//      `doc/usage*`, `_PageContent`, or any other doc-frame node.
//   ❌ Render a Properties table, a ComponentSet section wrapper, a Variants
//      × States matrix, Size-variant sub-sections, or Do / Don't cards.
//   ❌ Emit section headings like "Size variants", "Properties", "Component",
//      "Variants × States", or "Do / Don't" — those come from §§6.6–6.8.
//   ❌ Rename doc columns to mixed-case (e.g. `Name / Type / Default / Required
//      / Description`). The canonical column casing is defined exactly once at
//      §6.6 (`PROPERTY / TYPE / DEFAULT / REQUIRED / DESCRIPTION`) and is
//      shared by every archetype — no exceptions.
//
// If you catch an agent-authored variant of a builder (especially for
// `surface-stack`, `field`, `row-item`, or `container`) creating its own
// doc frames or rewriting the header row of the properties table, REMOVE
// that code. The correct output of §6.2a is a `variantData[]` array of
// masters — nothing else. §§6.3–6.9 then build the doc frame around them.
//
// REGRESSION FINGERPRINTS — if the rendered page shows ANY of these, a
// builder forked the doc pipeline and must be reverted:
//   · Mixed-case table headers ("Name", "Type", …) instead of uppercase.
//   · A "Size variants" section (not in the canonical §§6.6–6.8).
//   · Properties table narrower than 1640px.
//   · Properties header row missing the `color/background/variant` fill.
//   · Two separate ComponentSet tiles (one per size) instead of the single
//     wrapped ComponentSet from §6.6B + the full matrix from §6.7.
// ═══════════════════════════════════════════════════════════════════════════
//
//   'chip'          → buildVariant             (Button, Badge, Toggle, Kbd)
//   'surface-stack' → buildSurfaceStackVariant (Card, Alert, Dialog, Sheet)
//   'field'         → buildFieldVariant        (Input, Textarea, Select)
//   'row-item'      → buildRowItemVariant      (Dropdown Item, Menubar)
//   'tiny'          → buildTinyVariant         (Separator, Skeleton, …)
//   'container'     → buildContainerVariant    (Accordion, Tabs)
//   'control'       → buildControlVariant      (Checkbox, Radio, Switch)
//
// `usesComposes` (atomic composition) wins over CONFIG.layout when set —
// composite components always draw via buildComposedVariant regardless
// of their base archetype.
const layoutKey = usesComposes ? '__composes__' : (CONFIG.layout || 'chip');

// 🚨 ASSERT — archetype-builders template was inlined when CONFIG.layout
// needs it. If an agent truncates SKILL.md and forgets to read+inline
// `templates/archetype-builders.figma.js`, every non-chip draw would
// otherwise throw a cryptic `ReferenceError: buildFieldVariant is not
// defined` mid-loop. This check surfaces the REAL problem up-front.
//
// `typeof <undeclaredName>` is guaranteed-safe in JS — it returns
// 'undefined' without throwing. We rely on that to probe presence.
// Phase 2 doc-only bundles omit archetype builders — variant masters already exist.
if (_ccPhase !== 2) {
  let missingFn = null;
  if (layoutKey === 'surface-stack' && typeof buildSurfaceStackVariant !== 'function') missingFn = 'buildSurfaceStackVariant';
  else if (layoutKey === 'field'    && typeof buildFieldVariant        !== 'function') missingFn = 'buildFieldVariant';
  else if (layoutKey === 'row-item' && typeof buildRowItemVariant      !== 'function') missingFn = 'buildRowItemVariant';
  else if (layoutKey === 'tiny'     && typeof buildTinyVariant         !== 'function') missingFn = 'buildTinyVariant';
  else if (layoutKey === 'container'&& typeof buildContainerVariant    !== 'function') missingFn = 'buildContainerVariant';
  else if (layoutKey === 'control'  && typeof buildControlVariant      !== 'function') missingFn = 'buildControlVariant';
  else if (layoutKey === '__composes__' && typeof buildComposedVariant !== 'function') missingFn = 'buildComposedVariant';
  if (missingFn) {
    // Normalize '__composes__' → 'composed' to match the filename convention.
    const layoutForPath = layoutKey === '__composes__' ? 'composed' : layoutKey;
    throw new Error(
      `[create-component] CONFIG.layout='${layoutKey}' requires ${missingFn}(), but it is not defined in this script. ` +
      `Read and inline skills/create-component/templates/create-component-engine-${layoutForPath}.min.figma.js ` +
      `verbatim after the §0 CONFIG — that pre-bundled file contains draw-engine + the ${missingFn} builder. ` +
      `(The full 'create-component-engine.min.figma.js' bundle is debug-only and too tight for runtime CONFIG.) ` +
      `See the Script-assembly order block + routing table in skills/create-component/EXECUTOR.md.`
    );
  }
}

// 🚨 ASSERT — draw-engine template itself provides every doc-pipeline helper.
// Phase 1 (MCP split bundle) returns before `makeFrame` / `buildPropertiesTable`
// exist — skip this assert when `_ccPhase === 1` only.
if (_ccPhase !== 1) {
  const requiredEngineFns = {
    makeFrame,
    makeText,
    buildPropertiesTable,
    buildComponentSetSection,
    buildMatrix,
    buildUsageNotes,
  };
  if (_ccPhase !== 2) {
    requiredEngineFns.buildVariant = buildVariant;
  }
  const missingEngineFns = Object.entries(requiredEngineFns)
    .filter(([, fn]) => typeof fn !== 'function')
    .map(([name]) => name);
  if (missingEngineFns.length > 0) {
    throw new Error(
      `[create-component] draw-engine.figma.js is missing function(s): ${missingEngineFns.join(', ')}. ` +
      `You must Read skills/create-component/templates/draw-engine.figma.js IN FULL (no limit) and inline it ` +
      `verbatim between the §0 CONFIG block and the archetype-builders.figma.js insertion point. ` +
      `See the "Script-assembly order" block in skills/create-component/EXECUTOR.md for the required order.`
    );
  }
}

let compSet;
let propsAdded;
let variantByKey = {};

if (_ccPhase === 2) {
  const pid = typeof __PHASE_1_COMP_SET_ID__ !== 'undefined' ? __PHASE_1_COMP_SET_ID__ : null;
  if (!pid) {
    throw new Error(
      '[create-component] phase 2 requires __PHASE_1_COMP_SET_ID__ (ComponentSet id from phase 1). ' +
        'See skills/create-component/EXECUTOR.md (inline two-phase draw).',
    );
  }
  const loaded = await figma.getNodeByIdAsync(pid);
  if (!loaded || loaded.type !== 'COMPONENT_SET') {
    throw new Error(
      `[create-component] phase 2: node '${pid}' is not a COMPONENT_SET (got ${loaded ? loaded.type : 'null'})`,
    );
  }
  compSet = loaded;
  if (
    typeof __CC_PHASE1_PROPS_ADDED__ === 'undefined' ||
    __CC_PHASE1_PROPS_ADDED__ === null ||
    typeof __CC_PHASE1_PROPS_ADDED__ !== 'object'
  ) {
    throw new Error(
      '[create-component] phase 2 requires __CC_PHASE1_PROPS_ADDED__ from phase 1 return payload',
    );
  }
  propsAdded = __CC_PHASE1_PROPS_ADDED__;
  for (const node of compSet.children) {
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }
// __CC_DOC_SLIM_OMIT_VARIANT_ELSE_BEGIN__
} else {
  const variantData = [];
  for (const v of CONFIG.variants) {
    for (const s of sizeList) {
      const st = CONFIG.style[v];
      if (!st) throw new Error(`CONFIG.style missing entry for variant '${v}'`);
      const name = s === null ? `variant=${v}` : `variant=${v}, size=${s}`;
      const label = typeof CONFIG.label === 'function'
        ? CONFIG.label(s, v)
        : (CONFIG.label ?? CONFIG.title);
      const padH  = (s !== null && CONFIG.padH?.[s]) || padFallback;
      const labelStyleName = (s !== null && CONFIG.labelStyle?.[s]) || labelStyleFallback;

      let built;
      switch (layoutKey) {
        case '__composes__':
          built = buildComposedVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, padV: 'space/xs',
          });
          break;
        case 'surface-stack':
          built = buildSurfaceStackVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH,
            sizeKey: s, propLabelText: defaultLabelText,
          });
          break;
        case 'field':
          built = buildFieldVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, sizeKey: s,
          });
          break;
        case 'row-item':
          built = buildRowItemVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, sizeKey: s,
          });
          break;
        case 'tiny':
          built = buildTinyVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, sizeKey: s,
          });
          break;
        case 'container':
          built = buildContainerVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, sizeKey: s,
          });
          break;
        case 'control':
          built = buildControlVariant(name, st.fill, st.fallback, {
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH, sizeKey: s,
          });
          break;
        case 'chip':
        default:
          if (layoutKey !== 'chip') {
            console.warn(`[create-component] Unknown CONFIG.layout='${layoutKey}' for '${CONFIG.component}' — falling back to 'chip'. See §6.0 routing table.`);
          }
          built = buildVariant(name, st.fill, st.fallback, {
            label,
            labelVar: st.labelVar, strokeVar: st.strokeVar, radiusVar, padH,
            labelStyleName,
            leadingSlot: leadingGlobal, trailingSlot: trailingGlobal, iconSlotSize,
            addLabelProp: !!cp.label,
            addLeadingProp:  !!cp.leadingIcon  && leadingGlobal,
            addTrailingProp: !!cp.trailingIcon && trailingGlobal,
            propLabelText: defaultLabelText,
          });
          break;
      }
      variantData.push(built);
    }
  }
  let cx = 0;
  for (const d of variantData) { d.component.x = cx; d.component.y = 0; cx += (d.component.width || 120) + 16; }

  compSet = figma.combineAsVariants(variantData.map(d => d.component), figma.currentPage);
  compSet.name = `${CONFIG.title} — ComponentSet`;

  propsAdded = (() => {
    const agg = {};
    for (const d of variantData) {
      for (const key of Object.keys(d.propKeys || {})) {
        agg[key] = true;
      }
    }
    agg.label        = agg.label        || false;
    agg.leadingIcon  = agg.leadingIcon  || false;
    agg.trailingIcon = agg.trailingIcon || false;
    return agg;
  })();

  for (const node of compSet.children) {
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }
}
// __CC_DOC_SLIM_OMIT_VARIANT_ELSE_END__

if (_ccPhase === 1) {
  return {
    ok: true,
    phase: 1,
    compSetId: compSet.id,
    compSetName: compSet.name,
    compSetKey: compSet.key,
    propsAdded,
    unresolvedTokenMisses: _unresolvedTokenMisses.slice(),
    layout: layoutKey === '__composes__' ? 'composes' : (CONFIG.layout || 'chip'),
  };
}

// __CREATE_COMPONENT_ENGINE_SPLIT_PHASE2__
// build-min-templates.mjs cuts here for the phase-2-only min bundle (doc pipeline
// tail). Phase 1 bundle omits everything below this line. See EXECUTOR.md §0.

// The ComponentSet is NOT parked off-canvas. It's reparented into the doc
// frame as its own section later (§6.5.5) so designers can see and edit
// the live variants in place, with all matrix instances updating from it.

// --- 6.3  _PageContent scaffold + doc frame root ------------------------
// _PageContent is the shared outer container used by EVERY style-guide and
// component page. Geometry matches /create-design-system CONVENTIONS §2:
// 1800 wide, 80 padding on all sides, 1640 inner, y=320 below _Header.

// Multistep doc pipeline (MCP): __CREATE_COMPONENT_DOC_STEP__ 1–5 runs one slice
// per `use_figma` call; omit it for single-pass doc tail (inline two-phase
// phase 2 or _ccPhase === 0). See conventions/09 + EXECUTOR.md.
// `build-min-templates.mjs` replaces the following two declarations with
// `const __ccDocStep = N` (N = 1..5) when emitting *.stepN.min.figma.js so esbuild
// drops unused doc-step branches and each MCP payload stays small.
const __ccDocStepDefault = null;
const __ccDocStep =
  typeof __CREATE_COMPONENT_DOC_STEP__ === 'number'
    ? __CREATE_COMPONENT_DOC_STEP__
    : __ccDocStepDefault;

let pageContent;
let docRoot;

async function __ccDocResumeFromHandoff() {
  const pcId =
    typeof __CC_HANDOFF_PAGE_CONTENT_ID__ !== 'undefined' ? __CC_HANDOFF_PAGE_CONTENT_ID__ : null;
  const drId =
    typeof __CC_HANDOFF_DOC_ROOT_ID__ !== 'undefined' ? __CC_HANDOFF_DOC_ROOT_ID__ : null;
  if (!pcId || !drId) {
    throw new Error(
      '[create-component] Multistep doc steps 2–5 require __CC_HANDOFF_PAGE_CONTENT_ID__ and ' +
        '__CC_HANDOFF_DOC_ROOT_ID__ from the prior step return payload. ' +
        'See conventions/09-mcp-multi-step-doc-pipeline.md.',
    );
  }
  const pc = await figma.getNodeByIdAsync(pcId);
  const dr = await figma.getNodeByIdAsync(drId);
  if (!pc || pc.type !== 'FRAME') {
    throw new Error(`[create-component] resume: _PageContent '${pcId}' missing or not a FRAME`);
  }
  if (!dr || dr.type !== 'FRAME') {
    throw new Error(`[create-component] resume: docRoot '${drId}' missing or not a FRAME`);
  }
  pageContent = pc;
  docRoot = dr;
  const pid =
    typeof __PHASE_1_COMP_SET_ID__ !== 'undefined'
      ? __PHASE_1_COMP_SET_ID__
      : typeof __CC_HANDOFF_COMP_SET_ID__ !== 'undefined'
        ? __CC_HANDOFF_COMP_SET_ID__
        : null;
  if (!pid) {
    throw new Error(
      '[create-component] resume: set __PHASE_1_COMP_SET_ID__ or __CC_HANDOFF_COMP_SET_ID__',
    );
  }
  const loaded = await figma.getNodeByIdAsync(pid);
  if (!loaded || loaded.type !== 'COMPONENT_SET') {
    throw new Error(
      `[create-component] resume: node '${pid}' is not a COMPONENT_SET (got ${loaded ? loaded.type : 'null'})`,
    );
  }
  compSet = loaded;
  if (
    typeof __CC_PHASE1_PROPS_ADDED__ === 'undefined' ||
    __CC_PHASE1_PROPS_ADDED__ === null ||
    typeof __CC_PHASE1_PROPS_ADDED__ !== 'object'
  ) {
    throw new Error('[create-component] resume: __CC_PHASE1_PROPS_ADDED__ object required');
  }
  propsAdded = __CC_PHASE1_PROPS_ADDED__;
  variantByKey = {};
  for (const node of compSet.children) {
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }
}

function __ccDocPageHeader() {
  pageContent = figma.createFrame();
  pageContent.name = '_PageContent';
  pageContent.layoutMode = 'VERTICAL';
  // resize FIRST so it doesn't reset the sizing modes we're about to set
  pageContent.resize(1800, 1);
  pageContent.primaryAxisSizingMode = 'AUTO';
  pageContent.counterAxisSizingMode = 'FIXED';
  pageContent.paddingTop    = 80;
  pageContent.paddingBottom = 80;
  pageContent.paddingLeft   = 80;
  pageContent.paddingRight  = 80;
  pageContent.itemSpacing   = 48;
  pageContent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  pageContent.x = 0;
  pageContent.y = 320;
  figma.currentPage.appendChild(pageContent);

  docRoot = figma.createFrame();
  docRoot.name = `doc/component/${CONFIG.component}`;
  docRoot.layoutMode = 'VERTICAL';
  docRoot.resize(DOC_FRAME_WIDTH, 1);
  docRoot.primaryAxisSizingMode = 'AUTO';
  docRoot.counterAxisSizingMode = 'FIXED';
  docRoot.layoutAlign = 'STRETCH';
  docRoot.itemSpacing = 48;
  docRoot.fills = [];
  pageContent.appendChild(docRoot);

  // --- 6.4  Header (title + summary) -------------------------------------

  const header = figma.createFrame();
  header.name = `doc/component/${CONFIG.component}/header`;
  header.layoutMode = 'VERTICAL';
  header.resize(DOC_FRAME_WIDTH, 1);
  header.primaryAxisSizingMode = 'AUTO';
  header.counterAxisSizingMode = 'FIXED';
  header.layoutAlign = 'STRETCH';
  header.itemSpacing = 12;
  header.fills = [];
  docRoot.appendChild(header);

  const title = makeText(CONFIG.title, 'section', 32);
  bindColor(title, 'color/background/content', '#0a0a0a', 'fills');
  header.appendChild(title);

  const summary = makeText(CONFIG.summary, 'caption', 14);
  bindColor(summary, 'color/background/content-muted', '#6b7280', 'fills');
  header.appendChild(summary);
}

// --- 6.5  makeFrame helper + hexToRgb -----------------------------------
// Centralized frame factory — every doc frame uses this. Prevents the
// common 10px-collapse bug by forcing AUTO height on VERTICAL AUTO frames.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function makeFrame(name, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.layoutMode ?? 'VERTICAL';
  // CRITICAL: resize() resets sizing modes to FIXED — call it BEFORE
  // setting primary/counter sizing modes, or AUTO will silently reset.
  if (o.width != null) f.resize(o.width, o.height ?? 1);
  f.primaryAxisSizingMode = o.primary ?? 'AUTO';
  f.counterAxisSizingMode = o.counter ?? 'FIXED';
  f.paddingTop    = o.padT ?? 0;
  f.paddingRight  = o.padR ?? 0;
  f.paddingBottom = o.padB ?? 0;
  f.paddingLeft   = o.padL ?? 0;
  f.itemSpacing   = o.itemSpacing ?? 0;
  if (o.align)        f.layoutAlign           = o.align;
  if (o.primaryAlign) f.primaryAxisAlignItems = o.primaryAlign;
  if (o.counterAlign) f.counterAxisAlignItems = o.counterAlign;
  if (o.fillVar)      bindColor(f, o.fillVar, o.fillHex ?? '#ffffff', 'fills');
  else if (o.fillHex) f.fills = [{ type: 'SOLID', color: hexToRgb(o.fillHex) }];
  else                f.fills = [];
  if (o.strokeVar) {
    bindColor(f, o.strokeVar, '#e5e7eb', 'strokes');
    f.strokeWeight = o.strokeWeight ?? 1;
    if (o.dashed)      f.dashPattern = [6, 4];
    if (o.strokeSides) {
      f.strokeTopWeight    = o.strokeSides.top    ?? 0;
      f.strokeRightWeight  = o.strokeSides.right  ?? 0;
      f.strokeBottomWeight = o.strokeSides.bottom ?? 0;
      f.strokeLeftWeight   = o.strokeSides.left   ?? 0;
    }
  } else {
    f.strokes = [];
  }
  if (o.radius != null) f.cornerRadius = o.radius;
  if (o.minHeight != null) f.minHeight = o.minHeight;
  return f;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 DOC PIPELINE CONTRACT — §§6.6 – 6.8 ARE ARCHETYPE-AGNOSTIC
// ═══════════════════════════════════════════════════════════════════════════
// The next three functions — `buildPropertiesTable`, `buildMatrix`, and
// `buildUsageNotes` — render the STANDARD doc frame that wraps EVERY
// component in this design system, regardless of its `CONFIG.layout`
// archetype (`chip`, `surface-stack`, `field`, `row-item`, `tiny`,
// `container`, `control`). They rely on only two inputs from §§6.2–6.2a:
//
//   (1) `compSet`          — the Figma ComponentSet produced by
//                            `figma.combineAsVariants(...)`
//   (2) `variantByKey[key]` — a lookup map of variant masters keyed by
//                            `${variant}` or `${variant}|${size}`.
//
// That is the ENTIRE interface. The doc pipeline does NOT care whether a
// variant is a button, a card, an input, or a dropdown-menu-item. It does
// NOT peek at children. It does NOT read archetype-specific config.
//
//   🚫 DO NOT FORK THIS PIPELINE PER ARCHETYPE.
//   🚫 DO NOT INLINE A "SIMPLER" TABLE RENDERER IN A BUILDER.
//   🚫 DO NOT RENAME THE COLUMN HEADERS (they are uppercase, by design —
//      `PROPERTY`, `TYPE`, `DEFAULT`, `REQUIRED`, `DESCRIPTION`).
//   🚫 DO NOT INSERT A "Size variants" OR "ComponentSet" SECTION OF YOUR
//      OWN — §6.6B draws the single canonical ComponentSet tile, and §6.7
//      draws the matrix that implicitly covers every size.
//   🚫 DO NOT SHRINK THE TABLE BELOW 1640px — it always spans the full
//      DOC_FRAME_WIDTH so column proportions stay consistent file-wide.
//
// The Button page (see the v60 Foundations file, node 388:95) is the
// canonical reference output. If an archetype renders differently from
// Button's doc frame in structure (title → summary → Properties table →
// ComponentSet → Variants × States → Do / Don't), the pipeline was forked
// and must be restored to these three helpers.
// ═══════════════════════════════════════════════════════════════════════════

// --- 6.6  Properties + Types table (conventions/04-doc-pipeline-contract.md §4) ------------------
// Cols sum to 1640: PROPERTY 240 · TYPE 380 · DEFAULT 160 · REQUIRED 120 · DESCRIPTION 740

function buildPropertiesTable(rows) {
  const COLS = [
    { header: 'PROPERTY',    width: 240, style: 'tokenName' },
    { header: 'TYPE',        width: 380, style: 'code'      },
    { header: 'DEFAULT',     width: 160, style: 'code'      },
    { header: 'REQUIRED',    width: 120, style: 'code'      },
    { header: 'DESCRIPTION', width: 740, style: 'caption'   },
  ];

  const group = makeFrame(`doc/table-group/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Properties', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const table = makeFrame(`doc/table/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillVar: 'color/background/default', fillHex: '#ffffff',
    strokeVar: 'color/border/subtle',    strokeWeight: 1, radius: 16,
  });
  table.clipsContent = true;
  group.appendChild(table);

  // Header row
  const headerRow = makeFrame('header', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 56, counterAlign: 'CENTER',
    fillVar: 'color/background/variant', fillHex: '#f4f4f5',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  table.appendChild(headerRow);
  for (const col of COLS) {
    const cell = makeFrame(`header/${col.header.toLowerCase()}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: col.width, height: 56, padL: 20, padR: 20, counterAlign: 'CENTER',
    });
    headerRow.appendChild(cell);
    const t = makeText(col.header, 'code', 12, 'color/background/content-muted');
    t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
    cell.appendChild(t);
  }

  // Body rows
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isLast = i === rows.length - 1;
    const row = makeFrame(`row/${r[0]}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
      width: 1640, align: 'STRETCH', padT: 16, padB: 16,
      counterAlign: 'CENTER',
      strokeVar: isLast ? null : 'color/border/subtle',
      strokeWeight: isLast ? 0 : 1,
      strokeSides: isLast ? undefined : { bottom: 1 },
    });
    row.minHeight = 64;
    table.appendChild(row);

    for (let j = 0; j < COLS.length; j++) {
      const col = COLS[j];
      const cell = makeFrame(`cell/${col.header.toLowerCase()}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: col.width, padL: 20, padR: 20, padT: 4, padB: 4,
        primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(cell);
      const fillVar = (j === 3 || j === 4) ? 'color/background/content-muted' : 'color/background/content';
      const t = makeText(r[j], col.style, 13, fillVar);
      t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
      cell.appendChild(t);
    }
  }
  return group;
}

function __ccDocAppendProperties() {
  docRoot.appendChild(buildPropertiesTable(CONFIG.properties));
}

// --- 6.6B  Component Set section — the LIVE, editable ComponentSet ------
// Designers need the raw ComponentSet somewhere visible inside the doc
// layout — not parked off-canvas, not crammed above the header. It gets
// its own 1640-wide section between the Properties table and the Matrix:
//
//   doc/component/{name}/component-set
//   ├── title     "Component"
//   ├── caption   "Live ComponentSet — edit here, matrix instances update."
//   └── [ComponentSetNode — horizontal wrap grid of every variant]
//
// The ComponentSet itself is reparented (not copied) so Figma still
// recognizes it as the canonical source for Code Connect + the Assets
// panel. Every cell in the matrix below is an instance of a child of
// this ComponentSet, so a single edit here propagates everywhere.

function buildComponentSetSection() {
  const section = makeFrame(`doc/component/${CONFIG.component}/component-set-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: DOC_FRAME_WIDTH,
    itemSpacing: 12, align: 'STRETCH',
  });

  const stitle = makeText('Component', 'section', 24, 'color/background/content');
  stitle.resize(DOC_FRAME_WIDTH, 1); stitle.textAutoResize = 'HEIGHT';
  section.appendChild(stitle);

  const scap = makeText(
    'Live ComponentSet — this is the source of truth. Edit any variant here and every instance in the matrix below updates automatically.',
    'caption', 13, 'color/background/content-muted',
  );
  scap.resize(DOC_FRAME_WIDTH, 1); scap.textAutoResize = 'HEIGHT';
  section.appendChild(scap);

  // Configure the ComponentSet itself as a horizontal-WRAP auto-layout
  // grid so every variant is visible at a glance and the group
  // re-flows as variants are added/removed.
  //
  // CRITICAL order (same gotcha as every other frame):
  //   1. layoutMode / layoutWrap
  //   2. resize(w, 1)                (silently resets sizing modes)
  //   3. primaryAxisSizingMode / counterAxisSizingMode   ← must be AFTER resize
  compSet.layoutMode  = 'HORIZONTAL';
  compSet.layoutWrap  = 'WRAP';
  compSet.resize(DOC_FRAME_WIDTH, 1);
  compSet.primaryAxisSizingMode = 'FIXED';        // fixed width triggers wrap
  compSet.counterAxisSizingMode = 'AUTO';          // grows vertically with rows
  compSet.paddingTop    = 32;
  compSet.paddingBottom = 32;
  compSet.paddingLeft   = 32;
  compSet.paddingRight  = 32;
  compSet.itemSpacing        = 24;                 // gap between variants in a row
  compSet.counterAxisSpacing = 24;                 // gap between wrapped rows
  compSet.primaryAxisAlignItems = 'MIN';
  compSet.counterAxisAlignItems = 'CENTER';
  compSet.layoutAlign = 'STRETCH';
  bindColor(compSet, 'color/background/variant', '#fafafa', 'fills');
  bindColor(compSet, 'color/border/subtle',      '#e5e7eb', 'strokes');
  compSet.strokeWeight = 1;
  compSet.dashPattern  = [6, 4];
  compSet.cornerRadius = 16;

  // Reparent from figma.currentPage into this section (preserves node identity)
  section.appendChild(compSet);
  return section;
}

function __ccDocAppendComponentSection() {
  docRoot.appendChild(buildComponentSetSection());
}

// --- 6.7  Variant × State matrix (conventions/04-doc-pipeline-contract.md §5) --------------------
// Rows = variants, Columns = states, vertically stacked by size.
// Reads CONFIG.variants, CONFIG.sizes, CONFIG.states, CONFIG.applyStateOverride.

function buildMatrix() {
  const variants       = CONFIG.variants;
  const sizes          = CONFIG.sizes ?? [];
  const states         = CONFIG.states;
  const hasSizeAxis    = sizes.length > 0;
  const gutterSizeW    = hasSizeAxis ? GUTTER_W_SIZE : 0;
  const gutterVariantW = GUTTER_W_VARIANT;
  const gutter         = gutterSizeW + gutterVariantW;
  const cellW          = Math.floor((DOC_FRAME_WIDTH - gutter) / states.length);
  const defaultStates  = states.filter(s => s.group === 'default');
  const disabledStates = states.filter(s => s.group === 'disabled');

  const group = makeFrame(`doc/component/${CONFIG.component}/matrix-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Variants × States', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const matrix = makeFrame(`doc/component/${CONFIG.component}/matrix`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillHex: '#ffffff',
    strokeVar: 'color/border/subtle', strokeWeight: 1, dashed: true, radius: 16,
  });
  group.appendChild(matrix);

  // Header-groups row (DEFAULT | DISABLED)
  if (disabledStates.length > 0) {
    const hg = makeFrame('matrix/header-groups', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: 1640, height: 44, counterAlign: 'CENTER',
      strokeVar: 'color/border/subtle', strokeWeight: 1,
      strokeSides: { bottom: 1 },
    });
    matrix.appendChild(hg);
    hg.appendChild(makeFrame('gutter', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: gutter, height: 44,
    }));
    const dc = makeFrame('cell/default-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * defaultStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(dc);
    dc.appendChild(makeText('DEFAULT', 'code', 12, 'color/background/content-muted'));
    const uc = makeFrame('cell/disabled-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * disabledStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(uc);
    uc.appendChild(makeText('DISABLED', 'code', 12, 'color/background/content-muted'));
  }

  // State-labels row
  const hs = makeFrame('matrix/header-states', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 40, counterAlign: 'CENTER',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  matrix.appendChild(hs);
  hs.appendChild(makeFrame('gutter', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: gutter, height: 40,
  }));
  for (const st of states) {
    const cell = makeFrame(`cell/${st.key}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW, height: 40, primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hs.appendChild(cell);
    cell.appendChild(makeText(st.key, 'caption', 12, 'color/background/content-muted'));
  }

  // Size groups
  const groupList = hasSizeAxis ? sizes : [null];
  for (let si = 0; si < groupList.length; si++) {
    const size = groupList[si];
    const sg = makeFrame(`matrix/size-group/${size ?? 'single'}`, {
      layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    matrix.appendChild(sg);

    if (hasSizeAxis) {
      const sLabel = makeFrame(`size-label/${size}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: gutterSizeW, primaryAlign: 'CENTER', counterAlign: 'CENTER',
        strokeVar: 'color/border/subtle', strokeWeight: 1,
        strokeSides: { right: 1 },
      });
      sg.appendChild(sLabel);
      sLabel.appendChild(makeText(size, 'tokenName', 14, 'color/background/content'));
    }

    const rowsStack = makeFrame('variant-rows', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    sg.appendChild(rowsStack);

    for (let vi = 0; vi < variants.length; vi++) {
      const variant = variants[vi];
      const isLastVariantRow = (si === groupList.length - 1) && (vi === variants.length - 1);
      const row = makeFrame(`row/${variant}`, {
        layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
        counterAlign: 'CENTER',
        strokeVar: isLastVariantRow ? null : 'color/border/subtle',
        strokeWeight: isLastVariantRow ? 0 : 1,
        strokeSides: isLastVariantRow ? undefined : { bottom: 1 },
      });
      row.minHeight = 72;
      rowsStack.appendChild(row);

      const vLabel = makeFrame(`row/${variant}/label`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: gutterVariantW, minHeight: 72,
        padL: 20, padR: 20, primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(vLabel);
      vLabel.layoutAlign = 'STRETCH';
      const prettyVariant = variant.charAt(0).toUpperCase() + variant.slice(1);
      vLabel.appendChild(makeText(prettyVariant, 'caption', 13, 'color/background/content-muted'));

      for (const st of states) {
        const cell = makeFrame(`cell/${variant}/${st.key}`, {
          layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
          width: cellW, minHeight: 72,
          padL: 16, padR: 16, padT: 16, padB: 16,
          primaryAlign: 'CENTER', counterAlign: 'CENTER',
        });
        row.appendChild(cell);
        const key = hasSizeAxis ? `${variant}|${size}` : variant;
        const componentNode = variantByKey[key];
        if (componentNode) {
          const instance = componentNode.createInstance();
          if (typeof CONFIG.applyStateOverride === 'function') {
            CONFIG.applyStateOverride(instance, st.key, { variant, size, componentNode });
          }
          cell.appendChild(instance);
        }
      }
    }
  }
  return group;
}

function __ccDocAppendMatrix() {
  docRoot.appendChild(buildMatrix());
}

// --- 6.8  Usage notes — Do / Don't cards (conventions/04-doc-pipeline-contract.md §6) ------------
// Reads CONFIG.usageDo and CONFIG.usageDont.

function buildUsageNotes() {
  const row = makeFrame(`doc/component/${CONFIG.component}/usage`, {
    layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', width: 1640,
    itemSpacing: 30, align: 'STRETCH',
  });
  row.layoutSizingHorizontal = 'FIXED';
  row.layoutSizingVertical = 'HUG';
  function card(titleText, glyph, bullets) {
    const c = makeFrame(`usage/${titleText.toLowerCase().replace(/[^a-z]/g, '')}`, {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805,
      padL: 28, padR: 28, padT: 28, padB: 28, itemSpacing: 16,
      fillVar: 'color/background/variant', fillHex: '#f4f4f5', radius: 16,
    });
    c.appendChild(makeText(`${glyph}  ${titleText}`, 'tokenName', 18, 'color/background/content'));
    const list = makeFrame('bullets', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805 - 56,
      itemSpacing: 12, align: 'STRETCH',
    });
    c.appendChild(list);
    for (const b of bullets) {
      const bt = makeText(`·  ${b}`, 'caption', 13, 'color/background/content');
      bt.resize(805 - 56, 1); bt.textAutoResize = 'HEIGHT';
      list.appendChild(bt);
    }
    return c;
  }
  row.appendChild(card('Do',    '✓', CONFIG.usageDo));
  row.appendChild(card("Don't", '✕', CONFIG.usageDont));
  return row;
}

function __ccDocAppendUsage() {
  docRoot.appendChild(buildUsageNotes());
}

function __ccDocHandoffAfter(step) {
  return {
    ok: true,
    docStep: step,
    pageContentId: pageContent.id,
    docRootId: docRoot.id,
    compSetId: compSet.id,
    compSetName: compSet.name,
    compSetKey: compSet.key,
    propsAdded,
    unresolvedTokenMisses: _unresolvedTokenMisses.slice(),
    layout: layoutKey === '__composes__' ? 'composes' : (CONFIG.layout || 'chip'),
  };
}

// --- 6.9  Self-validate + reveal ---------------------------------------

function __ccDocFinalizeAndReturn() {
  if (docRoot.children.length < 5) {
    throw new Error(`Matrix draw incomplete: docRoot has ${docRoot.children.length} children, expected 5 (header, properties, component-set, matrix, usage).`);
  }
  if (docRoot.children.length > 5) {
  // A builder forked the doc pipeline and added extra sections (e.g. a
  // bespoke "Size variants" strip). Only §§6.4 / 6.6 / 6.6B / 6.7 / 6.8
  // are allowed to append direct children to docRoot.
  const extraNames = docRoot.children.slice(5).map(n => n.name).join(', ');
    throw new Error(`Doc pipeline was forked: docRoot has ${docRoot.children.length} children (expected exactly 5). Extra frames: ${extraNames}. Remove bespoke doc rendering from your archetype builder — §§6.6–6.8 are archetype-agnostic.`);
  }
  if (pageContent.height < 500) {
    throw new Error(`_PageContent collapsed to height ${pageContent.height}. Likely a text node is missing textAutoResize = 'HEIGHT'.`);
  }

// --- 6.9a  Doc-pipeline integrity checks -------------------------------
// Detect the Card-regression signature: mixed-case table headers,
// narrowed table, or a rogue "Size variants" section. These all indicate
// a builder forked the canonical doc pipeline defined in §§6.6–6.8.
{
  const propsTable = docRoot.findOne(n => n.name === `doc/table/${CONFIG.component}/properties`);
  if (!propsTable) {
    throw new Error(`Properties table not found. §6.6 (buildPropertiesTable) did not run — do not replace it with a bespoke renderer.`);
  }
  if (Math.round(propsTable.width) !== 1640) {
    throw new Error(`Properties table is ${Math.round(propsTable.width)}px wide (expected 1640). Someone shrank the table — restore buildPropertiesTable from §6.6 verbatim.`);
  }
  const propsHeader = propsTable.children[0];
  const firstHeaderText = propsHeader?.findOne(n => n.type === 'TEXT');
  if (!firstHeaderText || firstHeaderText.characters !== 'PROPERTY') {
    throw new Error(`Properties table header is '${firstHeaderText?.characters ?? '(none)'}' (expected 'PROPERTY'). Canonical casing is UPPERCASE — do not rename columns to 'Name'/'Type'/etc.`);
  }
  // Scan direct docRoot children for off-spec headings.
  const forbiddenHeadings = ['Size variants', 'Size Variants'];
  for (const child of docRoot.children) {
    const heading = child.findOne?.(n => n.type === 'TEXT');
    const text = heading?.characters ?? '';
    if (forbiddenHeadings.includes(text)) {
      throw new Error(`Found forbidden section heading '${text}' inside docRoot. The canonical doc frame has exactly five sections (header, Properties, Component, Variants × States, Do / Don't). Size-level differences are covered by the matrix in §6.7 — do not add a separate "Size variants" strip.`);
    }
  }
}
// Sanity-check that the ComponentSet ended up inside the doc frame and not
// orphaned on the page — prior versions of this script parked it at y=-2000.
if (!compSet.parent || compSet.parent === figma.currentPage) {
  throw new Error('ComponentSet was not reparented into the doc frame. §6.6B did not run.');
}
// If iconSlots were requested, every variant must contain the named slot
// frames — otherwise designers won't have the drop targets they expect.
// Composed variants use `slot/*` instance stacks instead — skip this check.
{
  const needLeading  = !usesComposes && !!CONFIG.iconSlots?.leading;
  const needTrailing = !usesComposes && !!CONFIG.iconSlots?.trailing;
  if (needLeading || needTrailing) {
    for (const variant of compSet.children) {
      const hasLabelChild   = variant.children.some(n => n.type === 'TEXT');
      const hasCenter       = !!variant.findOne(n => n.name === 'icon-slot/center');
      // Variants without a label are icon-only → must have center slot.
      if (!hasLabelChild && !hasCenter) {
        throw new Error(`Variant '${variant.name}' has neither a label nor an icon-slot/center frame.`);
      }
      if (hasLabelChild) {
        if (needLeading && !variant.findOne(n => n.name === 'icon-slot/leading')) {
          throw new Error(`Variant '${variant.name}' is missing icon-slot/leading.`);
        }
        if (needTrailing && !variant.findOne(n => n.name === 'icon-slot/trailing')) {
          throw new Error(`Variant '${variant.name}' is missing icon-slot/trailing.`);
        }
      }
    }
  }
}

if (usesComposes) {
  const v0 = compSet.children[0];
  if (!v0) throw new Error('ComponentSet has no variants after compose draw.');
  const slotFrame = v0.children.find(n => n.type === 'FRAME' && String(n.name).startsWith('slot/'));
  if (!slotFrame) {
    throw new Error(`Composed variant '${v0.name}' is missing a slot/* frame.`);
  }
  const instCount = slotFrame.findAll(n => n.type === 'INSTANCE').length;
  if (instCount < 1) {
    throw new Error(`Composed variant '${v0.name}' has no INSTANCE children under ${slotFrame.name}.`);
  }
}

figma.viewport.scrollAndZoomIntoView([pageContent]);

const firstVariant = compSet.children[0];
const firstVariantChildren = firstVariant ? firstVariant.children.map(n => n.name) : [];
const iconOnlySize = (CONFIG.sizes || []).find(sz => {
  const lab = typeof CONFIG.label === 'function' ? CONFIG.label(sz, CONFIG.variants[0]) : CONFIG.label;
  return !lab;
});
let iconVariantChildren = [];
if (iconOnlySize != null) {
  const key = hasSizeAxis ? `${CONFIG.variants[0]}|${iconOnlySize}` : CONFIG.variants[0];
  const vn = variantByKey[key];
  if (vn) iconVariantChildren = vn.children.map(n => n.name);
}

function simpleCvaHash() {
  try {
    return JSON.stringify({ v: CONFIG.variants, s: CONFIG.sizes, st: CONFIG.style });
  } catch (_) {
    return null;
  }
}

const nowIso = new Date().toISOString();
const prevReg = REGISTRY_COMPONENTS[CONFIG.component];
const nextVersion = prevReg && typeof prevReg.version === 'number' ? prevReg.version + 1 : 1;

// ── §6.9a.1 Aggregate unresolved-token misses for the return payload ────
//
// Bucket each `(kind, path)` combination, cap the sample list at 20 entries
// so the payload stays small, and record the top N most-frequent misses.
// Agent in the `use_figma` caller can assert `unresolvedTokenPaths.total === 0`
// as a post-draw gate. A non-zero total means CONFIG is referencing paths
// that don't exist in this Figma file's Theme/Layout/Typography collections —
// fix CONFIG and redraw (see SKILL.md §4.7 Pre-flight token verification).
const _unresolvedAggregated = (() => {
  const byPathKind = new Map();
  for (const m of _unresolvedTokenMisses) {
    const key = m.kind + '|' + m.path;
    if (!byPathKind.has(key)) {
      byPathKind.set(key, {
        kind: m.kind,
        path: m.path,
        count: 0,
        fallbackSample: m.fallback,
        firstNodeName: m.nodeName,
      });
    }
    byPathKind.get(key).count++;
  }
  const rows = Array.from(byPathKind.values());
  rows.sort((a, b) => b.count - a.count);
  return {
    total: _unresolvedTokenMisses.length,
    uniquePaths: rows.length,
    collectionsPresent: {
      Theme: !!themeCol,
      Layout: !!layoutCol,
      Typography: !!typoCol,
    },
    topMisses: rows.slice(0, 20),
    samples: _unresolvedTokenMisses.slice(0, 20),
  };
})();

const returnPayload = {
  pageName: CONFIG.pageName,
  docRootChildren: docRoot.children.length,
  compSetName: compSet.name,
  compSetId: compSet.id,
  compSetKey: compSet.key,
  compSetVariants: compSet.children.map(c => c.name),
  compSetParent: compSet.parent ? compSet.parent.name : '',
  compSetPropertyDefinitions: compSet.componentPropertyDefinitions,
  firstVariantChildren,
  iconVariantChildren,
  propErrorsCount: 0,
  propErrorsSample: [],
  iconSlotMode: ICON_SLOT_MODE,                      // 'instance-swap' | 'placeholder'
  iconPackResolution: DEFAULT_ICON_RESOLUTION,       // 'by-key' | 'by-node-id' | 'by-node-id-variant' | 'none' | 'failed:*'
  iconPackDefaultKey: DEFAULT_ICON_COMPONENT ? (DEFAULT_ICON_COMPONENT.key || null) : null,
  iconPackDefaultNodeId: DEFAULT_ICON_COMPONENT ? (DEFAULT_ICON_COMPONENT.id || null) : null,
  fileKeyMismatch: _fileKeyMismatch ? { expected: ACTIVE_FILE_KEY, observed: _fileKeyObserved } : null,
  // Agent post-draw gate: assert `unresolvedTokenPaths.total === 0`. Any
  // non-zero means at least one CONFIG token path silently fell back to
  // a hex/numeric default — probably a typo or a stale path from a prior
  // design-system version. See conventions/07-token-paths.md.
  unresolvedTokenPaths: _unresolvedAggregated,
  layout: layoutKey === '__composes__' ? 'composes' : (CONFIG.layout || 'chip'),
  propsAdded,
  composedWith: usesComposes ? CONFIG.composes.map(r => r.component) : [],
  registryEntry: (() => {
    const base = {
      component: CONFIG.component,
      nodeId: compSet.id,
      key: compSet.key,
      pageName: CONFIG.pageName,
      publishedAt: nowIso,
      version: nextVersion,
      cvaHash: CONFIG._source === 'shadcn-1:1' ? simpleCvaHash() : null,
    };
    if (usesComposes) {
      const composedChildVersions = {};
      for (const spec of CONFIG.composes) {
        const cr = REGISTRY_COMPONENTS[spec.component];
        composedChildVersions[spec.component] = cr && typeof cr.version === 'number' ? cr.version : null;
      }
      base.composedChildVersions = composedChildVersions;
    }
    return base;
  })(),
};

{
  const vN = CONFIG.variants.length;
  const sN = CONFIG.states.length;
  const zN = Math.max((CONFIG.sizes ?? []).length, 1);
  const props = Object.keys(propsAdded).filter(k => propsAdded[k]);
  console.log(
    `${CONFIG.component} drawn: ${vN}v × ${sN}s × ${zN}sz = ${vN * sN * zN} matrix cells; ` +
    `ComponentSet lives inline in doc frame; ` +
    `element props: ${props.length ? props.join(', ') : '(none)'}; ` +
    `composed: ${usesComposes ? returnPayload.composedWith.join('+') : '—'}.`,
  );
  if (_unresolvedAggregated.total > 0) {
    console.warn(
      `[create-component] ${CONFIG.component}: ${_unresolvedAggregated.total} unresolved token ` +
      `binding(s) across ${_unresolvedAggregated.uniquePaths} unique path(s). ` +
      `First miss: kind='${_unresolvedAggregated.topMisses[0].kind}' path='${_unresolvedAggregated.topMisses[0].path}' ` +
      `(x${_unresolvedAggregated.topMisses[0].count}). ` +
      `All paths silently fell back to hex/numeric defaults — see returnPayload.unresolvedTokenPaths ` +
      `and conventions/07-token-paths.md for recovery.`,
    );
  }
}

  return returnPayload;
}

async function __ccDocDispatch() {
  if (__ccDocStep === null) {
    __ccDocPageHeader();
    __ccDocAppendProperties();
    __ccDocAppendComponentSection();
    __ccDocAppendMatrix();
    __ccDocAppendUsage();
    return __ccDocFinalizeAndReturn();
  }
  if (__ccDocStep === 1) {
    __ccDocPageHeader();
    __ccDocAppendProperties();
    return __ccDocHandoffAfter(1);
  }
  if (__ccDocStep === 2) {
    await __ccDocResumeFromHandoff();
    __ccDocAppendComponentSection();
    return __ccDocHandoffAfter(2);
  }
  if (__ccDocStep === 3) {
    await __ccDocResumeFromHandoff();
    __ccDocAppendMatrix();
    return __ccDocHandoffAfter(3);
  }
  if (__ccDocStep === 4) {
    await __ccDocResumeFromHandoff();
    __ccDocAppendUsage();
    return __ccDocHandoffAfter(4);
  }
  if (__ccDocStep === 5) {
    await __ccDocResumeFromHandoff();
    return __ccDocFinalizeAndReturn();
  }
  throw new Error(
    `[create-component] __CREATE_COMPONENT_DOC_STEP__ must be 1–5 or omitted; got ${__ccDocStep}`,
  );
}

return await __ccDocDispatch();
