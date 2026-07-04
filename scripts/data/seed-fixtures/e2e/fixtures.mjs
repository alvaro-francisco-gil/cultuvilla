/**
 * Deterministic E2E fixtures for the Firebase emulator.
 *
 * Consumed by `scripts/seed/e2e.mjs`, which builds converter-valid docs via the
 * shared model builders (so these can't drift from schema — D5). The Playwright
 * suite mirrors the handful of identifiers it needs in
 * `apps/mobile/e2e/lib/fixtures.ts`; THIS file is the source of truth.
 *
 * Small, stable, assertion-friendly on purpose — never the demo_1 showcase set.
 * IDs are fixed (not dataset-namespaced) because this set owns the emulator.
 */

export const E2E_PASSWORD = 'e2e-cultuvilla-pw';

// personId links the profile to a persons/{id} doc. Without it the app treats
// the user as not-yet-onboarded and diverts to complete-profile, so the event
// register FAB never renders — seed the person so login → sign-up is one hop.
export const users = {
  admin: {
    uid: 'e2e-admin',
    email: 'e2e-admin@cultuvilla.test',
    displayName: 'E2E Admin',
    personId: 'e2e-person-admin',
    givenName: 'Admin',
    firstSurname: 'E2E',
  },
  attendee: {
    uid: 'e2e-user',
    email: 'e2e-user@cultuvilla.test',
    displayName: 'E2E User',
    personId: 'e2e-person-user',
    givenName: 'Usuario',
    firstSurname: 'E2E',
  },
};

export const village = {
  docId: 'e2e-village-altozano',
  name: 'Altozano de Prueba',
  province: 'Valencia',
  comunidadAutonoma: 'Comunitat Valenciana',
  codigoINE: '46999',
  description: 'Pueblo de prueba para los tests E2E.',
  coordinates: { lat: 39.4699, lng: -0.3763 },
};

export const org = {
  docId: 'e2e-org-ayto',
  name: 'Ayuntamiento de Altozano',
  type: 'ayuntamiento',
  description: 'Organización de prueba para los tests E2E.',
};

export const event = {
  docId: 'e2e-event-fiesta',
  title: 'Fiesta de Prueba E2E',
  description: 'Evento de prueba para el flujo de inscripción end-to-end.',
  startOffsetDays: 7,
  maxAttendees: 100,
  status: 'published',
};
