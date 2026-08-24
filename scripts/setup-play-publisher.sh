#!/usr/bin/env bash
#
# Mint the Play publishing service account and hand its key to GitHub Actions,
# so `beta-build-and-submit.yml` can submit to Play's closed track unattended.
#
# Sibling of setup-ci-deploy-wif.sh. Unlike that one this CANNOT be keyless:
# `eas submit` (and fastlane underneath it) authenticate to the Play Developer
# API with a service-account JSON key file. There is no Workload Identity path,
# which is the whole reason this script has to fight the org policy below.
#
# THE ORG POLICY. constraints/iam.disableServiceAccountKeyCreation is enforced
# on org 1005684282225 (set 2026-04-25). It does NOT necessarily reach the
# project you are targeting: `cultuvilla-prod` has no parent — it sits outside
# that org entirely — so its effective policy is unset and `keys create` works
# with no exemption at all. Only `cultuvilla-beta` is inside the org.
# So the exemption is applied ONLY when the effective policy is actually
# enforced, and re-armed only if this script was the thing that disabled it.
# Blindly calling disable-enforce fails with a confusing setOrgPolicy denial on
# an out-of-org project, which is exactly what happened the first time.
#
# What it does NOT do — and cannot, because Play Console has no API for it:
# linking the GCP project to Play and granting the account Release Manager.
# Do that first; the script tells you if you have not.
#
#   gcloud auth login cultuvilla.app@gmail.com
#   bash scripts/setup-play-publisher.sh                 # dry run
#   bash scripts/setup-play-publisher.sh --apply
#
set -euo pipefail

PROJECT="${PROJECT:-cultuvilla-prod}"
SA_NAME="${SA_NAME:-play-publisher}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
SECRET_NAME="GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
run() {
  if [ "$APPLY" = "1" ]; then
    echo "+ $*"
    "$@"
  else
    echo "  would run: $*"
  fi
}

account="$(gcloud config get-value account 2>/dev/null || true)"
say "Account: ${account:-<none>} · Project: ${PROJECT}"
if [ "$account" != "cultuvilla.app@gmail.com" ]; then
  echo "!! Expected cultuvilla.app@gmail.com — that is the identity with access to"
  echo "   villa-events / cultuvilla-beta / cultuvilla-prod. Run:"
  echo "     gcloud auth login cultuvilla.app@gmail.com"
  echo "     gcloud config set account cultuvilla.app@gmail.com"
  exit 2
fi

say "1. Enable the Play Developer API"
run gcloud services enable androidpublisher.googleapis.com --project="$PROJECT"

say "2. Create the service account (idempotent)"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1; then
  echo "  already exists: $SA_EMAIL"
else
  run gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Play publisher (EAS submit)" \
    --description="Used by beta-build-and-submit.yml to upload AABs to Play" \
    --project="$PROJECT"
fi

say "3. Exempt this project from the key-creation ban — only if it is enforced"
ENFORCED="$(gcloud resource-manager org-policies describe \
  iam.disableServiceAccountKeyCreation --project="$PROJECT" --effective \
  --format='value(booleanPolicy.enforced)' 2>/dev/null || true)"
DISABLED_BY_US=0
if [ "$ENFORCED" = "True" ]; then
  echo "  enforced here — adding a project-scoped exemption"
  run gcloud resource-manager org-policies disable-enforce \
    iam.disableServiceAccountKeyCreation --project="$PROJECT"
  DISABLED_BY_US=1
else
  echo "  not enforced on ${PROJECT} — nothing to exempt, skipping"
fi

say "4. Mint the key into a 0600 temp file (never echoed, never committed)"
TMP="$(mktemp)"; chmod 600 "$TMP"
trap 'shred -u "$TMP" 2>/dev/null || rm -f "$TMP"' EXIT
run gcloud iam service-accounts keys create "$TMP" \
  --iam-account="$SA_EMAIL" --project="$PROJECT"

say "5. Store it as the GitHub secret"
if [ "$APPLY" = "1" ]; then
  gh secret set "$SECRET_NAME" < "$TMP"
  echo "  set $SECRET_NAME ($(wc -c < "$TMP") bytes)"
else
  echo "  would run: gh secret set $SECRET_NAME < <keyfile>"
fi

say "6. Re-arm the policy — only if step 3 was the thing that turned it off"
if [ "$DISABLED_BY_US" = "1" ]; then
  run gcloud resource-manager org-policies delete \
    iam.disableServiceAccountKeyCreation --project="$PROJECT"
else
  echo "  nothing to re-arm (never disabled by this run)"
fi

say "Done."
cat <<EOF

Still MANUAL — Play Console has no API for these:

  Google no longer requires linking the developer account to a Cloud project
  (developers.google.com/android-publisher/getting_started), so there is no
  "Setup -> API access" step any more. Grant the service account like a user:

  1. https://play.google.com/console/developers/users-and-permissions
  2. "Invite new users" -> email: ${SA_EMAIL}
  3. "App permissions" tab -> add Cultuvilla -> tick "Release apps to testing
     tracks" (that is the exact permission name; it covers closed testing and
     deliberately does NOT allow publishing to production).
  4. "Invite user".

Verify end to end afterwards:
  gh workflow run beta-build-and-submit.yml -f track=closed
EOF
