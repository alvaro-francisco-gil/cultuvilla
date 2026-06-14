// Firestore Rules e2e tests for shape enforcement.
//
// These tests are the safety net that proves rules-level shape validation is
// still in place. Every user-writable create path is exercised against three
// attack patterns:
//   1. unknown field → DENY     (hasOnly check)
//   2. missing required field → DENY  (hasAll check)
//   3. wrong type on critical field → DENY  (per-field type check)
//
// If anyone weakens the shape helpers in firestore.rules, these tests fail.
// The rationale for rules-level enforcement (and why the typed converters
// alone aren't enough) is documented in the rules file header.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

async function seedMember(municipalityId: string, userId: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `municipalities/${municipalityId}/members/${userId}`),
      {
        role: 'user',
        joinedAt: new Date(),
        profileAnswers: {},
        profileCompletedAt: null,
        trustedNewsAuthor: false,
      },
    );
  });
}

async function seedOrgMember(orgId: string, userId: string, municipalityId: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `organizations/${orgId}`), {
      name: 'Test org',
      description: null,
      type: 'asociación',
      status: 'approved',
      municipalityId,
      requestedBy: userId,
      approvedBy: null,
      createdAt: new Date(),
      decidedAt: null,
    });
    await setDoc(doc(ctx.firestore(), `organizations/${orgId}/members/${userId}`), {
      joinedAt: new Date(),
    });
  });
}

const validNewsPayload = {
  municipalityId: 'm1',
  authorUserId: 'alice',
  authorOrgId: null,
  title: 'T',
  body: 'B',
  category: 'otro' as const,
  images: [],
  status: 'pending' as const,
  rejectionReason: null,
  submittedAt: new Date(),
  publishedAt: null,
  createdBy: 'alice',
  updatedAt: new Date(),
  reactionCounts: { like: 0, heart: 0 },
  commentCount: 0,
};

describe('shape enforcement — /news/{postId}', () => {
  it('accepts a valid full-shape payload', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'news/p1'), validNewsPayload));
  });

  it('rejects an unknown field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'news/p1'), { ...validNewsPayload, hackerField: 'pwn' }),
    );
  });

  it('rejects a missing required field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    const { title: _t, ...rest } = validNewsPayload;
    await assertFails(setDoc(doc(alice, 'news/p1'), rest));
  });

  it('rejects wrong type on a critical field (title as number)', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'news/p1'), { ...validNewsPayload, title: 42 }),
    );
  });

  it('rejects an unknown category enum value', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'news/p1'), { ...validNewsPayload, category: 'satire' }),
    );
  });
});

const validCommentPayload = {
  postId: 'p1',
  municipalityId: 'm1',
  authorUserId: 'alice',
  body: 'hi',
  createdAt: new Date(),
  hidden: false,
};

describe('shape enforcement — /newsComments/{commentId}', () => {
  it('accepts a valid full-shape payload', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'newsComments/c1'), validCommentPayload));
  });

  it('rejects an unknown field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsComments/c1'), { ...validCommentPayload, extra: 1 }),
    );
  });

  it('rejects a missing required field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    const { body: _b, ...rest } = validCommentPayload;
    await assertFails(setDoc(doc(alice, 'newsComments/c1'), rest));
  });

  it('rejects wrong type on hidden', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsComments/c1'), { ...validCommentPayload, hidden: 'no' }),
    );
  });
});

describe('shape enforcement — /newsReactions/{reactionId}', () => {
  const validReaction = {
    postId: 'p1',
    municipalityId: 'm1',
    userId: 'alice',
    kind: 'like' as const,
    createdAt: new Date(),
  };

  it('accepts a valid full-shape payload', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'newsReactions/p1_alice'), validReaction));
  });

  it('rejects an unknown field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsReactions/p1_alice'), { ...validReaction, weight: 99 }),
    );
  });

  it('rejects an unknown kind enum', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsReactions/p1_alice'), { ...validReaction, kind: 'fire' }),
    );
  });
});

describe('shape enforcement — /users/{uid}', () => {
  const validUserCreate = {
    email: 'alice@example.com',
    telephone: null,
    activeMunicipalityId: null,
    personId: null,
    birthday: null,
    biography: null,
    photoURL: null,
    createdAt: new Date(),
  };

  it('accepts a valid full-shape create', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), validUserCreate));
  });

  it('rejects creating with displayName (clients must not write it)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'users/alice'), { ...validUserCreate, displayName: 'spoof' }),
    );
  });

  it('rejects an unknown field on create', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'users/alice'), { ...validUserCreate, isAdmin: true }),
    );
  });

  it('rejects a missing required field on create', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const { email: _e, ...rest } = validUserCreate;
    await assertFails(setDoc(doc(alice, 'users/alice'), rest));
  });

  it('rejects wrong type on createdAt', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'users/alice'), { ...validUserCreate, createdAt: 'now' }),
    );
  });

  it('rejects an invalid birthday shape (extra key)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'users/alice'), {
        ...validUserCreate,
        birthday: { year: 1990, month: 5, day: 4, hour: 12 },
      }),
    );
  });
});

