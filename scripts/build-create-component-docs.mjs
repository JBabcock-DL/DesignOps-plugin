#!/usr/bin/env node
// Regenerate the hand-maintained doc tables in
// skills/create-component/SKILL.md (Supported Components grouped list and the
// component → page routing table) directly from skills/create-component/shadcn-props.json.
//
// Also: seeds the `category` field on every entry in shadcn-props.json the
// first time this script runs against an older JSON, using the CATEGORY_MAP
// below (derived from the SKILL.md groupings that existed pre-SSOT). Thereafter
// the JSON is authoritative and CATEGORY_MAP is only used when a brand-new
// component is added without a category field.
//
// Usage:
//     node scripts/build-create-component-docs.mjs
//     node scripts/build-create-component-docs.mjs --check
//
// `--check` exits non-zero if the regen would change any file. Useful in CI
// or a pre-commit hook. No flag = write changes.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PROPS_PATH = resolve(REPO_ROOT, 'skills/create-component/shadcn-props.json');
const SPLIT_DIR = resolve(REPO_ROOT, 'skills/create-component/shadcn-props');
const SKILL_PATH = resolve(REPO_ROOT, 'skills/create-component/SKILL.md');

// Category display order mirrors the pre-SSOT SKILL.md sequence (Form & Input
// first, platform bits last) so git diffs stay minimal during migration.
const CATEGORY_ORDER = [
  'Form & Input',
  'Layout & Display',
  'Overlay & Dialog',
  'Navigation',
  'Feedback & Status',
  'Data Display',
  'Typography & platform',
];

// Migration seed: one-time mapping used only when a component in
// shadcn-props.json has no `category` field. Once every entry has a category,
// this map is consulted only for brand-new additions before the author sets
// the field explicitly.
const CATEGORY_MAP = {
  // Form & Input
  button: 'Form & Input',
  'button-group': 'Form & Input',
  input: 'Form & Input',
  'input-group': 'Form & Input',
  textarea: 'Form & Input',
  checkbox: 'Form & Input',
  'radio-group': 'Form & Input',
  select: 'Form & Input',
  'native-select': 'Form & Input',
  combobox: 'Form & Input',
  switch: 'Form & Input',
  slider: 'Form & Input',
  toggle: 'Form & Input',
  'toggle-group': 'Form & Input',
  form: 'Form & Input',
  field: 'Form & Input',
  label: 'Form & Input',
  'input-otp': 'Form & Input',

  // Layout & Display
  card: 'Layout & Display',
  carousel: 'Layout & Display',
  separator: 'Layout & Display',
  'aspect-ratio': 'Layout & Display',
  'scroll-area': 'Layout & Display',
  resizable: 'Layout & Display',
  sidebar: 'Layout & Display',

  // Overlay & Dialog
  dialog: 'Overlay & Dialog',
  drawer: 'Overlay & Dialog',
  sheet: 'Overlay & Dialog',
  popover: 'Overlay & Dialog',
  tooltip: 'Overlay & Dialog',
  'hover-card': 'Overlay & Dialog',
  'alert-dialog': 'Overlay & Dialog',
  'context-menu': 'Overlay & Dialog',
  'dropdown-menu': 'Overlay & Dialog',
  menubar: 'Overlay & Dialog',

  // Navigation
  'navigation-menu': 'Navigation',
  tabs: 'Navigation',
  breadcrumb: 'Navigation',
  pagination: 'Navigation',
  command: 'Navigation',

  // Feedback & Status
  alert: 'Feedback & Status',
  badge: 'Feedback & Status',
  progress: 'Feedback & Status',
  skeleton: 'Feedback & Status',
  sonner: 'Feedback & Status',
  toast: 'Feedback & Status',
  empty: 'Feedback & Status',
  spinner: 'Feedback & Status',

  // Data Display
  table: 'Data Display',
  accordion: 'Data Display',
  collapsible: 'Data Display',
  calendar: 'Data Display',
  'date-picker': 'Data Display',
  avatar: 'Data Display',
  chart: 'Data Display',
  item: 'Data Display',

  // Typography & platform
  direction: 'Typography & platform',
  typography: 'Typography & platform',
  kbd: 'Typography & platform',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, obj) {
  const text = JSON.stringify(obj, null, 2) + '\n';
  writeFileSync(path, text);
}

