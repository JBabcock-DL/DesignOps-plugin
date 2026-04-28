function buildSurfaceStackVariant(name, fillVar, fallbackFill, {
  labelVar      = 'color/background/content',
  strokeVar     = 'color/border/subtle',
  radiusVar     = 'radius/xl',
  padH          = 'space/2xl',
  sizeKey       = null,
} = {}) {
  const surface = CONFIG.surface || {};
  const padYTok = surface.sectionPadY ?? padH;
  const gapTok  = surface.gap ?? padH;
  const innerGapTok = surface.innerGap ?? 'space/xs';
  const width   = surface.width ?? 420;

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
  c.paddingLeft = 0;
  c.paddingRight = 0;
  bindNum(c, 'paddingTop',    padYTok, 24);
  bindNum(c, 'paddingBottom', padYTok, 24);
  bindNum(c, 'itemSpacing',   gapTok,  24);
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(fn => bindNum(c, fn, radiusVar, 12));
  bindColor(c, fillVar, fallbackFill, 'fills');
  if (strokeVar) { bindColor(c, strokeVar, '#e5e7eb', 'strokes'); c.strokeWeight = 1; }

  const titleText = typeof surface.titleText === 'function'
    ? (surface.titleText(sizeKey, null) ?? CONFIG.title)
    : (surface.titleText ?? CONFIG.title);
  const descText = typeof surface.descriptionText === 'function'
    ? surface.descriptionText(sizeKey, null)
    : (surface.descriptionText ?? CONFIG.summary?.split('.')[0] ?? null);

  const header = figma.createFrame();
  header.name = 'CardHeader';
  header.layoutMode = 'HORIZONTAL';
  header.primaryAxisSizingMode = 'FIXED';
  header.counterAxisSizingMode = 'AUTO';
  header.layoutAlign = 'STRETCH';
  header.counterAxisAlignItems = 'MIN';
  bindNum(header, 'paddingLeft',  padH, 24);
  bindNum(header, 'paddingRight', padH, 24);
  header.itemSpacing = 16;
  header.fills = [];

  const titleStack = figma.createFrame();
  titleStack.name = 'CardHeader/title-stack';
  titleStack.layoutMode = 'VERTICAL';
  titleStack.primaryAxisSizingMode = 'AUTO';
  titleStack.counterAxisSizingMode = 'AUTO';
  titleStack.layoutGrow = 1;
  bindNum(titleStack, 'itemSpacing', innerGapTok, 6);
  titleStack.fills = [];

  const titleNode = makeSampleText(titleText, surface.titleStyleName ?? 'Label/LG', labelVar, 18, 'Medium');
  titleNode.name = 'CardTitle';
  titleStack.appendChild(titleNode);

  let descNode = null;
  if (descText) {
    descNode = makeSampleText(descText, surface.descriptionStyleName ?? 'Label/SM', 'color/background/content-muted', 14);
    descNode.name = 'CardDescription';
    titleStack.appendChild(descNode);
  }
  header.appendChild(titleStack);

  let actionSlot = null;
  const actionSpec = surface.actionSlot;
  if (actionSpec && actionSpec.enabled) {
    actionSlot = makeDashedSlot('CardAction', {
      label: actionSpec.slotLabel ?? 'Action',
      w: actionSpec.width ?? 80,
      h: actionSpec.height ?? 32,
      radius: 6,
    });
    header.appendChild(actionSlot);
  }
  c.appendChild(header);

  let contentFrame = null;
  let contentSlotNode = null;
  const contentSpec = surface.contentSlot ?? { enabled: true, slotLabel: 'Content', minHeight: 96 };
  if (contentSpec.enabled !== false) {
    contentFrame = figma.createFrame();
    contentFrame.name = 'CardContent';
    contentFrame.layoutMode = 'VERTICAL';
    contentFrame.primaryAxisSizingMode = 'AUTO';
    contentFrame.counterAxisSizingMode = 'FIXED';
    contentFrame.layoutAlign = 'STRETCH';
    bindNum(contentFrame, 'paddingLeft',  padH, 24);
    bindNum(contentFrame, 'paddingRight', padH, 24);
    contentFrame.itemSpacing = 8;
    contentFrame.fills = [];
    contentSlotNode = makeDashedSlot('content-slot', {
      label:     contentSpec.slotLabel ?? 'Content',
      w:         width - 48,
      h:         contentSpec.minHeight ?? 96,
      stretch:   true,
      radius:    8,
    });
    contentFrame.appendChild(contentSlotNode);
    c.appendChild(contentFrame);
  }

  let footerFrame = null;
  const footerSpec = surface.footerSlot ?? { enabled: false };
  if (footerSpec.enabled) {
    footerFrame = figma.createFrame();
    footerFrame.name = 'CardFooter';
    footerFrame.layoutMode = 'HORIZONTAL';
    footerFrame.primaryAxisSizingMode = 'FIXED';
    footerFrame.counterAxisSizingMode = 'AUTO';
    footerFrame.layoutAlign = 'STRETCH';
    const align = footerSpec.align ?? 'start';
    footerFrame.primaryAxisAlignItems = align === 'end' ? 'MAX' : align === 'between' ? 'SPACE_BETWEEN' : 'MIN';
    footerFrame.counterAxisAlignItems = 'CENTER';
    bindNum(footerFrame, 'paddingLeft',  padH, 24);
    bindNum(footerFrame, 'paddingRight', padH, 24);
    footerFrame.itemSpacing = 8;
    footerFrame.fills = [];
    const fh = footerSpec.minHeight ?? 44;
    const fLabel = footerSpec.slotLabel ?? 'Footer';
    const footerSlotNode = makeDashedSlot(`footer-slot/${fLabel.toLowerCase().replace(/\s+/g, '-')}`, {
      label: fLabel, w: 140, h: fh, radius: 6,
    });
    footerFrame.appendChild(footerSlotNode);
    c.appendChild(footerFrame);
  }

  const propKeys = {};
  const cp = CONFIG.componentProps || {};
  try {
    if (cp.title !== false) {
      propKeys.title = c.addComponentProperty('Title', 'TEXT', String(titleText));
      titleNode.componentPropertyReferences = { characters: propKeys.title };
    }
    if (descNode && cp.description !== false) {
      propKeys.description = c.addComponentProperty('Description', 'TEXT', String(descText));
      descNode.componentPropertyReferences = { characters: propKeys.description };
    }
    if (actionSlot && cp.actionSlot !== false) {
      propKeys.actionSlot = c.addComponentProperty('Show action', 'BOOLEAN', true);
      actionSlot.componentPropertyReferences = { visible: propKeys.actionSlot };
    }
    if (footerFrame && cp.footer !== false) {
      propKeys.footer = c.addComponentProperty('Show footer', 'BOOLEAN', true);
      footerFrame.componentPropertyReferences = { visible: propKeys.footer };
    }
  } catch (e) {
    console.warn('ccProp', name, e);
  }

  figma.currentPage.appendChild(c);
  return {
    component: c,
    slots: { title: titleNode, description: descNode, action: actionSlot, content: contentSlotNode, footer: footerFrame, label: null, leading: null, trailing: null, center: null },
    propKeys,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: field
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Input, Textarea, Select, Combobox, Date Picker, Input OTP,
//              Input Group, Label, Native Select
// Reference: https://ui.shadcn.com/docs/components/radix/input (Input.tsx)
//
//   Input    → flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm
//   Textarea → flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm
//   Select   → flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm
//   sm/lg    → h-8 text-xs / h-10 text-base (per shadcn size variants)
