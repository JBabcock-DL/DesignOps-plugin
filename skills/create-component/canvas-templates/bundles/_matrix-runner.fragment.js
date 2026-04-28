docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'matrix',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
const _compSetName = `${CONFIG.title} \u2014 ComponentSet`;
const compSetNode = docRoot.findOne(
  n => n.type === 'COMPONENT_SET' && n.name === _compSetName,
);
if (!compSetNode) {
  return {
    ok: false,
    section: 'matrix',
    missingFrame: 'ComponentSet',
  };
}
compSet = compSetNode;
variantByKey = {};
for (const node of compSet.children) {
  if (node.type !== 'COMPONENT') continue;
  const parts = node.name.split(', ').reduce((acc, kv) => {
    const [k, val] = kv.split('=');
    acc[k] = val;
    return acc;
  }, {});
  const vk = hasSizeAxis ? `${parts.variant}|${parts.size}` : parts.variant;
  variantByKey[vk] = node;
}
await __ccDocInsertOrReplaceSection('matrix', () => buildMatrix());
return {
  ok: true,
  section: 'matrix',
  docRootId: docRoot.id,
};
