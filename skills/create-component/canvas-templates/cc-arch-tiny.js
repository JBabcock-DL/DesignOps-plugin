function buildTinyVariant(name, fillVar, fallbackFill, {
  labelVar   = 'color/background/content',
  strokeVar  = null,
  radiusVar  = 'radius/full',
  padH       = 'space/none',
  sizeKey    = null,
} = {}) {
  const tiny = CONFIG.tiny || {};
  const shape = tiny.shape ?? 'skeleton';
  const orientation = tiny.orientation ?? 'horizontal';

  if (shape === 'separator') {
    const w = tiny.width ?? (orientation === 'vertical' ? 1 : 240);
    const h = tiny.height ?? (orientation === 'vertical' ? 120 : 1);
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'NONE';
    c.resize(w, h);
    bindColor(c, strokeVar ?? 'color/border/default', '#e5e7eb', 'fills');
    figma.currentPage.appendChild(c);
    return { component: c, slots: {}, propKeys: {} };
  }

  if (shape === 'skeleton') {
    const w = tiny.width ?? 200;
    const h = tiny.height ?? 16;
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'NONE';
    c.resize(w, h);
    bindColor(c, fillVar ?? 'color/background/variant', fallbackFill ?? '#f4f4f5', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(c, fn, 'radius/md', 6));
    figma.currentPage.appendChild(c);
    return { component: c, slots: {}, propKeys: {} };
  }

  if (shape === 'spinner') {
    const sz = tiny.size ?? 24;
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'NONE';
    c.resize(sz, sz);
    c.fills = [];
    bindColor(c, strokeVar ?? 'color/border/default', '#d4d4d8', 'strokes');
    c.strokeWeight = 2;
    c.cornerRadius = sz / 2;
    figma.currentPage.appendChild(c);
    return { component: c, slots: {}, propKeys: {} };
  }

  if (shape === 'progress') {
    const w = tiny.width ?? 280;
    const h = tiny.height ?? 8;
    const filled = Math.max(0, Math.min(1, tiny.filled ?? 0.4));
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'HORIZONTAL';
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    c.resize(w, h);
    c.primaryAxisAlignItems = 'MIN';
    c.counterAxisAlignItems = 'CENTER';
    bindColor(c, 'color/background/variant', '#f4f4f5', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(c, fn, 'radius/full', h / 2));
    const bar = figma.createFrame();
    bar.name = 'progress/bar';
    bar.resize(Math.max(1, Math.floor(w * filled)), h);
    bar.layoutPositioning = 'AUTO';
    bindColor(bar, fillVar ?? 'color/primary/default', fallbackFill ?? '#1a1a1a', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(bar, fn, 'radius/full', h / 2));
    c.appendChild(bar);
    figma.currentPage.appendChild(c);
    return { component: c, slots: { bar }, propKeys: {} };
  }

  if (shape === 'avatar') {
    const sz = tiny.size ?? 40;
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'HORIZONTAL';
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    c.resize(sz, sz);
    c.primaryAxisAlignItems = 'CENTER';
    c.counterAxisAlignItems = 'CENTER';
    c.clipsContent = true;
    bindColor(c, fillVar ?? 'color/background/variant', fallbackFill ?? '#e5e7eb', 'fills');
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(c, fn, 'radius/full', sz / 2));
    const initials = makeSampleText(tiny.initials ?? 'AB', null, 'color/background/content-muted', Math.round(sz * 0.4), 'Medium');
    initials.name = 'avatar/initials';
    c.appendChild(initials);
    figma.currentPage.appendChild(c);
    return { component: c, slots: { initials }, propKeys: {} };
  }

  if (shape === 'aspect-ratio' || shape === 'scroll-area') {
    const w = tiny.width ?? 320;
    const h = tiny.height ?? (shape === 'aspect-ratio' ? 180 : 200);
    const c = figma.createComponent();
    c.name = name;
    c.layoutMode = 'HORIZONTAL';
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    c.resize(w, h);
    c.primaryAxisAlignItems = 'CENTER';
    c.counterAxisAlignItems = 'CENTER';
    c.fills = [];
    bindColor(c, strokeVar ?? 'color/border/subtle', '#e5e7eb', 'strokes');
    c.strokeWeight = 1;
    c.dashPattern = [6, 4];
    ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
      .forEach(fn => bindNum(c, fn, 'radius/md', 6));
    const cap = makeSampleText(shape === 'aspect-ratio' ? 'Aspect ratio' : 'Scroll area', null, 'color/background/content-muted', 12);
    c.appendChild(cap);
    figma.currentPage.appendChild(c);
    return { component: c, slots: {}, propKeys: {} };
  }

  throw new Error(`buildTinyVariant: unknown CONFIG.tiny.shape '${shape}' for '${name}'. Expected one of: separator, skeleton, spinner, progress, avatar, aspect-ratio, scroll-area.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHETYPE: control
// ═══════════════════════════════════════════════════════════════════════════
// Shipped for: Checkbox, Radio Group item, Switch
// Reference: https://ui.shadcn.com/docs/components/radix/checkbox
//            https://ui.shadcn.com/docs/components/radix/radio-group
//            https://ui.shadcn.com/docs/components/radix/switch
//
//   Checkbox → h-4 w-4 rounded-sm border border-primary
//   Radio    → h-4 w-4 rounded-full border border-primary
//   Switch   → h-6 w-11 rounded-full border + inner thumb
//
// Control variants use cva-driven variant-property-level checked state
// (see CONVENTIONS §13.1 — checked IS a figma variant for controls).
