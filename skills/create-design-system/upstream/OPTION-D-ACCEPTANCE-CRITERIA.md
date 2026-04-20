# Option D — acceptance criteria (implementers)

**Purpose:** “Done” definition for **`codeWorkspacePath`** / **`codeFile`** (or host-equivalent) that reads allow-listed files and supplies bytes as `use_figma` `code`.  
**RFC:** [`../RFC-figma-mcp-bundle-transport.md`](../RFC-figma-mcp-bundle-transport.md)  
**MRE:** [`./MCP-USE-FIGMA-BUNDLE-MRE.md`](./MCP-USE-FIGMA-BUNDLE-MRE.md)

## API

- New optional field (name TBD): e.g. `codeWorkspacePath` — **mutually exclusive** with inline `code` when set.
- Existing fields unchanged: `fileKey`, `description`, `skillNames`, etc.

## Security and trust

| Requirement | Detail |
|-------------|--------|
| **Allow-listed roots** | Resolve paths only under declared roots (e.g. **workspace root**, **installed skill / plugin root**). Reject arbitrary absolute paths if product policy requires workspace-relative paths only. |
| **Traversal** | Reject `..` segments and normalized paths that escape a root. |
| **Symlinks** | Product decision: either reject symlinks whose targets leave allow-listed roots, or resolve and re-check under realpath — document chosen behavior. |
| **Encoding** | Read as **UTF-8**; reject or transcode invalid UTF-8 per product rules (prefer strict UTF-8 with clear error). |
| **Size** | Enforce the **same maximum** as inline `code` (e.g. character / byte cap aligned with existing JSON Schema `maxLength`). Reject with explicit error when over cap. |
| **Optional integrity** | Support optional **SHA-256** (or similar) pin supplied by caller; on mismatch, fail closed with explicit error. |

## Behavioral parity

| Requirement | Detail |
|-------------|--------|
| **Byte identity** | Bytes read from disk (after UTF-8 decode to string per host contract) must be executed **identically** to passing the same string as inline `code` today. |
| **Mutual exclusion** | If both inline `code` and file path are set, return a **validation error** (do not prefer one silently). |
| **Missing file** | Clear error: path not found or not readable. |
| **Outside allow-list** | Clear error: path rejected (no partial reads). |

## Errors and observability

- Surface **actionable** errors to the caller (path, reason: not found, too large, traversal, encoding, hash mismatch).
- Avoid **silent truncation** of file contents; size must be checked **before** execution.
- Optional: log **length only** (not script body) for support diagnostics.

## Out of scope for Option D

- Fetching remote URLs (blocked in plugin runtime; see MRE).
- Implicit trust of arbitrary user home paths without allow-listing.

## Fallback

- Inline `code` remains supported for hosts that do not implement file-backed `code`.

## Validation after implementation

Follow [`./STEP-15-POST-OPTION-D-VALIDATION.md`](./STEP-15-POST-OPTION-D-VALIDATION.md).
