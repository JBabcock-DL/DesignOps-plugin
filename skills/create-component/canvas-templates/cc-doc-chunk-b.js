// --- 6.5  makeFrame helper + hexToRgb -----------------------------------
// Centralized frame factory — every doc frame uses this. Prevents the
// common 10px-collapse bug by forcing AUTO height on VERTICAL AUTO frames.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function makeFrame(name, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.layoutMode ?? 'VERTICAL';
  // CRITICAL: resize() resets sizing modes to FIXED — call it BEFORE
  // setting primary/counter sizing modes, or AUTO will silently reset.
  if (o.width != null) f.resize(o.width, o.height ?? 1);
  f.primaryAxisSizingMode = o.primary ?? 'AUTO';
  f.counterAxisSizingMode = o.counter ?? 'FIXED';
  f.paddingTop    = o.padT ?? 0;
  f.paddingRight  = o.padR ?? 0;
  f.paddingBottom = o.padB ?? 0;
  f.paddingLeft   = o.padL ?? 0;
  f.itemSpacing   = o.itemSpacing ?? 0;
  if (o.align)        f.layoutAlign           = o.align;
  if (o.primaryAlign) f.primaryAxisAlignItems = o.primaryAlign;
  if (o.counterAlign) f.counterAxisAlignItems = o.counterAlign;
  if (o.fillVar)      bindColor(f, o.fillVar, o.fillHex ?? '#ffffff', 'fills');
  else if (o.fillHex) f.fills = [{ type: 'SOLID', color: hexToRgb(o.fillHex) }];
  else                f.fills = [];
  if (o.strokeVar) {
    bindColor(f, o.strokeVar, '#e5e7eb', 'strokes');
    f.strokeWeight = o.strokeWeight ?? 1;
    if (o.dashed)      f.dashPattern = [6, 4];
    if (o.strokeSides) {
      f.strokeTopWeight    = o.strokeSides.top    ?? 0;
      f.strokeRightWeight  = o.strokeSides.right  ?? 0;
      f.strokeBottomWeight = o.strokeSides.bottom ?? 0;
      f.strokeLeftWeight   = o.strokeSides.left   ?? 0;
    }
  } else {
    f.strokes = [];
  }
  if (o.radius != null) f.cornerRadius = o.radius;
  if (o.minHeight != null) f.minHeight = o.minHeight;
  return f;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 DOC PIPELINE CONTRACT — §§6.6 – 6.8 ARE ARCHETYPE-AGNOSTIC
// ═══════════════════════════════════════════════════════════════════════════
// The next three functions — `buildPropertiesTable`, `buildMatrix`, and
// `buildUsageNotes` — render the STANDARD doc frame that wraps EVERY
// component in this design system, regardless of its `CONFIG.layout`
// archetype (`chip`, `surface-stack`, `field`, `row-item`, `tiny`,
// `container`, `control`). They rely on only two inputs from §§6.2–6.2a:
//
//   (1) `compSet`          — the Figma ComponentSet produced by
//                            `figma.combineAsVariants(...)`
//   (2) `variantByKey[key]` — a lookup map of variant masters keyed by
//                            `${variant}` or `${variant}|${size}`.
//
// That is the ENTIRE interface. The doc pipeline does NOT care whether a
// variant is a button, a card, an input, or a dropdown-menu-item. It does
// NOT peek at children. It does NOT read archetype-specific config.
//
//   🚫 DO NOT FORK THIS PIPELINE PER ARCHETYPE.
//   🚫 DO NOT INLINE A "SIMPLER" TABLE RENDERER IN A BUILDER.
//   🚫 DO NOT RENAME THE COLUMN HEADERS (they are uppercase, by design —
//      `PROPERTY`, `TYPE`, `DEFAULT`, `REQUIRED`, `DESCRIPTION`).
//   🚫 DO NOT INSERT A "Size variants" OR "ComponentSet" SECTION OF YOUR
//      OWN — §6.6B draws the single canonical ComponentSet tile, and §6.7
//      draws the matrix that implicitly covers every size.
//   🚫 DO NOT SHRINK THE TABLE BELOW 1640px — it always spans the full
//      DOC_FRAME_WIDTH so column proportions stay consistent file-wide.
//
// The Button page (see the v60 Foundations file, node 388:95) is the
// canonical reference output. If an archetype renders differently from
// Button's doc frame in structure (title → summary → Properties table →
// ComponentSet → Variants × States → Do / Don't), the pipeline was forked
// and must be restored to these three helpers.
// ═══════════════════════════════════════════════════════════════════════════

