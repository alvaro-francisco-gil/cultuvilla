# Store metadata — Google Play & App Store

Everything the two consoles ask for that is **not** derivable from the code, in
one place, so the answer typed into a form is reviewable in git and identical
next release.

| File | Feeds |
|---|---|
| [listing-es-ES.md](listing-es-ES.md) | Play → Grow → Store listing · ASC → App Information + Version metadata |
| [play-declarations.md](play-declarations.md) | Play → Policy → **App content** (every item in the checklist) + Store settings |
| [app-store-declarations.md](app-store-declarations.md) | ASC → App Privacy, Age Rating, App Review Information |
| [assets.md](assets.md) | Graphic assets required by both stores |

The runbook for the *sequence* of external steps (developer account, signing
keys, tracks, the 12-tester closed test) stays in
[../plans/ongoing/store-release.md](../plans/ongoing/store-release.md). This
folder is the *content*; that file is the *process*.

## The rule that matters

**Every declaration here is a claim about the code.** Play's Data safety form
and Apple's privacy labels are enforced by comparing them against the shipped
binary's behaviour, and a mismatch gets the app pulled, not warned. So:

- Adding a permission, an SDK, or a new field on `users`/`persons` → update
  [play-declarations.md](play-declarations.md) and
  [app-store-declarations.md](app-store-declarations.md) **in the same PR**, and
  re-submit both forms at the next release.
- `blockedPermissions` in [apps/mobile/app.config.ts](../../apps/mobile/app.config.ts)
  is what keeps camera, microphone, background location and legacy storage out
  of the manifest. Removing a block is a declaration change.
- The privacy policy ([../legal/politica-de-privacidad.md](../legal/politica-de-privacidad.md),
  served at `/legal/privacy`) must be a superset of both forms.

## Known blockers before production

- **No in-app report/block flow.** Comments and news are user-generated
  (`EntityComments`), and `packages/i18n/messages/es.json` already carries
  `comments.report*` strings, but **no screen renders them** — the only
  moderation path is the admin-side `setContentVisibility` callable. Apple
  guideline 1.2 requires a report mechanism *and* a block-user mechanism for UGC
  apps, and Play's content rating questionnaire asks for it directly. This must
  ship before the App Store submission and before the Play production rollout.
- **No public account-deletion URL.** Deletion works in-app
  (Settings → Delete account → `deleteAccount`), but Play's Data safety form
  also wants a web URL. Either publish a `/legal/eliminar-cuenta` page on
  `cultuvilla.es` or point at the privacy policy's rights section.
