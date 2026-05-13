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
function makeBodyCell(colWidth, layoutMode) {
const cell = figma.createFrame();
cell.layoutMode = layoutMode || 'VERTICAL';
if (cell.layoutMode === 'HORIZONTAL') {
cell.primaryAxisSizingMode = 'FIXED';
cell.counterAxisSizingMode = 'AUTO';
} else {
cell.primaryAxisSizingMode = 'AUTO';
cell.counterAxisSizingMode = 'FIXED';
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
function makeBodyRow(tokenPath, borderVariable) {
const row = figma.createFrame();
row.name = `row/${tokenPath}`;
row.layoutMode = 'HORIZONTAL';
row.counterAxisSizingMode = 'AUTO';
row.primaryAxisSizingMode = 'FIXED';
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
function rehugRow(row) {
row.counterAxisSizingMode = 'AUTO';
row.layoutSizingVertical = 'HUG';
}
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
async function buildTable(manifest, parent, variables, docStyles, variableMap) {
const { slug, columns, rows, title, caption, tableType } = manifest;
const borderVar   = variables['color/border/subtle'];
const bgDefault   = variables['color/background/default'];
const bgVariant   = variables['color/background/variant'];
const contentVar  = variables['color/background/content'];
const mutedVar    = variables['color/background/content-muted'];
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
if (!slug.includes('token-overview/platform-mapping')) {
const shadowStyle = (await figma.getLocalEffectStylesAsync())
.find(s => s.name === 'Effect/shadow-sm');
if (shadowStyle) table.effectStyleId = shadowStyle.id;
}
parent.appendChild(group);
group.primaryAxisSizingMode = 'AUTO';
group.layoutSizingVertical = 'HUG';
return group;
}
async function buildPageContent(page) {
for (const node of [...page.children]) {
if (node.name !== '_Header') node.remove();
}
const header = page.findOne(n => n.name === '_Header');
if (header) {
if (Math.abs(header.width - 1800) > 1) header.resize(1800, 320);
}
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
content.layoutSizingVertical = 'HUG';
return content;
}
const THEME_COLUMNS = [
{ id: 'TOKEN', width: 320 },
{ id: 'LIGHT', width: 140 },
{ id: 'DARK', width: 140 },
{ id: 'ALIAS →', width: 260 },
{ id: 'WEB', width: 320 },
{ id: 'ANDROID', width: 220 },
{ id: 'iOS', width: 240 },
];
const THEME_GROUP_META = {
background: { title: 'Background', caption: 'Surfaces, containers, scrims, and overlays.' },
border:     { title: 'Border',     caption: 'Stroke tokens for dividers and outlines.' },
primary:    { title: 'Primary',    caption: 'Primary brand roles and their on-color companions.' },
secondary:  { title: 'Secondary',  caption: 'Secondary brand roles for supporting actions.' },
tertiary:   { title: 'Tertiary',   caption: 'Tertiary / decorative accent roles.' },
error:      { title: 'Error',      caption: 'Feedback color for destructive and error states.' },
component:  { title: 'Component',  caption: 'shadcn-aligned component tokens (ring, input, muted, popover).' },
button:     { title: 'Button',     caption: 'Component-level button state tokens.' },
text:       { title: 'Text',       caption: 'Text and content color tokens.' },
};
const THEME_GROUP_KNOWN_ORDER = ['background', 'border', 'primary', 'secondary', 'tertiary', 'error', 'component', 'button', 'text'];
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
const allGroupKeys = Object.keys(rows).filter((k) => (rows[k] || []).length > 0);
const orderedGroupKeys = [
...THEME_GROUP_KNOWN_ORDER.filter((k) => allGroupKeys.includes(k)),
...allGroupKeys.filter((k) => !THEME_GROUP_KNOWN_ORDER.includes(k)).sort(),
];
for (const key of orderedGroupKeys) {
const tableRows = rows[key] || [];
if (!tableRows.length) continue;
const meta = THEME_GROUP_META[key] || {};
const slug = `theme/${key.replace(/\//g, '-')}`;
const title = meta.title || (key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '));
const caption = meta.caption || `${title} tokens.`;
await buildTable({
slug,
title,
caption,
columns: THEME_COLUMNS,
rows: tableRows,
buildRow: buildThemeRow,
rowDeps,
}, content, variables, docStyles, variableMap);
}
content.layoutMode = 'VERTICAL';
content.layoutSizingVertical = 'HUG';
console.log(`Canvas: Step 15b ↳ Theme — done (${orderedGroupKeys.length} tables)`);
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
const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const themeColl = collections.find((c) => c.name === 'Theme');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!themeColl) throw new Error('Theme collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const themeLightModeId = (
themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]
).modeId;
const themeDarkModeId = (
themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
themeColl.modes[1] ||
themeColl.modes[0]
).modeId;
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
if (val == null) return '#000000';
if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
const next = await figma.variables.getVariableByIdAsync(val.id);
const nextColl = await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId);
if (nextColl.id === primColl.id) m = primModeId;
else if (nextColl.id === themeColl.id) m = themeModeId;
else m = nextColl.modes[0].modeId;
v = next;
continue;
}
if (typeof val === 'object' && typeof val.r === 'number') return colorToHex(val);
return '#000000';
}
return '#000000';
}
async function resolveFirstAlias(varId, themeModeId) {
const v = await figma.variables.getVariableByIdAsync(varId);
const val = v.valuesByMode[themeModeId];
if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
try {
const next = await figma.variables.getVariableByIdAsync(val.id);
return next && next.name ? next.name : null;
} catch (_) {
return null;
}
}
return null;
}
function readCS(v) {
const cs = v.codeSyntax || {};
return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
const themeVars = allVars.filter(
(v) => v.variableCollectionId === themeColl.id && v.resolvedType === 'COLOR'
);
const groupOrder = [];
const groupMap = {};
for (const v of themeVars) {
const firstSeg = v.name.split('/')[0];
if (!groupMap[firstSeg]) {
groupMap[firstSeg] = [];
groupOrder.push(firstSeg);
}
groupMap[firstSeg].push(v);
}
const allRows = {};
for (const group of groupOrder) {
allRows[group] = [];
for (const v of groupMap[group]) {
const light = await resolveHex(v.id, themeLightModeId);
const dark = await resolveHex(v.id, themeDarkModeId);
const aliasLightLive = await resolveFirstAlias(v.id, themeLightModeId);
const aliasDarkLive = await resolveFirstAlias(v.id, themeDarkModeId);
allRows[group].push({
tokenPath: v.name,
resolvedHexLight: light,
resolvedHexDark: dark,
aliasLight: aliasLightLive,
aliasDark: aliasDarkLive,
codeSyntax: readCS(v),
});
}
}
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
Section: textStyles.find((s) => s.name === 'Doc/Section')?.id || null,
TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
Code: textStyles.find((s) => s.name === 'Doc/Code')?.id || null,
Caption: textStyles.find((s) => s.name === 'Doc/Caption')?.id || null,
};
const themePage = figma.root.children.find((pg) => pg.name === '↳ Theme');
if (!themePage || themePage.type !== 'PAGE') {
throw new Error('Page not found (expected ↳ Theme)');
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
