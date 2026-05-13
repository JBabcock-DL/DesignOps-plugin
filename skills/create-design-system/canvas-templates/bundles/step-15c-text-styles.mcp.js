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
  row.paddingTop = 14;
  row.paddingBottom = 14;
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
    const shadowStyle = (await figma.getLocalEffectStylesAsync())
      .find(s => s.name === 'Effect/shadow-sm');
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
  // Delete every node except _Header
  for (const node of [...page.children]) {
    if (node.name !== '_Header') node.remove();
  }

  // Assert _Header
  const header = page.findOne(n => n.name === '_Header');
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
// canvas-templates/text-styles.js — Step 15c — ↳ Text Styles page (`typography/styles` table)
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: (ignored — ensureLocalVariableMapOnCtx always rebuilds from local file variables)
//   docStyles: { Section, TokenName, Code, Caption },
//   rows: Array<
//   | { type: 'category', label: string }
//   | { type: 'slot', tokenPath: string, styleId: string, specimenChars: string,
//       sizeLine1: string, sizeLine2: string, weightLine1: string, weightLine2: string,
//       codeSyntax: { WEB, ANDROID, iOS },
//       variant?: 'base' | 'emphasis' | 'italic' | 'link' | 'strikethrough'
//     }
// >
// }
//
// `styleId` is a published local text style id (Doc/* slot styles from 15c §0).
// `variant` drives specimen fill: link → primary, strikethrough → content-muted, else content.

const TYPO_COLUMNS = [
  { id: 'SLOT', width: 220 },
  { id: 'SPECIMEN', width: 360 },
  { id: 'SIZE / LINE', width: 140 },
  { id: 'WEIGHT / FAMILY', width: 180 },
  { id: 'WEB', width: 280 },
  { id: 'ANDROID', width: 200 },
  { id: 'iOS', width: 260 },
];

function typoCellSlug(colId) {
  return colId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cell';
}

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  const { pageId, variableMap, docStyles, rows } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);
  const slotRows = (rows || []).filter((r) => r.type === 'slot');
  if (slotRows.length) {
    const allSt = await figma.getLocalTextStylesAsync();
    const idSet = new Set(slotRows.map((r) => r.styleId).filter(Boolean));
    await loadFontsForTextStyles(allSt.filter((s) => idSet.has(s.id)));
  }

  const variables = {};
  for (const path of [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted', 'color/primary/default',
  ]) {
    if (variableMap[path]) variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  await buildTable({
    slug: 'typography/styles',
    title: 'Typography',
    caption: 'Specimen renders at mode 100 — full 8-mode scale (85 → 200) ships via the Typography collection. Body variants extend each size with emphasis / italic / link / strikethrough per §7b.',
    columns: TYPO_COLUMNS,
    rows: rows || [],
    buildRow: buildTypographyRow,
  }, content, variables, docStyles, variableMap);

  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log('Canvas: Step 15c ↳ Text Styles — done (1 table)');
}

