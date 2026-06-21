import { useMemo } from 'react';
import { getDb, useFirestoreDoc } from '@cultuvilla/shared';
import { userDoc, personDoc, organizationDoc } from '@cultuvilla/shared/firebase/refs/client';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';

/**
 * Owners whose document carries a name + image we resolve live. `user`/`person`
 * expose a name + `photoURL`; `organization` exposes `name` + `imageURL`.
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
        return { name: data.displayName ?? null, imageUri: data.photoURL ?? null, loading };
    }
  }, [data, ownerType, loading]);
}
