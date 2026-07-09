# Collection-group list reads: `registrations` stays `userId`-scoped; `members` is open to any authenticated user

## Context

On mobile cold-start, two boot-time reads threw `permission-denied` and rendered
tabs blank: `getUserMemberships` (a `collectionGroup('members')` query, Pueblo
tab) and `getUserRegistrationsAcrossEvents` (a `collectionGroup('registrations')`
query, Profile tab). Both were diagnosed by attributing each denial to a labelled
call site via a dev-only `withFirestoreErrorLog(label, op)` wrapper, then covered
RED→GREEN with `@firebase/rules-unit-testing`.

The original resolution scoped **both** collection groups to
`where('userId', '==', uid)` and kept the rules owner-only. The read-only user
profile screen (`/user/[uid]`) later needed to show **another** user's village
memberships, which an owner-only `members` rule forbids — forcing a deliberate
divergence for `members` only.

## Decision

- A Firestore **collection-group `list` query is authorized only if every
  document it *could* return passes the rule.** The rule cannot inspect a query's
  `where` clause; it is evaluated per candidate document. So the only two
  expressible postures for a per-user subcollection CG list are (a) owner-scoped —
  `resource.data.userId == request.auth.uid`, which authorizes *only*
  `where('userId','==', self)` — or (b) open — `isAuthenticated()`, which
  authorizes listing **any** user's rows (and an unscoped full dump). There is no
  "any single userId" middle ground.

- **`registrations` → posture (a), owner-scoped.** Registration rows are not
  individually public; leaking them would expose who signed up for what. The query
  must carry `where('userId','==', uid)`. See the `registrations collection-group`
  block in `registrationRules.test.ts` (scoped-succeeds + unscoped-fails).

- **`members` → posture (b), open to any authenticated user.** Chosen so a public
  profile can list a user's village (and organization) memberships. This is safe
  because the underlying member docs are **already** individually world-readable
  (`allow read: if true` on both `municipalities/{id}/members/{uid}` and
  `organizations/{orgId}/members/{uid}`); opening the CG list only adds
  *enumeration* of already-public data, not new disclosure. The accepted cost is
  that any authenticated user can also dump all member rows unfiltered. The shared
  `match /{path=**}/members/{userId}` rule covers **both** municipality and
  organization members, so org membership became enumerable too — intentional. See
  the `members collection-group` block in `villageMemberRules.test.ts`
  (own-succeeds, other-user-succeeds, anonymous-fails).

## What this binds

- A new collection-group read of a per-user subcollection defaults to posture (a):
  scope the query with `where('userId','==', uid)` and ship a rules test covering
  scoped-succeeds + unscoped-fails. Only move to posture (b) when the underlying
  docs are already individually public **and** a feature needs cross-user listing —
  and document the enumeration tradeoff, as done here.
- `members` list is now a public-enumeration surface. Do not put anything on a
  member doc that isn't safe for any authenticated user to read/enumerate.
- The dev-only deny-attribution path (`withFirestoreErrorLog` + the
  `unhandledrejection` hook in `firebaseInit.ts`) stays in place as the tool for
  enumerating future denials.

## Revisit when

- A member doc gains a field that shouldn't be world-enumerable → the open
  `members` posture must be reconsidered (split the sensitive data elsewhere, or
  move `members` back to owner-scoped and find another path for public profiles).
- A new per-user collection-group query is added → default to owner-scoped
  (posture a) with RED/GREEN coverage; justify any move to the open posture.
