#!/usr/bin/env bash
# Per-repo Firebase CLI wrapper.
#
# Pins which logged-in Google account `firebase` uses for this repo so the
# global `firebase login:use` setting (which leaks across projects) doesn't
# matter. The account is read from `.firebase-account` at the repo root
# (gitignored) — each operator sets their own. Run `firebase login --add`
# once with that account; this wrapper supplies `--account=<email>` on every
# subsequent call.
#
# Usage:
#   bash scripts/firebase.sh deploy --only firestore:rules --project dev
#   bash scripts/firebase.sh use
#   bash scripts/firebase.sh login:list
#
# Setup:
#   echo 'your.email@example.com' > .firebase-account
#   firebase login --add  # interactive — sign in with your.email@example.com
#
# Override:
#   FIREBASE_ACCOUNT=other.email@example.com bash scripts/firebase.sh ...
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ACCT="${FIREBASE_ACCOUNT:-}"

if [ -z "$ACCT" ] && [ -f "$ROOT/.firebase-account" ]; then
  ACCT="$(head -n1 "$ROOT/.firebase-account" | tr -d '[:space:]')"
fi

if [ -z "$ACCT" ]; then
  cat >&2 <<'EOF'
[firebase.sh] No Firebase account configured for this repo.

  Pick the account that owns the Cultuvilla dev project (villa-events) and:

    echo 'your.email@example.com' > .firebase-account
    firebase login --add   # sign in with that same email

  Or set FIREBASE_ACCOUNT inline for a single command:

    FIREBASE_ACCOUNT=your.email@example.com bash scripts/firebase.sh ...
EOF
  exit 1
fi

# `firebase --account` works for every subcommand and overrides login:use.
exec firebase --account "$ACCT" "$@"
