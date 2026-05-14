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
  await ensureCanonicalMapOnCtx(ctx);
  const { pageId, variableMap, docStyles, rows } = ctx;

  // Fuzzy docStyles fallback
  if (!docStyles.Section || !docStyles.TokenName || !docStyles.Code || !docStyles.Caption) {
    var _ts = await figma.getLocalTextStylesAsync();
    if (!docStyles.Section)   { var _s = _ts.find(function(s) { return /^doc.*section/i.test(s.name); }); if (_s) docStyles.Section = _s.id; }
    if (!docStyles.TokenName) { var _tn = _ts.find(function(s) { return /^doc.*(token|heading)/i.test(s.name); }); if (_tn) docStyles.TokenName = _tn.id; }
    if (!docStyles.Code)      { var _c = _ts.find(function(s) { return /^doc.*(code|mono)/i.test(s.name); }); if (_c) docStyles.Code = _c.id; }
    if (!docStyles.Caption)   { var _cap = _ts.find(function(s) { return /^doc.*(caption|label|body)/i.test(s.name); }); if (_cap) docStyles.Caption = _cap.id; }
  }

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
  for (var _ci = 0, _tChromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted', 'color/primary/default',
  ]; _ci < _tChromePaths.length; _ci++) {
    var _cp = _tChromePaths[_ci];
    var _ap = resolveCanonicalPath(_cp, variableMap, ctx.canonicalMap);
    if (_ap) variables[_cp] = await figma.variables.getVariableByIdAsync(variableMap[_ap]);
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
