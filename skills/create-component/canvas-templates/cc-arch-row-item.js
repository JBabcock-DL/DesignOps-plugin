function buildRowItemVariant(name, fillVar, fallbackFill, {
  labelVar   = 'color/background/content',
  strokeVar  = null,
  radiusVar  = 'radius/sm',
  padH       = 'space/sm',
  sizeKey    = null,
} = {}) {
  const row = CONFIG.row || {};
  const titleText = row.titleText ?? CONFIG.title ?? 'Item';
  const descText  = row.descriptionText ?? null;
  const showLeading  = row.leadingIcon !== false;
  const showTrailing = row.trailingIcon !== false;
  const showShortcut = row.shortcut === true;
  const shortcutText = row.shortcutText ?? '⌘K';
  const width = row.width ?? 280;

  const c = figma.createComponent();
  c.name = name;
  c.layoutMode = 'HORIZONTAL';
  c.resize(width, 1);
  c.primaryAxisSizingMode = 'FIXED';
  c.counterAxisSizingMode = 'AUTO';
  c.layoutSizingHorizontal = 'FIXED';
  c.layoutSizingVertical = 'HUG';
  c.primaryAxisAlignItems = 'MIN';
  c.counterAxisAlignItems = 'CENTER';
  bindNum(c, 'paddingLeft',   padH, 12);
  bindNum(c, 'paddingRight',  padH, 12);
  bindNum(c, 'paddingTop',    'space/xs', 6);
  bindNum(c, 'paddingBottom', 'space/xs', 6);
  bindNum(c, 'itemSpacing',   'space/sm', 8);
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(fn => bindNum(c, fn, radiusVar, 4));
  bindColor(c, fillVar, fallbackFill, 'fills');
  if (strokeVar) { bindColor(c, strokeVar, '#e5e7eb', 'strokes'); c.strokeWeight = 1; }

  let leadingSlotNode = null;
  if (showLeading) {
    leadingSlotNode = makeIconSlotShared('icon-slot/leading', 16);
    c.appendChild(leadingSlotNode);
  }

  const textStack = figma.createFrame();
  textStack.name = 'row/text-stack';
  textStack.layoutMode = 'VERTICAL';
  textStack.primaryAxisSizingMode = 'AUTO';
  textStack.counterAxisSizingMode = 'AUTO';
  textStack.layoutGrow = 1;
  textStack.itemSpacing = 2;
  textStack.fills = [];

  const titleNode = makeSampleText(titleText, row.titleStyleName ?? 'Label/SM', labelVar, 14);
  titleNode.name = 'row/title';
  textStack.appendChild(titleNode);

  let descNode = null;
  if (descText) {
    descNode = makeSampleText(descText, row.descriptionStyleName ?? 'Doc/Caption', 'color/background/content-muted', 12);
    descNode.name = 'row/description';
    textStack.appendChild(descNode);
  }
  c.appendChild(textStack);

  let shortcutNode = null;
  if (showShortcut) {
    shortcutNode = makeSampleText(shortcutText, 'Doc/Code', 'color/background/content-muted', 12);
    shortcutNode.name = 'row/shortcut';
    c.appendChild(shortcutNode);
  }

  let trailingSlotNode = null;
  if (showTrailing) {
    trailingSlotNode = makeIconSlotShared(row.trailingIsChevron ? 'icon-slot/chevron' : 'icon-slot/trailing', 16);
    c.appendChild(trailingSlotNode);
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
    if (shortcutNode && cp.shortcut !== false) {
      propKeys.shortcut = c.addComponentProperty('Shortcut', 'TEXT', String(shortcutText));
      shortcutNode.componentPropertyReferences = { characters: propKeys.shortcut };
    }
    if (leadingSlotNode) {
      propKeys.leadingIcon = c.addComponentProperty('Leading icon', 'BOOLEAN', true);
      leadingSlotNode.componentPropertyReferences = {
        ...(leadingSlotNode.componentPropertyReferences || {}),
        visible: propKeys.leadingIcon,
      };
      wireIconSwapProp(c, leadingSlotNode, propKeys, 'Icon: leading');
    }
    if (trailingSlotNode) {
      propKeys.trailingIcon = c.addComponentProperty('Trailing icon', 'BOOLEAN', true);
      trailingSlotNode.componentPropertyReferences = {
        ...(trailingSlotNode.componentPropertyReferences || {}),
        visible: propKeys.trailingIcon,
      };
      wireIconSwapProp(c, trailingSlotNode, propKeys, row.trailingIsChevron ? 'Icon: chevron' : 'Icon: trailing');
    }
  } catch (e) {
    console.warn('ccProp', name, e);
  }

  figma.currentPage.appendChild(c);
  return {
    component: c,
    slots: { title: titleNode, description: descNode, leading: leadingSlotNode, trailing: trailingSlotNode, shortcut: shortcutNode, label: null, action: null, content: null, footer: null, center: null },
    propKeys,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: tiny
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Separator, Skeleton, Spinner, Progress, Aspect Ratio, Avatar,
//              Scroll Area
// Reference: https://ui.shadcn.com/docs/components/radix/separator
//            https://ui.shadcn.com/docs/components/radix/skeleton
//            https://ui.shadcn.com/docs/components/radix/avatar
//            https://ui.shadcn.com/docs/components/radix/progress
//
// Dispatches on CONFIG.tiny.shape to render the canonical primitive.
