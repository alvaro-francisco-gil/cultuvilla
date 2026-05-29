// Dataset: real_villages_1
//
// Real villages activated via the actual organizer-request → admin-approval
// flow, rather than seeded directly. The companion script
// `scripts/seed-village-requests.mjs` reads this, looks up each municipality
// by INE code in the already-seeded `municipalities` collection, then for each
// entry:
//
//   1. Writes an `organizerRequests/{id}` doc as the requester (status=pending).
//   2. Approves it as the app admin (status=approved, reviewedBy=admin).
//   3. Activates the community on the municipality doc (community.adminUserId
//      = requester) and creates the admin membership subdoc.
//
// The requester ends up village admin; the audit trail in `organizerRequests`
// reflects the real production flow.
//
// To run this scenario:
//   DATASET=real_villages_1 pnpm seed:villages
//   DATASET=real_villages_1 pnpm seed:villages:wipe
//
// IMAGES
//   Same convention as the other fixtures: bare filename = dataset-local
//   (scripts/data/seed-fixtures/real_villages_1/images/), path-with-slash =
//   repo-relative.

export default {
  name: 'real_villages_1',

  villages: [
    {
      // INE lookup key — the `municipalities` collection (seeded by
      // `scripts/seed-municipalities.mjs`) is queried by codigoINE.
      codigoINE: '40123',
      // For logging only.
      name: 'Matabuena',

      // Who requests the organizer role (must exist in real_user_data_1).
      organizerEmail: 'xxpowervaroxx@gmail.com',
      // Who approves (must be in admins/{uid}).
      approverEmail: 'cultuvilla@gmail.com',

      motivation:
        'Soy vecino de Matabuena y quiero organizar la comunidad del pueblo en Cultuvilla.',

      // Optional post-activation patch: simulates the new organizer filling in
      // the village's description + covers after their request is approved.
      description:
        'Matabuena — pueblo de la sierra de Guadarrama (Segovia, Castilla y León). Naturaleza, tradición y vecinos.',
      coverImages: [],
    },
  ],
}
