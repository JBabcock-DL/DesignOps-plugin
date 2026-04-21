// Concatenate after _lib.js + effects.js (phase 07). Resolves Effects rows in-plugin; ctx omits variableMap.
const EFFECTS_DATA = {
  color: {
    path: 'shadow/color',
    light: { r: 0, g: 0, b: 0, a: 0.10 },
    dark:  { r: 0, g: 0, b: 0, a: 0.30 },
    codeSyntax: { WEB: 'var(--shadow-color)', ANDROID: 'shadow', iOS: '.Effect.shadow.color' },
  },
  blurs: [
    { path: 'shadow/sm/blur',  tier: 'sm',  alias: 'elevation/100',  codeSyntax: { WEB: 'var(--shadow-sm-blur)',  ANDROID: 'shadow-sm-blur',  iOS: '.Effect.shadow.sm.blur' } },
    { path: 'shadow/md/blur',  tier: 'md',  alias: 'elevation/200',  codeSyntax: { WEB: 'var(--shadow-md-blur)',  ANDROID: 'shadow-md-blur',  iOS: '.Effect.shadow.md.blur' } },
    { path: 'shadow/lg/blur',  tier: 'lg',  alias: 'elevation/400',  codeSyntax: { WEB: 'var(--shadow-lg-blur)',  ANDROID: 'shadow-lg-blur',  iOS: '.Effect.shadow.lg.blur' } },
    { path: 'shadow/xl/blur',  tier: 'xl',  alias: 'elevation/800',  codeSyntax: { WEB: 'var(--shadow-xl-blur)',  ANDROID: 'shadow-xl-blur',  iOS: '.Effect.shadow.xl.blur' } },
    { path: 'shadow/2xl/blur', tier: '2xl', alias: 'elevation/1600', codeSyntax: { WEB: 'var(--shadow-2xl-blur)', ANDROID: 'shadow-2xl-blur', iOS: '.Effect.shadow.2xl.blur' } },
  ],
};

const allVars = await figma.variables.getLocalVariablesAsync();
const byName = Object.fromEntries(allVars.map((v) => [v.name, v]));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const effectsColl = collections.find((c) => c.name === 'Effects');
const primColl = collections.find((c) => c.name === 'Primitives');
const themeColl = collections.find((c) => c.name === 'Theme');
if (!effectsColl) throw new Error('Effects collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const effectsLightModeId = (effectsColl.modes.find((m) => m.name === 'Light') || effectsColl.modes[0]).modeId;
const effectsDarkModeId  = (effectsColl.modes.find((m) => m.name === 'Dark')  || effectsColl.modes[1] || effectsColl.modes[0]).modeId;
const primModeId = primColl.modes[0].modeId;
const themeLightModeId = themeColl ? ((themeColl.modes.find((m) => m.name === 'Light') || themeColl.modes[0]).modeId) : null;
const themeDarkModeId  = themeColl ? ((themeColl.modes.find((m) => m.name === 'Dark')  || themeColl.modes[1] || themeColl.modes[0]).modeId) : null;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolvePx(varId, startModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = startModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return 0;
    // Figma Plugin API: FLOAT variables store a raw JS number in valuesByMode; aliases are
    // { type: 'VARIABLE_ALIAS', id }. Old guard `val.type === 'FLOAT' ? val.value : 0` returned 0
    // for every numeric token (same failure mode as Theme hex resolver — see _step15b).
    if (typeof val === 'object' && val !== null && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      if (next.variableCollectionId === primColl.id) m = primModeId;
      else if (next.variableCollectionId === effectsColl.id) m = startModeId;
      else m = (await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId)).modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'number') return val;
    return 0;
  }
  return 0;
}

const shadows = [];
for (const b of EFFECTS_DATA.blurs) {
  const v = byName[b.path];
  if (!v) continue;
  const px = await resolvePx(v.id, effectsLightModeId);
  shadows.push({
    tokenPath: b.path,
    tier: b.tier,
    blurPx: px,
    aliasPath: b.alias,
    codeSyntax: b.codeSyntax,
  });
}

const shadowColor = [];
{
  const c = EFFECTS_DATA.color;
  const cv = byName[c.path];
  shadowColor.push({
    tokenPath: c.path,
    themeVariableId: cv ? cv.id : null,
    resolvedHexLight: colorToHex(c.light),
    resolvedHexDark:  colorToHex(c.dark),
    rgbaLight: 'rgba(0,0,0,' + c.light.a + ')',
    rgbaDark:  'rgba(0,0,0,' + c.dark.a  + ')',
    codeSyntax: c.codeSyntax,
  });
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const effectsPage = figma.root.children.find((pg) => pg.name === '\u21B3 Effects');
if (!effectsPage || effectsPage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Effects)');
}

const ctx = {
  pageId: effectsPage.id,
  docStyles,
  effectsCollectionId: effectsColl.id,
  effectsLightModeId,
  effectsDarkModeId,
  themeCollectionId: themeColl ? themeColl.id : null,
  themeLightModeId,
  themeDarkModeId,
  rows: { shadows, shadowColor },
};
await build(ctx);
const tableGroups = effectsPage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15c-effects', pageId: effectsPage.id, tableGroups, pageName: effectsPage.name };
