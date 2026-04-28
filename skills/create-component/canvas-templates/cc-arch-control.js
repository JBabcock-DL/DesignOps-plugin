function buildControlVariant(name, fillVar, fallbackFill, {
  labelVar  = 'color/background/content',
  strokeVar = 'color/border/default',
  radiusVar = 'radius/sm',
  padH      = 'space/none',
  sizeKey   = null,
} = {}) {
  const control = CONFIG.control || {};
  const shape = control.shape ?? 'checkbox';
  const sz = control.size ?? 16;
  const checked = /checked=true|pressed=true|on/.test(name);

  if (shape === 'switch') {
    const w = control.width ?? 36;
    const h = control.height ?? 20;
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'HORIZONTAL';
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    c.resize(w, h);
    c.primaryAxisAlignItems = checked ? 'MAX' : 'MIN';
    c.counterAxisAlignItems = 'CENTER';
    c.paddingLeft = 2; c.paddingRight = 2;
    bindColor(c, checked ? (control.trackOnVar ?? 'color/primary/default') : (control.trackOffVar ?? 'color/background/variant'), checked ? '#1a1a1a' : '#e5e7eb', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(c, fn, 'radius/full', h / 2));
    const thumb = figma.createFrame();
    thumb.name = 'switch/thumb';
    thumb.resize(h - 4, h - 4);
    bindColor(thumb, control.thumbVar ?? 'color/background/default', '#ffffff', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(thumb, fn, 'radius/full', (h - 4) / 2));
    c.appendChild(thumb);
    figma.currentPage.appendChild(c);
    return { component: c, slots: { thumb }, propKeys: {} };
  }

  // checkbox / radio
  const c = figma.createComponent();
  c.name = name;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'FIXED';
  c.resize(sz, sz);
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';
  const cornerTok = shape === 'radio' ? 'radius/full' : radiusVar;
  const cornerFallback = shape === 'radio' ? sz / 2 : 2;
  if (checked) {
    bindColor(c, fillVar ?? 'color/primary/default', fallbackFill ?? '#1a1a1a', 'fills');
  } else {
    c.fills = [];
  }
  bindColor(c, strokeVar, '#d4d4d8', 'strokes');
  c.strokeWeight = 1;
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(fn => bindNum(c, fn, cornerTok, cornerFallback));

  if (checked) {
    if (shape === 'radio') {
      const dot = figma.createFrame();
      dot.name = 'radio/dot';
      const dotSz = Math.round(sz * 0.5);
      dot.resize(dotSz, dotSz);
      bindColor(dot, control.indicatorVar ?? 'color/primary/content', '#ffffff', 'fills');
      ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
        .forEach(fn => bindNum(dot, fn, 'radius/full', dotSz / 2));
      c.appendChild(dot);
    } else {
      // shadcn Checkbox uses Lucide <CheckIcon> — use icon slot so DEFAULT_ICON_COMPONENT wires correctly
      const iconSz = Math.round(sz * 0.75);
      const check = makeIconSlotShared('checkbox/check-icon', iconSz);
      check.name = 'checkbox/check-icon';
      // tint the check to the indicator color
      if (check.type !== 'INSTANCE') {
        bindColor(check, control.indicatorVar ?? 'color/primary/content', '#ffffff', 'strokes');
      } else {
        bindColor(check, control.indicatorVar ?? 'color/primary/content', '#ffffff', 'fills');
      }
      c.appendChild(check);
    }
  }
  figma.currentPage.appendChild(c);
  return { component: c, slots: {}, propKeys: {} };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: container
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Accordion, Collapsible, Tabs, Resizable
// Reference: https://ui.shadcn.com/docs/components/radix/accordion
//            https://ui.shadcn.com/docs/components/radix/tabs
//
//   Accordion item → header row with title + chevron, divider, expandable
//                    content panel below (dashed slot when open)
//   Tabs           → TabsList row (padded, rounded, muted bg) with
//                    TabsTriggers + TabsContent dashed slot below