function migrateCategories(props) {
  let mutated = false;
  const missing = [];
  for (const [name, entry] of Object.entries(props)) {
    if (name.startsWith('$')) continue;
    if (!entry || typeof entry !== 'object') continue;
    if (!entry.category) {
      const fromMap = CATEGORY_MAP[name];
      if (!fromMap) {
        missing.push(name);
        continue;
      }
      entry.category = fromMap;
      mutated = true;
    }
  }
  if (missing.length) {
    console.error(
      `warn: ${missing.length} component(s) have no category and are not in CATEGORY_MAP:\n` +
        missing.map(n => `  - ${n}`).join('\n') +
        '\n       add `"category": "..."` to those entries in shadcn-props.json or update CATEGORY_MAP.'
    );
  }
  return mutated;
}

function buildSupportedComponentsBlock(props) {
  const byCategory = new Map();
  for (const [name, entry] of Object.entries(props)) {
    if (name.startsWith('$')) continue;
    if (!entry || typeof entry !== 'object') continue;
    const category = entry.category || 'Uncategorized';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(name);
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter(c => byCategory.has(c)),
    ...[...byCategory.keys()].filter(c => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  const lines = [];
  for (const category of orderedCategories) {
    const names = byCategory.get(category).slice().sort((a, b) => {
      // Preserve "button first" feel — otherwise alphabetical within category.
      if (a === 'button') return -1;
      if (b === 'button') return 1;
      return a.localeCompare(b);
    });
    lines.push(`**${category}**`);
    lines.push(names.map(n => `\`${n}\``).join(' '));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function buildPageRoutingTable(props) {
  const rows = [['Component (kebab-case)', 'Layout archetype', 'Page name in the Foundations scaffold']];
  const names = Object.keys(props)
    .filter(n => !n.startsWith('$'))
    .filter(n => props[n] && typeof props[n] === 'object')
    .sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const entry = props[name];
    const layout = entry.layout || 'chip';
    const pageName = entry.pageName || '—';
    rows.push([`\`${name}\``, `\`${layout}\``, pageName]);
  }
  const header = rows[0];
  const body = rows.slice(1);
  const headerLine = `| ${header.join(' | ')} |`;
  const sepLine = `|${header.map(() => '---').join('|')}|`;
  const bodyLines = body.map(r => `| ${r.join(' | ')} |`);
  return [headerLine, sepLine, ...bodyLines].join('\n');
}

function replaceMarkerBlock(text, marker, replacement) {
  const start = `<!-- GENERATED:${marker} START -->`;
  const end = `<!-- GENERATED:${marker} END -->`;
  const pattern = new RegExp(
    `${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );
  const block = `${start}\n${replacement}\n${end}`;
  if (!pattern.test(text)) {
    return { changed: false, text, block, found: false };
  }
  const next = text.replace(pattern, block);
  return { changed: next !== text, text: next, block, found: true };
}

// Source of truth resolution (Phase 8).
// Prefer the split directory skills/create-component/shadcn-props/ when it
// exists so this script no longer depends on the monolith staying in sync —
// the monolith is just a build artifact for back-compat. If the split
// directory is missing (fresh clone before split-shadcn-props.mjs ran, or
// intentional rollback), fall back to the monolith.
function loadProps() {
  if (existsSync(SPLIT_DIR)) {
    const files = readdirSync(SPLIT_DIR)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .sort((a, b) => a.localeCompare(b));
    if (files.length > 0) {
      const props = {};
      // Carry the meta keys from the monolith so category migration writes
      // don't silently drop them.
      if (existsSync(PROPS_PATH)) {
        const mono = readJson(PROPS_PATH);
        for (const [k, v] of Object.entries(mono)) {
          if (k.startsWith('$')) props[k] = v;
        }
      }
      for (const f of files) {
        const name = f.replace(/\.json$/, '');
        props[name] = readJson(resolve(SPLIT_DIR, f));
      }
      return { props, source: 'split' };
    }
  }
  return { props: readJson(PROPS_PATH), source: 'mono' };
}

function persistPropsAfterMigration(props, source) {
  if (source === 'split') {
    for (const [name, entry] of Object.entries(props)) {
      if (name.startsWith('$')) continue;
      if (!entry || typeof entry !== 'object') continue;
      const target = resolve(SPLIT_DIR, `${name}.json`);
      writeJson(target, entry);
    }
    // Keep the monolith aligned so any old tooling still works. Delegates to
    // the canonical bundler so _index.json + key ordering stay consistent.
    // Defer requiring Node child_process here — cheaper to just rewrite the
    // monolith from memory with the same shape build-shadcn-props.mjs emits.
    const mono = {
      $schema: props.$schema ?? './shadcn-props.schema.json',
      $comment:
        props.$comment ??
        'Regenerated from skills/create-component/shadcn-props/*.json via scripts/build-shadcn-props.mjs. Edit the per-component files, not this bundle.',
    };
    const names = Object.keys(props)
      .filter(n => !n.startsWith('$'))
      .sort((a, b) => a.localeCompare(b));
    for (const n of names) mono[n] = props[n];
    writeJson(PROPS_PATH, mono);
  } else {
    writeJson(PROPS_PATH, props);
  }
}

function main() {
  const check = process.argv.includes('--check');

  const { props, source } = loadProps();
  const propsMutated = migrateCategories(props);

  const supportedBlock = buildSupportedComponentsBlock(props);
  const routingTable = buildPageRoutingTable(props);

  const skillBefore = readFileSync(SKILL_PATH, 'utf8');
  let skillAfter = skillBefore;
  const warnings = [];

  const r1 = replaceMarkerBlock(skillAfter, 'supported-components', supportedBlock);
  if (!r1.found) {
    warnings.push(
      'SKILL.md missing <!-- GENERATED:supported-components START/END --> markers; skipping that block.'
    );
  }
  skillAfter = r1.text;

  const r2 = replaceMarkerBlock(skillAfter, 'page-routing-table', routingTable);
  if (!r2.found) {
    warnings.push(
      'SKILL.md missing <!-- GENERATED:page-routing-table START/END --> markers; skipping that block.'
    );
  }
  skillAfter = r2.text;

  const skillChanged = skillAfter !== skillBefore;

  if (check) {
    if (propsMutated) {
      console.error('drift: shadcn-props.json would change (new category field).');
    }
    if (skillChanged) {
      console.error('drift: SKILL.md generated blocks are stale.');
    }
    for (const w of warnings) console.error(`warn: ${w}`);
    if (propsMutated || skillChanged) process.exit(1);
    console.log('build-create-component-docs: OK (no drift)');
    return;
  }

  if (propsMutated) {
    persistPropsAfterMigration(props, source);
    if (source === 'split') {
      console.log(
        `updated skills/create-component/shadcn-props/*.json (seeded missing category fields) and regenerated ${PROPS_PATH}`
      );
    } else {
      console.log(`updated ${PROPS_PATH} (seeded missing category fields)`);
    }
  }
  if (skillChanged) {
    writeFileSync(SKILL_PATH, skillAfter);
    console.log(`updated ${SKILL_PATH} (regenerated generated blocks)`);
  }
  if (!propsMutated && !skillChanged) {
    console.log('build-create-component-docs: already up to date');
  }
  for (const w of warnings) console.log(`warn: ${w}`);
}

main();
