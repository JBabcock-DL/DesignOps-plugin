function buildMatrix() {
  const variants       = CONFIG.variants;
  const sizes          = CONFIG.sizes ?? [];
  const states         = CONFIG.states;
  const hasSizeAxis    = sizes.length > 0;
  const gutterSizeW    = hasSizeAxis ? GUTTER_W_SIZE : 0;
  const gutterVariantW = GUTTER_W_VARIANT;
  const gutter         = gutterSizeW + gutterVariantW;
  const cellW          = Math.floor((DOC_FRAME_WIDTH - gutter) / states.length);
  const defaultStates  = states.filter(s => s.group === 'default');
  const disabledStates = states.filter(s => s.group === 'disabled');

  const group = makeFrame(`doc/component/${CONFIG.component}/matrix-group`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    itemSpacing: 12, align: 'STRETCH',
  });
  const gtitle = makeText('Variants × States', 'section', 24, 'color/background/content');
  gtitle.resize(1640, 1); gtitle.textAutoResize = 'HEIGHT';
  group.appendChild(gtitle);

  const matrix = makeFrame(`doc/component/${CONFIG.component}/matrix`, {
    layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 1640,
    align: 'STRETCH',
    fillHex: '#ffffff',
    strokeVar: 'color/border/subtle', strokeWeight: 1, dashed: true, radius: 16,
  });
  group.appendChild(matrix);

  // Header-groups row (DEFAULT | DISABLED)
  if (disabledStates.length > 0) {
    const hg = makeFrame('matrix/header-groups', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: 1640, height: 44, counterAlign: 'CENTER',
      strokeVar: 'color/border/subtle', strokeWeight: 1,
      strokeSides: { bottom: 1 },
    });
    matrix.appendChild(hg);
    hg.appendChild(makeFrame('gutter', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: gutter, height: 44,
    }));
    const dc = makeFrame('cell/default-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * defaultStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(dc);
    dc.appendChild(makeText('DEFAULT', 'code', 12, 'color/background/content-muted'));
    const uc = makeFrame('cell/disabled-group', {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW * disabledStates.length, height: 44,
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hg.appendChild(uc);
    uc.appendChild(makeText('DISABLED', 'code', 12, 'color/background/content-muted'));
  }

  // State-labels row
  const hs = makeFrame('matrix/header-states', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: 1640, height: 40, counterAlign: 'CENTER',
    strokeVar: 'color/border/subtle', strokeWeight: 1,
    strokeSides: { bottom: 1 },
  });
  matrix.appendChild(hs);
  hs.appendChild(makeFrame('gutter', {
    layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
    width: gutter, height: 40,
  }));
  for (const st of states) {
    const cell = makeFrame(`cell/${st.key}`, {
      layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'FIXED',
      width: cellW, height: 40, primaryAlign: 'CENTER', counterAlign: 'CENTER',
    });
    hs.appendChild(cell);
    cell.appendChild(makeText(st.key, 'caption', 12, 'color/background/content-muted'));
  }

  // Size groups
  const groupList = hasSizeAxis ? sizes : [null];
  for (let si = 0; si < groupList.length; si++) {
    const size = groupList[si];
    const sg = makeFrame(`matrix/size-group/${size ?? 'single'}`, {
      layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    matrix.appendChild(sg);

    if (hasSizeAxis) {
      const sLabel = makeFrame(`size-label/${size}`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: gutterSizeW, primaryAlign: 'CENTER', counterAlign: 'CENTER',
        strokeVar: 'color/border/subtle', strokeWeight: 1,
        strokeSides: { right: 1 },
      });
      sg.appendChild(sLabel);
      sLabel.appendChild(makeText(size, 'tokenName', 14, 'color/background/content'));
    }

    const rowsStack = makeFrame('variant-rows', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
    });
    sg.appendChild(rowsStack);

    for (let vi = 0; vi < variants.length; vi++) {
      const variant = variants[vi];
      const isLastVariantRow = (si === groupList.length - 1) && (vi === variants.length - 1);
      const row = makeFrame(`row/${variant}`, {
        layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', align: 'STRETCH',
        counterAlign: 'CENTER',
        strokeVar: isLastVariantRow ? null : 'color/border/subtle',
        strokeWeight: isLastVariantRow ? 0 : 1,
        strokeSides: isLastVariantRow ? undefined : { bottom: 1 },
      });
      row.minHeight = 72;
      rowsStack.appendChild(row);

      const vLabel = makeFrame(`row/${variant}/label`, {
        layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED',
        width: gutterVariantW, minHeight: 72,
        padL: 20, padR: 20, primaryAlign: 'CENTER', counterAlign: 'MIN',
      });
      row.appendChild(vLabel);
      vLabel.layoutAlign = 'STRETCH';
      const prettyVariant = variant.charAt(0).toUpperCase() + variant.slice(1);
      vLabel.appendChild(makeText(prettyVariant, 'caption', 13, 'color/background/content-muted'));

      for (const st of states) {
        const cell = makeFrame(`cell/${variant}/${st.key}`, {
          layoutMode: 'HORIZONTAL', primary: 'FIXED', counter: 'AUTO',
          width: cellW, minHeight: 72,
          padL: 16, padR: 16, padT: 16, padB: 16,
          primaryAlign: 'CENTER', counterAlign: 'CENTER',
        });
        row.appendChild(cell);
        const key = hasSizeAxis ? `${variant}|${size}` : variant;
        const componentNode = variantByKey[key];
        if (componentNode) {
          const instance = componentNode.createInstance();
          if (typeof CONFIG.applyStateOverride === 'function') {
            CONFIG.applyStateOverride(instance, st.key, { variant, size, componentNode });
          }
          cell.appendChild(instance);
        }
      }
    }
  }
  return group;
}
