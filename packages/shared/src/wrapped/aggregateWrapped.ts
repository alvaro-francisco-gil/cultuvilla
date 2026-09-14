import type { EventStatus } from '../models/event/EventDataModel';
import type { RegistrationStatus } from '../models/event/RegistrationDataModel';
import {
  MAX_ORG_CREDITS,
  MAX_PERSON_CREDITS,
  type WrappedStats,
  type WrappedData,
} from '../models/wrapped/WrappedDataModel';

/**
 * Pure aggregation behind a village Wrapped. Takes plain inputs, never touches
 * Firestore, so every rule that makes the figures honest is unit-testable
 * against real Matabuena shapes.
 *
 * The rules, each of which exists because the naive version is wrong:
 *  - cancelled events never count (organizers cancel-and-recreate);
 *  - participation is distinct PERSONAS, not registrations (families sign up
 *    several each — summing overstated Matabuena by 38%);
 *  - everything is a sign-up, never attendance (`checkedInAt` is unused);
 *  - every organizer is credited, once per event: all of `organizerOrgIds`, and
 *    all of `organizerUserIds` plus `createdBy`. An event run by a comisión
 *    lists its whole team, and each of them organized it — crediting only the
 *    person who typed the event in erased most of the people who did the work.
 */

/** Minimum a block needs before the timer may publish it unattended. */
export const AUTO_PUBLISH_MIN_EVENTS = 3;
export const AUTO_PUBLISH_MIN_CONFIRMED = 1;

export interface WrappedEventInput {
  id: string;
  title: string;
  status: EventStatus;
  startDate: Date;
  imageURL: string | null;
  commentCount: number;
  maxAttendees: number | null;
  createdBy: string | null;
  organizerOrgIds: string[];
  organizerUserIds: string[];
}

export interface WrappedRegistrationInput {
  eventId: string;
  personId: string;
  userId: string;
  status: RegistrationStatus;
}

export interface WrappedInputs {
  /** The range everything is counted over; an event counts when it starts inside it. */
  range: { start: Date; end: Date };
  events: WrappedEventInput[];
  registrations: WrappedRegistrationInput[];
  organizations: { id: string; name: string; imageURL: string | null }[];
  organizerProfiles: { userId: string; displayName: string; photoURL: string | null }[];
  censoCount: number;
  /** Persona ids in the censo (`municipalityPeople`), to tell residents apart
   *  from participants with no village link or from elsewhere. */
  censoPersonIds: string[];
  posterCount: number;
}

export type WrappedAggregate = Pick<
  WrappedData,
  'stats' | 'fullestEvent' | 'mostCommentedEvent' | 'topOrganizations' | 'topOrganizers'
> & {
  /** The counted events, in date order — the input to the events card. */
  countedEvents: WrappedEventInput[];
  /** Distinct persona ids that took part — the input to the people card. */
  participantPersonIds: string[];
};

/**
 * First element, typed honestly. `xs[0]` is typed as always present, yet it is
 * undefined for a block with no counted events — so a guard written against it
 * gets flagged as dead and "simplified" away into a crash on an empty block.
 * (`Array.prototype.at` would say the same, but the repo targets ES2020.)
 */
function first<T>(xs: readonly T[]): T | undefined {
  return xs.length > 0 ? xs[0] : undefined;
}

function countIn(values: Set<string>, within: Set<string>): number {
  let n = 0;
  for (const v of values) if (within.has(v)) n++;
  return n;
}

