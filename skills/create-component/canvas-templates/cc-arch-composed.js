function buildComposedVariant(name, fillVar, fallbackFill, {
  labelVar         = 'color/background/content',
  strokeVar        = null,
  radiusVar        = 'radius/md',
  padH             = 'space/md',
  padV             = 'space/xs',
} = {}) {
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode            = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  bindNum(c, 'paddingLeft',   padH,     16);
  bindNum(c, 'paddingRight',  padH,     16);
  bindNum(c, 'paddingTop',    padV,      8);
  bindNum(c, 'paddingBottom', padV,      8);
  bindNum(c, 'itemSpacing',  'space/sm', 8);
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));
  bindColor(c, fillVar, fallbackFill, 'fills');
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  for (const spec of CONFIG.composes) {
    const slotFrame = figma.createFrame();
    slotFrame.name = `slot/${spec.slot}`;
    slotFrame.layoutMode = 'HORIZONTAL';
    slotFrame.primaryAxisSizingMode = 'AUTO';
    slotFrame.counterAxisSizingMode = 'AUTO';
    slotFrame.primaryAxisAlignItems = 'CENTER';
    slotFrame.counterAxisAlignItems = 'CENTER';
    bindNum(slotFrame, 'paddingLeft',   'space/none', 0);
    bindNum(slotFrame, 'paddingRight',  'space/none', 0);
    bindNum(slotFrame, 'paddingTop',    'space/none', 0);
    bindNum(slotFrame, 'paddingBottom', 'space/none', 0);
    bindNum(slotFrame, 'itemSpacing',  'space/sm', 8);

    const reg = REGISTRY_COMPONENTS[spec.component];
    if (!reg || !reg.nodeId) {
      throw new Error(
        `Composite '${CONFIG.component}' composes '${spec.component}' but registry is missing nodeId. ` +
          `Draw ${spec.component} first (updates .designops-registry.json), then re-run this composite.`,
      );
    }
    const main = figma.getNodeById(reg.nodeId);
    if (!main || main.type !== 'COMPONENT_SET') {
      throw new Error(
        `Registry node for '${spec.component}' must be a COMPONENT_SET (got ${main ? main.type : 'null'}).`,
      );
    }
    const n = spec.cardinality === 'many' ? (spec.count != null ? spec.count : 3) : 1;
    for (let i = 0; i < n; i++) {
      const inst = main.createInstance();
      if (spec.defaultProps && typeof spec.defaultProps === 'object') {
        try {
          inst.setProperties(spec.defaultProps);
        } catch (e) {
          console.warn('setP', spec.component, e);
        }
      }
      slotFrame.appendChild(inst);
    }
    c.appendChild(slotFrame);
  }

  figma.currentPage.appendChild(c);
  return { component: c, slots: { leading: null, trailing: null, center: null, label: null }, propKeys: {} };
}

