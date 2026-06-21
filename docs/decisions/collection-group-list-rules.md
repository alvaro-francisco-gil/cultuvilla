# Collection-group list reads must be `userId`-scoped to pass rules

## Context

On mobile cold-start, two boot-time reads threw `permission-denied` and rendered
tabs blank: `getUserMemberships` (a `collectionGroup('members')` query, Pueblo
tab) and `getUserRegistrationsAcrossEvents` (a `collectionGroup('registrations')`
query, Profile tab). Both were diagnosed by attributing each denial to a labelled
call site via a dev-only `withFirestoreErrorLog(label, op)` wrapper, then covered
RED→GREEN with `@firebase/rules-unit-testing`.

## Decision

- A Firestore **collection-group `list` query is authorized only if every
  document it *could* return passes the rule.** An unconstrained
  `collectionGroup('members')` / `collectionGroup('registrations')` list is
  therefore denied — it could return other users' rows. The query must carry
  `where('userId', '==', uid)` so the rule can authorize the narrowed set.
- These two reads are the regression contract: see the `members collection-group`
  block in `villageMemberRules.test.ts` and the `registrations collection-group`
  block in `registrationRules.test.ts`. Each asserts the `userId`-scoped query
  **succeeds** and the unscoped list **fails**.
- The fix lives in the **query shape**, not in loosening the rule. A rule wide
  enough to pass an unscoped CG list would leak every user's rows.

## What this binds

- Any new collection-group read of a per-user subcollection must include the
  `where('userId', '==', uid)` clause that the matching rule predicate depends
  on — and ship with a rules test covering both the scoped-succeeds and
  unscoped-fails cases.
- The dev-only deny-attribution path (`withFirestoreErrorLog` + the
  `unhandledrejection` hook in `firebaseInit.ts`) stays in place as the tool for
  enumerating future denials.

## Revisit when

- A new per-user collection-group query is added — extend the same RED/GREEN
  coverage rather than relaxing the rule.
