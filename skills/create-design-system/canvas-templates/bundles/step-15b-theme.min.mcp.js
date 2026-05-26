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
row.paddingTop = 24;
row.paddingBottom = 24;
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
state:      { title: 'State',      caption: 'M3 state layer overlays — per-role RGBA tints for hover, pressed, and focus interactions. ANDROID pressed entries double as the ripple drawable color.' },
component:  { title: 'Component',  caption: 'shadcn-aligned component tokens (ring, input, muted, popover).' },
button:     { title: 'Button',     caption: 'Component-level button state tokens.' },
text:       { title: 'Text',       caption: 'Text and content color tokens.' },
};
const THEME_GROUP_KNOWN_ORDER = ['background', 'border', 'primary', 'secondary', 'tertiary', 'error', 'state', 'component', 'button', 'text'];
async function build(ctx) {
await ensureLocalVariableMapOnCtx(ctx);
await ensureCanonicalMapOnCtx(ctx);
const {
pageId, variableMap, docStyles,
themeCollectionId, themeLightModeId, themeDarkModeId,
rows,
} = ctx;
if (!docStyles.Section || !docStyles.TokenName || !docStyles.Code || !docStyles.Caption) {
var _ts = await figma.getLocalTextStylesAsync();
if (!docStyles.Section)   { var _s = _ts.find(function(s) { return /^_?doc.*section/i.test(s.name); }); if (_s) docStyles.Section = _s.id; }
if (!docStyles.TokenName) { var _tn = _ts.find(function(s) { return /^_?doc.*(token|heading)/i.test(s.name); }); if (_tn) docStyles.TokenName = _tn.id; }
if (!docStyles.Code)      { var _c = _ts.find(function(s) { return /^_?doc.*(code|mono)/i.test(s.name); }); if (_c) docStyles.Code = _c.id; }
if (!docStyles.Caption)   { var _cap = _ts.find(function(s) { return /^_?doc.*(caption|label|body)/i.test(s.name); }); if (_cap) docStyles.Caption = _cap.id; }
}
await figma.setCurrentPageAsync(figma.root.children.find(p => p.id === pageId) || figma.currentPage);
const page = figma.currentPage;
await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);
const variables = {};
const chromePaths = [
'color/border/subtle', 'color/background/default', 'color/background/variant',
'color/background/content', 'color/background/content-muted',
];
for (var _ci = 0; _ci < chromePaths.length; _ci++) {
var _cp = chromePaths[_ci];
var _ap = resolveCanonicalPath(_cp, variableMap, ctx.canonicalMap);
if (_ap) variables[_cp] = await figma.variables.getVariableByIdAsync(variableMap[_ap]);
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
const registryIds = readDesignOpsCollectionRegistry();
function findThemeCollection() {
return resolveCollectionByLogicalKey('theme', collections, registryIds, function () {
const exact = collections.find((c) => c.name === 'Theme');
if (exact) return exact;
const fuzzy = collections.find((c) => /theme|semantic/i.test(c.name));
if (fuzzy) return fuzzy;
return (
collections.find(
(c) =>
c.modes.some((m) => /^light/i.test(m.name.trim())) &&
c.modes.some((m) => /^dark/i.test(m.name.trim()))
) || null
);
});
}
function findPrimitivesCollection(themeCollId) {
return resolveCollectionByLogicalKey('primitives', collections, registryIds, function () {
const exact = collections.find((c) => c.name === 'Primitives' && c.id !== themeCollId);
if (exact) return exact;
const fuzzy = collections.find((c) =>
/primitiv|core|foundation|base/i.test(c.name) && c.id !== themeCollId
);
if (fuzzy) return fuzzy;
const candidates = collections
.filter((c) => c.id !== themeCollId && c.modes.length === 1)
.map((c) => ({
c,
colorCount: allVars.filter((v) => v.variableCollectionId === c.id && v.resolvedType === 'COLOR').length,
}))
.sort((a, b) => b.colorCount - a.colorCount);
return candidates[0]?.c || null;
});
}
const themeColl = findThemeCollection();
if (!themeColl) {
throw new Error(
'No Theme-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
);
}
const primColl = findPrimitivesCollection(themeColl.id);
const themeLightModeId = (
themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]
).modeId;
const themeDarkModeId = (
themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
themeColl.modes[1] ||
themeColl.modes[0]
).modeId;
const primModeId = primColl ? primColl.modes[0].modeId : themeLightModeId;
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
const nextColl = collections.find((c) => c.id === next.variableCollectionId);
if (nextColl?.id === primColl?.id) m = primModeId;
else if (nextColl?.id === themeColl.id) m = themeModeId;
else m = nextColl ? nextColl.modes[0].modeId : m;
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
return next?.name || null;
} catch (_) { return null; }
}
return null;
}
function readCS(v) {
const cs = v.codeSyntax || {};
return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}
const RAW_LITERAL_CODESYNTAX = {
'color/background/scrim':  { WEB: 'var(--color-scrim)',        ANDROID: 'scrim',  iOS: '.Effect.scrim' },
'color/background/shadow': { WEB: 'var(--color-shadow-tint)',  ANDROID: 'shadow', iOS: '.Background.shadow.tint' },
};
function deriveStateCodeSyntax(name) {
const m = /^color\/state\/(on-(?:primary|secondary|tertiary|error|surface))\/(hover|pressed|focus)$/.exec(name);
if (!m) return null;
const role = m[1], state = m[2];
const roleKebab = role;
const rolePascal = role.replace(/^on-/, 'on').replace(/^on(.)/, function(_, c) { return 'on' + c.toUpperCase(); })
.replace(/-([a-z])/, function(_, c) { return c.toUpperCase(); });
return {
WEB: 'var(--color-state-' + roleKebab + '-' + state + ')',
ANDROID: state === 'pressed' ? ('ripple-' + roleKebab) : ('state-layer-' + roleKebab),
iOS: '.State.' + rolePascal + '.' + state,
};
}
async function ensureCodeSyntax(v) {
const cs = v.codeSyntax || {};
const hasAll = cs.WEB && cs.ANDROID && (cs.iOS || cs.IOS);
if (hasAll) return cs;
const derived = RAW_LITERAL_CODESYNTAX[v.name] || deriveStateCodeSyntax(v.name) || null;
if (!derived) return cs;
const next = {
WEB: cs.WEB || derived.WEB,
ANDROID: cs.ANDROID || derived.ANDROID,
iOS: (cs.iOS || cs.IOS) || derived.iOS,
};
try {
if (!cs.WEB)              v.setVariableCodeSyntax('WEB',     next.WEB);
if (!cs.ANDROID)          v.setVariableCodeSyntax('ANDROID', next.ANDROID);
if (!(cs.iOS || cs.IOS))  v.setVariableCodeSyntax('iOS',     next.iOS);
} catch (_) {}
return next;
}
const themeVars = allVars.filter(
(v) => v.variableCollectionId === themeColl.id && v.resolvedType === 'COLOR'
);
const groupOrder = [];
const groupMap = {};
for (const v of themeVars) {
const segs = v.name.split('/');
const groupKey = (segs[0] === 'color' && segs.length >= 3) ? segs[1] : segs[0];
if (!groupMap[groupKey]) { groupMap[groupKey] = []; groupOrder.push(groupKey); }
groupMap[groupKey].push(v);
}
let codeSyntaxHealed = 0;
const allRows = {};
for (const group of groupOrder) {
allRows[group] = [];
for (const v of groupMap[group]) {
const beforeCs = v.codeSyntax || {};
const beforeKey = String(beforeCs.WEB || '') + '|' + String(beforeCs.ANDROID || '') + '|' + String(beforeCs.iOS || beforeCs.IOS || '');
const healed = await ensureCodeSyntax(v);
const afterKey = String(healed.WEB || '') + '|' + String(healed.ANDROID || '') + '|' + String(healed.iOS || healed.IOS || '');
if (beforeKey !== afterKey) codeSyntaxHealed++;
const light = await resolveHex(v.id, themeLightModeId);
const dark  = await resolveHex(v.id, themeDarkModeId);
const aliasLight = await resolveFirstAlias(v.id, themeLightModeId);
const aliasDark  = await resolveFirstAlias(v.id, themeDarkModeId);
allRows[group].push({
tokenPath: v.name,
resolvedHexLight: light, resolvedHexDark: dark,
aliasLight, aliasDark,
codeSyntax: { WEB: String(healed.WEB || ''), ANDROID: String(healed.ANDROID || ''), iOS: String(healed.iOS || healed.IOS || '') },
});
}
}
const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
Section:   textStyles.find((s) => s.name === '_Doc/Section')?.id   || null,
TokenName: textStyles.find((s) => s.name === '_Doc/TokenName')?.id || null,
Code:      textStyles.find((s) => s.name === '_Doc/Code')?.id      || null,
Caption:   textStyles.find((s) => s.name === '_Doc/Caption')?.id   || null,
};
const themePage =
findDesignOpsPage('theme', {
legacyExact: ['↳ Theme'],
legacyRegex: [/^↳?\s*theme/i],
}) || null;
if (!themePage || themePage.type !== 'PAGE') {
throw new Error(
'Page not found (expected ↳ Theme / slug theme). Pages: ' +
figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
);
}
const ctx = {
pageId: themePage.id, docStyles,
themeCollectionId: themeColl.id,
themeLightModeId, themeDarkModeId,
rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
ok: true, step: '15b-theme', pageId: themePage.id,
collection: themeColl.name, tableGroups, pageName: themePage.name,
codeSyntaxHealed,
};
