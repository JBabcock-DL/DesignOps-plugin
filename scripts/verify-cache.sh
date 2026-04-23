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
# --strip-trailing-cr: on Windows, working tree may be CRLF while a copied
# cache is LF; content is the same. GNU diff 3.4+ (Git Bash) supports this.
if diff -rq --strip-trailing-cr --exclude='.DS_Store' "$SRC" "$DEST" > /tmp/sync-cache-diff.$$ 2>&1; then
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
echo "==> diffing project bootstrap files (repo root vs cache root)"
for f in CLAUDE.md memory.md AGENTS.md; do
  if [[ ! -f "$REPO_ROOT/$f" ]]; then
    continue
  fi
  if [[ ! -f "$CACHE/$f" ]]; then
    echo "    missing in cache: $CACHE/$f"
    echo "    run 'bash scripts/sync-cache.sh' to resolve."
    STATUS=1
    continue
  fi
  if ! diff -q --strip-trailing-cr "$REPO_ROOT/$f" "$CACHE/$f" > /dev/null 2>&1; then
    STATUS=1
    echo "    DRIFT DETECTED: $f (repo vs $CACHE/$f)"
    echo "    run 'bash scripts/sync-cache.sh' to resolve."
  fi
done

echo ""
echo "==> checking minified-template freshness"
STALE=0

# Per-archetype bundles + the full bundle are all built from TWO sources
# (draw-engine.figma.js + archetype-builders.figma.js) by scripts/build-min-
# templates.mjs. Declare the dependency set explicitly so the simple
# `${MIN%.min.figma.js}.figma.js` rule below skips them — otherwise they
# would be flagged as orphans because their naming convention
# (create-component-engine-<layout>.min.figma.js) has no matching .figma.js
# source file.
BUNDLE_PREFIX="skills/create-component/templates/create-component-engine"
BUNDLES_REL=(
  "$BUNDLE_PREFIX-chip.min.figma.js"
  "$BUNDLE_PREFIX-surface-stack.min.figma.js"
  "$BUNDLE_PREFIX-field.min.figma.js"
  "$BUNDLE_PREFIX-row-item.min.figma.js"
  "$BUNDLE_PREFIX-tiny.min.figma.js"
  "$BUNDLE_PREFIX-control.min.figma.js"
  "$BUNDLE_PREFIX-container.min.figma.js"
  "$BUNDLE_PREFIX-composed.min.figma.js"
  "$BUNDLE_PREFIX.min.figma.js"
)
for _LAYOUT in chip surface-stack field row-item tiny control container composed; do
  BUNDLES_REL+=( "$BUNDLE_PREFIX-${_LAYOUT}.step0.min.figma.js" )
done
for _S in 1 2 3 4 5; do
  BUNDLES_REL+=( "$BUNDLE_PREFIX-doc.step${_S}.min.figma.js" )
done
BUNDLE_SOURCES=(
  "skills/create-component/templates/draw-engine.figma.js"
  "skills/create-component/templates/archetype-builders.figma.js"
)

BUNDLE_ABS_LIST=()
for BUNDLE_REL in "${BUNDLES_REL[@]}"; do
  BUNDLE_ABS="$REPO_ROOT/$BUNDLE_REL"
  BUNDLE_ABS_LIST+=("$BUNDLE_ABS")
  if [[ -f "$BUNDLE_ABS" ]]; then
    for SRC_REL in "${BUNDLE_SOURCES[@]}"; do
      # Shared doc ladder slices omit archetype-builders — only draw-engine matters.
      if [[ "$BUNDLE_REL" == *-doc.step*.min.figma.js ]] && [[ "$SRC_REL" == *archetype-builders* ]]; then
        continue
      fi
      SRC_ABS="$REPO_ROOT/$SRC_REL"
      if [[ ! -f "$SRC_ABS" ]]; then
        echo "    warn: bundle source missing: $SRC_REL"
        continue
      fi
      if [[ "$SRC_ABS" -nt "$BUNDLE_ABS" ]]; then
        STALE=$((STALE + 1))
        echo "    stale: $SRC_REL is newer than $BUNDLE_REL"
      fi
    done
  else
    STALE=$((STALE + 1))
    echo "    missing: $BUNDLE_REL (run 'npm run build:min')"
  fi
done

is_bundle() {
  local candidate="$1"
  for b in "${BUNDLE_ABS_LIST[@]}"; do
    if [[ "$candidate" == "$b" ]]; then return 0; fi
  done
  return 1
}

while IFS= read -r -d '' MIN; do
  # Skip the bundles — freshness was verified above against an explicit
  # source list.
  if is_bundle "$MIN"; then
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
