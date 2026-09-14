import { describe, it, expect } from 'vitest';
import {
  aggregateWrapped,
  meetsAutoPublishFloor,
  type WrappedInputs,
} from '../../src/wrapped/aggregateWrapped';
import { MAX_PERSON_CREDITS } from '../../src/models/wrapped/WrappedDataModel';

// Window: Matabuena's fiestas de agosto 2026, declared as 14–28 Aug, Madrid time.
const WINDOW = {
  start: new Date('2026-08-14T00:00:00+02:00'),
  end: new Date('2026-08-28T23:59:59.999+02:00'),
};

function ev(over: Partial<WrappedInputs['events'][number]> & { id: string }): WrappedInputs['events'][number] {
  return {
    title: over.id,
    status: 'completed',
    startDate: new Date('2026-08-25T18:00:00+02:00'),
    imageURL: null,
    commentCount: 0,
    maxAttendees: null,
    createdBy: null,
    organizerOrgIds: [],
    organizerUserIds: [],
    ...over,
  };
}

function base(over: Partial<WrappedInputs> = {}): WrappedInputs {
  return {
    range: WINDOW,
    events: [],
    registrations: [],
    organizations: [],
    organizerProfiles: [],
    censoCount: 272,
    censoPersonIds: [],
    posterCount: 1,
    ...over,
  };
}

describe('aggregateWrapped — which events count', () => {
  it('excludes cancelled events, which are recreated rather than duplicated', () => {
    const r = aggregateWrapped(
      base({
        events: [
          ev({ id: 'live' }),
          ev({ id: 'cancelled-twin', status: 'cancelled' }),
        ],
      }),
    );
    expect(r.stats.eventCount).toBe(1);
  });

  it('excludes events outside the declared window', () => {
    const r = aggregateWrapped(
      base({
        events: [
          ev({ id: 'in' }),
          ev({ id: 'santiago', startDate: new Date('2026-07-25T14:00:00+02:00') }),
        ],
      }),
    );
    expect(r.stats.eventCount).toBe(1);
  });

  // 23:30 on the last day is still the fiestas, locally.
  it('keeps an event late on the final Madrid day', () => {
    const r = aggregateWrapped(base({ events: [ev({ id: 'late', startDate: new Date('2026-08-28T23:30:00+02:00') })] }));
    expect(r.stats.eventCount).toBe(1);
  });

  it("ignores registrations on events it didn't count", () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'gone', status: 'cancelled' })],
        registrations: [{ eventId: 'gone', personId: 'p1', userId: 'u1', status: 'confirmed' }],
      }),
    );
    expect(r.stats.confirmedCount).toBe(0);
    expect(r.stats.uniquePersonCount).toBe(0);
  });
});

describe('aggregateWrapped — participation', () => {
  // The real ratio in Matabuena: 240 sign-ups were only 174 people.
  it('counts distinct personas, not registrations', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a' }), ev({ id: 'b' })],
        registrations: [
          { eventId: 'a', personId: 'p1', userId: 'u1', status: 'confirmed' },
          { eventId: 'b', personId: 'p1', userId: 'u1', status: 'confirmed' },
          { eventId: 'a', personId: 'p2', userId: 'u1', status: 'confirmed' },
        ],
      }),
    );
    expect(r.stats.confirmedCount).toBe(3);
    expect(r.stats.uniquePersonCount).toBe(2);
    expect(r.stats.uniqueAccountCount).toBe(1);
  });

  it('separates confirmed from waitlisted', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a' })],
        registrations: [
          { eventId: 'a', personId: 'p1', userId: 'u1', status: 'confirmed' },
          { eventId: 'a', personId: 'p2', userId: 'u2', status: 'waitlisted' },
        ],
      }),
    );
    expect(r.stats.confirmedCount).toBe(1);
    expect(r.stats.waitlistedCount).toBe(1);
  });

  it('counts a waitlisted persona as a participant, since they wanted in', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a' })],
        registrations: [{ eventId: 'a', personId: 'p1', userId: 'u1', status: 'waitlisted' }],
      }),
    );
    expect(r.stats.uniquePersonCount).toBe(1);
  });

  it('sums comments over counted events only', () => {
    const r = aggregateWrapped(
      base({ events: [ev({ id: 'a', commentCount: 4 }), ev({ id: 'x', status: 'cancelled', commentCount: 99 })] }),
    );
    expect(r.stats.commentCount).toBe(4);
  });
});

