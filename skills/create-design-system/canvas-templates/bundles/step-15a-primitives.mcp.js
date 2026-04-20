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
function makeBodyCell(colWidth, layoutMode) {
  const cell = figma.createFrame();
  cell.layoutMode = layoutMode || 'VERTICAL';
  cell.primaryAxisSizingMode = 'AUTO';   // Hug height
  cell.counterAxisSizingMode = 'FIXED';  // Fixed colWidth
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

// Re-assert Hug after appending child (§0.1 post-appendChild re-assert).
function rehugCell(cell) {
  cell.primaryAxisSizingMode = 'AUTO';
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

  const rampMeta = [
    { ramp: 'primary',   title: 'Primary',   caption: 'Brand anchor — used for the most prominent actions, links, and focus.' },
    { ramp: 'secondary', title: 'Secondary',  caption: 'Supporting brand color for secondary actions and decorative surfaces.' },
    { ramp: 'tertiary',  title: 'Tertiary',   caption: 'Accent hue for highlights, chips, and illustrative moments.' },
    { ramp: 'error',     title: 'Error',      caption: 'Destructive and error feedback — do not use for incidental UI.' },
    { ramp: 'neutral',   title: 'Neutral',    caption: 'Greyscale foundation for text, borders, and calm surfaces.' },
  ];

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
        // Bar width bound to space variable (or resolved px, capped at col.width - 40)
        cell.layoutMode = 'HORIZONTAL';
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
        cell.layoutMode = 'HORIZONTAL';
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
const RAMPS = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
const STOPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
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
    const val = v.valuesByMode[m];
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
async function crow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const raw = await resolveRaw(v.id, primitivesModeId);
  return { tokenPath: tp, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) };
}
const colorRamps = {};
for (const r of RAMPS) {
  colorRamps[r] = [];
  for (const s of STOPS) {
    const tp = 'color/' + r + '/' + s;
    if (p[tp]) colorRamps[r].push(await crow(tp));
  }
}
async function frow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const px = await floatAlias(v.id, primitivesModeId);
  return { tokenPath: tp, resolvedPx: px, codeSyntax: readCS(v) };
}
const space = [];
for (const n of allVars
  .map((v) => v.name)
  .filter((n) => n.startsWith('Space/'))
  .sort((a, b) => parseInt(a.split('/')[1], 10) - parseInt(b.split('/')[1], 10))) {
  space.push(await frow(n));
}
const radius = [];
for (const n of allVars.map((v) => v.name).filter((n) => n.startsWith('Corner/')).sort()) {
  radius.push(await frow(n));
}
const elevation = [];
for (const n of allVars.map((v) => v.name).filter((n) => n.startsWith('elevation/')).sort()) {
  const v = await figma.variables.getVariableByIdAsync(p[n]);
  const px = await floatAlias(v.id, primitivesModeId);
  elevation.push({ tokenPath: n, resolvedValue: String(px), codeSyntax: readCS(v) });
}
async function srow(tp) {
  const v = await figma.variables.getVariableByIdAsync(p[tp]);
  const raw = await resolveRaw(v.id, primitivesModeId);
  const rv = typeof raw === 'string' ? raw : '\u2014';
  return { tokenPath: tp, resolvedValue: rv, codeSyntax: readCS(v) };
}
const typeface = [];
for (const tp of ['typeface/display', 'typeface/body']) {
  if (p[tp]) typeface.push(await srow(tp));
}
const fontWeight = [];
if (p['font/weight/medium']) {
  const v = await figma.variables.getVariableByIdAsync(p['font/weight/medium']);
  fontWeight.push({
    tokenPath: 'font/weight/medium',
    resolvedValue: String(await floatAlias(v.id, primitivesModeId)),
    codeSyntax: readCS(v),
  });
}
const primPage = figma.root.children.find((pg) => pg.name === '\u21B3 Primitives');
if (!primPage || primPage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected \\u21B3 Primitives): ' +
      figma.root.children
        .filter((c) => c.type === 'PAGE')
        .map((c) => c.name)
        .join(' | '),
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
