#!/bin/bash
# Run ONE iteration of the Ralph loop in this repo, interactively.
#
# Usage:
#   ./ralph/once.sh                       # consider all plans
#   ./ralph/once.sh --plan <plan-slug>    # focus on one plan (matches implementation-queue/<slug>/)
#
# Pre-conditions:
# - You're on `main` or in a worktree branched off `main`.
# - You have a clean working tree (the loop will create its own branch).

set -eo pipefail

PLAN_FILTER="none"
if [ "$1" = "--plan" ] && [ -n "$2" ]; then
  PLAN_FILTER="$2"
  if [ ! -d "implementation-queue/$PLAN_FILTER" ]; then
    echo "implementation-queue/$PLAN_FILTER does not exist." >&2
    exit 1
  fi
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ ! -f ralph/prompt.md ]; then
  echo "ralph/prompt.md not found — are you in the Cultuvilla repo root?" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Commit or stash before running Ralph." >&2
  git status --short
  exit 1
fi

commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")

# Snapshot of pending slices — Ralph re-reads files itself; this is just to seed context.
queue_root="implementation-queue"
if [ "$PLAN_FILTER" != "none" ]; then
  queue_scope="$queue_root/$PLAN_FILTER"
else
  queue_scope="$queue_root"
fi

queue_snapshot=""
if compgen -G "$queue_scope/*/[0-9]*.md" > /dev/null || compgen -G "$queue_scope/[0-9]*.md" > /dev/null; then
  for f in $(find "$queue_scope" -type f -name "[0-9]*.md" ! -path "*/done/*" | sort); do
    queue_snapshot+="--- $f ---"$'\n'
    queue_snapshot+="$(head -n 15 "$f")"$'\n\n'
  done
else
  queue_snapshot="(no slices in $queue_scope)"
fi

prompt=$(cat ralph/prompt.md)

claude --permission-mode acceptEdits \
  "PLAN FILTER: $PLAN_FILTER

Previous commits:
$commits

Queue snapshot (filename + first 15 lines each):
$queue_snapshot

$prompt"
