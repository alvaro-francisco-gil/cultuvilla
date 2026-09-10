import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { CartelInput, WrappedInputs } from '@cultuvilla/shared/wrapped';
import { EventStatusSchema, RegistrationStatusSchema, isPrivateEvent, madridYear } from '@cultuvilla/shared/models';
import {
  eventRegistrationsCollection,
  eventsCollection,
  festivalPostersCollection,
  municipalityDoc,
  municipalityPeopleCollection,
  organizationDoc,
  userDoc,
} from '@cultuvilla/shared/firebase/refs/admin';

/**
 * Read everything a Wrapped is built from, for one municipality and window.
 *
 * Paths come from the typed factories in `firebase/refs/admin`, so collection
 * names still have one source of truth — but each ref is taken with
 * `.withConverter(null)` and read as raw fields, only the few the Wrapped needs.
 *
 * That is deliberate: the same reader runs in the callable AND in the local
 * preview, which reads another environment's data with this branch's code. A
 * converter tightened on develop (a new required field) would throw on every
 * prod doc that predates it — the municipality converter already would, since
 * prod has no `community.fiestas` until that backfill runs there. A field that
 * is missing or mistyped here degrades to a safe default instead of failing
 * the whole Wrapped.
 */

export interface GatheredWrapped {
  villageName: string;
  escudoUrl: string | null;
  inputs: WrappedInputs;
  /** Everyone in the censo, for the people wall. */
  people: { personId: string; displayName: string; photoURL: string | null }[];
  /** The whole poster archive, every year, for the carteles card. */
  posters: CartelInput[];
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function date(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Batched point reads; chunked so one Wrapped never issues an unbounded `getAll`. */
async function getByIds(
  db: Firestore,
  ids: string[],
  refFor: (id: string) => DocumentReference,
): Promise<Map<string, Raw>> {
  const out = new Map<string, Raw>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    const refs = unique.slice(i, i + 100).map(refFor);
    if (refs.length === 0) continue;
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) out.set(s.id, s.data() as Raw);
  }
  return out;
}

export async function gatherWrappedInputs(
  db: Firestore,
  municipalityId: string,
  window: { start: Date; end: Date },
): Promise<GatheredWrapped> {
  const muniSnap = await municipalityDoc(db, municipalityId).withConverter(null).get();
  if (!muniSnap.exists) throw new Error(`municipality ${municipalityId} not found`);
  const muni = muniSnap.data() as Raw;

  const eventsSnap = await eventsCollection(db).withConverter(null).where('municipalityId', '==', municipalityId).get();
  const events = eventsSnap.docs.flatMap((d) => {
    const e = d.data();
    const startDate = date(e.startDate);
    const status = EventStatusSchema.safeParse(e.status);
    if (!startDate || !status.success) return [];
    // An org-private event is visible only to that org's members, and every
    // Wrapped card is a forwardable image. Dropped here, before registrations
    // are read, so it reaches neither a card nor a stat nor the people wall.
    const visibility = e.visibility === 'organization' ? 'organization' : 'public';
    if (isPrivateEvent({ visibility, visibilityOrgId: str(e.visibilityOrgId) })) return [];
    return [
      {
        id: d.id,
        title: str(e.title) ?? '',
        status: status.data,
        startDate,
        imageURL: str(e.imageURL),
        commentCount: num(e.commentCount),
        maxAttendees: typeof e.maxAttendees === 'number' ? e.maxAttendees : null,
        createdBy: str(e.createdBy),
        organizerOrgIds: strs(e.organizerOrgIds),
      },
    ];
  });

  // Registrations carry no municipalityId, so they are reachable only per
  // event. Only live, in-window events are worth reading.
  const t0 = window.start.getTime();
  const t1 = window.end.getTime();
  const relevant = events.filter(
    (e) => e.status !== 'cancelled' && e.startDate.getTime() >= t0 && e.startDate.getTime() <= t1,
  );
  const regSnaps = await Promise.all(
    relevant.map((e) => eventRegistrationsCollection(db, e.id).withConverter(null).get()),
  );
  const registrations = regSnaps.flatMap((snap, i) =>
    snap.docs.flatMap((d) => {
      const r = d.data();
      const personId = str(r.personId);
      const userId = str(r.userId);
      const status = RegistrationStatusSchema.safeParse(r.status);
      if (!personId || !userId || !status.success) return [];
      return [{ eventId: relevant[i].id, personId, userId, status: status.data }];
    }),
  );

  // Only people whose profile is public. The people wall is a forwardable image
  // carrying names and faces — `isPublic: false` is someone opting out of
  // exactly that, so they are neither drawn nor counted. Strictly `=== true`:
  // a row missing the flag is treated as private, never as consent.
  const peopleSnap = await municipalityPeopleCollection(db)
    .withConverter(null)
    .where('municipalityId', '==', municipalityId)
    .get();
  const people = peopleSnap.docs.flatMap((d) => {
    const p = d.data();
    const personId = str(p.personId);
    if (!personId || p.isPublic !== true) return [];
    return [{ personId, displayName: str(p.displayName) ?? '?', photoURL: str(p.photoURL) }];
  });

  const orgIds = relevant.flatMap((e) => e.organizerOrgIds);
  const creatorIds = relevant.flatMap((e) => (e.createdBy ? [e.createdBy] : []));
  const [orgDocs, userDocs] = await Promise.all([
    getByIds(db, orgIds, (id) => organizationDoc(db, id).withConverter(null)),
    getByIds(db, creatorIds, (id) => userDoc(db, id).withConverter(null)),
  ]);

  const year = madridYear(window.start);
  // Every year, not just this one: the carteles card sets this year's posters
  // against the pueblo's whole archive. Only `active` posters: this becomes a
  // forwardable image, so it allowlists rather than excluding `hidden` — a
  // denylist would leak any moderation status added later.
  const postersSnap = await festivalPostersCollection(db)
    .withConverter(null)
    .where('municipalityId', '==', municipalityId)
    .get();
  const posters = postersSnap.docs.flatMap((d) => {
    const p = d.data();
    const images = strs(p.images);
    if (typeof p.year !== 'number' || p.status !== 'active') return [];
    return [{ id: d.id, year: p.year, title: str(p.title), imageURL: images.length > 0 ? images[0] : null }];
  });

  return {
    villageName: str(muni.name) ?? '',
    escudoUrl: str(muni.escudoManualUrl) ?? str(muni.escudoUrl),
    people,
    posters,
    inputs: {
      window,
      events,
      registrations,
      organizations: [...orgDocs].map(([id, o]) => ({ id, name: str(o.name) ?? '', imageURL: str(o.imageURL) })),
      organizerProfiles: [...userDocs].map(([userId, u]) => ({
        userId,
        displayName: str(u.displayName) ?? '',
        photoURL: str(u.photoURL),
      })),
      censoCount: people.length,
      censoPersonIds: people.map((p) => p.personId),
      posterCount: posters.filter((p) => p.year === year).length,
    },
  };
}
