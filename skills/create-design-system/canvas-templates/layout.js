// canvas-templates/layout.js — Step 15c — ↳ Layout page (spacing + radius tables)
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: { [tokenPath]: variableId },  // optional — _lib ensureLocalVariableMapOnCtx
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

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  const { pageId, variableMap, docStyles, rows } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const variables = {};
  const chromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted', 'color/neutral/100', 'color/primary/200',
  ];
  for (const path of chromePaths) {
    if (variableMap[path]) {
      variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
    }
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  await buildTable({
    slug: 'layout/spacing',
    title: 'Spacing',
    caption: 'Semantic spacing aliases mapped to Primitive space steps.',
    columns: SPACING_COLUMNS,
    rows: rows.spacing || [],
    buildRow: buildLayoutSpacingRow,
  }, content, variables, docStyles, variableMap);

  await buildTable({
    slug: 'layout/radius',
    title: 'Radius',
    caption: 'Semantic radius aliases mapped to Primitive corner steps.',
    columns: RADIUS_COLUMNS,
    rows: rows.radius || [],
    buildRow: buildLayoutRadiusRow,
  }, content, variables, docStyles, variableMap);

  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log('Canvas: Step 15c ↳ Layout — done (2 tables)');
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
