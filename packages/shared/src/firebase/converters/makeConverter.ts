import type { z } from 'zod';
import { normalize, denormalize, type SdkCtors } from './walkers';

/**
 * Build a Firestore converter (`{ toFirestore, fromFirestore }`) from a Zod
 * schema and an SDK adapter. Strict on both directions:
 *   - reads: snap.data() is normalized (Timestamp -> Date, GeoPoint -> {lat,lng})
 *     and then validated against the schema; throws on mismatch
 *   - writes: the model is validated against the schema first, then denormalized
 *     (Date -> Timestamp, {lat,lng} -> GeoPoint)
 *
 * The returned object is shaped to match Firestore's `FirestoreDataConverter`.
 * We don't import that type directly so the same converter works for both the
 * client SDK and the admin SDK (which expose structurally-identical interfaces).
 */
export function makeConverter<S extends z.ZodType>(schema: S, sdk: SdkCtors) {
  type Model = z.infer<S>;
  return {
    toFirestore(model: Model): Record<string, unknown> {
      const parsed = schema.parse(model);
      return denormalize(parsed, sdk) as Record<string, unknown>;
    },
    fromFirestore(snap: { data(): unknown }): Model {
      const normalized = normalize(snap.data(), sdk);
      return schema.parse(normalized);
    },
  };
}
