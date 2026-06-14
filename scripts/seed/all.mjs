#!/usr/bin/env node
/**
 * Orchestrator: seed (or wipe) every domain for a dataset in dependency order.
 * Replaces the former monolithic seed-dev-fixtures.mjs.
 *
 *   DATASET=demo_1 pnpm seed:dev          # seed everything
 *   DATASET=demo_1 pnpm seed:dev:wipe     # wipe everything (reverse order)
 *
 * Each domain also has a standalone script (scripts/seed/<domain>.mjs) for
 * à-la-carte runs. See `pnpm seed:dev:<domain>`.
 */

import { DATASET, SEED_BATCH, WIPE, projectId } from './lib/context.mjs';
import { loadDataset } from './lib/dataset.mjs';
import { runAsMain } from './lib/run.mjs';

import { seedUsers, wipeUsers } from './users.mjs';
import { seedVillages, wipeVillages } from './villages.mjs';
import { seedOrgs, wipeOrgs } from './orgs.mjs';
import { seedPlaces, wipePlaces } from './places.mjs';
import { seedEvents, wipeEvents } from './events.mjs';
import { seedNews, wipeNews } from './news.mjs';

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) {
    console.log(`[wipe] project=${projectId} dataset=${DATASET}`);
    // Reverse dependency order.
    await wipeNews(dataset);
    await wipeEvents(dataset);
    await wipePlaces(dataset);
    await wipeOrgs(dataset);
    await wipeVillages(dataset);
    await wipeUsers(dataset);
    console.log('[wipe] done.');
    return;
  }
  console.log(`[seed] project=${projectId} dataset=${DATASET} batch=${SEED_BATCH}`);
  await seedUsers(dataset);
  await seedVillages(dataset);
  await seedOrgs(dataset);
  await seedPlaces(dataset);
  await seedEvents(dataset);
  await seedNews(dataset);
  console.log('[seed] done.');
}

runAsMain(import.meta.url, run);
