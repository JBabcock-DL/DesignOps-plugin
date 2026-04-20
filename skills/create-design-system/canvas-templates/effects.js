// canvas-templates/effects.js — Step 15c — ↳ Effects page (shadows + shadow color)
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: { [tokenPath]: variableId },  // optional — _lib ensureLocalVariableMapOnCtx
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
  const {
    pageId, variableMap, docStyles,
    effectsCollectionId, effectsLightModeId, effectsDarkModeId,
    rows,
  } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const variables = {};
  for (const path of ['color/border/subtle', 'color/background/default', 'color/background/variant', 'color/background/content', 'color/background/content-muted']) {
    if (variableMap[path]) variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  const rowDeps = {
    effectsCollectionId,
    effectsLightModeId,
    effectsDarkModeId,
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

async function makeShadowPreviewCard(tier, effectsCollectionId, lightModeId, darkModeId, useDark) {
  const frame = figma.createFrame();
  frame.name = `shadow-preview/${useDark ? 'dark' : 'light'}`;
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(88, 88);
  frame.cornerRadius = 8;
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
  const styles = await figma.getLocalEffectStylesAsync();
  const es = styles.find(s => s.name === `Effect/shadow-${tier}`);
  if (es) frame.effectStyleId = es.id;
  if (effectsCollectionId && (useDark ? darkModeId : lightModeId)) {
    try {
      frame.setExplicitVariableModeForCollection(effectsCollectionId, useDark ? darkModeId : lightModeId);
    } catch (_) {}
  }
  return frame;
}

async function buildShadowTierRow(row, rowData, columns, deps) {
  const {
    docStyles, contentVar, mutedVar,
    effectsCollectionId, effectsLightModeId, effectsDarkModeId,
  } = deps;
  const tier = rowData.tier || 'sm';

  for (const col of columns) {
    if (col.id === 'LIGHT') {
      const card = await makeShadowPreviewCard(tier, effectsCollectionId, effectsLightModeId, effectsDarkModeId, false);
      row.appendChild(card);
      continue;
    }
    if (col.id === 'DARK') {
      const card = await makeShadowPreviewCard(tier, effectsCollectionId, effectsLightModeId, effectsDarkModeId, true);
      row.appendChild(card);
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
