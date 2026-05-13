// Foundations shell — Tier 3: create five style-guide pages, stamp slugs, _Header instances,
// collection registry JSON, and TOC hyperlinks for toc-link/* rows (FILE_KEY required for URLs).
// Standalone script for use_figma — no _shared-token-helpers inlay (see 06b-foundations-shell.md).
// Before this block, set: const FILE_KEY = '<figma file key>';
//
// Optional (MCP / migrated files without /new-project 05b):
//   const DESIGNOPS_HEADER_PLACEHOLDER = true;
// → creates a minimal `_Header` COMPONENT on Documentation components (1800×320, _title + _description).
// If omitted and no `_Header` master exists, the shell still writes registry + slugs + TOC links but skips
// header instances and returns `headerMasterMissing: true` (parent should ask designer: re-run with
// DESIGNOPS_HEADER_PLACEHOLDER true, add a real master from /new-project 05b, or accept skip and fix canvas).
//
// Preconditions: /new-project through 05c when using the full template. Variables + Step 11 close should have run first.

if (typeof figma === 'undefined') {
  throw new Error('[foundations-shell.figma.js] Must run inside use_figma.');
}

const DESIGNOPS_SHARED_NS = 'labs.designops';
const PAGE_SLUG_SUBKEY = 'pageSlug';
const REGISTRY_SUBKEY = 'collectionRegistry';
const REGISTRY_FRAME = '_DesignOpsRegistry';

const MANIFEST = {
  manifestVersion: '2026-05-13',
  shellPages: [
    {
      pageSlug: 'primitives',
      displayTitle: '↳ Primitives',
      legacyNameCandidates: ['↳ Primitives'],
      headerTitle: 'Primitives',
      headerDescription: 'Raw color ramps, spacing scale, corner radius scale, and elevation values.',
      legacyRegex: /primitives/i,
    },
    {
      pageSlug: 'theme',
      displayTitle: '↳ Theme',
      legacyNameCandidates: ['↳ Theme'],
      headerTitle: 'Theme',
      headerDescription: 'Semantic color tokens — light and dark mode aliases into Primitives.',
      legacyRegex: /^↳?\s*theme/i,
    },
    {
      pageSlug: 'layout',
      displayTitle: '↳ Layout',
      legacyNameCandidates: ['↳ Layout'],
      headerTitle: 'Layout',
      headerDescription: 'Space and radius semantic tokens wired to the spacing and corner scale.',
      legacyRegex: /^↳?\s*layout/i,
    },
    {
      pageSlug: 'text-styles',
      displayTitle: '↳ Text Styles',
      legacyNameCandidates: ['↳ Text Styles'],
      headerTitle: 'Text Styles',
      headerDescription: 'Typography scale — 12 style slots across Display, Headline, Body, and Label.',
      legacyRegex: /^↳?\s*text\s*styles/i,
    },
    {
      pageSlug: 'effects',
      displayTitle: '↳ Effects',
      legacyNameCandidates: ['↳ Effects'],
      headerTitle: 'Effects',
      headerDescription: 'Shadow and elevation tokens — light and dark mode opacity variants.',
      legacyRegex: /^↳?\s*effects?/i,
    },
  ],
};

function hasHeaderOnPage(page) {
  for (const c of page.children) {
    if (c.name !== '_Header') continue;
    if (c.type !== 'INSTANCE' && c.type !== 'COMPONENT') continue;
    if (Math.abs(c.x) >= 1 || Math.abs(c.y) >= 1) continue;
    return true;
  }
  return false;
}

