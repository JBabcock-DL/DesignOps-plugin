#!/usr/bin/env node
// validate-composes.mjs — validates `composes[]` in shadcn-props.json (atomic composition plan §3).
//
// Usage:
//   node validate-composes.mjs <path-to-shadcn-props.json> <componentKey> [--project <projectRoot>]
//   node validate-composes.mjs <path-to-shadcn-props.json> --all [--project <projectRoot>]
//
// --project: when set, resolves defaultProps against each child's cva axes via extract-cva.mjs
// (requires components/ui/<component>.tsx under projectRoot). If a child file is missing, defaultProps
// checks are skipped with a warning (exit still 0 when graph rules pass).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(msg, extra = {}) {
  process.stderr.write(`${msg}\n`);
  if (Object.keys(extra).length) process.stderr.write(`${JSON.stringify(extra, null, 2)}\n`);
  process.exit(1);
}

function warn(msg) {
  process.stderr.write(`[validate-composes] warning: ${msg}\n`);
}

/** @param {Record<string, unknown>} props */
function componentKeys(props) {
  return Object.keys(props).filter((k) => !k.startsWith('$'));
}

/**
 * @param {Record<string, unknown>} props
 * @param {string} start
 * @returns {string[] | null} cycle as ordered list, or null if acyclic for reachable subgraph
 */
function findCycleFrom(props, start) {
  const keys = new Set(componentKeys(props));
  if (!keys.has(start)) return null;
  const stack = [];

  function dfs(name) {
    const i = stack.indexOf(name);
    if (i >= 0) return stack.slice(i).concat(name);
    stack.push(name);
    const entry = props[name];
    const composes = entry && typeof entry === 'object' && Array.isArray(entry.composes) ? entry.composes : [];
    for (const row of composes) {
      if (!row || typeof row !== 'object') continue;
      const child = row.component;
      if (typeof child !== 'string' || !keys.has(child)) continue;
      const cyc = dfs(child);
      if (cyc) return cyc;
    }
    stack.pop();
    return null;
  }

  return dfs(start);
}

/**
 * @param {string} projectRoot
 * @param {string} childKey kebab-case
 */
