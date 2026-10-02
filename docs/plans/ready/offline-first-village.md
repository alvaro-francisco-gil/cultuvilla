# Offline-first — the whole village on the device

**Priority:** high — the main reason the app feels slow
**Gate:** none
**Next:** land layer 1 (SDK seam, native SDKs) once android-e2e is green on it, then move the hottest reads to listeners (layer 2, `useVillageHome` first)

## Goal

The app opens instantly, and opens **offline**, showing every public section
of the user's villages from the device, then refreshes live. Today every
screen fetches from the network on each focus, with only an in-memory cache:
the Firestore JS SDK has no persistent cache on React Native (no IndexedDB).

## Why not a query cache (TanStack Query)

It caches query *results* keyed by screen. Caching the whole village and
opening offline would mean building a second database beside Firestore —
invalidation, schema versioning, size limits (AsyncStorage caps at 6 MB on
Android by default) — with two caches that disagree. Firestore already ships a
persistent document cache, cache-backed queries, offline write queueing and
live sync; the JS SDK on RN just cannot use it.

## Layers, in order

### 1. Native Firebase SDKs — built

- Every client Firebase import goes through `packages/shared/src/firebase/sdk/`
  (firestore, auth, functions, storage): a JS-SDK file for Node and a
  `.native.ts` twin that Metro picks on device. One service codebase, two SDKs;
  the shared emulator tests keep running unchanged.
- Auth, Functions and Storage move with Firestore: native Firestore only sees
  the native Auth user.
- Persistence on (`initializeFirestore(app, { persistence: true })`).
- Verified at bundle time: an Android export contains no `@firebase/*` module
  and resolves every seam file to its native twin.
- Divergences handled: native `uploadBytes` is unimplemented (wrapped over
  `uploadBytesResumable`); error codes are prefixed differently
  (`firebaseErrorCode()`); the shared package was bundled twice (`src` + `dist`)
  and is now one copy.
- Native → store build, not OTA. Android is exercised by Maestro; iOS first
  compiles on the next build.

### 2. Cache-first reads

- One-shot `getDocs` (89 call sites) become listeners through
  `useFirestoreQuery` / `useFirestoreDoc` hooks (ordago has both): cache
  answers in milliseconds, the server pushes updates.
- Delete the 36 `useFocusEffect` reload sites as each screen moves over;
  `useVillageHome` is the first and biggest.
- `getCountFromServer` call sites become cache-friendly (stored counters or
  local counts) — a server count cannot answer offline.

### 3. Village sync

- On launch and on foreground, warm the cache for the user's member villages
  plus the last village viewed as a guest: events, news, orgs, places, barrios,
  history, carteles, vocabulary, and member-only data where the user is a member.
- Prefetch the images of the visible sections into the `expo-image` disk cache.
- v1 is plain queries (Matabuena ≈ 1.4k docs, affordable today). Optimise later
  with `updatedAt` delta queries or Firestore bundles served from the CDN —
  same app shape.

## Product decisions (taken 2026-10-02)

- Plain document writes queue offline (Firestore does it). Callables
  (registration, joins, approvals) need the server: offline they show
  "Sin conexión" — capacity and authority cannot be decided offline.
- Sign-out clears the local cache (`clearPersistence`): it holds member-only data.
- Offline state is a quiet banner ("Sin conexión — mostrando datos guardados"),
  never a blocking screen.

## Risks

- `withConverter` + Zod converters on RNFirebase — the spike's whole point.
- A long tail of JS-SDK assumptions (ordago's migration had one).
