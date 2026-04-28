
async function buildComponentSetSection() {
  const section = makeFrame(`doc/component/${CONFIG.component}/component-set-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: DOC_FRAME_WIDTH,
    itemSpacing: 12, align: 'STRETCH',
  });

  const stitle = makeText('Component', 'section', 24, 'color/background/content');
  stitle.resize(DOC_FRAME_WIDTH, 1); stitle.textAutoResize = 'HEIGHT';
  section.appendChild(stitle);

  const scap = makeText(
    'Live ComponentSet — this is the source of truth. Edit any variant here and every instance in the matrix below updates automatically.',
    'caption', 13, 'color/background/content-muted',
  );
  scap.resize(DOC_FRAME_WIDTH, 1); scap.textAutoResize = 'HEIGHT';
  section.appendChild(scap);

  const holder = variantBuildHolder;
  if (!holder || !holder.parent) {
    throw new Error('[create-component] §6.6B: variant holder missing — run the component MCP slice after variants are built');
  }
  const comps = holder.children.filter(n => n.type === 'COMPONENT');
  if (!comps.length) {
    throw new Error('[create-component] §6.6B: variant holder has no COMPONENT children');
  }
  compSet = figma.combineAsVariants(comps, section);
  compSet.name = `${CONFIG.title} — ComponentSet`;
  holder.remove();
  variantBuildHolder = null;

  variantByKey = {};
  for (const node of compSet.children) {
    const parts = node.name.split(', ').reduce((acc, kv) => {
      const [k, val] = kv.split('=');
      acc[k] = val;
      return acc;
    }, {});
    const key = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
    variantByKey[key] = node;
  }

  // Configure the ComponentSet itself as a horizontal-WRAP auto-layout
  // grid so every variant is visible at a glance and the group
  // re-flows as variants are added/removed.
  //
  // CRITICAL order (same gotcha as every other frame):
  //   1. layoutMode / layoutWrap
  //   2. resize(w, 1)                (silently resets sizing modes)
  //   3. primaryAxisSizingMode / counterAxisSizingMode   ← must be AFTER resize
  compSet.layoutMode  = 'HORIZONTAL';
  compSet.layoutWrap  = 'WRAP';
  compSet.resize(DOC_FRAME_WIDTH, 1);
  compSet.primaryAxisSizingMode = 'FIXED';        // fixed width triggers wrap
  compSet.counterAxisSizingMode = 'AUTO';          // grows vertically with rows
  compSet.paddingTop    = 32;
  compSet.paddingBottom = 32;
  compSet.paddingLeft   = 32;
  compSet.paddingRight  = 32;
  compSet.itemSpacing        = 24;                 // gap between variants in a row
  compSet.counterAxisSpacing = 24;                 // gap between wrapped rows
  compSet.primaryAxisAlignItems = 'MIN';
  compSet.counterAxisAlignItems = 'CENTER';
  compSet.layoutAlign = 'STRETCH';
  bindColor(compSet, 'color/background/variant', '#fafafa', 'fills');
  bindColor(compSet, 'color/border/subtle',      '#e5e7eb', 'strokes');
  compSet.strokeWeight = 1;
  compSet.dashPattern  = [6, 4];
  compSet.cornerRadius = 16;

  return section;
}

async function __ccDocAppendComponentSection() {
  await __ccDocInsertOrReplaceSection('component-set', buildComponentSetSection);
}