function extractCva(projectRoot, childKey) {
  const uiPath = join(projectRoot, 'components', 'ui', `${childKey}.tsx`);
  if (!existsSync(uiPath)) return { skipped: true, reason: `missing ${uiPath}` };
  const extractor = resolve(__dirname, 'extract-cva.mjs');
  const r = spawnSync(process.execPath, [extractor, uiPath], {
    encoding: 'utf8',
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    let err = (r.stdout || '').trim() || (r.stderr || '').trim();
    try {
      const j = JSON.parse(r.stdout || '{}');
      if (j.error) err = j.error;
    } catch (_) {}
    return { skipped: true, reason: err || `extract-cva exit ${r.status}` };
  }
  try {
    return { skipped: false, data: JSON.parse(r.stdout) };
  } catch (e) {
    return { skipped: true, reason: `invalid JSON from extract-cva: ${e.message}` };
  }
}

/**
 * @param {object} cva
 * @param {Record<string, string | number | boolean>} defaultProps
 */
function validateDefaultPropsAgainstCva(cva, defaultProps) {
  const variants = cva.variants && typeof cva.variants === 'object' ? cva.variants : {};
  const errors = [];
  for (const [axis, val] of Object.entries(defaultProps)) {
    if (val === null || val === undefined) continue;
    const allowed = variants[axis];
    if (!allowed || typeof allowed !== 'object') {
      errors.push(`defaultProps key '${axis}' is not a cva variant axis on the child`);
      continue;
    }
    const sv = String(val);
    if (!Object.prototype.hasOwnProperty.call(allowed, sv)) {
      const legal = Object.keys(allowed).join(', ');
      errors.push(`defaultProps.${axis}='${sv}' not in child cva axis [${legal}]`);
    }
  }
  return errors;
}

/**
 * @param {Record<string, unknown>} props
 * @param {string} componentKey
 * @param {{ projectRoot?: string }} opts
 */
export function validateComposesForComponent(props, componentKey, opts = {}) {
  const keys = componentKeys(props);
  const errors = [];
  const warnings = [];

  if (!keys.includes(componentKey)) {
    errors.push(`unknown component key '${componentKey}'`);
    return { ok: false, errors, warnings };
  }

  const cycle = findCycleFrom(props, componentKey);
  if (cycle && cycle.length) {
    errors.push(`composition cycle detected: ${cycle.join(' → ')}`);
  }

  const entry = props[componentKey];
  if (!entry || typeof entry !== 'object' || !Array.isArray(entry.composes)) {
    return { ok: errors.length === 0, errors, warnings };
  }

  const composes = entry.composes;
  const slotsSeen = new Set();

  for (let i = 0; i < composes.length; i++) {
    const row = composes[i];
    const prefix = `composes[${i}]`;
    if (!row || typeof row !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }
    const known = new Set(['component', 'slot', 'cardinality', 'count', 'defaultProps']);
    for (const k of Object.keys(row)) {
      if (!known.has(k)) warnings.push(`${prefix}: unknown field '${k}' (forward-compat)`);
    }

    if (typeof row.component !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.component)) {
      errors.push(`${prefix}.component must be kebab-case string`);
      continue;
    }
    if (!keys.includes(row.component)) {
      errors.push(`${prefix}.component '${row.component}' is not a top-level key in shadcn-props.json`);
    }
    if (typeof row.slot !== 'string' || !row.slot.length) {
      errors.push(`${prefix}.slot must be a non-empty string`);
    } else {
      if (slotsSeen.has(row.slot)) errors.push(`duplicate composes slot '${row.slot}' (slots must be unique per component)`);
      slotsSeen.add(row.slot);
    }
    if (row.cardinality !== 'one' && row.cardinality !== 'many') {
      errors.push(`${prefix}.cardinality must be 'one' or 'many'`);
    }
    if (row.cardinality === 'one' && row.count != null) {
      errors.push(`${prefix}: cardinality 'one' must not include count`);
    }
    if (row.cardinality === 'many') {
      if (row.count != null && (typeof row.count !== 'number' || row.count < 1 || !Number.isInteger(row.count))) {
        errors.push(`${prefix}.count must be a positive integer when present`);
      }
    }
    if (row.defaultProps != null) {
      if (typeof row.defaultProps !== 'object' || Array.isArray(row.defaultProps)) {
        errors.push(`${prefix}.defaultProps must be an object`);
      } else {
        for (const [dk, dv] of Object.entries(row.defaultProps)) {
          const t = typeof dv;
          if (t !== 'string' && t !== 'number' && t !== 'boolean') {
            errors.push(`${prefix}.defaultProps.${dk} must be string | number | boolean`);
          }
        }
      }
    }

    if (opts.projectRoot && row.defaultProps && typeof row.defaultProps === 'object' && !Array.isArray(row.defaultProps)) {
      const ex = extractCva(opts.projectRoot, row.component);
      if (ex.skipped) {
        warnings.push(`${prefix}: skipped defaultProps validation (${ex.reason})`);
      } else if (ex.data && ex.data.error) {
        warnings.push(`${prefix}: skipped defaultProps validation (${ex.data.error})`);
      } else if (ex.data) {
        const pe = validateDefaultPropsAgainstCva(ex.data, /** @type {any} */ (row.defaultProps));
        for (const m of pe) errors.push(`${prefix}: ${m}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    fail('usage: validate-composes.mjs <shadcn-props.json> <componentKey|--all> [--project <projectRoot>]');
  }
  const propsPath = resolve(argv[0]);
  const mode = argv[1];
  let projectRoot = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) {
      projectRoot = resolve(argv[++i]);
    }
  }

  const raw = await readFile(propsPath, 'utf8');
  let props;
  try {
    props = JSON.parse(raw);
  } catch (e) {
    fail(`invalid JSON: ${propsPath}: ${e.message}`);
  }

  const allErrors = [];
  const allWarnings = [];

  if (mode === '--all') {
    for (const k of componentKeys(props)) {
      const entry = props[k];
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.composes) || entry.composes.length === 0) {
        continue;
      }
      const r = validateComposesForComponent(props, k, { projectRoot: projectRoot || undefined });
      for (const e of r.errors) allErrors.push(`${k}: ${e}`);
      for (const w of r.warnings) allWarnings.push(`${k}: ${w}`);
    }
  } else {
    const r = validateComposesForComponent(props, mode, { projectRoot: projectRoot || undefined });
    for (const e of r.errors) allErrors.push(e);
    allWarnings.push(...r.warnings);
  }

  for (const w of allWarnings) warn(w);

  if (allErrors.length) {
    fail('validate-composes failed:', { errors: allErrors });
  }

  process.stdout.write(JSON.stringify({ ok: true, mode, propsPath, warnings: allWarnings.length }, null, 2));
  process.stdout.write('\n');
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => fail(e.message || String(e)));
}
