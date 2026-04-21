#!/usr/bin/env bash
# Verify that skills/** in the workspace matches the Claude marketplace cache.
# Exits non-zero on any drift so CI or a pre-push hook can block stale caches.
# Also enforces minified-template freshness when *.min.figma.js siblings exist.
#
# Usage:
#     bash scripts/verify-cache.sh
#
# Override the cache path with $CLAUDE_CACHE when the marketplace lives in a
# non-default location.
set -euo pipefail

DEFAULT_CACHE="$HOME/.claude/plugins/marketplaces/local-desktop-app-uploads/labs-design-ops"
CACHE="${CLAUDE_CACHE:-$DEFAULT_CACHE}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/skills"
DEST="$CACHE/skills"
STATUS=0

if [[ ! -d "$CACHE" ]]; then
  echo "error: cache directory not found: $CACHE" >&2
  echo "       set CLAUDE_CACHE=/path/to/labs-design-ops if installed elsewhere." >&2
  exit 1
fi

if [[ ! -d "$DEST" ]]; then
  echo "error: cache has no skills/ directory yet: $DEST" >&2
  echo "       run 'bash scripts/sync-cache.sh' first." >&2
  exit 1
fi

echo "==> diffing $SRC against $DEST"
if diff -rq --exclude='.DS_Store' "$SRC" "$DEST" > /tmp/sync-cache-diff.$$ 2>&1; then
  echo "    workspace and cache are in sync"
else
  STATUS=1
  echo "    DRIFT DETECTED:"
  sed 's/^/      /' /tmp/sync-cache-diff.$$
  echo ""
  echo "    run 'bash scripts/sync-cache.sh' to resolve."
fi
rm -f /tmp/sync-cache-diff.$$

echo ""
echo "==> checking minified-template freshness"
STALE=0
while IFS= read -r -d '' MIN; do
  SRC_JS="${MIN%.min.figma.js}.figma.js"
  if [[ ! -f "$SRC_JS" ]]; then
    echo "    warn: orphan min file with no readable source: $MIN"
    continue
  fi
  if [[ "$SRC_JS" -nt "$MIN" ]]; then
    STALE=$((STALE + 1))
    REL=${SRC_JS#"$REPO_ROOT/"}
    echo "    stale: $REL is newer than its .min sibling"
  fi
done < <(find "$SRC" -type f -name '*.min.figma.js' -print0)

if [[ $STALE -gt 0 ]]; then
  STATUS=1
  echo ""
  echo "    $STALE minified template(s) out of date."
  echo "    run 'npm run build:min' to regenerate."
else
  echo "    all minified templates are up to date"
fi

echo ""
if [[ $STATUS -eq 0 ]]; then
  echo "verify-cache: OK"
else
  echo "verify-cache: FAILED"
fi
exit $STATUS
