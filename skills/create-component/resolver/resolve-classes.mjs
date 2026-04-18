#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// resolve-classes.mjs
//
// Resolves a Tailwind className string (as emitted by a shadcn cva() variant)
// into Figma variable bindings using the user's `tokens.css`.
//
// Usage:
//   node resolve-classes.mjs <tokens.css path> <classString>
//   node resolve-classes.mjs <tokens.css path> -        # read classString from stdin
//
// Output (stdout, JSON):
//   {
//     fills:      [{ tailwindClass, state, token }, ...],   // token = Figma var path, e.g. "color/primary/default"
//     strokes:    [...],
//     radii:      [{ tailwindClass, state, token, px }, ...],
//     spacing:    [{ tailwindClass, state, property, px, tokenHint }, ...],
//     typography: [{ tailwindClass, state, token }, ...],
//     effects:    [{ tailwindClass, state, kind, details }, ...],
//     layout:     [{ tailwindClass, state, prop, value }, ...],
//     unresolved: [{ tailwindClass, reason }, ...],
//   }
//
// Resolution pipeline for color/border/ring utilities:
//   1. Tokenize class string on whitespace, splitting off state prefixes
//      (hover:, focus-visible:, disabled:, dark:, data-[state=open]:, …).
//   2. Match the utility head (`bg-`, `text-`, `border-`, `ring-`, …) and
//      extract the shadcn alias name (e.g. `primary`, `destructive`,
//      `primary-foreground`).
//   3. Resolve the alias to its CSS leaf by following `var()` chains in
//      tokens.css (e.g. --primary → var(--color-primary) → leaf
//      "color-primary").
//   4. Look up the leaf in LEAF_TO_FIGMA (built from the create-design-system
//      tables) to get the Figma variable path
//      (e.g. "color/primary/default").
//
// For spacing/sizing utilities (`h-`, `w-`, `px-`, `py-`, `gap-`, `m-`, …),
// we emit the px value plus a heuristic t-shirt token hint (`space/lg` etc.)
// that the skill can match against the user's Layout collection. The raw px
// is always included so the caller can fall back to nearest-match.
// ──────────────────────────────────────────────────────────────────────────────

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