describe('aggregateWrapped — censo participation', () => {
  // In Matabuena 174 people took part but only 137 are in the censo: 33 are
  // personas with no village link at all (mostly kids added by a parent) and 4
  // live elsewhere. "174 of 272 in the censo" is therefore a false ratio — the
  // censo figure has to be computed against the censo, once, for every card.
  it('counts only participants who are in the censo', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a' })],
        censoPersonIds: ['vecina', 'vecino'],
        registrations: [
          { eventId: 'a', personId: 'vecina', userId: 'u1', status: 'confirmed' },
          { eventId: 'a', personId: 'sin-pueblo', userId: 'u1', status: 'confirmed' },
          { eventId: 'a', personId: 'de-fuera', userId: 'u2', status: 'confirmed' },
        ],
      }),
    );
    expect(r.stats.uniquePersonCount).toBe(3);
    expect(r.stats.censoParticipantCount).toBe(1);
  });

  it('never reports more censo participants than the censo holds', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a' })],
        censoCount: 2,
        censoPersonIds: ['p1', 'p2'],
        registrations: ['p1', 'p2', 'p3'].map((personId) => ({ eventId: 'a', personId, userId: 'u', status: 'confirmed' as const })),
      }),
    );
    expect(r.stats.censoParticipantCount).toBeLessThanOrEqual(r.stats.censoCount);
  });
});

describe('aggregateWrapped — an empty block', () => {
  // The highlights index [0] of a sorted list, which is undefined when nothing
  // falls in the window. That must yield nulls, not a crash.
  it('aggregates a window with no events at all', () => {
    const r = aggregateWrapped(base());
    expect(r.stats.eventCount).toBe(0);
    expect(r.fullestEvent).toBeNull();
    expect(r.mostCommentedEvent).toBeNull();
    expect(r.topOrganizations).toEqual([]);
  });
});

describe('aggregateWrapped — highlights', () => {
  it('names the fullest event by confirmed sign-ups', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'bolsas', title: 'Bolsas de tela', maxAttendees: 60 }), ev({ id: 'mus', title: 'Mus' })],
        registrations: [
          ...Array.from({ length: 3 }, (_, i) => ({ eventId: 'bolsas', personId: `b${String(i)}`, userId: `u${String(i)}`, status: 'confirmed' as const })),
          { eventId: 'mus', personId: 'm1', userId: 'u9', status: 'confirmed' },
        ],
      }),
    );
    expect(r.fullestEvent).toEqual({ eventId: 'bolsas', title: 'Bolsas de tela', count: 3, capacity: 60 });
  });

  it('has no fullest event when nobody signed up to anything', () => {
    expect(aggregateWrapped(base({ events: [ev({ id: 'a' })] })).fullestEvent).toBeNull();
  });

  it('names the most-commented event', () => {
    const r = aggregateWrapped(
      base({ events: [ev({ id: 'brisca', title: 'Brisca', commentCount: 4 }), ev({ id: 'a', commentCount: 1 })] }),
    );
    expect(r.mostCommentedEvent).toMatchObject({ eventId: 'brisca', count: 4 });
  });

  it('has no most-commented event when there are no comments', () => {
    expect(aggregateWrapped(base({ events: [ev({ id: 'a' })] })).mostCommentedEvent).toBeNull();
  });
});

