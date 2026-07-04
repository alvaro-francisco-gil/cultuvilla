// Reads Firestore emulator state over its REST API so flows can assert on the
// real backend effect of a UI action — not just what the screen shows. These
// assertions are the portable half of the shared substrate: identical when the
// native (Maestro) driver replaces Playwright, only the UI-driving differs.
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = process.env.E2E_FIREBASE_PROJECT ?? 'cultuvilla-test';

const base = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

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
  const res = await fetch(`${base}/${docPath}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`emulator GET ${docPath} -> ${res.status}`);
  return (await res.json()) as RestDoc;
}

async function listDocs(collectionPath: string): Promise<RestDoc[]> {
  const res = await fetch(`${base}/${collectionPath}`);
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
