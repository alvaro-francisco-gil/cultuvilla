// Dataset: real_user_data_1
//
// Real user accounts only — the app-wide admin (cultuvilla@gmail.com) and a
// personal test user (xxpowervaroxx@gmail.com). No villages here.
//
// For real-village data, see `real_villages_1/fixtures.mjs` + the
// `scripts/seed-village-requests.mjs` script, which goes through the actual
// organizer-request → admin-approval flow rather than seeding a community
// directly.
//
// To pick this dataset:
//   DATASET=real_user_data_1 pnpm seed:dev
//   DATASET=real_user_data_1 pnpm seed:dev:wipe
//
// IMAGES
//   For dataset-local images: drop the file in
//   scripts/data/seed-fixtures/real_user_data_1/images/ and reference it by
//   bare filename (e.g. `photo: 'alvaro_pic.jpg'`).
//
//   To reuse an asset that already lives somewhere in the repo, use a path
//   with at least one slash, treated repo-relative (e.g.
//   `photo: 'packages/shared/assets/icons/logo_cultuvilla_nobg.png'`). No copy.
//
// PASSWORDS
//   `password` is dev-only — these accounts only exist in villa-events
//   (dev). Change in Firebase Console after first login if you care.

export default {
  name: 'real_user_data_1',

  users: [
    {
      ref: 'admin',
      email: 'cultuvilla@gmail.com',
      password: 'cultuvilla-dev',
      displayName: 'Cultuvilla',
      isAppAdmin: true,
      photo: 'packages/shared/assets/icons/logo_cultuvilla_nobg.png',
      // Persona seeded so users.displayName lines up with the denorm trigger's
      // projection (givenName + middleNames + firstSurname + secondSurname).
      // Cultuvilla is the app admin — single token "Cultuvilla" suffices.
      person: {
        givenName: 'Cultuvilla',
        middleNames: [],
        firstSurname: null,
        secondSurname: null,
        nickname: 'Cultuvilla',
        sex: null,
        birthday: { year: 2024, month: 1, day: 1 },
      },
    },
    {
      ref: 'alvaro',
      email: 'xxpowervaroxx@gmail.com',
      password: 'cultuvilla-dev',
      displayName: 'Álvaro Francisco Gil',
      isAppAdmin: false,
      photo: 'alvaro_pic.jpg',
      person: {
        givenName: 'Álvaro',
        middleNames: [],
        firstSurname: 'Francisco',
        secondSurname: 'Gil',
        nickname: 'Varo',
        sex: 'male',
        birthday: { year: 2000, month: 7, day: 13 },
      },
    },
  ],

  // Intentionally empty — villages for this scenario are created via the
  // organizer-request flow, not direct seed. See real_villages_1 + the
  // seed-village-requests.mjs script.
  villages: [],
}
