// Concatenate after _lib.js + theme.js (phase 07). Resolves Theme rows in-plugin; ctx omits variableMap.
const THEME_DATA = {
  rows: [
    { path: 'color/background/dim',                light: 'color/neutral/100', dark: 'color/neutral/950', codeSyntax: { WEB: 'var(--color-background-dim)',              ANDROID: 'surface-dim',                 iOS: '.Background.dim' } },
    { path: 'color/background/default',            light: 'color/neutral/50',  dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-background)',                  ANDROID: 'surface',                     iOS: '.Background.default' } },
    { path: 'color/background/bright',             light: 'color/neutral/50',  dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-bright)',           ANDROID: 'surface-bright',              iOS: '.Background.bright' } },
    { path: 'color/background/container-lowest',   light: 'color/neutral/50',  dark: 'color/neutral/950', codeSyntax: { WEB: 'var(--color-background-container-lowest)', ANDROID: 'surface-container-lowest',    iOS: '.Background.lowest' } },
    { path: 'color/background/container-low',      light: 'color/neutral/100', dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-background-container-low)',    ANDROID: 'surface-container-low',       iOS: '.Background.low' } },
    { path: 'color/background/container',          light: 'color/neutral/200', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-container)',        ANDROID: 'surface-container',           iOS: '.Background.mid' } },
    { path: 'color/background/container-high',     light: 'color/neutral/300', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-background-container-high)',   ANDROID: 'surface-container-high',      iOS: '.Background.high' } },
    { path: 'color/background/container-highest',  light: 'color/neutral/50',  dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-container-highest)',ANDROID: 'surface-container-highest',   iOS: '.Background.highest' } },
    { path: 'color/background/variant',            light: 'color/neutral/100', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-background-variant)',          ANDROID: 'surface-variant',             iOS: '.Background.variant' } },
    { path: 'color/background/content',            light: 'color/neutral/900', dark: 'color/neutral/50',  codeSyntax: { WEB: 'var(--color-content)',                     ANDROID: 'on-surface',                  iOS: '.Foreground.primary' } },
    { path: 'color/background/content-muted',      light: 'color/neutral/500', dark: 'color/neutral/400', codeSyntax: { WEB: 'var(--color-content-muted)',               ANDROID: 'on-surface-variant',          iOS: '.Foreground.secondary' } },
    { path: 'color/background/inverse',            light: 'color/neutral/950', dark: 'color/neutral/50',  codeSyntax: { WEB: 'var(--color-inverse-surface)',             ANDROID: 'inverse-surface',             iOS: '.Background.inverse' } },
    { path: 'color/background/inverse-content',    light: 'color/neutral/50',  dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-inverse-content)',             ANDROID: 'inverse-on-surface',          iOS: '.Foreground.inverse' } },
    { path: 'color/background/inverse-primary',    light: 'color/primary/300', dark: 'color/primary/700', codeSyntax: { WEB: 'var(--color-inverse-brand)',               ANDROID: 'inverse-primary',             iOS: '.Primary.inverse' } },
    { path: 'color/border/default',                light: 'color/neutral/200', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-border)',                      ANDROID: 'outline',                     iOS: '.Border.default' } },
    { path: 'color/border/subtle',                 light: 'color/neutral/100', dark: 'color/neutral/800', codeSyntax: { WEB: 'var(--color-border-subtle)',               ANDROID: 'outline-variant',             iOS: '.Border.subtle' } },
    { path: 'color/primary/default',               light: 'color/primary/500', dark: 'color/primary/400', codeSyntax: { WEB: 'var(--color-primary)',                     ANDROID: 'primary',                     iOS: '.Primary.default' } },
    { path: 'color/primary/content',               light: 'color/primary/50',  dark: 'color/primary/50',  codeSyntax: { WEB: 'var(--color-on-primary)',                  ANDROID: 'on-primary',                  iOS: '.Primary.on' } },
    { path: 'color/primary/subtle',                light: 'color/primary/100', dark: 'color/primary/800', codeSyntax: { WEB: 'var(--color-primary-subtle)',              ANDROID: 'primary-container',           iOS: '.Primary.subtle' } },
    { path: 'color/primary/on-subtle',             light: 'color/primary/900', dark: 'color/primary/100', codeSyntax: { WEB: 'var(--color-on-primary-subtle)',           ANDROID: 'on-primary-container',        iOS: '.Primary.on.subtle' } },
    { path: 'color/primary/fixed',                 light: 'color/primary/100', dark: 'color/primary/300', codeSyntax: { WEB: 'var(--color-primary-fixed)',               ANDROID: 'primary-fixed',               iOS: '.Primary.fixed' } },
    { path: 'color/primary/fixed-dim',             light: 'color/primary/200', dark: 'color/primary/800', codeSyntax: { WEB: 'var(--color-primary-fixed-dim)',           ANDROID: 'primary-fixed-dim',           iOS: '.Primary.fixed.dim' } },
    { path: 'color/primary/on-fixed',              light: 'color/primary/900', dark: 'color/primary/100', codeSyntax: { WEB: 'var(--color-on-primary-fixed)',            ANDROID: 'on-primary-fixed',            iOS: '.Primary.on.fixed' } },
    { path: 'color/primary/on-fixed-variant',      light: 'color/primary/800', dark: 'color/primary/200', codeSyntax: { WEB: 'var(--color-on-primary-fixed-muted)',      ANDROID: 'on-primary-fixed-variant',    iOS: '.Primary.on.fixed.muted' } },
    { path: 'color/secondary/default',             light: 'color/secondary/500', dark: 'color/secondary/400', codeSyntax: { WEB: 'var(--color-secondary)',              ANDROID: 'secondary',                  iOS: '.Secondary.default' } },
    { path: 'color/secondary/content',             light: 'color/secondary/50',  dark: 'color/secondary/50',  codeSyntax: { WEB: 'var(--color-on-secondary)',           ANDROID: 'on-secondary',               iOS: '.Secondary.on' } },
    { path: 'color/secondary/subtle',              light: 'color/secondary/100', dark: 'color/secondary/800', codeSyntax: { WEB: 'var(--color-secondary-subtle)',       ANDROID: 'secondary-container',        iOS: '.Secondary.subtle' } },
    { path: 'color/secondary/on-subtle',           light: 'color/secondary/900', dark: 'color/secondary/100', codeSyntax: { WEB: 'var(--color-on-secondary-subtle)',    ANDROID: 'on-secondary-container',     iOS: '.Secondary.on.subtle' } },
    { path: 'color/secondary/fixed',               light: 'color/secondary/100', dark: 'color/secondary/300', codeSyntax: { WEB: 'var(--color-secondary-fixed)',        ANDROID: 'secondary-fixed',            iOS: '.Secondary.fixed' } },
    { path: 'color/secondary/fixed-dim',           light: 'color/secondary/200', dark: 'color/secondary/800', codeSyntax: { WEB: 'var(--color-secondary-fixed-dim)',    ANDROID: 'secondary-fixed-dim',        iOS: '.Secondary.fixed.dim' } },
    { path: 'color/secondary/on-fixed',            light: 'color/secondary/900', dark: 'color/secondary/100', codeSyntax: { WEB: 'var(--color-on-secondary-fixed)',     ANDROID: 'on-secondary-fixed',         iOS: '.Secondary.on.fixed' } },
    { path: 'color/secondary/on-fixed-variant',    light: 'color/secondary/800', dark: 'color/secondary/200', codeSyntax: { WEB: 'var(--color-on-secondary-fixed-muted)',ANDROID: 'on-secondary-fixed-variant',iOS: '.Secondary.on.fixed.muted' } },
    { path: 'color/tertiary/default',              light: 'color/tertiary/500', dark: 'color/tertiary/400', codeSyntax: { WEB: 'var(--color-accent)',                   ANDROID: 'tertiary',                   iOS: '.Tertiary.default' } },
    { path: 'color/tertiary/content',              light: 'color/tertiary/50',  dark: 'color/tertiary/50',  codeSyntax: { WEB: 'var(--color-on-accent)',                ANDROID: 'on-tertiary',                iOS: '.Tertiary.on' } },
    { path: 'color/tertiary/subtle',               light: 'color/tertiary/100', dark: 'color/tertiary/800', codeSyntax: { WEB: 'var(--color-accent-subtle)',            ANDROID: 'tertiary-container',         iOS: '.Tertiary.subtle' } },
    { path: 'color/tertiary/on-subtle',            light: 'color/tertiary/900', dark: 'color/tertiary/100', codeSyntax: { WEB: 'var(--color-on-accent-subtle)',         ANDROID: 'on-tertiary-container',      iOS: '.Tertiary.on.subtle' } },
    { path: 'color/tertiary/fixed',                light: 'color/tertiary/100', dark: 'color/tertiary/300', codeSyntax: { WEB: 'var(--color-accent-fixed)',             ANDROID: 'tertiary-fixed',             iOS: '.Tertiary.fixed' } },
    { path: 'color/tertiary/fixed-dim',            light: 'color/tertiary/200', dark: 'color/tertiary/800', codeSyntax: { WEB: 'var(--color-accent-fixed-dim)',         ANDROID: 'tertiary-fixed-dim',         iOS: '.Tertiary.fixed.dim' } },
    { path: 'color/tertiary/on-fixed',             light: 'color/tertiary/900', dark: 'color/tertiary/100', codeSyntax: { WEB: 'var(--color-on-accent-fixed)',          ANDROID: 'on-tertiary-fixed',          iOS: '.Tertiary.on.fixed' } },
    { path: 'color/tertiary/on-fixed-variant',     light: 'color/tertiary/800', dark: 'color/tertiary/200', codeSyntax: { WEB: 'var(--color-on-accent-fixed-muted)',    ANDROID: 'on-tertiary-fixed-variant',  iOS: '.Tertiary.on.fixed.muted' } },
    { path: 'color/error/default',                 light: 'color/error/600', dark: 'color/error/400', codeSyntax: { WEB: 'var(--color-danger)',                         ANDROID: 'error',                       iOS: '.Status.error' } },
    { path: 'color/error/content',                 light: 'color/error/50',  dark: 'color/error/50',  codeSyntax: { WEB: 'var(--color-on-danger)',                      ANDROID: 'on-error',                    iOS: '.Status.on.error' } },
    { path: 'color/error/subtle',                  light: 'color/error/100', dark: 'color/error/900', codeSyntax: { WEB: 'var(--color-danger-subtle)',                  ANDROID: 'error-container',             iOS: '.Status.error.subtle' } },
    { path: 'color/error/on-subtle',               light: 'color/error/900', dark: 'color/error/100', codeSyntax: { WEB: 'var(--color-on-danger-subtle)',               ANDROID: 'on-error-container',          iOS: '.Status.on.error.subtle' } },
    { path: 'color/error/fixed',                   light: 'color/error/100', dark: 'color/error/300', codeSyntax: { WEB: 'var(--color-danger-fixed)',                   ANDROID: 'error-fixed',                 iOS: '.Status.error.fixed' } },
    { path: 'color/error/fixed-dim',               light: 'color/error/200', dark: 'color/error/800', codeSyntax: { WEB: 'var(--color-danger-fixed-dim)',               ANDROID: 'error-fixed-dim',             iOS: '.Status.error.fixed.dim' } },
    { path: 'color/error/on-fixed',                light: 'color/error/900', dark: 'color/error/100', codeSyntax: { WEB: 'var(--color-on-danger-fixed)',                ANDROID: 'on-error-fixed',              iOS: '.Status.on.error.fixed' } },
    { path: 'color/error/on-fixed-variant',        light: 'color/error/800', dark: 'color/error/200', codeSyntax: { WEB: 'var(--color-on-danger-fixed-muted)',          ANDROID: 'on-error-fixed-variant',      iOS: '.Status.on.error.fixed.muted' } },
    { path: 'color/component/input',               light: 'color/neutral/200', dark: 'color/neutral/700', codeSyntax: { WEB: 'var(--color-field)',                    ANDROID: 'input',                       iOS: '.Component.field' } },
    { path: 'color/component/ring',                light: 'color/primary/500', dark: 'color/primary/400', codeSyntax: { WEB: 'var(--color-focus-ring)',               ANDROID: 'ring',                        iOS: '.Component.ring' } },
    { path: 'color/component/sidebar',             light: 'color/neutral/100', dark: 'color/neutral/900', codeSyntax: { WEB: 'var(--color-sidebar)',                  ANDROID: 'sidebar',                     iOS: '.Component.sidebar' } },
    { path: 'color/component/sidebar-content',     light: 'color/neutral/900', dark: 'color/neutral/100', codeSyntax: { WEB: 'var(--color-on-sidebar)',               ANDROID: 'sidebar-foreground',          iOS: '.Component.sidebar.on' } },
  ],
  rawLiterals: [
    { path: 'color/background/scrim',  light: { r: 0, g: 0, b: 0, a: 0.32 }, dark: { r: 0, g: 0, b: 0, a: 0.32 }, codeSyntax: { WEB: 'var(--color-scrim)',        ANDROID: 'scrim',  iOS: '.Effect.scrim' } },
    { path: 'color/background/shadow', light: { r: 0, g: 0, b: 0, a: 0.15 }, dark: { r: 0, g: 0, b: 0, a: 0.40 }, codeSyntax: { WEB: 'var(--color-shadow-tint)', ANDROID: 'shadow', iOS: '.Background.shadow.tint' } },
  ],
  groupOrder: ['background', 'border', 'primary', 'secondary', 'tertiary', 'error', 'component'],
};

