// canvas-templates/primitives.js — Step 15a ↳ Primitives
// Fully dynamic — draws whatever is present in ctx.rows. All table sections are optional.
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx shape:
// {
//   pageId: string,
//   variableMap: (ignored at runtime — _lib ensureLocalVariableMapOnCtx overwrites from local file variables)
//   docStyles: { Section: id, TokenName: id, Code: id, Caption: id },
//   rows: {
//     colorRamps: { [ramp]: [{ tokenPath, resolvedHex, codeSyntax: {WEB,ANDROID,iOS} }] },
//     space?:     [{ tokenPath, resolvedPx, codeSyntax }],
//     radius?:    [{ tokenPath, resolvedPx, codeSyntax }],
//     elevation?: [{ tokenPath, resolvedValue, codeSyntax }],
//     typeface?:  [{ tokenPath, resolvedValue, codeSyntax }],
//     fontWeight?:[{ tokenPath, resolvedValue, codeSyntax }],
//   }
// }

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  await ensureCanonicalMapOnCtx(ctx);
  const { pageId, variableMap, primitivesModeId, docStyles, rows } = ctx;

  // Fuzzy docStyles fallback — augment any missing slots from local text styles
  if (!docStyles.Section || !docStyles.TokenName || !docStyles.Code || !docStyles.Caption) {
    var _ts = await figma.getLocalTextStylesAsync();
    if (!docStyles.Section)   { var _s = _ts.find(function(s) { return /^doc.*section/i.test(s.name); }); if (_s) docStyles.Section = _s.id; }
    if (!docStyles.TokenName) { var _tn = _ts.find(function(s) { return /^doc.*(token|heading)/i.test(s.name); }); if (_tn) docStyles.TokenName = _tn.id; }
    if (!docStyles.Code)      { var _c = _ts.find(function(s) { return /^doc.*(code|mono)/i.test(s.name); }); if (_c) docStyles.Code = _c.id; }
    if (!docStyles.Caption)   { var _cap = _ts.find(function(s) { return /^doc.*(caption|label|body)/i.test(s.name); }); if (_cap) docStyles.Caption = _cap.id; }
  }

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);

  const page = figma.currentPage;

  // Load fonts
  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  // Resolve frequently-used chrome variables — canonical path first, then alias map fallback
  const variables = {};
  const chromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted',
    'color/neutral/100', 'color/primary/200',
  ];
  for (var _ci = 0; _ci < chromePaths.length; _ci++) {
    var _cp = chromePaths[_ci];
    var _ap = resolveCanonicalPath(_cp, variableMap, ctx.canonicalMap);
    if (_ap) variables[_cp] = await figma.variables.getVariableByIdAsync(variableMap[_ap]);
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

  // ─── 6–10: Optional tables (drawn only when runner passes them) ──────────

  const spaceColumns = [
    { id: 'TOKEN',   width: 260 }, { id: 'VALUE',   width: 100 },
    { id: 'PREVIEW', width: 260 }, { id: 'WEB',     width: 340 },
    { id: 'ANDROID', width: 320 }, { id: 'iOS',     width: 360 },
  ];
  if (rows.space && rows.space.length > 0) {
    await buildTable({ slug: 'primitives/space', title: 'Space', caption: 'Spacing scale on a 4px base grid.',
      columns: spaceColumns, rows: rows.space, buildRow: buildSpaceRow,
    }, content, variables, docStyles, variableMap);
  }

  const radiusColumns = [
    { id: 'TOKEN',   width: 260 }, { id: 'VALUE',   width: 100 },
    { id: 'PREVIEW', width: 260 }, { id: 'WEB',     width: 340 },
    { id: 'ANDROID', width: 320 }, { id: 'iOS',     width: 360 },
  ];
  if (rows.radius && rows.radius.length > 0) {
    await buildTable({ slug: 'primitives/radius', title: 'Corner Radius',
      caption: 'Corner rounding primitives from square through pill.',
      columns: radiusColumns, rows: rows.radius, buildRow: buildRadiusRow,
    }, content, variables, docStyles, variableMap);
  }

  const elevationColumns = [
    { id: 'TOKEN',   width: 260 }, { id: 'VALUE',   width: 100 },
    { id: 'WEB',     width: 400 }, { id: 'ANDROID', width: 380 }, { id: 'iOS', width: 500 },
  ];
  if (rows.elevation && rows.elevation.length > 0) {
    await buildTable({ slug: 'primitives/elevation', title: 'Elevation',
      caption: 'Raw blur steps consumed by shadow/*/blur aliases in Effects.',
      columns: elevationColumns, rows: rows.elevation, buildRow: buildMonoRow,
    }, content, variables, docStyles, variableMap);
  }

  const typefaceColumns = [
    { id: 'TOKEN',    width: 320 }, { id: 'SPECIMEN', width: 460 }, { id: 'VALUE',   width: 200 },
    { id: 'WEB',      width: 320 }, { id: 'ANDROID',  width: 160 }, { id: 'iOS',     width: 180 },
  ];
  if (rows.typeface && rows.typeface.length > 0) {
    await buildTable({ slug: 'primitives/typeface', title: 'Typeface',
      caption: 'Font family primitives. Display for headings, Body for paragraph text.',
      columns: typefaceColumns, rows: rows.typeface, buildRow: buildTypefaceRow,
    }, content, variables, docStyles, variableMap);
  }

  const fontWeightColumns = [
    { id: 'TOKEN',   width: 260 }, { id: 'VALUE',   width: 100 },
    { id: 'WEB',     width: 400 }, { id: 'ANDROID', width: 380 }, { id: 'iOS',     width: 500 },
  ];
  if (rows.fontWeight && rows.fontWeight.length > 0) {
    await buildTable({ slug: 'primitives/font-weight', title: 'Font weight',
      caption: 'Shared emphasis weight (Typography Body/*/emphasis aliases this Primitive).',
      columns: fontWeightColumns, rows: rows.fontWeight, buildRow: buildMonoRow,
    }, content, variables, docStyles, variableMap);
  }

  // ── Restore auto-layout (C2) ───────────────────────────────────────────────
  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log(`Canvas: Step 15a ↳ Primitives — done`);
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
