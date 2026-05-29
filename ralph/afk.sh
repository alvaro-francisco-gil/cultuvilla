#!/bin/bash
# AFK loop runner — runs N Ralph iterations non-interactively, stopping early on
# sentinel `<promise>NO MORE TASKS</promise>`.
#
# Usage:
#   ./ralph/afk.sh <iterations>                           # all plans, requires clean tree
#   ./ralph/afk.sh <iterations> --in-worktree             # skip clean-tree check
#   ./ralph/afk.sh <iterations> --plan <slug>             # focus one plan
#   ./ralph/afk.sh <iterations> --plan <slug> --in-worktree
#
# Pre-conditions:
# - You're on `main` (or a worktree branched off it).
# - `claude` CLI on PATH.
# - You accept that the loop will create branches, run tests, and commit.
#
# Will NOT push to main, deploy, merge, force-push, amend, or bypass hooks.

set -eo pipefail

ITER=""
IN_WORKTREE=0
PLAN_FILTER="none"

while [ $# -gt 0 ]; do
  case "$1" in
    --in-worktree)
      IN_WORKTREE=1
      shift
      ;;
    --plan)
      if [ -z "$2" ]; then
        echo "--plan needs a slug" >&2
        exit 1
      fi
      PLAN_FILTER="$2"
      shift 2
      ;;
    *)
      if [ -z "$ITER" ]; then
        ITER="$1"
      else
        echo "Unknown argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [ -z "$ITER" ]; then
  echo "Usage: $0 <iterations> [--plan <slug>] [--in-worktree]" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ ! -f ralph/prompt.md ]; then
  echo "ralph/prompt.md not found — are you in the Cultuvilla repo root?" >&2
  exit 1
fi

if [ "$PLAN_FILTER" != "none" ] && [ ! -d "implementation-queue/$PLAN_FILTER" ]; then
  echo "implementation-queue/$PLAN_FILTER does not exist." >&2
  exit 1
fi

if [ "$IN_WORKTREE" -eq 0 ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree not clean. Commit/stash or rerun with --in-worktree." >&2
    git status --short
    exit 1
  fi
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$current_branch" = "main" ]; then
    echo "Refusing to run Ralph on protected branch $current_branch." >&2
    echo "Create or switch to a worktree first, or pass --in-worktree." >&2
    exit 1
  fi
fi

stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

queue_root="implementation-queue"
if [ "$PLAN_FILTER" != "none" ]; then
  queue_scope="$queue_root/$PLAN_FILTER"
else
  queue_scope="$queue_root"
fi

for ((i=1; i<=ITER; i++)); do
  echo ""
  echo "================================================================"
  echo "Ralph iteration $i / $ITER  —  plan: $PLAN_FILTER  —  $(date -Iseconds)"
  echo "================================================================"

  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")

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

  claude \
    --permission-mode acceptEdits \
    --print \
    --verbose \
    --output-format stream-json \
    --include-partial-messages \
    "PLAN FILTER: $PLAN_FILTER

Previous commits:
$commits

Queue snapshot:
$queue_snapshot

$prompt" \
    | grep --line-buffered '^{' \
    | tee "$tmpfile" \
    | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo ""
    echo "Ralph: no AFK tasks remaining in scope ($PLAN_FILTER). Stopped after $i iteration(s)."
    exit 0
  fi
done

echo ""
echo "Ralph: reached iteration cap ($ITER)."
