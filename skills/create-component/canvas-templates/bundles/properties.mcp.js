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

// step3 — in-place property cells (single-call properties bundle)
function __ccDocFillPropertiesFromConfig() {
  const table = docRoot.findOne(
    n => n.type === 'FRAME' && n.name === `doc/table/${CONFIG.component}/properties`,
  );
  if (!table) {
    throw new Error('[cc] properties table missing');
  }
  const want = (CONFIG.properties && CONFIG.properties.length) || 0;
  let bodyRows = table.children.slice(1);
  const have = bodyRows.length;

  if (have !== want) {
    console.warn(`[cc] prop rows ${have}≠${want} — self-healing`);
    if (have < want) {
      const COLS = [240, 380, 160, 120, 740];
      for (let addIdx = have; addIdx < want; addIdx++) {
        const row = figma.createFrame();
        row.name = `row/placeholder-${addIdx}`;
        row.layoutMode = 'HORIZONTAL';
        row.primaryAxisSizingMode = 'FIXED';
        row.counterAxisSizingMode = 'AUTO';
        row.resize(1640, 64);
        row.counterAxisAlignItems = 'CENTER';
        row.paddingTop = 16;
        row.paddingBottom = 16;
        if (addIdx < want - 1) {
          row.strokeWeight = 1;
          row.strokeBottomWeight = 1;
          row.strokeTopWeight = row.strokeLeftWeight = row.strokeRightWeight = 0;
          bindColor(row, 'color/border/subtle', '#e4e4e7', 'strokes');
        }
        for (const w of COLS) {
          const cell = figma.createFrame();
          cell.name = 'cell';
          cell.layoutMode = 'VERTICAL';
          cell.primaryAxisSizingMode = 'AUTO';
          cell.counterAxisSizingMode = 'FIXED';
          cell.resize(w, 64);
          cell.paddingLeft = cell.paddingRight = 20;
          cell.paddingTop = cell.paddingBottom = 4;
          const t = figma.createText();
          t.characters = '—';
          t.resize(w - 40, 1);
          t.textAutoResize = 'HEIGHT';
          cell.appendChild(t);
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
    } else {
      const excess = table.children.slice(1 + want);
      for (const row of [...excess].reverse()) row.remove();
    }
    bodyRows = table.children.slice(1);
  }
  for (let i = 0; i < want; i++) {
    const r = CONFIG.properties[i];
    const row = bodyRows[i];
    for (let j = 0; j < 5; j++) {
      const cell = row.children[j];
      const t = cell && cell.findOne && cell.findOne(n => n.type === 'TEXT');
      if (t) t.characters = String(r[j]);
    }
  }
}

docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'properties',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
__ccDocFillPropertiesFromConfig();
return {
  ok: true,
  section: 'properties',
  docRootId: docRoot.id,
};