const allVars = await figma.variables.getLocalVariablesAsync();
const byName = Object.fromEntries(allVars.map((v) => [v.name, v]));

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const themeColl = collections.find((c) => c.name === 'Theme');
const primColl = collections.find((c) => c.name === 'Primitives');
if (!themeColl) throw new Error('Theme collection missing');
if (!primColl) throw new Error('Primitives collection missing');
const themeLightModeId = (themeColl.modes.find((m) => m.name === 'Light') || themeColl.modes[0]).modeId;
const themeDarkModeId  = (themeColl.modes.find((m) => m.name === 'Dark')  || themeColl.modes[1] || themeColl.modes[0]).modeId;
const primModeId = primColl.modes[0].modeId;

function colorToHex(c) {
  if (!c) return '#000000';
  const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function resolveHex(varId, themeModeId) {
  let v = await figma.variables.getVariableByIdAsync(varId);
  let m = themeModeId;
  for (let d = 0; d < 10; d++) {
    const val = v.valuesByMode[m];
    if (val == null) return '#000000';
    // Figma Plugin API: Variable.valuesByMode returns raw RGB/RGBA objects for color variables
    // (no `type` field) or `{ type: 'VARIABLE_ALIAS', id }` for aliases. The old `val.type === 'COLOR'`
    // guard always failed for RGB values, so every Theme hex collapsed to '#000000'.
    if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      const nextColl = await figma.variables.getVariableCollectionByIdAsync(next.variableCollectionId);
      if (nextColl.id === primColl.id) m = primModeId;
      else if (nextColl.id === themeColl.id) m = themeModeId;
      else m = nextColl.modes[0].modeId;
      v = next;
      continue;
    }
    if (typeof val === 'object' && typeof val.r === 'number') return colorToHex(val);
    return '#000000';
  }
  return '#000000';
}

