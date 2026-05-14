// canvas-templates/token-overview.js — Step 17 ↳ Token Overview
// Updates scaffold from /new-project 05d: Doc/* upgrades, platform-mapping codeSyntax,
// §0.9 platform-mapping shadow hygiene, section shadows, arch bindings, placeholders, TBD.
// Call shape: [_lib.js] + [this source] + runner fragment (phase 08 / sync 9d).

// Minimum row set — keep in sync with data/platform-mapping-rows.json "rows"
// defaultHex: fallback display value used in all three platform cells when the variable
// path cannot be resolved from the live variableMap (path naming mismatch).
const STEP17_MIN_PLATFORM_ROWS = [
  { tokenPath: 'color/background/default',       collection: 'Theme',      defaultHex: '#FBFBFB' },
  { tokenPath: 'color/background/content',       collection: 'Theme',      defaultHex: '#FFFFFF' },
  { tokenPath: 'color/background/content-muted', collection: 'Theme',      defaultHex: '#F4F4F5' },
  { tokenPath: 'color/background/variant',       collection: 'Theme',      defaultHex: '#F9F9FA' },
  { tokenPath: 'color/border/default',           collection: 'Theme',      defaultHex: '#E4E4E7' },
  { tokenPath: 'color/border/subtle',            collection: 'Theme',      defaultHex: '#F4F4F5' },
  { tokenPath: 'color/primary/default',          collection: 'Theme',      defaultHex: '#2563EB' },
  { tokenPath: 'color/primary/content',          collection: 'Theme',      defaultHex: '#FFFFFF' },
  { tokenPath: 'color/primary/subtle',           collection: 'Theme',      defaultHex: '#DBEAFE' },
  { tokenPath: 'color/secondary/default',        collection: 'Theme',      defaultHex: '#6B7280' },
  { tokenPath: 'color/tertiary/default',         collection: 'Theme',      defaultHex: '#8B5CF6' },
  { tokenPath: 'color/error/default',            collection: 'Theme',      defaultHex: '#EF4444' },
  { tokenPath: 'color/component/ring',           collection: 'Theme',      defaultHex: '#2563EB' },
  { tokenPath: 'Headline/LG/font-size',          collection: 'Typography', defaultHex: '32px' },
  { tokenPath: 'Title/LG/font-size',             collection: 'Typography', defaultHex: '22px' },
  { tokenPath: 'Body/MD/font-size',              collection: 'Typography', defaultHex: '14px' },
  { tokenPath: 'typeface/display',               collection: 'Primitives', defaultHex: 'Inter' },
  { tokenPath: 'space/md',                       collection: 'Layout',     defaultHex: '16px' },
  { tokenPath: 'space/lg',                       collection: 'Layout',     defaultHex: '24px' },
  { tokenPath: 'radius/md',                      collection: 'Layout',     defaultHex: '8px' },
  { tokenPath: 'radius/lg',                      collection: 'Layout',     defaultHex: '12px' },
  { tokenPath: 'shadow/color',                   collection: 'Effects',    defaultHex: 'rgba(0,0,0,0.15)' },
];

const ARCH_BIND = [
  { name: 'Primitives', path: 'color/primary/default' },
  { name: 'Theme', path: 'color/secondary/default' },
  { name: 'Typography', path: 'color/neutral/800' },
  { name: 'Layout', path: 'color/neutral/800' },
  { name: 'Effects', path: 'color/neutral/800' },
];

function readCS(v) {
  const cs = v.codeSyntax || {};
  return {
    WEB: String(cs.WEB || ''),
    ANDROID: String(cs.ANDROID || ''),
    iOS: String(cs.iOS || cs.IOS || ''),
  };
}

function colorToHex(val) {
  if (!val || typeof val !== 'object' || typeof val.r !== 'number') return '#000000';
  const r = Math.round(val.r * 255);
  const g = Math.round(val.g * 255);
  const b = Math.round(val.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveRawValue(variableId, modeId) {
  let v = await figma.variables.getVariableByIdAsync(variableId);
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[modeId];
    if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      v = await figma.variables.getVariableByIdAsync(val.id);
      continue;
    }
    return val;
  }
  return null;
}

function isUnderPlatformMappingTable(node, pmTableId) {
  let p = node.parent;
  while (p && 'id' in p) {
    if (pmTableId && p.id === pmTableId) return true;
    if (p.name === 'doc/table/token-overview/platform-mapping') return true;
    p = p.parent;
  }
  return false;
}

function walkNodes(node, fn) {
  fn(node);
  if ('children' in node) for (const c of node.children) walkNodes(c, fn);
}

