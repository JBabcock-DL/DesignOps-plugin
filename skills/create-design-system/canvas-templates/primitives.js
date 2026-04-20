// canvas-templates/primitives.js — Step 15a ↳ Primitives
// Builds 10 tables: 5 color ramps, space, radius, elevation, typeface, font-weight.
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx shape:
// {
//   pageId: string,
//   variableMap: { [tokenPath]: variableId },
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
        cell.layoutMode = 'HORIZONTAL';
        cell.counterAxisAlignItems = 'CENTER';
        const rect = figma.createRectangle();
        rect.name = 'swatch';
        rect.resize(28, 28);
        rect.cornerRadius = 8;
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
        specimenT.characters = rowData.tokenPath.includes('display') ? 'Aa Display' : 'Aa Body';
        try {
          await figma.loadFontAsync({ family: rowData.resolvedValue || 'Inter', style: 'Regular' });
          specimenT.fontName = { family: rowData.resolvedValue || 'Inter', style: 'Regular' };
        } catch (_) {}
        specimenT.fontSize = 20;
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
