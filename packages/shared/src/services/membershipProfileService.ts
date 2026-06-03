import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getDb } from '../firebase';
import type { ProfileAnswers, ProfileFormField } from '../models/municipality/CensoTypes';
import { isCensoComplete } from './censoService';

/**
 * Saves the user's answers to a municipality's censo. If all required fields
 * are filled, sets profileCompletedAt; otherwise clears it.
 *
 * Only the user themselves should call this (security rules enforce that).
 */
export async function saveProfileAnswers(
  municipalityId: string,
  userId: string,
  fields: ProfileFormField[],
  answers: ProfileAnswers,
): Promise<void> {
  // updateDoc bypasses the converter; inline untyped doc lets the partial
  // payload (FieldValue | null union on profileCompletedAt) typecheck.
  const complete = isCensoComplete(fields, answers);
  await updateDoc(doc(getDb(), 'municipalities', municipalityId, 'members', userId), {
    profileAnswers: answers,
    profileCompletedAt: complete ? serverTimestamp() : null,
  });
}

/**
 * Aggregates predefined-field answers across all members of a municipality,
 * returning a map of `{ key -> Set<value> }`. Useful as input to schema
 * transition validation. Reading the full members collection is fine for
 * a single-village admin operation; not used in hot paths.
 */
export function collectUsedValues(
  members: { profileAnswers: ProfileAnswers }[],
): Record<string, Set<string | number | boolean>> {
  const out: Record<string, Set<string | number | boolean>> = {};
  for (const m of members) {
    for (const [k, v] of Object.entries(m.profileAnswers)) {
      // Lazy-init the bucket. Cast through `unknown | undefined` because the
      // index signature elides `| undefined` here (apps/mobile compiles with
      // noUncheckedIndexedAccess, so consumers do see the union).
      let bucket = (out as Record<string, Set<string | number | boolean> | undefined>)[k];
      if (bucket === undefined) {
        bucket = new Set();
        out[k] = bucket;
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') bucket.add(item);
        }
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        if (v !== '') bucket.add(v);
      }
    }
  }
  return out;
}

/**
 * Marks profileCompletedAt by converting the Firestore Timestamp on read.
 * Helper for callers that need a Date.
 */
export function profileCompletedAtToDate(
  raw: unknown,
): Date | null {
  return raw instanceof Timestamp ? raw.toDate() : null;
}
