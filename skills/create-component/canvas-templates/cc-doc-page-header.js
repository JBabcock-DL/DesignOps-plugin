function __ccDocPageHeader() {
  pageContent = figma.createFrame();
  pageContent.name = '_PageContent';
  pageContent.layoutMode = 'VERTICAL';
  // resize FIRST so it doesn't reset the sizing modes we're about to set
  pageContent.resize(1800, 1);
  pageContent.primaryAxisSizingMode = 'AUTO';
  pageContent.counterAxisSizingMode = 'FIXED';
  pageContent.paddingTop    = 80;
  pageContent.paddingBottom = 80;
  pageContent.paddingLeft   = 80;
  pageContent.paddingRight  = 80;
  pageContent.itemSpacing   = 48;
  pageContent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  pageContent.x = 0;
  pageContent.y = 320;
  figma.currentPage.appendChild(pageContent);

  docRoot = figma.createFrame();
  docRoot.name = `doc/component/${CONFIG.component}`;
  docRoot.layoutMode = 'VERTICAL';
  docRoot.resize(DOC_FRAME_WIDTH, 1);
  docRoot.primaryAxisSizingMode = 'AUTO';
  docRoot.counterAxisSizingMode = 'FIXED';
  docRoot.layoutAlign = 'STRETCH';
  docRoot.itemSpacing = 48;
  docRoot.fills = [];
  pageContent.appendChild(docRoot);

  // --- 6.4  Header (title + summary) -------------------------------------

  const header = figma.createFrame();
  header.name = `doc/component/${CONFIG.component}/header`;
  header.layoutMode = 'VERTICAL';
  header.resize(DOC_FRAME_WIDTH, 1);
  header.primaryAxisSizingMode = 'AUTO';
  header.counterAxisSizingMode = 'FIXED';
  header.layoutAlign = 'STRETCH';
  header.itemSpacing = 12;
  header.fills = [];
  docRoot.appendChild(header);

  const title = makeText(CONFIG.title, 'section', 32);
  bindColor(title, 'color/background/content', '#0a0a0a', 'fills');
  header.appendChild(title);

  const summary = makeText(CONFIG.summary, 'caption', 14);
  bindColor(summary, 'color/background/content-muted', '#6b7280', 'fills');
  header.appendChild(summary);
}