/** Minimal `_Header` master for Tier-3 shell when /new-project 05b was never run (canvas expects INSTANCE at 0,0). */
async function createPlaceholderHeaderMaster(page) {
  const comp = figma.createComponent();
  comp.name = '_Header';
  comp.layoutMode = 'VERTICAL';
  comp.primaryAxisSizingMode = 'FIXED';
  comp.counterAxisSizingMode = 'FIXED';
  comp.resize(1800, 320);
  comp.cornerRadius = 0;
  comp.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
  comp.paddingLeft = comp.paddingRight = 40;
  comp.paddingTop = comp.paddingBottom = 32;
  comp.itemSpacing = 8;
  page.appendChild(comp);

  const title = figma.createText();
  title.name = '_title';
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  title.fontName = { family: 'Inter', style: 'Bold' };
  title.fontSize = 28;
  title.characters = 'Title';
  title.textAutoResize = 'HEIGHT';
  title.resize(1720, 1);
  comp.appendChild(title);

  const desc = figma.createText();
  desc.name = '_description';
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  desc.fontName = { family: 'Inter', style: 'Regular' };
  desc.fontSize = 16;
  desc.characters = 'Description';
  desc.textAutoResize = 'HEIGHT';
  desc.resize(1720, 1);
  comp.appendChild(desc);

  return comp;
}

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

const docPage = figma.root.children.find((p) => p.type === 'PAGE' && p.name === 'Documentation components');
if (!docPage) throw new Error('Documentation components page missing');

let registryFrame = docPage.findOne((n) => n.type === 'FRAME' && n.name === REGISTRY_FRAME);
if (!registryFrame) {
  registryFrame = figma.createFrame();
  registryFrame.name = REGISTRY_FRAME;
  registryFrame.resize(8, 8);
  registryFrame.x = -4000;
  registryFrame.y = -4000;
  registryFrame.fills = [];
  docPage.appendChild(registryFrame);
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();

// §5.4 collection resolution (plan foundations-shell-and-preflight + §5.4 table):
// When writing registry ids, order is: (1) exact collection name match,
// (2) conservative regex on collection name, (3) Theme fallback = collection with both Light and Dark modes.
// Registry merge: existing pluginData map is spread first, then non-empty idMap keys overwrite (stale id repair
// for renamed collections is agent-handled; shell only merges heuristics when a live collection matches).

function pickCollection(exactName, fuzzyRe) {
  let c = collections.find((x) => x.name === exactName);
  if (c) return c;
  if (fuzzyRe) c = collections.find((x) => fuzzyRe.test(x.name));
  return c || null;
}

function pickTheme() {
  let c = pickCollection('Theme', /theme|semantic/i);
  if (c) return c;
  return (
    collections.find(
      (col) =>
        col.modes.some((m) => /^light/i.test(String(m.name || '').trim())) &&
        col.modes.some((m) => /^dark/i.test(String(m.name || '').trim()))
    ) || null
  );
}

const idMap = {};
const prim = pickCollection('Primitives', /primitiv|core|foundation|base/i);
const theme = pickTheme();
const typo = pickCollection('Typography', /typograph/i);
const layout = pickCollection('Layout', /layout|spacing|dimensional/i);
const effects = pickCollection('Effects', /effects?|shadow|elevation/i);
if (prim) idMap.primitives = prim.id;
if (theme) idMap.theme = theme.id;
if (typo) idMap.typography = typo.id;
if (layout) idMap.layout = layout.id;
if (effects) idMap.effects = effects.id;

let prevRegistry = {};
try {
  prevRegistry = JSON.parse(registryFrame.getSharedPluginData(DESIGNOPS_SHARED_NS, REGISTRY_SUBKEY) || '{}') || {};
} catch (_) {
  prevRegistry = {};
}
const mergedRegistry = { ...prevRegistry, ...idMap };
registryFrame.setSharedPluginData(DESIGNOPS_SHARED_NS, REGISTRY_SUBKEY, JSON.stringify(mergedRegistry));

let headerMaster = docPage.findOne((n) => n.type === 'COMPONENT' && n.name === '_Header');
let headerMasterMissing = false;
let placeholderHeaderCreated = false;

if (!headerMaster) {
  if (typeof DESIGNOPS_HEADER_PLACEHOLDER !== 'undefined' && DESIGNOPS_HEADER_PLACEHOLDER === true) {
    headerMaster = await createPlaceholderHeaderMaster(docPage);
    placeholderHeaderCreated = true;
  } else {
    headerMasterMissing = true;
    headerMaster = null;
  }
}

let createdCount = 0;
let stampedCount = 0;
let headersPlaced = 0;

for (const row of MANIFEST.shellPages) {
  const allPages = figma.root.children.filter((p) => p.type === 'PAGE');
  let page = allPages.find((p) => p.getSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY) === row.pageSlug);

  if (!page) {
    for (const nm of row.legacyNameCandidates) {
      const hits = allPages.filter((p) => p.name === nm);
      if (hits.length > 1) throw new Error(`Ambiguous legacy name "${nm}" (${hits.length} pages)`);
      if (hits.length === 1) {
        page = hits[0];
        break;
      }
    }
  }
  if (!page && row.legacyRegex) {
    const regHits = allPages.filter((p) => row.legacyRegex.test(p.name));
    if (regHits.length > 1) throw new Error(`Ambiguous regex for ${row.pageSlug}: ${regHits.map((p) => p.name).join(' | ')}`);
    if (regHits.length === 1) page = regHits[0];
  }

  if (!page) {
    page = figma.createPage();
    page.name = row.displayTitle;
    createdCount += 1;
  }

  const existingSlug = page.getSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY);
  if (!existingSlug) {
    page.setSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY, row.pageSlug);
    stampedCount += 1;
  } else if (existingSlug !== row.pageSlug) {
    throw new Error(`Page "${page.name}" has slug ${existingSlug} (expected ${row.pageSlug})`);
  }

  if (page.name === 'Documentation components') continue;

  if (!hasHeaderOnPage(page) && headerMaster) {
    const inst = headerMaster.createInstance();
    inst.x = 0;
    inst.y = 0;
    page.appendChild(inst);
    const titleNode = inst.findOne((n) => n.name === '_title' && n.type === 'TEXT');
    const descNode = inst.findOne((n) => n.name === '_description' && n.type === 'TEXT');
    if (titleNode) {
      await figma.loadFontAsync(titleNode.fontName);
      titleNode.characters = row.headerTitle;
    }
    if (descNode) {
      await figma.loadFontAsync(descNode.fontName);
      descNode.characters = row.headerDescription || '';
    }
    headersPlaced += 1;
  }
}