export function inRange(d: Date, range: { start: Date; end: Date }): boolean {
  const t = d.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/** Rank by count desc, then name asc, so a recompute never reshuffles a tie. */
function rank<T extends { eventCount: number }>(items: T[], name: (t: T) => string, max: number): T[] {
  return [...items]
    .sort((a, b) => b.eventCount - a.eventCount || name(a).localeCompare(name(b), 'es'))
    .slice(0, max);
}

export function aggregateWrapped(inputs: WrappedInputs): WrappedAggregate {
  const countedEvents = inputs.events
    .filter((e) => e.status !== 'cancelled' && inRange(e.startDate, inputs.range))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const counted = new Set(countedEvents.map((e) => e.id));

  const regs = inputs.registrations.filter((r) => counted.has(r.eventId));
  const confirmedByEvent = new Map<string, number>();
  const persons = new Set<string>();
  const accounts = new Set<string>();
  let confirmedCount = 0;
  let waitlistedCount = 0;
  for (const r of regs) {
    persons.add(r.personId);
    accounts.add(r.userId);
    if (r.status === 'confirmed') {
      confirmedCount++;
      confirmedByEvent.set(r.eventId, (confirmedByEvent.get(r.eventId) ?? 0) + 1);
    } else {
      waitlistedCount++;
    }
  }

  const stats: WrappedStats = {
    eventCount: countedEvents.length,
    confirmedCount,
    waitlistedCount,
    uniquePersonCount: persons.size,
    uniqueAccountCount: accounts.size,
    commentCount: countedEvents.reduce((sum, e) => sum + e.commentCount, 0),
    censoCount: inputs.censoCount,
    censoParticipantCount: countIn(persons, new Set(inputs.censoPersonIds)),
    posterCount: inputs.posterCount,
  };

  const fullest = first(
    [...countedEvents].map((e) => ({ e, n: confirmedByEvent.get(e.id) ?? 0 })).sort((a, b) => b.n - a.n),
  );
  const fullestEvent =
    fullest && fullest.n > 0
      ? { eventId: fullest.e.id, title: fullest.e.title, count: fullest.n, capacity: fullest.e.maxAttendees }
      : null;

  const talked = first([...countedEvents].sort((a, b) => b.commentCount - a.commentCount));
  const mostCommentedEvent =
    talked && talked.commentCount > 0
      ? { eventId: talked.id, title: talked.title, count: talked.commentCount, capacity: talked.maxAttendees }
      : null;

  const orgCounts = new Map<string, number>();
  const personCounts = new Map<string, number>();
  for (const e of countedEvents) {
    // A Set per event: an id listed twice, or a creator who is also on the
    // organizer list, is still one event organized.
    for (const orgId of new Set(e.organizerOrgIds)) orgCounts.set(orgId, (orgCounts.get(orgId) ?? 0) + 1);
    const people = new Set(e.createdBy ? [...e.organizerUserIds, e.createdBy] : e.organizerUserIds);
    for (const userId of people) personCounts.set(userId, (personCounts.get(userId) ?? 0) + 1);
  }

  // A credit whose profile is gone is dropped rather than rendered as a raw id.
  const orgsById = new Map(inputs.organizations.map((o) => [o.id, o]));
  const topOrganizations = rank(
    [...orgCounts].flatMap(([id, eventCount]) => {
      const org = orgsById.get(id);
      return org ? [{ organizationId: id, name: org.name, eventCount, imageURL: org.imageURL }] : [];
    }),
    (o) => o.name,
    MAX_ORG_CREDITS,
  );

  const profilesById = new Map(inputs.organizerProfiles.map((p) => [p.userId, p]));
  const topOrganizers = rank(
    [...personCounts].flatMap(([userId, eventCount]) => {
      const p = profilesById.get(userId);
      return p ? [{ userId, displayName: p.displayName, eventCount, photoURL: p.photoURL }] : [];
    }),
    (p) => p.displayName,
    MAX_PERSON_CREDITS,
  );

  return {
    stats,
    fullestEvent,
    mostCommentedEvent,
    topOrganizations,
    topOrganizers,
    countedEvents,
    participantPersonIds: [...persons].sort(),
  };
}

/**
 * Whether a block may publish itself on the timer. A thin Wrapped published
 * unattended makes a village look dead on its own noticeboard, so below this
 * floor the doc is still computed and the admin still notified — it just waits
 * for an explicit publish.
 */
export function meetsAutoPublishFloor(stats: Pick<WrappedStats, 'eventCount' | 'confirmedCount'>): boolean {
  return stats.eventCount >= AUTO_PUBLISH_MIN_EVENTS && stats.confirmedCount >= AUTO_PUBLISH_MIN_CONFIRMED;
}
