import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { municipalityPersonDoc } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

interface DirectoryPerson {
  displayName: string;
  sortName: string;
  photoURL: string | null;
  userId: string | null;
  municipalityIds: Set<string>;
}

function asDirectoryPerson(data: Record<string, unknown>): DirectoryPerson {
  const rawMiddleNames: unknown = data['middleNames'];
  const middleNames = Array.isArray(rawMiddleNames)
    ? rawMiddleNames.filter((name): name is string => typeof name === 'string')
    : [];
  const nameParts = [
    data['givenName'],
    ...middleNames,
    data['firstSurname'],
    data['secondSurname'],
  ].filter((part): part is string => typeof part === 'string' && part.length > 0);
  const displayName = nameParts.join(' ');
  const links = Array.isArray(data['municipalityLinks']) ? data['municipalityLinks'] : [];
  const municipalityIds = new Set(
    links.flatMap((link) => {
      if (!link || typeof link !== 'object') return [];
      const municipalityId = (link as Record<string, unknown>)['municipalityId'];
      return typeof municipalityId === 'string' && municipalityId.length > 0 ? [municipalityId] : [];
    }),
  );
  return {
    displayName,
    sortName: displayName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-ES'),
    photoURL: typeof data['photoURL'] === 'string' ? data['photoURL'] : null,
    userId: typeof data['userId'] === 'string' ? data['userId'] : null,
    municipalityIds,
  };
}

/**
 * Keeps the municipality-scoped people directory in sync with the canonical
 * person record. The directory is an alphabetical list projection; clients
 * cannot write it directly.
 */
export const syncMunicipalityPeople = onDocumentWritten(
  { document: 'persons/{personId}', region: 'us-central1' },
  async (event) => {
    const handler = 'syncMunicipalityPeople';
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const beforePerson = before ? asDirectoryPerson(before) : null;
    const afterPerson = after ? asDirectoryPerson(after) : null;
    const beforeMunicipalities = beforePerson?.municipalityIds ?? new Set<string>();
    const afterMunicipalities = afterPerson?.municipalityIds ?? new Set<string>();
    const affectedMunicipalities = new Set([...beforeMunicipalities, ...afterMunicipalities]);
    if (affectedMunicipalities.size === 0) return;

    const { personId } = event.params;
    const batch = db.batch();
    for (const municipalityId of affectedMunicipalities) {
      const ref = municipalityPersonDoc(db, municipalityId, personId);
      if (!afterPerson || !afterMunicipalities.has(municipalityId)) {
        batch.delete(ref);
        continue;
      }
      batch.set(ref, {
        municipalityId,
        personId,
        displayName: afterPerson.displayName,
        sortName: afterPerson.sortName,
        photoURL: afterPerson.photoURL,
        userId: afterPerson.userId,
      });
    }
    await batch.commit();
    logger.info('Municipality people directory synchronized', {
      handler,
      personId,
      municipalityCount: affectedMunicipalities.size,
    });
  },
);
