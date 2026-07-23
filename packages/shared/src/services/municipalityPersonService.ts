import { getDocs, orderBy, query, where } from 'firebase/firestore';
import { getDb } from '../firebase';
import { municipalityPeopleCollection } from '../firebase/refs/client';
import type { MunicipalityPersonData } from '../models/municipality/MunicipalityPersonDataModel';

export async function getMunicipalityPeople(
  municipalityId: string,
): Promise<(MunicipalityPersonData & { id: string })[]> {
  const q = query(
    municipalityPeopleCollection(getDb()),
    where('municipalityId', '==', municipalityId),
    orderBy('sortName', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
