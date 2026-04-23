#!/usr/bin/env bash
# Propagate every skills/** file to the local Claude marketplace cache so that
# agent invocations see the same content the workspace has. Required because
# edits made in the workspace do not automatically flow into the cache.
#
# Usage:
#     bash scripts/sync-cache.sh
#
# Override the cache path with $CLAUDE_CACHE when the marketplace lives in a
# non-default location (e.g. WSL, alternate user profile, CI runner).
#
# Uses rsync when available (single atomic mirror). Falls back to a pure-bash
# implementation (rm -rf + cp -r) when rsync isn't on PATH, which is the common
# case on Windows / Git Bash. Both paths produce the same mirror semantics as
# `rsync -a --delete`.
set -euo pipefail

DEFAULT_CACHE="$HOME/.claude/plugins/marketplaces/local-desktop-app-uploads/labs-design-ops"
CACHE="${CLAUDE_CACHE:-$DEFAULT_CACHE}"

if [[ ! -d "$CACHE" ]]; then
  echo "error: cache directory not found: $CACHE" >&2
  echo "       set CLAUDE_CACHE=/path/to/labs-design-ops if installed elsewhere." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/skills"
DEST="$CACHE/skills"

mkdir -p "$DEST"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.DS_Store' "$SRC/" "$DEST/"
  FILE_COUNT=$(find "$SRC" -type f ! -name '.DS_Store' | wc -l | tr -d ' ')
  echo "synced $FILE_COUNT files (via rsync) to $DEST"
else
  # Portable fallback — emulates `rsync -a --delete` by wiping the destination
  # directory contents and copying the source tree in place.
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -r "$SRC/." "$DEST/"
  find "$DEST" -name '.DS_Store' -delete 2>/dev/null || true
  FILE_COUNT=$(find "$SRC" -type f ! -name '.DS_Store' | wc -l | tr -d ' ')
  echo "synced $FILE_COUNT files (via cp fallback) to $DEST"
fi

# Project bootstrap files live at repo root; Claude Code loads CLAUDE.md from the
# plugin / project directory. Mirror them to the marketplace cache root so a
# session opened on ~/.claude/plugins/.../labs-design-ops gets the same context
# as a git clone of this repository.
for f in CLAUDE.md memory.md AGENTS.md; do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    cp "$REPO_ROOT/$f" "$CACHE/$f"
  fi
done
echo "synced CLAUDE.md, memory.md, AGENTS.md (if present) to $CACHE"
