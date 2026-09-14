# Web parity is not a build rule — the app wins by being better, not by web being worse

## Context

`apps/mobile/` ships to iOS, Android **and** the web (Expo web export → Firebase
Hosting, cultuvilla.es). iOS 1.0.0 went live on 2026-09-04; Android is still in
Play's closed track. The natural next question was "we're going app-first now, so
how much should we take out of the web?"

That question contained a false premise and a wrong ordering, both worth writing
down so they don't get re-litigated every few months.

**There is only one codebase.** The entire web-specific surface is 3 `.web.*`
override files and 27 `Platform.OS === 'web'` branch sites across 20 files, out of
~35,500 lines of app code — under 1% divergence, already fenced by
`pnpm app:check-web-compat`, `pnpm app:check-web-export` and the
`mobile-web-compat` skill. "Keeping web and app in sync" is not a cost we pay.

**The web cannot be removed anyway.** Three commitments already depend on it:
share links must resolve as real web routes or the WhatsApp preview dies
([og-share-link-previews.md](og-share-link-previews.md)); `/descarga` is printed on
a QR that must never be reprinted ([qr-descarga.md](qr-descarga.md)); and until
Play production is live, the web *is* the Android app.

## Decision

Two levers were being conflated. They are separated permanently:

- **Parity as a build rule — dropped.** A feature does **not** have to work on web
  to be considered done. New work may ship app-only when the web version would be
  a compromise or a blocker. This removes nothing from anybody; it only stops web
  from holding a veto over native capabilities.
- **Access restriction — rejected as policy.** A flow that already works on web is
  **not** blocked there to push people toward the app. No walls, no
  "continúa en la app" interstitial in front of a working action.

**The app earns its install by being better, not by web being worse.** Restriction
is a tool for a cost we are not paying, and it would land hardest on exactly the
visitor we most want: someone who got a link in a WhatsApp family group, on a
phone, with no app installed, who wanted to sign up for the fiesta. Some of those
people install; some just leave. Blocking suppresses the very participation that
makes the app worth having.

**The ordering that follows: make the app better first.** As of this decision the
app is the same code with a home-screen icon — there is no `expo-notifications`,
no FCM, nothing. The Buzón ([unified-inbox.md](unified-inbox.md)) is a Firestore
log at `users/{uid}/notifications` with a UI and **no transport**, so a villager
learns their solicitud was approved only if they happen to open the app. Web is
exactly as good at that as native is. Restricting web today would push people
toward a destination that is not yet better.

Push notifications are therefore the highest-ROI item on the board: the data model
already exists, only the transport is missing, and it is the one thing the web
build genuinely cannot match (iOS Safari web push requires a PWA install; we ship
an SPA).

**Web's job is the anonymous reader.** The two audiences worth protecting — the
WhatsApp link recipient and Google search — are both anonymous and read-only.
Nothing about that job requires taking writes away.

## Natural drift replaces limiting

With parity dropped as a rule, the app accumulates what web never gets: push,
native camera flow, offline read, haptics, native pickers, later widgets. Web does
not degrade; the app improves. The destination is the same as a restriction
strategy, without the conversion loss, without engineering walls, and with nothing
to reverse if the bet is wrong.

## Where limiting is nearly free, if ever wanted

Housekeeping, not strategy — and neither is a licence to touch participation:

- **Admin and moderation surfaces.** Low volume, expert users, no acquisition
  cost, real maintenance cost. Already treated as lower-investment (AGENTS.md
  permits hardcoded Spanish there).
- **Flows genuinely worse on web** — camera-heavy ones, where the web path is a
  compromise rather than a feature.

Not signup, not creation, not comments, not vocabulario.

## Rejected alternatives

- **Restrict participation on mobile-web, redirect to the app.** Rejected: costs
  conversions in a demographic where install friction is real, requires per-flow
  engineering plus i18n plus tests to build the wall and again to remove it, and
  cannot be justified while the app has no capability the web lacks. Also breaks
  desktop entirely — nobody installs an iOS app from a laptop.
- **A separate web codebase (Next.js or similar).** Rejected: it would *create*
  the two-codebases-to-sync problem this decision observes we do not have.
- **Remove web routes.** Rejected: share links and SEO depend on every read route
  resolving, and `/descarga` is printed.

## What this binds

- Do not add a `requireAuth`-style app handoff that blocks a working web action.
- Do not gate a new feature on "but it must work on web" — ship it app-only and
  say so in the PR.
- Web read routes are permanent. A new entity's detail route must resolve on web.
- Anything that improves anonymous read on web (SEO, share previews, first paint)
  is *more* valuable under this decision, not less — web is now purely a funnel.

## Revisit when

- A **specific** web flow has a measurable maintenance cost **and** negligible web
  usage. Both halves, with numbers from the platform split. Absent that, parity
  stays by default because it is cheap.
- Push notifications ship and the platform split becomes knowable after public
  launch — that is the first moment there is real data to reason from.
