const CONFIG = ctx;
const ACTIVE_FILE_KEY = typeof ctx.activeFileKey === 'string' ? ctx.activeFileKey : (typeof ctx.fileKey === 'string' ? ctx.fileKey : '');
const REGISTRY_COMPONENTS = ctx.registryComponents || {};
const usesComposes = !!ctx.usesComposes;
let pageContent;
let docRoot;
let compSet = null;
let variantBuildHolder = null;
let variantByKey = {};
let propsAdded;
const __ccPropAddErrors = [];
const hasSizeAxis = !!(CONFIG.sizes && CONFIG.sizes.length > 0);
const targetPage = figma.root.children.find(p => p.name === CONFIG.pageName)
?? figma.currentPage;
await figma.setCurrentPageAsync(targetPage);
const collections = figma.variables.getLocalVariableCollections();
const allVars = figma.variables.getLocalVariables();
const themeCol = collections.find(c => c.name === 'Theme');
const themeVars = themeCol ? allVars.filter(v => v.variableCollectionId === themeCol.id) : [];
const getColorVar = name => themeVars.find(v => v.name === name) ?? null;
const layoutCol = collections.find(c => c.name === 'Layout');
const layoutVars = layoutCol ? allVars.filter(v => v.variableCollectionId === layoutCol.id) : [];
const getLayoutVar = name => layoutVars.find(v => v.name === name) ?? null;
const typoCol = collections.find(c => c.name === 'Typography');
const typoVars = typoCol ? allVars.filter(v => v.variableCollectionId === typoCol.id) : [];
const getTypoVar = name => typoVars.find(v => v.name === name) ?? null;
const _unresolvedTokenMisses = [];
if (typeof __CC_PHASE1_UNRESOLVED__ !== 'undefined' && Array.isArray(__CC_PHASE1_UNRESOLVED__)) {
for (const m of __CC_PHASE1_UNRESOLVED__) _unresolvedTokenMisses.push(m);
}
function _recordUnresolved(kind, path, fallback, node) {
_unresolvedTokenMisses.push({
kind, path, fallback,
nodeName: (node && typeof node.name === 'string') ? node.name : null,
});
}
function readTypoString(variable) {
if (!variable || !typoCol) return null;
const baseMode = typoCol.modes.find(m => m.name === '100');
if (!baseMode) return null;
const val = variable.valuesByMode[baseMode.modeId];
return (typeof val === 'string' && val.length > 0) ? val : null;
}
const labelFontVar   = getTypoVar('Label/LG/font-family');
const displayFontVar = getTypoVar('Display/LG/font-family');
const labelFont   = readTypoString(labelFontVar)   ?? 'Inter';
const displayFont = readTypoString(displayFontVar) ?? labelFont;
await figma.loadFontAsync({ family: labelFont,   style: 'Regular' });
await figma.loadFontAsync({ family: labelFont,   style: 'Medium'  });
if (displayFont !== labelFont) {
await figma.loadFontAsync({ family: displayFont, style: 'Regular' });
await figma.loadFontAsync({ family: displayFont, style: 'Medium'  });
}
function bindColor(node, varName, fallbackHex, target = 'fills') {
const variable = varName ? getColorVar(varName) : null;
const hex = fallbackHex.replace('#', '');
const paint = {
type: 'SOLID',
color: {
r: parseInt(hex.slice(0, 2), 16) / 255,
g: parseInt(hex.slice(2, 4), 16) / 255,
b: parseInt(hex.slice(4, 6), 16) / 255,
},
};
if (variable) {
paint.boundVariables = { color: figma.variables.createVariableAlias(variable) };
} else if (varName) {
_recordUnresolved('color', varName, fallbackHex, node);
}
node[target] = [paint];
}
function bindNum(node, field, varName, fallback) {
node[field] = fallback;
const variable = varName ? getLayoutVar(varName) : null;
if (variable) {
try { node.setBoundVariable(field, variable); } catch (_) {}
} else if (varName) {
_recordUnresolved('num:' + field, varName, fallback, node);
}
}
const allTextStyles = await figma.getLocalTextStylesAsync();
const ICON_PACK_CFG = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.iconPack) || null;
let DEFAULT_ICON_COMPONENT = null;
let DEFAULT_ICON_RESOLUTION = 'none';
if (ICON_PACK_CFG) {
const ref = ICON_PACK_CFG.defaultIconRef
|| (ICON_PACK_CFG.defaultIconKey
? { kind: 'component-key', componentKey: ICON_PACK_CFG.defaultIconKey, nodeId: null, fileKey: null, rawInput: ICON_PACK_CFG.defaultIconKey }
: null);
const currentFileKey = (typeof figma.fileKey === 'string' && figma.fileKey) || ACTIVE_FILE_KEY || null;
if (ref) {
if (ref.componentKey && typeof ref.componentKey === 'string' && /^[a-f0-9]{40}$/.test(ref.componentKey)) {
try {
DEFAULT_ICON_COMPONENT = await figma.importComponentByKeyAsync(ref.componentKey);
DEFAULT_ICON_RESOLUTION = 'by-key';
} catch (err) {
DEFAULT_ICON_RESOLUTION = 'failed:key-unreachable:' + (err && err.message ? err.message : String(err));
console.warn('importComponentByKeyAsync failed for defaultIconRef.componentKey:', err);
}
}
const nodeIdIsCurrentFile =
ref.nodeId && (
ref.kind === 'node-id' ||
(ref.kind === 'url' && (!ref.fileKey || (currentFileKey && ref.fileKey === currentFileKey)))
);
if (!DEFAULT_ICON_COMPONENT && nodeIdIsCurrentFile) {
try {
const node = await figma.getNodeByIdAsync(ref.nodeId);
if (!node) {
DEFAULT_ICON_RESOLUTION = 'failed:node-not-found:' + ref.nodeId;
} else if (node.type === 'COMPONENT') {
DEFAULT_ICON_COMPONENT = node;
DEFAULT_ICON_RESOLUTION = 'by-node-id';
} else if (node.type === 'COMPONENT_SET') {
const firstVariant = node.children.find(ch => ch.type === 'COMPONENT');
if (firstVariant) {
DEFAULT_ICON_COMPONENT = firstVariant;
DEFAULT_ICON_RESOLUTION = 'by-node-id-variant';
} else {
DEFAULT_ICON_RESOLUTION = 'failed:component-set-empty:' + ref.nodeId;
}
} else {
DEFAULT_ICON_RESOLUTION = 'failed:node-wrong-type:' + node.type + ':' + ref.nodeId;
}
} catch (err) {
DEFAULT_ICON_RESOLUTION = 'failed:node-lookup:' + (err && err.message ? err.message : String(err));
console.warn('getNodeByIdAsync failed for defaultIconRef.nodeId:', err);
}
}
if (
!DEFAULT_ICON_COMPONENT
&& ref.kind === 'url'
&& ref.fileKey
&& currentFileKey
&& ref.fileKey !== currentFileKey
&& !ref.componentKey
) {
DEFAULT_ICON_RESOLUTION = 'failed:cross-file-needs-key';
}
if (
!DEFAULT_ICON_COMPONENT
&& ref.kind === 'url'
&& !ref.nodeId
&& !ref.componentKey
&& DEFAULT_ICON_RESOLUTION === 'none'
) {
DEFAULT_ICON_RESOLUTION = 'failed:url-missing-node-id';
}
}
}
const ICON_SLOT_MODE = DEFAULT_ICON_COMPONENT ? 'instance-swap' : 'placeholder';
const getDocStyle = name => allTextStyles.find(s => s.name === name) ?? null;
const DOC = {
section:   getDocStyle('Doc/Section'),
tokenName: getDocStyle('Doc/TokenName'),
code:      getDocStyle('Doc/Code'),
caption:   getDocStyle('Doc/Caption'),
};
function makeText(chars, styleKey, fallbackSize = 13, fillVar = 'color/background/content') {
const t = figma.createText();
t.fontName = { family: labelFont, style: 'Regular' };
t.characters = String(chars);
if (DOC[styleKey]) t.textStyleId = DOC[styleKey].id;
else t.fontSize = fallbackSize;
t.textAutoResize = 'HEIGHT';
bindColor(t, fillVar, '#0a0a0a', 'fills');
return t;
}
const DOC_FRAME_WIDTH = 1640;
const GUTTER_W_SIZE = 60;
const GUTTER_W_VARIANT = 160;
function hexToRgb(hex) {
const h = hex.replace('#', '');
return {
r: parseInt(h.slice(0, 2), 16) / 255,
g: parseInt(h.slice(2, 4), 16) / 255,
b: parseInt(h.slice(4, 6), 16) / 255,
};
}
function makeFrame(name, o = {}) {
const f = figma.createFrame();
f.name = name;
f.layoutMode = o.layoutMode ?? 'VERTICAL';
if (o.width != null) f.resize(o.width, o.height ?? 1);
f.primaryAxisSizingMode = o.primary ?? 'AUTO';
f.counterAxisSizingMode = o.counter ?? 'FIXED';
f.paddingTop    = o.padT ?? 0;
f.paddingRight  = o.padR ?? 0;
f.paddingBottom = o.padB ?? 0;
f.paddingLeft   = o.padL ?? 0;
f.itemSpacing   = o.itemSpacing ?? 0;
if (o.align)        f.layoutAlign           = o.align;
if (o.primaryAlign) f.primaryAxisAlignItems = o.primaryAlign;
if (o.counterAlign) f.counterAxisAlignItems = o.counterAlign;
if (o.fillVar)      bindColor(f, o.fillVar, o.fillHex ?? '#ffffff', 'fills');
else if (o.fillHex) f.fills = [{ type: 'SOLID', color: hexToRgb(o.fillHex) }];
else                f.fills = [];
if (o.strokeVar) {
bindColor(f, o.strokeVar, '#e5e7eb', 'strokes');
f.strokeWeight = o.strokeWeight ?? 1;
if (o.dashed)      f.dashPattern = [6, 4];
if (o.strokeSides) {
f.strokeTopWeight    = o.strokeSides.top    ?? 0;
f.strokeRightWeight  = o.strokeSides.right  ?? 0;
f.strokeBottomWeight = o.strokeSides.bottom ?? 0;
f.strokeLeftWeight   = o.strokeSides.left   ?? 0;
}
} else {
f.strokes = [];
}
if (o.radius != null) f.cornerRadius = o.radius;
if (o.minHeight != null) f.minHeight = o.minHeight;
return f;
}
function buildPropertiesTable(rows) {
const COLS = [
{ header: 'PROPERTY',    width: 240, style: 'tokenName' },
{ header: 'TYPE',        width: 380, style: 'code'      },
{ header: 'DEFAULT',     width: 160, style: 'code'      },
{ header: 'REQUIRED',    width: 120, style: 'code'      },
{ header: 'DESCRIPTION', width: 740, style: 'caption'   },
];
const group = makeFrame(`doc/table-group/${CONFIG.component}/properties`, {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
itemSpacing: 12, align: 'STRETCH',
});
const gtitle = makeText('Properties', 'section', 24, 'color/background/content');
gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
group.appendChild(gtitle);
const table = makeFrame(`doc/table/${CONFIG.component}/properties`, {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
align: 'STRETCH',
fillVar: 'color/background/default', fillHex: '#ffffff',
strokeVar: 'color/border/subtle',    strokeWeight: 1, radius: 16,
});
table.clipsContent = true;
group.appendChild(table);
const headerRow = makeFrame('header', {
layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
width: 1640, height: 56, counterAlign: 'CENTER',
fillVar: 'color/background/variant', fillHex: '#f4f4f5',
strokeVar: 'color/border/subtle', strokeWeight: 1,
strokeSides: { bottom: 1 },
});
table.appendChild(headerRow);
for (const col of COLS) {
const cell = makeFrame(`header/${col.header.toLowerCase()}`, {
layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
width: col.width, height: 56, padL: 20, padR: 20, counterAlign: 'CENTER',
});
headerRow.appendChild(cell);
const t = makeText(col.header, 'code', 12, 'color/background/content-muted');
t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
cell.appendChild(t);
}
for (let i = 0; i < rows.length; i++) {
const r = rows[i];
const isLast = i === rows.length - 1;
const row = makeFrame(`row/${r[0]}`, {
layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
width: 1640, align: 'STRETCH', padT: 16, padB: 16,
counterAlign: 'CENTER',
strokeVar: isLast ? null : 'color/border/subtle',
strokeWeight: isLast ? 0 : 1,
strokeSides: isLast ? undefined : { bottom: 1 },
});
row.minHeight = 64;
table.appendChild(row);
for (let j = 0; j < COLS.length; j++) {
const col = COLS[j];
const cell = makeFrame(`cell/${col.header.toLowerCase()}`, {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
width: col.width, padL: 20, padR: 20, padT: 4, padB: 4,
primaryAlign: 'CENTER', counterAlign: 'MIN',
});
row.appendChild(cell);
const fillVar = (j === 3 || j === 4) ? 'color/background/content-muted' : 'color/background/content';
const t = makeText(r[j], col.style, 13, fillVar);
t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
cell.appendChild(t);
}
}
return group;
}
function __ccPlaceholderPropertyRows() {
const n = (CONFIG.properties && CONFIG.properties.length) || 0;
const rows = [];
for (let i = 0; i < n; i++) {
rows.push([`placeholder-${i}`, '…', '…', '…', '…']);
}
return rows;
}
function __ccScaffoldPlaceholderFrame(slug, caption) {
const f = makeFrame(`doc/scaffold-placeholder/${CONFIG.component}/${slug}`, {
layoutMode: 'VERTICAL',
primary: 'AUTO',
counter: 'FIXED',
width: DOC_FRAME_WIDTH,
minHeight: slug === 'component-set' ? 140 : slug === 'matrix' ? 220 : 180,
padL: 24,
padR: 24,
padT: 20,
padB: 20,
itemSpacing: 8,
align: 'STRETCH',
strokeVar: 'color/border/subtle',
strokeWeight: 1,
dashed: true,
radius: 12,
});
const t = makeText(caption, 'caption', 13, 'color/background/content-muted');
t.resize(DOC_FRAME_WIDTH - 48, 1);
t.textAutoResize = 'HEIGHT';
f.appendChild(t);
return f;
}
function __ccDocAppendScaffoldPlaceholders() {
docRoot.appendChild(__ccScaffoldPlaceholderFrame(
'component-set',
'Scaffold — Component (filled when cc-doc-component runs, doc step 2)',
));
docRoot.appendChild(__ccScaffoldPlaceholderFrame(
'matrix',
'Scaffold — Variants × States matrix (slice 4)',
));
docRoot.appendChild(__ccScaffoldPlaceholderFrame(
'usage',
'Scaffold — Do / Don\u2019t usage (slice 5)',
));
}
async function __ccDocInsertOrReplaceSection(scaffoldSlug, buildSection) {
const phName = `doc/scaffold-placeholder/${CONFIG.component}/${scaffoldSlug}`;
const ph = docRoot.findOne(n => n.type === 'FRAME' && n.name === phName);
const section = await buildSection();
if (ph) {
const idx = ph.parent.children.indexOf(ph);
ph.remove();
docRoot.insertChild(idx, section);
} else {
docRoot.appendChild(section);
}
}
function buildUsageNotes() {
const row = makeFrame(`doc/component/${CONFIG.component}/usage`, {
layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', width: 1640,
itemSpacing: 30, align: 'STRETCH',
});
row.layoutSizingHorizontal = 'FIXED';
row.layoutSizingVertical = 'HUG';
function card(titleText, glyph, bullets) {
const c = makeFrame(`usage/${titleText.toLowerCase().replace(/[^a-z]/g, '')}`, {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805,
padL: 28, padR: 28, padT: 28, padB: 28, itemSpacing: 16,
fillVar: 'color/background/variant', fillHex: '#f4f4f5', radius: 16,
});
c.appendChild(makeText(`${glyph}  ${titleText}`, 'tokenName', 18, 'color/background/content'));
const list = makeFrame('bullets', {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805 - 56,
itemSpacing: 12, align: 'STRETCH',
});
c.appendChild(list);
for (const b of bullets) {
const bt = makeText(`·  ${b}`, 'caption', 13, 'color/background/content');
bt.resize(805 - 56, 1); bt.textAutoResize = 'HEIGHT';
list.appendChild(bt);
}
return c;
}
row.appendChild(card('Do',    '✓', CONFIG.usageDo));
row.appendChild(card("Don't", '✕', CONFIG.usageDont));
return row;
}
async function __ccDocAppendUsage() {
await __ccDocInsertOrReplaceSection('usage', buildUsageNotes);
}
docRoot = figma.currentPage.findOne(
n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
return {
ok: false,
section: 'usage',
missingFrame: `doc/component/${CONFIG.component}`,
};
}
await __ccDocAppendUsage();
return {
ok: true,
section: 'usage',
docRootId: docRoot.id,
};
