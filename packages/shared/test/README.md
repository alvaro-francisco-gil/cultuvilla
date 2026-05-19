# `@cultuvilla/shared` tests

Three layers, each with its own vitest config and runner.

| Layer | Location | Config | Command | Needs emulators |
|-------|----------|--------|---------|-----------------|
| **Unit (models)** | `test/models/` | `vitest.config.ts` | `pnpm test` | No |
| **Unit (services, mocked)** | `test/services/` | `vitest.config.ts` | `pnpm test` | No |
| **Integration** | `test/integration/` | `vitest.config.integration.ts` | `pnpm test:integration` (root) | Yes (firestore + auth) |
| **E2E rules** | `test/e2e/` | `vitest.config.e2e.ts` | `pnpm test:rules` (root) | Yes (firestore) |

## Shared scaffolding

- `setup/integration.setup.ts` — sets emulator host env vars before any import
- `setup/e2e.setup.ts` — same, scoped to rules tests
- `helpers/testFirebase.ts` — dedicated client app + `getTestDb()` / `getTestAuth()` pointed at the emulator
- `helpers/firebaseEmulator.ts` — REST-based `resetEmulators()` / `clearFirestore()` for isolation between tests
- `factories/villageFactory.ts`, `factories/userFactory.ts` — typed builders for test data

## Patterns

- **Reset, don't share state.** Call `resetEmulators()` in `beforeEach` so each test starts empty.
- **Factories return data, tests persist.** Builders produce objects; the test decides where they go.
- **No production Firebase init in tests.** Always import from `helpers/testFirebase`, never from `src/firebase`.
- **Rules tests bypass rules to seed.** Use `env.withSecurityRulesDisabled()` to set up state, then test the rule under the role.
