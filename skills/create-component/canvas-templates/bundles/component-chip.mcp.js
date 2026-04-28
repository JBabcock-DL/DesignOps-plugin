const CONFIG = ctx;
const ACTIVE_FILE_KEY = typeof ctx.activeFileKey === 'string' ? ctx.activeFileKey : (typeof ctx.fileKey === 'string' ? ctx.fileKey : '');
const REGISTRY_COMPONENTS = ctx.registryComponents || {};
const usesComposes = !!ctx.usesComposes;
let pageContent;
let docRoot;
let compSet = null;
let variantBuildHolder = null;
let variantByKey = {};
let propsAdded;
const __ccPropAddErrors = [];
const hasSizeAxis = !!(CONFIG.sizes && CONFIG.sizes.length > 0);

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
    const msg = err && err.message ? err.message : String(err);
    __ccPropAddErrors.push({ variant: name, message: msg });
    console.warn(`addComponentProperty failed on variant '${name}':`, msg);
  }

  // Append to current page before any combining
  figma.currentPage.appendChild(c);
  return { component: c, slots, propKeys };
}

// Chip-only variant plane — extracted from draw-engine.figma.js §6.2a default branch.
// `hasSizeAxis`, `compSet`, `variantBuildHolder`, `variantByKey` come from the bundle preamble.

const sizeList = hasSizeAxis ? CONFIG.sizes : [null];
const padFallback = CONFIG.padH?.default ?? 'space/md';
const radiusVar = CONFIG.radius ?? 'radius/md';

const labelStyleFallback = CONFIG.labelStyle?.default ?? null;
const iconSlots = CONFIG.iconSlots || {};
const iconSlotSize = iconSlots.size ?? 24;
const leadingGlobal = !!iconSlots.leading;
const trailingGlobal = !!iconSlots.trailing;
const cp = CONFIG.componentProps || {};

const defaultLabelText = (() => {
  if (typeof CONFIG.label !== 'function') return String(CONFIG.label ?? CONFIG.title ?? 'Label');
  for (const s of sizeList) {
    const l = CONFIG.label(s, CONFIG.variants[0]);
    if (l) return String(l);
  }
  return String(CONFIG.title ?? 'Label');
})();

const variantData = [];
for (const v of CONFIG.variants) {
  for (const s of sizeList) {
    const st = CONFIG.style[v];
    if (!st) throw new Error(`CONFIG.style missing entry for variant '${v}'`);
    const name = s === null ? `variant=${v}` : `variant=${v}, size=${s}`;
    const label = typeof CONFIG.label === 'function' ? CONFIG.label(s, v) : (CONFIG.label ?? CONFIG.title);
    const padH = (s !== null && CONFIG.padH?.[s]) || padFallback;
    const labelStyleName = (s !== null && CONFIG.labelStyle?.[s]) || labelStyleFallback;
    const built = buildVariant(name, st.fill, st.fallback, {
      label,
      labelVar: st.labelVar,
      strokeVar: st.strokeVar,
      radiusVar,
      padH,
      labelStyleName,
      leadingSlot: leadingGlobal,
      trailingSlot: trailingGlobal,
      iconSlotSize,
      addLabelProp: !!cp.label,
      addLeadingProp: !!cp.leadingIcon && leadingGlobal,
      addTrailingProp: !!cp.trailingIcon && trailingGlobal,
      propLabelText: defaultLabelText,
    });
    variantData.push(built);
  }
}
variantBuildHolder = figma.createFrame();
variantBuildHolder.name = `_ccVariantBuild/${CONFIG.component}`;
figma.currentPage.appendChild(variantBuildHolder);
variantBuildHolder.visible = false;
let cx = 0;
for (const d of variantData) {
  d.component.x = cx;
  d.component.y = 0;
  variantBuildHolder.appendChild(d.component);
  cx += (d.component.width || 120) + 16;
}
compSet = null;

propsAdded = (() => {
  const agg = {};
  for (const d of variantData) {
    for (const key of Object.keys(d.propKeys || {})) {
      agg[key] = true;
    }
  }
  agg.label = agg.label || false;
  agg.leadingIcon = agg.leadingIcon || false;
  agg.trailingIcon = agg.trailingIcon || false;
  return agg;
})();

variantByKey = {};
for (const node of variantBuildHolder.children) {
  if (node.type !== 'COMPONENT') continue;
  const parts = node.name.split(', ').reduce((acc, kv) => {
    const [k, val] = kv.split('=');
    acc[k] = val;
    return acc;
  }, {});
  const vk = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
  variantByKey[vk] = node;
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


const DOC_FRAME_WIDTH = 1640;
const GUTTER_W_SIZE = 60;
const GUTTER_W_VARIANT = 160;

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

// Placeholder body for multistep step 1 — same row count and geometry as production (§2.2.1 Path B in 04).
function __ccPlaceholderPropertyRows() {
  const n = (CONFIG.properties && CONFIG.properties.length) || 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push([`placeholder-${i}`, '…', '…', '…', '…']);
  }
  return rows;
}

