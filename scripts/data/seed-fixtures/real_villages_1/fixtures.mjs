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
//   DATASET=real_villages_1 pnpm seed:villages          # activate the community
//   DATASET=real_villages_1 pnpm seed:dev:orgs          # then fill content (orgs/places/...)
//   DATASET=real_villages_1 pnpm seed:dev:places
//   DATASET=real_villages_1 pnpm seed:dev:events
//   DATASET=real_villages_1 pnpm seed:dev:news
//   DATASET=real_villages_1 pnpm seed:villages:wipe     # revert the activation
//
// The orgs/places/events/news seeders resolve the *real* INE municipality doc
// (auto-id, looked up by codigoINE) because this village carries
// `organizerEmail` instead of `adminUserRef`. Child docs are namespaced by
// `id`. The village must already be community-active (run `seed:villages`).
//
// IMAGES
//   Bare filename = dataset-local (scripts/data/seed-fixtures/real_villages_1/
//   images/), path-with-slash = repo-relative. Fetch them once with
//   `DATASET=real_villages_1 pnpm seed:images` (reads images.manifest.mjs).
//   Image-capable here: village escudo, event imageURL, news images[].

export default {
  name: 'real_villages_1',

  villages: [
    {
      // INE lookup key — the `municipalities` collection (seeded by
      // `scripts/seed-municipalities.mjs`) is queried by codigoINE.
      codigoINE: '40123',
      // Display name (logging) + child-doc namespacing key for the content
      // seeders (orgs/places/events/news).
      name: 'Matabuena',
      id: 'matabuena',
      // Real coordinates — request-flow villages don't carry coords on the INE
      // doc, but the event seeder needs a real location.coordinates.
      coordinates: { lat: 41.0628, lng: -3.7619 },

      // Who requests the organizer role (must exist in real_user_data_1).
      organizerEmail: 'xxpowervaroxx@gmail.com',
      // Who approves (must be in admins/{uid}).
      approverEmail: 'cultuvilla.app@gmail.com',

      motivation:
        'Soy vecino de Matabuena y quiero organizar la comunidad del pueblo en Cultuvilla.',

      // Optional post-activation patch: simulates the new organizer filling in
      // the village's description after their request is approved.
      description:
        'Matabuena — pueblo de la sierra de Guadarrama (Segovia, Castilla y León). Naturaleza, tradición y vecinos.',

      barrios: [
        { id: 'pueblo', name: 'El Pueblo', image: 'matabuena-barrio-pueblo.jpg' },
        { id: 'villares', name: 'Villares de Matabuena', image: 'matabuena-barrio-villares.jpg' },
      ],

      places: [
        { id: 'cementerio', name: 'Cementerio de Matabuena', kind: 'cemetery', description: 'Camposanto municipal.', image: 'matabuena-place-cementerio.jpg' },
        { id: 'iglesia', name: 'Iglesia de San Sebastián', kind: 'church', description: 'Parroquia del pueblo.', image: 'matabuena-place-iglesia.jpg' },
        { id: 'ermita', name: 'Ermita de la Soledad', kind: 'hermitage', description: 'Ermita en las afueras, romería de verano.', image: 'matabuena-place-ermita.jpg' },
        { id: 'plaza', name: 'Plaza del Ayuntamiento', kind: 'plaza', description: 'Plaza central, punto de encuentro vecinal.', image: 'matabuena-place-plaza.jpg' },
        { id: 'ayuntamiento', name: 'Ayuntamiento de Matabuena', kind: 'town_hall', description: 'Casa consistorial.', image: 'matabuena-place-ayuntamiento.jpg' },
      ],

      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Matabuena',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          image: 'matabuena-org-ayto.jpg',
          events: [
            {
              id: 'fiestas-verano',
              title: 'Fiestas de Verano',
              description: 'Verbena, juegos y comida popular en la Plaza del Ayuntamiento.',
              startOffsetDays: 12,
              durationHours: 6,
              maxAttendees: null,
              status: 'published',
              image: 'matabuena-verbena.jpg',
            },
          ],
        },
        {
          id: 'asoc-sierra',
          name: 'Asociación Amigos de la Sierra',
          type: 'asociación',
          description: 'Senderismo y conservación del entorno de la sierra de Guadarrama.',
          image: 'matabuena-org-asoc-sierra.jpg',
          events: [
            {
              id: 'ruta-pinares',
              title: 'Ruta de los pinares',
              description: 'Senderismo guiado por los pinares. Plazas limitadas.',
              startOffsetDays: 20,
              durationHours: 4,
              maxAttendees: 30,
              status: 'published',
              image: 'matabuena-ruta.jpg',
            },
            {
              id: 'limpieza-pasada',
              title: 'Jornada de limpieza del río (pasada)',
              description: 'Evento histórico — para probar el feed de pasados.',
              startOffsetDays: -21,
              durationHours: 3,
              maxAttendees: null,
              status: 'completed',
              image: null,
            },
          ],
        },
        {
          id: 'pena-pinar',
          name: 'Peña El Pinar',
          type: 'peña',
          description: 'Peña festiva del pueblo: charanga, calderetas y buen ambiente.',
          image: 'matabuena-org-pena-pinar.jpg',
          events: [
            {
              id: 'caldereta',
              title: 'Caldereta de la Peña El Pinar',
              description: 'Comida popular de la peña en la pradera. Apúntate con tu cuadrilla.',
              startOffsetDays: 13,
              durationHours: 5,
              maxAttendees: 120,
              status: 'published',
              image: 'matabuena-pena-pinar-caldereta.jpg',
            },
          ],
        },
        {
          id: 'pena-quintos',
          name: 'Peña Los Quintos',
          type: 'peña',
          description: 'La peña de los quintos del año: hoguera, música y tradición.',
          image: 'matabuena-org-pena-quintos.jpg',
          events: [
            {
              id: 'hoguera',
              title: 'Hoguera de los Quintos',
              description: 'Hoguera nocturna en la plaza con música y chocolatada.',
              startOffsetDays: 16,
              durationHours: 4,
              maxAttendees: null,
              status: 'published',
              image: 'matabuena-pena-quintos-hoguera.jpg',
            },
          ],
        },
        {
          id: 'pena-tajo',
          name: 'Peña La Hoz',
          type: 'peña',
          description: 'Peña senderista y gastronómica de la hoz del río.',
          image: 'matabuena-org-pena-hoz.jpg',
          events: [],
        },
      ],

      news: [
        {
          id: 'temporada-setas',
          authorEmail: 'xxpowervaroxx@gmail.com',
          orgId: 'asoc-sierra',
          title: 'Comienza la temporada de setas en los pinares',
          body: 'Con las primeras lluvias del otoño arranca la temporada micológica. Recordamos respetar las normas de recogida.',
          category: 'tradicion',
          status: 'approved',
          publishedOffsetDays: 3,
          images: ['matabuena-news-setas.jpg'],
        },
        {
          id: 'programa-fiestas',
          authorEmail: 'cultuvilla.app@gmail.com',
          orgId: 'ayto',
          title: 'Publicado el programa de las Fiestas de Verano',
          body: 'Ya está disponible el programa completo de las fiestas: verbena, concurso de calderetas y juegos para los más pequeños.',
          category: 'fiesta',
          status: 'approved',
          publishedOffsetDays: 1,
          images: ['matabuena-news-fiestas.jpg'],
        },
      ],
    },
  ],
}
