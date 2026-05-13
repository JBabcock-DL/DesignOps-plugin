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
// canvas-templates/primitives.js — Step 15a ↳ Primitives
// Builds 10 tables: 5 color ramps, space, radius, elevation, typeface, font-weight.
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx shape:
// {
//   pageId: string,
//   variableMap: { [tokenPath]: variableId }   // optional — _lib ensureLocalVariableMapOnCtx fills when omitted
//   primitivesModeId: string,                    // Default mode id for Primitives collection
//   docStyles: { Section: id, TokenName: id, Code: id, Caption: id },
//   rows: {
//     colorRamps: { [ramp]: [{ tokenPath, resolvedHex, codeSyntax: {WEB,ANDROID,iOS} }] },
//     space:      [{ tokenPath, resolvedPx, codeSyntax }],
//     radius:     [{ tokenPath, resolvedPx, codeSyntax }],
//     elevation:  [{ tokenPath, resolvedValue, codeSyntax }],
//     typeface:   [{ tokenPath, resolvedValue, codeSyntax }],
//     fontWeight: [{ tokenPath, resolvedValue, codeSyntax }],
//   }
// }

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  const { pageId, variableMap, primitivesModeId, docStyles, rows } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);

  const page = figma.currentPage;

  // Load fonts
  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  // Resolve frequently-used chrome variables once
  const variables = {};
  const chromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted',
    'color/neutral/100', 'color/primary/200',
  ];
  for (const path of chromePaths) {
    if (variableMap[path]) {
      variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
    }
  }

  const content = await buildPageContent(page);

  // ── C2: suspend auto-layout on content during bulk insert ──────────────────
  content.layoutMode = 'NONE';

  // ─── 1–5: Color ramps ────────────────────────────────────────────────────

  const rampDefaults = {
    primary:   { title: 'Primary',   caption: 'Brand anchor — used for the most prominent actions, links, and focus.' },
    secondary: { title: 'Secondary', caption: 'Supporting brand color for secondary actions and decorative surfaces.' },
    tertiary:  { title: 'Tertiary',  caption: 'Accent hue for highlights, chips, and illustrative moments.' },
    error:     { title: 'Error',     caption: 'Destructive and error feedback — do not use for incidental UI.' },
    neutral:   { title: 'Neutral',   caption: 'Greyscale foundation for text, borders, and calm surfaces.' },
  };
  // Format ramp keys that may contain slashes (e.g. "opacity/dark" → "Opacity / Dark")
  function formatRampTitle(ramp) {
    return ramp.split('/').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');
  }
  const RAMP_ORDER = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
  const rampMeta = Object.keys(rows.colorRamps || {})
    .filter((ramp) => Array.isArray(rows.colorRamps[ramp]) && rows.colorRamps[ramp].length > 0)
    .sort((a, b) => {
      const ia = RAMP_ORDER.indexOf(a);
      const ib = RAMP_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    })
    .map((ramp) => ({
      ramp,
      title: rampDefaults[ramp]?.title || formatRampTitle(ramp),
      caption: rampDefaults[ramp]?.caption || `${formatRampTitle(ramp)} ramp.`,
    }));

  const colorColumns = [
    { id: 'TOKEN',   width: 320 },
    { id: 'SWATCH',  width: 96  },
    { id: 'HEX',     width: 120 },
    { id: 'WEB',     width: 360 },
    { id: 'ANDROID', width: 340 },
    { id: 'iOS',     width: 404 },
  ];

  for (const { ramp, title, caption } of rampMeta) {
    const rampRows = rows.colorRamps[ramp] || [];
    await buildTable({
      slug: `primitives/color/${ramp}`,
      title,
      caption,
      columns: colorColumns,
      rows: rampRows,
      buildRow: buildColorRow,
    }, content, variables, docStyles, variableMap);
  }

  // ─── 6: Space ────────────────────────────────────────────────────────────

  const spaceColumns = [
    { id: 'TOKEN',   width: 260 },
    { id: 'VALUE',   width: 100 },
    { id: 'PREVIEW', width: 260 },
    { id: 'WEB',     width: 340 },
    { id: 'ANDROID', width: 320 },
    { id: 'iOS',     width: 360 },
  ];

  await buildTable({
    slug: 'primitives/space',
    title: 'Space',
    caption: 'Spacing scale on a 4px base grid.',
    columns: spaceColumns,
    rows: rows.space,
    buildRow: buildSpaceRow,
  }, content, variables, docStyles, variableMap);

  // ─── 7: Radius ───────────────────────────────────────────────────────────

  const radiusColumns = [
    { id: 'TOKEN',   width: 260 },
    { id: 'VALUE',   width: 100 },
    { id: 'PREVIEW', width: 260 },
    { id: 'WEB',     width: 340 },
    { id: 'ANDROID', width: 320 },
    { id: 'iOS',     width: 360 },
  ];

  await buildTable({
    slug: 'primitives/radius',
    title: 'Corner Radius',
    caption: 'Corner rounding primitives from square through pill.',
    columns: radiusColumns,
    rows: rows.radius,
    buildRow: buildRadiusRow,
  }, content, variables, docStyles, variableMap);

  // ─── 8: Elevation ────────────────────────────────────────────────────────

  const elevationColumns = [
    { id: 'TOKEN',   width: 260 },
    { id: 'VALUE',   width: 100 },
    { id: 'WEB',     width: 400 },
    { id: 'ANDROID', width: 380 },
    { id: 'iOS',     width: 500 },
  ];

  await buildTable({
    slug: 'primitives/elevation',
    title: 'Elevation',
    caption: 'Raw blur steps consumed by shadow/*/blur aliases in Effects.',
    columns: elevationColumns,
    rows: rows.elevation,
    buildRow: buildMonoRow,
  }, content, variables, docStyles, variableMap);

  // ─── 9: Typeface ─────────────────────────────────────────────────────────

  const typefaceColumns = [
    { id: 'TOKEN',    width: 320 },
    { id: 'SPECIMEN', width: 460 },
    { id: 'VALUE',    width: 200 },
    { id: 'WEB',      width: 320 },
    { id: 'ANDROID',  width: 160 },
    { id: 'iOS',      width: 180 },
  ];

  await buildTable({
    slug: 'primitives/typeface',
    title: 'Typeface',
    caption: 'Font family primitives. Display for headings, Body for paragraph text.',
    columns: typefaceColumns,
    rows: rows.typeface,
    buildRow: buildTypefaceRow,
  }, content, variables, docStyles, variableMap);

  // ─── 10: Font weight ─────────────────────────────────────────────────────

  const fontWeightColumns = [
    { id: 'TOKEN',   width: 260 },
    { id: 'VALUE',   width: 100 },
    { id: 'WEB',     width: 400 },
    { id: 'ANDROID', width: 380 },
    { id: 'iOS',     width: 500 },
  ];

  await buildTable({
    slug: 'primitives/font-weight',
    title: 'Font weight',
    caption: 'Shared emphasis weight (Typography Body/*/emphasis aliases this Primitive).',
    columns: fontWeightColumns,
    rows: rows.fontWeight,
    buildRow: buildMonoRow,
  }, content, variables, docStyles, variableMap);

  // ── Restore auto-layout (C2) ───────────────────────────────────────────────
  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log('Canvas: Step 15a ↳ Primitives — done (10 tables)');
}

