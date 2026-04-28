// Emits JSON ops for cc-doc-scaffold* — mirrors draw-engine (split into 4 sub-slugs by default):
// buildScaffoldShellOps + buildScaffoldHeaderOps + buildScaffoldTableOps + buildScaffoldPlaceholdersOps
// buildScaffold1Ops = full legacy concat (tests / one-shot).

const DOC_FRAME_WIDTH = 1640;
const COLS = [
  { header: 'PROPERTY',    width: 240, style: 'tokenName' },
  { header: 'TYPE',        width: 380, style: 'code'      },
  { header: 'DEFAULT',     width: 160, style: 'code'      },
  { header: 'REQUIRED',    width: 120, style: 'code'      },
  { header: 'DESCRIPTION', width: 740, style: 'caption'   },
];

/**
 * _PageContent + docRoot only (first sub-slice; no handoff ids in varGlobals).
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldShellOps(config) {
  const comp = String(config.component || 'component');
  const ops = [];
  function frame(id, props) {
    ops.push([0, id, props]);
  }
  function text(id, styleKey, props) {
    ops.push([1, id, styleKey || null, props]);
  }
  function append(parent, child) {
    ops.push([2, parent, child]);
  }
  frame('pc', {
    name: '_PageContent',
    layoutMode: 'VERTICAL',
    width: 1800,
    height: 1,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    paddingTop: 80,
    paddingBottom: 80,
    paddingLeft: 80,
    paddingRight: 80,
    itemSpacing: 48,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
    x: 0,
    y: 320,
  });
  append('__page__', 'pc');
  frame('dr', {
    name: `doc/component/${comp}`,
    layoutMode: 'VERTICAL',
    width: DOC_FRAME_WIDTH,
    height: 1,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    layoutAlign: 'STRETCH',
    itemSpacing: 48,
    clearFill: true,
  });
  append('pc', 'dr');
  return ops;
}

/**
 * Header under docRoot (continuation; refs['dr'] pre-seeded from handoff in op-interpreter).
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldHeaderOps(config) {
  const comp = String(config.component || 'component');
  const title = String(config.title || '');
  const summary = String(config.summary || '');
  const ops = [];
  function frame(id, props) {
    ops.push([0, id, props]);
  }
  function text(id, styleKey, props) {
    ops.push([1, id, styleKey || null, props]);
  }
  function append(parent, child) {
    ops.push([2, parent, child]);
  }
  frame('header', {
    name: `doc/component/${comp}/header`,
    layoutMode: 'VERTICAL',
    width: DOC_FRAME_WIDTH,
    height: 1,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    layoutAlign: 'STRETCH',
    itemSpacing: 12,
    clearFill: true,
  });
  append('dr', 'header');
  text('tit', 'section', {
    name: `doc/component/${comp}/header/title`,
    characters: title,
    fontSize: 32,
    textAutoResize: 'HEIGHT',
    fillVar: 'color/background/content',
    fillHex: '#0a0a0a',
    resizeW: DOC_FRAME_WIDTH,
  });
  text('sum', 'caption', {
    name: `doc/component/${comp}/header/summary`,
    characters: summary,
    textAutoResize: 'HEIGHT',
    fillVar: 'color/background/content-muted',
    fillHex: '#6b7280',
    resizeW: DOC_FRAME_WIDTH - 0,
  });
  append('header', 'tit');
  append('header', 'sum');
  return ops;
}

/**
 * Properties group + table frame + header row (no body yet) — one MCP; smaller payload.
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldTableChromeOps(config) {
  const comp = String(config.component || 'component');
  const ops = [];
  function frame(id, props) {
    ops.push([0, id, props]);
  }
  function text(id, styleKey, props) {
    ops.push([1, id, styleKey || null, props]);
  }
  function append(parent, child) {
    ops.push([2, parent, child]);
  }
  frame('pgroup', {
    name: `doc/table-group/${comp}/properties`,
    layoutMode: 'VERTICAL',
    width: 1640,
    height: 1,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    itemSpacing: 12,
    layoutAlign: 'STRETCH',
  });
  append('dr', 'pgroup');
  text('gtitle', 'section', {
    name: `doc/table-group/${comp}/properties/title`,
    characters: 'Properties',
    textAutoResize: 'HEIGHT',
    fillVar: 'color/background/content',
    fillHex: '#0a0a0a',
    resizeW: 1640,
  });
  append('pgroup', 'gtitle');
  frame('table', {
    name: `doc/table/${comp}/properties`,
    layoutMode: 'VERTICAL',
    width: 1640,
    height: 1,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    layoutAlign: 'STRETCH',
    fillVar: 'color/background/default',
    fillHex: '#ffffff',
    strokeVar: 'color/border/subtle',
    strokeHex: '#e5e7eb',
    strokeWeight: 1,
    cornerRadius: 16,
    clipsContent: true,
  });
  append('pgroup', 'table');
  frame('hrow', {
    name: 'header',
    layoutMode: 'HORIZONTAL',
    width: 1640,
    height: 56,
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    counterAxisAlignItems: 'CENTER',
    fillVar: 'color/background/variant',
    fillHex: '#f4f4f5',
    strokeVar: 'color/border/subtle',
    strokeWeight: 1,
    strokeBottomWeight: 1,
  });
  append('table', 'hrow');
  for (let j = 0; j < COLS.length; j++) {
    const col = COLS[j];
    const cid = `hcell${j}`;
    frame(cid, {
      name: `header/${col.header.toLowerCase()}`,
      layoutMode: 'HORIZONTAL',
      width: col.width,
      height: 56,
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'FIXED',
      paddingLeft: 20,
      paddingRight: 20,
      counterAxisAlignItems: 'CENTER',
    });
    append('hrow', cid);
    const tid = `htxt${j}`;
    text(tid, 'code', {
      name: 'label',
      characters: col.header,
      textAutoResize: 'HEIGHT',
      fillVar: 'color/background/content-muted',
      fillHex: '#6b7280',
      resizeW: col.width - 40,
    });
    append(cid, tid);
  }
  return ops;
}

/**
 * N placeholder body rows (continuation; seeds `refs.table` from `__CC_HANDOFF_SCAFFOLD_TABLE_ID__` in op-interpreter).
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldTableBodyOps(config) {
  const n = (config.properties && config.properties.length) || 0;
  const placeholderRows = [];
  for (let i = 0; i < n; i++) {
    placeholderRows.push([`placeholder-${i}`, '…', '…', '…', '…']);
  }
  const ops = [];
  function frame(id, props) {
    ops.push([0, id, props]);
  }
  function text(id, styleKey, props) {
    ops.push([1, id, styleKey || null, props]);
  }
  function append(parent, child) {
    ops.push([2, parent, child]);
  }
  for (let i = 0; i < placeholderRows.length; i++) {
    const r = placeholderRows[i];
    const isLast = i === placeholderRows.length - 1;
    const rid = `brow${i}`;
    const rowProps = {
      name: `row/${r[0]}`,
      layoutMode: 'HORIZONTAL',
      width: 1640,
      height: 1,
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'AUTO',
      layoutAlign: 'STRETCH',
      paddingTop: 16,
      paddingBottom: 16,
      counterAxisAlignItems: 'CENTER',
      minHeight: 64,
    };
    if (!isLast) {
      rowProps.strokeVar = 'color/border/subtle';
      rowProps.strokeHex = '#e5e7eb';
      rowProps.strokeWeight = 1;
      rowProps.strokeBottomWeight = 1;
    } else {
      rowProps.clearStroke = true;
    }
    frame(rid, rowProps);
    append('table', rid);
    for (let j = 0; j < COLS.length; j++) {
      const col = COLS[j];
      const cid = `cell${i}_${j}`;
      frame(cid, {
        name: `cell/${col.header.toLowerCase()}`,
        layoutMode: 'VERTICAL',
        width: col.width,
        height: 1,
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 4,
        paddingBottom: 4,
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'MIN',
      });
      append(rid, cid);
      const fillVar = (j === 3 || j === 4) ? 'color/background/content-muted' : 'color/background/content';
      const tid = `btxt${i}_${j}`;
      text(tid, col.style, {
        name: 'value',
        characters: String(r[j]),
        textAutoResize: 'HEIGHT',
        fillVar,
        fillHex: '#0a0a0a',
        resizeW: col.width - 40,
        fontSize: 13,
      });
      append(cid, tid);
    }
  }
  return ops;
}

/**
 * Properties group + table + header row + body placeholder rows (one op list; tests / one-shot / legacy).
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldTableOps(config) {
  return [...buildScaffoldTableChromeOps(config), ...buildScaffoldTableBodyOps(config)];
}

/**
 * Dashed placeholder frames for later doc steps.
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffoldPlaceholdersOps(config) {
  const comp = String(config.component || 'component');
  const ops = [];
  function frame(id, props) {
    ops.push([0, id, props]);
  }
  function text(id, styleKey, props) {
    ops.push([1, id, styleKey || null, props]);
  }
  function append(parent, child) {
    ops.push([2, parent, child]);
  }
  function scaffoldPh(slug, caption, minH) {
    const id = `ph_${slug.replace(/[^a-z0-9]+/g, '_')}`;
    frame(id, {
      name: `doc/scaffold-placeholder/${comp}/${slug}`,
      layoutMode: 'VERTICAL',
      width: DOC_FRAME_WIDTH,
      height: 1,
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      minHeight: minH,
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 20,
      paddingBottom: 20,
      itemSpacing: 8,
      layoutAlign: 'STRETCH',
      strokeVar: 'color/border/subtle',
      strokeWeight: 1,
      dashPattern: [6, 4],
      cornerRadius: 12,
    });
    text(`${id}_t`, 'caption', {
      characters: caption,
      textAutoResize: 'HEIGHT',
      fillVar: 'color/background/content-muted',
      fillHex: '#6b7280',
      resizeW: DOC_FRAME_WIDTH - 48,
      fontSize: 13,
    });
    append('dr', id);
    append(id, `${id}_t`);
  }
  scaffoldPh('component-set', "Scaffold — Component (filled when cc-doc-component runs, doc step 2)", 140);
  scaffoldPh('matrix', 'Scaffold — Variants × States matrix (slice 4)', 220);
  scaffoldPh('usage', "Scaffold — Do / Don't usage (slice 5)", 180);
  return ops;
}

/**
 * Full single-call op list (concat of all four; same end state as the four sub-slugs in order).
 * @param {object} config
 * @returns {object[]}
 */
export function buildScaffold1Ops(config) {
  return [
    ...buildScaffoldShellOps(config),
    ...buildScaffoldHeaderOps(config),
    ...buildScaffoldTableOps(config),
    ...buildScaffoldPlaceholdersOps(config),
  ];
}
