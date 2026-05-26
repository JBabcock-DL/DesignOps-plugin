// Concatenate after _lib.js + theme.js (phase 07). Resolves Theme rows in-plugin.
// Collection-scoped: finds the Theme-like collection by fuzzy name match (or Light/Dark mode
// detection), then draws ONLY COLOR vars from that collection grouped by first path segment.

const allVars = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const registryIds = readDesignOpsCollectionRegistry();

// ── Find the Theme-like collection (fuzzy) ────────────────────────────────────
// Priority: registry id → exact "Theme" → keyword match → any collection with both Light AND Dark modes
function findThemeCollection() {
  return resolveCollectionByLogicalKey('theme', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Theme');
  if (exact) return exact;
  const fuzzy = collections.find((c) => /theme|semantic/i.test(c.name));
  if (fuzzy) return fuzzy;
  return (
    collections.find(
      (c) =>
        c.modes.some((m) => /^light/i.test(m.name.trim())) &&
        c.modes.some((m) => /^dark/i.test(m.name.trim()))
    ) || null
  );
  });
}

// ── Find the base/primitives collection for alias resolution ──────────────────
function findPrimitivesCollection(themeCollId) {
  return resolveCollectionByLogicalKey('primitives', collections, registryIds, function () {
  const exact = collections.find((c) => c.name === 'Primitives' && c.id !== themeCollId);
  if (exact) return exact;
  const fuzzy = collections.find((c) =>
    /primitiv|core|foundation|base/i.test(c.name) && c.id !== themeCollId
  );
  if (fuzzy) return fuzzy;
  const candidates = collections
    .filter((c) => c.id !== themeCollId && c.modes.length === 1)
    .map((c) => ({
      c,
      colorCount: allVars.filter((v) => v.variableCollectionId === c.id && v.resolvedType === 'COLOR').length,
    }))
    .sort((a, b) => b.colorCount - a.colorCount);
  return candidates[0]?.c || null;
  });
}

const themeColl = findThemeCollection();
if (!themeColl) {
  throw new Error(
    'No Theme-like collection found. Available: ' + collections.map((c) => c.name).join(', ')
  );
}
const primColl = findPrimitivesCollection(themeColl.id);

const themeLightModeId = (
  themeColl.modes.find((m) => /^light/i.test(m.name.trim())) || themeColl.modes[0]
).modeId;
const themeDarkModeId = (
  themeColl.modes.find((m) => /^dark/i.test(m.name.trim())) ||
  themeColl.modes[1] ||
  themeColl.modes[0]
).modeId;
const primModeId = primColl ? primColl.modes[0].modeId : themeLightModeId;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Returns CSS HSL string; appends "/ alpha%" for RGBA tokens (e.g. state-layer overlays).
function colorToHsl(c) {
  if (!c) return null;
  const r = c.r, g = c.g, b = c.b, a = (c.a !== undefined && c.a < 0.9999) ? c.a : 1;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const hD = Math.round(h * 360), sP = Math.round(s * 100), lP = Math.round(l * 100);
  if (a < 0.9999) return `hsl(${hD} ${sP}% ${lP}% / ${Math.round(a * 100)}%)`;
  return `hsl(${hD} ${sP}% ${lP}%)`;
}

// Resolves a variable alias chain and returns both hex and HSL representations.
// HSL is non-null only when the resolved value has a meaningful alpha (state overlays, scrims).
async function resolveColorFormats(varId, themeModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = themeModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return { hex: '#000000', hsl: null };
    if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = collections.find((c) => c.id === next.variableCollectionId);
      if (nextColl?.id === primColl?.id) m = primModeId;
      else if (nextColl?.id === themeColl.id) m = themeModeId;
      else m = nextColl ? nextColl.modes[0].modeId : m;
      v = next;
      continue;
    }
    if (typeof val === 'object' && typeof val.r === 'number') {
      return { hex: colorToHex(val), hsl: colorToHsl(val) };
    }
    return { hex: '#000000', hsl: null };
  }
  return { hex: '#000000', hsl: null };
}

async function resolveFirstAlias(varId, themeModeId) {
  const v = await figma.variables.getVariableByIdAsync(varId);
  const val = v.valuesByMode[themeModeId];
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    try {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      return next?.name || null;
    } catch (_) { return null; }
  }
  return null;
}

function readCS(v) {
  const cs = v.codeSyntax || {};
  return { WEB: String(cs.WEB || ''), ANDROID: String(cs.ANDROID || ''), iOS: String(cs.iOS || cs.IOS || '') };
}

// Canonical codeSyntax for rawLiteral Theme variables that earlier push paths
// (Step 11 REST batch, /sync-design-system Step 6.C/6.R, manual variable adds)
// may have skipped. Source of truth: skills/create-design-system/data/theme-aliases.json
// rawLiterals + 02b-theme-codesyntax.md derivation rules. Keep this map in sync.
const RAW_LITERAL_CODESYNTAX = {
  'color/background/scrim':  { WEB: 'var(--color-scrim)',        ANDROID: 'scrim',  iOS: '.Effect.scrim' },
  'color/background/shadow': { WEB: 'var(--color-shadow-tint)',  ANDROID: 'shadow', iOS: '.Background.shadow.tint' },
};

