# Testing in Cultuvilla

Four layers, three of which need the Firebase Emulator Suite.

| Layer | Where it lives | Runner | Needs emulator | Command |
|-------|----------------|--------|----------------|---------|
| **Unit (shared)** | `packages/shared/test/models/` + `packages/shared/test/services/` | vitest (`vitest.config.ts`) | No | `pnpm test` |
| **Unit (functions)** | `functions/src/__tests__/helpers/` | vitest (`functions/vitest.config.mjs`) | No | `pnpm functions:test` |
| **Integration** | `packages/shared/test/integration/` | vitest (`vitest.config.integration.ts`) | Yes (firestore + auth) | `pnpm test:integration` |
| **E2E — Firestore rules** | `packages/shared/test/e2e/` | vitest (`vitest.config.e2e.ts`) using `@firebase/rules-unit-testing` | Yes (firestore) | `pnpm test:rules` |
| **E2E — Cloud Functions** | `functions/src/__tests__/handlers/` | vitest (`functions/vitest.config.integration.mjs`) + `firebase-functions-test` | Yes (firestore + auth) | `pnpm test:functions` |

## Quick start

```bash
pnpm test               # fast unit tests, no emulator
pnpm test:integration   # spins up firestore+auth emulators, runs shared integration tests
pnpm test:rules         # firestore.rules e2e tests
pnpm test:functions     # cloud functions tests
pnpm test:emulators     # all three emulator-backed suites in sequence
```

The emulator-backed scripts call `scripts/run-tests-with-emulators.mjs`, which:
1. Spawns `firebase emulators:start` in the background
2. Waits for the relevant ports (8080 firestore, 9099 auth, 5001 functions)
3. Runs the test command
4. Shuts the emulator suite down on exit

Prerequisites for emulator-backed tests: Node 20+, Java 17+ (for the Firestore emulator), and `firebase-tools` (already a root devDependency).

## Layout

```
packages/shared/test/
├── models/                       # pure unit tests (existing)
├── services/                     # mock-based service-logic tests (existing)
├── integration/                  # NEW: emulator-backed roundtrips
│   └── villageRoundtrip.test.ts  #   example: write → read via the firestore emulator
├── e2e/                          # NEW: firestore.rules tests
│   └── villageRules.test.ts      #   example: read public, write requires admin
├── setup/
│   ├── integration.setup.ts      # sets FIRESTORE_EMULATOR_HOST etc. before any import
│   └── e2e.setup.ts              # same, scoped to rules tests
├── helpers/
│   ├── testFirebase.ts           # dedicated client app: getTestDb(), getTestAuth()
│   └── firebaseEmulator.ts       # REST resetEmulators() / clearFirestore()
├── factories/
│   ├── villageFactory.ts         # makeVillage(overrides)
│   └── userFactory.ts            # makeTestUid(), createAuthUser()
└── README.md

functions/src/__tests__/
├── helpers/
│   └── profileFormValidation.test.ts  # pure-helper unit tests (no emulator)
├── handlers/
│   └── waitlistPromotion.test.ts      # emulator-backed handler tests
├── setup/
│   └── admin.setup.ts                 # env vars + admin.initializeApp() for handlers
└── README.md
```

## Conventions

- **Reset between tests**, don't share state. `beforeEach(() => resetEmulators())` for integration tests, `beforeEach(() => env.clearFirestore())` for rules tests.
- **Factories return data, tests persist.** A factory must never know about Firestore; that keeps unit tests cheap.
- **Never import from `packages/shared/src/firebase`** in tests. Use `test/helpers/testFirebase.ts` so the production client app stays untouched.
- **Rules tests bypass rules to seed** with `env.withSecurityRulesDisabled()`, then exercise the rule under the role being tested.
- **Project id for tests** defaults to `cultuvilla-test` (integration / functions) and `cultuvilla-rules-test` (rules). Overridable via `TEST_PROJECT_ID`.

## CI

`.github/workflows/ci.yml` runs two jobs:

1. **`ci`** — lint + typecheck + unit + build. Fast, runs on every push/PR.
2. **`emulator-tests`** — boots Java + emulators, runs the three emulator-backed suites in sequence. Slower; can be split into separate jobs later if runtime becomes an issue.

## Adapted from

Patterns mirror the structure used in [ordago-apps](https://github.com/) (Vitest + Firebase emulator suite, REST-based reset, factory/helper split). Differences: cultuvilla has no React Native app, so all the Jest/RN-specific scaffolding is dropped.
