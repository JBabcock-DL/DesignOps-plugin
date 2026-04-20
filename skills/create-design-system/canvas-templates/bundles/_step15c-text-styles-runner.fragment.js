// Concatenate after _lib.js + text-styles.js (phase 07). Builds the 27-row typography table in-plugin.
const TYPO_DATA = {
  baseSlots: [
    { slot: 'Display/LG',  fontSize: 57, fontWeight: 400, lineHeight: 64, category: 'Display',  size: 'LG' },
    { slot: 'Display/MD',  fontSize: 45, fontWeight: 400, lineHeight: 52, category: 'Display',  size: 'MD' },
    { slot: 'Display/SM',  fontSize: 36, fontWeight: 400, lineHeight: 44, category: 'Display',  size: 'SM' },
    { slot: 'Headline/LG', fontSize: 32, fontWeight: 400, lineHeight: 40, category: 'Headline', size: 'LG' },
    { slot: 'Headline/MD', fontSize: 28, fontWeight: 400, lineHeight: 36, category: 'Headline', size: 'MD' },
    { slot: 'Headline/SM', fontSize: 24, fontWeight: 400, lineHeight: 32, category: 'Headline', size: 'SM' },
    { slot: 'Title/LG',    fontSize: 22, fontWeight: 400, lineHeight: 28, category: 'Title',    size: 'LG' },
    { slot: 'Title/MD',    fontSize: 16, fontWeight: 500, lineHeight: 24, category: 'Title',    size: 'MD' },
    { slot: 'Title/SM',    fontSize: 14, fontWeight: 500, lineHeight: 20, category: 'Title',    size: 'SM' },
    { slot: 'Body/LG',     fontSize: 16, fontWeight: 400, lineHeight: 24, category: 'Body',     size: 'LG' },
    { slot: 'Body/MD',     fontSize: 14, fontWeight: 400, lineHeight: 20, category: 'Body',     size: 'MD' },
    { slot: 'Body/SM',     fontSize: 12, fontWeight: 400, lineHeight: 16, category: 'Body',     size: 'SM' },
    { slot: 'Label/LG',    fontSize: 14, fontWeight: 500, lineHeight: 20, category: 'Label',    size: 'LG' },
    { slot: 'Label/MD',    fontSize: 12, fontWeight: 500, lineHeight: 16, category: 'Label',    size: 'MD' },
    { slot: 'Label/SM',    fontSize: 11, fontWeight: 500, lineHeight: 16, category: 'Label',    size: 'SM' },
  ],
  bodyVariants: ['regular', 'emphasis', 'italic', 'link', 'strikethrough'],
  bodySizes: ['LG', 'MD', 'SM'],
  fontFamilyFor: { Display: 'Display', Headline: 'Display', Title: 'Display', Body: 'Body', Label: 'Body' },
  specimens: {
    Display: 'Dream design systems',
    Headline: 'Ship it with confidence',
    Title: 'Tokens keep us honest',
    Body: 'The quick brown fox jumps over the lazy dog.',
    Label: 'STATUS — ACTIVE',
  },
};

function cs(stylePath, prop) {
  const lower = stylePath.toLowerCase();
  const kebab = lower.replace(/\//g, '-') + '-' + prop;
  const parts = lower.split('/');
  return {
    WEB: 'var(--' + kebab + ')',
    ANDROID: kebab,
    iOS: '.Typography.' + parts.join('.') + '.' + prop.replace(/-/g, '.'),
  };
}

const textStyles = await figma.getLocalTextStylesAsync();
function styleIdFor(name) {
  const s = textStyles.find((t) => t.name === name);
  return s ? s.id : null;
}

const docStyles = {
  Section:   styleIdFor('Doc/Section'),
  TokenName: styleIdFor('Doc/TokenName'),
  Code:      styleIdFor('Doc/Code'),
  Caption:   styleIdFor('Doc/Caption'),
};

function baseRow(s, stylePath, variant) {
  const family = TYPO_DATA.fontFamilyFor[s.category];
  const effectiveWeight = variant === 'emphasis' ? 500 : s.fontWeight;
  return {
    type: 'slot',
    tokenPath: stylePath,
    styleId: styleIdFor(stylePath),
    specimenChars: TYPO_DATA.specimens[s.category] || stylePath,
    sizeLine1: s.fontSize + 'px size',
    sizeLine2: s.lineHeight + 'px line',
    weightLine1: String(effectiveWeight) + ' weight',
    weightLine2: family,
    codeSyntax: cs(stylePath, 'font-size'),
    variant: variant || 'base',
  };
}

const rows = [];
const CATEGORIES = ['Display', 'Headline', 'Title', 'Body', 'Label'];
for (const cat of CATEGORIES) {
  rows.push({ type: 'category', label: cat });
  if (cat === 'Body') {
    for (const size of TYPO_DATA.bodySizes) {
      const base = TYPO_DATA.baseSlots.find((s) => s.category === 'Body' && s.size === size);
      for (const variant of TYPO_DATA.bodyVariants) {
        const path = 'Body/' + size + '/' + variant;
        rows.push(baseRow(base, path, variant));
      }
    }
  } else {
    for (const s of TYPO_DATA.baseSlots.filter((s) => s.category === cat)) {
      rows.push(baseRow(s, s.slot, 'base'));
    }
  }
}

const textStylesPage = figma.root.children.find((pg) => pg.name === '\u21B3 Text Styles');
if (!textStylesPage || textStylesPage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Text Styles)');
}

const ctx = {
  pageId: textStylesPage.id,
  docStyles,
  rows,
};
await build(ctx);
const tableGroups = textStylesPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true,
  step: '15c-text-styles',
  pageId: textStylesPage.id,
  tableGroups,
  pageName: textStylesPage.name,
  rowCount: rows.length,
};
