// Reads Firestore emulator state over its REST API so flows can assert on the
// real backend effect of a UI action — not just what the screen shows. These
// assertions are the portable half of the shared substrate: identical when the
// native (Maestro) driver replaces Playwright, only the UI-driving differs.
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = process.env.E2E_FIREBASE_PROJECT ?? 'cultuvilla-test';

const base = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

// These reads assert backend truth, not security rules. The emulator enforces
// rules on its REST API, so an unauthenticated read of a rule-protected
// collection (e.g. organizerRequests, members) comes back empty and silently
// fails the assertion. `Bearer owner` is the emulator's rules-bypass token —
// it makes every read see ground truth regardless of the doc's read rule.
const OWNER_HEADERS = { Authorization: 'Bearer owner' } as const;

interface RestValue {
  integerValue?: string;
  stringValue?: string;
  booleanValue?: boolean;
}
interface RestDoc {
  name?: string;
  fields?: Record<string, RestValue>;
}

async function getDoc(docPath: string): Promise<RestDoc | null> {
  const res = await fetch(`${base}/${docPath}`, { headers: OWNER_HEADERS });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`emulator GET ${docPath} -> ${res.status}`);
  return (await res.json()) as RestDoc;
}

async function listDocs(collectionPath: string): Promise<RestDoc[]> {
  const res = await fetch(`${base}/${collectionPath}`, { headers: OWNER_HEADERS });
  if (!res.ok) return [];
  const json = (await res.json()) as { documents?: RestDoc[] };
  return json.documents ?? [];
}

/** Denormalized attendee count on the event doc; registerToEvent increments it. */
export async function getEventConfirmedCount(eventId: string): Promise<number> {
  const doc = await getDoc(`events/${eventId}`);
  return Number(doc?.fields?.confirmedCount?.integerValue ?? 0);
}

/** Registration docs under events/{eventId}/registrations. */
export async function listRegistrations(eventId: string): Promise<RestDoc[]> {
  return listDocs(`events/${eventId}/registrations`);
}

// ── Field extractors ────────────────────────────────────────────────────────
// The REST payload types every field (`{ stringValue }`, `{ booleanValue }`, …).
// These pull a typed scalar off a doc; the doc id is the last path segment of
// the resource `name`, which the collection-list endpoint returns but the
// document body does not otherwise expose.
function fieldStr(doc: RestDoc | null, name: string): string | null {
  return doc?.fields?.[name]?.stringValue ?? null;
}
function fieldBool(doc: RestDoc | null, name: string): boolean {
  return doc?.fields?.[name]?.booleanValue ?? false;
}
function docIdOf(doc: RestDoc): string {
  return doc.name?.split('/').pop() ?? '';
}

// ── Organizer-request → approval ──────────────────────────────────────────────

/** `community != null` denorm on the municipality; flips true on organizer approval. */
export async function isCommunityActive(municipalityId: string): Promise<boolean> {
  return fieldBool(await getDoc(`municipalities/${municipalityId}`), 'communityActive');
}

/**
 * Status of the organizer request for a municipality (optionally by requester).
 * The request id is server-generated, so we match on the indexed fields instead.
 * Returns `null` when no matching request exists yet.
 */
export async function findOrganizerRequestStatus(match: {
  municipalityId: string;
  userId?: string;
}): Promise<string | null> {
  const docs = await listDocs('organizerRequests');
  const hit = docs.find(
    (d) =>
      fieldStr(d, 'municipalityId') === match.municipalityId &&
      (match.userId === undefined || fieldStr(d, 'userId') === match.userId),
  );
  return hit ? fieldStr(hit, 'status') : null;
}

/** Role of a village member (`null` if not a member); organizer approval → 'admin'. */
export async function getVillageMemberRole(
  municipalityId: string,
  userId: string,
): Promise<string | null> {
  return fieldStr(await getDoc(`municipalities/${municipalityId}/members/${userId}`), 'role');
}

// ── Organization create → approve ──────────────────────────────────────────────