// State variables follow color/state/on-{role}/{state} or color/state/on-surface/{state}
// M3-strict derivation per 02b-theme-codesyntax.md:
//   WEB:     var(--color-state-on-{role-kebab}-{state})
//   ANDROID: on-{role-kebab}-hover     (hover)
//            on-{role-kebab}-ripple    (pressed — Android ripple drawable)
//            on-{role-kebab}-focus     (focus)
//   iOS:     .State.on{Role}.{state}   (PascalCase role, e.g. onPrimary, onSurface)
function deriveStateCodeSyntax(name) {
  const m = /^color\/state\/(on-(?:primary|secondary|tertiary|error|surface))\/(hover|pressed|focus)$/.exec(name);
  if (!m) return null;
  const role = m[1], state = m[2];
  const roleKebab = role; // already kebab: on-primary, on-secondary, etc.
  const rolePascal = role.replace(/^on-/, 'on').replace(/^on(.)/, function(_, c) { return 'on' + c.toUpperCase(); })
    .replace(/-([a-z])/, function(_, c) { return c.toUpperCase(); });
  const androidState = state === 'pressed' ? 'ripple' : state;
  return {
    WEB: 'var(--color-state-' + roleKebab + '-' + state + ')',
    ANDROID: roleKebab + '-' + androidState,
    iOS: '.State.' + rolePascal + '.' + state,
  };
}

async function ensureCodeSyntax(v) {
  const cs = v.codeSyntax || {};
  const hasAll = cs.WEB && cs.ANDROID && (cs.iOS || cs.IOS);
  if (hasAll) return cs;
  const derived = RAW_LITERAL_CODESYNTAX[v.name] || deriveStateCodeSyntax(v.name) || null;
  if (!derived) return cs;
  const next = {
    WEB: cs.WEB || derived.WEB,
    ANDROID: cs.ANDROID || derived.ANDROID,
    iOS: (cs.iOS || cs.IOS) || derived.iOS,
  };
  try {
    if (!cs.WEB)              v.setVariableCodeSyntax('WEB',     next.WEB);
    if (!cs.ANDROID)          v.setVariableCodeSyntax('ANDROID', next.ANDROID);
    if (!(cs.iOS || cs.IOS))  v.setVariableCodeSyntax('iOS',     next.iOS);
  } catch (_) {}
  return next;
}

// All COLOR vars from this collection only, grouped by semantic role segment.
// Theme variable names follow the pattern color/{role}/{variant} (e.g. color/primary/default).
// We group by the second segment (the role) so Background, Border, Primary, etc. each get
// their own table. Non-color-prefixed variables fall back to first segment as the group key.
const themeVars = allVars.filter(
  (v) => v.variableCollectionId === themeColl.id && v.resolvedType === 'COLOR'
);
const groupOrder = [];
const groupMap = {};
for (const v of themeVars) {
  const segs = v.name.split('/');
  const groupKey = (segs[0] === 'color' && segs.length >= 3) ? segs[1] : segs[0];
  if (!groupMap[groupKey]) { groupMap[groupKey] = []; groupOrder.push(groupKey); }
  groupMap[groupKey].push(v);
}

let codeSyntaxHealed = 0;
const allRows = {};
for (const group of groupOrder) {
  allRows[group] = [];
  for (const v of groupMap[group]) {
    const beforeCs = v.codeSyntax || {};
    const beforeKey = String(beforeCs.WEB || '') + '|' + String(beforeCs.ANDROID || '') + '|' + String(beforeCs.iOS || beforeCs.IOS || '');
    const healed = await ensureCodeSyntax(v);
    const afterKey = String(healed.WEB || '') + '|' + String(healed.ANDROID || '') + '|' + String(healed.iOS || healed.IOS || '');
    if (beforeKey !== afterKey) codeSyntaxHealed++;
    const lightFmts = await resolveColorFormats(v.id, themeLightModeId);
    const darkFmts  = await resolveColorFormats(v.id, themeDarkModeId);
    const aliasLight = await resolveFirstAlias(v.id, themeLightModeId);
    const aliasDark  = await resolveFirstAlias(v.id, themeDarkModeId);
    allRows[group].push({
      tokenPath: v.name,
      resolvedHexLight: lightFmts.hex, resolvedHexDark: darkFmts.hex,
      resolvedHslLight: lightFmts.hsl, resolvedHslDark: darkFmts.hsl,
      aliasLight, aliasDark,
      codeSyntax: { WEB: String(healed.WEB || ''), ANDROID: String(healed.ANDROID || ''), iOS: String(healed.iOS || healed.IOS || '') },
    });
  }
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === '_Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === '_Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === '_Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === '_Doc/Caption')?.id   || null,
};

const themePage =
  findDesignOpsPage('theme', {
    legacyExact: ['↳ Theme'],
    legacyRegex: [/^↳?\s*theme/i],
  }) || null;
if (!themePage || themePage.type !== 'PAGE') {
  throw new Error(
    'Page not found (expected ↳ Theme / slug theme). Pages: ' +
      figma.root.children.filter((c) => c.type === 'PAGE').map((c) => c.name).join(' | ')
  );
}

const ctx = {
  pageId: themePage.id, docStyles,
  themeCollectionId: themeColl.id,
  themeLightModeId, themeDarkModeId,
  rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return {
  ok: true, step: '15b-theme', pageId: themePage.id,
  collection: themeColl.name, tableGroups, pageName: themePage.name,
  codeSyntaxHealed,
};
