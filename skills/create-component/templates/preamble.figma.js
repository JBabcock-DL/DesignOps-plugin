// ═══════════════════════════════════════════════════════════════════════════
// create-component / preamble.figma.js  (HUMAN-READABLE SOURCE)
// ═══════════════════════════════════════════════════════════════════════════
// AGENTS: use `preamble.runtime.figma.js` (same folder, ~1.3 kB, auto-generated)
// instead of this file in every `use_figma` payload. It has all comments stripped
// so the assembled MCP wrapper JSON stays under the Composer-class host transport
// cap (~28 kB). Run `npm run build:min` to regenerate the runtime twin.
// This source file is the edit target — never edit preamble.runtime.figma.js by hand.
// ═══════════════════════════════════════════════════════════════════════════
// Canonical preamble that MUST sit between the per-component §0 CONFIG
// block and the per-archetype engine bundle in every `use_figma` payload.
// Read this file in full and inline it VERBATIM — do not paraphrase,
// do not elide the file-key gate, do not move the identifiers elsewhere.
//
// Required script-assembly order (SKILL.md §0):
//
//   1. CONFIG                                              (per-component)
//   2. THIS FILE — preamble.figma.js                       (boundary identifiers)
//   3. templates/create-component-engine-{layout}.min.figma.js
//      (routed by CONFIG.layout)
//
// Identifiers this file contributes to scope:
//
//   ACTIVE_FILE_KEY         string | null   — the registry's bound fileKey
//   REGISTRY_COMPONENTS     Record<kebab, { nodeId, key, pageName, ... }>
//   usesComposes            boolean — derived from CONFIG.composes
//   logFileKeyMismatch()    fn     — logs the soft warning described below
//   __ccPreflightFileKey()  fn|null — structured fail-fast for headless/wrong-file
//   _fileKeyObserved        string | null   — `figma.fileKey` at draw time
//   _fileKeyMismatch        boolean — set when ACTIVE_FILE_KEY disagrees
//
// The engine bundle references identifiers from scope during its run. The
// top-of-bundle preamble assertion (draw-engine / op-interpreter §0a) throws a
// clear message listing which ones are missing — but that message only
// fires if you remembered to inline the engine bundle. If you forgot to
// inline this file too, you would see a raw `ReferenceError` mid-draw
// instead. Don't skip step 2.
//
// Why is this its own file instead of living at the top of SKILL.md? Two
// reasons:
//   1. Symmetry with the engine bundles — agents that truncate SKILL.md
//      past the §0 quickstart used to miss the §6 preamble block, which
//      caused cryptic ReferenceError throws in the return-payload builder.
//   2. The preamble never changes per component — extracting it here
//      prevents agents from forking it when they edit CONFIG.
//
// Per-component edits to THIS FILE are forbidden. The only designer-
// overridable fields are the TWO literals flagged below (ACTIVE_FILE_KEY
// and REGISTRY_COMPONENTS), and those are replaced programmatically by
// the agent from the repo's `.designops-registry.json` during Step 5.1.
// Everything else is fixed infrastructure.
// ═══════════════════════════════════════════════════════════════════════════

// ── REGISTRY PREFILL (atomic composition — SKILL.md Step 5.1) ───────────
// Agent replaces these two literals after reading `.designops-registry.json`
// at repo root, immediately before each `use_figma` invocation:
//
//   ACTIVE_FILE_KEY     string | null   — null skips the file-key gate
//   REGISTRY_COMPONENTS Record<kebab, { nodeId, key, pageName, publishedAt?,
//                                       version?, cvaHash?, composedChildVersions? }>
//
// First run (no registry yet) → keep the defaults below; both fields are
// written on Step 5.2 write-back.
const ACTIVE_FILE_KEY = null;
const REGISTRY_COMPONENTS = {};

// ── Composition flag (derived from CONFIG — do not hand-edit) ───────────
const usesComposes = Array.isArray(CONFIG.composes) && CONFIG.composes.length > 0;

// ── File-key gate — WARNING ONLY, NEVER THROW ───────────────────────────
//
// `figma.fileKey` is unreliable as a file-identity check across several
// common Figma scenarios — a throw here would block legitimate draws:
//
//   • Branch files — returns the branch's internal key, not the URL's.
//   • Shared-library / team-library context — returns the library key,
//     not the host file the designer is actually editing in.
//   • Duplicated / unpublished files — internal key differs from the URL
//     segment until the file is first published.
//   • Some plugin execution contexts where the field is stubbed / empty.
//
// The registry uses `ACTIVE_FILE_KEY` purely for the composition mapping
// in `REGISTRY_COMPONENTS` (Step 5.1). A mismatch is a soft warning — the
// draw still proceeds against the currently-open Figma page. If the agent
// was pointed at the wrong file, the mismatch warning + the "no composes
// resolved" error downstream will surface the problem; safer than blocking
// every branch / duplicated / library-linked file outright.
//
// If a project genuinely needs a hard stop, edit `logFileKeyMismatch`
// below — do NOT reintroduce a throw at the assignment site in the
// engine bundle (the engine template intentionally consumes both the
// boolean and the observed value as data, not as control flow).
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

// File-binding preflight. Returns structured { ok: false, ... } only for a mismatched,
// non-placeholder fileKey. Returns null when the binding is acceptable to continue draws.
//
// figma.fileKey === "headless": several IDE/MCP transports always stub this — it is NOT
// proof the wrong document is focused. Warn and continue (same spirit as § file-key gate
// above). Verify the correct file by canvas content / ACTIVE_FILE_KEY for composes.
function __ccPreflightFileKey() {
  const observed =
    typeof figma.fileKey === 'string' && figma.fileKey ? figma.fileKey : null;
  const expected =
    typeof ACTIVE_FILE_KEY === 'string' && ACTIVE_FILE_KEY ? ACTIVE_FILE_KEY : null;
  if (observed === 'headless') {
    console.warn(
      '[create-component] figma.fileKey is "headless" (common for some MCP connectors). ' +
        'Draw proceeds against the active canvas — confirm you have ' +
        (expected ? '"' + expected + '" ' : '') +
        'open if using registry composes.',
    );
    return null;
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
