import { getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { getDb } from '../firebase';
import { villageWrappedCollection, villageWrappedDoc } from '../firebase/refs/client';
import type { WrappedData } from '../models/wrapped/WrappedDataModel';

export type VillageWrapped = WrappedData & { id: string };

/**
 * A village's published Wrapped cards, newest first.
 *
 * Only `published` rows: a draft is the admin's to release, and the rules
 * enforce the same thing server-side — this filter keeps a member's query from
 * being rejected wholesale for touching a draft.
 */
export async function getPublishedVillageWrapped(municipalityId: string): Promise<VillageWrapped[]> {
  const snap = await getDocs(
    query(
      villageWrappedCollection(getDb()),
      where('municipalityId', '==', municipalityId),
      where('status', '==', 'published'),
      orderBy('windowStart', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** One Wrapped by its deterministic id. Drafts resolve only for village admins. */
export async function getVillageWrapped(wrappedId: string): Promise<VillageWrapped | null> {
  const snap = await getDoc(villageWrappedDoc(getDb(), wrappedId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