// Multistep doc step 1 only — visible dashed frames reserve vertical space for
// §6.6B / §6.7 / §6.8 until slices 3–5 replace them in place (same child index).
// Without these, designers only see header + Properties while later slices are
// pending; ComponentSet can also sit orphaned on the page if a run aborts early.
function __ccScaffoldPlaceholderFrame(slug, caption) {
  const f = makeFrame(`doc/scaffold-placeholder/${CONFIG.component}/${slug}`, {
    layoutMode: 'VERTICAL',
    primary: 'AUTO',
    counter: 'FIXED',
    width: DOC_FRAME_WIDTH,
    minHeight: slug === 'component-set' ? 140 : slug === 'matrix' ? 220 : 180,
    padL: 24,
    padR: 24,
    padT: 20,
    padB: 20,
    itemSpacing: 8,
    align: 'STRETCH',
    strokeVar: 'color/border/subtle',
    strokeWeight: 1,
    dashed: true,
    radius: 12,
  });
  const t = makeText(caption, 'caption', 13, 'color/background/content-muted');
  t.resize(DOC_FRAME_WIDTH - 48, 1);
  t.textAutoResize = 'HEIGHT';
  f.appendChild(t);
  return f;
}

function __ccDocAppendScaffoldPlaceholders() {
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'component-set',
    'Scaffold — Component (filled when cc-doc-component runs, doc step 2)',
  ));
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'matrix',
    'Scaffold — Variants × States matrix (slice 4)',
  ));
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'usage',
    'Scaffold — Do / Don\u2019t usage (slice 5)',
  ));
}

/** Replace a step-1 dashed placeholder if present; otherwise append (single-pass doc). */
async function __ccDocInsertOrReplaceSection(scaffoldSlug, buildSection) {
  const phName = `doc/scaffold-placeholder/${CONFIG.component}/${scaffoldSlug}`;
  const ph = docRoot.findOne(n => n.type === 'FRAME' && n.name === phName);
  const section = await buildSection();
  if (ph) {
    const idx = ph.parent.children.indexOf(ph);
    ph.remove();
    docRoot.insertChild(idx, section);
  } else {
    docRoot.appendChild(section);
  }
}


async function buildComponentSetSection() {
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

  const holder = variantBuildHolder;
  if (!holder || !holder.parent) {
    throw new Error('[create-component] §6.6B: variant holder missing — run the component MCP slice after variants are built');
  }
  const comps = holder.children.filter(n => n.type === 'COMPONENT');
  if (!comps.length) {
    throw new Error('[create-component] §6.6B: variant holder has no COMPONENT children');
  }
  compSet = figma.combineAsVariants(comps, section);
  compSet.name = `${CONFIG.title} — ComponentSet`;
  holder.remove();
  variantBuildHolder = null;

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

  return section;
}

async function __ccDocAppendComponentSection() {
  await __ccDocInsertOrReplaceSection('component-set', buildComponentSetSection);
}


docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'component',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
await __ccDocAppendComponentSection();

function __ccNodePathUpToPage(node) {
  const parts = [];
  let x = node;
  while (x && x.type !== 'PAGE') {
    parts.unshift(x.name);
    x = x.parent;
  }
  return parts.join('/');
}

function __ccSerializeCompSetPropertyDefinitions(cs) {
  const out = {};
  try {
    const raw = cs.componentPropertyDefinitions;
    if (!raw) return out;
    for (const k of Object.keys(raw)) {
      const d = raw[k];
      out[k] = { type: d.type, defaultValue: d.defaultValue };
    }
  } catch (_e) {}
  return out;
}

const page = figma.currentPage;
const pageName = page.name;
const docRootChildren = page.children.length;
const layout = CONFIG.layout || 'chip';
let compSetVariantRows = [];
let firstVariantChildren = [];
let compSetParent = null;
let compSetPropertyDefinitions = {};
let compSetVariants = 0;

if (compSet) {
  compSetParent = __ccNodePathUpToPage(compSet.parent);
  compSetPropertyDefinitions = __ccSerializeCompSetPropertyDefinitions(compSet);
  compSetVariants = compSet.children.length;
  for (const node of compSet.children) {
    if (node.type !== 'COMPONENT') continue;
    const childNames = node.children.map(ch => ch.name);
    const hasText = node.findOne(n => n.type === 'TEXT') != null;
    compSetVariantRows.push({ name: node.name, childNames, hasText });
  }
  const first = compSet.children[0];
  if (first && first.type === 'COMPONENT') {
    firstVariantChildren = first.children.map(ch => ch.name);
  }
}

const unresolvedTokenPaths = {
  total: typeof _unresolvedTokenMisses !== 'undefined' ? _unresolvedTokenMisses.length : 0,
};
const propErrorsSample = __ccPropAddErrors.slice(0, 5);
const propErrorsCount = __ccPropAddErrors.length;

return {
  ok: true,
  section: 'component',
  docRootId: docRoot.id,
  compSetId: compSet ? compSet.id : null,
  compSetName: compSet ? compSet.name : null,
  propsAdded,
  pageName,
  docRootChildren,
  layout,
  compSetParent,
  compSetVariants,
  compSetPropertyDefinitions,
  firstVariantChildren,
  compSetVariantRows,
  unresolvedTokenPaths,
  propErrorsCount,
  propErrorsSample,
};
