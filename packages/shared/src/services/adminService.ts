import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function isAppAdmin(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', userId));
  return snap.exists();
}
