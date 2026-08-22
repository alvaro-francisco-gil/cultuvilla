# Product analytics — behavioral dashboard + ops monitoring

Builds directly on the shipped
[observability foundation](../../decisions/observability-foundation.md).

## Status

- **Updated:** 2026-08-21
- **Stage:** Phase 0 (GA4→BigQuery export) **unverified and currently unverifiable from a laptop**; Phase 1 (engagement instrumentation) shipped to dev/beta/prod.
- **Branch:** n/a — Phase 1 merged; Phase 0 is a console/infra action, no branch.
- **Done:** Phase 1 full-engagement instrumentation merged to `develop` (PR #150, merge `295a6d9e`, 2026-07-19). **Google Analytics enabled on all three Firebase projects (dev/beta/prod) on 2026-07-19** — until then no GA4 property existed and no web analytics data was being collected anywhere (the app config carries no `measurementId`; the SDK relies on the runtime dynamic-config fetch, which only resolves once GA is enabled server-side). GA4→BigQuery export **linked** on `cultuvilla-prod` 2026-07-19 — EU (`eu-west`), Daily + Streaming.
- **Next:** (1) **Restore a credential that can read `cultuvilla-prod`** — see Blockers; nothing else in Phase 0 can be checked until then. (2) Confirm the `analytics_<propertyId>` dataset actually provisioned and that events land once traffic + consent occur. (3) Prove the chain end-to-end with a little consented traffic on the prod web build. (4) Decide whether to add explicit `measurementId` to `firebaseConfigPerEnv`.
- **Blockers:** **The documented verification path is dead.** This plan's handoff said `matabuena.unida@gmail.com` holds `roles/owner` on prod and can therefore `bq` the export. As of 2026-08-21 it does not: `gcloud projects describe cultuvilla-prod` as that account returns *"does not have permission to access projects instance [cultuvilla-prod] (or it may not exist)"*, and `bq ls --project_id=cultuvilla-prod` consequently returns an empty listing rather than an error — which reads as "no datasets" and is **not** evidence either way about the export. Also still true: the GA4→BQ link is console-only (no CLI), and the GA Data/Realtime API over CLI is blocked because Google deprecated the `analytics.readonly` scope on gcloud's default OAuth client — so verification has to go through BigQuery, which is exactly what the lost access blocks.
- **Handoff:** **Do not read an empty `bq ls` as "the export never provisioned"** — with no project access it is silent, not authoritative. Re-grant a prod-reading role (or verify from the Firebase/GCP console under the account that owns prod) before drawing any conclusion. **Phase 2's Firestore→BigQuery export must use the same region (`eu-west`)** or cross-location joins break. **Open finding:** `measurementId` is absent from `apps/mobile/app.config.ts` `firebaseConfigPerEnv` for all envs — analytics relies on the Firebase JS SDK's runtime dynamic-config fetch (works now that GA is enabled, but worth making explicit). Dev's GA property is under a different Google account (not visible to the prod/beta account).

## Rollout status

| Step | Dev (`villa-events`) | Beta (`cultuvilla-beta`) | Prod (`cultuvilla-prod`) |
|---|---|---|---|
| Prereq — Google Analytics enabled on Firebase project | ✅ | ✅ | ✅ |
| Phase 1 — engagement instrumentation (code) | ✅ | ✅ | ✅ |
| Phase 1 — DebugView smoke verified | ⏳ | — | — |
| Phase 0 — GA4→BigQuery export enabled | ⏳ | ⬜ | ⚠️ linked 2026-07-19; provisioning unverified — no prod access (see Blockers) |
| Phase 2 — Firestore→BigQuery export | ⬜ | ⬜ | ⬜ |
| Phase 2 — Looker Studio dashboard | ⬜ | ⬜ | ⬜ |
| Phase 3 — log-based metrics + Cloud Monitoring dashboard | ⬜ | ⬜ | ⬜ |
| Phase 3 — alert policies | ⬜ | ⬜ | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked (note inline) · — n/a

Phase 1 code rides `develop → beta → prod` via the normal promotion flow, so the beta/prod cells flip as releases promote — no separate work.

## Problem

The observability foundation (v0.8.0) gave us three working pillars on the web
build: consent-gated Firebase Analytics, web crash/error capture bridged to Cloud
Error Reporting, and a structured server logger. That is enough to answer **"is
prod healthy?"** and **"are the core funnels converting?"** — both via
Google's built-in consoles, no dashboard of our own.

It is **not** enough to answer **"how is production behaving?"** GA4's UI
(sampling, 24–48h latency, no joins to our domain data, cardinality caps on
high-fan-out dimensions like `villageId`) can never become a real behavioral
dashboard on its own. Phase 1 added the missing engagement events; the remaining
phases stand up the warehouse and dashboard that consume them.

We want the **long-term-correct foundation from the start**, not a throwaway.
Developer time is not the constraint; getting the data architecture right is.

## The one fact that drives the sequencing

**GA4 → BigQuery export has no backfill.** It captures events only from the day
it is enabled, forward — there is no way to recover history from before. So the
cheapest correct move is to enable the export *early*, even before any dashboard
exists, so raw history accumulates while the dashboard work proceeds. This is why
Phase 0 is "flip a switch now," ahead of the dashboard.

## Decisions already settled

1. **Destination is BigQuery, not the GA4 UI.** GA4's console/Explorations become
   just one cheap view among several; the raw-event warehouse in BigQuery is the
   backbone everything else reads from. This **reverses one line** on the
   observability-foundation YAGNI list ("a custom analytics→BigQuery pipeline") —
   a deliberate graduation past launch scope. **Fold this into
   `docs/decisions/observability-foundation.md` when Phase 2 ships.**
2. **Full-engagement instrumentation** (Phase 1, shipped) — not just conversion
   gaps. One generic `content.detail.viewed` (+`entityKind`/`entityId`);
   `search.query.submitted`/`search.result.selected` logging shape not query text;
   `org.join.*` + `org.invite.shared`. Notifications deferred (surface is changing).
3. **No parallel taxonomy doc.** `OBSERVABILITY_EVENTS` stays the single source of
   truth (typed, review-gated by the `observability-conventions` skill). Any
   human-readable event dictionary is a **generated, derived artifact** — never
   hand-maintained — so it cannot diverge from what actually fires. (Deferred until
   the const carries per-event metadata; Phase 1 kept it flat name→string.)
4. **Ops monitoring is a parallel track, not a competitor.** "Is prod healthy"
   (error rates, callable latency, alerting) and "how do users behave" are
   orthogonal; a mature app wants both.
5. **EU data location.** The BigQuery analytics dataset is created in the `EU`
   multi-region (Spanish user base / data-residency). This is irreversible per
   dataset, so it is fixed at link time.

## Approach — four phases

### Phase 0 — Enable GA4 → BigQuery export on prod ⏳ (do first)

- Enable the native GA4 → BigQuery export on `cultuvilla-prod` via the GA4 Admin
  BigQuery Links flow (console-only; no CLI). Data location **EU**. Enable **Daily**
  (always); **Streaming** optional (near-real-time, marginal cost at this volume).
- No code, no dashboard yet — the point is to **start banking raw history** before
  the no-backfill window costs us data.
- Optionally enable on dev (`villa-events`) too, purely to validate the plumbing
  end-to-end fast (dev has test traffic + the DebugView smoke).
- **Done when:** an `analytics_<propertyId>` dataset exists in `cultuvilla-prod`
  BigQuery and is accumulating `events_intraday_`/`events_` tables.
- **Cost:** BigQuery bills on storage (~$0.02/GB/mo) and query bytes scanned
  (~$5/TB, first 1 TB/mo free). At village-app volume this sits at/near the free
  tier.

### Phase 1 — Full-engagement instrumentation ✅ (shipped, PR #150)

Merged. Details in the code (`OBSERVABILITY_EVENTS`, the entity-detail/search/org
call sites) and the `observability-conventions` skill. **Web-first deferral chosen**
for native analytics; the generated event dictionary was deferred (kept the const
flat for a minimal slice). Remaining tail: the manual DebugView smoke to confirm
events fire on the web build.

### Phase 2 — The behavioral dashboard

- **Firestore → BigQuery export** via the Firebase extension, so event rows can be
  **joined to real domain data** (village size, org type, member role). This join
  is the thing GA4's UI can never do and the whole reason BigQuery is the
  destination.
- **Dashboard on SQL** — Looker Studio to start (free, Google-native), reading
  from BigQuery: engagement, content performance, discovery paths, funnel
  drop-off, cohorts/retention broken down by village/org/role.

### Phase 3 — Ops / health track (parallel to 1–2)

- **Log-based metrics** on key callables (error rate, p95 latency, success ratio)
  derived from the structured Cloud Logging the server logger already emits.
- **Cloud Monitoring dashboard** for prod health.
- **Alert policies** (email/Slack) on error-rate spikes and latency regressions —
  graduating the foundation's "alerting is manual for now" into alerts-as-code.

## Explicitly still YAGNI

Deferred until data volume or a concrete need justifies them: dbt / warehouse
modeling, session replay, distributed tracing, a bespoke dashboard *service*
(Looker Studio suffices), server-side OpenTelemetry.

## Open questions

- Beta: enable BigQuery export there too, or prod-only? (Leaning prod-only for the
  real signal; dev optional for plumbing validation.)
- Streaming vs daily-only export (leaning daily + streaming; revisit if cost shows).
- When to enrich `OBSERVABILITY_EVENTS` with per-event metadata + generate the
  dictionary (Phase 2, once the dashboard reveals which fields matter).

## Success criteria

- Raw GA4 events landing in BigQuery on prod, accumulating history (Phase 0).
- A Looker Studio dashboard answering "how is production behaving" with at least:
  content performance, a multi-step funnel with drop-off, and one domain-joined
  breakdown (e.g. conversion by village) that GA4's UI cannot produce.
- An ops dashboard + at least one live alert policy on prod error rate.
- `OBSERVABILITY_EVENTS` remains the single source of truth; any event dictionary
  is generated and cannot diverge.
