#!/usr/bin/env node
// QA: multipart slug helpers (pred) + valid multipart phase-state (validatePhaseStateSchema)
import { pred, isValidStepSlug, validatePhaseStateSchema } from './merge-create-component-handoff.mjs';

const a = pred('cc-doc-matrix.part1');
if (a !== 'cc-doc-props-2') {
  console.error(`qa-op-part-slugs: expected pred(cc-doc-matrix.part1)===cc-doc-props-2, got ${a}`);
  process.exit(1);
}
const b = pred('cc-doc-matrix.part2');
if (b !== 'cc-doc-matrix.part1') {
  console.error(`qa-op-part-slugs: expected pred(part2)===cc-doc-matrix.part1, got ${b}`);
  process.exit(1);
}
if (!isValidStepSlug('cc-doc-matrix.part3')) {
  console.error('qa-op-part-slugs: isValidStepSlug should accept cc-doc-matrix.part3');
  process.exit(1);
}

const multipartState = {
  lastSliceOk: 'cc-doc-matrix.part1',
  nextSlug: 'cc-doc-matrix.part2',
  completedSlugs: [
    'cc-doc-scaffold-shell',
    'cc-doc-scaffold-header',
    'cc-doc-scaffold-table-chrome',
    'cc-doc-scaffold-table-body',
    'cc-doc-scaffold-placeholders',
    'cc-variants',
    'cc-doc-component',
    'cc-doc-props-1',
    'cc-doc-props-2',
    'cc-doc-matrix.part1',
  ],
  lastCodeSha256: '0'.repeat(64),
  lastUpdated: new Date().toISOString(),
};
const errs = validatePhaseStateSchema(multipartState);
if (errs.length) {
  console.error('qa-op-part-slugs: schema errors:', errs);
  process.exit(1);
}

console.log('qa-op-part-slugs: OK (pred + multipart phase-state sample)');
process.exit(0);
