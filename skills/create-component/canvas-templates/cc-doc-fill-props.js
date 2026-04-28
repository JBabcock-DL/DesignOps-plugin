// step3 — in-place property cells (single-call properties bundle)
function __ccDocFillPropertiesFromConfig() {
  const table = docRoot.findOne(
    n => n.type === 'FRAME' && n.name === `doc/table/${CONFIG.component}/properties`,
  );
  if (!table) {
    throw new Error('[cc] properties table missing');
  }
  const bodyRows = table.children.slice(1);
  const want = (CONFIG.properties && CONFIG.properties.length) || 0;
  if (bodyRows.length !== want) {
    throw new Error(`[cc] prop rows ${bodyRows.length}≠${want}`);
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
