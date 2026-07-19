# Product analytics phase 2 — behavioral dashboard + ops monitoring

**Stage:** idea. Builds directly on the shipped
[observability foundation](../../decisions/observability-foundation.md).

## Problem

The observability foundation (v0.8.0) gave us three working pillars on the web
build: consent-gated Firebase Analytics, web crash/error capture bridged to Cloud
Error Reporting, and a structured server logger. That is enough to answer **"is
prod healthy?"** and **"are the four core funnels converting?"** — both via
Google's built-in consoles, no dashboard of our own.

It is **not** enough to answer **"how is production behaving?"** Today only four
`trackEvent` call sites exist (onboarding-complete, village-join, event-sign-up,
org-creation), all at conversion points. We have no visibility into what users
actually *do* — content they view, searches they run, invites they send,
notifications they open. And GA4's UI (sampling, 24–48h latency, no joins to our
domain data, cardinality caps on high-fan-out dimensions like `villageId`) can
never become a real behavioral dashboard on its own.

We want the **long-term-correct foundation from the start**, not a throwaway.
Developer time is not the constraint; getting the data architecture right is.

## The one fact that drives the sequencing

**GA4 → BigQuery export has no backfill.** It captures events only from the day
it is enabled, forward — there is no way to recover history from before. So the
cheapest correct move is to enable the export *early*, even before any dashboard
exists, so raw history accumulates while the instrumentation and dashboard work
proceeds. This is why Phase 0 below is "flip a switch now," ahead of the code
work.

## Decisions already settled (during brainstorming)

1. **Destination is BigQuery, not the GA4 UI.** GA4's console/Explorations become
   just one cheap view among several; the raw-event warehouse in BigQuery is the
   backbone everything else reads from. This **reverses one line** on the
   observability-foundation YAGNI list ("a custom analytics→BigQuery pipeline") —
   a deliberate graduation past launch scope, recorded here and to be folded back
   into the decision record when this ships.
2. **Full-engagement instrumentation**, not just conversion gaps.
3. **No parallel taxonomy doc.** `OBSERVABILITY_EVENTS` stays the single source of
   truth (it is already typed and review-gated by the `observability-conventions`
   skill). Any human-readable event dictionary is a **generated, derived
   artifact** — never hand-maintained — so it cannot diverge from what actually
   fires.
4. **Ops monitoring is a parallel track, not a competitor.** "Is prod healthy"
   (error rates, callable latency, alerting) and "how do users behave" are
   orthogonal; a mature app wants both.

## Approach — four phases

### Phase 0 — Enable GA4 → BigQuery export on prod (do first, immediately)

- Enable the native GA4 → BigQuery **streaming** export on the prod project
  (`cultuvilla-prod`), and optionally beta (`cultuvilla-beta`).
- No code. No dashboard yet. The point is only to **start banking raw history**
  before the no-backfill window costs us data.
- Record BigQuery dataset location + retention posture.
- **Cost note:** BigQuery bills on storage (~$0.02/GB/mo) and query bytes scanned
  (~$5/TB, first 1 TB/mo free). At village-app event volume this sits at or near
  the free tier; this is not a material cost.

### Phase 1 — Full-engagement instrumentation

Prerequisite for any behavioral dashboard; this is where the real code work lives.

- **Enrich `OBSERVABILITY_EVENTS` in place** — each entry carries metadata
  (description, param shape, which dashboard tile consumes it) instead of a bare
  `name: name` mapping. The const *is* the taxonomy.
- **Add ~15–25 one-line `trackEvent` call sites** across the surfaces we're
  currently blind to, each a new `<domain>.<action>.<outcome>` registered in the
  const:
  - content views — event / news / place / org / barrio detail opens
  - search performed + result tapped
  - invite sent / accepted
  - notification received / opened
  - key navigation transitions
- **Native analytics:** either activate the `@react-native-firebase/analytics`
  adapter behind the existing seam, or make an explicit web-first deferral note.
  (Decide during Phase 1 planning; web-first deferral is consistent with the rest
  of the product.)
- **Generated event dictionary:** a small script (e.g. `pnpm docs:events`) reads
  the enriched const and writes a Markdown table; CI can fail if the committed
  table is stale. Derived, never hand-edited.
- Honor the existing PII allowlist (`ALLOWED_CONTEXT_KEYS`) and the consent split
  — no new hashing/scrubbing at call sites; the server chokepoint stays the one
  place that transforms PII.

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

## Open questions for the implementation plan

- Native analytics activation now vs. explicit web-first deferral.
- Beta: enable BigQuery export there too, or prod-only?
- Exact event list + param shapes per surface (settled when enriching the const).
- Where the generated event-dictionary table lives and whether CI enforces
  freshness.

## Success criteria

- Raw GA4 events landing in BigQuery on prod, accumulating history (Phase 0).
- A Looker Studio dashboard answering "how is production behaving" with at least:
  content performance, a multi-step funnel with drop-off, and one domain-joined
  breakdown (e.g. conversion by village) that GA4's UI cannot produce.
- An ops dashboard + at least one live alert policy on prod error rate.
- `OBSERVABILITY_EVENTS` remains the single source of truth; the event dictionary
  is generated and cannot diverge.
