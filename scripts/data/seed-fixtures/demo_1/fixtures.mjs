// Dataset: demo_1
//
// The showcase dev dataset (replaces the old throwaway `random_data_1`). Two
// Madrid-province villages, each fully populated with everything a village now
// contains — organizations, places, barrios, events, and news — with images
// attached wherever the models support them.
//
// Seed it all, or à la carte:
//   DATASET=demo_1 pnpm seed:dev              # users → villages → orgs → places → events → news
//   DATASET=demo_1 pnpm seed:dev:news         # just one domain (resolves deps by email/ID)
//   DATASET=demo_1 pnpm seed:dev:wipe         # remove everything this dataset created
//
// IMAGES
//   Referenced by bare filename → scripts/data/seed-fixtures/demo_1/images/.
//   Those files are produced by `DATASET=demo_1 pnpm seed:images` (one-time,
//   network) from images.manifest.mjs and committed. A path with a slash is
//   treated repo-relative instead (e.g. a shared asset), with no copy.
//
//   Image-capable entities: user/persona photo, village escudo, event
//   imageURL, news images[], and org/place/barrio images[] (max 5; only the
//   first `image` fixture field is seeded today, landing as images[0]).

export default {
  name: 'demo_1',

  users: [
    {
      ref: 'admin',
      email: 'demo-admin@cultuvilla.dev',
      password: 'cultuvilla-dev',
      displayName: 'Admin Demo',
      isAppAdmin: true,
      photo: 'admin-avatar.jpg',
      person: {
        givenName: 'Admin',
        middleNames: [],
        firstSurname: 'Demo',
        secondSurname: null,
        nickname: null,
        sex: null,
        birthday: { year: 1985, month: 5, day: 12 },
      },
    },
    {
      ref: 'vecino',
      email: 'demo-vecino@cultuvilla.dev',
      password: 'cultuvilla-dev',
      displayName: 'Lucía Vecina',
      isAppAdmin: false,
      photo: 'vecino-avatar.jpg',
      person: {
        givenName: 'Lucía',
        middleNames: [],
        firstSurname: 'Vecina',
        secondSurname: 'del Pueblo',
        nickname: 'Lu',
        sex: 'female',
        birthday: { year: 1995, month: 9, day: 3 },
      },
    },
  ],

  villages: [
    {
      id: 'aranjuez',
      name: 'Aranjuez',
      province: 'Madrid',
      comunidadAutonoma: 'Comunidad de Madrid',
      codigoINE: '28013',
      coordinates: { lat: 40.0319, lng: -3.6033 },
      description:
        'Real Sitio de Aranjuez — jardines históricos, el Tajo y una intensa vida festiva. Eventos del Ayuntamiento, peñas y asociaciones vecinales.',
      adminUserRef: 'admin',

      barrios: [
        { id: 'centro', name: 'Casco Histórico', image: 'aranjuez-barrio-centro.jpg' },
        { id: 'foso', name: 'El Foso', image: 'aranjuez-barrio-foso.jpg' },
        { id: 'nuevo-aranjuez', name: 'Nuevo Aranjuez', image: 'aranjuez-barrio-nuevo-aranjuez.jpg' },
      ],

      places: [
        { id: 'cementerio', name: 'Cementerio Municipal de Aranjuez', kind: 'cemetery', description: 'Camposanto municipal.', image: 'aranjuez-place-cementerio.jpg' },
        { id: 'iglesia-alpajes', name: 'Iglesia de San Antonio (Los Alpajes)', kind: 'church', description: 'Parroquia histórica del Real Sitio.', image: 'aranjuez-place-iglesia.jpg' },
        { id: 'ermita-san-isidro', name: 'Ermita de San Isidro', kind: 'hermitage', description: 'Ermita en las afueras, romería en mayo.', image: 'aranjuez-place-ermita.jpg' },
        { id: 'plaza-parejas', name: 'Plaza de Parejas', kind: 'plaza', description: 'Plaza principal junto al Palacio Real.', image: 'aranjuez-place-plaza.jpg' },
        { id: 'ayuntamiento', name: 'Casa Consistorial', kind: 'town_hall', description: 'Sede del Ayuntamiento de Aranjuez.', image: 'aranjuez-place-ayuntamiento.jpg' },
      ],

      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Aranjuez',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          image: 'aranjuez-org-ayto.jpg',
          events: [
            {
              id: 'verbena',
              title: 'Verbena del Motín',
              description: 'Música en directo, comida y baile en la Plaza de Parejas.',
              startOffsetDays: 7,
              durationHours: 5,
              maxAttendees: 300,
              status: 'published',
              image: 'aranjuez-verbena.jpg',
            },
            {
              id: 'mercado',
              title: 'Mercado de Primavera',
              description: 'Puestos de artesanía y productos locales junto al Tajo.',
              startOffsetDays: 21,
              durationHours: 8,
              maxAttendees: null,
              status: 'published',
              image: 'aranjuez-mercado.jpg',
            },
          ],
        },
        {
          id: 'asoc-jardines',
          name: 'Asociación Amigos de los Jardines',
          type: 'asociación',
          description: 'Cuidado y difusión del patrimonio verde del Real Sitio.',
          image: 'aranjuez-org-asoc-jardines.jpg',
          events: [
            {
              id: 'taller-poda',
              title: 'Taller de poda tradicional',
              description: 'Plazas limitadas. Inscripción gratuita.',
              startOffsetDays: 14,
              durationHours: null,
              maxAttendees: 20,
              status: 'published',
              image: null,
            },
            {
              id: 'ruta-pasada',
              title: 'Ruta botánica (pasada)',
              description: 'Evento histórico — para probar el feed de pasados.',
              startOffsetDays: -30,
              durationHours: 3,
              maxAttendees: null,
              status: 'completed',
              image: null,
            },
          ],
        },
      ],

      news: [
        {
          id: 'jardines-reabren',
          authorRef: 'admin',
          orgId: 'ayto',
          title: 'Reabren los Jardines del Príncipe tras la restauración',
          body: 'Tras meses de trabajos, los Jardines del Príncipe vuelven a abrir al público con nuevos itinerarios señalizados.',
          category: 'historia',
          status: 'approved',
          publishedOffsetDays: 2,
          images: ['aranjuez-news-jardines.jpg'],
        },
        {
          id: 'fresas-temporada',
          authorRef: 'vecino',
          orgId: null,
          title: 'Arranca la temporada de fresón de Aranjuez',
          body: 'Los puestos del mercado ya ofrecen el fresón de temporada, seña de identidad gastronómica del municipio.',
          category: 'gastronomia',
          status: 'approved',
          publishedOffsetDays: 5,
          images: ['aranjuez-news-gastro.jpg'],
        },
      ],
    },

    {
      id: 'chinchon',
      name: 'Chinchón',
      province: 'Madrid',
      comunidadAutonoma: 'Comunidad de Madrid',
      codigoINE: '28045',
      coordinates: { lat: 40.1378, lng: -3.4253 },
      description:
        'Pueblo medieval con Plaza Mayor porticada. Fiestas patronales, anís, ajo y un teatro vivo en la plaza.',
      adminUserRef: 'admin',

      barrios: [
        { id: 'plaza-mayor', name: 'Plaza Mayor', image: 'chinchon-barrio-plaza-mayor.jpg' },
        { id: 'arrabal', name: 'El Arrabal', image: 'chinchon-barrio-arrabal.jpg' },
      ],

      places: [
        { id: 'cementerio', name: 'Cementerio de Chinchón', kind: 'cemetery', description: 'Camposanto municipal.', image: 'chinchon-place-cementerio.jpg' },
        { id: 'iglesia-asuncion', name: 'Iglesia de Nuestra Señora de la Asunción', kind: 'church', description: 'Alberga un lienzo atribuido a Goya.', image: 'chinchon-place-iglesia.jpg' },
        { id: 'plaza-mayor', name: 'Plaza Mayor de Chinchón', kind: 'plaza', description: 'Plaza porticada del siglo XV, escenario de festejos.', image: 'chinchon-place-plaza.jpg' },
        { id: 'ayuntamiento', name: 'Ayuntamiento de Chinchón', kind: 'town_hall', description: 'Casa consistorial.', image: 'chinchon-place-ayuntamiento.jpg' },
      ],

      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Chinchón',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          image: 'chinchon-org-ayto.jpg',
          events: [
            {
              id: 'fiestas',
              title: 'Fiestas Patronales',
              description: 'Encierros, música y gastronomía en la Plaza Mayor.',
              startOffsetDays: 10,
              durationHours: 6,
              maxAttendees: null,
              status: 'published',
              image: 'chinchon-fiestas.jpg',
            },
          ],
        },
        {
          id: 'pena-teatro',
          name: 'Peña Teatro en la Plaza',
          type: 'peña',
          description: 'Representaciones teatrales populares en la Plaza Mayor.',
          image: 'chinchon-org-pena-teatro.jpg',
          events: [
            {
              id: 'corral-comedias',
              title: 'Noche de comedias',
              description: 'Teatro clásico al aire libre. Aforo limitado.',
              startOffsetDays: 18,
              durationHours: 2,
              maxAttendees: 150,
              status: 'published',
              image: 'chinchon-teatro.jpg',
            },
          ],
        },
      ],

      news: [
        {
          id: 'anis-feria',
          authorRef: 'admin',
          orgId: 'ayto',
          title: 'Vuelve la Feria del Anís',
          body: 'El anís de Chinchón protagoniza un fin de semana de catas, visitas y actividades para todas las edades.',
          category: 'fiesta',
          status: 'approved',
          publishedOffsetDays: 1,
          images: ['chinchon-news-anis.jpg'],
        },
        {
          id: 'plaza-restauracion',
          authorRef: 'vecino',
          orgId: null,
          title: 'La Plaza Mayor estrena iluminación',
          body: 'Los balcones de madera de la plaza lucen una nueva iluminación que respeta el carácter histórico del conjunto.',
          category: 'tradicion',
          status: 'approved',
          publishedOffsetDays: 4,
          images: ['chinchon-news-plaza.jpg'],
        },
      ],
    },
  ],
}
