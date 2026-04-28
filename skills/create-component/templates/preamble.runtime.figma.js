// preamble.runtime.figma.js — generated; edit preamble.figma.js + npm run build:min
const ACTIVE_FILE_KEY = null;
const REGISTRY_COMPONENTS = {};


const usesComposes = Array.isArray(CONFIG.composes) && CONFIG.composes.length > 0;


function logFileKeyMismatch(expected, actual) {
  console.warn(
    `[create-component] fileKey mismatch — registry expects "${expected}" but ` +
      `figma.fileKey is "${actual || '(empty)'}". Continuing anyway; this is common ` +
      'in branch / shared-library / duplicated files where figma.fileKey returns a ' +
      'different value than the URL segment. If registry-bound composes fail to ' +
      'resolve, delete or reset `.designops-registry.json` or open the correct file.',
  );
}

const _fileKeyObserved = (typeof figma.fileKey === 'string' && figma.fileKey) || null;
const _fileKeyMismatch =
  !!(ACTIVE_FILE_KEY && _fileKeyObserved && _fileKeyObserved !== ACTIVE_FILE_KEY);
if (_fileKeyMismatch) {
  logFileKeyMismatch(ACTIVE_FILE_KEY, _fileKeyObserved);
}


function __ccPreflightFileKey() {
  const observed =
    typeof figma.fileKey === 'string' && figma.fileKey ? figma.fileKey : null;
  const expected =
    typeof ACTIVE_FILE_KEY === 'string' && ACTIVE_FILE_KEY ? ACTIVE_FILE_KEY : null;
  if (observed === 'headless') {
    return {
      ok: false,
      why: 'figma-headless-session',
      fileKeyObserved: 'headless',
      fileKeyExpected: expected,
      remediation:
        'figma.fileKey is "headless" — open ' +
        (expected || 'the design file') +
        ' in Figma Desktop with MCP linked, then re-run prepare.',
    };
  }
  if (observed && expected && observed !== expected) {
    return {
      ok: false,
      why: 'figma-file-mismatch',
      fileKeyObserved: observed,
      fileKeyExpected: expected,
      remediation:
        'Wrong file: expected ' + expected + ', got ' + observed + '. Switch file tab and re-run prepare.',
    };
  }
  return null;
}
