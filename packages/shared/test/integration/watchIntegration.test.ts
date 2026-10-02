// The `watch*` service functions against the real Firestore emulator: a
// listener answers with what is there, then again on its own when the data
// changes — which is what lets a screen stop reloading on focus.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asAnon, seed } from '../helpers/roles';
import { festivalPostersCollection } from '../../src/firebase/refs/client';
import { buildFestivalPosterData } from '../../src/models/festivalPoster/FestivalPosterDataModel';
import { watchFestivalPosters } from '../../src/services/festivalPosterService';
import * as firebaseModule from '../../src/firebase';

const getEnv = useRulesTestEnv();

afterEach(() => {
  vi.restoreAllMocks();
});

async function seedPoster(municipalityId: string, year: number): Promise<void> {
  await seed(getEnv(), async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(
      doc(festivalPostersCollection(db)),
      buildFestivalPosterData({ municipalityId, villageSlug: 'pueblo', year, createdAt: new Date() }),
    );
  });
}

function nextEmission<T>(emissions: T[][], count: number): Promise<T[]> {
  return vi.waitFor(
    () => {
      if (emissions.length < count) throw new Error(`waiting for emission ${String(count)}`);
      return emissions[count - 1];
    },
    { timeout: 5000, interval: 25 },
  );
}

describe('watchFestivalPosters', () => {
  it('emits the current posters, then again when one is added', async () => {
    const municipalityId = `m-${String(Date.now())}`;
    await seedPoster(municipalityId, 2024);
    vi.spyOn(firebaseModule, 'getDb').mockReturnValue(asAnon(getEnv()));

    const emissions: { year: number }[][] = [];
    const unwatch = watchFestivalPosters(
      municipalityId,
      (posters) => emissions.push(posters),
      (error) => {
        throw error;
      },
    );
    try {
      expect((await nextEmission(emissions, 1)).map((p) => p.year)).toEqual([2024]);
      await seedPoster(municipalityId, 2025);
      const later = await vi.waitFor(
        () => {
          const latest = emissions.at(-1) ?? [];
          if (latest.length < 2) throw new Error('waiting for the new poster');
          return latest;
        },
        { timeout: 5000, interval: 25 },
      );
      expect(later.map((p) => p.year)).toEqual([2025, 2024]);
    } finally {
      unwatch();
    }
  });
});
