# Guest browsing — read the app without an account, gate on intent

## Context

The app forced sign-in at the root: an unauthenticated visitor saw nothing. Wrong
first impression for a discovery app — a visitor should be able to evaluate a
village before committing to an account.

## Decision

- **Read is open; auth gates actions, not screens.** Nothing is hidden behind a
  sign-in wall. A guest browses freely and is stopped only at the moment they try
  to *do* something (register for an event, join an org, create content), via a
  `requireAuth` gate at the action.
- **A guest-visible collection must have a rules read path that doesn't require
  auth.** `persons` in particular is publicly readable, because guest browsing of
  events/orgs surfaces organizer/attendee personas — so persona reads can't be
  authed.
- **Deferred-intent resume.** A gated action saves its intent before entering the
  auth flow; on successful sign-in the original destination is replayed, so the
  user lands where they were going, not on a generic home. Sign-out clears any
  pending intent.

## Rejected alternative

- **Gate whole screens behind auth** (the prior behavior). Simpler, but defeats
  the discovery goal — a visitor can't evaluate a village before committing.
  Action-level gating keeps everything readable and asks for identity only when
  identity actually matters.

## What this binds

- Adding a new guest-reachable surface means auditing its collections' read rules
  for an unauthenticated path. `persons` public read is load-bearing — don't
  re-gate it without re-gating guest browsing.
- New guest-reachable actions gate at the action (`requireAuth`) and, when they
  have a destination worth resuming, save a pending intent — don't hide the
  control or hard-redirect to login.
- New auth entry points must clear/consume the pending intent, so a stale one
  can't hijack a later sign-in.

## Revisit when

- A collection must stay private but appears on a guest surface → move that data
  behind an authed sub-view rather than opening its read rule.
- Scraping of unauthenticated reads becomes a concern → App Check on the mobile
  client (see the `app-check-rollout` plan) is the intended lever, not re-gating
  reads.
