// canvas-templates/_lib.js — shared helpers for all Step 15 canvas templates
// §0 rules from conventions/00-gotchas.md are enforced in every helper below.
// Agent call shape: [_lib.js source] + [template source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
// Optional: omit ctx.variableMap from JSON — each page template calls
// ensureLocalVariableMapOnCtx(ctx) first; it always rebuilds path → id from
// getLocalVariablesAsync() so host-injected maps cannot override file truth.

// ─── Font loading ────────────────────────────────────────────────────────────

async function loadFonts(families) {
  const styles = ['Regular', 'Medium', 'Italic', 'Bold'];
  const jobs = [];
  for (const family of families) {
    for (const style of styles) {
      jobs.push(figma.loadFontAsync({ family, style }).catch(() => {}));
    }
  }
  await Promise.all(jobs);
}

// Load every fontName referenced by local text styles (e.g. slot styles before SPECIMEN textStyleId).
async function loadFontsForTextStyles(textStyles) {
  const seen = new Set();
  const jobs = [];
  for (const s of textStyles) {
    const fn = s.fontName;
    if (!fn || !fn.family) continue;
    const key = `${fn.family}\0${fn.style || 'Regular'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(figma.loadFontAsync({ family: fn.family, style: fn.style || 'Regular' }).catch(() => {}));
  }
  await Promise.all(jobs);
}

// ─── Variable helpers ────────────────────────────────────────────────────────

// Always rebuild ctx.variableMap from local file variables (ignores host ctx.variableMap).
async function ensureLocalVariableMapOnCtx(ctx) {
  const allVars = await figma.variables.getLocalVariablesAsync();
  ctx.variableMap = Object.fromEntries(allVars.map(v => [v.name, v.id]));
}

function resolvePath(variableMap, path) {
  const id = variableMap[path];
  if (!id) throw new Error(`_lib: variable not found for path "${path}"`);
  return figma.variables.getVariableByIdAsync(id);
}

// Walk VARIABLE_ALIAS chain until we reach a raw value (number, string, or color object).
async function resolveNumericAlias(variableId, modeId) {
  let variable = await figma.variables.getVariableByIdAsync(variableId);
  for (let depth = 0; depth < 10; depth++) {
    const value = variable.valuesByMode[modeId];
    if (value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS') {
      variable = await figma.variables.getVariableByIdAsync(value.id);
      continue;
    }
    return value;
  }
  return null;
}

// ─── Paint binding (§0.7) ────────────────────────────────────────────────────

// §0.7: clone the existing paint, setBoundVariableForPaint, reassign array.
function bindPaintToVar(node, variable) {
  const base = node.fills.length > 0 ? { ...node.fills[0] } : { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 };
  const bound = figma.variables.setBoundVariableForPaint(base, 'color', variable);
  node.fills = [bound];
}

function bindStrokeToVar(node, variable) {
  const base = node.strokes.length > 0 ? { ...node.strokes[0] } : { type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 }, opacity: 1 };
  const bound = figma.variables.setBoundVariableForPaint(base, 'color', variable);
  node.strokes = [bound];
}

// ─── Tier 3: DesignOps page slug + collection registry (Foundations shell) ───
// Figma MCP `use_figma` requires getSharedPluginData / setSharedPluginData (pluginData is web-only).

const DESIGNOPS_SHARED_NS = 'labs.designops';
const DESIGNOPS_PAGE_SLUG_SUBKEY = 'pageSlug';
const DESIGNOPS_COLLECTION_REGISTRY_SUBKEY = 'collectionRegistry';
const DESIGNOPS_REGISTRY_FRAME = '_DesignOpsRegistry';
var DESIGNOPS_PATH_ALIAS_SUBKEY = 'pathAliasMap';

function readDesignOpsPageSlug(page) {
  return page.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_PAGE_SLUG_SUBKEY) || '';
}

/**
 * Resolve a Foundations style-guide page by shared-plugin slug first, then legacy exact names, then regexes.
 * @param {string} pageSlug e.g. 'primitives', 'text-styles'
 * @param {{ legacyExact?: string[], legacyRegex?: RegExp[] }} [opts]
 * @returns {PageNode | undefined}
 */
function findDesignOpsPage(pageSlug, opts) {
  opts = opts || {};
  const pages = figma.root.children.filter(function (n) { return n.type === 'PAGE'; });
  var bySlug = pages.find(function (p) { return readDesignOpsPageSlug(p) === pageSlug; });
  if (bySlug) return bySlug;

  var legacyExact = opts.legacyExact || [];
  var exactMatches = [];
  for (var i = 0; i < legacyExact.length; i++) {
    var nm = legacyExact[i];
    for (var j = 0; j < pages.length; j++) {
      if (pages[j].name === nm) exactMatches.push(pages[j]);
    }
  }
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return undefined;

  var regexList = opts.legacyRegex || [];
  var regMatches = [];
  for (var r = 0; r < pages.length; r++) {
    var p = pages[r];
    for (var k = 0; k < regexList.length; k++) {
      if (regexList[k].test(p.name)) {
        regMatches.push(p);
        break;
      }
    }
  }
  if (regMatches.length === 1) return regMatches[0];
  return undefined;
}

/** @returns {Record<string, string>} */
function readDesignOpsCollectionRegistry() {
  var docPage = figma.root.children.find(function (p) { return p.type === 'PAGE' && p.name === 'Documentation components'; });
  if (!docPage) return {};
  var frame = docPage.findOne(function (n) { return n.type === 'FRAME' && n.name === DESIGNOPS_REGISTRY_FRAME; });
  if (!frame) return {};
  var raw = frame.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_COLLECTION_REGISTRY_SUBKEY);
  if (!raw) return {};
  try {
    var o = JSON.parse(raw);
    return typeof o === 'object' && o !== null ? o : {};
  } catch (_) {
    return {};
  }
}

function readDesignOpsPathAliasMap(registryFrame) {
  if (!registryFrame) return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
  try {
    var raw = registryFrame.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_PATH_ALIAS_SUBKEY);
    if (!raw) return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
    parsed.entries = parsed.entries || {};
    return parsed;
  } catch (_) {
    return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
  }
}

function writeDesignOpsPathAliasMap(registryFrame, aliasData) {
  if (!registryFrame) return;
  try {
    registryFrame.setSharedPluginData(
      DESIGNOPS_SHARED_NS,
      DESIGNOPS_PATH_ALIAS_SUBKEY,
      JSON.stringify(aliasData)
    );
  } catch (_) { /* read-only file or API error — alias map is a cache, not required */ }
}

async function computePathAliasMap(variableMap, collections, allVars) {
  var CANONICAL_PATHS = [
    'color/border/subtle',
    'color/background/default',
    'color/background/variant',
    'color/background/content',
    'color/background/content-muted',
    'color/neutral/100',
    'color/neutral/950',
    'color/primary/200',
    'color/primary/500',
    'color/secondary/500',
    'color/primary/default',
  ];
  var KEYWORD_RULES = {
    'color/background/default':       { required: [['background','default'],['surface','default']], exclusions: [] },
    'color/background/content':       { required: [['background','content']], exclusions: ['muted'] },
    'color/background/content-muted': { required: [['background','content','muted'],['surface','muted']], exclusions: [] },
    'color/background/variant':       { required: [['background','variant'],['surface','variant']], exclusions: [] },
    'color/border/subtle':            { required: [['border','subtle']], exclusions: [] },
    'color/primary/default':          { required: [['primary','default']], exclusions: [] },
    'color/neutral/100':              { required: [['neutral','100']], exclusions: [] },
    'color/neutral/950':              { required: [['neutral','950']], exclusions: [] },
    'color/primary/200':              { required: [['primary','200']], exclusions: [] },
    'color/primary/500':              { required: [['primary','500']], exclusions: [] },
    'color/secondary/500':            { required: [['secondary','500']], exclusions: [] },
  };
  var allNames = Object.keys(variableMap);
  var entries = {};
  for (var i = 0; i < CANONICAL_PATHS.length; i++) {
    var canonicalPath = CANONICAL_PATHS[i];
    if (variableMap[canonicalPath]) {
      entries[canonicalPath] = { resolvedPath: canonicalPath, confidence: 'exact' };
      continue;
    }
    var rule = KEYWORD_RULES[canonicalPath];
    if (rule) {
      var candidates = allNames.filter(function(name) {
        var segments = name.toLowerCase().split('/');
        for (var e = 0; e < rule.exclusions.length; e++) {
          if (segments.indexOf(rule.exclusions[e]) !== -1) return false;
        }
        for (var r = 0; r < rule.required.length; r++) {
          var reqSet = rule.required[r];
          var allPresent = true;
          for (var s = 0; s < reqSet.length; s++) {
            if (segments.indexOf(reqSet[s]) === -1) { allPresent = false; break; }
          }
          if (allPresent) return true;
        }
        return false;
      });
      if (candidates.length === 1) {
        entries[canonicalPath] = { resolvedPath: candidates[0], confidence: 'semantic' };
        continue;
      }
    }
    var parts = canonicalPath.split('/');
    var lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      var primColl = null;
      for (var ci = 0; ci < collections.length; ci++) {
        var c = collections[ci];
        if (/^(primitiv|core|foundation|base)/i.test(c.name)) { primColl = c; break; }
      }
      if (!primColl) {
        var hasLightDark = function(col) {
          return col.modes.some(function(m) { return /^light/i.test(m.name); }) &&
                 col.modes.some(function(m) { return /^dark/i.test(m.name); });
        };
        var colorCountFn = function(col) {
          return allVars.filter(function(v) { return v.variableCollectionId === col.id && v.resolvedType === 'COLOR'; }).length;
        };
        var nonThemeCols = collections.filter(function(col) { return !hasLightDark(col); });
        nonThemeCols.sort(function(a, b) { return colorCountFn(b) - colorCountFn(a); });
        if (nonThemeCols.length > 0) primColl = nonThemeCols[0];
      }
      if (primColl) {
        var rampKeyword = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : null;
        if (rampKeyword) {
          var stopCandidates = allVars.filter(function(v) {
            if (v.variableCollectionId !== primColl.id) return false;
            if (v.resolvedType !== 'COLOR') return false;
            var segs = v.name.toLowerCase().split('/');
            var lastSeg = segs[segs.length - 1];
            return lastSeg === lastPart && segs.indexOf(rampKeyword) !== -1;
          });
          if (stopCandidates.length === 1) {
            entries[canonicalPath] = { resolvedPath: stopCandidates[0].name, confidence: 'position' };
            continue;
          }
        }
      }
    }
    entries[canonicalPath] = { resolvedPath: null, confidence: null };
  }
  return entries;
}

async function ensureCanonicalMapOnCtx(ctx) {
  if (!ctx.variableMap) return;
  var registryFrame = null;
  try {
    var docPage = figma.root.children.find(function(p) {
      return p.type === 'PAGE' && p.name === 'Documentation components';
    });
    if (docPage) {
      registryFrame = docPage.findOne(function(n) {
        return n.type === 'FRAME' && n.name === '_DesignOpsRegistry';
      }) || null;
    }
  } catch (_) {}
  var allVarsC, collectionsC;
  try {
    allVarsC = await figma.variables.getLocalVariablesAsync();
    collectionsC = await figma.variables.getLocalVariableCollectionsAsync();
  } catch (_) {
    allVarsC = [];
    collectionsC = [];
  }
  var checksum = ((allVarsC.length ^ collectionsC.length) & 0xFFFF).toString(16).padStart(4, '0');
  var stored = readDesignOpsPathAliasMap(registryFrame);
  if (stored.variableMapChecksum === checksum && Object.keys(stored.entries).length > 0) {
    ctx.canonicalMap = {};
    var storedEntries = stored.entries;
    Object.keys(storedEntries).forEach(function(k) {
      ctx.canonicalMap[k] = storedEntries[k] ? storedEntries[k].resolvedPath : null;
    });
    return;
  }
  var freshEntries = await computePathAliasMap(ctx.variableMap, collectionsC, allVarsC);
  var aliasData = {
    schemaVersion: 1,
    computedAt: new Date().toISOString(),
    variableMapChecksum: checksum,
    entries: freshEntries,
  };
  writeDesignOpsPathAliasMap(registryFrame, aliasData);
  ctx.canonicalMap = {};
  Object.keys(freshEntries).forEach(function(k) {
    ctx.canonicalMap[k] = freshEntries[k] ? freshEntries[k].resolvedPath : null;
  });
}

function resolveCanonicalPath(canonicalPath, variableMap, canonicalMap) {
  if (variableMap && variableMap[canonicalPath]) return canonicalPath;
  if (!canonicalMap) return null;
  var alias = canonicalMap[canonicalPath];
  if (alias && variableMap && variableMap[alias]) return alias;
  return null;
}

function isHeaderNode(node) {
  return (node.name === '_Header' || /^_?header/i.test(node.name)) &&
         (node.type === 'INSTANCE' || node.type === 'COMPONENT');
}

/**
 * Resolve a variable collection for canvas runners. Plan §5.4 heuristic order when resolving by logical key:
 * 1) registry id for key K → use live collection with that id if it exists;
 * 2) else exact-name match for the conventional collection name;
 * 3) else manifest-style alias / conservative fuzzy (caller supplies fallbackFn);
 * 4) ambiguous 0 or >1 matches → caller returns null / escalates (shell throws; runners log).
 */
function resolveCollectionByLogicalKey(logicalKey, collections, registryIds, fallbackFn) {
  var want = registryIds && registryIds[logicalKey];
  if (want) {
    var live = collections.find(function (c) { return c.id === want; });
    if (live) return live;
  }
  if (typeof fallbackFn === 'function') return fallbackFn();
  return null;
}

// ─── Text helpers (§0.2, §0.6) ───────────────────────────────────────────────

// §0.2: characters → resize(w,1) → textAutoResize='HEIGHT'. Never 'NONE'.
async function makeText(characters, colWidth, styleId, fillVariable) {
  const t = figma.createText();
  t.characters = String(characters);
  t.resize(colWidth - 40, 1);
  t.textAutoResize = 'HEIGHT';
  if (styleId) {
    try { t.textStyleId = styleId; } catch (_) {}
  }
  if (fillVariable) {
    bindPaintToVar(t, fillVariable);
  }
  return t;
}

// ─── Header cell (§0.5) ──────────────────────────────────────────────────────

// §0.5: HORIZONTAL + FIXED/FIXED + resize(colWidth, 48) BEFORE appending text.
// Vertical center the label cell contents.
async function makeHeaderCell(colWidth, label, docStyles, variables) {
  const cell = figma.createFrame();
  cell.name = `cell/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisSizingMode = 'FIXED';
  cell.counterAxisSizingMode = 'FIXED';
  cell.resize(colWidth, 48);
  cell.paddingLeft = 16;
  cell.paddingRight = 16;
  cell.counterAxisAlignItems = 'CENTER';
  cell.fills = [];

  const mutedFillVar = variables['color/background/content-muted'];
  const t = await makeText(label, colWidth, docStyles.Code || null, mutedFillVar);
  if (!mutedFillVar) t.fills = [{ type: 'SOLID', color: { r: 0.44, g: 0.44, b: 0.48 } }];
  cell.appendChild(t);
  return cell;
}

// ─── Body cell (§0.1) ────────────────────────────────────────────────────────

// §0.1: set Hug on height axis BEFORE resize(colWidth, 1); re-assert after appendChild.
// §0.1.H (HORIZONTAL cells): `primaryAxisSizingMode` is the HORIZONTAL axis, so it must be FIXED
// (at colWidth) and `counterAxisSizingMode` must be AUTO (Hug height). Using the VERTICAL defaults
// for HORIZONTAL cells collapses width to content and fixes height at 1px — that's the theme
// LIGHT/DARK misalignment bug (header = FIXED colWidth, body cell = HUG content).
function makeBodyCell(colWidth, layoutMode) {
  const cell = figma.createFrame();
  cell.layoutMode = layoutMode || 'VERTICAL';
  if (cell.layoutMode === 'HORIZONTAL') {
    cell.primaryAxisSizingMode = 'FIXED';   // horizontal = fixed colWidth
    cell.counterAxisSizingMode = 'AUTO';    // vertical = Hug height
  } else {
    cell.primaryAxisSizingMode = 'AUTO';    // vertical = Hug height
    cell.counterAxisSizingMode = 'FIXED';   // horizontal = fixed colWidth
  }
  cell.resize(colWidth, 1);
  cell.paddingLeft = 16;
  cell.paddingRight = 16;
  cell.paddingTop = 0;
  cell.paddingBottom = 0;
  cell.itemSpacing = 2;
  cell.primaryAxisAlignItems = 'CENTER';
  cell.counterAxisAlignItems = 'MIN';
  cell.fills = [];
  return cell;
}

// Re-assert sizing after appending children (§0.1 post-appendChild re-assert).
// Figma may flip axis sizing modes when a node is appended into a STRETCH parent; we re-assert
// the mode/axis combination that matches the cell's layoutMode so width stays fixed at colWidth
// and height hugs content — for BOTH HORIZONTAL (swatch+hex, PREVIEW) and VERTICAL cells.
function rehugCell(cell) {
  if (cell.layoutMode === 'HORIZONTAL') {
    cell.primaryAxisSizingMode = 'FIXED';
    cell.counterAxisSizingMode = 'AUTO';
  } else {
    cell.primaryAxisSizingMode = 'AUTO';
    cell.counterAxisSizingMode = 'FIXED';
  }
  cell.layoutSizingVertical = 'HUG';
}

// ─── Body row ────────────────────────────────────────────────────────────────

function makeBodyRow(tokenPath, borderVariable) {
  const row = figma.createFrame();
  row.name = `row/${tokenPath}`;
  row.layoutMode = 'HORIZONTAL';
  row.counterAxisSizingMode = 'AUTO';   // Hug height
  row.primaryAxisSizingMode = 'FIXED';  // Fixed 1640
  row.resize(1640, 1);
  row.minHeight = 56;
  row.paddingTop = 24;
  row.paddingBottom = 24;
  row.counterAxisAlignItems = 'CENTER';
  row.fills = [];
  // borderVariable===null means last row (no border); undefined or Variable means add border
  if (borderVariable !== null) {
    row.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
    row.strokeBottomWeight = 1;
    row.strokeTopWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
    if (borderVariable) bindStrokeToVar(row, borderVariable);
  }
  return row;
}

// Re-assert row Hug after all cells appended (§0.1).
function rehugRow(row) {
  row.counterAxisSizingMode = 'AUTO';
  row.layoutSizingVertical = 'HUG';
}

// ─── Hex helper (shared by templates; keep single copy — concatenated script) ─

function hexToRgb(hex) {
  if (!hex) return { r: 0.9, g: 0.9, b: 0.9 };
  const clean = String(hex).replace('#', '');
  const int = parseInt(clean, 16);
  if (Number.isNaN(int)) return { r: 0.9, g: 0.9, b: 0.9 };
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

// §0.3: `doc/theme-preview/{mode}` holds the chip only; hex TEXT is a sibling (not inside preview).
async function makeThemeModeColumn(colWidth, modeSlug, themeVariableId, resolvedHex, docStyles, contentVar, themeCollectionId, modeId) {
  const cell = makeBodyCell(colWidth, 'HORIZONTAL');
  cell.itemSpacing = 6;
  cell.counterAxisAlignItems = 'CENTER';
  cell.paddingLeft = 4;
  cell.paddingRight = 4;

  const preview = figma.createFrame();
  preview.name = `doc/theme-preview/${modeSlug}`;
  preview.layoutMode = 'HORIZONTAL';
  preview.primaryAxisSizingMode = 'FIXED';
  preview.counterAxisSizingMode = 'FIXED';
  preview.resize(32, 32);
  preview.fills = [];

  const rect = figma.createRectangle();
  rect.resize(24, 24);
  rect.cornerRadius = 4;
  rect.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
  rect.strokeWeight = 1;
  const tv = themeVariableId ? await figma.variables.getVariableByIdAsync(themeVariableId) : null;
  if (tv) bindPaintToVar(rect, tv);
  else rect.fills = [{ type: 'SOLID', color: hexToRgb(resolvedHex) }];
  preview.appendChild(rect);

  if (themeCollectionId && modeId) {
    try { preview.setExplicitVariableModeForCollection(themeCollectionId, modeId); } catch (_) {}
  }

  const hexText = await makeText(resolvedHex || '—', Math.max(40, colWidth - 36), docStyles.Code || null, contentVar);
  cell.appendChild(preview);
  cell.appendChild(hexText);
  rehugCell(cell);
  return cell;
}

// ─── buildTable — detached-build pattern (C1) ────────────────────────────────

// Builds the full table subtree off-tree, appends root once.
// C2 (suspend autolayout during bulk insert) is applied on `_PageContent` in each page template
// (`layoutMode = 'NONE'` → build tables → restore `VERTICAL`), not inside this function.
async function buildTable(manifest, parent, variables, docStyles, variableMap) {
  const { slug, columns, rows, title, caption, tableType } = manifest;

  const borderVar   = variables['color/border/subtle'];
  const bgDefault   = variables['color/background/default'];
  const bgVariant   = variables['color/background/variant'];
  const contentVar  = variables['color/background/content'];
  const mutedVar    = variables['color/background/content-muted'];

  // ── table-group wrapper ──────────────────────────────────────────────────
  const group = figma.createFrame();
  group.name = `doc/table-group/${slug}`;
  group.layoutMode = 'VERTICAL';
  group.primaryAxisSizingMode = 'AUTO';
  group.counterAxisSizingMode = 'FIXED';
  group.layoutSizingVertical = 'HUG';
  group.resizeWithoutConstraints(1640, 1);
  group.itemSpacing = 12;
  group.fills = [];
  group.clipsContent = false;

  // title + caption (§0.6: textAutoResize='HEIGHT' on direct TEXT children)
  if (title) {
    const titleText = await makeText(title, 1640, docStyles.Section || null, contentVar);
    if (!contentVar) titleText.fills = [{ type: 'SOLID', color: { r: 0.09, g: 0.09, b: 0.11 } }];
    titleText.name = `doc/table-group/${slug}/title`;
    group.appendChild(titleText);
  }
  if (caption) {
    const capText = await makeText(caption, 1640, docStyles.Caption || null, mutedVar);
    if (!mutedVar) capText.fills = [{ type: 'SOLID', color: { r: 0.44, g: 0.44, b: 0.48 } }];
    capText.name = `doc/table-group/${slug}/caption`;
    group.appendChild(capText);
  }

  // ── outer table frame ───────────────────────────────────────────────────
  const table = figma.createFrame();
  table.name = `doc/table/${slug}`;
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'FIXED';
  table.resizeWithoutConstraints(1640, 1);
  table.cornerRadius = 16;
  table.clipsContent = true;
  table.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
  table.strokeWeight = 1;
  if (borderVar) bindStrokeToVar(table, borderVar);
  if (bgDefault) bindPaintToVar(table, bgDefault);
  else table.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // ── header row ──────────────────────────────────────────────────────────
  const header = figma.createFrame();
  header.name = `doc/table/${slug}/header`;
  header.layoutMode = 'HORIZONTAL';
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'FIXED';
  header.resize(1640, 48);
  header.counterAxisAlignItems = 'CENTER';
  if (bgVariant) bindPaintToVar(header, bgVariant);
  else header.fills = [{ type: 'SOLID', color: { r: 0.965, g: 0.965, b: 0.969 } }];
  header.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
  header.strokeBottomWeight = 1;
  header.strokeTopWeight = 0;
  header.strokeLeftWeight = 0;
  header.strokeRightWeight = 0;
  if (borderVar) bindStrokeToVar(header, borderVar);

  for (const col of columns) {
    const hCell = await makeHeaderCell(col.width, col.id, docStyles, variables);
    header.appendChild(hCell);
  }
  table.appendChild(header);

  // ── body ─────────────────────────────────────────────────────────────────
  const body = figma.createFrame();
  body.name = `doc/table/${slug}/body`;
  body.layoutMode = 'VERTICAL';
  body.primaryAxisSizingMode = 'AUTO';
  body.counterAxisSizingMode = 'FIXED';
  body.layoutAlign = 'STRETCH';
  body.fills = [];

  for (let i = 0; i < rows.length; i++) {
    const rowData = rows[i];
    const isLast  = (i === rows.length - 1);

    // Category sub-header (Text Styles only)
    if (rowData.type === 'category') {
      const catRow = figma.createFrame();
      catRow.name = `cat-${rowData.label.toLowerCase().replace(/\s+/g, '-')}`;
      catRow.layoutMode = 'HORIZONTAL';
      catRow.primaryAxisSizingMode = 'FIXED';
      catRow.counterAxisSizingMode = 'FIXED';
      catRow.resize(1640, 40);
      if (bgVariant) bindPaintToVar(catRow, bgVariant);
      else catRow.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97 } }];
      const catCell = makeBodyCell(1640, 'HORIZONTAL');
      catCell.fills = [];
      const catText = await makeText(rowData.label, 1640, docStyles.Caption || null, mutedVar);
      catCell.appendChild(catText);
      rehugCell(catCell);
      catRow.appendChild(catCell);
      body.appendChild(catRow);
      continue;
    }

    const row = makeBodyRow(rowData.tokenPath, isLast ? null : borderVar);
    await manifest.buildRow(row, rowData, columns, {
      variables, docStyles, contentVar, mutedVar, borderVar, variableMap,
      ...(manifest.rowDeps || {}),
    });
    rehugRow(row);
    body.appendChild(row);
  }

  table.appendChild(body);
  group.appendChild(table);

  // ── effectStyleId (shadow-sm) ─────────────────────────────────────────
  // Skipped for token-overview/platform-mapping (§0.9).
  if (!slug.includes('token-overview/platform-mapping')) {
    const _allEffectStyles = await figma.getLocalEffectStylesAsync();
    const shadowStyle = _allEffectStyles.find(s => s.name === 'Effect/shadow-sm')
      || _allEffectStyles.find(s => /shadow.*sm/i.test(s.name));
    if (shadowStyle) table.effectStyleId = shadowStyle.id;
  }

  // ── Append to parent once (C1 detached-build) ─────────────────────────
  parent.appendChild(group);

  // Re-assert group sizing after append (§0.1 table-group rule)
  group.primaryAxisSizingMode = 'AUTO';
  group.layoutSizingVertical = 'HUG';

  return group;
}

