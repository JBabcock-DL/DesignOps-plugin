// canvas-templates/theme.js — Step 15b ↳ Theme
// Seven semantic tables: background, border, primary, secondary, tertiary, error, component.
// Call shape: [_lib.js source] + [this source] + "const ctx = " + JSON.stringify(ctx) + "; build(ctx);"
//
// ctx:
// {
//   pageId: string,
//   variableMap: { [tokenPath]: variableId },  // optional — _lib ensureLocalVariableMapOnCtx
//   docStyles: { Section, TokenName, Code, Caption },
//   themeCollectionId: string,
//   themeLightModeId: string,
//   themeDarkModeId: string,
//   rows: {
//     background: Row[],
//     border: Row[],
//     primary: Row[],
//     secondary: Row[],
//     tertiary: Row[],
//     error: Row[],
//     component: Row[],
//   }
// }
// Row: { tokenPath, resolvedHexLight, resolvedHexDark, aliasLight, aliasDark, codeSyntax: {WEB,ANDROID,iOS} }
//      themeVariableId optional override; defaults to variableMap[tokenPath].

const THEME_COLUMNS = [
  { id: 'TOKEN', width: 320 },
  { id: 'LIGHT', width: 140 },
  { id: 'DARK', width: 140 },
  { id: 'ALIAS →', width: 260 },
  { id: 'WEB', width: 320 },
  { id: 'ANDROID', width: 220 },
  { id: 'iOS', width: 240 },
];

const THEME_GROUPS = [
  { key: 'background', slug: 'theme/background', title: 'Background', caption: 'Surfaces, containers, scrims, and overlays.' },
  { key: 'border', slug: 'theme/border', title: 'Border', caption: 'Stroke tokens for dividers and outlines.' },
  { key: 'primary', slug: 'theme/primary', title: 'Primary', caption: 'Primary brand roles and their on-color companions.' },
  { key: 'secondary', slug: 'theme/secondary', title: 'Secondary', caption: 'Secondary brand roles for supporting actions.' },
  { key: 'tertiary', slug: 'theme/tertiary', title: 'Tertiary', caption: 'Tertiary / decorative accent roles.' },
  { key: 'error', slug: 'theme/error', title: 'Error', caption: 'Feedback color for destructive and error states.' },
  { key: 'component', slug: 'theme/component', title: 'Component', caption: 'shadcn-aligned component tokens (ring, input, muted, popover).' },
];

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  const {
    pageId, variableMap, docStyles,
    themeCollectionId, themeLightModeId, themeDarkModeId,
    rows,
  } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const variables = {};
  const chromePaths = [
    'color/border/subtle', 'color/background/default', 'color/background/variant',
    'color/background/content', 'color/background/content-muted',
  ];
  for (const path of chromePaths) {
    if (variableMap[path]) {
      variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
    }
  }

  const content = await buildPageContent(page);
  content.layoutMode = 'NONE';

  const rowDeps = {
    themeCollectionId,
    themeLightModeId,
    themeDarkModeId,
  };

  for (const g of THEME_GROUPS) {
    const tableRows = rows[g.key] || [];
    await buildTable({
      slug: g.slug,
      title: g.title,
      caption: g.caption,
      columns: THEME_COLUMNS,
      rows: tableRows,
      buildRow: buildThemeRow,
      rowDeps,
    }, content, variables, docStyles, variableMap);
  }

  content.layoutMode = 'VERTICAL';
  content.layoutSizingVertical = 'HUG';

  console.log('Canvas: Step 15b ↳ Theme — done (7 tables)');
}

async function buildThemeRow(row, rowData, columns, deps) {
  const {
    docStyles, contentVar, mutedVar, variableMap,
    themeCollectionId, themeLightModeId, themeDarkModeId,
  } = deps;

  const themeVarId = rowData.themeVariableId || variableMap[rowData.tokenPath];

  for (const col of columns) {
    if (col.id === 'LIGHT') {
      const cell = await makeThemeModeColumn(
        col.width, 'light', themeVarId, rowData.resolvedHexLight,
        docStyles, contentVar, themeCollectionId, themeLightModeId,
      );
      row.appendChild(cell);
      continue;
    }
    if (col.id === 'DARK') {
      const cell = await makeThemeModeColumn(
        col.width, 'dark', themeVarId, rowData.resolvedHexDark,
        docStyles, contentVar, themeCollectionId, themeDarkModeId,
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
      case 'ALIAS →': {
        cell.itemSpacing = 2;
        const a1 = await makeText(`L → ${rowData.aliasLight || '—'}`, col.width, docStyles.Code || null, mutedVar);
        const a2 = await makeText(`D → ${rowData.aliasDark || '—'}`, col.width, docStyles.Code || null, mutedVar);
        cell.appendChild(a1);
        cell.appendChild(a2);
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
