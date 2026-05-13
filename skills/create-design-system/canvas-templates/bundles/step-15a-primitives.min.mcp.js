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
async function loadFontsForTextStyles(textStyles) {
const seen = new Set();
const jobs = [];
for (const s of textStyles) {
const fn = s.fontName;
if (!fn || !fn.family) continue;
const key = `${fn.family}\0${fn.style || 'Regular'}`;
if (seen.has(key)) continue;
seen.add(key);
jobs.push(figma.loadFontAsync({ family: fn.family, style: fn.style || 'Regular' }).catch(() => {}));
}
await Promise.all(jobs);
}
async function ensureLocalVariableMapOnCtx(ctx) {
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
const DESIGNOPS_PAGE_SLUG_KEY = 'labs.designops/pageSlug';
const DESIGNOPS_REGISTRY_FRAME = '_DesignOpsRegistry';
const DESIGNOPS_COLLECTION_REGISTRY_KEY = 'labs.designops/collectionRegistry';
function findDesignOpsPage(pageSlug, opts) {
opts = opts || {};
const pages = figma.root.children.filter(function (n) { return n.type === 'PAGE'; });
var bySlug = pages.find(function (p) { return p.getPluginData(DESIGNOPS_PAGE_SLUG_KEY) === pageSlug; });
if (bySlug) return bySlug;
var legacyExact = opts.legacyExact || [];
var exactMatches = [];
for (var i = 0; i < legacyExact.length; i++) {
var nm = legacyExact[i];
for (var j = 0; j < pages.length; j++) {
if (pages[j].name === nm) exactMatches.push(pages[j]);
}
}
if (exactMatches.length === 1) return exactMatches[0];
if (exactMatches.length > 1) return undefined;
var regexList = opts.legacyRegex || [];
var regMatches = [];
for (var r = 0; r < pages.length; r++) {
var p = pages[r];
for (var k = 0; k < regexList.length; k++) {
if (regexList[k].test(p.name)) {
regMatches.push(p);
break;
}
}
}
if (regMatches.length === 1) return regMatches[0];
return undefined;
}
function readDesignOpsCollectionRegistry() {
var docPage = figma.root.children.find(function (p) { return p.type === 'PAGE' && p.name === 'Documentation components'; });
if (!docPage) return {};
var frame = docPage.findOne(function (n) { return n.type === 'FRAME' && n.name === DESIGNOPS_REGISTRY_FRAME; });
if (!frame) return {};
var raw = frame.getPluginData(DESIGNOPS_COLLECTION_REGISTRY_KEY);
if (!raw) return {};
try {
var o = JSON.parse(raw);
return typeof o === 'object' && o !== null ? o : {};
} catch (_) {
return {};
}
}
function resolveCollectionByLogicalKey(logicalKey, collections, registryIds, fallbackFn) {
var want = registryIds && registryIds[logicalKey];
if (want) {
var live = collections.find(function (c) { return c.id === want; });
if (live) return live;
}
if (typeof fallbackFn === 'function') return fallbackFn();
return null;
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
const mutedFillVar = variables['color/background/content-muted'];
const t = await makeText(label, colWidth, docStyles.Code || null, mutedFillVar);
if (!mutedFillVar) t.fills = [{ type: 'SOLID', color: { r: 0.44, g: 0.44, b: 0.48 } }];
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
if (borderVariable !== null) {
row.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
row.strokeBottomWeight = 1;
row.strokeTopWeight = 0;
row.strokeLeftWeight = 0;
row.strokeRightWeight = 0;
if (borderVariable) bindStrokeToVar(row, borderVariable);
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
if (!contentVar) titleText.fills = [{ type: 'SOLID', color: { r: 0.09, g: 0.09, b: 0.11 } }];
titleText.name = `doc/table-group/${slug}/title`;
group.appendChild(titleText);
}
if (caption) {
const capText = await makeText(caption, 1640, docStyles.Caption || null, mutedVar);
if (!mutedVar) capText.fills = [{ type: 'SOLID', color: { r: 0.44, g: 0.44, b: 0.48 } }];
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
table.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
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
if (bgVariant) bindPaintToVar(header, bgVariant);
else header.fills = [{ type: 'SOLID', color: { r: 0.965, g: 0.965, b: 0.969 } }];
header.strokes = [{ type: 'SOLID', color: { r: 0.898, g: 0.898, b: 0.918 } }];
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
async function build(ctx) {
await ensureLocalVariableMapOnCtx(ctx);
const { pageId, variableMap, primitivesModeId, docStyles, rows } = ctx;
await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
const page = figma.currentPage;
await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);
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
content.layoutMode = 'NONE';
const rampDefaults = {
primary:   { title: 'Primary',   caption: 'Brand anchor — used for the most prominent actions, links, and focus.' },
secondary: { title: 'Secondary', caption: 'Supporting brand color for secondary actions and decorative surfaces.' },
tertiary:  { title: 'Tertiary',  caption: 'Accent hue for highlights, chips, and illustrative moments.' },
error:     { title: 'Error',     caption: 'Destructive and error feedback — do not use for incidental UI.' },
neutral:   { title: 'Neutral',   caption: 'Greyscale foundation for text, borders, and calm surfaces.' },
};
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
content.layoutMode = 'VERTICAL';
content.layoutSizingVertical = 'HUG';
console.log(`Canvas: Step 15a ↳ Primitives — done`);
}
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
const RAMP_ORDER = ['primary', 'secondary', 'tertiary', 'error', 'neutral'];
const SPACE_RE    = /^(space|size|spacing)(\/|$)/i;
const RADIUS_RE   = /^(corner|radius)(\/|$)/i;
const ELEV_RE     = /^(elevation|elev|shadow|blur)(\/|$)/i;
const WEIGHT_RE   = /weight/i;
const TYPEFACE_RE = /font|typeface|face/i;
const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();
function findPrimitivesCollection() {
return resolveCollectionByLogicalKey('primitives', collections, registryIds, function () {
const exact = collections.find((c) => c.name === 'Primitives');
if (exact) return exact;
const fuzzy = collections.find((c) => /primitiv|core|foundation|base/i.test(c.name));
if (fuzzy) return fuzzy;
const colorCount = (c) => allVars.filter((v) => v.variableCollectionId === c.id && v.resolvedType === 'COLOR').length;
const themed = new Set(
collections
.filter((c) => c.modes.some((m) => /^light/i.test(m.name)) && c.modes.some((m) => /^dark/i.test(m.name)))
.map((c) => c.id)
);
const candidates = collections.filter((c) => !themed.has(c.id));
return candidates.sort((a, b) => colorCount(b) - colorCount(a))[0] || null;
});
}
const primColl = findPrimitivesCollection();
if (!primColl) {
throw new Error(
'No Primitives-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
);
}
const collModeId = primColl.modes[0].modeId;
const myVars = allVars.filter((v) => v.variableCollectionId === primColl.id);
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};
function colorToHex(val) {
if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
const r = Math.round(val.r * 255), g = Math.round(val.g * 255), b = Math.round(val.b * 255);
return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function resolveRaw(vid, m) {
let v = await figma.variables.getVariableByIdAsync(vid);
for (let d = 0; d < 10; d++) {
const val = v.valuesByMode[m] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0]];
if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
const next = await figma.variables.getVariableByIdAsync(val.id);
const nextColl = collections.find((c) => c.id === next.variableCollectionId);
m = nextColl ? nextColl.modes[0].modeId : Object.keys(next.valuesByMode)[0];
v = next;
continue;
}
return val;
}
return null;
}
function readCS(v) {
const cs = v.codeSyntax || {};
return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
async function floatVal(vid) {
const raw = await resolveRaw(vid, collModeId);
return typeof raw === 'number' ? raw : 0;
}
const discoveredRamps = {};
for (const v of myVars.filter((v) => v.resolvedType === 'COLOR')) {
const parts = v.name.split('/');
if (parts.length < 2) continue;
const lastSeg = parts[parts.length - 1];
if (!/^\d+$/.test(lastSeg)) continue;
const rampParts = parts.length === 2 ? [parts[0]] : parts.slice(1, -1);
const rampKey = rampParts.map((s) => s.toLowerCase()).join('/');
if (!discoveredRamps[rampKey]) discoveredRamps[rampKey] = [];
discoveredRamps[rampKey].push({ stop: lastSeg, tokenPath: v.name, vid: v.id });
}
const colorRamps = {};
const rampNames = Object.keys(discoveredRamps).sort((a, b) => {
const ia = RAMP_ORDER.indexOf(a), ib = RAMP_ORDER.indexOf(b);
if (ia !== -1 && ib !== -1) return ia - ib;
if (ia !== -1) return -1; if (ib !== -1) return 1;
return a.localeCompare(b);
});
for (const ramp of rampNames) {
const stops = discoveredRamps[ramp].sort((a, b) => parseInt(a.stop, 10) - parseInt(b.stop, 10));
colorRamps[ramp] = [];
for (const s of stops) {
const v = await figma.variables.getVariableByIdAsync(s.vid);
let raw = await resolveRaw(s.vid, collModeId);
if (!raw || typeof raw.r !== 'number') raw = await resolveRaw(s.vid, Object.keys(v.valuesByMode)[0]);
colorRamps[ramp].push({ tokenPath: s.tokenPath, resolvedHex: colorToHex(raw), codeSyntax: readCS(v) });
}
}
const floatVars = myVars.filter((v) => v.resolvedType === 'FLOAT');
const spaceArr = [], radiusArr = [], elevArr = [], weightArr = [], otherFloatArr = [];
for (const v of floatVars) {
if (SPACE_RE.test(v.name))       spaceArr.push(v);
else if (RADIUS_RE.test(v.name)) radiusArr.push(v);
else if (ELEV_RE.test(v.name))   elevArr.push(v);
else if (WEIGHT_RE.test(v.name)) weightArr.push(v);
else                             otherFloatArr.push(v);
}
async function buildFloatRows(vars, sorted) {
const rows = [];
for (const v of vars) {
const px = await floatVal(v.id);
rows.push({ tokenPath: v.name, resolvedPx: px, resolvedValue: String(px), codeSyntax: readCS(v) });
}
if (sorted) rows.sort((a, b) => a.resolvedPx - b.resolvedPx);
return rows;
}
const spaceRows  = await buildFloatRows(spaceArr,  true);
const radiusRows = (await buildFloatRows(radiusArr, true)).map((r) => ({
...r,
resolvedPx: (r.tokenPath.toLowerCase().includes('full') || r.tokenPath.toLowerCase().includes('pill') || r.resolvedPx >= 9999) ? 9999 : r.resolvedPx,
}));
const elevRows   = await buildFloatRows(elevArr.sort((a, b) => a.name.localeCompare(b.name)), false);
const weightRows = await buildFloatRows(weightArr, false);
weightRows.sort((a, b) => parseFloat(a.resolvedValue) - parseFloat(b.resolvedValue));
const typefaceRows = [];
for (const v of myVars.filter((v) => v.resolvedType === 'STRING')) {
if (!TYPEFACE_RE.test(v.name.toLowerCase())) continue;
const raw = await resolveRaw(v.id, collModeId);
typefaceRows.push({ tokenPath: v.name, resolvedValue: typeof raw === 'string' ? raw : '—', codeSyntax: readCS(v) });
}
const primPage =
findDesignOpsPage('primitives', {
legacyExact: ['↳ Primitives'],
legacyRegex: [/primitives/i],
}) || null;
if (!primPage) {
throw new Error(
'Page not found (expected ↳ Primitives / slug primitives). Pages: ' +
figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
);
}
const ctx = {
pageId: primPage.id,
docStyles,
rows: {
colorRamps,
...(spaceRows.length  > 0 && { space:      spaceRows  }),
...(radiusRows.length > 0 && { radius:     radiusRows }),
...(elevRows.length   > 0 && { elevation:  elevRows   }),
...(typefaceRows.length > 0 && { typeface: typefaceRows }),
...(weightRows.length > 0 && { fontWeight: weightRows }),
},
};
const hadVm = 'variableMap' in ctx;
await build(ctx);
const tableGroups = primPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
ok: true, step: '15a-primitives', pageId: primPage.id,
collection: primColl.name,
hadVariableMapBeforeBuild: hadVm,
variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
tableGroups, pageName: primPage.name,
};
