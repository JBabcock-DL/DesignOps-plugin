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
    themeCollectionId, themeLightModeId, themeDarkModeId,
    rows,
  } = ctx;

  await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
  const page = figma.currentPage;

  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const variables = {};
  for (const path of ['color/border/subtle', 'color/background/default', 'color/background/variant', 'color/background/content', 'color/background/content-muted', 'color/background/container-highest', 'color/background/inverse']) {
    if (variableMap[path]) variables[path] = await figma.variables.getVariableByIdAsync(variableMap[path]);
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
  const es = styles.find(s => s.name === `Effect/shadow-${tier}`);
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
// Concatenate after _lib.js + effects.js (phase 07). Resolves Effects rows in-plugin; ctx omits variableMap.
const EFFECTS_DATA = {
  color: {
    path: 'shadow/color',
    light: { r: 0, g: 0, b: 0, a: 0.10 },
    dark:  { r: 0, g: 0, b: 0, a: 0.30 },
    codeSyntax: { WEB: 'var(--shadow-color)', ANDROID: 'shadow', iOS: '.Effect.shadow.color' },
  },
  blurs: [
    { path: 'shadow/sm/blur',  tier: 'sm',  alias: 'elevation/100',  codeSyntax: { WEB: 'var(--shadow-sm-blur)',  ANDROID: 'shadow-sm-blur',  iOS: '.Effect.shadow.sm.blur' } },
    { path: 'shadow/md/blur',  tier: 'md',  alias: 'elevation/200',  codeSyntax: { WEB: 'var(--shadow-md-blur)',  ANDROID: 'shadow-md-blur',  iOS: '.Effect.shadow.md.blur' } },
    { path: 'shadow/lg/blur',  tier: 'lg',  alias: 'elevation/400',  codeSyntax: { WEB: 'var(--shadow-lg-blur)',  ANDROID: 'shadow-lg-blur',  iOS: '.Effect.shadow.lg.blur' } },
    { path: 'shadow/xl/blur',  tier: 'xl',  alias: 'elevation/800',  codeSyntax: { WEB: 'var(--shadow-xl-blur)',  ANDROID: 'shadow-xl-blur',  iOS: '.Effect.shadow.xl.blur' } },
    { path: 'shadow/2xl/blur', tier: '2xl', alias: 'elevation/1600', codeSyntax: { WEB: 'var(--shadow-2xl-blur)', ANDROID: 'shadow-2xl-blur', iOS: '.Effect.shadow.2xl.blur' } },
  ],
};

const allVars = await figma.variables.getLocalVariablesAsync();
const byName = Object.fromEntries(allVars.map((v) => [v.name, v]));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const effectsColl = collections.find((c) => c.name === 'Effects');
const primColl = collections.find((c) => c.name === 'Primitives');
const themeColl = collections.find((c) => c.name === 'Theme');
if (!effectsColl) throw new Error('Effects collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const effectsLightModeId = (effectsColl.modes.find((m) => m.name === 'Light') || effectsColl.modes[0]).modeId;
const effectsDarkModeId  = (effectsColl.modes.find((m) => m.name === 'Dark')  || effectsColl.modes[1] || effectsColl.modes[0]).modeId;
const primModeId = primColl.modes[0].modeId;
const themeLightModeId = themeColl ? ((themeColl.modes.find((m) => m.name === 'Light') || themeColl.modes[0]).modeId) : null;
const themeDarkModeId  = themeColl ? ((themeColl.modes.find((m) => m.name === 'Dark')  || themeColl.modes[1] || themeColl.modes[0]).modeId) : null;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolvePx(varId, startModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = startModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    // Figma Plugin API: FLOAT variables store a raw JS number in valuesByMode; aliases are
    // { type: 'VARIABLE_ALIAS', id }. Old guard `val.type === 'FLOAT' ? val.value : 0` returned 0
    // for every numeric token (same failure mode as Theme hex resolver — see _step15b).
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      if (next.variableCollectionId === primColl.id) m = primModeId;
      else if (next.variableCollectionId === effectsColl.id) m = startModeId;
      else m = (await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId)).modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'number') return val;
    return 0;
  }
  return 0;
}

const shadows = [];
for (const b of EFFECTS_DATA.blurs) {
  const v = byName[b.path];
  if (!v) continue;
  const px = await resolvePx(v.id, effectsLightModeId);
  shadows.push({
    tokenPath: b.path,
    tier: b.tier,
    blurPx: px,
    aliasPath: b.alias,
    codeSyntax: b.codeSyntax,
  });
}

const shadowColor = [];
{
  const c = EFFECTS_DATA.color;
  const cv = byName[c.path];
  shadowColor.push({
    tokenPath: c.path,
    themeVariableId: cv ? cv.id : null,
    resolvedHexLight: colorToHex(c.light),
    resolvedHexDark:  colorToHex(c.dark),
    rgbaLight: 'rgba(0,0,0,' + c.light.a + ')',
    rgbaDark:  'rgba(0,0,0,' + c.dark.a  + ')',
    codeSyntax: c.codeSyntax,
  });
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const effectsPage = figma.root.children.find((pg) => pg.name === '\u21B3 Effects');
if (!effectsPage || effectsPage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Effects)');
}

const ctx = {
  pageId: effectsPage.id,
  docStyles,
  effectsCollectionId: effectsColl.id,
  effectsLightModeId,
  effectsDarkModeId,
  themeCollectionId: themeColl ? themeColl.id : null,
  themeLightModeId,
  themeDarkModeId,
  rows: { shadows, shadowColor },
};
await build(ctx);
const tableGroups = effectsPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15c-effects', pageId: effectsPage.id, tableGroups, pageName: effectsPage.name };
