# Guest browsing — read the app without an account, gate on intent

## Context

The app forced sign-in at the root: an unauthenticated user landed on the login
screen and could see nothing. That's the wrong first impression for a discovery
app — a visitor should be able to browse a village's events, news, and orgs
before deciding to create an account. The question was where to put the wall:
block whole screens behind auth, or let everyone read and only stop them at the
moment they try to *do* something (register for an event, join an org, create
content).

## Decision

- **Read is open; auth gates actions, not screens.** The root redirects straight
  into `(tabs)`; the tab layout no longer redirects unauthenticated users away.
  The `village` and `profile` tabs intercept `tabPress` and call
  `gate.requireAuth(...)` instead of being unreachable. Guest-facing CTAs
  (event/org detail, event/news creation, the header menu) route through
  `gate.requireAuth` rather than rendering an authed-only control.
- **`persons` is publicly readable** (`firestore.rules`: `allow read: if true`).
  Guest browsing of events/orgs surfaces organizer/attendee personas, so persona
  reads can't require auth. Covered by an unauthenticated-read rules test.
- **Deferred-intent resume.** When a guest hits a gated action, the intent is
  saved (`pendingIntent.ts`) and the auth flow is entered; on successful sign-in
  `resolveIntentResume` (`authRoute.ts`) replays the original destination, so the
  user lands where they were trying to go, not on a generic home. `signOut`
  clears any pending intent.
- **Registration is a sheet, not a route.** `RegisterGateContext` +
  `RegisterSheet` present the sign-up prompt in place over whatever the guest was
  viewing, so the browsing context isn't lost behind a full navigation.

## Rejected alternative

- **Gate whole screens behind auth** (the prior behavior). Simpler to reason
  about but defeats the discovery goal — a visitor can't evaluate a village
  before committing to an account. Action-level gating keeps everything readable
  and only asks for identity when identity actually matters.

## What this binds

- New guest-reachable actions must go through `gate.requireAuth` and, when the
  action has a destination worth resuming, save a pending intent — don't hide the
  control or hard-redirect to login.
- Anything a guest can see (any collection reachable from a public screen) must
  have a rules read path that doesn't require auth; adding a new public surface
  means auditing its collections' read rules. `persons` public read is
  load-bearing here — don't re-gate it without re-gating guest browsing.
- The `intent → sign-in → resume` contract lives in `pendingIntent.ts` +
  `resolveIntentResume`; new auth entry points must clear/consume the intent so a
  stale one doesn't hijack a later sign-in.

## Revisit when

- A collection needs to stay private but appears on a guest surface → move that
  data behind an authed sub-view rather than opening its read rule.
- Abuse of unauthenticated reads (scraping) becomes a concern → App Check on the
  mobile client (see `app-check-rollout` plan) is the intended lever, not
  re-gating reads.
