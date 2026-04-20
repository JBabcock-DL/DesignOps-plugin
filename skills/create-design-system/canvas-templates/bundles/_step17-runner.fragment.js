// Concatenate after _lib.js + token-overview.js (phase 08 / sync 9d).
const overviewPage = figma.root.children.find((pg) => pg.name === '\u21B3 Token Overview');
if (!overviewPage || overviewPage.type !== 'PAGE') {
  return {
    ok: false,
    step: '17-token-overview',
    skipped: 'page missing',
    pageName: '\u21B3 Token Overview',
    existingPages: figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name),
  };
}
const ctx = { pageId: overviewPage.id };
const hadVm = 'variableMap' in ctx;
const result = await build(ctx);
return {
  ok: true,
  step: '17-token-overview',
  pageId: overviewPage.id,
  pageName: overviewPage.name,
  hadVariableMapBeforeBuild: hadVm,
  variableMapKeysAfterHydrate: Object.keys(ctx.variableMap || {}).length,
  ...result,
};