describe('aggregateWrapped — organizer credit', () => {
  it('credits organizations by how many counted events they ran', () => {
    const r = aggregateWrapped(
      base({
        events: [
          ev({ id: 'a', organizerOrgIds: ['comision'] }),
          ev({ id: 'b', organizerOrgIds: ['comision'] }),
          ev({ id: 'c', organizerOrgIds: ['pan'] }),
        ],
        organizations: [
          { id: 'comision', name: 'Comisión de Festejos', imageURL: null },
          { id: 'pan', name: 'Pan Colectivo', imageURL: null },
        ],
      }),
    );
    expect(r.topOrganizations.map((o) => [o.name, o.eventCount])).toEqual([
      ['Comisión de Festejos', 2],
      ['Pan Colectivo', 1],
    ]);
  });

  // Shapes from Matabuena's August 2026: a comisión event lists its whole team
  // in organizerUserIds, and each of them organized it. Crediting only the
  // creator showed 2 of the 10 people who ran the fiestas.
  it('credits everyone on organizerUserIds, not just the creator', () => {
    const team = ['alvaro', 'angela', 'lucia'];
    const r = aggregateWrapped(
      base({
        events: [
          ev({ id: 'brisca', createdBy: 'alvaro', organizerUserIds: team }),
          ev({ id: 'laser', createdBy: 'lucia', organizerUserIds: team }),
          ev({ id: 'frontenis', createdBy: 'alvaro', organizerUserIds: ['alvaro', 'sergio'] }),
        ],
        organizerProfiles: [
          { userId: 'alvaro', displayName: 'Álvaro', photoURL: null },
          { userId: 'angela', displayName: 'Ángela', photoURL: null },
          { userId: 'lucia', displayName: 'Lucía', photoURL: null },
          { userId: 'sergio', displayName: 'Sergio', photoURL: null },
        ],
      }),
    );
    expect(r.topOrganizers.map((p) => [p.displayName, p.eventCount])).toEqual([
      ['Álvaro', 3],
      ['Ángela', 2],
      ['Lucía', 2],
      ['Sergio', 1],
    ]);
  });

  it('credits a creator who is missing from organizerUserIds', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a', createdBy: 'jesus', organizerUserIds: [] })],
        organizerProfiles: [{ userId: 'jesus', displayName: 'Jesús', photoURL: null }],
      }),
    );
    expect(r.topOrganizers.map((p) => [p.displayName, p.eventCount])).toEqual([['Jesús', 1]]);
  });

  it('counts one event once per organizer, however often they are listed on it', () => {
    const r = aggregateWrapped(
      base({
        events: [
          ev({
            id: 'bolsas',
            createdBy: 'alvaro',
            organizerUserIds: ['alvaro', 'alvaro'],
            organizerOrgIds: ['comision', 'destechaos', 'comision'],
          }),
        ],
        organizations: [
          { id: 'comision', name: 'Comisión de Festejos', imageURL: null },
          { id: 'destechaos', name: 'Destechaos', imageURL: null },
        ],
        organizerProfiles: [{ userId: 'alvaro', displayName: 'Álvaro', photoURL: null }],
      }),
    );
    expect(r.topOrganizers.map((p) => p.eventCount)).toEqual([1]);
    // An event run jointly by two organizations credits both.
    expect(r.topOrganizations.map((o) => [o.name, o.eventCount])).toEqual([
      ['Comisión de Festejos', 1],
      ['Destechaos', 1],
    ]);
  });

  it('drops a credited person or org whose profile is missing, rather than showing an id', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a', createdBy: 'ghost', organizerOrgIds: ['deleted-org'] })],
      }),
    );
    expect(r.topOrganizers).toEqual([]);
    expect(r.topOrganizations).toEqual([]);
  });

  it('caps the credit lists at what the card can lay out', () => {
    const n = MAX_PERSON_CREDITS + 3;
    const events = Array.from({ length: n }, (_, i) => ev({ id: `e${String(i)}`, createdBy: `u${String(i)}` }));
    const organizerProfiles = events.map((e) => ({ userId: e.createdBy ?? '', displayName: e.id, photoURL: null }));
    expect(aggregateWrapped(base({ events, organizerProfiles })).topOrganizers).toHaveLength(MAX_PERSON_CREDITS);
  });

  it('breaks ties by name, so the order is stable across recomputes', () => {
    const r = aggregateWrapped(
      base({
        events: [ev({ id: 'a', createdBy: 'z' }), ev({ id: 'b', createdBy: 'a' })],
        organizerProfiles: [
          { userId: 'z', displayName: 'Zoe', photoURL: null },
          { userId: 'a', displayName: 'Ana', photoURL: null },
        ],
      }),
    );
    expect(r.topOrganizers.map((p) => p.displayName)).toEqual(['Ana', 'Zoe']);
  });
});

describe('meetsAutoPublishFloor', () => {
  // A thin Wrapped makes a village look dead on its own noticeboard. Below the
  // floor it is computed and the admin is told, but the timer never publishes it.
  it('passes a real fiestas block', () => {
    expect(meetsAutoPublishFloor({ eventCount: 14, confirmedCount: 240 })).toBe(true);
  });

  it('holds back a block with too few events', () => {
    expect(meetsAutoPublishFloor({ eventCount: 2, confirmedCount: 40 })).toBe(false);
  });

  it('holds back a block nobody signed up to', () => {
    expect(meetsAutoPublishFloor({ eventCount: 9, confirmedCount: 0 })).toBe(false);
  });

  it('passes Santiago, the small real block, which clears both bars', () => {
    expect(meetsAutoPublishFloor({ eventCount: 6, confirmedCount: 18 })).toBe(true);
  });
});