// ─── _PageContent builder ────────────────────────────────────────────────────

async function buildPageContent(page) {
  // Delete every node except the header (exact '_Header' or any /^_?header/i instance/component)
  for (const node of [...page.children]) {
    if (!isHeaderNode(node)) node.remove();
  }

  // Assert header width
  const header = page.children.find(n => isHeaderNode(n));
  if (header) {
    if (Math.abs(header.width - 1800) > 1) header.resize(1800, 320);
  }

  // Build _PageContent
  const content = figma.createFrame();
  content.name = '_PageContent';
  content.layoutMode = 'VERTICAL';
  content.primaryAxisSizingMode = 'AUTO';
  content.counterAxisSizingMode = 'FIXED';
  content.resizeWithoutConstraints(1800, 1);
  content.x = 0;
  content.y = 320;
  content.paddingTop = 80;
  content.paddingBottom = 80;
  content.paddingLeft = 80;
  content.paddingRight = 80;
  content.itemSpacing = 48;
  content.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
  page.appendChild(content);

  // Re-assert Hug after append (§0.1 wrapper rule)
  content.layoutSizingVertical = 'HUG';

  return content;
}
// canvas-templates/layout.js — Step 15c — ↳ Layout page (spacing + radius tables)
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: (ignored at runtime — _lib ensureLocalVariableMapOnCtx overwrites from local file variables)
//   docStyles: { Section, TokenName, Code, Caption },
//   rows: {
//     spacing: [{ tokenPath, resolvedPx, aliasPath, codeSyntax: {WEB,ANDROID,iOS} }],
//     radius:  [{ tokenPath, resolvedPx, aliasPath, codeSyntax }] // resolvedPx 9999 => pill (∞)
//   }
// }

