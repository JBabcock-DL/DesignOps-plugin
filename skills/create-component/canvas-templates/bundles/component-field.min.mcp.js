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
function buildVariant(name, fillVar, fallbackFill, {
label            = null,
labelVar         = 'color/background/content',
strokeVar        = null,
radiusVar        = 'radius/md',
padH             = 'space/md',
padV             = 'space/xs',
labelStyleName   = null,
leadingSlot      = false,
trailingSlot     = false,
iconSlotSize     = 24,
addLabelProp     = false,
addLeadingProp   = false,
addTrailingProp  = false,
propLabelText    = 'Label',
} = {}) {
const c = figma.createComponent();
c.name = name;
c.layoutMode            = 'HORIZONTAL';
c.primaryAxisSizingMode = 'AUTO';
c.counterAxisSizingMode = 'AUTO';
c.primaryAxisAlignItems = 'CENTER';
c.counterAxisAlignItems = 'CENTER';
const hasLabel   = !!(label && String(label).length > 0);
const anySlot    = leadingSlot || trailingSlot;
const iconOnly   = !hasLabel && anySlot;
const padHEff    = iconOnly ? padH : padH;
const padVEff    = iconOnly ? padH : padV;
bindNum(c, 'paddingLeft',   padHEff,     16);
bindNum(c, 'paddingRight',  padHEff,     16);
bindNum(c, 'paddingTop',    padVEff,      8);
bindNum(c, 'paddingBottom', padVEff,      8);
bindNum(c, 'itemSpacing',  'space/sm',    8);
['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
.forEach(f => bindNum(c, f, radiusVar, 6));
bindColor(c, fillVar, fallbackFill, 'fills');
if (strokeVar) {
bindColor(c, strokeVar, '#e5e7eb', 'strokes');
c.strokeWeight = 1;
}
function makeIconSlot(slotName) {
if (DEFAULT_ICON_COMPONENT) {
const inst = DEFAULT_ICON_COMPONENT.createInstance();
inst.name = slotName;
try { inst.resize(iconSlotSize, iconSlotSize); } catch (_) {}
inst.layoutPositioning = 'AUTO';
return inst;
}
const f = figma.createFrame();
f.name          = slotName;
f.layoutMode    = 'NONE';
f.resize(iconSlotSize, iconSlotSize);
f.fills         = [];
bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
f.strokeWeight  = 1;
f.dashPattern   = [4, 3];
f.cornerRadius  = 4;
f.clipsContent  = false;
f.layoutPositioning = 'AUTO';
return f;
}
function makeLabel(text) {
const txt = figma.createText();
txt.fontName   = { family: labelFont, style: 'Medium' };
txt.characters = text;
const ts = labelStyleName
? allTextStyles.find(s => s.name === labelStyleName)
: null;
if (ts) {
txt.textStyleId = ts.id;
} else {
txt.fontSize = 14;
if (labelFontVar) {
try { txt.setBoundVariable('fontFamily', labelFontVar); } catch (_) {}
}
}
bindColor(txt, labelVar, '#000000', 'fills');
return txt;
}
const slots = { leading: null, trailing: null, center: null, label: null };
if (iconOnly) {
slots.center = makeIconSlot('icon-slot/center');
c.appendChild(slots.center);
} else {
if (leadingSlot) {
slots.leading = makeIconSlot('icon-slot/leading');
c.appendChild(slots.leading);
}
if (hasLabel) {
slots.label = makeLabel(label);
c.appendChild(slots.label);
}
if (trailingSlot) {
slots.trailing = makeIconSlot('icon-slot/trailing');
c.appendChild(slots.trailing);
}
}
const propKeys = {};
try {
if (addLabelProp && slots.label) {
propKeys.label = c.addComponentProperty('Label', 'TEXT', String(propLabelText));
slots.label.componentPropertyReferences = { characters: propKeys.label };
}
if (addLeadingProp && slots.leading) {
propKeys.leadingIcon = c.addComponentProperty('Leading icon', 'BOOLEAN', true);
slots.leading.componentPropertyReferences = { visible: propKeys.leadingIcon };
}
if (addTrailingProp && slots.trailing) {
propKeys.trailingIcon = c.addComponentProperty('Trailing icon', 'BOOLEAN', false);
slots.trailing.componentPropertyReferences = { visible: propKeys.trailingIcon };
}
if (DEFAULT_ICON_COMPONENT) {
const swapDefault = DEFAULT_ICON_COMPONENT.id;
const preferred = DEFAULT_ICON_COMPONENT.key
? [{ type: 'COMPONENT', key: DEFAULT_ICON_COMPONENT.key }]
: undefined;
const swapOpts = preferred ? { preferredValues: preferred } : undefined;
if (slots.leading) {
propKeys.leadingSwap = c.addComponentProperty('Icon: leading', 'INSTANCE_SWAP', swapDefault, swapOpts);
slots.leading.componentPropertyReferences = {
...(slots.leading.componentPropertyReferences || {}),
mainComponent: propKeys.leadingSwap,
};
}
if (slots.trailing) {
propKeys.trailingSwap = c.addComponentProperty('Icon: trailing', 'INSTANCE_SWAP', swapDefault, swapOpts);
slots.trailing.componentPropertyReferences = {
...(slots.trailing.componentPropertyReferences || {}),
mainComponent: propKeys.trailingSwap,
};
}
if (slots.center) {
propKeys.centerSwap = c.addComponentProperty('Icon', 'INSTANCE_SWAP', swapDefault, swapOpts);
slots.center.componentPropertyReferences = {
...(slots.center.componentPropertyReferences || {}),
mainComponent: propKeys.centerSwap,
};
}
}
} catch (err) {
const msg = err && err.message ? err.message : String(err);
__ccPropAddErrors.push({ variant: name, message: msg });
console.warn(`addComponentProperty failed on variant '${name}':`, msg);
}
figma.currentPage.appendChild(c);
return { component: c, slots, propKeys };
}
function makeDashedSlot(name, {
label = null,
w = 200,
h = 96,
radius = 8,
stretch = false,
grow = false,
captionFillVar = 'color/background/content-muted',
captionFillHex = '#6b7280',
captionSize = 12,
borderVar = 'color/border/subtle',
borderHex = '#e5e7eb',
fillVar = null,
fillHex = null,
padX = 12,
padY = 8,
} = {}) {
const f = figma.createFrame();
f.name = name;
f.layoutMode = 'HORIZONTAL';
f.primaryAxisSizingMode = 'FIXED';
f.counterAxisSizingMode = 'FIXED';
f.resize(w, h);
f.primaryAxisAlignItems = 'CENTER';
f.counterAxisAlignItems = 'CENTER';
f.paddingLeft = padX;
f.paddingRight = padX;
f.paddingTop = padY;
f.paddingBottom = padY;
f.itemSpacing = 0;
if (fillVar) bindColor(f, fillVar, fillHex ?? '#ffffff', 'fills');
else if (fillHex) {
const h2 = fillHex.replace('#', '');
f.fills = [{ type: 'SOLID', color: { r: parseInt(h2.slice(0,2),16)/255, g: parseInt(h2.slice(2,4),16)/255, b: parseInt(h2.slice(4,6),16)/255 } }];
} else {
f.fills = [];
}
bindColor(f, borderVar, borderHex, 'strokes');
f.strokeWeight = 1;
f.dashPattern = [6, 4];
f.cornerRadius = radius;
if (stretch) f.layoutAlign = 'STRETCH';
if (grow) f.layoutGrow = 1;
if (label != null) {
const cap = figma.createText();
cap.fontName = { family: labelFont, style: 'Regular' };
cap.characters = String(label);
cap.fontSize = captionSize;
bindColor(cap, captionFillVar, captionFillHex, 'fills');
cap.textAutoResize = 'HEIGHT';
f.appendChild(cap);
}
return f;
}
function makeSampleText(chars, styleName, fillVar = 'color/background/content', fallbackSize = 14, weight = 'Regular') {
const t = figma.createText();
t.fontName = { family: labelFont, style: weight };
t.characters = String(chars);
const ts = styleName ? allTextStyles.find(s => s.name === styleName) : null;
if (ts) {
t.textStyleId = ts.id;
} else {
t.fontSize = fallbackSize;
if (labelFontVar) { try { t.setBoundVariable('fontFamily', labelFontVar); } catch (_) {} }
}
bindColor(t, fillVar, '#0a0a0a', 'fills');
t.textAutoResize = 'HEIGHT';
return t;
}
function makeIconSlotShared(slotName, size = 24) {
if (DEFAULT_ICON_COMPONENT) {
const inst = DEFAULT_ICON_COMPONENT.createInstance();
inst.name = slotName;
try { inst.resize(size, size); } catch (_) {}
inst.layoutPositioning = 'AUTO';
return inst;
}
const f = figma.createFrame();
f.name          = slotName;
f.layoutMode    = 'NONE';
f.resize(size, size);
f.fills         = [];
bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
f.strokeWeight  = 1;
f.dashPattern   = [4, 3];
f.cornerRadius  = 4;
f.clipsContent  = false;
f.layoutPositioning = 'AUTO';
return f;
}
function wireIconSwapProp(comp, slotNode, propKeys, propName) {
if (!DEFAULT_ICON_COMPONENT || !slotNode || slotNode.type !== 'INSTANCE') return;
try {
const swapDefault = DEFAULT_ICON_COMPONENT.id;
const preferred = DEFAULT_ICON_COMPONENT.key
? [{ type: 'COMPONENT', key: DEFAULT_ICON_COMPONENT.key }]
: undefined;
const opts = preferred ? { preferredValues: preferred } : undefined;
const key = comp.addComponentProperty(propName, 'INSTANCE_SWAP', swapDefault, opts);
propKeys[propName] = key;
slotNode.componentPropertyReferences = {
...(slotNode.componentPropertyReferences || {}),
mainComponent: key,
};
} catch (e) {
console.warn('wI', propName, e);
}
}
function buildFieldVariant(name, fillVar, fallbackFill, {
labelVar   = 'color/background/content',
strokeVar  = 'color/border/default',
radiusVar  = 'radius/md',
padH       = 'space/md',
sizeKey    = null,
} = {}) {
const field = CONFIG.field || {};
const fieldType = field.fieldType ?? 'input';
const showLabel = field.showLabel !== false;
const labelText = field.labelText ?? 'Label';
const placeholderText = field.placeholderText ?? (fieldType === 'select' ? 'Select an option…' : 'Placeholder');
const showHelper = field.showHelper === true;
const helperText = field.helperText ?? 'Helper text';
const leadingIcon  = field.leadingIcon === true;
const trailingIcon = field.trailingIcon === true || fieldType === 'select';
const fh = sizeKey === 'sm' ? 32 : sizeKey === 'lg' ? 44 : 36;
const fontSize = sizeKey === 'sm' ? 12 : sizeKey === 'lg' ? 16 : 14;
const labelStyleName = field.labelStyleName ?? 'Label/SM';
const width = field.width ?? 320;
const c = figma.createComponent();
c.name = name;
c.layoutMode = 'VERTICAL';
c.resize(width, 1);
c.primaryAxisSizingMode = 'AUTO';
c.counterAxisSizingMode = 'FIXED';
c.layoutSizingHorizontal = 'FIXED';
c.layoutSizingVertical = 'HUG';
c.primaryAxisAlignItems = 'MIN';
c.counterAxisAlignItems = 'MIN';
bindNum(c, 'itemSpacing', 'space/xs', 6);
c.fills = [];
c.strokes = [];
let labelNode = null;
if (showLabel) {
labelNode = makeSampleText(labelText, labelStyleName, labelVar, 14, 'Medium');
labelNode.name = 'Label';
c.appendChild(labelNode);
}
const fieldChrome = figma.createFrame();
fieldChrome.name = 'field';
fieldChrome.layoutMode = fieldType === 'textarea' ? 'VERTICAL' : 'HORIZONTAL';
fieldChrome.layoutAlign = 'STRETCH';
if (fieldType === 'textarea') {
fieldChrome.resize(width, field.textareaMinHeight ?? 96);
} else {
fieldChrome.resize(width, fh);
}
fieldChrome.primaryAxisSizingMode = 'FIXED';
fieldChrome.counterAxisSizingMode = 'FIXED';
if (fieldType === 'textarea') {
fieldChrome.primaryAxisAlignItems = 'MIN';
fieldChrome.counterAxisAlignItems = 'MIN';
} else {
fieldChrome.primaryAxisAlignItems = fieldType === 'select' ? 'SPACE_BETWEEN' : 'MIN';
fieldChrome.counterAxisAlignItems = 'CENTER';
}
bindNum(fieldChrome, 'paddingLeft',  padH, 12);
bindNum(fieldChrome, 'paddingRight', padH, 12);
fieldChrome.paddingTop    = fieldType === 'textarea' ? 8 : 4;
fieldChrome.paddingBottom = fieldType === 'textarea' ? 8 : 4;
fieldChrome.itemSpacing = 8;
bindColor(fieldChrome, fillVar, fallbackFill, 'fills');
if (strokeVar) { bindColor(fieldChrome, strokeVar, '#e5e7eb', 'strokes'); fieldChrome.strokeWeight = 1; }
['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
.forEach(fn => bindNum(fieldChrome, fn, radiusVar, 6));
let leadingSlotNode = null;
if (leadingIcon) {
leadingSlotNode = makeIconSlotShared('icon-slot/leading', 20);
fieldChrome.appendChild(leadingSlotNode);
}
let placeholder = null;
if (fieldType === 'otp') {
const boxCount = field.otpLength ?? 6;
const boxW = Math.min(44, Math.floor((width - 12 * (boxCount - 1)) / boxCount));
fieldChrome.fills = [];
fieldChrome.strokes = [];
fieldChrome.itemSpacing = 8;
for (let i = 0; i < boxCount; i++) {
const box = figma.createFrame();
box.name = `otp-slot/${i}`;
box.layoutMode = 'HORIZONTAL';
box.resize(boxW, fh);
box.primaryAxisSizingMode = 'FIXED';
box.counterAxisSizingMode = 'FIXED';
box.primaryAxisAlignItems = 'CENTER';
box.counterAxisAlignItems = 'CENTER';
bindColor(box, fillVar, fallbackFill, 'fills');
bindColor(box, strokeVar ?? 'color/border/default', '#e5e7eb', 'strokes');
box.strokeWeight = 1;
['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
.forEach(fn => bindNum(box, fn, radiusVar, 6));
fieldChrome.appendChild(box);
}
} else {
placeholder = makeSampleText(placeholderText, null, 'color/background/content-muted', fontSize);
placeholder.name = fieldType === 'select' ? 'value' : 'placeholder';
if (fieldType !== 'textarea') placeholder.layoutGrow = 1;
fieldChrome.appendChild(placeholder);
}
let trailingSlotNode = null;
if (trailingIcon) {
trailingSlotNode = makeIconSlotShared(fieldType === 'select' ? 'icon-slot/chevron' : 'icon-slot/trailing', 16);
fieldChrome.appendChild(trailingSlotNode);
}
c.appendChild(fieldChrome);
let helperNode = null;
if (showHelper) {
helperNode = makeSampleText(helperText, 'Doc/Caption', 'color/background/content-muted', 12);
helperNode.name = 'helper';
c.appendChild(helperNode);
}
const propKeys = {};
const cp = CONFIG.componentProps || {};
try {
if (labelNode && cp.label !== false) {
propKeys.label = c.addComponentProperty('Label', 'TEXT', labelText);
labelNode.componentPropertyReferences = { characters: propKeys.label };
}
if (placeholder && cp.placeholder !== false) {
propKeys.placeholder = c.addComponentProperty('Placeholder', 'TEXT', placeholderText);
placeholder.componentPropertyReferences = { characters: propKeys.placeholder };
}
if (helperNode && cp.helper !== false) {
propKeys.helper = c.addComponentProperty('Helper', 'TEXT', helperText);
helperNode.componentPropertyReferences = { characters: propKeys.helper };
}
if (leadingSlotNode) {
propKeys.leadingIcon = c.addComponentProperty('Leading icon', 'BOOLEAN', true);
leadingSlotNode.componentPropertyReferences = {
...(leadingSlotNode.componentPropertyReferences || {}),
visible: propKeys.leadingIcon,
};
wireIconSwapProp(c, leadingSlotNode, propKeys, 'Icon: leading');
}
if (trailingSlotNode && fieldType !== 'select') {
propKeys.trailingIcon = c.addComponentProperty('Trailing icon', 'BOOLEAN', true);
trailingSlotNode.componentPropertyReferences = {
...(trailingSlotNode.componentPropertyReferences || {}),
visible: propKeys.trailingIcon,
};
wireIconSwapProp(c, trailingSlotNode, propKeys, 'Icon: trailing');
} else if (trailingSlotNode) {
wireIconSwapProp(c, trailingSlotNode, propKeys, 'Icon: chevron');
}
} catch (e) {
console.warn('ccProp', name, e);
}
figma.currentPage.appendChild(c);
return {
component: c,
slots: { label: labelNode, placeholder, helper: helperNode, leading: leadingSlotNode, trailing: trailingSlotNode, title: null, description: null, action: null, content: null, footer: null, center: null },
propKeys,
};
}
const sizeList = hasSizeAxis ? CONFIG.sizes : [null];
const padFallback = CONFIG.padH?.default ?? 'space/md';
const radiusVar = CONFIG.radius ?? 'radius/md';
const labelStyleFallback = CONFIG.labelStyle?.default ?? null;
const iconSlots = CONFIG.iconSlots || {};
const iconSlotSize = iconSlots.size ?? 24;
const leadingGlobal = !!iconSlots.leading;
const trailingGlobal = !!iconSlots.trailing;
const cp = CONFIG.componentProps || {};
const defaultLabelText = (() => {
if (typeof CONFIG.label !== 'function') return String(CONFIG.label ?? CONFIG.title ?? 'Label');
for (const s of sizeList) {
const l = CONFIG.label(s, CONFIG.variants[0]);
if (l) return String(l);
}
return String(CONFIG.title ?? 'Label');
})();
const layoutKey = usesComposes ? '__composes__' : (CONFIG.layout || 'chip');
let missingFn = null;
if (layoutKey === 'surface-stack' && typeof buildSurfaceStackVariant !== 'function') {
missingFn = 'buildSurfaceStackVariant';
} else if (layoutKey === 'field' && typeof buildFieldVariant !== 'function') {
missingFn = 'buildFieldVariant';
} else if (layoutKey === 'row-item' && typeof buildRowItemVariant !== 'function') {
missingFn = 'buildRowItemVariant';
} else if (layoutKey === 'tiny' && typeof buildTinyVariant !== 'function') {
missingFn = 'buildTinyVariant';
} else if (layoutKey === 'container' && typeof buildContainerVariant !== 'function') {
missingFn = 'buildContainerVariant';
} else if (layoutKey === 'control' && typeof buildControlVariant !== 'function') {
missingFn = 'buildControlVariant';
} else if (layoutKey === '__composes__' && typeof buildComposedVariant !== 'function') {
missingFn = 'buildComposedVariant';
}
if (missingFn) {
const layoutForPath = layoutKey === '__composes__' ? 'composed' : layoutKey;
throw new Error(
`[create-component] CONFIG.layout='${layoutKey}' requires ${missingFn}() in this bundle. ` +
`Use component-${layoutForPath}.min.mcp.js (archetype bundle).`,
);
}
const variantData = [];
for (const v of CONFIG.variants) {
for (const s of sizeList) {
const st = CONFIG.style[v];
if (!st) throw new Error(`CONFIG.style missing entry for variant '${v}'`);
const name = s === null ? `variant=${v}` : `variant=${v}, size=${s}`;
const label = typeof CONFIG.label === 'function' ? CONFIG.label(s, v) : (CONFIG.label ?? CONFIG.title);
const padH = (s !== null && CONFIG.padH?.[s]) || padFallback;
const labelStyleName = (s !== null && CONFIG.labelStyle?.[s]) || labelStyleFallback;
let built;
switch (layoutKey) {
case '__composes__':
built = buildComposedVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
padV: 'space/xs',
});
break;
case 'surface-stack':
built = buildSurfaceStackVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
propLabelText: defaultLabelText,
});
break;
case 'field':
built = buildFieldVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
});
break;
case 'row-item':
built = buildRowItemVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
});
break;
case 'tiny':
built = buildTinyVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
});
break;
case 'container':
built = buildContainerVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
});
break;
case 'control':
built = buildControlVariant(name, st.fill, st.fallback, {
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
sizeKey: s,
});
break;
case 'chip':
default:
if (layoutKey !== 'chip') {
console.warn(
`[create-component] Unknown CONFIG.layout='${layoutKey}' for '${CONFIG.component}' — falling back to chip.`,
);
}
built = buildVariant(name, st.fill, st.fallback, {
label,
labelVar: st.labelVar,
strokeVar: st.strokeVar,
radiusVar,
padH,
labelStyleName,
leadingSlot: leadingGlobal,
trailingSlot: trailingGlobal,
iconSlotSize,
addLabelProp: !!cp.label,
addLeadingProp: !!cp.leadingIcon && leadingGlobal,
addTrailingProp: !!cp.trailingIcon && trailingGlobal,
propLabelText: defaultLabelText,
});
break;
}
variantData.push(built);
}
}
variantBuildHolder = figma.createFrame();
variantBuildHolder.name = `_ccVariantBuild/${CONFIG.component}`;
figma.currentPage.appendChild(variantBuildHolder);
variantBuildHolder.visible = false;
let cx = 0;
for (const d of variantData) {
d.component.x = cx;
d.component.y = 0;
variantBuildHolder.appendChild(d.component);
cx += (d.component.width || 120) + 16;
}
compSet = null;
propsAdded = (() => {
const agg = {};
for (const d of variantData) {
for (const key of Object.keys(d.propKeys || {})) {
agg[key] = true;
}
}
agg.label = agg.label || false;
agg.leadingIcon = agg.leadingIcon || false;
agg.trailingIcon = agg.trailingIcon || false;
return agg;
})();
variantByKey = {};
for (const node of variantBuildHolder.children) {
if (node.type !== 'COMPONENT') continue;
const parts = node.name.split(', ').reduce((acc, kv) => {
const [k, val] = kv.split('=');
acc[k] = val;
return acc;
}, {});
const vk = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
variantByKey[vk] = node;
}
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
async function buildComponentSetSection() {
const section = makeFrame(`doc/component/${CONFIG.component}/component-set-group`, {
layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: DOC_FRAME_WIDTH,
itemSpacing: 12, align: 'STRETCH',
});
const stitle = makeText('Component', 'section', 24, 'color/background/content');
stitle.resize(DOC_FRAME_WIDTH, 1); stitle.textAutoResize = 'HEIGHT';
section.appendChild(stitle);
const scap = makeText(
'Live ComponentSet — this is the source of truth. Edit any variant here and every instance in the matrix below updates automatically.',
'caption', 13, 'color/background/content-muted',
);
scap.resize(DOC_FRAME_WIDTH, 1); scap.textAutoResize = 'HEIGHT';
section.appendChild(scap);
const holder = variantBuildHolder;
if (!holder || !holder.parent) {
throw new Error('[create-component] §6.6B: variant holder missing — run the component MCP slice after variants are built');
}
const comps = holder.children.filter(n => n.type === 'COMPONENT');
if (!comps.length) {
throw new Error('[create-component] §6.6B: variant holder has no COMPONENT children');
}
compSet = figma.combineAsVariants(comps, section);
compSet.name = `${CONFIG.title} — ComponentSet`;
holder.remove();
variantBuildHolder = null;
variantByKey = {};
for (const node of compSet.children) {
const parts = node.name.split(', ').reduce((acc, kv) => {
const [k, val] = kv.split('=');
acc[k] = val;
return acc;
}, {});
const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
variantByKey[key] = node;
}
compSet.layoutMode  = 'HORIZONTAL';
compSet.layoutWrap  = 'WRAP';
compSet.resize(DOC_FRAME_WIDTH, 1);
compSet.primaryAxisSizingMode = 'FIXED';
compSet.counterAxisSizingMode = 'AUTO';
compSet.paddingTop    = 32;
compSet.paddingBottom = 32;
compSet.paddingLeft   = 32;
compSet.paddingRight  = 32;
compSet.itemSpacing        = 24;
compSet.counterAxisSpacing = 24;
compSet.primaryAxisAlignItems = 'MIN';
compSet.counterAxisAlignItems = 'CENTER';
compSet.layoutAlign = 'STRETCH';
bindColor(compSet, 'color/background/variant', '#fafafa', 'fills');
bindColor(compSet, 'color/border/subtle',      '#e5e7eb', 'strokes');
compSet.strokeWeight = 1;
compSet.dashPattern  = [6, 4];
compSet.cornerRadius = 16;
return section;
}
async function __ccDocAppendComponentSection() {
await __ccDocInsertOrReplaceSection('component-set', buildComponentSetSection);
}
docRoot = figma.currentPage.findOne(
n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
return {
ok: false,
section: 'component',
missingFrame: `doc/component/${CONFIG.component}`,
};
}
await __ccDocAppendComponentSection();
function __ccNodePathUpToPage(node) {
const parts = [];
let x = node;
while (x && x.type !== 'PAGE') {
parts.unshift(x.name);
x = x.parent;
}
return parts.join('/');
}
function __ccSerializeCompSetPropertyDefinitions(cs) {
const out = {};
try {
const raw = cs.componentPropertyDefinitions;
if (!raw) return out;
for (const k of Object.keys(raw)) {
const d = raw[k];
out[k] = { type: d.type, defaultValue: d.defaultValue };
}
} catch (_e) {}
return out;
}
const page = figma.currentPage;
const pageName = page.name;
const docRootChildren = page.children.length;
const layout = CONFIG.layout || 'chip';
let compSetVariantRows = [];
let firstVariantChildren = [];
let compSetParent = null;
let compSetPropertyDefinitions = {};
let compSetVariants = 0;
if (compSet) {
compSetParent = __ccNodePathUpToPage(compSet.parent);
compSetPropertyDefinitions = __ccSerializeCompSetPropertyDefinitions(compSet);
compSetVariants = compSet.children.length;
for (const node of compSet.children) {
if (node.type !== 'COMPONENT') continue;
const childNames = node.children.map(ch => ch.name);
const hasText = node.findOne(n => n.type === 'TEXT') != null;
compSetVariantRows.push({ name: node.name, childNames, hasText });
}
const first = compSet.children[0];
if (first && first.type === 'COMPONENT') {
firstVariantChildren = first.children.map(ch => ch.name);
}
}
const unresolvedTokenPaths = {
total: typeof _unresolvedTokenMisses !== 'undefined' ? _unresolvedTokenMisses.length : 0,
};
const propErrorsSample = __ccPropAddErrors.slice(0, 5);
const propErrorsCount = __ccPropAddErrors.length;
return {
ok: true,
section: 'component',
docRootId: docRoot.id,
compSetId: compSet ? compSet.id : null,
compSetName: compSet ? compSet.name : null,
propsAdded,
pageName,
docRootChildren,
layout,
compSetParent,
compSetVariants,
compSetPropertyDefinitions,
firstVariantChildren,
compSetVariantRows,
unresolvedTokenPaths,
propErrorsCount,
propErrorsSample,
};
