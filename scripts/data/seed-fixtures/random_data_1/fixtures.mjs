// Dataset: random_data_1
//
// The original throwaway dev fixtures: two Madrid-province villages
// (Aranjuez, Chinchón), each with three orgs and three events. No images.
// Useful for verifying the app works against a non-empty Firestore without
// caring about realism.
//
// To pick this dataset:
//   DATASET=random_data_1 pnpm seed:dev
//   DATASET=random_data_1 pnpm seed:dev:wipe

export default {
  name: 'random_data_1',

  users: [
    {
      ref: 'admin',
      email: 'alvaro@cultuvilla.dev',
      password: 'cultuvilla-dev',
      displayName: 'Alvaro (dev)',
      isAppAdmin: true,
      photo: null,
      // Persona keeps users.displayName in sync with the denorm trigger.
      person: {
        givenName: 'Alvaro',
        middleNames: [],
        firstSurname: '(dev)',
        secondSurname: null,
        nickname: null,
        sex: null,
        birthday: { year: 1990, month: 1, day: 1 },
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
        'Comunidad de prueba de Aranjuez. Eventos del Real Sitio, peñas y asociaciones locales.',
      coverImages: [],
      adminUserRef: 'admin',
      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Aranjuez',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          events: makeStandardEvents('Aranjuez'),
        },
        {
          id: 'pena-toros',
          name: 'Peña Los Toros',
          type: 'peña',
          description: 'Peña taurina y festiva.',
          events: makeStandardEvents('Aranjuez'),
        },
        {
          id: 'asoc-cultural',
          name: 'Asociación Cultural Raíces',
          type: 'asociación',
          description: 'Asociación cultural y de tradiciones.',
          events: makeStandardEvents('Aranjuez'),
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
        'Pueblo medieval con Plaza Mayor histórica. Fiestas patronales, anís y teatro.',
      coverImages: [],
      adminUserRef: 'admin',
      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Chinchón',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          events: makeStandardEvents('Chinchón'),
        },
        {
          id: 'pena-toros',
          name: 'Peña Los Toros',
          type: 'peña',
          description: 'Peña taurina y festiva.',
          events: makeStandardEvents('Chinchón'),
        },
        {
          id: 'asoc-cultural',
          name: 'Asociación Cultural Raíces',
          type: 'asociación',
          description: 'Asociación cultural y de tradiciones.',
          events: makeStandardEvents('Chinchón'),
        },
      ],
    },
  ],
}

function makeStandardEvents(villageName) {
  return [
    {
      id: 'verbena',
      title: `Verbena de ${villageName}`,
      description: 'Música en directo, comida y baile en la plaza.',
      startOffsetDays: 7,
      durationHours: 4,
      maxAttendees: 200,
      status: 'published',
      image: null,
    },
    {
      id: 'taller',
      title: 'Taller tradicional para vecinos',
      description: 'Plazas limitadas. Inscripción gratuita.',
      startOffsetDays: 14,
      durationHours: null,
      maxAttendees: 20,
      status: 'published',
      image: null,
    },
    {
      id: 'past-fiesta',
      title: 'Fiestas Patronales (pasado)',
      description: 'Evento histórico — para probar feed de pasados.',
      startOffsetDays: -30,
      durationHours: 24,
      maxAttendees: null,
      status: 'completed',
      image: null,
    },
  ]
}