const SPACING_COLUMNS = [
  { id: 'TOKEN', width: 280 },
  { id: 'VALUE', width: 100 },
  { id: 'ALIAS →', width: 280 },
  { id: 'PREVIEW', width: 240 },
  { id: 'WEB', width: 320 },
  { id: 'ANDROID', width: 220 },
  { id: 'iOS', width: 200 },
];

const RADIUS_COLUMNS = SPACING_COLUMNS;

// Known-group metadata; unknown groups get auto-generated titles
const LAYOUT_GROUP_META = {
  space:   { title: 'Spacing',      caption: 'Semantic spacing aliases mapped to Primitive space steps.',  type: 'spacing' },
  spacing: { title: 'Spacing',      caption: 'Semantic spacing aliases mapped to Primitive space steps.',  type: 'spacing' },
  radius:  { title: 'Radius',       caption: 'Semantic radius aliases mapped to Primitive corner steps.',  type: 'radius'  },
  corner:  { title: 'Corner Radius',caption: 'Semantic radius aliases mapped to Primitive corner steps.',  type: 'radius'  },
  padding: { title: 'Padding',      caption: 'Component padding scale.',                                    type: 'spacing' },
  border:  { title: 'Border Width', caption: 'Border width tokens.',                                        type: 'spacing' },
  gap:     { title: 'Gap',          caption: 'Flex / grid gap scale.',                                      type: 'spacing' },
};
const LAYOUT_KNOWN_ORDER = ['space', 'spacing', 'padding', 'radius', 'corner', 'border', 'gap'];

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  await ensureCanonicalMapOnCtx(ctx);
  const { pageId, variableMap, docStyles, rows } = ctx;

  // Fuzzy docStyles fallback
  if (!docStyles.Section || !docStyles.TokenName || !docStyles.Code || !docStyles.Caption) {
    var _ts = await figma.getLocalTextStylesAsync();
    if (!docStyles.Section)   { var _s = _ts.find(function(s) { return /^_?doc.*section/i.test(s.name); }); if (_s) docStyles.Section = _s.id; }
    if (!docStyles.TokenName) { var _tn = _ts.find(function(s) { return /^_?doc.*(token|heading)/i.test(s.name); }); if (_tn) docStyles.TokenName = _tn.id; }
    if (!docStyles.Code)      { var _c = _ts.find(function(s) { return /^_?doc.*(code|mono)/i.test(s.name); }); if (_c) docStyles.Code = _c.id; }
    if (!docStyles.Caption)   { var _cap = _ts.find(function(s) { return /^_?doc.*(caption|label|body)/i.test(s.name); }); if (_cap) docStyles.Caption = _cap.id; }
  }

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const variables = {};
  const chromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted', 'color/neutral/100', 'color/primary/200',
  ];
  for (var _ci = 0; _ci < chromePaths.length; _ci++) {
    var _cp = chromePaths[_ci];
    var _ap = resolveCanonicalPath(_cp, variableMap, ctx.canonicalMap);
    if (_ap) variables[_cp] = await figma.variables.getVariableByIdAsync(variableMap[_ap]);
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  // Render a table for every group in ctx.rows (known groups first, rest alphabetically)
  const RADIUS_TYPES = new Set(['radius', 'corner']);
  const allLayoutGroupKeys = Object.keys(rows || {}).filter((k) => (rows[k] || []).length > 0);
  const orderedLayoutKeys = [
    ...LAYOUT_KNOWN_ORDER.filter((k) => allLayoutGroupKeys.includes(k)),
    ...allLayoutGroupKeys.filter((k) => !LAYOUT_KNOWN_ORDER.includes(k)).sort(),
  ];
  let tableCount = 0;
  for (const key of orderedLayoutKeys) {
    const grpRows = rows[key] || [];
    if (!grpRows.length) continue;
    const meta = LAYOUT_GROUP_META[key] || {};
    const slug = meta.slug || `layout/${key}`;
    const title = meta.title || (key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '));
    const caption = meta.caption || `${title} tokens.`;
    const isRadius = meta.type === 'radius' || RADIUS_TYPES.has(key.toLowerCase());
    await buildTable({
      slug,
      title,
      caption,
      columns: isRadius ? RADIUS_COLUMNS : SPACING_COLUMNS,
      rows: grpRows,
      buildRow: isRadius ? buildLayoutRadiusRow : buildLayoutSpacingRow,
    }, content, variables, docStyles, variableMap);
    tableCount++;
  }

  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log(`Canvas: Step 15c ↳ Layout — done (${tableCount} tables)`);
}

async function buildLayoutSpacingRow(row, rowData, columns, deps) {
  const { variables, docStyles, contentVar, mutedVar, variableMap } = deps;
  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'VALUE': {
        const t = await makeText(`${rowData.resolvedPx}px`, col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'ALIAS →': {
        const t = await makeText(rowData.aliasPath || '—', col.width, docStyles.Code || null, mutedVar);
        cell.appendChild(t);
        break;
      }
      case 'PREVIEW': {
        // PREVIEW cell is HORIZONTAL — re-assert axis sizing after flipping layoutMode
        // so width stays fixed at col.width (§0.1.H in _lib.js makeBodyCell).
        cell.layoutMode = 'HORIZONTAL';
        cell.primaryAxisSizingMode = 'FIXED';
        cell.counterAxisSizingMode = 'AUTO';
        cell.counterAxisAlignItems = 'CENTER';
        const bar = figma.createRectangle();
        bar.name = 'preview-bar';
        const barWidth = Math.min(rowData.resolvedPx || 4, col.width - 40);
        bar.resize(Math.max(barWidth, 2), 16);
        bar.cornerRadius = 4;
        if (variables['color/primary/200']) bindPaintToVar(bar, variables['color/primary/200']);
        else bar.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.88, b: 1 } }];
        cell.appendChild(bar);
        break;
      }
      case 'WEB':
      case 'ANDROID':
      case 'iOS': {
        const t = await makeText(rowData.codeSyntax[col.id] || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
    }
    rehugCell(cell);
    row.appendChild(cell);
    cell.fills = [];
  }
}

