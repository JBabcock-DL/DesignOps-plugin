function buildComposedVariant(name, fillVar, fallbackFill, {
  labelVar         = 'color/background/content',
  strokeVar        = null,
  radiusVar        = 'radius/md',
  padH             = 'space/md',
  padV             = 'space/xs',
  stateRole        = null,
  focusRingVar     = 'color/component/ring',
} = {}) {
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode            = 'HORIZONTAL';
  c.clipsContent          = false;
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

  if (stateRole) {
    ['hover', 'pressed', 'focus'].forEach(function(st) {
      const sl = figma.createFrame();
      sl.name               = 'state-layer/' + st;
      sl.layoutMode         = 'NONE';
      sl.layoutPositioning  = 'ABSOLUTE';
      sl.constraints        = { horizontal: 'STRETCH', vertical: 'STRETCH' };
      sl.resize(100, 100);
      sl.x                  = 0;
      sl.y                  = 0;
      sl.opacity            = 0;
      sl.fills              = [];
      sl.clipsContent       = false;
      ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
        .forEach(function(f) { bindNum(sl, f, radiusVar, 6); });
      bindColor(sl, 'color/state/' + stateRole + '/' + st, '#00000000', 'fills');
      c.appendChild(sl);
    });
    const ring = figma.createFrame();
    ring.name              = 'focus-ring';
    ring.layoutMode        = 'NONE';
    ring.layoutPositioning = 'ABSOLUTE';
    ring.constraints       = { horizontal: 'STRETCH', vertical: 'STRETCH' };
    ring.resize(100, 100);
    ring.x                 = 0;
    ring.y                 = 0;
    ring.opacity           = 0;
    ring.fills             = [];
    ring.clipsContent      = false;
    ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
      .forEach(function(f) { bindNum(ring, f, radiusVar, 6); });
    bindColor(ring, focusRingVar, '#3b82f6', 'strokes');
    ring.strokeWeight = 2;
    ring.strokeAlign  = 'OUTSIDE';
    c.appendChild(ring);
  }

  figma.currentPage.appendChild(c);
  return { component: c, slots: { leading: null, trailing: null, center: null, label: null }, propKeys: {} };
}

