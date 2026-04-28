docRoot = figma.currentPage.findOne(
  n => n.name === `doc/component/${CONFIG.component}` && n.type === 'FRAME',
);
if (!docRoot) {
  return {
    ok: false,
    section: 'component',
    missingFrame: `doc/component/${CONFIG.component}`,
  };
}
await __ccDocAppendComponentSection();

function __ccNodePathUpToPage(node) {
  const parts = [];
  let x = node;
  while (x && x.type !== 'PAGE') {
    parts.unshift(x.name);
    x = x.parent;
  }
  return parts.join('/');
}

function __ccSerializeCompSetPropertyDefinitions(cs) {
  const out = {};
  try {
    const raw = cs.componentPropertyDefinitions;
    if (!raw) return out;
    for (const k of Object.keys(raw)) {
      const d = raw[k];
      out[k] = { type: d.type, defaultValue: d.defaultValue };
    }
  } catch (_e) {}
  return out;
}

const page = figma.currentPage;
const pageName = page.name;
const docRootChildren = page.children.length;
const layout = CONFIG.layout || 'chip';
let compSetVariantRows = [];
let firstVariantChildren = [];
let compSetParent = null;
let compSetPropertyDefinitions = {};
let compSetVariants = 0;

if (compSet) {
  compSetParent = __ccNodePathUpToPage(compSet.parent);
  compSetPropertyDefinitions = __ccSerializeCompSetPropertyDefinitions(compSet);
  compSetVariants = compSet.children.length;
  for (const node of compSet.children) {
    if (node.type !== 'COMPONENT') continue;
    const childNames = node.children.map(ch => ch.name);
    const hasText = node.findOne(n => n.type === 'TEXT') != null;
    compSetVariantRows.push({ name: node.name, childNames, hasText });
  }
  const first = compSet.children[0];
  if (first && first.type === 'COMPONENT') {
    firstVariantChildren = first.children.map(ch => ch.name);
  }
}

const unresolvedTokenPaths = {
  total: typeof _unresolvedTokenMisses !== 'undefined' ? _unresolvedTokenMisses.length : 0,
};
const propErrorsSample = __ccPropAddErrors.slice(0, 5);
const propErrorsCount = __ccPropAddErrors.length;

return {
  ok: true,
  section: 'component',
  docRootId: docRoot.id,
  compSetId: compSet ? compSet.id : null,
  compSetName: compSet ? compSet.name : null,
  propsAdded,
  pageName,
  docRootChildren,
  layout,
  compSetParent,
  compSetVariants,
  compSetPropertyDefinitions,
  firstVariantChildren,
  compSetVariantRows,
  unresolvedTokenPaths,
  propErrorsCount,
  propErrorsSample,
};