async function buildTypographyRow(row, rowData, columns, deps) {
  const { docStyles, contentVar, variables } = deps;
  const v = rowData.variant || 'base';

  let fillVar = variables['color/background/content'];
  if (v === 'link') fillVar = variables['color/primary/default'] || fillVar;
  if (v === 'strikethrough') fillVar = variables['color/background/content-muted'] || fillVar;

  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    const colId = col.id;
    cell.name = `cell/${typoCellSlug(colId)}`;

    if (colId === 'SLOT') {
      const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
      cell.appendChild(t);
    } else if (colId === 'SPECIMEN') {
      const t = figma.createText();
      t.name = 'text/specimen';
      t.characters = rowData.specimenChars || rowData.tokenPath;
      t.resize(col.width - 40, 1);
      t.textAutoResize = 'HEIGHT';
      if (rowData.styleId) {
        t.textStyleId = rowData.styleId;
      }
      if (fillVar) bindPaintToVar(t, fillVar);
      cell.appendChild(t);
    } else if (colId === 'SIZE / LINE') {
      cell.itemSpacing = 2;
      const l1 = await makeText(rowData.sizeLine1 || '—', col.width, docStyles.Code || null, contentVar);
      const l2 = await makeText(rowData.sizeLine2 || '—', col.width, docStyles.Code || null, contentVar);
      cell.appendChild(l1);
      cell.appendChild(l2);
    } else if (colId === 'WEIGHT / FAMILY') {
      cell.itemSpacing = 2;
      const l1 = await makeText(rowData.weightLine1 || '—', col.width, docStyles.Code || null, contentVar);
      const l2 = await makeText(rowData.weightLine2 || '—', col.width, docStyles.Code || null, contentVar);
      cell.appendChild(l1);
      cell.appendChild(l2);
    } else if (colId === 'WEB') {
      const t = await makeText(rowData.codeSyntax.WEB || '—', col.width, docStyles.Code || null, contentVar);
      cell.appendChild(t);
    } else if (colId === 'ANDROID') {
      const t = await makeText(rowData.codeSyntax.ANDROID || '—', col.width, docStyles.Code || null, contentVar);
      cell.appendChild(t);
    } else if (colId === 'iOS') {
      const t = await makeText(rowData.codeSyntax.iOS || '—', col.width, docStyles.Code || null, contentVar);
      cell.appendChild(t);
    }

    rehugCell(cell);
    row.appendChild(cell);
    cell.fills = [];
  }
}
// Concatenate after _lib.js + text-styles.js (phase 07). Builds typography table in-plugin.
// Fully dynamic — discovers all local text styles (excluding Doc/*), groups by first path segment.
// Reads fontSize, lineHeight, fontWeight, fontFamily directly from each text style.
const allTextStyles = await figma.getLocalTextStylesAsync();

// Exclude infrastructure styles
const typographyStyles = allTextStyles.filter(
  (s) => !s.name.startsWith('Doc/') && !s.name.startsWith('Effect/')
);

await loadFontsForTextStyles(typographyStyles);

// Group by first path segment (category)
const categoryMap = {};
const categoryOrder = [];
for (const s of typographyStyles) {
  const firstSeg = s.name.split('/')[0];
  if (!categoryMap[firstSeg]) {
    categoryMap[firstSeg] = [];
    categoryOrder.push(firstSeg);
  }
  categoryMap[firstSeg].push(s);
}

// Sort categories in known order; unknown categories appended alphabetically
const CATEGORY_ORDER = ['Display', 'Headline', 'Title', 'Body', 'Label'];
const orderedCategories = [
  ...CATEGORY_ORDER.filter((c) => categoryMap[c]),
  ...categoryOrder.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
];

const SPECIMENS = {
  Display: 'Dream design systems',
  Headline: 'Ship it with confidence',
  Title: 'Tokens keep us honest',
  Body: 'The quick brown fox jumps over the lazy dog.',
  Label: 'STATUS — ACTIVE',
};

