// --- 6.8  Usage notes — Do / Don't cards (conventions/04-doc-pipeline-contract.md §6) ------------
// Reads CONFIG.usageDo and CONFIG.usageDont.

function buildUsageNotes() {
  const row = makeFrame(`doc/component/${CONFIG.component}/usage`, {
    layoutMode: 'HORIZONTAL', primary: 'AUTO', counter: 'AUTO', width: 1640,
    itemSpacing: 30, align: 'STRETCH',
  });
  row.layoutSizingHorizontal = 'FIXED';
  row.layoutSizingVertical = 'HUG';
  function card(titleText, glyph, bullets) {
    const c = makeFrame(`usage/${titleText.toLowerCase().replace(/[^a-z]/g, '')}`, {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805,
      padL: 28, padR: 28, padT: 28, padB: 28, itemSpacing: 16,
      fillVar: 'color/background/variant', fillHex: '#f4f4f5', radius: 16,
    });
    c.appendChild(makeText(`${glyph}  ${titleText}`, 'tokenName', 18, 'color/background/content'));
    const list = makeFrame('bullets', {
      layoutMode: 'VERTICAL', primary: 'AUTO', counter: 'FIXED', width: 805 - 56,
      itemSpacing: 12, align: 'STRETCH',
    });
    c.appendChild(list);
    for (const b of bullets) {
      const bt = makeText(`·  ${b}`, 'caption', 13, 'color/background/content');
      bt.resize(805 - 56, 1); bt.textAutoResize = 'HEIGHT';
      list.appendChild(bt);
    }
    return c;
  }
  row.appendChild(card('Do',    '✓', CONFIG.usageDo));
  row.appendChild(card("Don't", '✕', CONFIG.usageDont));
  return row;
}

async function __ccDocAppendUsage() {
  await __ccDocInsertOrReplaceSection('usage', buildUsageNotes);
}

