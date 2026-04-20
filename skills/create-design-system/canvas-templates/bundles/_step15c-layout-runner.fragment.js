// Concatenate after _lib.js + layout.js (phase 07). Resolves Layout rows in-plugin; ctx omits variableMap.
const LAYOUT_DATA = {
  spacing: [
    { path: 'space/xs',  alias: 'Space/100',  codeSyntax: { WEB: 'var(--space-xs)',  ANDROID: 'space-xs',  iOS: '.Layout.space.xs' } },
    { path: 'space/sm',  alias: 'Space/200',  codeSyntax: { WEB: 'var(--space-sm)',  ANDROID: 'space-sm',  iOS: '.Layout.space.sm' } },
    { path: 'space/md',  alias: 'Space/300',  codeSyntax: { WEB: 'var(--space-md)',  ANDROID: 'space-md',  iOS: '.Layout.space.md' } },
    { path: 'space/lg',  alias: 'Space/400',  codeSyntax: { WEB: 'var(--space-lg)',  ANDROID: 'space-lg',  iOS: '.Layout.space.lg' } },
    { path: 'space/xl',  alias: 'Space/600',  codeSyntax: { WEB: 'var(--space-xl)',  ANDROID: 'space-xl',  iOS: '.Layout.space.xl' } },
    { path: 'space/2xl', alias: 'Space/800',  codeSyntax: { WEB: 'var(--space-2xl)', ANDROID: 'space-2xl', iOS: '.Layout.space.2xl' } },
    { path: 'space/3xl', alias: 'Space/1200', codeSyntax: { WEB: 'var(--space-3xl)', ANDROID: 'space-3xl', iOS: '.Layout.space.3xl' } },
    { path: 'space/4xl', alias: 'Space/1600', codeSyntax: { WEB: 'var(--space-4xl)', ANDROID: 'space-4xl', iOS: '.Layout.space.4xl' } },
  ],
  radius: [
    { path: 'radius/none', alias: 'Corner/None',        codeSyntax: { WEB: 'var(--radius-none)', ANDROID: 'radius-none', iOS: '.Layout.radius.none' } },
    { path: 'radius/xs',   alias: 'Corner/Extra-small', codeSyntax: { WEB: 'var(--radius-xs)',   ANDROID: 'radius-xs',   iOS: '.Layout.radius.xs' } },
    { path: 'radius/sm',   alias: 'Corner/Small',       codeSyntax: { WEB: 'var(--radius-sm)',   ANDROID: 'radius-sm',   iOS: '.Layout.radius.sm' } },
    { path: 'radius/md',   alias: 'Corner/Medium',      codeSyntax: { WEB: 'var(--radius-md)',   ANDROID: 'radius-md',   iOS: '.Layout.radius.md' } },
    { path: 'radius/lg',   alias: 'Corner/Large',       codeSyntax: { WEB: 'var(--radius-lg)',   ANDROID: 'radius-lg',   iOS: '.Layout.radius.lg' } },
    { path: 'radius/xl',   alias: 'Corner/Extra-large', codeSyntax: { WEB: 'var(--radius-xl)',   ANDROID: 'radius-xl',   iOS: '.Layout.radius.xl' } },
    { path: 'radius/full', alias: 'Corner/Full',        codeSyntax: { WEB: 'var(--radius-full)', ANDROID: 'radius-full', iOS: '.Layout.radius.full' } },
  ],
};

const allVars = await figma.variables.getLocalVariablesAsync();
const byName = Object.fromEntries(allVars.map((v) => [v.name, v]));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const layoutColl = collections.find((c) => c.name === 'Layout');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!layoutColl) throw new Error('Layout collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const layoutModeId = layoutColl.modes[0].modeId;
const primModeId = primColl.modes[0].modeId;

async function resolvePx(varId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = v.variableCollectionId === layoutColl.id ? layoutModeId : primModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (!val) return 0;
    if (val.type !== 'VARIABLE_ALIAS') return val.type === 'FLOAT' ? val.value : 0;
    const next = await figma.variables.getVariableByIdAsync(val.id);
    m = next.variableCollectionId === layoutColl.id ? layoutModeId : primModeId;
    v = next;
  }
  return 0;
}

async function buildRow(r) {
  const v = byName[r.path];
  if (!v) return null;
  let px = await resolvePx(v.id);
  if (r.alias === 'Corner/Full') px = 9999;
  return { tokenPath: r.path, resolvedPx: px, aliasPath: r.alias, codeSyntax: r.codeSyntax };
}

const spacing = [];
for (const r of LAYOUT_DATA.spacing) { const row = await buildRow(r); if (row) spacing.push(row); }
const radius = [];
for (const r of LAYOUT_DATA.radius) { const row = await buildRow(r); if (row) radius.push(row); }

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const layoutPage = figma.root.children.find((pg) => pg.name === '\u21B3 Layout');
if (!layoutPage || layoutPage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Layout)');
}

const ctx = {
  pageId: layoutPage.id,
  docStyles,
  rows: { spacing, radius },
};
await build(ctx);
const tableGroups = layoutPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15c-layout', pageId: layoutPage.id, tableGroups, pageName: layoutPage.name };