const allRows = {};
for (const k of THEME_DATA.groupOrder) allRows[k] = [];

for (const r of THEME_DATA.rows) {
  const v = byName[r.path];
  if (!v) continue;
  const light = await resolveHex(v.id, themeLightModeId);
  const dark  = await resolveHex(v.id, themeDarkModeId);
  const group = r.path.split('/')[1];
  if (allRows[group]) {
    allRows[group].push({
      tokenPath: r.path,
      resolvedHexLight: light,
      resolvedHexDark: dark,
      aliasLight: r.light,
      aliasDark: r.dark,
      codeSyntax: r.codeSyntax,
    });
  }
}

for (const r of THEME_DATA.rawLiterals) {
  allRows.background.push({
    tokenPath: r.path,
    resolvedHexLight: colorToHex(r.light),
    resolvedHexDark: colorToHex(r.dark),
    aliasLight: 'rgba(0,0,0,' + r.light.a + ')',
    aliasDark:  'rgba(0,0,0,' + r.dark.a  + ')',
    codeSyntax: r.codeSyntax,
    themeVariableId: null,
  });
}

const textStyles = await figma.getLocalTextStylesAsync();
const docStyles = {
  Section:   textStyles.find((s) => s.name === 'Doc/Section')?.id   || null,
  TokenName: textStyles.find((s) => s.name === 'Doc/TokenName')?.id || null,
  Code:      textStyles.find((s) => s.name === 'Doc/Code')?.id      || null,
  Caption:   textStyles.find((s) => s.name === 'Doc/Caption')?.id   || null,
};

const themePage = figma.root.children.find((pg) => pg.name === '\u21B3 Theme');
if (!themePage || themePage.type !== 'PAGE') {
  throw new Error('Page not found (expected \\u21B3 Theme)');
}

const ctx = {
  pageId: themePage.id,
  docStyles,
  themeCollectionId: themeColl.id,
  themeLightModeId,
  themeDarkModeId,
  rows: allRows,
};
await build(ctx);
const tableGroups = themePage.findAll((n) => n.name && n.name.startsWith('doc/table-group/')).length;
return { ok: true, step: '15b-theme', pageId: themePage.id, tableGroups, pageName: themePage.name };