// ── Leaf (tokens.css primitive name) → Figma variable path ───────────────────
// Built from skills/create-design-system/SKILL.md §Theme + §Layout tables.
// Keep synchronized with that source-of-truth table when new semantic roles
// are added there.
const LEAF_TO_FIGMA = {
  // Background roles
  'color-background': 'color/background/default',
  'color-background-dim': 'color/background/dim',
  'color-background-bright': 'color/background/bright',
  'color-background-container-lowest': 'color/background/container-lowest',
  'color-background-container-low': 'color/background/container-low',
  'color-background-container': 'color/background/container',
  'color-background-container-high': 'color/background/container-high',
  'color-background-container-highest': 'color/background/container-highest',
  'color-background-variant': 'color/background/variant',
  'color-content': 'color/background/content',
  'color-content-muted': 'color/background/content-muted',
  'color-inverse-surface': 'color/background/inverse',
  'color-inverse-content': 'color/background/inverse-content',
  'color-inverse-brand': 'color/background/inverse-primary',
  'color-scrim': 'color/background/scrim',
  'color-shadow-tint': 'color/background/shadow',

  // Border roles
  'color-border': 'color/border/default',
  'color-border-subtle': 'color/border/subtle',

  // Primary
  'color-primary': 'color/primary/default',
  'color-on-primary': 'color/primary/content',
  'color-primary-subtle': 'color/primary/subtle',
  'color-on-primary-subtle': 'color/primary/on-subtle',
  'color-primary-fixed': 'color/primary/fixed',
  'color-primary-fixed-dim': 'color/primary/fixed-dim',
  'color-on-primary-fixed': 'color/primary/on-fixed',
  'color-on-primary-fixed-muted': 'color/primary/on-fixed-variant',

  // Secondary
  'color-secondary': 'color/secondary/default',
  'color-on-secondary': 'color/secondary/content',
  'color-secondary-subtle': 'color/secondary/subtle',
  'color-on-secondary-subtle': 'color/secondary/on-subtle',
  'color-secondary-fixed': 'color/secondary/fixed',
  'color-secondary-fixed-dim': 'color/secondary/fixed-dim',
  'color-on-secondary-fixed': 'color/secondary/on-fixed',
  'color-on-secondary-fixed-muted': 'color/secondary/on-fixed-variant',

  // Tertiary (shadcn calls this "accent")
  'color-accent': 'color/tertiary/default',
  'color-on-accent': 'color/tertiary/content',
  'color-accent-subtle': 'color/tertiary/subtle',
  'color-on-accent-subtle': 'color/tertiary/on-subtle',
  'color-accent-fixed': 'color/tertiary/fixed',
  'color-accent-fixed-dim': 'color/tertiary/fixed-dim',
  'color-on-accent-fixed': 'color/tertiary/on-fixed',
  'color-on-accent-fixed-muted': 'color/tertiary/on-fixed-variant',

  // Error (shadcn calls this "destructive"/"danger")
  'color-danger': 'color/error/default',
  'color-on-danger': 'color/error/content',
  'color-danger-subtle': 'color/error/subtle',
  'color-on-danger-subtle': 'color/error/on-subtle',
  'color-danger-fixed': 'color/error/fixed',
  'color-danger-fixed-dim': 'color/error/fixed-dim',
  'color-on-danger-fixed': 'color/error/on-fixed',
  'color-on-danger-fixed-muted': 'color/error/on-fixed-variant',

  // Component roles
  'color-field': 'color/component/input',
  'color-focus-ring': 'color/component/ring',
  'color-sidebar': 'color/component/sidebar',
  'color-on-sidebar': 'color/component/sidebar-content',

  // Layout — Corner primitives (exposed under both Primitive and Layout)
  'corner-none': 'radius/none',
  'corner-extra-small': 'radius/xs',
  'corner-small': 'radius/sm',
  'corner-medium': 'radius/md',
  'corner-large': 'radius/lg',
  'corner-extra-large': 'radius/xl',
  'corner-full': 'radius/full',

  // Layout — radius aliases that were set up as their own CSS vars
  'radius-none': 'radius/none',
  'radius-xs': 'radius/xs',
  'radius-sm': 'radius/sm',
  'radius-md': 'radius/md',
  'radius-lg': 'radius/lg',
  'radius-xl': 'radius/xl',
  'radius-full': 'radius/full',

  // Layout — space aliases (t-shirt)
  'space-xs': 'space/xs',
  'space-sm': 'space/sm',
  'space-md': 'space/md',
  'space-lg': 'space/lg',
  'space-xl': 'space/xl',
  'space-2xl': 'space/2xl',
  'space-3xl': 'space/3xl',
  'space-4xl': 'space/4xl',
};

// ── Tailwind numeric → px (n × 0.25rem = n × 4px) ─────────────────────────────
// Heuristic t-shirt hint assumes the user accepted the foundations defaults
// from create-design-system Step 12 (4/8/12/16/24/32/48/64 px). Always emits
// `px` so the caller can fall back to nearest-match if the tokens differ.
const SPACE_HINT_BY_PX = {
  4: 'space/xs',
  8: 'space/sm',
  12: 'space/md',
  16: 'space/lg',
  24: 'space/xl',
  32: 'space/2xl',
  48: 'space/3xl',
  64: 'space/4xl',
};

// ── Tailwind `rounded-*` → Layout radius token ───────────────────────────────
const ROUNDED_HINT = {
  'none': { token: 'radius/none', px: 0 },
  'sm': { token: 'radius/xs', px: 4 },
  '': { token: 'radius/sm', px: 6 },
  'md': { token: 'radius/md', px: 12 },
  'lg': { token: 'radius/lg', px: 16 },
  'xl': { token: 'radius/xl', px: 28 },
  '2xl': { token: 'radius/xl', px: 28 },
  '3xl': { token: 'radius/xl', px: 28 },
  'full': { token: 'radius/full', px: 9999 },
};

