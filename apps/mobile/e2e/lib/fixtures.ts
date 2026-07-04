// Mirrors scripts/data/seed-fixtures/e2e/fixtures.mjs (the source of truth,
// consumed by scripts/seed/e2e.mjs). A tiny, stable set kept in sync by hand.
export const E2E_PASSWORD = 'e2e-cultuvilla-pw';

export const fixtures = {
  admin: { uid: 'e2e-admin', email: 'e2e-admin@cultuvilla.test', personId: 'e2e-person-admin' },
  attendee: { uid: 'e2e-user', email: 'e2e-user@cultuvilla.test', personId: 'e2e-person-user' },
  village: { docId: 'e2e-village-altozano', name: 'Altozano de Prueba' },
  org: { docId: 'e2e-org-ayto' },
  event: { docId: 'e2e-event-fiesta', title: 'Fiesta de Prueba E2E' },
} as const;
