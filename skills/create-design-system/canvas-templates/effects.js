// canvas-templates/effects.js — Step 15c — ↳ Effects page (shadows + shadow color)
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: (ignored at runtime — _lib ensureLocalVariableMapOnCtx overwrites from local file variables)
//   docStyles: { Section, TokenName, Code, Caption },
//   effectsCollectionId: string,
//   effectsLightModeId: string,
//   effectsDarkModeId: string,
//   rows: {
//     shadows: [{
//       tokenPath: string,       // e.g. shadow/sm/blur
//       tier: string,            // sm | md | lg | xl | 2xl  → Effect/shadow-{tier}
//       blurPx: number,
//       aliasPath: string,
//       codeSyntax: { WEB, ANDROID, iOS },
//     }],
//     shadowColor: [{
//       tokenPath: 'shadow/color',
//       resolvedHexLight: string,
//       resolvedHexDark: string,
//       rgbaLight: string,
//       rgbaDark: string,
//       codeSyntax: { WEB, ANDROID, iOS },
//     }],
//   }
// }

const SHADOWS_COLUMNS = [
  { id: 'TOKEN', width: 140 },
  { id: 'LIGHT', width: 180 },
  { id: 'DARK', width: 180 },
  { id: 'BLUR', width: 120 },
  { id: 'ALIAS →', width: 200 },
  { id: 'WEB', width: 300 },
  { id: 'ANDROID', width: 260 },
  { id: 'iOS', width: 260 },
];

const SHADOW_COLOR_COLUMNS = [
  { id: 'TOKEN', width: 320 },
  { id: 'LIGHT', width: 220 },
  { id: 'DARK', width: 220 },
  { id: 'WEB', width: 340 },
  { id: 'ANDROID', width: 280 },
  { id: 'iOS', width: 260 },
];

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  await ensureCanonicalMapOnCtx(ctx);
  const {
    pageId, variableMap, docStyles,
    effectsCollectionId, effectsLightModeId, effectsDarkModeId,
    themeCollectionId, themeLightModeId, themeDarkModeId,
    rows,
  } = ctx;

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

  const variables = {};
  for (var _ci = 0, _effectChromePaths = ['color/border/subtle', 'color/background/default', 'color/background/variant', 'color/background/content', 'color/background/content-muted', 'color/background/container-highest', 'color/background/inverse']; _ci < _effectChromePaths.length; _ci++) {
    var _cp = _effectChromePaths[_ci];
    var _ap = resolveCanonicalPath(_cp, variableMap, ctx.canonicalMap) || (_cp in variableMap ? _cp : null);
    if (_ap) variables[_cp] = await figma.variables.getVariableByIdAsync(variableMap[_ap]);
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  const rowDeps = {
    effectsCollectionId,
    effectsLightModeId,
    effectsDarkModeId,
    themeCollectionId,
    themeLightModeId,
    themeDarkModeId,
  };

  await buildTable({
    slug: 'effects/shadows',
    title: 'Shadows',
    caption: 'Drop shadow tiers — each alias points to an Elevation primitive.',
    columns: SHADOWS_COLUMNS,
    rows: rows.shadows || [],
    buildRow: buildShadowTierRow,
    rowDeps,
  }, content, variables, docStyles, variableMap);

  await buildTable({
    slug: 'effects/color',
    title: 'Shadow Color',
    caption: 'Shared shadow color referenced by every tier.',
    columns: SHADOW_COLOR_COLUMNS,
    rows: rows.shadowColor || [],
    buildRow: buildShadowColorRow,
    rowDeps,
  }, content, variables, docStyles, variableMap);

  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log('Canvas: Step 15c ↳ Effects — done (2 tables)');
}

