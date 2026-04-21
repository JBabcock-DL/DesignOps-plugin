// canvas-templates/_lib.js — shared helpers for all Step 15 canvas templates
// §0 rules from conventions/00-gotchas.md are enforced in every helper below.
// Agent call shape: [_lib.js source] + [template source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
// Optional: omit ctx.variableMap to shrink MCP `code` — each page template calls
// ensureLocalVariableMapOnCtx(ctx) first; it fills path → id from getLocalVariablesAsync() when missing or {}.

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

// ─── Variable helpers ────────────────────────────────────────────────────────

// Hydrate ctx.variableMap inside Figma when the agent omits it (smaller JSON.stringify(ctx) for MCP).
// No-op if variableMap is already a non-empty object (backward-compatible with full ctx).
async function ensureLocalVariableMapOnCtx(ctx) {
  const m = ctx.variableMap;
  if (m && typeof m === 'object' && Object.keys(m).length > 0) return;
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

  const t = await makeText(label, colWidth, docStyles.Code || null, variables['color/background/content-muted']);
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
  if (borderVariable) {
    row.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
    row.strokeBottomWeight = 1;
    row.strokeTopWeight = 0;
    row.strokeLeftWeight = 0;
    row.strokeRightWeight = 0;
    bindStrokeToVar(row, borderVariable);
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
    titleText.name = `doc/table-group/${slug}/title`;
    group.appendChild(titleText);
  }
  if (caption) {
    const capText = await makeText(caption, 1640, docStyles.Caption || null, mutedVar);
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
  table.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
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
  header.fills = [];
  if (bgVariant) bindPaintToVar(header, bgVariant);
  header.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
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
// canvas-templates/token-overview.js — Step 17 ↳ Token Overview
// Updates scaffold from /new-project 05d: Doc/* upgrades, platform-mapping codeSyntax,
// §0.9 platform-mapping shadow hygiene, section shadows, arch bindings, placeholders, TBD.
// Call shape: [_lib.js] + [this source] + runner fragment (phase 08 / sync 9d).

// Minimum row set — keep in sync with data/platform-mapping-rows.json "rows"
const STEP17_MIN_PLATFORM_ROWS = [
  { tokenPath: 'color/background/default', collection: 'Theme' },
  { tokenPath: 'color/background/content', collection: 'Theme' },
  { tokenPath: 'color/background/content-muted', collection: 'Theme' },
  { tokenPath: 'color/background/variant', collection: 'Theme' },
  { tokenPath: 'color/border/default', collection: 'Theme' },
  { tokenPath: 'color/border/subtle', collection: 'Theme' },
  { tokenPath: 'color/primary/default', collection: 'Theme' },
  { tokenPath: 'color/primary/content', collection: 'Theme' },
  { tokenPath: 'color/primary/subtle', collection: 'Theme' },
  { tokenPath: 'color/secondary/default', collection: 'Theme' },
  { tokenPath: 'color/tertiary/default', collection: 'Theme' },
  { tokenPath: 'color/error/default', collection: 'Theme' },
  { tokenPath: 'color/component/ring', collection: 'Theme' },
  { tokenPath: 'Headline/LG/font-size', collection: 'Typography' },
  { tokenPath: 'Title/LG/font-size', collection: 'Typography' },
  { tokenPath: 'Body/MD/font-size', collection: 'Typography' },
  { tokenPath: 'typeface/display', collection: 'Primitives' },
  { tokenPath: 'space/md', collection: 'Layout' },
  { tokenPath: 'space/lg', collection: 'Layout' },
  { tokenPath: 'radius/md', collection: 'Layout' },
  { tokenPath: 'radius/lg', collection: 'Layout' },
  { tokenPath: 'shadow/color', collection: 'Effects' },
];

const ARCH_BIND = [
  { name: 'Primitives', path: 'color/primary/default' },
  { name: 'Theme', path: 'color/secondary/default' },
  { name: 'Typography', path: 'color/neutral/800' },
  { name: 'Layout', path: 'color/neutral/800' },
  { name: 'Effects', path: 'color/neutral/800' },
];

function readCS(v) {
  const cs = v.codeSyntax || {};
  return {
    WEB: String(cs.WEB || ''),
    ANDROID: String(cs.ANDROID || ''),
    iOS: String(cs.iOS || cs.IOS || ''),
  };
}

function colorToHex(val) {
  if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
  const r = Math.round(val.r * 255);
  const g = Math.round(val.g * 255);
  const b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveRawValue(variableId, modeId) {
  let v = await figma.variables.getVariableByIdAsync(variableId);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[modeId];
    if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      v = await figma.variables.getVariableByIdAsync(val.id);
      continue;
    }
    return val;
  }
  return null;
}

function isUnderPlatformMappingTable(node, pmTableId) {
  let p = node.parent;
  while (p && 'id' in p) {
    if (pmTableId && p.id === pmTableId) return true;
    if (p.name === 'doc/table/token-overview/platform-mapping') return true;
    p = p.parent;
  }
  return false;
}

function walkNodes(node, fn) {
  fn(node);
  if ('children' in node) for (const c of node.children) walkNodes(c, fn);
}

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const pageNode = await figma.getNodeByIdAsync(ctx.pageId);
  if (!pageNode || pageNode.type !== 'PAGE') throw new Error('Step 17: invalid pageId');
  await figma.setCurrentPageAsync(pageNode);
  const page = figma.currentPage;
  const { variableMap } = ctx;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const primColl = collections.find((c) => c.name === 'Primitives');
  const primModeId = primColl ? primColl.modes[0]?.modeId : null;

  const pmTable = page.findOne((n) => n.name === 'doc/table/token-overview/platform-mapping');
  const pmTableId = pmTable ? pmTable.id : null;

  // §0.9 — strip effects from platform-mapping table subtree
  if (pmTable) {
    walkNodes(pmTable, (n) => {
      if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') {
        try {
          n.effectStyleId = '';
          n.effects = [];
        } catch (_) {}
      }
    });
  }

  const textStyles = await figma.getLocalTextStylesAsync();
  const sid = (name) => textStyles.find((s) => s.name === name)?.id || '';
  const docSection = sid('Doc/Section');
  const docTokenName = sid('Doc/TokenName');
  const docCode = sid('Doc/Code');
  const docCaption = sid('Doc/Caption');

  const pageContent = page.findOne((n) => n.name === '_PageContent');
  let textUpgraded = 0;
  if (pageContent) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'TEXT') return;
      if (isUnderPlatformMappingTable(n, pmTableId)) return;
      try {
        const fs = n.fontSize;
        const st = n.fontName && n.fontName.style;
        let pick = docCode;
        if (fs >= 19) pick = docSection;
        else if (fs >= 15 && st && String(st).includes('Semi')) pick = docTokenName;
        else if (fs >= 13) pick = docCode;
        else pick = docCaption;
        if (pick) {
          n.textStyleId = pick;
          textUpgraded++;
        }
      } catch (_) {}
    });
    // Platform-mapping body: assign Doc/* by cell key
    if (pmTable) {
      walkNodes(pmTable, (n) => {
        if (n.type !== 'TEXT') return;
        const path = n.parent && n.parent.name ? n.parent.name : '';
        if (path.includes('/cell/token')) {
          try {
            if (docTokenName) n.textStyleId = docTokenName;
          } catch (_) {}
        } else if (path.includes('/cell/web') || path.includes('/cell/android') || path.includes('/cell/ios')) {
          try {
            if (docCode) n.textStyleId = docCode;
          } catch (_) {}
        }
      });
    }
  }

  const effectStyles = await figma.getLocalEffectStylesAsync();
  const shadowSm = effectStyles.find((e) => e.name === 'Effect/shadow-sm');
  const shadowSmId = shadowSm ? shadowSm.id : '';
  let shadowFrames = 0;
  if (pageContent && shadowSmId) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'FRAME') return;
      const nm = n.name || '';
      if (isUnderPlatformMappingTable(n, pmTableId)) return;
      if (
        nm.startsWith('token-overview/') ||
        nm === 'dark-mode-panel' ||
        nm === 'font-scale-panel'
      ) {
        try {
          if (!n.effectStyleId) {
            n.effectStyleId = shadowSmId;
            shadowFrames++;
          }
        } catch (_) {}
      }
    });
  }

  // Architecture boxes — ensure variable-bound fills
  for (const spec of ARCH_BIND) {
    const box = page.findOne((n) => n.name === 'arch-box/' + spec.name);
    if (!box || box.type !== 'FRAME') continue;
    const vid = variableMap[spec.path];
    if (!vid) continue;
    const v = await figma.variables.getVariableByIdAsync(vid);
    if (!v) continue;
    try {
      bindPaintToVar(box, v);
    } catch (_) {}
  }

  // Dark Mode phone frames (05d names) — rebind fills per Step 17 appendix
  const phoneLight = page.findOne((n) => n.name === 'phone-frame/light');
  if (phoneLight && variableMap['color/background/default']) {
    const v = await figma.variables.getVariableByIdAsync(variableMap['color/background/default']);
    if (v) try { bindPaintToVar(phoneLight, v); } catch (_) {}
  }
  const phoneDark = page.findOne((n) => n.name === 'phone-frame/dark');
  if (phoneDark && variableMap['color/neutral/950']) {
    const v = await figma.variables.getVariableByIdAsync(variableMap['color/neutral/950']);
    if (v) try { bindPaintToVar(phoneDark, v); } catch (_) {}
  }

  // Platform mapping — sync codeSyntax cells + stale rows
  const rowPrefix = 'doc/table/token-overview/platform-mapping/row/';
  let cellsUpdated = 0;
  let staleRows = 0;
  if (pmTable) {
    const rowFrames = pmTable.findAll(
      (n) => n.type === 'FRAME' && n.name.startsWith(rowPrefix) && !n.name.includes('/cell/'),
    );
    for (const row of rowFrames) {
      const tokenPath = row.name.slice(rowPrefix.length);
      const vid = variableMap[tokenPath];
      if (!vid) {
        const tokCell = row.findOne((c) => c.type === 'FRAME' && c.name.endsWith('/cell/token'));
        if (tokCell) {
          for (const t of tokCell.children || []) {
            if (t.type === 'TEXT' && !String(t.characters).includes('stale')) {
              try {
                t.characters = String(t.characters) + ' · stale';
                staleRows++;
              } catch (_) {}
            }
          }
        }
        continue;
      }
      const variable = await figma.variables.getVariableByIdAsync(vid);
      if (!variable) continue;
      const cs = readCS(variable);
      for (const [key, val] of [
        ['web', cs.WEB],
        ['android', cs.ANDROID],
        ['ios', cs.iOS],
      ]) {
        const cell = row.findOne((c) => c.name === row.name + '/cell/' + key);
        if (!cell) continue;
        for (const t of cell.children || []) {
          if (t.type === 'TEXT' && String(t.characters) !== (val || '—')) {
            try {
              t.characters = val || '—';
              cellsUpdated++;
            } catch (_) {}
          }
        }
      }
    }
  }

  // Delete placeholder/*
  let placeholdersRemoved = 0;
  if (pageContent) {
    const toRemove = [];
    walkNodes(pageContent, (n) => {
      if (n.name && n.name.startsWith('placeholder/')) toRemove.push(n);
    });
    for (const n of toRemove) {
      try {
        n.remove();
        placeholdersRemoved++;
      } catch (_) {}
    }
  }

  // Replace TBD in text; default hex from color/primary/500
  let tbdFixed = 0;
  let fallbackHex = '#2563eb';
  const p500 = variableMap['color/primary/500'];
  if (p500 && primModeId) {
    const v500 = await figma.variables.getVariableByIdAsync(p500);
    if (v500) {
      const raw = await resolveRawValue(v500.id, primModeId);
      fallbackHex = colorToHex(raw);
    }
  }
  if (pageContent) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'TEXT') return;
      if (String(n.characters).includes('TBD')) {
        try {
          n.characters = String(n.characters).replace(/TBD/g, fallbackHex);
          tbdFixed++;
        } catch (_) {}
      }
    });
  }

  // Log minimum row coverage (diagnostic only; full row insert is out of scope for v1 bundle)
  const missingMinRows = [];
  for (const spec of STEP17_MIN_PLATFORM_ROWS) {
    if (!variableMap[spec.tokenPath]) missingMinRows.push(spec.tokenPath);
  }

  return {
    step: '17-token-overview',
    textStyleUpgrades: textUpgraded,
    shadowFramesApplied: shadowFrames,
    platformCellsUpdated: cellsUpdated,
    staleRowsMarked: staleRows,
    placeholdersRemoved,
    tbdReplacements: tbdFixed,
    missingVariablePaths: missingMinRows,
  };
}
// Concatenate after _lib.js + token-overview.js (phase 08 / sync 9d).
const overviewPage = figma.root.children.find((pg) => pg.name === '\u21B3 Token Overview');
if (!overviewPage || overviewPage.type !== 'PAGE') {
  return {
    ok: false,
    step: '17-token-overview',
    skipped: 'page missing',
    pageName: '\u21B3 Token Overview',
    existingPages: figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name),
  };
}
const ctx = { pageId: overviewPage.id };
const hadVm = 'variableMap' in ctx;
const result = await build(ctx);
return {
  ok: true,
  step: '17-token-overview',
  pageId: overviewPage.id,
  pageName: overviewPage.name,
  hadVariableMapBeforeBuild: hadVm,
  variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
  ...result,
};