describe('shape enforcement — /persons/{personId}', () => {
  const validPerson = {
    givenName: 'Alice',
    middleNames: [],
    firstSurname: null,
    secondSurname: null,
    nickname: null,
    sex: null,
    birthday: null,
    deathDate: null,
    birthPlace: null,
    burialPlace: null,
    municipalityLinks: [],
    occupationIds: [],
    pendingOccupations: [],
    biography: null,
    photoURL: null,
    userId: null,
    createdBy: 'alice',
    createdAt: new Date(),
  };

  it('accepts a valid full-shape payload', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'persons/p1'), validPerson));
  });

  it('rejects an unknown field', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'persons/p1'), { ...validPerson, ssn: '123' }),
    );
  });

  it('rejects missing required field (givenName)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const { givenName: _g, ...rest } = validPerson;
    await assertFails(setDoc(doc(alice, 'persons/p1'), rest));
  });

  it('rejects an invalid sex enum', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'persons/p1'), { ...validPerson, sex: 'unicorn' }));
  });
});

describe('shape enforcement — /organizations/{orgId}', () => {
  const validOrg = {
    name: 'Peña X',
    description: null,
    imageURL: null,
    type: 'peña' as const,
    status: 'pending' as const,
    municipalityId: 'm1',
    requestedBy: 'alice',
    approvedBy: null,
    createdAt: new Date(),
    decidedAt: null,
  };

  it('accepts a valid full-shape payload', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'organizations/o1'), validOrg));
  });

  it('accepts an imageURL string', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'organizations/o1'), { ...validOrg, imageURL: 'https://x/o.png' }),
    );
  });

  it('rejects an unknown field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'organizations/o1'), { ...validOrg, secret: 'x' }),
    );
  });

  it('rejects unknown type enum', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'organizations/o1'), { ...validOrg, type: 'corporation' }),
    );
  });
});

describe('shape enforcement — /events/{eventId}', () => {
  const validEvent = {
    title: 'Fiesta',
    description: 'Annual',
    startDate: new Date(),
    endDate: null,
    location: { type: 'text', coordinates: null, text: 'Plaza' },
    imageURL: null,
    price: null,
    maxAttendees: null,
    telephoneRequired: false,
    status: 'published' as const,
    organizationId: 'o1',
    organizationName: 'Peña X',
    createdBy: 'alice',
    createdAt: new Date(),
    updatedAt: new Date(),
    municipalityId: 'm1',
    municipalityName: 'Villa',
    municipalityCoverImage: null,
    municipalityCoordinates: { lat: 40, lng: -3 },
  };

  it('accepts a valid full-shape payload', async () => {
    await seedOrgMember('o1', 'alice', 'm1');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'events/e1'), validEvent));
  });

  it('rejects an unknown field', async () => {
    await seedOrgMember('o1', 'alice', 'm1');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'events/e1'), { ...validEvent, bonus: 'x' }),
    );
  });

  it('rejects unknown status enum', async () => {
    await seedOrgMember('o1', 'alice', 'm1');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'events/e1'), { ...validEvent, status: 'archived' }),
    );
  });

  it('rejects wrong type on telephoneRequired', async () => {
    await seedOrgMember('o1', 'alice', 'm1');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'events/e1'), { ...validEvent, telephoneRequired: 'yes' }),
    );
  });
});

describe('shape enforcement — /occupationProposals/{id}', () => {
  const validProposal = {
    name: 'Apicultor',
    proposedBy: 'alice',
    proposedAt: new Date(),
    status: 'pending' as const,
    reviewedBy: null,
    reviewedAt: null,
    approvedOccupationId: null,
  };

  it('accepts a valid full-shape payload', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'occupationProposals/op1'), validProposal));
  });

  it('rejects an unknown field', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'occupationProposals/op1'), { ...validProposal, votes: 5 }),
    );
  });

  it('rejects wrong type on name', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'occupationProposals/op1'), { ...validProposal, name: 123 }),
    );
  });
});

describe('shape enforcement — /newsReports/{reportId}', () => {
  const validReport = {
    targetType: 'comment' as const,
    targetId: 'c1',
    postId: 'p1',
    municipalityId: 'm1',
    reporterUserId: 'alice',
    reason: 'spam',
    createdAt: new Date(),
    status: 'open' as const,
    resolvedBy: null,
    resolvedAt: null,
  };

  it('accepts a valid full-shape payload', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'newsReports/r1'), validReport));
  });

  it('rejects an unknown field', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsReports/r1'), { ...validReport, escalate: true }),
    );
  });

  it('rejects unknown targetType', async () => {
    await seedMember('m1', 'alice');
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(alice, 'newsReports/r1'), { ...validReport, targetType: 'post' }),
    );
  });
});
