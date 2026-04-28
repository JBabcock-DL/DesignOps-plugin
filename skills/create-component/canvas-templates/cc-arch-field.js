function buildFieldVariant(name, fillVar, fallbackFill, {
  labelVar   = 'color/background/content',
  strokeVar  = 'color/border/default',
  radiusVar  = 'radius/md',
  padH       = 'space/md',
  sizeKey    = null,
} = {}) {
  const field = CONFIG.field || {};
  const fieldType = field.fieldType ?? 'input';           // 'input' | 'textarea' | 'select' | 'otp'
  const showLabel = field.showLabel !== false;
  const labelText = field.labelText ?? 'Label';
  const placeholderText = field.placeholderText ?? (fieldType === 'select' ? 'Select an option…' : 'Placeholder');
  const showHelper = field.showHelper === true;
  const helperText = field.helperText ?? 'Helper text';
  const leadingIcon  = field.leadingIcon === true;
  const trailingIcon = field.trailingIcon === true || fieldType === 'select';  // Select always has chevron
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

  // OTP renders as 4-6 small boxes rather than a single field.
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
      // Select chevron — INSTANCE_SWAP only, no boolean toggle.
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

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: row-item
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Item, Dropdown Menu (MenuItem), Menubar Item, Navigation Menu
//              Item, Context Menu Item, Command Item, Breadcrumb Item,
//              Sidebar row
// Reference: https://ui.shadcn.com/docs/components/radix/dropdown-menu
//            https://ui.shadcn.com/docs/components/radix/item
//
//   MenuItem → flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm
//   Item     → lead-icon + (title + description stacked) + trail-action