// Shadow preview — 88x88 card wrapped in a full-width HORIZONTAL body cell so it honors
// col.width (§0.1.H). Card background binds to `color/background/default` Theme variable and
// applies Theme + Effects mode overrides so the card reads white/black across Light/Dark and
// the drop shadow follows shadow/color + shadow/{tier}/blur Effects modes (§0.9 shadow pair).
//
// Wrapper cell is tinted with `color/background/container` (a subtle gray that doesn't override
// Theme mode on the cell itself — the cell inherits the page's Light mode so the tint stays
// neutral for BOTH columns). This is the only reason the white LIGHT card is visible against
// the otherwise-white table body: without the tint the light card disappears into bg/default.
async function makeShadowPreviewCell(
  colWidth, tier, useDark,
  effectsCollectionId, effectsLightModeId, effectsDarkModeId,
  themeCollectionId, themeLightModeId, themeDarkModeId,
  cardBgVar, cellTintVar,
) {
  const cell = makeBodyCell(colWidth, 'HORIZONTAL');
  cell.counterAxisAlignItems = 'CENTER';
  cell.paddingLeft = 0;
  cell.paddingRight = 0;
  cell.paddingTop = 12;
  cell.paddingBottom = 12;
  cell.fills = [];
  if (cellTintVar) bindPaintToVar(cell, cellTintVar);

  const card = figma.createFrame();
  card.name = `shadow-preview/${useDark ? 'dark' : 'light'}`;
  card.layoutMode = 'HORIZONTAL';
  card.primaryAxisSizingMode = 'FIXED';
  card.counterAxisSizingMode = 'FIXED';
  card.resize(88, 88);
  card.cornerRadius = 8;
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
  if (cardBgVar) bindPaintToVar(card, cardBgVar);

  const styles = await figma.getLocalEffectStylesAsync();
  const es = styles.find(s => s.name === `Effect/shadow-${tier}`)
    || styles.find(s => new RegExp('shadow.*' + tier, 'i').test(s.name));
  if (es) card.effectStyleId = es.id;

  if (effectsCollectionId && (useDark ? effectsDarkModeId : effectsLightModeId)) {
    try {
      card.setExplicitVariableModeForCollection(effectsCollectionId, useDark ? effectsDarkModeId : effectsLightModeId);
    } catch (_) {}
  }
  if (themeCollectionId && (useDark ? themeDarkModeId : themeLightModeId)) {
    try {
      card.setExplicitVariableModeForCollection(themeCollectionId, useDark ? themeDarkModeId : themeLightModeId);
    } catch (_) {}
  }

  cell.appendChild(card);
  rehugCell(cell);
  return cell;
}

async function buildShadowTierRow(row, rowData, columns, deps) {
  const {
    variables, docStyles, contentVar, mutedVar,
    effectsCollectionId, effectsLightModeId, effectsDarkModeId,
    themeCollectionId, themeLightModeId, themeDarkModeId,
  } = deps;
  const tier = rowData.tier || 'sm';
  const bgDefaultVar = variables['color/background/default'];
  // Tint the preview cell with a subtle gray so the white LIGHT card doesn't disappear
  // into the table body (which is also `color/background/default` = white in Light mode).
  // We intentionally do NOT override Theme mode on the wrapper — so the tint stays neutral
  // gray for both LIGHT and DARK columns; only the inner card flips Theme + Effects modes.
  const cellTintVar = variables['color/background/container-highest'] || variables['color/background/variant'];

  for (const col of columns) {
    if (col.id === 'LIGHT' || col.id === 'DARK') {
      const cell = await makeShadowPreviewCell(
        col.width, tier, col.id === 'DARK',
        effectsCollectionId, effectsLightModeId, effectsDarkModeId,
        themeCollectionId, themeLightModeId, themeDarkModeId,
        bgDefaultVar, cellTintVar,
      );
      row.appendChild(cell);
      continue;
    }

    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'BLUR': {
        const t = await makeText(`${rowData.blurPx}px`, col.width, docStyles.Code || null, contentVar);
        cell.appendChild(t);
        break;
      }
      case 'ALIAS →': {
        const t = await makeText(rowData.aliasPath || '—', col.width, docStyles.Code || null, mutedVar);
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

async function buildShadowColorRow(row, rowData, columns, deps) {
  const {
    docStyles, contentVar, variableMap,
    effectsCollectionId, effectsLightModeId, effectsDarkModeId,
  } = deps;
  const shadowColorId = variableMap[rowData.tokenPath];

  for (const col of columns) {
    if (col.id === 'LIGHT') {
      const cell = await makeThemeModeColumn(
        col.width, 'light', shadowColorId, rowData.resolvedHexLight,
        docStyles, contentVar, effectsCollectionId, effectsLightModeId,
      );
      row.appendChild(cell);
      continue;
    }
    if (col.id === 'DARK') {
      const cell = await makeThemeModeColumn(
        col.width, 'dark', shadowColorId, rowData.resolvedHexDark,
        docStyles, contentVar, effectsCollectionId, effectsDarkModeId,
      );
      row.appendChild(cell);
      continue;
    }

    const cell = makeBodyCell(col.width, 'VERTICAL');
    switch (col.id) {
      case 'TOKEN': {
        const t = await makeText(rowData.tokenPath, col.width, docStyles.TokenName || null, contentVar);
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
