import { useEffect, useMemo, useState } from 'react';
// Import from the same subpaths the rest of the app uses, NOT the bare
// `@cultuvilla/shared` entry. `.` is the only subpath in the package's
// `exports` map, so Metro resolves it via package-exports while every other
// import resolves via legacy fallback — and the two strategies don't dedupe the
// shared `firebaseApp` module. Importing `getDb` from `.` would hand back a
// second, uninitialised Firebase singleton (state === null) even though
// bootstrapFirebase() initialised the legacy-resolved one. See
// docs/architecture/live-references.md.
import { getDb } from '@cultuvilla/shared/firebase';
import { useFirestoreDoc } from '@cultuvilla/shared/hooks';
import { userDoc, personDoc, organizationDoc } from '@cultuvilla/shared/firebase/refs/client';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';

/**
 * Owners whose document carries a name + image we resolve live. `person` and
 * `organization` carry their own avatar (`photoURL` / `imageURL`); a `user`'s
 * avatar lives on the linked person doc — the user doc's `photoURL` is
 * frequently null — so we resolve the person and use its photo as the fallback.
 */
export type OwnerType = 'user' | 'person' | 'organization';

export interface OwnerSummary {
  name: string | null;
  imageUri: string | null;
  loading: boolean;
}

/**
 * Live-resolve an owner reference (an id, not a copied value) to its current
 * name + image by subscribing to the source document. Backs both `LiveAvatar`
 * (image only) and `LiveOwnerChip` (image + name). See
 * docs/architecture/live-references.md for why these are read live rather than
 * denormalised onto every referencing doc.
 *
 * Subscriptions dedupe by path in `useFirestoreDoc`, so a chip and an avatar for
 * the same owner — or N rows for the same owner — share one Firestore listener.
 */
export function useOwnerSummary(
  ownerId: string | null | undefined,
  ownerType: OwnerType,
): OwnerSummary {
  const ref = useMemo(() => {
    if (!ownerId) return null;
    const db = getDb();
    switch (ownerType) {
      case 'user':
        return userDoc(db, ownerId);
      case 'person':
        return personDoc(db, ownerId);
      case 'organization':
        return organizationDoc(db, ownerId);
      default:
        return null;
    }
  }, [ownerId, ownerType]);

  // The per-collection converters give each ref a distinct DocumentReference<T>,
  // so we erase to the hook's own parameter type and re-type the payload below.
  const { data: raw, loading } = useFirestoreDoc(
    ref as unknown as Parameters<typeof useFirestoreDoc>[0],
  );
  const data = raw as
    | {
        displayName?: string | null;
        name?: string | null;
        photoURL?: string | null;
        imageURL?: string | null;
        givenName?: string;
        middleNames?: string[];
        firstSurname?: string;
        secondSurname?: string | null;
      }
    | undefined;

  // A `user`'s avatar lives on their linked person doc, which is a query
  // (persons.userId == uid) rather than a doc we can subscribe to by path. We
  // resolve it once per uid and fall back to it when the user doc has no photo.
  const [personPhotoURL, setPersonPhotoURL] = useState<string | null>(null);
  useEffect(() => {
    if (ownerType !== 'user' || !ownerId) {
      setPersonPhotoURL(null);
      return;
    }
    let cancelled = false;
    setPersonPhotoURL(null);
    getPersonByUserId(ownerId)
      .then((p) => {
        if (!cancelled) setPersonPhotoURL(p?.photoURL ?? null);
      })
      .catch(() => {
        if (!cancelled) setPersonPhotoURL(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, ownerType]);

  return useMemo(() => {
    if (!data) return { name: null, imageUri: null, loading };
    switch (ownerType) {
      case 'organization':
        return { name: data.name ?? null, imageUri: data.imageURL ?? null, loading };
      case 'person':
        return {
          name: data.givenName
            ? buildDisplayName({
                givenName: data.givenName,
                middleNames: data.middleNames ?? [],
                firstSurname: data.firstSurname ?? '',
                secondSurname: data.secondSurname ?? null,
              })
            : null,
          imageUri: data.photoURL ?? null,
          loading,
        };
      case 'user':
      default:
        return {
          name: data.displayName ?? null,
          imageUri: data.photoURL ?? personPhotoURL ?? null,
          loading,
        };
    }
  }, [data, ownerType, loading, personPhotoURL]);
}