// ─── Row builders ─────────────────────────────────────────────────────────────

async function buildColorRow(row, rowData, columns, deps) {
  const { variables, docStyles, contentVar, mutedVar, variableMap } = deps;
  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'SWATCH': {
        // §0.7: bound fill on the rectangle
        cell.counterAxisAlignItems = 'CENTER';
        const rect = figma.createRectangle();
        rect.name = 'swatch';
        rect.resize(48, 48);
        rect.cornerRadius = 10;
        rect.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
        rect.strokeWeight = 1;
        if (variables['color/border/subtle']) bindStrokeToVar(rect, variables['color/border/subtle']);
        const swatchVarId = variableMap && variableMap[rowData.tokenPath];
        if (swatchVarId) {
          const swatchVar = await figma.variables.getVariableByIdAsync(swatchVarId);
          if (swatchVar) bindPaintToVar(rect, swatchVar);
          else rect.fills = [{ type: 'SOLID', color: hexToRgb(rowData.resolvedHex) }];
        } else {
          rect.fills = [{ type: 'SOLID', color: hexToRgb(rowData.resolvedHex) }];
        }
        cell.appendChild(rect);
        break;
      }
      case 'HEX': {
        const t = await makeText(rowData.resolvedHex || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'WEB': {
        const t = await makeText(rowData.codeSyntax.WEB || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'ANDROID': {
        const t = await makeText(rowData.codeSyntax.ANDROID || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'iOS': {
        const t = await makeText(rowData.codeSyntax.iOS || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
    }
    rehugCell(cell);
    row.appendChild(cell);
    cell.fills = [];
  }
}

async function buildSpaceRow(row, rowData, columns, deps) {
  const { variables, docStyles, contentVar, mutedVar } = deps;
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
      case 'PREVIEW': {
        // Bar width bound to space variable (or resolved px, capped at col.width - 40).
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

async function buildRadiusRow(row, rowData, columns, deps) {
  const { variables, docStyles, contentVar, mutedVar } = deps;
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
        const cr = Math.min(rowData.resolvedPx || 0, 32);
        sq.cornerRadius = cr;
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

async function buildMonoRow(row, rowData, columns, deps) {
  const { docStyles, contentVar } = deps;
  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    let text;
    switch (col.id) {
      case 'TOKEN':   text = rowData.tokenPath; break;
      case 'VALUE':   text = String(rowData.resolvedValue ?? '—'); break;
      case 'WEB':     text = rowData.codeSyntax.WEB || '—'; break;
      case 'ANDROID': text = rowData.codeSyntax.ANDROID || '—'; break;
      case 'iOS':     text = rowData.codeSyntax.iOS || '—'; break;
      default:        text = '—';
    }
    const styleId = col.id === 'TOKEN' ? (docStyles.TokenName || null) : (docStyles.Code || null);
    const t = await makeText(text, col.width, styleId, contentVar);
    cell.appendChild(t);
    rehugCell(cell);
    row.appendChild(cell);
    cell.fills = [];
  }
}

async function buildTypefaceRow(row, rowData, columns, deps) {
  const { docStyles, contentVar } = deps;
  for (const col of columns) {
    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'SPECIMEN': {
        // Specimen text in the resolved font family
        const specimenT = figma.createText();
        specimenT.characters = 'The quick brown fox 01234';
        try {
          await figma.loadFontAsync({ family: rowData.resolvedValue || 'Inter', style: 'Regular' });
          specimenT.fontName = { family: rowData.resolvedValue || 'Inter', style: 'Regular' };
        } catch (_) {}
        specimenT.fontSize = 22;
        specimenT.resize(col.width - 40, 1);
        specimenT.textAutoResize = 'HEIGHT';
        if (contentVar) bindPaintToVar(specimenT, contentVar);
        cell.appendChild(specimenT);
        break;
      }
      case 'VALUE': {
        const t = await makeText(rowData.resolvedValue || '—', col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
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
// Concatenate after _lib.js + primitives.js (phase 07). Resolves rows in-plugin; ctx omits variableMap.
// Fully dynamic — discovers color ramps, space, radius, elevation, typeface, and font-weight from
// whatever variable naming convention the file uses. No hardcoded paths required.
const RAMP_ORDER = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
const allVars = await figma.variables.getLocalVariablesAsync();
const p = Object.fromEntries(allVars.map((v) => [v.name, v.id]));
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const primColl = collections.find((c) => c.name === 'Primitives');
if (!primColl) throw new Error('Primitives collection missing');
const primitivesModeId = primColl.modes[0].modeId;
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section: textStyles.find((s) => s.name === 'Doc/Section')?.id || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code: textStyles.find((s) => s.name === 'Doc/Code')?.id || null,
  Caption: textStyles.find((s) => s.name === 'Doc/Caption')?.id || null,
};
function colorToHex(val) {
  if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
  const r = Math.round(val.r * 255);
  const g = Math.round(val.g * 255);
  const b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function resolveRaw(vid, m) {
  let v = await figma.variables.getVariableByIdAsync(vid);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
    if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      v = await figma.variables.getVariableByIdAsync(val.id);
      continue;
    }
    return val;
  }
  return null;
}
function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
async function floatAlias(vid, m) {
  const raw = await resolveRaw(vid, m);
  return typeof raw === 'number' ? raw : 0;
}

// ── Color ramp discovery ──────────────────────────────────────────────────────
// Finds all COLOR variables across ALL collections.
// Groups by "all path segments except the last numeric stop, minus a leading
// collection-prefix segment when the path has 3+ segments".
// e.g.  Color/blue/100      → ramp "blue",         stop "100"
//       Color/opacity/dark/100 → ramp "opacity/dark", stop "100"
//       color/primary/500   → ramp "primary",       stop "500"
//       primary/500         → ramp "primary",       stop "500"
const discoveredRamps = {};
for (const v of allVars) {
  if (v.resolvedType !== 'COLOR') continue;
  const parts = v.name.split('/');
  if (parts.length < 2) continue;
  const lastSeg = parts[parts.length - 1];
  if (!/^\d+$/.test(lastSeg)) continue;
  let rampParts;
  if (parts.length === 2) {
    rampParts = [parts[0]];
  } else {
    // Strip first "collection prefix" segment (e.g. "Color"), keep middle segments as ramp
    rampParts = parts.slice(1, -1);
  }
  const rampKey = rampParts.map((s) => s.toLowerCase()).join('/');
  if (!discoveredRamps[rampKey]) discoveredRamps[rampKey] = [];
  discoveredRamps[rampKey].push({ stop: lastSeg, tokenPath: v.name, vid: v.id });
}
const colorRamps = {};
const rampNames = Object.keys(discoveredRamps).sort((a, b) => {
  const ia = RAMP_ORDER.indexOf(a); const ib = RAMP_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1; if (ib !== -1) return 1;
  return a.localeCompare(b);
});
for (const ramp of rampNames) {
  const stops = discoveredRamps[ramp].sort((a, b) => parseInt(a.stop, 10) - parseInt(b.stop, 10));
  colorRamps[ramp] = [];
  for (const s of stops) {
    const v = await figma.variables.getVariableByIdAsync(s.vid);
    let raw = await resolveRaw(s.vid, primitivesModeId);
    if (!raw || typeof raw.r !== 'number') {
      const firstMode = Object.keys(v.valuesByMode)[0];
      raw = await resolveRaw(s.vid, firstMode);
    }
    colorRamps[ramp].push({ tokenPath: s.tokenPath, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) });
  }
}

// ── Space discovery ───────────────────────────────────────────────────────────
// Accepts Space/, Size/, space/, size/, spacing/, Spacing/ prefixes from any collection
const SPACE_PREFIXES = ['space/', 'Space/', 'size/', 'Size/', 'spacing/', 'Spacing/'];
const spaceVarObjs = allVars.filter((v) =>
  v.resolvedType === 'FLOAT' && SPACE_PREFIXES.some((pfx) => v.name.startsWith(pfx))
);
const spaceSorted = [];
for (const v of spaceVarObjs) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  spaceSorted.push({ v, px });
}
spaceSorted.sort((a, b) => a.px - b.px);
const space = spaceSorted.map(({ v, px }) => ({ tokenPath: v.name, resolvedPx: px, codeSyntax: readCS(v) }));

// ── Radius discovery ──────────────────────────────────────────────────────────
// Accepts Corner/, corner/, radius/, Radius/ prefixes from any collection
const RADIUS_PREFIXES = ['corner/', 'Corner/', 'radius/', 'Radius/'];
const radiusVarObjs = allVars.filter((v) =>
  v.resolvedType === 'FLOAT' && RADIUS_PREFIXES.some((pfx) => v.name.startsWith(pfx))
);
const radiusSorted = [];
for (const v of radiusVarObjs) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  radiusSorted.push({ v, px });
}
radiusSorted.sort((a, b) => a.px - b.px);
const radius = radiusSorted.map(({ v, px }) => {
  const isFullOrPill =
    v.name.toLowerCase().includes('full') || v.name.toLowerCase().includes('pill') || px >= 9999;
  return { tokenPath: v.name, resolvedPx: isFullOrPill ? 9999 : px, codeSyntax: readCS(v) };
});

// ── Elevation discovery ───────────────────────────────────────────────────────
// Accepts elevation/, Elevation/, elev/ prefixes from any collection
const ELEV_PREFIXES = ['elevation/', 'Elevation/', 'elev/'];
const elevation = [];
for (const v of allVars
  .filter((v) => v.resolvedType === 'FLOAT' && ELEV_PREFIXES.some((pfx) => v.name.startsWith(pfx)))
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  elevation.push({ tokenPath: v.name, resolvedValue: String(px), codeSyntax: readCS(v) });
}

// ── Typeface discovery ────────────────────────────────────────────────────────
// Finds all STRING variables whose name contains 'font', 'typeface', or 'face'
const typeface = [];
for (const v of allVars) {
  if (v.resolvedType !== 'STRING') continue;
  const lower = v.name.toLowerCase();
  if (!lower.includes('font') && !lower.includes('typeface') && !lower.includes('face')) continue;
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const raw = await resolveRaw(v.id, m);
  typeface.push({ tokenPath: v.name, resolvedValue: typeof raw === 'string' ? raw : '—', codeSyntax: readCS(v) });
}

// ── Font-weight discovery ─────────────────────────────────────────────────────
// Finds all FLOAT variables whose name contains 'weight', from any collection
const fontWeightVars = allVars.filter(
  (v) => v.resolvedType === 'FLOAT' && v.name.toLowerCase().includes('weight')
);
const fontWeight = [];
for (const v of fontWeightVars) {
  const col = collections.find((c) => c.id === v.variableCollectionId);
  const m = col ? col.modes[0].modeId : primitivesModeId;
  const px = await floatAlias(v.id, m);
  fontWeight.push({ tokenPath: v.name, resolvedValue: String(px), codeSyntax: readCS(v) });
}
fontWeight.sort((a, b) => parseFloat(a.resolvedValue) - parseFloat(b.resolvedValue));

// ── Page ──────────────────────────────────────────────────────────────────────
const primPage = figma.root.children.find((pg) => pg.name === '↳ Primitives');
if (!primPage || primPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Primitives): ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}
const ctx = {
  pageId: primPage.id,
  primitivesModeId,
  docStyles,
  rows: { colorRamps, space, radius, elevation, typeface, fontWeight },
};
const hadVm = 'variableMap' in ctx;
await build(ctx);
const tableGroups = primPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true,
  step: '15a-primitives',
  pageId: primPage.id,
  hadVariableMapBeforeBuild: hadVm,
  variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
  tableGroups,
  pageName: primPage.name,
};