async function buildLayoutRadiusRow(row, rowData, columns, deps) {
  const { variables, docStyles, contentVar, mutedVar, variableMap } = deps;
  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'VALUE': {
        const val = rowData.resolvedPx === 9999 ? '∞' : `${rowData.resolvedPx}px`;
        const t = await makeText(val, col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'ALIAS →': {
        const t = await makeText(rowData.aliasPath || '—', col.width, docStyles.Code || null, mutedVar);
        cell.appendChild(t);
        break;
      }
      case 'PREVIEW': {
        // PREVIEW cell is HORIZONTAL — re-assert axis sizing after flipping layoutMode
        // so width stays fixed at col.width (§0.1.H in _lib.js makeBodyCell).
        cell.layoutMode = 'HORIZONTAL';
        cell.primaryAxisSizingMode = 'FIXED';
        cell.counterAxisSizingMode = 'AUTO';
        cell.counterAxisAlignItems = 'CENTER';
        const sq = figma.createRectangle();
        sq.name = 'preview-square';
        sq.resize(64, 64);
        const raw = rowData.resolvedPx === 9999 ? 32 : Math.min(rowData.resolvedPx || 0, 32);
        sq.cornerRadius = raw;
        sq.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
        sq.strokeWeight = 1;
        if (variables['color/border/subtle']) bindStrokeToVar(sq, variables['color/border/subtle']);
        if (variables['color/neutral/100']) bindPaintToVar(sq, variables['color/neutral/100']);
        else sq.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97 } }];
        cell.appendChild(sq);
        break;
      }
      case 'WEB':
      case 'ANDROID':
      case 'iOS': {
        const t = await makeText(rowData.codeSyntax[col.id] || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
    }
    rehugCell(cell);
    row.appendChild(cell);
    cell.fills = [];
  }
}
// Concatenate after _lib.js + layout.js (phase 07). Resolves Layout rows in-plugin.
// Collection-scoped: finds the Layout-like collection by fuzzy name match, then draws
// ONLY FLOAT vars from that collection grouped by first path segment.
// Nothing is cross-collected — variables in other collections are untouched.

