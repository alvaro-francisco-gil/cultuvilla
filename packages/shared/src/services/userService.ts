import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseApp";
import type { UserProfile } from "../models/user";

const USERS_COLLECTION = "users";

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const docRef = doc(db, USERS_COLLECTION, uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data() as UserProfile;
}

export async function createUserProfile(
  profile: UserProfile
): Promise<void> {
  const docRef = doc(db, USERS_COLLECTION, profile.uid);
  await setDoc(docRef, profile);
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "uid">>
): Promise<void> {
  const docRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(docRef, data);
}
