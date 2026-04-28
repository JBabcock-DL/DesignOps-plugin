docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'usage',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
await __ccDocAppendUsage();
return {
  ok: true,
  section: 'usage',
  docRootId: docRoot.id,
};
