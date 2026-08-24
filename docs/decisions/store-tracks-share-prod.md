# Every Play track ships one artifact against prod

**Decided 2026-08-24.** Ratifies what `mobile-release.yml` already did, and names
the two things that were previously only implicit: what `cultuvilla-beta` is for
once no binary points at it, and why the package name never splits per track.

## The decision

| Surface | Package | Firebase project | Distribution |
|---|---|---|---|
| Play `internal` / `closed` / `production` | `com.cultuvilla.app` | `cultuvilla-prod` | one artifact, promoted across tracks |
| `preview-beta` APK | `com.cultuvilla.app.beta` | `cultuvilla-beta` | sideload only — **never submitted** |
| `preview-dev` APK / dev client | `com.cultuvilla.app.dev` | `villa-events` | sideload only — **never submitted** |
| Web (`dev` / `beta` / `prod` hosting) | — | matching project | deployed on every promotion |

So **a store tester is a production user**. Their account, their village, the
events they publish — all real, all in `cultuvilla-prod`.

## Why every track points at prod

**Play's 12-testers-×-14-days rule is scoped to a package name.** Running a
closed test on `com.cultuvilla.app.beta` earns nothing toward releasing
`com.cultuvilla.app`. The clock that is currently running would have to be
restarted from zero.

**A non-prod dataset has nothing to test.** Of the villages with an activated
community overlay, one has real content. A tester dropped into `cultuvilla-beta`
opens an empty app; a tester in prod opens their own pueblo. For a product whose
entire value is *this village's* fiestas, the real dataset is not a hazard to be
sandboxed away — it is the thing under test.

**One artifact removes a class of release bug.** internal → closed → production
is the same AAB promoted, so "it worked on internal" is a statement about the
bytes that reach production, not about a sibling build.

## Why the package name never splits per track

This is the constraint that outranks the others, and it is the one Órdago paid
for. A separate package is a separate **install**, and four things are bound to
package identity rather than to the user:

- the FCM registration token (push silently stops, or doubles up);
- the Google Sign-In **Android** OAuth client, which is keyed on package name +
  signing SHA-1 (sign-in fails on the sibling install);
- Android App Links verification, keyed on `assetlinks.json` per package (shared
  links open the browser instead of the app, with no error anywhere);
- the home-screen icon — the tester now has two apps and no way to tell which one
  their data is in.

Órdago carries `com.ordago.app.beta` on its own Play listing and handles push
continuity with a client-side token refresh on every sign-in. That works, but it
is a fix for a problem cultuvilla simply does not have to create. **A closed
tester who reaches production here receives an ordinary update over the same
install, signed by the same Play app signing key.** There is no migration, so
there is nothing to get wrong.

Enforced by [storeRelease.test.ts](../../packages/shared/test/ci/storeRelease.test.ts):
no submit profile may name anything but `com.cultuvilla.app`, and any build
profile carrying a non-`prod` `APP_ENV` must be internal-distribution.

## What `cultuvilla-beta` is for

It stops being a *client* environment and remains a **backend staging**
environment. Its job is unchanged and load-bearing:

- the `develop → beta` promotion deploys rules, indexes and functions there
  first, so a broken deploy fails on beta rather than on prod;
- the conformance gate and the backfill gate run against **beta's live data**
  before prod is ever touched — that is what makes a required-field migration
  safe;
- `cultuvilla-beta.web.app` is the human smoke test of the web build.

What it no longer is: the thing a store tester talks to.

## If beta should point at the beta DB later

The wish is on the record — and the switch is deliberately cheap, because the
per-env Firebase plumbing in `app.config.ts` already works end to end and is
exercised by the sideload profiles on every dev cycle. Flipping a build to beta
data is one `APP_ENV` value.

**The constraint is the distribution channel, not the config.** The cheap lever
is the `preview-beta` **sideload APK** — internal, no store involvement, no user
migration. The expensive lever is a Play track on a `.beta` package, which costs
a second listing, a second Data Safety and content-rating submission, a second
Android OAuth client, a second `assetlinks.json` fingerprint, a restarted 14-day
clock, and the entangled-install failure mode above.

So: route a future beta-data build through sideloading. If it ever genuinely has
to go through Play, that is a decision to reopen this document with, not a
config change to make quietly.
