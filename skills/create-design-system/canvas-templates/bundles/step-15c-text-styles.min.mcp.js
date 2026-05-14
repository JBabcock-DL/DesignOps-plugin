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
const DESIGNOPS_SHARED_NS = 'labs.designops';
const DESIGNOPS_PAGE_SLUG_SUBKEY = 'pageSlug';
const DESIGNOPS_COLLECTION_REGISTRY_SUBKEY = 'collectionRegistry';
const DESIGNOPS_REGISTRY_FRAME = '_DesignOpsRegistry';
var DESIGNOPS_PATH_ALIAS_SUBKEY = 'pathAliasMap';
function readDesignOpsPageSlug(page) {
return page.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_PAGE_SLUG_SUBKEY) || '';
}
function findDesignOpsPage(pageSlug, opts) {
opts = opts || {};
const pages = figma.root.children.filter(function (n) { return n.type === 'PAGE'; });
var bySlug = pages.find(function (p) { return readDesignOpsPageSlug(p) === pageSlug; });
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
var raw = frame.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_COLLECTION_REGISTRY_SUBKEY);
if (!raw) return {};
try {
var o = JSON.parse(raw);
return typeof o === 'object' && o !== null ? o : {};
} catch (_) {
return {};
}
}
function readDesignOpsPathAliasMap(registryFrame) {
if (!registryFrame) return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
try {
var raw = registryFrame.getSharedPluginData(DESIGNOPS_SHARED_NS, DESIGNOPS_PATH_ALIAS_SUBKEY);
if (!raw) return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
var parsed = JSON.parse(raw);
if (!parsed || typeof parsed !== 'object') return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
parsed.entries = parsed.entries || {};
return parsed;
} catch (_) {
return { entries: {}, variableMapChecksum: null, schemaVersion: 1 };
}
}
function writeDesignOpsPathAliasMap(registryFrame, aliasData) {
if (!registryFrame) return;
try {
registryFrame.setSharedPluginData(
DESIGNOPS_SHARED_NS,
DESIGNOPS_PATH_ALIAS_SUBKEY,
JSON.stringify(aliasData)
);
} catch (_) {  }
}
async function computePathAliasMap(variableMap, collections, allVars) {
var CANONICAL_PATHS = [
'color/border/subtle',
'color/background/default',
'color/background/variant',
'color/background/content',
'color/background/content-muted',
'color/neutral/100',
'color/neutral/950',
'color/primary/200',
'color/primary/500',
'color/secondary/500',
'color/primary/default',
];
var KEYWORD_RULES = {
'color/background/default':       { required: [['background','default'],['surface','default']], exclusions: [] },
'color/background/content':       { required: [['background','content']], exclusions: ['muted'] },
'color/background/content-muted': { required: [['background','content','muted'],['surface','muted']], exclusions: [] },
'color/background/variant':       { required: [['background','variant'],['surface','variant']], exclusions: [] },
'color/border/subtle':            { required: [['border','subtle']], exclusions: [] },
'color/primary/default':          { required: [['primary','default']], exclusions: [] },
'color/neutral/100':              { required: [['neutral','100']], exclusions: [] },
'color/neutral/950':              { required: [['neutral','950']], exclusions: [] },
'color/primary/200':              { required: [['primary','200']], exclusions: [] },
'color/primary/500':              { required: [['primary','500']], exclusions: [] },
'color/secondary/500':            { required: [['secondary','500']], exclusions: [] },
};
var allNames = Object.keys(variableMap);
var entries = {};
for (var i = 0; i < CANONICAL_PATHS.length; i++) {
var canonicalPath = CANONICAL_PATHS[i];
if (variableMap[canonicalPath]) {
entries[canonicalPath] = { resolvedPath: canonicalPath, confidence: 'exact' };
continue;
}
var rule = KEYWORD_RULES[canonicalPath];
if (rule) {
var candidates = allNames.filter(function(name) {
var segments = name.toLowerCase().split('/');
for (var e = 0; e < rule.exclusions.length; e++) {
if (segments.indexOf(rule.exclusions[e]) !== -1) return false;
}
for (var r = 0; r < rule.required.length; r++) {
var reqSet = rule.required[r];
var allPresent = true;
for (var s = 0; s < reqSet.length; s++) {
if (segments.indexOf(reqSet[s]) === -1) { allPresent = false; break; }
}
if (allPresent) return true;
}
return false;
});
if (candidates.length === 1) {
entries[canonicalPath] = { resolvedPath: candidates[0], confidence: 'semantic' };
continue;
}
}
var parts = canonicalPath.split('/');
var lastPart = parts[parts.length - 1];
if (/^\d+$/.test(lastPart)) {
var primColl = null;
for (var ci = 0; ci < collections.length; ci++) {
var c = collections[ci];
if (/^(primitiv|core|foundation|base)/i.test(c.name)) { primColl = c; break; }
}
if (!primColl) {
var hasLightDark = function(col) {
return col.modes.some(function(m) { return /^light/i.test(m.name); }) &&
col.modes.some(function(m) { return /^dark/i.test(m.name); });
};
var colorCountFn = function(col) {
return allVars.filter(function(v) { return v.variableCollectionId === col.id && v.resolvedType === 'COLOR'; }).length;
};
var nonThemeCols = collections.filter(function(col) { return !hasLightDark(col); });
nonThemeCols.sort(function(a, b) { return colorCountFn(b) - colorCountFn(a); });
if (nonThemeCols.length > 0) primColl = nonThemeCols[0];
}
if (primColl) {
var rampKeyword = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : null;
if (rampKeyword) {
var stopCandidates = allVars.filter(function(v) {
if (v.variableCollectionId !== primColl.id) return false;
if (v.resolvedType !== 'COLOR') return false;
var segs = v.name.toLowerCase().split('/');
var lastSeg = segs[segs.length - 1];
return lastSeg === lastPart && segs.indexOf(rampKeyword) !== -1;
});
if (stopCandidates.length === 1) {
entries[canonicalPath] = { resolvedPath: stopCandidates[0].name, confidence: 'position' };
continue;
}
}
}
}
entries[canonicalPath] = { resolvedPath: null, confidence: null };
}
return entries;
}
async function ensureCanonicalMapOnCtx(ctx) {
if (!ctx.variableMap) return;
var registryFrame = null;
try {
var docPage = figma.root.children.find(function(p) {
return p.type === 'PAGE' && p.name === 'Documentation components';
});
if (docPage) {
registryFrame = docPage.findOne(function(n) {
return n.type === 'FRAME' && n.name === '_DesignOpsRegistry';
}) || null;
}
} catch (_) {}
var allVarsC, collectionsC;
try {
allVarsC = await figma.variables.getLocalVariablesAsync();
collectionsC = await figma.variables.getLocalVariableCollectionsAsync();
} catch (_) {
allVarsC = [];
collectionsC = [];
}
var checksum = ((allVarsC.length ^ collectionsC.length) & 0xFFFF).toString(16).padStart(4, '0');
var stored = readDesignOpsPathAliasMap(registryFrame);
if (stored.variableMapChecksum === checksum && Object.keys(stored.entries).length > 0) {
ctx.canonicalMap = {};
var storedEntries = stored.entries;
Object.keys(storedEntries).forEach(function(k) {
ctx.canonicalMap[k] = storedEntries[k] ? storedEntries[k].resolvedPath : null;
});
return;
}
var freshEntries = await computePathAliasMap(ctx.variableMap, collectionsC, allVarsC);
var aliasData = {
schemaVersion: 1,
computedAt: new Date().toISOString(),
variableMapChecksum: checksum,
entries: freshEntries,
};
writeDesignOpsPathAliasMap(registryFrame, aliasData);
ctx.canonicalMap = {};
Object.keys(freshEntries).forEach(function(k) {
ctx.canonicalMap[k] = freshEntries[k] ? freshEntries[k].resolvedPath : null;
});
}
function resolveCanonicalPath(canonicalPath, variableMap, canonicalMap) {
if (variableMap && variableMap[canonicalPath]) return canonicalPath;
if (!canonicalMap) return null;
var alias = canonicalMap[canonicalPath];
if (alias && variableMap && variableMap[alias]) return alias;
return null;
}
function isHeaderNode(node) {
return (node.name === '_Header' || /^_?header/i.test(node.name)) &&
(node.type === 'INSTANCE' || node.type === 'COMPONENT');
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
const _allEffectStyles = await figma.getLocalEffectStylesAsync();
const shadowStyle = _allEffectStyles.find(s => s.name === 'Effect/shadow-sm')
|| _allEffectStyles.find(s => /shadow.*sm/i.test(s.name));
if (shadowStyle) table.effectStyleId = shadowStyle.id;
}
parent.appendChild(group);
group.primaryAxisSizingMode = 'AUTO';
group.layoutSizingVertical = 'HUG';
return group;
}
async function buildPageContent(page) {
for (const node of [...page.children]) {
if (!isHeaderNode(node)) node.remove();
}
const header = page.children.find(n => isHeaderNode(n));
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
const allTextStyles = await figma.getLocalTextStylesAsync();
const typographyStyles = allTextStyles.filter(
(s) => !s.name.startsWith('Doc/') && !s.name.startsWith('Effect/')
);
await loadFontsForTextStyles(typographyStyles);
const categoryMap = {};
const categoryOrder = [];
for (const s of typographyStyles) {
const firstSeg = s.name.split('/')[0];
if (!categoryMap[firstSeg]) {
categoryMap[firstSeg] = [];
categoryOrder.push(firstSeg);
}
categoryMap[firstSeg].push(s);
}
const CATEGORY_ORDER = ['Display', 'Headline', 'Title', 'Body', 'Label'];
const orderedCategories = [
...CATEGORY_ORDER.filter((c) => categoryMap[c]),
...categoryOrder.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
];
const SPECIMENS = {
Display: 'Dream design systems',
Headline: 'Ship it with confidence',
Title: 'Tokens keep us honest',
Body: 'The quick brown fox jumps over the lazy dog.',
Label: 'STATUS — ACTIVE',
};
function csFor(styleName) {
const lower = styleName.toLowerCase().replace(/\s+/g, '-');
const kebab = lower.replace(/\//g, '-');
const parts = lower.split('/');
return {
WEB: 'var(--' + kebab + ')',
ANDROID: kebab,
iOS: '.Typography.' + parts.join('.'),
};
}
function readCS(s) {
const cs = s.codeSyntax || {};
if (cs.WEB || cs.ANDROID || cs.iOS || cs.IOS) {
return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
return csFor(s.name);
}
function lineHeightStr(lh) {
if (!lh) return '—';
if (lh.unit === 'AUTO') return 'auto line';
if (lh.unit === 'PIXELS') return `${Math.round(lh.value)}px line`;
if (lh.unit === 'PERCENT') return `${lh.value}% line`;
return `${lh.value} line`;
}
const SIZE_PRIORITY = { '2XL': -2, XL: -1, LG: 0, MD: 1, SM: 2, XS: 3 };
const rows = [];
for (const cat of orderedCategories) {
rows.push({ type: 'category', label: cat });
const catStyles = categoryMap[cat].slice().sort((a, b) => {
const partsA = a.name.split('/');
const partsB = b.name.split('/');
const sizeA = (partsA[1] || '').toUpperCase();
const sizeB = (partsB[1] || '').toUpperCase();
const prioA = SIZE_PRIORITY[sizeA] ?? 99;
const prioB = SIZE_PRIORITY[sizeB] ?? 99;
if (prioA !== prioB) return prioA - prioB;
return a.name.localeCompare(b.name);
});
for (const s of catStyles) {
const parts = s.name.split('/');
const rawVariant = parts.length >= 3 ? parts[2].toLowerCase() : 'base';
const variant = ['emphasis', 'italic', 'link', 'strikethrough'].includes(rawVariant)
? rawVariant
: 'base';
rows.push({
type: 'slot',
tokenPath: s.name,
styleId: s.id,
specimenChars: SPECIMENS[cat] || s.name,
sizeLine1: `${Math.round(s.fontSize)}px size`,
sizeLine2: lineHeightStr(s.lineHeight),
weightLine1: `${s.fontWeight} weight`,
weightLine2: s.fontName ? s.fontName.family : '—',
codeSyntax: readCS(s),
variant,
});
}
}
const docStyles = {
Section:   allTextStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
TokenName: allTextStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
Code:      allTextStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
Caption:   allTextStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};
const textStylesPage =
findDesignOpsPage('text-styles', {
legacyExact: ['↳ Text Styles'],
legacyRegex: [/^↳?\s*text\s*styles/i],
}) || null;
if (!textStylesPage || textStylesPage.type !== 'PAGE') {
throw new Error('Page not found (expected ↳ Text Styles / slug text-styles)');
}
const ctx = {
pageId: textStylesPage.id,
docStyles,
rows,
};
await build(ctx);
const tableGroups = textStylesPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
const expected = new Map();
for (const r of rows) {
if (r.type === 'slot' && r.tokenPath && r.styleId) expected.set(r.tokenPath, r.styleId);
}
const table = textStylesPage.findOne((n) => n.name === 'doc/table/typography/styles' && n.type === 'FRAME');
const body = table && table.children.find((c) => c.name === 'doc/table/typography/styles/body');
let specimenStyleOk = 0;
let specimenStyleMissing = 0;
let specimenStyleMismatch = 0;
const auditErrors = [];
if (!table) auditErrors.push('doc/table/typography/styles not found');
else if (!body) auditErrors.push('doc/table/typography/styles/body not found');
else {
for (const [tokenPath, wantId] of expected) {
const rowFrame = body.children.find((c) => c.type === 'FRAME' && c.name === `row/${tokenPath}`);
if (!rowFrame) {
specimenStyleMissing++;
continue;
}
const specCell = rowFrame.children.find((c) => c.type === 'FRAME' && c.name === 'cell/specimen');
const specimenNode = specCell && specCell.findOne((n) => n.type === 'TEXT' && n.name === 'text/specimen');
if (!specimenNode || !specimenNode.textStyleId) {
specimenStyleMissing++;
continue;
}
if (specimenNode.textStyleId !== wantId) {
specimenStyleMismatch++;
continue;
}
specimenStyleOk++;
}
}
const slotCount = expected.size;
const auditFail = specimenStyleMissing > 0 || specimenStyleMismatch > 0 || auditErrors.length > 0;
if (auditFail) {
const parts = [];
if (auditErrors.length) parts.push(...auditErrors);
if (specimenStyleMissing) parts.push(`specimenStyleMissing: ${specimenStyleMissing}`);
if (specimenStyleMismatch) parts.push(`specimenStyleMismatch: ${specimenStyleMismatch}`);
return {
ok: false,
step: '15c-text-styles',
pageId: textStylesPage.id,
tableGroups,
pageName: textStylesPage.name,
rowCount: rows.length,
specimenStyleOk,
specimenStyleMissing,
specimenStyleMismatch,
slotCount,
errors: parts,
};
}
return {
ok: true,
step: '15c-text-styles',
pageId: textStylesPage.id,
tableGroups,
pageName: textStylesPage.name,
rowCount: rows.length,
specimenStyleOk,
specimenStyleMissing,
specimenStyleMismatch,
slotCount,
};
