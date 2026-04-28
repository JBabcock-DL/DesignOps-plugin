docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'properties',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
__ccDocFillPropertiesFromConfig();
return {
  ok: true,
  section: 'properties',
  docRootId: docRoot.id,
};
