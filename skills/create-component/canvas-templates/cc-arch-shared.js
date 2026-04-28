// Create a dashed placeholder slot with a centered caption.
// Use for content regions, footer action slots, avatar image placeholders,
// chart placeholders, etc. — anywhere a designer will drop a replacement.
function makeDashedSlot(name, {
  label = null,
  w = 200,
  h = 96,
  radius = 8,
  stretch = false,
  grow = false,
  captionFillVar = 'color/background/content-muted',
  captionFillHex = '#6b7280',
  captionSize = 12,
  borderVar = 'color/border/subtle',
  borderHex = '#e5e7eb',
  fillVar = null,
  fillHex = null,
  padX = 12,
  padY = 8,
} = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.resize(w, h);
  f.primaryAxisAlignItems = 'CENTER';
  f.counterAxisAlignItems = 'CENTER';
  f.paddingLeft = padX;
  f.paddingRight = padX;
  f.paddingTop = padY;
  f.paddingBottom = padY;
  f.itemSpacing = 0;
  if (fillVar) bindColor(f, fillVar, fillHex ?? '#ffffff', 'fills');
  else if (fillHex) {
    const h2 = fillHex.replace('#', '');
    f.fills = [{ type: 'SOLID', color: { r: parseInt(h2.slice(0,2),16)/255, g: parseInt(h2.slice(2,4),16)/255, b: parseInt(h2.slice(4,6),16)/255 } }];
  } else {
    f.fills = [];
  }
  bindColor(f, borderVar, borderHex, 'strokes');
  f.strokeWeight = 1;
  f.dashPattern = [6, 4];
  f.cornerRadius = radius;
  if (stretch) f.layoutAlign = 'STRETCH';
  if (grow) f.layoutGrow = 1;
  if (label != null) {
    const cap = figma.createText();
    cap.fontName = { family: labelFont, style: 'Regular' };
    cap.characters = String(label);
    cap.fontSize = captionSize;
    bindColor(cap, captionFillVar, captionFillHex, 'fills');
    cap.textAutoResize = 'HEIGHT';
    f.appendChild(cap);
  }
  return f;
}

// Create a sample text node using a published text style when available.
// Used everywhere the designer sees meaningful sample copy (CardTitle,
// CardDescription, Input Label, DropdownMenuItem Title, etc).
function makeSampleText(chars, styleName, fillVar = 'color/background/content', fallbackSize = 14, weight = 'Regular') {
  const t = figma.createText();
  t.fontName = { family: labelFont, style: weight };
  t.characters = String(chars);
  const ts = styleName ? allTextStyles.find(s => s.name === styleName) : null;
  if (ts) {
    t.textStyleId = ts.id;
  } else {
    t.fontSize = fallbackSize;
    if (labelFontVar) { try { t.setBoundVariable('fontFamily', labelFontVar); } catch (_) {} }
  }
  bindColor(t, fillVar, '#0a0a0a', 'fills');
  t.textAutoResize = 'HEIGHT';
  return t;
}

// Icon slot factory reusable across archetypes. Mirrors the `makeIconSlot`
// inside `buildVariant` but is callable from any builder. Honors the
// `DEFAULT_ICON_COMPONENT` resolution (`draw-engine.figma.js §5.6`) so
// INSTANCE_SWAP wiring stays consistent across archetypes.
function makeIconSlotShared(slotName, size = 24) {
  if (DEFAULT_ICON_COMPONENT) {
    const inst = DEFAULT_ICON_COMPONENT.createInstance();
    inst.name = slotName;
    try { inst.resize(size, size); } catch (_) {}
    inst.layoutPositioning = 'AUTO';
    return inst;
  }
  const f = figma.createFrame();
  f.name          = slotName;
  f.layoutMode    = 'NONE';
  f.resize(size, size);
  f.fills         = [];
  bindColor(f, 'color/border/default', '#d4d4d8', 'strokes');
  f.strokeWeight  = 1;
  f.dashPattern   = [4, 3];
  f.cornerRadius  = 4;
  f.clipsContent  = false;
  f.layoutPositioning = 'AUTO';
  return f;
}

// Wire a INSTANCE_SWAP component property on an icon-slot instance when
// DEFAULT_ICON_COMPONENT is set. No-op for placeholder frames.
function wireIconSwapProp(comp, slotNode, propKeys, propName) {
  if (!DEFAULT_ICON_COMPONENT || !slotNode || slotNode.type !== 'INSTANCE') return;
  try {
    const swapDefault = DEFAULT_ICON_COMPONENT.id;
    const preferred = DEFAULT_ICON_COMPONENT.key
      ? [{ type: 'COMPONENT', key: DEFAULT_ICON_COMPONENT.key }]
      : undefined;
    const opts = preferred ? { preferredValues: preferred } : undefined;
    const key = comp.addComponentProperty(propName, 'INSTANCE_SWAP', swapDefault, opts);
    propKeys[propName] = key;
    slotNode.componentPropertyReferences = {
      ...(slotNode.componentPropertyReferences || {}),
      mainComponent: key,
    };
  } catch (e) {
    console.warn('wI', propName, e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: surface-stack
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Card, Alert, Alert Dialog, Dialog, Sheet, Drawer, Popover,
//              Tooltip, Hover Card, Empty
// Reference: https://ui.shadcn.com/docs/components/radix/card (Card.tsx)
//
//   Card   → flex flex-col gap-6 rounded-xl border py-6
//   Header → grid items-start gap-1.5 px-6 has-[action]:grid-cols-[1fr_auto]
//   Title  → leading-none font-semibold
//   Desc   → text-muted-foreground text-sm
//   Action → col-start-2 row-span-2 row-start-1 self-start justify-self-end
//   Content→ px-6
//   Footer → flex items-center px-6
//   size=sm→ gap-4 py-4
