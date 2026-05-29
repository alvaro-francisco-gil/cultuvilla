import { FirebaseError } from '@firebase/util';
import { getAuth } from '@firebase/auth';

declare const __DEV__: boolean;

/**
 * Wraps a Firestore (or any) async op so that permission-denied errors
 * surface a labelled log line in dev. In production it is a pass-through.
 *
 * The label is supplied by the caller (e.g. `'profile:getPersonByUserId'`)
 * — the helper does not try to introspect query paths.
 */
export async function withFirestoreErrorLog<T>(
  label: string,
  op: () => Promise<T>,
): Promise<T> {
  if (!__DEV__) return op();
  try {
    return await op();
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      let uid = 'anon';
      try {
        uid = getAuth().currentUser?.uid ?? 'anon';
      } catch {
        // Auth may not be initialised yet in odd edge cases — keep 'anon'.
      }
      console.warn(
        `[firestore-deny] label=${label} code=${err.code} uid=${uid}`,
      );
    }
    throw err;
  }
}
