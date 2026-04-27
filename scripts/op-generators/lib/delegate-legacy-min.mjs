// Maps create-component slugs to committed min engine paths (build-min output).
// Used by generate-ops when the slice is not tuple-op (scaffold) — same bytes as
// direct assemble-slice --legacy-bundles; Figma output is identical to pre-op pipeline.

import { join } from 'node:path';

const TEMPL = ['skills', 'create-component', 'templates'];

const DOC_SLUG_TO_FILE = {
  'cc-doc-component': 'create-component-engine-doc.step2.min.figma.js',
  'cc-doc-props': 'create-component-engine-doc.step3.min.figma.js',
  'cc-doc-matrix': 'create-component-engine-doc.step4.min.figma.js',
  'cc-doc-usage': 'create-component-engine-doc.step5.min.figma.js',
  'cc-doc-finalize': 'create-component-engine-doc.step6.min.figma.js',
};

const LAYOUT_TO_ARCH = {
  chip: 'chip',
  'surface-stack': 'surface-stack',
  field: 'field',
  'row-item': 'row-item',
  tiny: 'tiny',
  control: 'control',
  container: 'container',
  __composes__: 'composed',
};

/**
 * @param {string} slug
 * @param {string|undefined} layout — required when slug is cc-variants
 * @param {string} pluginRoot
 * @returns {string} relative path from plugin root
 */
export function getDelegatedMinRelPath(slug, layout, pluginRoot) {
  if (slug === 'cc-variants') {
    const a = LAYOUT_TO_ARCH[layout];
    if (!a) {
      throw new Error(`delegate-legacy-min: unknown layout for cc-variants: ${String(layout)}`);
    }
    return join(...TEMPL, `create-component-engine-${a}.step0.min.figma.js`);
  }
  const f = DOC_SLUG_TO_FILE[slug];
  if (!f) return null;
  return join(...TEMPL, f);
}
