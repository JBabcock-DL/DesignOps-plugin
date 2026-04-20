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

// Walk VARIABLE_ALIAS chain until we reach a numeric or string literal.
async function resolveNumericAlias(variableId, modeId) {
  let variable = await figma.variables.getVariableByIdAsync(variableId);
  for (let depth = 0; depth < 10; depth++) {
    const value = variable.valuesByMode[modeId];
    if (!value || value.type !== 'VARIABLE_ALIAS') return value;
    variable = await figma.variables.getVariableByIdAsync(value.id);
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

// §0.5: HORIZONTAL + FIXED/FIXED + resize(colWidth, 56) BEFORE appending text.
async function makeHeaderCell(colWidth, label, docStyles, variables) {
  const cell = figma.createFrame();
  cell.name = `cell/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  cell.layoutMode = 'HORIZONTAL';
  cell.primaryAxisSizingMode = 'FIXED';
  cell.counterAxisSizingMode = 'FIXED';
  cell.resize(colWidth, 56);
  cell.paddingLeft = 20;
  cell.paddingRight = 20;
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
  cell.paddingLeft = 20;
  cell.paddingRight = 20;
  cell.paddingTop = 4;
  cell.paddingBottom = 4;
  cell.itemSpacing = 4;
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
  row.minHeight = 64;
  row.paddingTop = 16;
  row.paddingBottom = 16;
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
    titleText.name = 'title';
    group.appendChild(titleText);
  }
  if (caption) {
    const capText = await makeText(caption, 1640, docStyles.Caption || null, mutedVar);
    capText.name = 'caption';
    group.appendChild(capText);
  }

  // ── outer table frame ───────────────────────────────────────────────────
  const table = figma.createFrame();
  table.name = `doc/table/${slug}`;
  table.layoutMode = 'VERTICAL';
  table.primaryAxisSizingMode = 'AUTO';
  table.counterAxisSizingMode = 'FIXED';
  table.resizeWithoutConstraints(1640, 1);
  table.cornerRadius = 12;
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
  header.resize(1640, 56);
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
// Concatenate after _lib.js + theme.js (phase 07). Resolves Theme rows in-plugin; ctx omits variableMap.
const THEME_DATA = {
  rows: [
    { path: 'color/background/dim',                light: 'color/neutral/100', dark: 'color/neutral/950', codeSyntax: { WEB: 'var(--color-background-dim)',              ANDROID: 'surface-dim',                 iOS: '.Background.dim' } },
    { path: 'color/background/default',            light: 'color/neutral/50',  dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-background)',                  ANDROID: 'surface',                     iOS: '.Background.default' } },
    { path: 'color/background/bright',             light: 'color/neutral/50',  dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-bright)',           ANDROID: 'surface-bright',              iOS: '.Background.bright' } },
    { path: 'color/background/container-lowest',   light: 'color/neutral/50',  dark: 'color/neutral/950', codeSyntax: { WEB: 'var(--color-background-container-lowest)', ANDROID: 'surface-container-lowest',    iOS: '.Background.lowest' } },
    { path: 'color/background/container-low',      light: 'color/neutral/100', dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-background-container-low)',    ANDROID: 'surface-container-low',       iOS: '.Background.low' } },
    { path: 'color/background/container',          light: 'color/neutral/200', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-container)',        ANDROID: 'surface-container',           iOS: '.Background.mid' } },
    { path: 'color/background/container-high',     light: 'color/neutral/300', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-background-container-high)',   ANDROID: 'surface-container-high',      iOS: '.Background.high' } },
    { path: 'color/background/container-highest',  light: 'color/neutral/50',  dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-container-highest)',ANDROID: 'surface-container-highest',   iOS: '.Background.highest' } },
    { path: 'color/background/variant',            light: 'color/neutral/100', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-variant)',          ANDROID: 'surface-variant',             iOS: '.Background.variant' } },
    { path: 'color/background/content',            light: 'color/neutral/900', dark: 'color/neutral/50',  codeSyntax: { WEB: 'var(--color-content)',                     ANDROID: 'on-surface',                  iOS: '.Foreground.primary' } },
    { path: 'color/background/content-muted',      light: 'color/neutral/500', dark: 'color/neutral/400', codeSyntax: { WEB: 'var(--color-content-muted)',               ANDROID: 'on-surface-variant',          iOS: '.Foreground.secondary' } },
    { path: 'color/background/inverse',            light: 'color/neutral/950', dark: 'color/neutral/50',  codeSyntax: { WEB: 'var(--color-inverse-surface)',             ANDROID: 'inverse-surface',             iOS: '.Background.inverse' } },
    { path: 'color/background/inverse-content',    light: 'color/neutral/50',  dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-inverse-content)',             ANDROID: 'inverse-on-surface',          iOS: '.Foreground.inverse' } },
    { path: 'color/background/inverse-primary',    light: 'color/primary/300', dark: 'color/primary/700', codeSyntax: { WEB: 'var(--color-inverse-brand)',               ANDROID: 'inverse-primary',             iOS: '.Primary.inverse' } },
    { path: 'color/border/default',                light: 'color/neutral/200', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-border)',                      ANDROID: 'outline',                     iOS: '.Border.default' } },
    { path: 'color/border/subtle',                 light: 'color/neutral/100', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-border-subtle)',               ANDROID: 'outline-variant',             iOS: '.Border.subtle' } },
    { path: 'color/primary/default',               light: 'color/primary/500', dark: 'color/primary/400', codeSyntax: { WEB: 'var(--color-primary)',                     ANDROID: 'primary',                     iOS: '.Primary.default' } },
    { path: 'color/primary/content',               light: 'color/primary/50',  dark: 'color/primary/50',  codeSyntax: { WEB: 'var(--color-on-primary)',                  ANDROID: 'on-primary',                  iOS: '.Primary.on' } },
    { path: 'color/primary/subtle',                light: 'color/primary/100', dark: 'color/primary/800', codeSyntax: { WEB: 'var(--color-primary-subtle)',              ANDROID: 'primary-container',           iOS: '.Primary.subtle' } },
    { path: 'color/primary/on-subtle',             light: 'color/primary/900', dark: 'color/primary/100', codeSyntax: { WEB: 'var(--color-on-primary-subtle)',           ANDROID: 'on-primary-container',        iOS: '.Primary.on.subtle' } },
    { path: 'color/primary/fixed',                 light: 'color/primary/100', dark: 'color/primary/300', codeSyntax: { WEB: 'var(--color-primary-fixed)',               ANDROID: 'primary-fixed',               iOS: '.Primary.fixed' } },
    { path: 'color/primary/fixed-dim',             light: 'color/primary/200', dark: 'color/primary/800', codeSyntax: { WEB: 'var(--color-primary-fixed-dim)',           ANDROID: 'primary-fixed-dim',           iOS: '.Primary.fixed.dim' } },
    { path: 'color/primary/on-fixed',              light: 'color/primary/900', dark: 'color/primary/100', codeSyntax: { WEB: 'var(--color-on-primary-fixed)',            ANDROID: 'on-primary-fixed',            iOS: '.Primary.on.fixed' } },
    { path: 'color/primary/on-fixed-variant',      light: 'color/primary/800', dark: 'color/primary/200', codeSyntax: { WEB: 'var(--color-on-primary-fixed-muted)',      ANDROID: 'on-primary-fixed-variant',    iOS: '.Primary.on.fixed.muted' } },
    { path: 'color/secondary/default',             light: 'color/secondary/500', dark: 'color/secondary/400', codeSyntax: { WEB: 'var(--color-secondary)',              ANDROID: 'secondary',                  iOS: '.Secondary.default' } },
    { path: 'color/secondary/content',             light: 'color/secondary/50',  dark: 'color/secondary/50',  codeSyntax: { WEB: 'var(--color-on-secondary)',           ANDROID: 'on-secondary',               iOS: '.Secondary.on' } },
    { path: 'color/secondary/subtle',              light: 'color/secondary/100', dark: 'color/secondary/800', codeSyntax: { WEB: 'var(--color-secondary-subtle)',       ANDROID: 'secondary-container',        iOS: '.Secondary.subtle' } },
    { path: 'color/secondary/on-subtle',           light: 'color/secondary/900', dark: 'color/secondary/100', codeSyntax: { WEB: 'var(--color-on-secondary-subtle)',    ANDROID: 'on-secondary-container',     iOS: '.Secondary.on.subtle' } },
    { path: 'color/secondary/fixed',               light: 'color/secondary/100', dark: 'color/secondary/300', codeSyntax: { WEB: 'var(--color-secondary-fixed)',        ANDROID: 'secondary-fixed',            iOS: '.Secondary.fixed' } },
    { path: 'color/secondary/fixed-dim',           light: 'color/secondary/200', dark: 'color/secondary/800', codeSyntax: { WEB: 'var(--color-secondary-fixed-dim)',    ANDROID: 'secondary-fixed-dim',        iOS: '.Secondary.fixed.dim' } },
    { path: 'color/secondary/on-fixed',            light: 'color/secondary/900', dark: 'color/secondary/100', codeSyntax: { WEB: 'var(--color-on-secondary-fixed)',     ANDROID: 'on-secondary-fixed',         iOS: '.Secondary.on.fixed' } },
    { path: 'color/secondary/on-fixed-variant',    light: 'color/secondary/800', dark: 'color/secondary/200', codeSyntax: { WEB: 'var(--color-on-secondary-fixed-muted)',ANDROID: 'on-secondary-fixed-variant',iOS: '.Secondary.on.fixed.muted' } },
    { path: 'color/tertiary/default',              light: 'color/tertiary/500', dark: 'color/tertiary/400', codeSyntax: { WEB: 'var(--color-accent)',                   ANDROID: 'tertiary',                   iOS: '.Tertiary.default' } },
    { path: 'color/tertiary/content',              light: 'color/tertiary/50',  dark: 'color/tertiary/50',  codeSyntax: { WEB: 'var(--color-on-accent)',                ANDROID: 'on-tertiary',                iOS: '.Tertiary.on' } },
    { path: 'color/tertiary/subtle',               light: 'color/tertiary/100', dark: 'color/tertiary/800', codeSyntax: { WEB: 'var(--color-accent-subtle)',            ANDROID: 'tertiary-container',         iOS: '.Tertiary.subtle' } },
    { path: 'color/tertiary/on-subtle',            light: 'color/tertiary/900', dark: 'color/tertiary/100', codeSyntax: { WEB: 'var(--color-on-accent-subtle)',         ANDROID: 'on-tertiary-container',      iOS: '.Tertiary.on.subtle' } },
    { path: 'color/tertiary/fixed',                light: 'color/tertiary/100', dark: 'color/tertiary/300', codeSyntax: { WEB: 'var(--color-accent-fixed)',             ANDROID: 'tertiary-fixed',             iOS: '.Tertiary.fixed' } },
    { path: 'color/tertiary/fixed-dim',            light: 'color/tertiary/200', dark: 'color/tertiary/800', codeSyntax: { WEB: 'var(--color-accent-fixed-dim)',         ANDROID: 'tertiary-fixed-dim',         iOS: '.Tertiary.fixed.dim' } },
    { path: 'color/tertiary/on-fixed',             light: 'color/tertiary/900', dark: 'color/tertiary/100', codeSyntax: { WEB: 'var(--color-on-accent-fixed)',          ANDROID: 'on-tertiary-fixed',          iOS: '.Tertiary.on.fixed' } },
    { path: 'color/tertiary/on-fixed-variant',     light: 'color/tertiary/800', dark: 'color/tertiary/200', codeSyntax: { WEB: 'var(--color-on-accent-fixed-muted)',    ANDROID: 'on-tertiary-fixed-variant',  iOS: '.Tertiary.on.fixed.muted' } },
    { path: 'color/error/default',                 light: 'color/error/600', dark: 'color/error/400', codeSyntax: { WEB: 'var(--color-danger)',                         ANDROID: 'error',                       iOS: '.Status.error' } },
    { path: 'color/error/content',                 light: 'color/error/50',  dark: 'color/error/50',  codeSyntax: { WEB: 'var(--color-on-danger)',                      ANDROID: 'on-error',                    iOS: '.Status.on.error' } },
    { path: 'color/error/subtle',                  light: 'color/error/100', dark: 'color/error/900', codeSyntax: { WEB: 'var(--color-danger-subtle)',                  ANDROID: 'error-container',             iOS: '.Status.error.subtle' } },
    { path: 'color/error/on-subtle',               light: 'color/error/900', dark: 'color/error/100', codeSyntax: { WEB: 'var(--color-on-danger-subtle)',               ANDROID: 'on-error-container',          iOS: '.Status.on.error.subtle' } },
    { path: 'color/error/fixed',                   light: 'color/error/100', dark: 'color/error/300', codeSyntax: { WEB: 'var(--color-danger-fixed)',                   ANDROID: 'error-fixed',                 iOS: '.Status.error.fixed' } },
    { path: 'color/error/fixed-dim',               light: 'color/error/200', dark: 'color/error/800', codeSyntax: { WEB: 'var(--color-danger-fixed-dim)',               ANDROID: 'error-fixed-dim',             iOS: '.Status.error.fixed.dim' } },
    { path: 'color/error/on-fixed',                light: 'color/error/900', dark: 'color/error/100', codeSyntax: { WEB: 'var(--color-on-danger-fixed)',                ANDROID: 'on-error-fixed',              iOS: '.Status.on.error.fixed' } },
    { path: 'color/error/on-fixed-variant',        light: 'color/error/800', dark: 'color/error/200', codeSyntax: { WEB: 'var(--color-on-danger-fixed-muted)',          ANDROID: 'on-error-fixed-variant',      iOS: '.Status.on.error.fixed.muted' } },
    { path: 'color/component/input',               light: 'color/neutral/200', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-field)',                    ANDROID: 'input',                       iOS: '.Component.field' } },
    { path: 'color/component/ring',                light: 'color/primary/500', dark: 'color/primary/400', codeSyntax: { WEB: 'var(--color-focus-ring)',               ANDROID: 'ring',                        iOS: '.Component.ring' } },
    { path: 'color/component/sidebar',             light: 'color/neutral/100', dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-sidebar)',                  ANDROID: 'sidebar',                     iOS: '.Component.sidebar' } },
    { path: 'color/component/sidebar-content',     light: 'color/neutral/900', dark: 'color/neutral/100', codeSyntax: { WEB: 'var(--color-on-sidebar)',               ANDROID: 'sidebar-foreground',          iOS: '.Component.sidebar.on' } },
  ],
  rawLiterals: [
    { path: 'color/background/scrim',  light: { r: 0, g: 0, b: 0, a: 0.32 }, dark: { r: 0, g: 0, b: 0, a: 0.32 }, codeSyntax: { WEB: 'var(--color-scrim)',        ANDROID: 'scrim',  iOS: '.Effect.scrim' } },
    { path: 'color/background/shadow', light: { r: 0, g: 0, b: 0, a: 0.15 }, dark: { r: 0, g: 0, b: 0, a: 0.40 }, codeSyntax: { WEB: 'var(--color-shadow-tint)', ANDROID: 'shadow', iOS: '.Background.shadow.tint' } },
  ],
  groupOrder: ['background', 'border', 'primary', 'secondary', 'tertiary', 'error', 'component'],
};

const allVars = await figma.variables.getLocalVariablesAsync();
const byName = Object.fromEntries(allVars.map((v) => [v.name, v]));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const themeColl = collections.find((c) => c.name === 'Theme');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!themeColl) throw new Error('Theme collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const themeLightModeId = (themeColl.modes.find((m) => m.name === 'Light') || themeColl.modes[0]).modeId;
const themeDarkModeId  = (themeColl.modes.find((m) => m.name === 'Dark')  || themeColl.modes[1] || themeColl.modes[0]).modeId;
const primModeId = primColl.modes[0].modeId;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveHex(varId, themeModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = themeModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (!val) return '#000000';
    if (val.type !== 'VARIABLE_ALIAS') {
      return val.type === 'COLOR' ? colorToHex(val) : '#000000';
    }
    const next = await figma.variables.getVariableByIdAsync(val.id);
    const nextColl = await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId);
    if (nextColl.id === primColl.id) m = primModeId;
    else if (nextColl.id === themeColl.id) m = themeModeId;
    else m = nextColl.modes[0].modeId;
    v = next;
  }
  return '#000000';
}

const allRows = {};
for (const k of THEME_DATA.groupOrder) allRows[k] = [];

for (const r of THEME_DATA.rows) {
  const v = byName[r.path];
  if (!v) continue;
  const light = await resolveHex(v.id, themeLightModeId);
  const dark  = await resolveHex(v.id, themeDarkModeId);
  const group = r.path.split('/')[1];
  if (allRows[group]) {
    allRows[group].push({
      tokenPath: r.path,
      resolvedHexLight: light,
      resolvedHexDark: dark,
      aliasLight: r.light,
      aliasDark: r.dark,
      codeSyntax: r.codeSyntax,
    });
  }
}

for (const r of THEME_DATA.rawLiterals) {
  allRows.background.push({
    tokenPath: r.path,
    resolvedHexLight: colorToHex(r.light),
    resolvedHexDark: colorToHex(r.dark),
    aliasLight: 'rgba(0,0,0,' + r.light.a + ')',
    aliasDark:  'rgba(0,0,0,' + r.dark.a  + ')',
    codeSyntax: r.codeSyntax,
    themeVariableId: null,
  });
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const themePage = figma.root.children.find((pg) => pg.name === '\u21B3 Theme');
if (!themePage || themePage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Theme)');
}

const ctx = {
  pageId: themePage.id,
  docStyles,
  themeCollectionId: themeColl.id,
  themeLightModeId,
  themeDarkModeId,
  rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15b-theme', pageId: themePage.id, tableGroups, pageName: themePage.name };
