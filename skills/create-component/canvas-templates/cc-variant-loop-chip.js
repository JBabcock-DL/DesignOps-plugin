// Chip-only variant plane — extracted from draw-engine.figma.js §6.2a default branch.
// `hasSizeAxis`, `compSet`, `variantBuildHolder`, `variantByKey` come from the bundle preamble.

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

const variantData = [];
for (const v of CONFIG.variants) {
  for (const s of sizeList) {
    const st = CONFIG.style[v];
    if (!st) throw new Error(`CONFIG.style missing entry for variant '${v}'`);
    const name = s === null ? `variant=${v}` : `variant=${v}, size=${s}`;
    const label = typeof CONFIG.label === 'function' ? CONFIG.label(s, v) : (CONFIG.label ?? CONFIG.title);
    const padH = (s !== null && CONFIG.padH?.[s]) || padFallback;
    const labelStyleName = (s !== null && CONFIG.labelStyle?.[s]) || labelStyleFallback;
    const built = buildVariant(name, st.fill, st.fallback, {
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
