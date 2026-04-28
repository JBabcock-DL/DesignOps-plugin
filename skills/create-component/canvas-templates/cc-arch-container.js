function buildContainerVariant(name, fillVar, fallbackFill, {
  labelVar   = 'color/background/content',
  strokeVar  = 'color/border/subtle',
  radiusVar  = 'radius/md',
  padH       = 'space/md',
  sizeKey    = null,
} = {}) {
  const container = CONFIG.container || {};
  const kind = container.kind ?? 'accordion';  // 'accordion' | 'tabs'
  const expanded = /open=true|expanded=true|active=true|state=open/.test(name);
  const width = container.width ?? 360;

  if (kind === 'tabs') {
    const tabs = container.tabs ?? ['Account', 'Password', 'Notifications'];
    const activeIdx = container.activeIndex ?? 0;
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
    c.itemSpacing = 12;
    c.fills = [];

    const list = figma.createFrame();
    list.name = 'TabsList';
    list.layoutMode = 'HORIZONTAL';
    list.primaryAxisSizingMode = 'AUTO';
    list.counterAxisSizingMode = 'AUTO';
    list.primaryAxisAlignItems = 'MIN';
    list.counterAxisAlignItems = 'CENTER';
    list.paddingLeft = 4; list.paddingRight = 4;
    list.paddingTop = 4;  list.paddingBottom = 4;
    list.itemSpacing = 4;
    bindColor(list, 'color/background/variant', '#f4f4f5', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(list, fn, radiusVar, 6));
    tabs.forEach((t, i) => {
      const trigger = figma.createFrame();
      trigger.name = `TabsTrigger/${t.toLowerCase()}`;
      trigger.layoutMode = 'HORIZONTAL';
      trigger.primaryAxisSizingMode = 'AUTO';
      trigger.counterAxisSizingMode = 'AUTO';
      trigger.paddingLeft = 12; trigger.paddingRight = 12;
      trigger.paddingTop = 6;   trigger.paddingBottom = 6;
      trigger.primaryAxisAlignItems = 'CENTER';
      trigger.counterAxisAlignItems = 'CENTER';
      if (i === activeIdx) {
        bindColor(trigger, 'color/background/default', '#ffffff', 'fills');
      } else {
        trigger.fills = [];
      }
      ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
        .forEach(fn => bindNum(trigger, fn, radiusVar, 6));
      const lbl = makeSampleText(t, 'Label/SM', i === activeIdx ? labelVar : 'color/background/content-muted', 14, i === activeIdx ? 'Medium' : 'Regular');
      trigger.appendChild(lbl);
      list.appendChild(trigger);
    });
    c.appendChild(list);

    const panel = makeDashedSlot('TabsContent', {
      label: `${tabs[activeIdx]} content`,
      w: width,
      h: container.panelMinHeight ?? 120,
      stretch: true,
      radius: 8,
    });
    c.appendChild(panel);
    figma.currentPage.appendChild(c);
    return { component: c, slots: { list, panel }, propKeys: {} };
  }

  // accordion item
  const titleText = container.titleText ?? 'Is it accessible?';
  const panelText = container.panelText ?? 'Yes. It adheres to the WAI-ARIA design pattern.';
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
  c.itemSpacing = 0;
  c.fills = [];
  bindColor(c, strokeVar, '#e5e7eb', 'strokes');
  c.strokeWeight = 0;
  c.strokeTopWeight = 0; c.strokeRightWeight = 0; c.strokeLeftWeight = 0; c.strokeBottomWeight = 1;

  const trigger = figma.createFrame();
  trigger.name = 'AccordionTrigger';
  trigger.layoutMode = 'HORIZONTAL';
  trigger.primaryAxisSizingMode = 'FIXED';
  trigger.counterAxisSizingMode = 'AUTO';
  trigger.layoutAlign = 'STRETCH';
  trigger.primaryAxisAlignItems = 'SPACE_BETWEEN';
  trigger.counterAxisAlignItems = 'CENTER';
  trigger.paddingLeft = 0; trigger.paddingRight = 0;
  trigger.paddingTop = 12; trigger.paddingBottom = 12;
  trigger.itemSpacing = 8;
  trigger.fills = [];
  const tTitle = makeSampleText(titleText, 'Label/MD', labelVar, 14, 'Medium');
  tTitle.name = 'AccordionTrigger/title';
  trigger.appendChild(tTitle);
  const chev = makeIconSlotShared('icon-slot/chevron', 16);
  trigger.appendChild(chev);
  c.appendChild(trigger);

  let panel = null;
  if (expanded) {
    panel = figma.createFrame();
    panel.name = 'AccordionContent';
    panel.layoutMode = 'VERTICAL';
    panel.primaryAxisSizingMode = 'AUTO';
    panel.counterAxisSizingMode = 'FIXED';
    panel.layoutAlign = 'STRETCH';
    panel.paddingTop = 0; panel.paddingBottom = 16;
    panel.paddingLeft = 0; panel.paddingRight = 0;
    panel.fills = [];
    const body = makeSampleText(panelText, 'Label/SM', 'color/background/content-muted', 14);
    body.name = 'AccordionContent/body';
    panel.appendChild(body);
    c.appendChild(panel);
  }

  const propKeys = {};
  const cp = CONFIG.componentProps || {};
  try {
    if (cp.title !== false) {
      propKeys.title = c.addComponentProperty('Title', 'TEXT', String(titleText));
      tTitle.componentPropertyReferences = { characters: propKeys.title };
    }
    if (panel && cp.content !== false) {
      propKeys.content = c.addComponentProperty('Content', 'TEXT', String(panelText));
      panel.children[0].componentPropertyReferences = { characters: propKeys.content };
    }
    wireIconSwapProp(c, chev, propKeys, 'Icon: chevron');
  } catch (e) {
    console.warn('ccProp', name, e);
  }

  figma.currentPage.appendChild(c);
  return { component: c, slots: { trigger, chevron: chev, panel }, propKeys };
}

// When CONFIG.composes is non-empty, each variant is an instance stack: outer
// chrome still comes from this composite's cva (same bindColor/bindNum as
// buildVariant); inner children are real InstanceNodes of published atoms
// resolved via REGISTRY_COMPONENTS (conventions/02-archetype-routing.md §3.05).
