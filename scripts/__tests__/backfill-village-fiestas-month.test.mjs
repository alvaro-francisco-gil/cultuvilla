import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchFor, reduceBlock } from '../backfill-village-fiestas-month.mjs';

const oldBlock = {
  id: 'agosto',
  name: 'Fiestas de agosto',
  anchor: { month: 8, day: 14, days: 15 },
  years: { 2026: { start: new Date(), end: new Date() } },
};

test('reduces an anchored block to its name and month', () => {
  assert.deepEqual(reduceBlock(oldBlock), { id: 'agosto', name: 'Fiestas de agosto', month: 8 });
});

test('rewrites a village with an old block', () => {
  assert.deepEqual(patchFor({ community: { fiestas: [oldBlock] } }), {
    'community.fiestas': [{ id: 'agosto', name: 'Fiestas de agosto', month: 8 }],
  });
});

test('is idempotent: a reduced village is left alone', () => {
  assert.equal(patchFor({ community: { fiestas: [{ id: 'carmen', name: 'Carmen', month: 8 }] } }), null);
  assert.equal(patchFor({ community: { fiestas: [] } }), null);
});

test('leaves a village without fiestas or without a community alone', () => {
  assert.equal(patchFor({ community: {} }), null);
  assert.equal(patchFor({}), null);
});

test('drops a block with no month to keep rather than inventing one', () => {
  assert.deepEqual(patchFor({ community: { fiestas: [{ id: 'x', name: 'X' }, oldBlock] } }), {
    'community.fiestas': [{ id: 'agosto', name: 'Fiestas de agosto', month: 8 }],
  });
});
