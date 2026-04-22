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

# Bundle has multiple source inputs — declare its dependency set explicitly so
# the simple `${MIN%.min.figma.js}.figma.js` rule below skips it (it would
# otherwise flag the bundle as an orphan because create-component-engine.figma.js
# is not a real source file — it's a build-time synthesis).
BUNDLE_REL="skills/create-component/templates/create-component-engine.min.figma.js"
BUNDLE_SOURCES=(
  "skills/create-component/templates/draw-engine.figma.js"
  "skills/create-component/templates/archetype-builders.figma.js"
)

BUNDLE_ABS="$REPO_ROOT/$BUNDLE_REL"
if [[ -f "$BUNDLE_ABS" ]]; then
  for SRC_REL in "${BUNDLE_SOURCES[@]}"; do
    SRC_ABS="$REPO_ROOT/$SRC_REL"
    if [[ ! -f "$SRC_ABS" ]]; then
      echo "    warn: bundle source missing: $SRC_REL"
      continue
    fi
    if [[ "$SRC_ABS" -nt "$BUNDLE_ABS" ]]; then
      STALE=$((STALE + 1))
      echo "    stale: $SRC_REL is newer than the bundle ($BUNDLE_REL)"
    fi
  done
else
  STALE=$((STALE + 1))
  echo "    missing: $BUNDLE_REL (canonical runtime bundle)"
fi

while IFS= read -r -d '' MIN; do
  # Skip the bundle — its freshness was verified above against an explicit
  # source list.
  if [[ "$MIN" == "$BUNDLE_ABS" ]]; then
    continue
  fi
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