const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();

// ── Find the Layout-like collection (fuzzy) ───────────────────────────────────
// Priority: registry id → exact "Layout" → keyword match → FLOAT-dominant non-theme collection
function findLayoutCollection() {
  return resolveCollectionByLogicalKey('layout', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Layout');
  if (exact) return exact;
  const fuzzy = collections.find((c) => /layout|spacing|dimensional/i.test(c.name));
  if (fuzzy) return fuzzy;
  const themed = new Set(
    collections
      .filter((c) => c.modes.some((m) => /^light/i.test(m.name)) && c.modes.some((m) => /^dark/i.test(m.name)))
      .map((c) => c.id)
  );
  const floatDominant = collections
    .filter((c) => !themed.has(c.id))
    .map((c) => {
      const vars = allVars.filter((v) => v.variableCollectionId === c.id);
      const floats = vars.filter((v) => v.resolvedType === 'FLOAT').length;
      return { c, ratio: vars.length > 0 ? floats / vars.length : 0, total: vars.length };
    })
    .filter(({ ratio, total }) => ratio > 0.6 && total > 2)
    .sort((a, b) => b.ratio - a.ratio);
  return floatDominant[0]?.c || null;
  });
}

const layoutColl = findLayoutCollection();
if (!layoutColl) {
  throw new Error(
    'No Layout-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
  );
}

