#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/build-config-block.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Generate a syntactically-valid CONFIG block from shadcn-props/<component>.json.
//
// Purpose: eliminates the #1 cause of `use_figma` SyntaxError failures —
// agents hand-typing prose strings (summary, properties descriptions,
// usageDo/usageDont) which collide with single-quote delimiters when
// apostrophes appear. This script uses JSON.stringify() for every string
// field so the output is always correctly escaped.
//
// The output CONFIG block has:
//   • All string/literal fields from shadcn-props already double-quoted safely
//   • Layout-type defaults for variants, sizes, states (adjust per project)
//   • Stub `// TODO` entries for project-specific token paths
//   • Function-valued keys (label, applyStateOverride) as named functions
//
// After generation, the agent must still: fill in `style` / token paths
// (Step 4.7) and adjust axes. This script runs `check-payload` on the output file.
//
// Usage
//   node scripts/build-config-block.mjs <component-name> [--out <path>]
//   node scripts/build-config-block.mjs button
//   node scripts/build-config-block.mjs button --out ./mcp-exports/button.config.js
//
// If --out is omitted, writes to <cwd>/mcp-exports/<component>.config.js (creates dir).
//
// Exit: 0 ok · 1 unknown component / bad args · 2 parse error · 5 check-payload failed
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SHADCN_PROPS_DIR = join(REPO_ROOT, 'skills', 'create-component', 'shadcn-props');

