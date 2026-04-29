// step3 — in-place property cells (single-call properties bundle)
function __ccDocFillPropertiesFromConfig() {
  const table = docRoot.findOne(
    n => n.type === 'FRAME' && n.name === `doc/table/${CONFIG.component}/properties`,
  );
  if (!table) {
    throw new Error('[cc] properties table missing');
  }
  const want = (CONFIG.properties && CONFIG.properties.length) || 0;
  let bodyRows = table.children.slice(1);
  const have = bodyRows.length;

  if (have !== want) {
    console.warn(`[cc] prop rows ${have}≠${want} — self-healing`);
    if (have < want) {
      const COLS = [240, 380, 160, 120, 740];
      for (let addIdx = have; addIdx < want; addIdx++) {
        const row = figma.createFrame();
        row.name = `row/placeholder-${addIdx}`;
        row.layoutMode = 'HORIZONTAL';
        row.primaryAxisSizingMode = 'FIXED';
        row.counterAxisSizingMode = 'AUTO';
        row.resize(1640, 64);
        row.counterAxisAlignItems = 'CENTER';
        row.paddingTop = 16;
        row.paddingBottom = 16;
        if (addIdx < want - 1) {
          row.strokeWeight = 1;
          row.strokeBottomWeight = 1;
          row.strokeTopWeight = row.strokeLeftWeight = row.strokeRightWeight = 0;
          bindColor(row, 'color/border/subtle', '#e4e4e7', 'strokes');
        }
        for (const w of COLS) {
          const cell = figma.createFrame();
          cell.name = 'cell';
          cell.layoutMode = 'VERTICAL';
          cell.primaryAxisSizingMode = 'AUTO';
          cell.counterAxisSizingMode = 'FIXED';
          cell.resize(w, 64);
          cell.paddingLeft = cell.paddingRight = 20;
          cell.paddingTop = cell.paddingBottom = 4;
          const t = figma.createText();
          t.characters = '—';
          t.resize(w - 40, 1);
          t.textAutoResize = 'HEIGHT';
          cell.appendChild(t);
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
    } else {
      const excess = table.children.slice(1 + want);
      for (const row of [...excess].reverse()) row.remove();
    }
    bodyRows = table.children.slice(1);
  }
  for (let i = 0; i < want; i++) {
    const r = CONFIG.properties[i];
    const row = bodyRows[i];
    for (let j = 0; j < 5; j++) {
      const cell = row.children[j];
      const t = cell && cell.findOne && cell.findOne(n => n.type === 'TEXT');
      if (t) t.characters = String(r[j]);
    }
  }
}
