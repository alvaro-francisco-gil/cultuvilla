# Branch → environment CI deploy pipeline

**Goal:** Adopt a three-tier `develop → beta → main` branch model where merging into
each branch automatically deploys the Firebase backend **and hosting** to that
branch's environment via CI, replacing today's manual laptop deploys.

## Status

- **Updated:** 2026-07-02
- **Stage:** dev fully live; beta/prod plumbing in place, awaiting their first deploy.
- **Branch:** repo `develop` (PR #31 merged); `main`/`beta` protected.
- **Done:** WIF pools/providers + keyless `gha-deployer` SAs on all 3 projects;
  GitHub Environments dev/beta/production (prod gated on review) with WIF + Firebase
  web config vars; reusable `deploy-firebase.yml` + 3 callers; CI retargeted;
  first **dev deploy green** (villa-events.web.app serving HTTP 200); default branch
  flipped to `develop`; branch protection on `beta`/`main`; AGENTS/ENVIRONMENTS/decision
  docs + `dev-mode-ask-worktree-or-main` memory updated.
- **Next:** before the first beta/prod deploy — create the `GOOGLE_MAPS_API_KEY`
  secret in `cultuvilla-beta`/`cultuvilla-prod`, and (for Google Sign-In) create the
  web OAuth client per env and set `GOOGLE_WEB_CLIENT_ID` env var. Then dry-run a
  `develop → beta` promotion PR, then `beta → main`.
- **Blockers:** none technical; beta/prod deploys will fail at the functions step
  until their `GOOGLE_MAPS_API_KEY` secret exists.
- **Handoff:** deploy SAs needed 5 role/API rounds to work — all folded into
  `scripts/setup-ci-deploy-wif.sh` (idempotent). WIF trusts only this repo, branch-scoped.
  CI can't push `.github/workflows/*` over the gh HTTPS token (no `workflow` scope) —
  push those via the SSH remote. `main` uses `enforce_admins=true` (no direct pushes at
  all); `beta` uses `false`.

## Rollout status

| Step | Dev | Beta | Prod |
|---|---|---|---|
| WIF pool/provider + keyless SA | ✅ | ✅ | ✅ |
| GitHub Environment + WIF/Firebase vars | ✅ | ✅ | ✅ |
| `GOOGLE_WEB_CLIENT_ID` (Google Sign-In) | ✅ | ⬜ | ⬜ |
| `GOOGLE_MAPS_API_KEY` secret exists | ✅ | ⬜ | ⬜ |
| Deploy workflow | ✅ | ✅ | ✅ |
| First successful deploy | ✅ | ⬜ | ⬜ |
| Branch protection | n/a (default) | ✅ | ✅ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked

## Context

The repo already has the *environments* half of a mature multi-env setup (three
Firebase projects aliased in [.firebaserc](../../.firebaserc), an `APP_ENV`
fail-fast selector, explicit `deploy:*:{dev,beta,prod}` scripts, and
[docs/ENVIRONMENTS.md](../ENVIRONMENTS.md)). What it lacks — and what the sibling
`ordago-apps` repo demonstrates — is the *branches + automated promotion* half:
a branch per environment, and CI that turns "merge into a branch" into "deploy to
the matching environment."

Today all work goes **direct to `main`** and deploys run from an operator's laptop
via [scripts/firebase.sh](../../scripts/firebase.sh) (interactive `--account`
auth). This plan moves daily work to `develop`, makes `main` mean production, and
moves deploys into GitHub Actions using per-env service accounts.

The [dev-beta-prod-environments decision](../decisions/dev-beta-prod-environments.md)
already anticipated this under "Revisit when: CI-driven deploys are added → gate
prod behind a protected GitHub Environment with manual approval." This plan
evolves that note: dev now auto-deploys on **`develop`** (not `main`), because
`main` becomes prod.

### Decisions already made (with the user)

- **Scope:** full three-tier `develop → beta → main`.
- **Deploy model:** CI-driven on merge (not manual, not hybrid).
- **Mobile store shipping (EAS build/submit):** out of scope for now — backend +
  Firebase hosting only.
- **Hosting:** each branch deploys hosting to *its own* environment
  (`develop`→`villa-events.web.app`, `beta`→`cultuvilla-beta.web.app`,
  `main`→`cultuvilla-prod.web.app`).

## Design / approach

### Branch → environment mapping

```
develop  →  villa-events     (dev)   ← new default branch; daily work lands here
  │  PR + green CI + review
  ▼
beta     →  cultuvilla-beta  (beta)  ← internal QA on a real web URL
  │  PR + green CI + review
  ▼
main     →  cultuvilla-prod  (prod)  ← production; protected + manual approval gate
```

### What CI deploys per branch ("backend + hosting")

On merge to a branch, its deploy workflow pushes, **in this order** (backend-first,
so schema/permissions land before code that relies on them):

1. `firestore:rules` + `storage` rules
2. `firestore:indexes`
3. `functions`
4. `hosting` (Expo web export → the env's `*.web.app`)

This reuses the existing scripts almost verbatim: `deploy:rules:*`,
`deploy:indexes:*`, `deploy:functions:*`, `deploy:hosting:*` — the only change is
*who* runs them (CI service account) and *how they authenticate* (see below).

### Auth: Workload Identity Federation, not SA keys or `firebase.sh`

`firebase.sh` pins an interactive Google `--account`; that cannot run in CI. CI
authenticates via **Workload Identity Federation (WIF)** — no long-lived secret is
stored anywhere. GitHub Actions mints a short-lived OIDC token; a one-time trust
binding in GCP (this repo + this branch → the env's deployer SA) lets that token
impersonate the SA. This is the deliberate "configure once, never rotate" choice:

- SA JSON keys are long-lived secrets that leak, need rotation, and break outright
  if the org later enables `iam.disableServiceAccountKeyCreation`. WIF has none of
  these failure modes.
- Setup is bounded and permanent: one workload identity **pool** + **provider**,
  then bind each of the three deployer SAs to the repo. `google-github-actions/auth@v2`
  consumes it in a couple of lines per workflow.

Each environment still has a dedicated **deployer service account** (impersonated,
not keyed). CI runs `firebase deploy --project <alias> --non-interactive` directly,
bypassing `firebase.sh`. Local deploys keep using `firebase.sh` unchanged.

Minimum roles per deployer SA (to be confirmed during IAM setup):
- `roles/firebasehosting.admin`
- `roles/cloudfunctions.developer` (+ `roles/iam.serviceAccountUser` on the
  functions runtime SA)
- `roles/datastore.indexAdmin` + Firestore/Storage **rules** admin
- `roles/serviceusage.serviceUsageConsumer`

### Build-time env vars in CI

The hosting web bundle inlines `NEXT_PUBLIC_FIREBASE_*_{DEV,BETA,PROD}` at export
time. The test job today uses `ci-placeholder` values (it never talks to
Firebase), but the **deploy** jobs need the *real* per-env web config as GitHub
secrets. This means **beta/prod `.env` values must be filled** before those
branches can deploy — a prerequisite, not part of the workflow code. (These are
Firebase Web SDK config values, [public by design](https://firebase.google.com/docs/projects/api-keys)
— they live as repo/environment secrets for convenience, not because they're
secret.)

### Resolved operational decisions

- **Dev deploys fully auto** on every `develop` merge, with the `[skip-deploy]`
  escape hatch for docs-only merges. No manual gate on dev.
- **`main` forbids direct pushes.** Branch protection allows merges only from a PR
  (normally from `beta`); hotfixes go through a short-lived branch → PR → `main`
  like everything else. The rules enforce the flow so nobody has to remember it.
- **Per-env `concurrency` group with `cancel-in-progress: false`** — never kill a
  half-finished deploy (especially prod).
- **Rollback stays documented, not automated:** `firebase hosting:rollback` for
  hosting; functions redeploy from the previous green `main` SHA. Prod's approval
  gate is the primary guard.

### Concepts imported from ordago-apps

- **Backend-first deploy order** (above).
- **`[skip-deploy]` escape hatch** in the merge commit / PR title, plus path
  filters, so docs-only merges don't trigger a (slow) hosting export + deploy.
- **Function-deploy verification** (ordago's `deploy-functions.js` checks every
  expected function actually deployed, catching silent skips). Optional; worth it
  as the function count grows.
- **Branch protection**: require green CI + review before merge into `beta`/`main`;
  `main` additionally behind a GitHub Environment with a manual approval reviewer.

## Out of scope

- EAS build / auto-submit to TestFlight & Play, native config-per-profile store
  identities, version-announce pollers. (Revisit when the mobile app actually
  ships to stores.)

## Proposed file structure

| File | Action | Notes |
|---|---|---|
| `.github/workflows/ci.yml` | modify | Retarget triggers `[main]` → `[develop, beta, main]` + PRs into any of them. Logic unchanged. |
| `.github/workflows/deploy-dev.yml` | create | On push to `develop`: backend + hosting → `villa-events`. |
| `.github/workflows/deploy-beta.yml` | create | On push to `beta`: backend + hosting → `cultuvilla-beta`. |
| `.github/workflows/deploy-prod.yml` | create | On push to `main`: backend + hosting → `cultuvilla-prod`, behind protected GitHub Environment. |
| `.github/workflows/mobile-ci.yml` | modify | Retarget its `push`/`paths` triggers to the new branch set. |
| `AGENTS.md` | modify | § Development workflow: `main` is now prod; daily work targets `develop`. Update worktree/branch conventions. |
| `docs/ENVIRONMENTS.md` | modify | Add the branch→env mapping and the CI-deploy story; note SA secrets + disaster recovery. |
| `docs/decisions/dev-beta-prod-environments.md` | modify | Update "Revisit when" → resolved; record the develop/beta/main mapping. |
| GitHub repo settings | manual | Set default branch = `develop`; branch protection on `beta`/`main` (no direct push to `main`); create `production` Environment + approval reviewer; add per-env `NEXT_PUBLIC_FIREBASE_*_*` secrets. No SA-key secrets. |
| GCP (three projects) | manual | Create the three deployer SAs (no keys); one WIF pool + provider; bind each SA to the repo/branch. Grant roles above. |

## Migration / cutover sequence (draft)

1. **Provision** the three deployer SAs in GCP and add all secrets to GitHub.
2. **Fill** beta/prod `.env` (or secrets) so hosting builds have real config.
3. **Create `develop`** from current `main`; push. Add the three deploy workflows
   + retarget `ci.yml`/`mobile-ci.yml` on `develop` first and verify dev deploy.
4. **Flip default branch** to `develop`; enable branch protection on `beta`/`main`.
5. **Dry-run promotion**: `develop → beta` PR, watch beta deploy; then `beta → main`
   PR, watch prod deploy through the approval gate.
6. **Update docs** (AGENTS.md, ENVIRONMENTS.md, decision) in the same change set.
7. **Announce** the workflow change (direct-to-main is retired).

## Tasks

### Stage 1 — GCP + GitHub prerequisites (manual, off critical path for YAML)

- [ ] Fill real beta/prod Firebase web config (blank today in `apps/mobile/.env`)
      and add them as per-env GitHub secrets (`NEXT_PUBLIC_FIREBASE_*_{BETA,PROD}`).
- [ ] Create the three deployer service accounts (dev/beta/prod), **no keys**, with
      the roles listed in "Proposed file structure".
- [ ] Create one WIF pool + GitHub OIDC provider; bind each deployer SA to
      `alvaro-francisco-gil/cultuvilla` scoped to its branch.
- [ ] Verify: a throwaway workflow on `develop` can impersonate the dev SA and run
      `firebase projects:list --project dev`.

### Stage 2 — Branches + CI retarget

- [ ] Create `develop` from current `main`; push.
- [ ] Retarget `ci.yml` and `mobile-ci.yml` triggers to `[develop, beta, main]` + PRs.
- [ ] Confirm CI runs green on `develop`.

### Stage 3 — Deploy workflows

- [ ] `deploy-dev.yml`: on push to `develop`, WIF-auth as dev SA, deploy
      rules→indexes→functions→hosting to `villa-events`. `[skip-deploy]` honored;
      `concurrency: deploy-dev` / `cancel-in-progress: false`.
- [ ] `deploy-beta.yml`: same shape → `cultuvilla-beta` on push to `beta`.
- [ ] `deploy-prod.yml`: same shape → `cultuvilla-prod` on push to `main`, wrapped
      in the `production` GitHub Environment (manual approval).
- [ ] (Optional) Function-deploy verification step that asserts every expected
      function deployed.

### Stage 4 — Repo settings + cutover

- [ ] Flip default branch to `develop`.
- [ ] Branch protection: `beta` and `main` require green CI + review; `main` forbids
      direct pushes; `main` bound to the `production` Environment.
- [ ] Dry-run: `develop → beta` PR (watch beta deploy), then `beta → main` PR (watch
      prod deploy through the approval gate).

### Stage 5 — Docs + convention updates (same change set)

- [ ] `AGENTS.md` § Development workflow: `main` = prod, daily work targets
      `develop`; branch from `develop` into worktrees, never edit the `main`-pinned
      checkout.
- [ ] `docs/ENVIRONMENTS.md`: add branch→env mapping, the CI-deploy story, WIF setup,
      and rollback runbook.
- [ ] `docs/decisions/dev-beta-prod-environments.md`: resolve the "Revisit when"
      note; record the develop/beta/main mapping + WIF choice.
- [ ] Update the `dev-mode-ask-worktree-or-main` memory to reference `develop`.
- [ ] Announce that direct-to-main is retired.
