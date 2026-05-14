// Concatenate after _lib.js + text-styles.js (phase 07). Builds typography table in-plugin.
// Fully dynamic — discovers all local text styles (excluding Doc/*), groups by first path segment.
// Reads fontSize, lineHeight, fontWeight, fontFamily directly from each text style.
const allTextStyles = await figma.getLocalTextStylesAsync();

// Exclude infrastructure styles
const typographyStyles = allTextStyles.filter(
  (s) => !s.name.startsWith('Doc/') && !s.name.startsWith('Effect/')
);

await loadFontsForTextStyles(typographyStyles);

// Group by first path segment (category)
const categoryMap = {};
const categoryOrder = [];
for (const s of typographyStyles) {
  const firstSeg = s.name.split('/')[0];
  if (!categoryMap[firstSeg]) {
    categoryMap[firstSeg] = [];
    categoryOrder.push(firstSeg);
  }
  categoryMap[firstSeg].push(s);
}

// Sort categories in known order; unknown categories appended alphabetically
const CATEGORY_ORDER = ['Display', 'Headline', 'Title', 'Body', 'Label'];
const orderedCategories = [
  ...CATEGORY_ORDER.filter((c) => categoryMap[c]),
  ...categoryOrder.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
];

const SPECIMENS = {
  Display: 'Dream design systems',
  Headline: 'Ship it with confidence',
  Title: 'Tokens keep us honest',
  Body: 'The quick brown fox jumps over the lazy dog.',
  Label: 'STATUS — ACTIVE',
};

function csFor(styleName) {
  const lower = styleName.toLowerCase().replace(/\s+/g, '-');
  const kebab = lower.replace(/\//g, '-');
  const parts = lower.split('/');
  return {
    WEB: 'var(--' + kebab + ')',
    ANDROID: kebab,
    iOS: '.Typography.' + parts.join('.'),
  };
}

function readCS(s) {
  const cs = s.codeSyntax || {};
  if (cs.WEB || cs.ANDROID || cs.iOS || cs.IOS) {
    return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
  }
  return csFor(s.name);
}

function lineHeightStr(lh) {
  if (!lh) return '—';
  if (lh.unit === 'AUTO') return 'auto line';
  if (lh.unit === 'PIXELS') return `${Math.round(lh.value)}px line`;
  if (lh.unit === 'PERCENT') return `${lh.value}% line`;
  return `${lh.value} line`;
}

const SIZE_PRIORITY = { '2XL': -2, XL: -1, LG: 0, MD: 1, SM: 2, XS: 3 };

const rows = [];
for (const cat of orderedCategories) {
  rows.push({ type: 'category', label: cat });
  const catStyles = categoryMap[cat].slice().sort((a, b) => {
    const partsA = a.name.split('/');
    const partsB = b.name.split('/');
    const sizeA = (partsA[1] || '').toUpperCase();
    const sizeB = (partsB[1] || '').toUpperCase();
    const prioA = SIZE_PRIORITY[sizeA] ?? 99;
    const prioB = SIZE_PRIORITY[sizeB] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    return a.name.localeCompare(b.name);
  });
  for (const s of catStyles) {
    const parts = s.name.split('/');
    const rawVariant = parts.length >= 3 ? parts[2].toLowerCase() : 'base';
    const variant = ['emphasis', 'italic', 'link', 'strikethrough'].includes(rawVariant)
      ? rawVariant
      : 'base';
    rows.push({
      type: 'slot',
      tokenPath: s.name,
      styleId: s.id,
      specimenChars: SPECIMENS[cat] || s.name,
      sizeLine1: `${Math.round(s.fontSize)}px size`,
      sizeLine2: lineHeightStr(s.lineHeight),
      weightLine1: `${s.fontWeight} weight`,
      weightLine2: s.fontName ? s.fontName.family : '—',
      codeSyntax: readCS(s),
      variant,
    });
  }
}

const docStyles = {
  Section:   allTextStyles.find((s) => s.name === '_Doc/Section')?.id   || null,
  TokenName: allTextStyles.find((s) => s.name === '_Doc/TokenName')?.id || null,
  Code:      allTextStyles.find((s) => s.name === '_Doc/Code')?.id      || null,
  Caption:   allTextStyles.find((s) => s.name === '_Doc/Caption')?.id   || null,
};

const textStylesPage =
  findDesignOpsPage('text-styles', {
    legacyExact: ['↳ Text Styles'],
    legacyRegex: [/^↳?\s*text\s*styles/i],
  }) || null;
if (!textStylesPage || textStylesPage.type !== 'PAGE') {
  throw new Error('Page not found (expected ↳ Text Styles / slug text-styles)');
}

const ctx = {
  pageId: textStylesPage.id,
  docStyles,
  rows,
};
await build(ctx);
const tableGroups = textStylesPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;

const expected = new Map();
for (const r of rows) {
  if (r.type === 'slot' && r.tokenPath && r.styleId) expected.set(r.tokenPath, r.styleId);
}
const table = textStylesPage.findOne((n) => n.name === 'doc/table/typography/styles' && n.type === 'FRAME');
const body = table && table.children.find((c) => c.name === 'doc/table/typography/styles/body');
let specimenStyleOk = 0;
let specimenStyleMissing = 0;
let specimenStyleMismatch = 0;
const auditErrors = [];
if (!table) auditErrors.push('doc/table/typography/styles not found');
else if (!body) auditErrors.push('doc/table/typography/styles/body not found');
else {
  for (const [tokenPath, wantId] of expected) {
    const rowFrame = body.children.find((c) => c.type === 'FRAME' && c.name === `row/${tokenPath}`);
    if (!rowFrame) {
      specimenStyleMissing++;
      continue;
    }
    const specCell = rowFrame.children.find((c) => c.type === 'FRAME' && c.name === 'cell/specimen');
    const specimenNode = specCell && specCell.findOne((n) => n.type === 'TEXT' && n.name === 'text/specimen');
    if (!specimenNode || !specimenNode.textStyleId) {
      specimenStyleMissing++;
      continue;
    }
    if (specimenNode.textStyleId !== wantId) {
      specimenStyleMismatch++;
      continue;
    }
    specimenStyleOk++;
  }
}

const slotCount = expected.size;
const auditFail = specimenStyleMissing > 0 || specimenStyleMismatch > 0 || auditErrors.length > 0;
if (auditFail) {
  const parts = [];
  if (auditErrors.length) parts.push(...auditErrors);
  if (specimenStyleMissing) parts.push(`specimenStyleMissing: ${specimenStyleMissing}`);
  if (specimenStyleMismatch) parts.push(`specimenStyleMismatch: ${specimenStyleMismatch}`);
  return {
    ok: false,
    step: '15c-text-styles',
    pageId: textStylesPage.id,
    tableGroups,
    pageName: textStylesPage.name,
    rowCount: rows.length,
    specimenStyleOk,
    specimenStyleMissing,
    specimenStyleMismatch,
    slotCount,
    errors: parts,
  };
}

return {
  ok: true,
  step: '15c-text-styles',
  pageId: textStylesPage.id,
  tableGroups,
  pageName: textStylesPage.name,
  rowCount: rows.length,
  specimenStyleOk,
  specimenStyleMissing,
  specimenStyleMismatch,
  slotCount,
};
