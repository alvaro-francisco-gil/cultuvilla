/**
 * Deterministic, dataset-namespaced document IDs. Re-running a seeder upserts
 * the same docs (idempotent), and `--wipe` enumerates exactly these IDs.
 */

import { DATASET_SLUG } from './context.mjs';

export const villageDocId = (vid) => `seed-${DATASET_SLUG}-village-${vid}`;
export const orgDocId = (vid, oid) => `seed-${DATASET_SLUG}-org-${vid}-${oid}`;
export const eventDocId = (vid, oid, eid) => `seed-${DATASET_SLUG}-event-${vid}-${oid}-${eid}`;
export const personDocId = (userRef) => `seed-${DATASET_SLUG}-person-${userRef}`;
export const newsDocId = (vid, nid) => `seed-${DATASET_SLUG}-news-${vid}-${nid}`;
export const placeDocId = (vid, pid) => `seed-${DATASET_SLUG}-place-${vid}-${pid}`;
export const barrioDocId = (vid, bid) => `seed-${DATASET_SLUG}-barrio-${vid}-${bid}`;