// ── Typography Tailwind → Figma slot ────────────────────────────────────────
// shadcn ships `text-sm`, `text-base`, `text-lg`, `font-medium`, etc. We map
// the size scale to the Typography M3 body/label slots that
// create-design-system publishes. The variant (italic, underline) is recorded
// but applied at the FontName / textDecoration level, not as a separate var.
const TEXT_SIZE_TO_TYPO = {
  'xs': 'Label/SM/default',
  'sm': 'Label/MD/default',
  'base': 'Body/MD/default',
  'lg': 'Body/LG/default',
  'xl': 'Title/SM/default',
  '2xl': 'Title/MD/default',
  '3xl': 'Title/LG/default',
  '4xl': 'Headline/SM/default',
  '5xl': 'Headline/MD/default',
  '6xl': 'Headline/LG/default',
  '7xl': 'Display/SM/default',
  '8xl': 'Display/MD/default',
  '9xl': 'Display/LG/default',
};

// ── State prefix detection ────────────────────────────────────────────────────
// Tailwind classes like `hover:bg-primary/90` carry one or more state
// prefixes separated by `:`. We strip them and record the earliest one as
// the primary state bucket. `dark:` is orthogonal — any `dark:` prefix flips
// state to "dark" but we only use it to annotate the binding; the same
// Figma variable already inherits light/dark from the Theme collection mode.
const STATE_PATTERNS = [
  'hover', 'focus', 'focus-visible', 'focus-within', 'active',
  'disabled', 'aria-disabled', 'aria-selected', 'aria-expanded',
  'data-[state=open]', 'data-[state=closed]', 'data-[state=checked]',
  'data-[state=unchecked]', 'data-[state=active]', 'data-[state=on]',
  'data-[state=off]', 'data-[disabled]',
  'group-hover', 'peer-disabled', 'peer-focus', 'peer-checked',
  'dark', 'motion-reduce', 'print', 'rtl', 'sm', 'md', 'lg', 'xl', '2xl',
  'first', 'last', 'placeholder',
];

function parsePrefixes(cls) {
  const parts = cls.split(':');
  const utility = parts.pop();
  const states = parts.filter(Boolean);
  let state = 'base';
  let dark = false;
  let responsive = null;
  for (const s of states) {
    if (s === 'dark') { dark = true; continue; }
    if (['sm', 'md', 'lg', 'xl', '2xl'].includes(s)) { responsive = s; continue; }
    if (state === 'base') state = s;
  }
  return { utility, state, dark, responsive, raw: cls };
}

// ── tokens.css parser ────────────────────────────────────────────────────────
// Builds two maps:
//   declarations: rawName → rawValue  (every --foo: bar; anywhere in the file)
//   aliasToLeaf:  shadcnAlias → leafVarName  (follows var(--...) chains)
async function parseTokensCss(tokensPath) {
  const src = await readFile(tokensPath, 'utf8');
  const declarations = Object.create(null);
  // Naive but sufficient for shadcn tokens.css: capture every --name: value;
  // declaration regardless of surrounding selector. tokens.css does not use
  // @container or @supports guards that would change meaning.
  for (const m of src.matchAll(/--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)) {
    // Prefer :root over .dark if both appear — :root wins by insertion order
    // here unless the dark block re-declares (which we want to keep separate).
    if (declarations[m[1]] === undefined) declarations[m[1]] = m[2].trim();
  }

  function follow(name, seen = new Set()) {
    if (seen.has(name)) return null;
    seen.add(name);
    const raw = declarations[name];
    if (raw == null) return name; // treat unknown as a leaf; LEAF_TO_FIGMA will miss-hit and flag unresolved
    const m = raw.match(/^var\(\s*--([A-Za-z0-9_-]+)\s*(?:,[^)]+)?\)\s*$/);
    if (!m) return name; // leaf — a color literal, calc(), etc.
    return follow(m[1], seen);
  }

  const aliasToLeaf = Object.create(null);
  for (const name of Object.keys(declarations)) {
    aliasToLeaf[name] = follow(name);
  }
  return { declarations, aliasToLeaf };
}

// Resolve a shadcn utility name (e.g. "primary", "destructive-foreground",
// "background") to a Figma variable path by chaining aliasToLeaf →
// LEAF_TO_FIGMA. Handles the two alias schemes shadcn uses:
//   - `{role}` (e.g. --primary, --background, --border)
//   - `{role}-foreground` (e.g. --primary-foreground → on-{role})
function resolveShadcnAlias(alias, aliasToLeaf) {
  const leaf = aliasToLeaf[alias];
  if (leaf && LEAF_TO_FIGMA[leaf]) {
    return { token: LEAF_TO_FIGMA[leaf], leaf, alias };
  }
  return { token: null, leaf: leaf ?? null, alias };
}