/** Find the org created in a municipality (by name, since the id is generated). */
export async function findOrganization(match: {
  municipalityId: string;
  name?: string;
}): Promise<{ id: string; status: string | null } | null> {
  const docs = await listDocs('organizations');
  const hit = docs.find(
    (d) =>
      fieldStr(d, 'municipalityId') === match.municipalityId &&
      (match.name === undefined || fieldStr(d, 'name') === match.name),
  );
  return hit ? { id: docIdOf(hit), status: fieldStr(hit, 'status') } : null;
}

/** Whether a user has a member doc under an organization. */
export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  return (await getDoc(`organizations/${orgId}/members/${userId}`)) !== null;
}

// ── Village join ─────────────────────────────────────────────────────────────

/** Whether a user has any member doc under a village. */
export async function isVillageMember(municipalityId: string, userId: string): Promise<boolean> {
  return (await getDoc(`municipalities/${municipalityId}/members/${userId}`)) !== null;
}

// ── Create & publish event ────────────────────────────────────────────────────

/** Events scoped to a municipality (top-level collection, `municipalityId` field). */
export async function listEventsByMunicipality(municipalityId: string): Promise<RestDoc[]> {
  const docs = await listDocs('events');
  return docs.filter((d) => fieldStr(d, 'municipalityId') === municipalityId);
}

/** Find an event by title within a municipality (the id is generated on create). */
export async function findEvent(match: {
  municipalityId: string;
  title: string;
}): Promise<{ id: string; status: string | null } | null> {
  const hit = (await listEventsByMunicipality(match.municipalityId)).find(
    (d) => fieldStr(d, 'title') === match.title,
  );
  return hit ? { id: docIdOf(hit), status: fieldStr(hit, 'status') } : null;
}

// ── Registrations / waitlist ─────────────────────────────────────────────────

export async function getRegistration(
  eventId: string,
  regId: string,
): Promise<{ id: string; personId: string | null; status: string | null } | null> {
  const doc = await getDoc(`events/${eventId}/registrations/${regId}`);
  if (!doc) return null;
  return {
    id: regId,
    personId: fieldStr(doc, 'personId'),
    status: fieldStr(doc, 'status'),
  };
}

export async function findRegistration(match: {
  eventId: string;
  personId?: string;
  userId?: string;
}): Promise<{ id: string; status: string | null } | null> {
  const docs = await listDocs(`events/${match.eventId}/registrations`);
  const hit = docs.find(
    (d) =>
      (match.personId === undefined || fieldStr(d, 'personId') === match.personId) &&
      (match.userId === undefined || fieldStr(d, 'userId') === match.userId),
  );
  return hit ? { id: docIdOf(hit), status: fieldStr(hit, 'status') } : null;
}

// ── Onboarding + profile ──────────────────────────────────────────────────────

/** The personId linked on a user profile — set when onboarding completes. */
export async function getUserPersonId(userId: string): Promise<string | null> {
  return fieldStr(await getDoc(`users/${userId}`), 'personId');
}

/** Whether a persons/{id} doc exists (created by the onboarding flow). */
export async function personExists(personId: string): Promise<boolean> {
  return (await getDoc(`persons/${personId}`)) !== null;
}

// ── News + optimistic content visibility ─────────────────────────────────────

export async function findNewsPost(match: {
  municipalityId: string;
  title: string;
}): Promise<{ id: string; status: string | null } | null> {
  const docs = await listDocs('news');
  const hit = docs.find(
    (d) =>
      fieldStr(d, 'municipalityId') === match.municipalityId &&
      fieldStr(d, 'title') === match.title,
  );
  return hit ? { id: docIdOf(hit), status: fieldStr(hit, 'status') } : null;
}

export async function getPlaceStatus(
  municipalityId: string,
  placeId: string,
): Promise<string | null> {
  return fieldStr(await getDoc(`municipalities/${municipalityId}/places/${placeId}`), 'status');
}

/** Poll until `predicate(value)` holds or the deadline passes. */
export async function waitFor<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  { timeoutMs = 15_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!predicate(last)) {
    if (Date.now() > deadline) {
      throw new Error(`waitFor: predicate not satisfied within ${timeoutMs}ms (last=${JSON.stringify(last)})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await read();
  }
  return last;
}