// --- 6.6  Properties + Types table (conventions/04-doc-pipeline-contract.md §4) ------------------
// Cols sum to 1640: PROPERTY 240 · TYPE 380 · DEFAULT 160 · REQUIRED 120 · DESCRIPTION 740

function buildPropertiesTable(rows) {
  const COLS = [
    { header: 'PROPERTY',    width: 240, style: 'tokenName' },
    { header: 'TYPE',        width: 380, style: 'code'      },
    { header: 'DEFAULT',     width: 160, style: 'code'      },
    { header: 'REQUIRED',    width: 120, style: 'code'      },
    { header: 'DESCRIPTION', width: 740, style: 'caption'   },
  ];

  const group = makeFrame(`doc/table-group/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Properties', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const table = makeFrame(`doc/table/${CONFIG.component}/properties`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillVar: 'color/background/default', fillHex: '#ffffff',
    strokeVar: 'color/border/subtle',    strokeWeight: 1, radius: 16,
  });
  table.clipsContent = true;
  group.appendChild(table);

  // Header row
  const headerRow = makeFrame('header', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 56, counterAlign: 'CENTER',
    fillVar: 'color/background/variant', fillHex: '#f4f4f5',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  table.appendChild(headerRow);
  for (const col of COLS) {
    const cell = makeFrame(`header/${col.header.toLowerCase()}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: col.width, height: 56, padL: 20, padR: 20, counterAlign: 'CENTER',
    });
    headerRow.appendChild(cell);
    const t = makeText(col.header, 'code', 12, 'color/background/content-muted');
    t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
    cell.appendChild(t);
  }

  // Body rows
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isLast = i === rows.length - 1;
    const row = makeFrame(`row/${r[0]}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
      width: 1640, align: 'STRETCH', padT: 16, padB: 16,
      counterAlign: 'CENTER',
      strokeVar: isLast ? null : 'color/border/subtle',
      strokeWeight: isLast ? 0 : 1,
      strokeSides: isLast ? undefined : { bottom: 1 },
    });
    row.minHeight = 64;
    table.appendChild(row);

    for (let j = 0; j < COLS.length; j++) {
      const col = COLS[j];
      const cell = makeFrame(`cell/${col.header.toLowerCase()}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: col.width, padL: 20, padR: 20, padT: 4, padB: 4,
        primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(cell);
      const fillVar = (j === 3 || j === 4) ? 'color/background/content-muted' : 'color/background/content';
      const t = makeText(r[j], col.style, 13, fillVar);
      t.resize(col.width - 40, 1); t.textAutoResize = 'HEIGHT';
      cell.appendChild(t);
    }
  }
  return group;
}

// Placeholder body for multistep step 1 — same row count and geometry as production (§2.2.1 Path B in 04).
function __ccPlaceholderPropertyRows() {
  const n = (CONFIG.properties && CONFIG.properties.length) || 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push([`placeholder-${i}`, '…', '…', '…', '…']);
  }
  return rows;
}

// Multistep doc step 1 only — visible dashed frames reserve vertical space for
// §6.6B / §6.7 / §6.8 until slices 3–5 replace them in place (same child index).
// Without these, designers only see header + Properties while later slices are
// pending; ComponentSet can also sit orphaned on the page if a run aborts early.
function __ccScaffoldPlaceholderFrame(slug, caption) {
  const f = makeFrame(`doc/scaffold-placeholder/${CONFIG.component}/${slug}`, {
    layoutMode: 'VERTICAL',
    primary: 'AUTO',
    counter: 'FIXED',
    width: DOC_FRAME_WIDTH,
    minHeight: slug === 'component-set' ? 140 : slug === 'matrix' ? 220 : 180,
    padL: 24,
    padR: 24,
    padT: 20,
    padB: 20,
    itemSpacing: 8,
    align: 'STRETCH',
    strokeVar: 'color/border/subtle',
    strokeWeight: 1,
    dashed: true,
    radius: 12,
  });
  const t = makeText(caption, 'caption', 13, 'color/background/content-muted');
  t.resize(DOC_FRAME_WIDTH - 48, 1);
  t.textAutoResize = 'HEIGHT';
  f.appendChild(t);
  return f;
}

function __ccDocAppendScaffoldPlaceholders() {
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'component-set',
    'Scaffold — Component (filled when cc-doc-component runs, doc step 2)',
  ));
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'matrix',
    'Scaffold — Variants × States matrix (slice 4)',
  ));
  docRoot.appendChild(__ccScaffoldPlaceholderFrame(
    'usage',
    'Scaffold — Do / Don\u2019t usage (slice 5)',
  ));
}