// ── Utility dispatch ─────────────────────────────────────────────────────────
function classify(parsed, aliasToLeaf, out) {
  const { utility, state, raw } = parsed;

  // bg-{alias}[/{opacity}]
  let m = utility.match(/^bg-([a-z][\w-]*)(?:\/(\d{1,3}))?$/i);
  if (m) {
    const alias = m[1];
    const opacity = m[2] != null ? Number(m[2]) / 100 : null;
    const r = resolveShadcnAlias(alias, aliasToLeaf);
    const bucket = { tailwindClass: raw, state, token: r.token, opacity };
    if (r.token) out.fills.push(bucket);
    else out.unresolved.push({ tailwindClass: raw, reason: `no leaf mapping for bg-${alias} (leaf=${r.leaf ?? 'unknown'})` });
    return;
  }

  // text-{alias} OR text-{size}
  m = utility.match(/^text-([a-z0-9][\w-]*)$/i);
  if (m) {
    const tok = m[1];
    if (TEXT_SIZE_TO_TYPO[tok]) {
      out.typography.push({ tailwindClass: raw, state, token: TEXT_SIZE_TO_TYPO[tok] });
      return;
    }
    const r = resolveShadcnAlias(tok, aliasToLeaf);
    if (r.token) { out.fills.push({ tailwindClass: raw, state, token: r.token, role: 'text' }); return; }
    out.unresolved.push({ tailwindClass: raw, reason: `text- token "${tok}" matched no size and no alias` });
    return;
  }

  // border-{alias} or plain `border` (default border color)
  if (utility === 'border') {
    const r = resolveShadcnAlias('border', aliasToLeaf);
    if (r.token) out.strokes.push({ tailwindClass: raw, state, token: r.token, weight: 1 });
    else out.unresolved.push({ tailwindClass: raw, reason: 'no --border alias in tokens.css' });
    return;
  }
  m = utility.match(/^border-([a-z][\w-]*)$/i);
  if (m) {
    const alias = m[1];
    // Width aliases: border-0, border-2, border-4, border-8
    if (/^\d+$/.test(alias)) { out.strokes.push({ tailwindClass: raw, state, token: null, weight: Number(alias) }); return; }
    const r = resolveShadcnAlias(alias, aliasToLeaf);
    if (r.token) { out.strokes.push({ tailwindClass: raw, state, token: r.token, weight: 1 }); return; }
    out.unresolved.push({ tailwindClass: raw, reason: `no leaf mapping for border-${alias}` });
    return;
  }

  // ring-{n} (numeric weight) — must precede alias form so `ring-2` doesn't fall through
  m = utility.match(/^ring-(\d+)$/);
  if (m) {
    out.effects.push({ tailwindClass: raw, state, kind: 'focus-ring', token: null, weight: Number(m[1]) });
    return;
  }
  // ring-offset-{n}
  m = utility.match(/^ring-offset-(\d+)$/);
  if (m) {
    out.effects.push({ tailwindClass: raw, state, kind: 'focus-ring-offset', token: null, offset: Number(m[1]) });
    return;
  }
  // plain `ring` — default 3px focus ring bound to --ring alias
  if (utility === 'ring') {
    const r = resolveShadcnAlias('ring', aliasToLeaf);
    out.effects.push({ tailwindClass: raw, state, kind: 'focus-ring', token: r.token ?? null, weight: 3 });
    return;
  }
  // ring-{alias} (color alias)
  m = utility.match(/^ring-([a-z][\w-]*)$/i);
  if (m) {
    const alias = m[1];
    const r = resolveShadcnAlias(alias, aliasToLeaf);
    if (r.token) { out.effects.push({ tailwindClass: raw, state, kind: 'focus-ring', token: r.token, weight: 3 }); return; }
    out.unresolved.push({ tailwindClass: raw, reason: `no leaf mapping for ring-${alias}` });
    return;
  }

  // rounded, rounded-{size}, rounded-{side}-{size}
  m = utility.match(/^rounded(?:-([trlb]{1,2}))?(?:-([a-z0-9]+))?$/i);
  if (m) {
    const side = m[1] ?? null;
    const size = m[2] ?? '';
    const hint = ROUNDED_HINT[size];
    if (hint) {
      out.radii.push({ tailwindClass: raw, state, side, token: hint.token, px: hint.px });
      return;
    }
    out.unresolved.push({ tailwindClass: raw, reason: `unknown rounded size "${size}"` });
    return;
  }

  // h-{n}, w-{n}, size-{n}, min-h-{n}, max-w-{n}
  m = utility.match(/^(h|w|size|min-h|min-w|max-h|max-w)-(\d+(?:\.5)?|px|full|auto|screen|fit)$/);
  if (m) {
    const prop = m[1]; const val = m[2];
    let px = null;
    if (val === 'px') px = 1;
    else if (/^\d+(?:\.5)?$/.test(val)) px = Number(val) * 4;
    const hint = px != null ? SPACE_HINT_BY_PX[px] ?? null : null;
    out.layout.push({ tailwindClass: raw, state, prop, px, tokenHint: hint, raw: val });
    return;
  }

  // p/m/gap — spacing
  m = utility.match(/^(p|m|gap)(x|y|t|r|b|l|s|e)?-(\d+(?:\.5)?|px)$/);
  if (m) {
    const family = m[1]; const axis = m[2] ?? ''; const val = m[3];
    const px = val === 'px' ? 1 : Number(val) * 4;
    const property = family + axis;
    out.spacing.push({ tailwindClass: raw, state, property, px, tokenHint: SPACE_HINT_BY_PX[px] ?? null });
    return;
  }

  // font-{weight}
  m = utility.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);
  if (m) {
    out.typography.push({ tailwindClass: raw, state, fontWeight: m[1] });
    return;
  }

  // opacity-{n}
  m = utility.match(/^opacity-(\d{1,3})$/);
  if (m) {
    out.effects.push({ tailwindClass: raw, state, kind: 'opacity', value: Number(m[1]) / 100 });
    return;
  }

  // shadow, shadow-{size}
  m = utility.match(/^shadow(?:-(sm|md|lg|xl|2xl|inner|none))?$/);
  if (m) {
    out.effects.push({ tailwindClass: raw, state, kind: 'drop-shadow', size: m[1] ?? 'default' });
    return;
  }

  // inline-flex, flex, items-center, justify-center, gap — layout hints we
  // record but don't resolve (Figma equivalents are applied at node-creation
  // time by the agent).
  if (/^(inline-flex|flex|grid|block|inline|hidden|items-|justify-|content-|self-|place-|whitespace-|overflow-|cursor-|pointer-events-|select-|transition|duration-|ease-|outline-|aria-|data-|peer|group)/.test(utility)) {
    out.layout.push({ tailwindClass: raw, state, prop: 'passthrough', value: utility });
    return;
  }

  out.unresolved.push({ tailwindClass: raw, reason: 'no pattern matched' });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const [tokensArg, classArg] = process.argv.slice(2);
  if (!tokensArg || classArg == null) {
    process.stdout.write(JSON.stringify({ error: 'usage: resolve-classes.mjs <tokens.css> <classString|->' }));
    process.exit(1);
  }
  const tokensPath = resolvePath(tokensArg);
  let classString = classArg;
  if (classArg === '-') {
    classString = await readStream(process.stdin);
  }

  let tokens;
  try {
    tokens = await parseTokensCss(tokensPath);
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: `tokens.css parse failed: ${err.message}` }));
    process.exit(1);
  }

  const out = {
    fills: [], strokes: [], radii: [], spacing: [],
    typography: [], effects: [], layout: [], unresolved: [],
  };

  const classes = String(classString).split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    const parsed = parsePrefixes(cls);
    try { classify(parsed, tokens.aliasToLeaf, out); }
    catch (err) { out.unresolved.push({ tailwindClass: cls, reason: `classifier threw: ${err.message}` }); }
  }

  process.stdout.write(JSON.stringify(out, null, 2));
  process.exit(0);
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (c) => { data += c; });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ error: `unhandled: ${err.message}`, stack: err.stack }));
  process.exit(1);
});
