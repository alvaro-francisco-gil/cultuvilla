import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '../firebase';

export async function isAppAdmin(userId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(getDb(), 'admins', userId));
    return snap.exists();
  } catch {
    // Rules deny read for non-admins — treat as "not admin".
    return false;
  }
}