// ── Layout-type structural defaults ─────────────────────────────────────
// Sensible starting points. Agent customizes per component + project tokens.
const LAYOUT_DEFAULTS = {
  chip: {
    variants:  ['default', 'secondary', 'outline', 'ghost'],
    sizes:     ['sm', 'default', 'lg'],
    stateAxes: [
      { key: 'default',  group: 'default'   },
      { key: 'hover',    group: 'default'   },
      { key: 'pressed',  group: 'default'   },
      { key: 'disabled', group: 'disabled'  },
    ],
    applyStateOverrideBody:
      'if (stateKey === "disabled") instance.opacity = 0.38;\n' +
      '  else if (stateKey === "hover") instance.opacity = 0.92;\n' +
      '  else if (stateKey === "pressed") instance.opacity = 0.84;\n' +
      '  else instance.opacity = 1;',
    labelFn: '(size, variant) => title',
    padH:    "{ default: 'space/md', sm: 'space/sm', lg: 'space/lg' }",
    radius:  "'radius/md'",
    labelStyle: "{ default: 'Label/MD', sm: 'Label/SM', lg: 'Label/LG' }",
  },
  'surface-stack': {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [{ key: 'default', group: 'default' }],
    applyStateOverrideBody: '// no-op',
    labelFn: '() => null',
    padH:    "{ default: 'space/lg' }",
    radius:  "'radius/lg'",
    labelStyle: "{ default: 'Body/MD' }",
  },
  field: {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [
      { key: 'default',  group: 'default'  },
      { key: 'focus',    group: 'default'  },
      { key: 'error',    group: 'default'  },
      { key: 'disabled', group: 'disabled' },
    ],
    applyStateOverrideBody:
      'if (stateKey === "disabled") instance.opacity = 0.38;\n' +
      '  else instance.opacity = 1;',
    labelFn: '() => null',
    padH:    "{ default: 'space/sm' }",
    radius:  "'radius/sm'",
    labelStyle: "{ default: 'Body/MD' }",
  },
  'row-item': {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [
      { key: 'default',  group: 'default'  },
      { key: 'hover',    group: 'default'  },
      { key: 'active',   group: 'default'  },
      { key: 'disabled', group: 'disabled' },
    ],
    applyStateOverrideBody:
      'if (stateKey === "disabled") instance.opacity = 0.38;\n' +
      '  else if (stateKey === "hover") instance.opacity = 0.92;\n' +
      '  else if (stateKey === "active") instance.opacity = 0.84;\n' +
      '  else instance.opacity = 1;',
    labelFn: '() => null',
    padH:    "{ default: 'space/sm' }",
    radius:  "'radius/sm'",
    labelStyle: "{ default: 'Body/MD' }",
  },
  tiny: {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [{ key: 'default', group: 'default' }],
    applyStateOverrideBody: '// no-op',
    labelFn: '() => null',
    padH:    "{ default: 'space/xs' }",
    radius:  "'radius/sm'",
    labelStyle: "{ default: 'Label/SM' }",
  },
  control: {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [
      { key: 'unchecked', group: 'default'  },
      { key: 'checked',   group: 'default'  },
      { key: 'disabled',  group: 'disabled' },
    ],
    applyStateOverrideBody:
      'if (stateKey === "checked") instance.setProperties({ checked: true, disabled: false });\n' +
      '  else if (stateKey === "disabled") instance.setProperties({ disabled: true });\n' +
      '  else instance.setProperties({ checked: false, disabled: false });',
    labelFn: '() => null',
    padH:    "{ default: 'space/xs' }",
    radius:  "'radius/sm'",
    labelStyle: "{ default: 'Label/SM' }",
  },
  container: {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [
      { key: 'collapsed', group: 'default' },
      { key: 'expanded',  group: 'default' },
    ],
    applyStateOverrideBody: '// no-op',
    labelFn: '() => null',
    padH:    "{ default: 'space/md' }",
    radius:  "'radius/md'",
    labelStyle: "{ default: 'Body/MD' }",
  },
  '__composes__': {
    variants:  ['default'],
    sizes:     [],
    stateAxes: [{ key: 'default', group: 'default' }],
    applyStateOverrideBody: '// no-op',
    labelFn: '() => null',
    padH:    "{ default: 'space/md' }",
    radius:  "'radius/md'",
    labelStyle: "{ default: 'Body/MD' }",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────
function toTitleCase(kebab) {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function indentLines(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => l.length ? pad + l : l).join('\n');
}

function formatStyleEntry(variant) {
  // Emit a stub style entry — agent fills in real token paths at Step 4.7
  return `{
      fill:      null, // TODO: replace with Theme token e.g. 'color/${variant}/default'
      fallback:  "#888888",  // hex fallback when Theme collection absent
      labelVar:  null, // TODO: e.g. 'color/${variant}/content'
      strokeVar: null, // TODO: e.g. 'color/${variant}/border' or null
    }`;
}

function formatProperties(properties) {
  if (!Array.isArray(properties) || properties.length === 0) return '[]';
  const rows = properties.map(row => {
    // Each row is a 5-tuple; JSON.stringify each element to ensure safe strings
    if (!Array.isArray(row)) return `  // malformed row: ${JSON.stringify(row)}`;
    const [name, type, def, req, desc] = row;
    return `  [${JSON.stringify(name)}, ${JSON.stringify(type)}, ${JSON.stringify(def)}, ${JSON.stringify(req)}, ${JSON.stringify(desc)}]`;
  });
  return '[\n' + rows.join(',\n') + ',\n]';
}

function generateDefaultUsageDo(component, layout) {
  // Generic bullets — agent replaces with component-specific ones
  return [
    `"Use ${component} for its intended semantic purpose."`,
    `"Keep labels or content concise and actionable."`,
    `"Follow established spacing and sizing patterns."`,
  ].join(',\n    ');
}

function generateDefaultUsageDont(component, layout) {
  return [
    `"Don\\'t repurpose ${component} for unrelated interactions."`,
    `"Don\\'t overload with too much text or too many actions."`,
    `"Don\\'t use outside the design system\\'s intended layout grid."`,
  ].join(',\n    ');
}

// ── Main ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const helpIdx = args.findIndex(a => a === '--help' || a === '-h');
if (helpIdx !== -1 || args.length === 0) {
  console.log('Usage: node scripts/build-config-block.mjs <component-name> [--out <path>]');
  process.exit(helpIdx !== -1 ? 0 : 1);
}

const componentName = args[0];
if (!componentName || componentName.startsWith('--')) {
  console.error('build-config-block: first argument must be a component name (e.g. button)');
  process.exit(1);
}

const outIdx = args.indexOf('--out');
let outPath = outIdx !== -1 ? args[outIdx + 1] : null;

const propsPath = join(SHADCN_PROPS_DIR, `${componentName}.json`);
if (!existsSync(propsPath)) {
  console.error(`build-config-block: no shadcn-props entry for "${componentName}" (${propsPath})`);
  console.error('Run: ls skills/create-component/shadcn-props/ to see available components.');
  process.exit(1);
}

let props;
try {
  props = JSON.parse(readFileSync(propsPath, 'utf8'));
} catch (e) {
  console.error(`build-config-block: failed to parse ${propsPath}: ${e.message}`);
  process.exit(2);
}

const layout    = props.layout || 'chip';
const defaults  = LAYOUT_DEFAULTS[layout] || LAYOUT_DEFAULTS.chip;
const title     = toTitleCase(componentName);
const component = componentName;

// Build style entries — one per variant in defaults
const styleEntries = defaults.variants.map(v =>
  `  ${JSON.stringify(v)}: ${formatStyleEntry(v)}`,
).join(',\n');

// Format states as JS array literal
const statesLiteral = defaults.stateAxes.map(s =>
  `  { key: ${JSON.stringify(s.key)}, group: ${JSON.stringify(s.group)} }`,
).join(',\n');

// usageDo / usageDont
const usageDo   = props.usageDo   ? props.usageDo.map(s => JSON.stringify(s)).join(',\n    ')
                                  : generateDefaultUsageDo(component, layout);
const usageDont = props.usageDont ? props.usageDont.map(s => JSON.stringify(s)).join(',\n    ')
                                  : generateDefaultUsageDont(component, layout);

// iconSlots: pass through from props or sensible default
const iconSlots = props.iconSlots
  ? `{ leading: ${!!props.iconSlots.leading}, trailing: ${!!props.iconSlots.trailing}, size: ${props.iconSlots.size || 24} }`
  : `{ leading: false, trailing: false, size: 24 }`;

// componentProps: pass through from props or minimal default
const cp = props.componentProps || {};
const componentProps = `{ label: ${!!cp.label}, leadingIcon: ${!!cp.leadingIcon}, trailingIcon: ${!!cp.trailingIcon} }`;

// composes: not in standard shadcn-props; default empty
const composesComment = `// TODO: if this component composes sub-components (CONFIG.layout === '__composes__'), populate here`;

const block = `// CONFIG block generated by scripts/build-config-block.mjs for "${componentName}"
// Edit project-specific fields marked // TODO before submitting.
// All strings from shadcn-props are pre-escaped via JSON.stringify — safe to use as-is.
// After editing, validate with: npm run check-payload -- <this-file>
const CONFIG = {
  component:  ${JSON.stringify(component)},
  title:      ${JSON.stringify(title)},
  pageName:   ${JSON.stringify(props.pageName || `↳ ${title}s`)},
  layout:     ${JSON.stringify(layout)},
  docsUrl:    ${JSON.stringify(props.docsUrl || `https://ui.shadcn.com/docs/components/${componentName}`)},

  // ── Prose from shadcn-props — already correctly escaped, do not retype ─
  summary:    ${JSON.stringify(props.summary || `${title} component.`)},

  // ── Axes — customize for this component's actual variant/size design ───
  // TODO: adjust variants to match your Figma ComponentSet axes
  variants: ${JSON.stringify(defaults.variants)},
  // TODO: adjust sizes ([] disables the size axis)
  sizes:    ${JSON.stringify(defaults.sizes)},

  // ── Token paths — fill in via Step 4.7 get_variable_defs ──────────────
  padH:       ${defaults.padH},      // TODO: replace with your Layout token paths
  radius:     ${defaults.radius},   // TODO: replace with your Layout token path
  labelStyle: ${defaults.labelStyle}, // TODO: replace with your Typography token names

  // ── Per-variant style — one entry per variant above ────────────────────
  // TODO: replace fill/labelVar/strokeVar with real Theme token paths (Step 4.7)
  style: {
${styleEntries},
  },

  // ── Label function ─────────────────────────────────────────────────────
  label: ${defaults.labelFn},

  // ── Icon slots ─────────────────────────────────────────────────────────
  iconSlots: ${iconSlots},

  // ── Figma element component properties ────────────────────────────────
  componentProps: ${componentProps},

  // ── Matrix states ─────────────────────────────────────────────────────
  states: [
${statesLiteral},
  ],

  // ── State override applied to matrix instances ─────────────────────────
  applyStateOverride: function applyStateOverride(instance, stateKey, ctx) {
    ${defaults.applyStateOverrideBody}
  },

  // ── Properties table — rows from shadcn-props (safe JSON strings) ──────
  properties: ${indentLines(formatProperties(props.properties || []), 2)},

  // ── Usage Do / Don't — customize these bullets ────────────────────────
  usageDo:   [
    ${usageDo},
  ],
  usageDont: [
    ${usageDont},
  ],

  // ── Composes (composite components only) ──────────────────────────────
  ${composesComment}
  composes: [],
};
`;

if (!outPath) {
  outPath = join(process.cwd(), 'mcp-exports', `${componentName}.config.js`);
}
const outAbs = resolve(outPath);
const outDir = dirname(outAbs);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
writeFileSync(outAbs, block, 'utf8');
if (layout === 'control') {
  console.warn(
    '[build-config-block] REMINDER (control): ensure style[onVariant].fill !== style[offVariant].fill. ' +
      'The checked background must differ from unchecked or the glyph will be invisible.'
  );
}
console.log(`OK  ${componentName} CONFIG block → ${outAbs}`);

const checkScript = join(REPO_ROOT, 'scripts', 'check-payload.mjs');
if (existsSync(checkScript)) {
  const r = spawnSync(process.execPath, [checkScript, outAbs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    console.error('build-config-block: check-payload failed on generated CONFIG');
    if (r.stderr) console.error(r.stderr);
    if (r.stdout) console.error(r.stdout);
    process.exit(5);
  }
}
