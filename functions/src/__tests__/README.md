# Cloud Functions tests

Two layers, kept in separate vitest configs so the unit layer never depends on emulators.

## Pure-helper unit tests — `__tests__/helpers/`

Tests for stateless helpers extracted out of handler bodies. No emulator, no
`firebase-admin` init. Goal: every pure rule the handler relies on is covered
here.

```bash
pnpm functions:test     # local, fast
```

Example: [`profileFormValidation.test.ts`](./helpers/profileFormValidation.test.ts) covers `ensureValidFieldShape` + `validateTransition` extracted from `updateCenso.ts`.

When adding a new function, extract the pure validation/decision logic into
`functions/src/helpers/` first, and test it here.

## Handler tests — `__tests__/handlers/`

Tests that exercise the actual exported Cloud Function via
[`firebase-functions-test`](https://firebase.google.com/docs/functions/unit-testing) against the Firestore + Auth emulators. Reserve these for behavior that
can only be observed via Firestore state (writes, queries, multi-doc effects).

```bash
pnpm test:functions     # root: boots emulators, runs vitest with the integration config
```

The setup file [`setup/admin.setup.ts`](./setup/admin.setup.ts) sets emulator env vars + initializes `firebase-admin` before any handler is imported. Reset emulator state in `beforeEach` via [`helpers/firestoreEmulator.ts`](./helpers/firestoreEmulator.ts) so each test starts empty.

Example: [`waitlistPromotion.test.ts`](./handlers/waitlistPromotion.test.ts) exercises `onRegistrationDeleted` — verifies waitlisted-deletion no-op, missing maxAttendees no-op, empty-waitlist no-op, and the happy-path promotion+notification.

## Layout

```
functions/src/__tests__/
├── helpers/
│   ├── firestoreEmulator.ts            (REST resetEmulators / clearFirestore)
│   └── profileFormValidation.test.ts   (pure-helper unit tests)
├── handlers/
│   └── waitlistPromotion.test.ts       (emulator-backed handler tests)
├── setup/
│   └── admin.setup.ts                  (env + admin init, loaded by integration config)
└── README.md
```