function csFor(styleName) {
  const lower = styleName.toLowerCase().replace(/\s+/g, '-');
  const kebab = lower.replace(/\//g, '-');
  const parts = lower.split('/');
  return {
    WEB: 'var(--' + kebab + ')',
    ANDROID: kebab,
    iOS: '.Typography.' + parts.join('.'),
  };
}

function readCS(s) {
  const cs = s.codeSyntax || {};
  if (cs.WEB || cs.ANDROID || cs.iOS || cs.IOS) {
    return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
  }
  return csFor(s.name);
}

function lineHeightStr(lh) {
  if (!lh) return '—';
  if (lh.unit === 'AUTO') return 'auto line';
  if (lh.unit === 'PIXELS') return `${Math.round(lh.value)}px line`;
  if (lh.unit === 'PERCENT') return `${lh.value}% line`;
  return `${lh.value} line`;
}

const SIZE_PRIORITY = { '2XL': -2, XL: -1, LG: 0, MD: 1, SM: 2, XS: 3 };

const rows = [];
for (const cat of orderedCategories) {
  rows.push({ type: 'category', label: cat });
  const catStyles = categoryMap[cat].slice().sort((a, b) => {
    const partsA = a.name.split('/');
    const partsB = b.name.split('/');
    const sizeA = (partsA[1] || '').toUpperCase();
    const sizeB = (partsB[1] || '').toUpperCase();
    const prioA = SIZE_PRIORITY[sizeA] ?? 99;
    const prioB = SIZE_PRIORITY[sizeB] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    return a.name.localeCompare(b.name);
  });
  for (const s of catStyles) {
    const parts = s.name.split('/');
    const rawVariant = parts.length >= 3 ? parts[2].toLowerCase() : 'base';
    const variant = ['emphasis', 'italic', 'link', 'strikethrough'].includes(rawVariant)
      ? rawVariant
      : 'base';
    rows.push({
      type: 'slot',
      tokenPath: s.name,
      styleId: s.id,
      specimenChars: SPECIMENS[cat] || s.name,
      sizeLine1: `${Math.round(s.fontSize)}px size`,
      sizeLine2: lineHeightStr(s.lineHeight),
      weightLine1: `${s.fontWeight} weight`,
      weightLine2: s.fontName ? s.fontName.family : '—',
      codeSyntax: readCS(s),
      variant,
    });
  }
}

const docStyles = {
  Section:   allTextStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: allTextStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      allTextStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   allTextStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const textStylesPage =
  findDesignOpsPage('text-styles', {
    legacyExact: ['↳ Text Styles'],
    legacyRegex: [/^↳?\s*text\s*styles/i],
  }) || null;
if (!textStylesPage || textStylesPage.type !== 'PAGE') {
  throw new Error('Page not found (expected ↳ Text Styles / slug text-styles)');
}

const ctx = {
  pageId: textStylesPage.id,
  docStyles,
  rows,
};
await build(ctx);
const tableGroups = textStylesPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;

const expected = new Map();
for (const r of rows) {
  if (r.type === 'slot' && r.tokenPath && r.styleId) expected.set(r.tokenPath, r.styleId);
}
const table = textStylesPage.findOne((n) => n.name === 'doc/table/typography/styles' && n.type === 'FRAME');
const body = table && table.children.find((c) => c.name === 'doc/table/typography/styles/body');
let specimenStyleOk = 0;
let specimenStyleMissing = 0;
let specimenStyleMismatch = 0;
const auditErrors = [];
if (!table) auditErrors.push('doc/table/typography/styles not found');
else if (!body) auditErrors.push('doc/table/typography/styles/body not found');
else {
  for (const [tokenPath, wantId] of expected) {
    const rowFrame = body.children.find((c) => c.type === 'FRAME' && c.name === `row/${tokenPath}`);
    if (!rowFrame) {
      specimenStyleMissing++;
      continue;
    }
    const specCell = rowFrame.children.find((c) => c.type === 'FRAME' && c.name === 'cell/specimen');
    const specimenNode = specCell && specCell.findOne((n) => n.type === 'TEXT' && n.name === 'text/specimen');
    if (!specimenNode || !specimenNode.textStyleId) {
      specimenStyleMissing++;
      continue;
    }
    if (specimenNode.textStyleId !== wantId) {
      specimenStyleMismatch++;
      continue;
    }
    specimenStyleOk++;
  }
}

const slotCount = expected.size;
const auditFail = specimenStyleMissing > 0 || specimenStyleMismatch > 0 || auditErrors.length > 0;
if (auditFail) {
  const parts = [];
  if (auditErrors.length) parts.push(...auditErrors);
  if (specimenStyleMissing) parts.push(`specimenStyleMissing: ${specimenStyleMissing}`);
  if (specimenStyleMismatch) parts.push(`specimenStyleMismatch: ${specimenStyleMismatch}`);
  return {
    ok: false,
    step: '15c-text-styles',
    pageId: textStylesPage.id,
    tableGroups,
    pageName: textStylesPage.name,
    rowCount: rows.length,
    specimenStyleOk,
    specimenStyleMissing,
    specimenStyleMismatch,
    slotCount,
    errors: parts,
  };
}

return {
  ok: true,
  step: '15c-text-styles',
  pageId: textStylesPage.id,
  tableGroups,
  pageName: textStylesPage.name,
  rowCount: rows.length,
  specimenStyleOk,
  specimenStyleMissing,
  specimenStyleMismatch,
  slotCount,
};
