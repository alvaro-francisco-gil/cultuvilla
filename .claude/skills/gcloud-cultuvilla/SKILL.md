---
name: gcloud-cultuvilla
description: Project-specific gcloud facts for cultuvilla. Use whenever running gcloud against this repo (Cloud Logging, IAM, Secret Manager, BigQuery). Encodes the named-config + dev-default-prod-explicit rule and the auth split between gcloud and the firebase CLI. Several sections are TODO until the matching infrastructure lands (Secret Manager, observability salt, IAM).
---

# gcloud — cultuvilla specifics

## Auth

- The gcloud and Firebase CLIs have **independent** credential stores. `firebase login` does not authenticate gcloud, and vice versa. Cloud Logging / IAM / Secret Manager operations need gcloud auth; Firestore deploys via Firebase CLI use Firebase auth.
- If multiple gcloud accounts are credentialed on this machine, switch with `gcloud auth list` + `gcloud config set account <email>` before working on cultuvilla.

## Named config

- Use a dedicated `cultuvilla` named gcloud configuration when working on this repo: `gcloud config configurations activate cultuvilla`. Create it if missing: `gcloud config configurations create cultuvilla`.
- Active project on this config is intentionally `villa-events` (dev). Beta and prod **must** be addressed with explicit `--project=cultuvilla-beta` / `--project=cultuvilla-prod` on every command.
- Rationale: unscoped commands default to dev so a typo or autocomplete misfire can't reach prod. Defensive even against own shell history.

## Project map

| Profile | Project ID | Notes |
|---|---|---|
| development | `villa-events` | Active gcloud project on the `cultuvilla` named config. Cultuvilla web reads from this when `NEXT_PUBLIC_FIREBASE_*` is set to dev values. |
| beta | `cultuvilla-beta` | Manual deploy refused by `firestore-deploy` skill — beta is for promotion via CI / user-insistence, not ad-hoc. |
| prod | `cultuvilla-prod` | Same — promotion only. |

## Cloud Logging

When investigating a Cloud Function failure that the user can repro on dev:

```bash
gcloud logging read 'resource.type=cloud_function AND jsonPayload.handler="<handler-name>"' \
  --project=villa-events --limit=50 --format='value(timestamp,severity,jsonPayload.message)'
```

The `handler` field is set by the v2 logger convention (see the `cloud-function-logging` skill). Without it, filters fall back to log-name grep which is noisy.

For beta/prod, add `--project=cultuvilla-beta` or `--project=cultuvilla-prod` explicitly.

## When deploying functions

- Dev deploys are fine ad-hoc — use the `firestore-deploy` skill.
- Beta/prod deploys: defer to CI when it's wired up, or require explicit user confirmation. Don't run them silently.

## Secret Manager

Cultuvilla uses Secret Manager (enabled on `villa-events`). Cloud Functions read
secrets via `defineSecret` from `firebase-functions/params`.

### Secrets that exist

| Secret | Env | Consumed by | Notes |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | dev (`villa-events`) | `staticMap`, `geocodeSearch` (`functions/src/maps/`) | A **restricted** Google Maps Platform key: API-target-restricted to Maps Static API + Geocoding API only. Server-side only — never shipped to clients. **Not yet created on beta/prod** — must be created per-project before those functions deploy there. |

### How functions read it

`functions/src/maps/secret.ts` declares `export const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY')`. Each consuming function binds it in its options (`secrets: [GOOGLE_MAPS_API_KEY]`) and reads it at runtime with `GOOGLE_MAPS_API_KEY.value()`. On `firebase deploy`, the CLI auto-grants `roles/secretmanager.secretAccessor` on the secret to the functions runtime SA (`<project-number>-compute@developer.gserviceaccount.com`) — no manual IAM step.

### Creating a Maps key + secret (the flow used for dev)

API restriction (not app/referrer restriction) is the right protection here: the key lives only in Secret Manager and is used server-to-server by Cloud Functions, whose egress IPs are dynamic.

```bash
gcloud config configurations activate cultuvilla   # dev = villa-events
gcloud services enable static-maps-backend.googleapis.com geocoding-backend.googleapis.com apikeys.googleapis.com --project=villa-events
# Mint a key restricted to the two Maps APIs; capture ONLY the keyString to a 0600 temp file.
TMP=$(mktemp); chmod 600 "$TMP"
gcloud services api-keys create \
  --display-name="cultuvilla maps dev (staticMap+geocode proxy)" \
  --api-target=service=static-maps-backend.googleapis.com \
  --api-target=service=geocoding-backend.googleapis.com \
  --project=villa-events --format="value(response.keyString)" > "$TMP"
# Store as the firebase-managed secret (value never echoed), then shred the file.
bash scripts/firebase.sh functions:secrets:set GOOGLE_MAPS_API_KEY --data-file "$TMP" --project dev
shred -u "$TMP"
```

For **beta/prod**, repeat with `--project=cultuvilla-beta` / `--project=cultuvilla-prod` and `--project beta` / `--project prod` on the firebase call. CI deploys the function code, but the secret must already exist in that project or the deploy fails.

### Rotate

```bash
# add a new version (old versions stay until disabled/destroyed); functions pick up the latest on next deploy/cold-start
printf '%s' "$NEW_KEY" | gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=- --project=villa-events
```

Prefer `firebase functions:secrets:set GOOGLE_MAPS_API_KEY --data-file <file>` when rotating a firebase-managed secret, so the CLI re-binds versions on deploy.

### Rules

- **Never** `gcloud secrets versions access` (or otherwise print) a secret value — it pollutes shell history and logs. Read length / metadata only when verifying.
- When piping a key into a secret, write it to a `chmod 600` temp file and `shred -u` it; never pass the value as a command-line argument.

## TODO — fill in when the matching infrastructure lands

- [ ] **Observability salt.** If/when an observability event pipeline is added, document the per-env `OBSERVABILITY_USER_ID_SALT` (or equivalent) and the rotation policy — see the analogous ordago section as a template.
- [ ] **IAM grants for service accounts.** No bespoke service accounts beyond default Firebase ones today. When custom ones are introduced, list the role grants and the `gcloud projects add-iam-policy-binding` invocation per env.
- [ ] **BigQuery dataset(s) for analytics.** None today; document if added.

Until these land, the active sections above are sufficient.
