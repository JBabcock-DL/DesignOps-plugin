// Read-only pre-flight snapshot for Tier 3 Foundations shell + canvas gates.
// Inlined after optional figma-use check. Returns JSON only — no mutations.
// `fileKey` is optional echo: pass as top-level const FILE_KEY = '...' before this file when assembling.
//
// Warning prefixes (plan §5.1): duplicate_slug:<slug>:<n> | duplicate_legacy_match:<pageName>:<n> | registry_json_parse_error
// shellCandidateBranch: skip_shell | partial_shell | legacy_stamp | fresh_shell | blocked_ambiguous (blocked wins over hints)

if (typeof figma === 'undefined') {
  throw new Error('[preflight-snapshot.figma.js] Must run inside use_figma.');
}

const DESIGNOPS_SHARED_NS = 'labs.designops';
const PAGE_SLUG_SUBKEY = 'pageSlug';
const REGISTRY_FRAME_NAME = '_DesignOpsRegistry';
const REGISTRY_SUBKEY = 'collectionRegistry';

function hasHeaderInstance(page) {
  for (var _hi = 0; _hi < page.children.length; _hi++) {
    var c = page.children[_hi];
    // Accept exact '_Header' or any /^_?header/i instance/component at origin
    var isHeader = c.name === '_Header' || /^_?header/i.test(c.name);
    if (!isHeader) continue;
    if (c.type !== 'INSTANCE' && c.type !== 'COMPONENT') continue;
    if (Math.abs(c.x) >= 1 || Math.abs(c.y) >= 1) continue;
    return true;
  }
  return false;
}

function findRegistryFrame() {
  const docPage = figma.root.children.find((p) => p.type === 'PAGE' && p.name === 'Documentation components');
  if (!docPage) return null;
  return docPage.findOne((n) => n.type === 'FRAME' && n.name === REGISTRY_FRAME_NAME) || null;
}

const warnings = [];

const pages = [];
for (const p of figma.root.children) {
  if (p.type !== 'PAGE') continue;
  const slug = p.getSharedPluginData(DESIGNOPS_SHARED_NS, PAGE_SLUG_SUBKEY) || null;
  pages.push({
    id: p.id,
    name: p.name,
    slug,
    hasHeaderInstance: hasHeaderInstance(p),
  });
}

const slugCounts = {};
for (const row of pages) {
  if (!row.slug) continue;
  slugCounts[row.slug] = (slugCounts[row.slug] || 0) + 1;
}
for (const [slug, n] of Object.entries(slugCounts)) {
  if (n > 1) {
    // Plan §5.3 row 5 — two+ pages carry the same labs.designops/pageSlug.
    warnings.push(`duplicate_slug:${slug}:${n}`);
  }
}

// Plan §5.3 row 3 — multiple PAGE nodes share a manifest display title (ambiguous legacy).
// Must match `shellPages[].displayTitle` in ../../shared/designops-foundations-shell.json (see npm run qa:foundations-shell-manifest).
const LEGACY_DISPLAY_TITLES = ['↳ Primitives', '↳ Theme', '↳ Layout', '↳ Text Styles', '↳ Effects'];
for (const title of LEGACY_DISPLAY_TITLES) {
  const n = pages.filter((p) => p.name === title).length;
  if (n > 1) warnings.push(`duplicate_legacy_match:${title}:${n}`);
}

const allVarsList = await figma.variables.getLocalVariablesAsync();
const countByColl = {};
for (const v of allVarsList) {
  countByColl[v.variableCollectionId] = (countByColl[v.variableCollectionId] || 0) + 1;
}

const collections = [];
const colList = await figma.variables.getLocalVariableCollectionsAsync();
for (const c of colList) {
  collections.push({ id: c.id, name: c.name, variableCount: countByColl[c.id] || 0 });
}

const registryFrame = findRegistryFrame();
let registryRaw = null;
let registryParsed = {};
let registryPresent = false;
if (registryFrame) {
  registryRaw = registryFrame.getSharedPluginData(DESIGNOPS_SHARED_NS, REGISTRY_SUBKEY) || null;
  if (registryRaw) {
    try {
      registryParsed = JSON.parse(registryRaw);
      if (registryParsed && typeof registryParsed === 'object') registryPresent = true;
    } catch (_) {
      warnings.push('registry_json_parse_error');
      registryParsed = {};
    }
  }
}

