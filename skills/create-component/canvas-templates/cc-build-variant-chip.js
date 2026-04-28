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

  // Auto-layout
  c.layoutMode            = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.primaryAxisAlignItems = 'CENTER';
  c.counterAxisAlignItems = 'CENTER';

  // Icon-only mode: no label → render a single centered slot, force square
  // padding so the component ends up square (matches shadcn `size=icon`).
  const hasLabel   = !!(label && String(label).length > 0);
  const anySlot    = leadingSlot || trailingSlot;
  const iconOnly   = !hasLabel && anySlot;
  const padHEff    = iconOnly ? padH : padH;      // same for both axes when icon-only
  const padVEff    = iconOnly ? padH : padV;      // square padding

  // Spacing — bind via Layout collection before combining
  bindNum(c, 'paddingLeft',   padHEff,     16);
  bindNum(c, 'paddingRight',  padHEff,     16);
  bindNum(c, 'paddingTop',    padVEff,      8);
  bindNum(c, 'paddingBottom', padVEff,      8);
  bindNum(c, 'itemSpacing',  'space/sm',    8);

  // Border radius — all four corners individually (Figma requires each separately)
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']
    .forEach(f => bindNum(c, f, radiusVar, 6));

  // Fill
  bindColor(c, fillVar, fallbackFill, 'fills');

  // Optional stroke
  if (strokeVar) {
    bindColor(c, strokeVar, '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
  }

  // --- Helpers scoped to this variant -----------------------------------
  // Two modes, selected by the top-level §5.6 resolver:
  //
  //   'instance-swap' (DEFAULT_ICON_COMPONENT is set): slot is an INSTANCE
  //       of the designer's chosen default library icon. Back at the
  //       variant-property block below, each slot gets an INSTANCE_SWAP
  //       component property so designers can swap per-instance via the
  //       right-panel dropdown without detaching the component.
  //
  //   'placeholder' (DEFAULT_ICON_COMPONENT is null): slot is a 24×24
  //       transparent frame with a 1px dashed stroke bound to
  //       `color/border/default`. Invisible in renders, discoverable on the
  //       canvas and layers panel. Designers drop SVG content into it later
  //       (stroke hides behind the child) or toggle the slot off via the
  //       matching Boolean property. cornerRadius: 4 keeps the placeholder
  //       visually distinct from the parent component chrome.
  //
  // DO NOT call `figma.importComponentByKeyAsync` here — that's an async
  // fetch and would break `buildVariant`'s sync contract. The default
  // component is resolved once at §5.6 and captured via closure.
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
    f.layoutMode    = 'NONE';       // children, if any, are positioned manually
    f.resize(iconSlotSize, iconSlotSize);
    f.fills         = [];
    bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
    f.strokeWeight  = 1;
    f.dashPattern   = [4, 3];
    f.cornerRadius  = 4;
    f.clipsContent  = false;
    // Keep the slot from stretching with the auto-layout row
    f.layoutPositioning = 'AUTO';
    return f;
  }

  function makeLabel(text) {
    const txt = figma.createText();
    txt.fontName   = { family: labelFont, style: 'Medium' };
    txt.characters = text;
    // Prefer a published text style (Label/XS · Label/SM · Label/MD · Label/LG)
    // so every component label stays in sync with the Typography system.
    // Falls back to raw fontSize + bound font-family variable if the style
    // doesn't exist in the file yet.
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

  // --- Assemble children -------------------------------------------------
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

  // --- Element component properties -------------------------------------
  // Added on THIS variant component BEFORE combineAsVariants (the API
  // contract — see figma-use/component-patterns.md). After combining,
  // the ComponentSet merges identically-named properties across variants
  // into a single set-level property that designers see in the Properties
  // panel. Each variant has its own key; we store them on `propKeys` only
  // for optional debugging / reporting downstream.
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

    // INSTANCE_SWAP wiring — only when §5.6 resolved a default library icon.
    // Each `icon-slot/*` instance gets its own INSTANCE_SWAP property bound
    // to `mainComponent` so designers can swap to any icon from the library
    // via the right-panel dropdown. The default value is the same library
    // component id for every slot; designers override per-instance at the
    // canvas usage site, not here.
    //
    // Per Figma API: INSTANCE_SWAP property defaultValue is the component
    // id of the default target. The `preferredValues` hint scopes the
    // dropdown to the same library the default came from, when available.
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

  // Append to current page before any combining
  figma.currentPage.appendChild(c);
  return { component: c, slots, propKeys };
}
