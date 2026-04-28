__ccDocPageHeader();
docRoot.appendChild(buildPropertiesTable(__ccPlaceholderPropertyRows()));
__ccDocAppendScaffoldPlaceholders();
pageContent.layoutSizingVertical = 'HUG';
docRoot.layoutSizingVertical = 'HUG';
return {
  ok: true,
  section: 'scaffold',
  pageName: CONFIG.pageName,
  component: CONFIG.component,
  pageContentId: pageContent.id,
  docRootId: docRoot.id,
};