const textStyles = await figma.getLocalTextStylesAsync();
const effectStyles = await figma.getLocalEffectStylesAsync();

const docNames = ['Doc/Section', 'Doc/TokenName', 'Doc/Code', 'Doc/Caption'];
const docCorePresent = docNames.every((nm) => textStyles.some((s) => s.name === nm));

const shadowNames = ['Effect/shadow-sm', 'Effect/shadow-md', 'Effect/shadow-lg', 'Effect/shadow-xl', 'Effect/shadow-2xl'];
const effectShadowPresent = shadowNames.every((nm) => effectStyles.some((s) => s.name === nm));

let typoSlots = 0;
for (const s of textStyles) {
  if (/^(Headline|Body|Label)\//.test(s.name)) typoSlots += 1;
}
const typographySlotsPresent = typoSlots >= 20;

// Fuzzy Doc/* — prefix matches doc/documentation/system/ui etc., role matches section/code/etc.
var docCoreFuzzyCount = textStyles.filter(function(s) {
  return /^(doc|documentation|system|ui|base|foundation)(\/)/i.test(s.name) &&
         /\b(section|heading|caption|label|code|token|mono|tokenname)\b/i.test(s.name);
}).length;
var docCorePresentFuzzy = docCoreFuzzyCount >= 4;

// Fuzzy Effect/shadow-* — any 3+ shadow-like effect styles
var effectShadowFuzzyCount = effectStyles.filter(function(s) {
  return /^(effect|shadow|elevation)(\/)/i.test(s.name);
}).length;
var effectShadowPresentFuzzy = effectShadowFuzzyCount >= 3;

// Extended typography regex — adds Display, Title, Typography, Type, Text, Font prefixes
var typographySlotsExtended = 0;
for (var _tsi = 0; _tsi < textStyles.length; _tsi++) {
  if (/^(Headline|Body|Label|Display|Title|Typography|Type|Text|Font)(\/)/i.test(textStyles[_tsi].name)) {
    typographySlotsExtended++;
  }
}
var typographySlotsPresentExtended = typographySlotsExtended >= 20;

const shellSlugs = ['primitives', 'theme', 'layout', 'text-styles', 'effects'];
let shellReady = true;
for (const s of shellSlugs) {
  const hits = pages.filter((p) => p.slug === s);
  if (hits.length !== 1 || !hits[0].hasHeaderInstance) shellReady = false;
}
const registryKeys = ['primitives', 'theme', 'typography', 'layout', 'effects'];
let registryComplete = registryPresent;
if (registryComplete) {
  for (const k of registryKeys) {
    if (!registryParsed[k]) {
      registryComplete = false;
      break;
    }
  }
}

function isBlockedAmbiguous(warns) {
  for (const w of warns) {
    if (w.startsWith('duplicate_slug:') || w.startsWith('duplicate_legacy_match:')) return true;
    if (w === 'registry_json_parse_error') return true;
  }
  return false;
}

let shellCandidateBranch = 'partial_shell';
if (shellReady && registryComplete) shellCandidateBranch = 'skip_shell';
else {
  const bySlugHits = shellSlugs.filter((s) => pages.some((p) => p.slug === s)).length;
  if (bySlugHits === 0) shellCandidateBranch = 'fresh_shell';
  else if (bySlugHits < shellSlugs.length) shellCandidateBranch = 'partial_shell';
  else shellCandidateBranch = 'legacy_stamp';
}
if (isBlockedAmbiguous(warnings)) shellCandidateBranch = 'blocked_ambiguous';

const manifestVersion = typeof MANIFEST_VERSION_EMBED !== 'undefined' ? MANIFEST_VERSION_EMBED : null;

return {
  schemaVersion: 1,
  fileKey: typeof FILE_KEY !== 'undefined' ? FILE_KEY : null,
  pages,
  collections,
  registry: { present: registryPresent, raw: registryRaw, parsed: registryParsed },
  axisC: {
    docCorePresent,
    effectShadowPresent,
    typographySlotsPresent,
    docCorePresentFuzzy,
    docCoreFuzzyCount,
    effectShadowPresentFuzzy,
    effectShadowFuzzyCount,
    typographySlotsExtended,
    typographySlotsPresentExtended,
  },
  manifestVersion,
  warnings,
  shellCandidateBranch,
};
