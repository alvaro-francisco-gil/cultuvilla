// Global registry for Firestore (or any) listener unsubscribe handles. Every
// listener registered here is reachable from a single `clearAll()` — the
// canonical call site is the auth-state listener: when the user signs out,
// `clearAll()` tears down every active subscription *before* Firebase reports
// the new (null) auth, so listeners can't fire one last permission-denied
// snapshot at the moment the rules flip closed.
//
//   const unsubscribe = listenerManager.add(rawUnsubscribe, 'eventService:subscribeUpcoming')
//   ...
//   unsubscribe()  // also deregisters from this manager

type Unsubscribe = () => void;

type ListenerEntry = {
  unsubscribeFn: Unsubscribe;
  label: string;
};

const listeners = new Map<string, ListenerEntry>();
let nextId = 1;

const NO_OP: Unsubscribe = () => {};

function generateId(label?: string): string {
  const suffix = label?.trim() || 'listener';
  return `${Date.now()}-${nextId++}-${suffix}`;
}

export function add(unsubscribeFn?: unknown, label?: string): Unsubscribe {
  if (typeof unsubscribeFn !== 'function') {
    return NO_OP;
  }

  const id = generateId(label);
  listeners.set(id, { unsubscribeFn: unsubscribeFn as Unsubscribe, label: label ?? '' });

  return () => {
    try {
      const entry = listeners.get(id);
      entry?.unsubscribeFn();
    } catch {
      // Cleanup failures must not propagate — they would mask the calling
      // unmount/teardown path. Logged-but-swallowed is the right default here.
    } finally {
      listeners.delete(id);
    }
  };
}

export function removeByLabel(label?: string): void {
  if (!label) return;

  for (const [id, entry] of listeners.entries()) {
    if (entry.label === label) {
      try {
        entry.unsubscribeFn();
      } catch {
        // see add() for rationale
      } finally {
        listeners.delete(id);
      }
    }
  }
}

export function clearAll(): Promise<void> {
  const entries = Array.from(listeners.values());
  listeners.clear();

  for (const entry of entries) {
    try {
      entry.unsubscribeFn();
    } catch {
      // see add() for rationale
    }
  }
  return Promise.resolve();
}

export function count(): number {
  return listeners.size;
}

const listenerManager = {
  add,
  removeByLabel,
  clearAll,
  count,
};

export default listenerManager;