async function build(ctx) {
  await ensureLocalVariableMapOnCtx(ctx);
  await ensureCanonicalMapOnCtx(ctx);
  await loadFonts(['Inter', 'Roboto Mono', 'SF Mono']);

  const pageNode = await figma.getNodeByIdAsync(ctx.pageId);
  if (!pageNode || pageNode.type !== 'PAGE') throw new Error('Step 17: invalid pageId');
  await figma.setCurrentPageAsync(pageNode);
  const page = figma.currentPage;
  const { variableMap } = ctx;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const primColl = collections.find((c) => c.name === 'Primitives')
    || collections.find((c) => /^(primitiv|core|foundation|base)/i.test(c.name));
  const primModeId = primColl ? primColl.modes[0]?.modeId : null;

  const pmTable = page.findOne((n) => n.name === 'doc/table/token-overview/platform-mapping');
  const pmTableId = pmTable ? pmTable.id : null;

  // §0.9 — strip effects from platform-mapping table subtree
  if (pmTable) {
    walkNodes(pmTable, (n) => {
      if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') {
        try {
          n.effectStyleId = '';
          n.effects = [];
        } catch (_) {}
      }
    });
  }

  const textStyles = await figma.getLocalTextStylesAsync();
  // Doc/* style resolution — exact name first, then fuzzy fallback
  const sid = (name, fuzzyRe) => {
    const exact = textStyles.find((s) => s.name === name);
    if (exact) return exact.id;
    if (fuzzyRe) { const f = textStyles.find((s) => fuzzyRe.test(s.name)); if (f) return f.id; }
    return '';
  };
  const docSection   = sid('Doc/Section',   /^doc.*section/i);
  const docTokenName = sid('Doc/TokenName', /^doc.*(token|heading)/i);
  const docCode      = sid('Doc/Code',      /^doc.*(code|mono)/i);
  const docCaption   = sid('Doc/Caption',   /^doc.*(caption|label|body)/i);

  const pageContent = page.findOne((n) => n.name === '_PageContent');
  let textUpgraded = 0;
  if (pageContent) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'TEXT') return;
      if (isUnderPlatformMappingTable(n, pmTableId)) return;
      try {
        const fs = n.fontSize;
        const st = n.fontName && n.fontName.style;
        let pick = docCode;
        if (fs >= 19) pick = docSection;
        else if (fs >= 15 && st && String(st).includes('Semi')) pick = docTokenName;
        else if (fs >= 13) pick = docCode;
        else pick = docCaption;
        if (pick) {
          n.textStyleId = pick;
          textUpgraded++;
        }
      } catch (_) {}
    });
    // Platform-mapping body: assign Doc/* by cell key
    if (pmTable) {
      walkNodes(pmTable, (n) => {
        if (n.type !== 'TEXT') return;
        const path = n.parent && n.parent.name ? n.parent.name : '';
        if (path.includes('/cell/token')) {
          try {
            if (docTokenName) n.textStyleId = docTokenName;
          } catch (_) {}
        } else if (path.includes('/cell/web') || path.includes('/cell/android') || path.includes('/cell/ios')) {
          try {
            if (docCode) n.textStyleId = docCode;
          } catch (_) {}
        }
      });
    }
  }

  const effectStyles = await figma.getLocalEffectStylesAsync();
  const shadowSm = effectStyles.find((e) => e.name === 'Effect/shadow-sm')
    || effectStyles.find((e) => /shadow.*sm/i.test(e.name));
  const shadowSmId = shadowSm ? shadowSm.id : '';
  let shadowFrames = 0;
  if (pageContent && shadowSmId) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'FRAME') return;
      const nm = n.name || '';
      if (isUnderPlatformMappingTable(n, pmTableId)) return;
      if (
        nm.startsWith('token-overview/') ||
        nm === 'dark-mode-panel' ||
        nm === 'font-scale-panel'
      ) {
        try {
          if (!n.effectStyleId) {
            n.effectStyleId = shadowSmId;
            shadowFrames++;
          }
        } catch (_) {}
      }
    });
  }

  // Architecture boxes — ensure variable-bound fills
  for (const spec of ARCH_BIND) {
    const box = page.findOne((n) => n.name === 'arch-box/' + spec.name);
    if (!box || box.type !== 'FRAME') continue;
    const _archActualPath = resolveCanonicalPath(spec.path, variableMap, ctx.canonicalMap) || spec.path;
    const vid = variableMap[_archActualPath];
    if (!vid) continue;
    const v = await figma.variables.getVariableByIdAsync(vid);
    if (!v) continue;
    try {
      bindPaintToVar(box, v);
    } catch (_) {}
  }

  // Dark Mode phone frames (05d names) — rebind fills per Step 17 appendix
  const phoneLight = page.findOne((n) => n.name === 'phone-frame/light');
  const _phoneLightPath = resolveCanonicalPath('color/background/default', variableMap, ctx.canonicalMap);
  if (phoneLight && _phoneLightPath) {
    const v = await figma.variables.getVariableByIdAsync(variableMap[_phoneLightPath]);
    if (v) try { bindPaintToVar(phoneLight, v); } catch (_) {}
  }
  const phoneDark = page.findOne((n) => n.name === 'phone-frame/dark');
  const _phoneDarkPath = resolveCanonicalPath('color/neutral/950', variableMap, ctx.canonicalMap);
  if (phoneDark && _phoneDarkPath) {
    const v = await figma.variables.getVariableByIdAsync(variableMap[_phoneDarkPath]);
    if (v) try { bindPaintToVar(phoneDark, v); } catch (_) {}
  }

  // Platform mapping — sync codeSyntax cells + stale rows
  const rowPrefix = 'doc/table/token-overview/platform-mapping/row/';
  let cellsUpdated = 0;
  let staleRows = 0;
  if (pmTable) {
    const rowFrames = pmTable.findAll(
      (n) => n.type === 'FRAME' && n.name.startsWith(rowPrefix) && !n.name.includes('/cell/'),
    );
    for (const row of rowFrames) {
      const tokenPath = row.name.slice(rowPrefix.length);
      const _actualPath = resolveCanonicalPath(tokenPath, variableMap, ctx.canonicalMap);
      const vid = _actualPath ? variableMap[_actualPath] : null;
      if (!vid) {
        // Fall back to defaultHex from STEP17_MIN_PLATFORM_ROWS when the variable path
        // doesn't match the live variableMap (e.g. custom naming conventions).
        const minRow = STEP17_MIN_PLATFORM_ROWS.find((r) => r.tokenPath === tokenPath);
        if (minRow && minRow.defaultHex) {
          for (const key of ['web', 'android', 'ios']) {
            const cell = row.findOne((c) => c.name === row.name + '/cell/' + key);
            if (!cell) continue;
            for (const t of cell.children || []) {
              if (t.type === 'TEXT' && String(t.characters) !== minRow.defaultHex) {
                try { t.characters = minRow.defaultHex; cellsUpdated++; } catch (_) {}
              }
            }
          }
        } else {
          const tokCell = row.findOne((c) => c.type === 'FRAME' && c.name.endsWith('/cell/token'));
          if (tokCell) {
            for (const t of tokCell.children || []) {
              if (t.type === 'TEXT' && !String(t.characters).includes('stale')) {
                try { t.characters = String(t.characters) + ' · stale'; staleRows++; } catch (_) {}
              }
            }
          }
        }
        continue;
      }
      const variable = await figma.variables.getVariableByIdAsync(vid);
      if (!variable) continue;
      const cs = readCS(variable);
      for (const [key, val] of [
        ['web', cs.WEB],
        ['android', cs.ANDROID],
        ['ios', cs.iOS],
      ]) {
        const cell = row.findOne((c) => c.name === row.name + '/cell/' + key);
        if (!cell) continue;
        for (const t of cell.children || []) {
          if (t.type === 'TEXT' && String(t.characters) !== (val || '—')) {
            try {
              t.characters = val || '—';
              cellsUpdated++;
            } catch (_) {}
          }
        }
      }
    }
  }

  // Delete placeholder/*
  let placeholdersRemoved = 0;
  if (pageContent) {
    const toRemove = [];
    walkNodes(pageContent, (n) => {
      if (n.name && n.name.startsWith('placeholder/')) toRemove.push(n);
    });
    for (const n of toRemove) {
      try {
        n.remove();
        placeholdersRemoved++;
      } catch (_) {}
    }
  }

  // Replace TBD in text; default hex from color/primary/500 (with alias fallback)
  let tbdFixed = 0;
  let fallbackHex = '#2563eb';
  const _p500Path = resolveCanonicalPath('color/primary/500', variableMap, ctx.canonicalMap);
  const p500 = _p500Path ? variableMap[_p500Path] : null;
  if (p500 && primModeId) {
    const v500 = await figma.variables.getVariableByIdAsync(p500);
    if (v500) {
      const raw = await resolveRawValue(v500.id, primModeId);
      fallbackHex = colorToHex(raw);
    }
  }
  if (pageContent) {
    walkNodes(pageContent, (n) => {
      if (n.type !== 'TEXT') return;
      if (String(n.characters).includes('TBD')) {
        try {
          n.characters = String(n.characters).replace(/TBD/g, fallbackHex);
          tbdFixed++;
        } catch (_) {}
      }
    });
  }

  // Log minimum row coverage — a path is "covered" if it resolves via exact or alias map
  const missingMinRows = [];
  for (const spec of STEP17_MIN_PLATFORM_ROWS) {
    if (!resolveCanonicalPath(spec.tokenPath, variableMap, ctx.canonicalMap)) missingMinRows.push(spec.tokenPath);
  }

  return {
    step: '17-token-overview',
    textStyleUpgrades: textUpgraded,
    shadowFramesApplied: shadowFrames,
    platformCellsUpdated: cellsUpdated,
    staleRowsMarked: staleRows,
    placeholdersRemoved,
    tbdReplacements: tbdFixed,
    missingVariablePaths: missingMinRows,
  };
}
