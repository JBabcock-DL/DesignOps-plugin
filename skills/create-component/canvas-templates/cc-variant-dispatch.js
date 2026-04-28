// Full archetype dispatch — from draw-engine.figma.js §6.2a (single-pass, no _ccPhase).
// Requires: buildVariant, archetype builders, CONFIG, usesComposes.
// Globals `compSet`, `variantBuildHolder`, `variantByKey` come from the bundle preamble.

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