const layoutModeId = layoutColl.modes[0].modeId;

// All FLOAT vars scoped to this collection only
const layoutVars = allVars.filter(
  (v) => v.variableCollectionId === layoutColl.id && v.resolvedType === 'FLOAT'
);

async function resolvePx(varId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = layoutModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = collections.find((c) => c.id === next.variableCollectionId);
      m = nextColl ? nextColl.modes[0].modeId : Object.keys(next.valuesByMode)[0];
      v = next;
      continue;
    }
    if (typeof val === 'number') return val;
    return 0;
  }
  return 0;
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

function getAliasName(v) {
  const val = v.valuesByMode[layoutModeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const av = figma.variables.getVariableById(val.id);
    return av ? av.name : '';
  }
  return '';
}

// Group all FLOAT vars by first path segment
const groupMap = {};
const groupOrder = [];
for (const v of layoutVars) {
  const firstSeg = v.name.split('/')[0];
  if (!groupMap[firstSeg]) {
    groupMap[firstSeg] = [];
    groupOrder.push(firstSeg);
  }
  groupMap[firstSeg].push(v);
}

// Build rows for each group, sorted by resolved px value
const rows = {};
for (const group of groupOrder) {
  const groupRows = [];
  for (const v of groupMap[group]) {
    const px = await resolvePx(v.id);
    const isFullOrPill =
      v.name.toLowerCase().includes('full') || v.name.toLowerCase().includes('pill') || px >= 9999;
    groupRows.push({
      tokenPath: v.name,
      resolvedPx: isFullOrPill ? 9999 : px,
      aliasPath: getAliasName(v),
      codeSyntax: readCS(v),
    });
  }
  groupRows.sort((a, b) => a.resolvedPx - b.resolvedPx);
  rows[group] = groupRows;
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === '_Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === '_Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === '_Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === '_Doc/Caption')?.id   || null,
};

const layoutPage =
  findDesignOpsPage('layout', {
    legacyExact: ['↳ Layout'],
    legacyRegex: [/^↳?\s*layout/i],
  }) || null;
if (!layoutPage || layoutPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Layout / slug layout). Pages: ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}

const ctx = { pageId: layoutPage.id, docStyles, rows };
await build(ctx);
const tableGroups = layoutPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true, step: '15c-layout', pageId: layoutPage.id,
  collection: layoutColl.name,
  tableGroups, pageName: layoutPage.name,
};
