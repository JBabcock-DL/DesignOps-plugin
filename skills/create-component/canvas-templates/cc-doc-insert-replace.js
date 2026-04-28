/** Replace a step-1 dashed placeholder if present; otherwise append (single-pass doc). */
async function __ccDocInsertOrReplaceSection(scaffoldSlug, buildSection) {
  const phName = `doc/scaffold-placeholder/${CONFIG.component}/${scaffoldSlug}`;
  const ph = docRoot.findOne(n => n.type === 'FRAME' && n.name === phName);
  const section = await buildSection();
  if (ph) {
    const idx = ph.parent.children.indexOf(ph);
    ph.remove();
    docRoot.insertChild(idx, section);
  } else {
    docRoot.appendChild(section);
  }
}
