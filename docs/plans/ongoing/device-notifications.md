# Device notifications (push) — design and rollout

## Status

- **Updated:** 2026-09-14
- **Stage:** phase 1 merged (#337) and **live on dev** — the dev deploy is green
  and all push functions are ACTIVE on `villa-events`.

| Prerequisite | Dev | Beta | Prod |
|---|---|---|---|
| `APNS_AUTH_KEY` secret exists | ✅ placeholder `{}` | ✅ placeholder `{}` | ✅ placeholder `{}` |
| Real APNs `.p8` key in the secret | n/a | n/a | ⬜ |
| Android `google-services.json` committed (#344) | ✅ | n/a (sideload-only, no Android app) | ✅ |
| Push Notifications capability on the App ID | — | — | ✅ added via the ASC API (2026-09-14) |
| Time-sensitive capability on the App ID | — | — | ⬜ portal-only (Jaime); then restore the entitlement in `app.config.ts` |
| Play Data Safety declares device IDs | — | — | ⬜ after Android production review clears |
| Store binary carrying push | — | — | ⬜ needs the next promotion + `mobile-release` |

- **For iOS push to actually deliver in prod:** the APNs key must be created
  by **Jaime, the Apple Account Holder**. The Apple account is *Individual*,
  so only the Account Holder can use Certificates, Identifiers & Profiles —
  App Store Connect roles cannot grant it. At developer.apple.com → Keys: tick
  *Apple Push Notifications service*, Configure → Environment **Sandbox &
  Production** (dev builds use the sandbox gateway, store builds production),
  Key type **Team Scoped** (one key covers `.dev`, `.beta` and the store app).
  The `.p8` downloads once. Then
  replace prod's placeholder with `{"keyId":"…","privateKey":"<.p8 contents>"}`
  via `gcloud secrets versions add APNS_AUTH_KEY --data-file=- --project=cultuvilla-prod`.
  Until then iOS sends are skipped with a warning; Android is unaffected.
  A new secret version only takes effect on the next deploy of the push
  functions (v2 binds the version at deploy time).
- **The existing `AuthKey_533TUZ9L4M.p8` is NOT an APNs key** — `533TUZ9L4M` is
  `APPLE_ASC_KEY_ID`, the App Store Connect API key used by the release
  tooling. ASC API keys (Users and Access → Integrations) cannot authenticate to
  APNs; a push key is a separate key (Certificates, IDs & Profiles → Keys).

## Context

Before this change, "notifications" meant one thing: an append-only Firestore
log at `users/{uid}/notifications/{nid}`, rendered in the Buzón
([unified-inbox.md](../../decisions/unified-inbox.md)). Nothing ever reached the
device. Two consequences shaped the design:

1. **Every existing type was transactional** — a response to something the user
   had already done (their seat, their request, their comment). Nothing told a
   villager that something new had appeared in their pueblo, which is the entire
   reason a village app gets opened more than once a season.
2. **Push cannot be delivered over OTA.** `expo-notifications` is a config
   plugin, so it moves the native fingerprint; `runtimeVersion: 'fingerprint'`
   correctly refuses to serve it to installed binaries. Push ships in a store
   build or not at all.

## Decisions

### The notification log stays the single source of truth

Push is a **projection of the log, not a parallel channel**. One trigger,
`onNotificationCreated`, watches `users/{uid}/notifications/{nid}` and fans out
to the user's devices. Every one of the seven existing producers gained push
without learning that push exists, and the next producer gets it for free.

The alternative — a `notify()` helper each producer calls, dual-writing doc and
push — was rejected: two failure modes per call site, and the next producer
someone adds can forget to use it.

Deterministic notification ids (`signups_disabled_${eventId}`) keep working,
because a `set` over an existing id fires *update*, not *create*.

### Categories are derived, never stored

`notificationCategory(type)` is a pure lookup in
[NotificationCategory.ts](../../../packages/shared/src/models/notification/NotificationCategory.ts).
Storing a `category` field on the notification doc would have been a required
field added to a live collection — a converter tightening needing a
`pre-deploy` backfill across three environments, bought nothing, and would drift
from the type the moment someone edited one and not the other.

Same reasoning for preferences: `users/{uid}/preferences/notifications` is an
**optional** doc. Absent means `DEFAULT_NOTIFICATION_PREFS` (everything on).
That is not a retrocompat shim — the doc genuinely does not exist until a user
changes something, so there is no stale data to backfill and no converter that
can crash on an old account.

### Android and iOS each get their native transport

**The platform decides the transport.** `expo-notifications` returns an **FCM
registration token on Android but a raw APNs device token on iOS**, and FCM
cannot deliver to a raw APNs token. A single FCM path would have worked on
Android and silently never delivered on iOS. So:

| | Android | iOS |
|---|---|---|
| Token | FCM registration token | raw APNs device token |
| Transport | FCM HTTP v1 via `firebase-admin` | APNs HTTP/2 directly, token auth (`.p8`) |
| Native config | `google-services.json` | none — no `GoogleService-Info.plist` needed |
| User-facing mute | one **notification channel per category** (`mine`/`village`/`social`) | the in-app toggle only (no channel equivalent) |
| Urgency | `priority: 'high'` for `mine`, else `'normal'` | `interruption-level: 'time-sensitive'` + `apns-priority: 10` for `mine`, else `active` / `5` |
| Repeat suppression | `collapseKey` | `apns-collapse-id` (same string, truncated to 64 bytes) |
| Grouping | `notification.tag` | `thread-id` (same string) |
| Badge | launcher-managed | `aps.badge` = the Buzón's unread count |

Rejected alternatives:

- **`@react-native-firebase/messaging`** for FCM tokens on both platforms: a
  second push library whose Android messaging service competes with
  expo-notifications' for the same intents, plus static iOS frameworks.
- **Expo's push relay**: uniform, but it adds a US third-party processor for a
  Spanish app's notification content, loses collapse/thread control, and needs
  a second receipts-polling job to find dead tokens.

The platform split lives in exactly one place:
[PushEnvelope.ts](../../../packages/shared/src/models/notification/PushEnvelope.ts)
builds a platform-neutral envelope, then `toFcmAndroidMessage` /
`toApnsNotification` map it to each wire format. Both are typed structurally and
tested in the fast vitest suite; the FCM shape's assignability to firebase-admin's
`MulticastMessage` is checked at compile time at the send site. Channel ids ARE
the category ids, so the server's `channelId` and the client's
`setNotificationChannelAsync` cannot drift (a test asserts it).

Two iOS details that fail silently if wrong:

- **The APNs environment travels with the token** (`apnsEnvironment` on the
  device doc), read on the client from the binary's provisioning-profile
  entitlement via `expo-application` — never from JS config, because an OTA
  bundle built by `eas update` knows nothing about the binary it runs in.
  Sending a sandbox token to production APNs answers `BadDeviceToken`,
  indistinguishable from a dead token.
- **`time-sensitive` needs the
  `com.apple.developer.usernotifications.time-sensitive` entitlement**; without
  it iOS silently downgrades to `active`. It is **not declared yet**: the ASC API
  cannot enable the capability, so it waits on the Account Holder (see
  `app.config.ts`).

### Quiet hours, for broadcast only

A `pushQueue/{uid}__{notifId}` doc is created for every push, idempotently
(create-if-absent). This does double duty: it is the **at-least-once guard**
Eventarc requires, and the deferral mechanism. `mine` sends immediately;
`village` and `social` created between 22:00 and 08:00 Europe/Madrid get
`sendAfter` = the next 08:00 and are flushed by `flushPushQueue`.

A 03:00 "nuevo evento en Matabuena" is how a village app gets uninstalled. A
23:00 "se ha liberado tu plaza" is useful. Hence the split by category rather
than a global switch.

### Everything added to a village notifies it

One type, `village_entity_published`, carrying `entityKind` — not six
near-identical types. The set is the entity family from AGENTS.md: **event,
news, place, barrio, organization, festivalPoster, historyEntry**.

The subtlety is that "added to the village" is a different moment per kind:

| Kind | Fires on |
|---|---|
| event | create, `status: 'published'` |
| news, place, barrio, festivalPoster, historyEntry | create, `status: 'active'` (not hidden) |
| organization | **update** `pending → approved` — creation is a *request*, not a village-visible thing |

Fan-out reads `municipalities/{id}/members` and writes one notification doc per
member, excluding the actor, via BulkWriter with a deterministic id
(`village_entity_${kind}_${entityId}`). Push then happens through the same
`onNotificationCreated` path as everything else.

FCM **topics** per municipality were rejected: a topic cannot respect
per-category preferences, quiet hours, or a block list, and cannot be
unsubscribed server-side. At village scale (hundreds of members) the read cost
of token fan-out is not the constraint.

### Permission is asked at an earned moment, never at launch

iOS grants exactly one OS dialog, ever; a denial is only recoverable through a
trip to Settings. So the OS dialog is **always** preceded by an in-app sheet
explaining a concrete promise, and is only reached if the user says yes there.

- **Primary trigger:** the first successful event sign-up — highest intent, and
  the promise is specific and true ("te avisamos si se libera una plaza o si
  cambia algo").
- **Fallback:** joining a village, if never asked.
- **Capped at 2 soft asks, ever**, tracked in AsyncStorage.
- A permanent `Ajustes → Notificaciones` row is the recovery path, deep-linking
  to OS settings when permission is denied.

## Out of scope (deliberate)

- **Web push.** Web's job is the anonymous reader (AGENTS.md invariant 6);
  browser push needs a service worker fighting `output: 'single'`, and iOS
  Safari requires an installed PWA. App-only, with no wall on web.
- **Deleting the dead `organizer_request_created` enum value.** It was dropped
  as a producer by the unified-inbox change but pre-existing prod docs may carry
  it, so removing it from the schema is a converter tightening that would block
  a promotion at the conformance gate. It needs its own `pre-deploy` backfill —
  a separate change, on a hard-stop path.
- **Phase 2 types:** `comment_on_my_entity`, `org_member_joined`, and a
  digest/rollup for villages that publish many entities at once.

## Prerequisites before the deploy that ships this (human-only)

1. **`APNS_AUTH_KEY` in Secret Manager, in every env, BEFORE merging.** The
   push functions bind it, and a bound secret that does not exist fails the
   whole `firebase deploy` — every other function included. Value is JSON:
   `{"keyId":"ABC123DEFG","privateKey":"-----BEGIN PRIVATE KEY-----\n…"}` from
   Apple Developer → Keys → Apple Push Notifications service. The Team ID is
   not secret and lives in code.
   ```bash
   printf '%s' "$JSON" | gcloud secrets create APNS_AUTH_KEY --data-file=- --project=<project>
   ```
   dev/beta may use a placeholder (`{}`) — `sendApns` logs a warning and
   skips iOS rather than crashing.
2. **`google-services.json` per env** — done for dev and prod (#344), locked by
   `googleServices.test.ts`. Beta has no Android app and needs none.
3. **Time-sensitive notifications capability** on the `com.cultuvilla.app` App
   ID. EAS syncs capabilities for managed credentials on the next iOS build;
   verify it did.
4. **Play Console → Data Safety** must declare push.
5. **A store binary.** `expo-notifications` moves the native fingerprint, so
   none of this reaches installed apps over OTA: `mobile-release` dispatch on
   both platforms (see the `expo-native-rebuild` skill).

Web gets no push, deliberately and without a wall — see
[web-parity-not-a-build-rule.md](../../decisions/web-parity-not-a-build-rule.md).
The web build ships a `.web.ts` twin of the push client that never imports
`expo-notifications`; `check-web-export` confirms no native module leaks.

## Follow-ups

- **An Android status-bar icon.** Android renders the small icon as a white
  silhouette; without a dedicated monochrome asset some devices show a grey
  square. Add `icon` to the expo-notifications plugin once one is designed.
- **Delete `organizer_request_created`** with its own `pre-deploy` backfill
  (see Out of scope).
- Phase 2 types (see Out of scope).

## Revisit when

- Open rates show `village` broadcast is noisy in a large municipality → add a
  daily rollup instead of one push per entity.
- Token fan-out reads become measurable → reconsider topics for the broadcast
  category only, accepting the loss of per-user filtering.