const tokenOverviewPage = figma.root.children.find((p) => p.type === 'PAGE' && p.name === '\u21B3 Token Overview');
if (tokenOverviewPage && !tokenOverviewPage.getSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY)) {
  tokenOverviewPage.setSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY, 'token-overview');
}

let linksSet = 0;
if (typeof FILE_KEY === 'undefined' || !FILE_KEY) {
  /* skip hyperlinks without file key */
} else {
  const tocPage = figma.root.children.find((p) => p.type === 'PAGE' && p.name === '📝 Table of Contents');
  if (tocPage) {
    const linkRows = tocPage.findAll((n) => n.name.startsWith('toc-link/'));
    for (const linkRow of linkRows) {
      const pageName = linkRow.name.replace('toc-link/', '');
      const targetPage = figma.root.children.find((p) => p.type === 'PAGE' && p.name === pageName);
      if (!targetPage) continue;
      const targetNode =
        pageName === 'Thumbnail'
          ? targetPage.findOne((n) => n.name === 'Cover') || targetPage.children[0]
          : targetPage.children.find((n) => n.name === '_Header') || targetPage.children[0];
      if (!targetNode) continue;
      const textNode = linkRow.findOne((n) => n.type === 'TEXT' && n.characters !== '→');
      if (!textNode) continue;
      const nodeId = targetNode.id.replace(':', '-');
      textNode.hyperlink = { type: 'URL', value: `https://www.figma.com/design/${FILE_KEY}?node-id=${nodeId}` };
      linksSet += 1;
    }
  }
}

return {
  ok: true,
  step: 'foundations-shell',
  createdCount,
  stampedCount,
  headersPlaced,
  linksSet,
  registryKeys: Object.keys(mergedRegistry),
  headerMasterMissing,
  placeholderHeaderCreated,
};
