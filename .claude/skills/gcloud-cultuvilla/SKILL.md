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

## TODO — fill in when the matching infrastructure lands

- [ ] **Secret Manager.** Cultuvilla does not currently use Secret Manager. When secrets are introduced (e.g. for the future mobile app, Stripe, or first-party observability), add a section here covering:
  - Which secrets exist in which env.
  - How Cloud Functions read them via `defineSecret`.
  - The rotate command (`gcloud secrets versions add <name> --data-file=- --project=<project>`).
  - The "never `secrets versions access` the value" rule (don't pollute shell history).
- [ ] **Observability salt.** If/when an observability event pipeline is added, document the per-env `OBSERVABILITY_USER_ID_SALT` (or equivalent) and the rotation policy — see the analogous ordago section as a template.
- [ ] **IAM grants for service accounts.** No bespoke service accounts beyond default Firebase ones today. When custom ones are introduced, list the role grants and the `gcloud projects add-iam-policy-binding` invocation per env.
- [ ] **BigQuery dataset(s) for analytics.** None today; document if added.

Until these land, the active sections above are sufficient.
