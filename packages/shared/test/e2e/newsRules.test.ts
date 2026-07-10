// Firestore Rules e2e tests for news, newsComments, newsReactions, newsReports.
// Also covers the tightened municipalities/{id}/members/{uid} update rule
// that prevents clients from setting trustedNewsAuthor directly.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

// ── helpers ──────────────────────────────────────────────────────────────────

async function seedMember(
  municipalityId: string,
  userId: string,
  extra: Record<string, unknown> = {}
) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${municipalityId}/members/${userId}`), {
      role: 'user',
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
      trustedNewsAuthor: false,
      ...extra,
    });
  });
}

async function seedPost(
  postId: string,
  municipalityId: string,
  createdBy: string,
  extra: Record<string, unknown> = {}
) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `news/${postId}`), {
      municipalityId,
      organizerUserIds: [createdBy],
      organizerOrgIds: [],
      title: 'Test post',
      body: 'Body text',
      category: 'otro',
      images: [],
      status: 'pending',
      rejectionReason: null,
      submittedAt: new Date(),
      publishedAt: null,
      createdBy,
      updatedAt: new Date(),
      reactionCounts: { like: 0, heart: 0 },
      commentCount: 0,
      ...extra,
    });
  });
}

// ── news post rules ───────────────────────────────────────────────────────────

describe('firestore.rules — /news/{postId}', () => {
  // 1. non-member tries to create a news doc → DENY
  it('1: non-member cannot create a news post', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(
      setDoc(doc(stranger, 'news/p1'), {
        municipalityId: 'm1',
        organizerUserIds: ['stranger'],
        organizerOrgIds: [],
        title: 'Hi',
        body: 'Hello',
        category: 'otro',
        images: [],
        content: [],
        coverImage: null,
        status: 'pending',
        rejectionReason: null,
        submittedAt: new Date(),
        publishedAt: null,
        createdBy: 'stranger',
        updatedAt: new Date(),
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      })
    );
  });

  // 2. member with trustedNewsAuthor=false creates with status='pending' → ALLOW
  it('2: regular member can create a pending news post', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'news/p1'), {
        municipalityId: 'm1',
        organizerUserIds: ['alice'],
        organizerOrgIds: [],
        title: 'Fiesta',
        body: 'Detalles',
        category: 'fiesta',
        images: [],
        content: [],
        coverImage: null,
        status: 'pending',
        rejectionReason: null,
        submittedAt: new Date(),
        publishedAt: null,
        createdBy: 'alice',
        updatedAt: new Date(),
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      })
    );
  });

  // 3. member with trustedNewsAuthor=false creates with status='approved' → DENY
  it('3: regular member cannot create an approved news post', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'news/p1'), {
        municipalityId: 'm1',
        organizerUserIds: ['alice'],
        organizerOrgIds: [],
        title: 'Fiesta',
        body: 'Detalles',
        category: 'fiesta',
        images: [],
        content: [],
        coverImage: null,
        status: 'approved',
        rejectionReason: null,
        submittedAt: new Date(),
        publishedAt: new Date(),
        createdBy: 'alice',
        updatedAt: new Date(),
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      })
    );
  });

  // 4. member with trustedNewsAuthor=true creates with status='approved' → ALLOW
  it('4: trusted author can create an approved news post', async () => {
    await seedMember('m1', 'bob', { trustedNewsAuthor: true });
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(
      setDoc(doc(bob, 'news/p1'), {
        municipalityId: 'm1',
        organizerUserIds: ['bob'],
        organizerOrgIds: [],
        title: 'Historia',
        body: 'Contenido',
        category: 'historia',
        images: [],
        content: [],
        coverImage: null,
        status: 'approved',
        rejectionReason: null,
        submittedAt: new Date(),
        publishedAt: null,
        createdBy: 'bob',
        updatedAt: new Date(),
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      })
    );
  });

  // 5. author updates own post (title/body only) → ALLOW
  it('5: author can update own post title and body', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      updateDoc(doc(alice, 'news/p1'), { title: 'Updated title', body: 'Updated body', updatedAt: new Date() })
    );
  });

  // 6. author tries to update own post's status to 'approved' → DENY
  it('6: author cannot update post status to approved', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, 'news/p1'), { status: 'approved' })
    );
  });

  // 7. non-author updates someone else's post → DENY
  it("7: non-author cannot update another member's post", async () => {
    await seedMember('m1', 'alice');
    await seedMember('m1', 'bob');
    await seedPost('p1', 'm1', 'alice');
    const bob = asUser(getEnv(), 'bob');
    await assertFails(
      updateDoc(doc(bob, 'news/p1'), { title: 'Hacked' })
    );
  });

  // 8. client cannot delete a news post directly (author + admin deletes go
  //    through the deleteNewsPost callable, which cascades comments/reactions).
  it('8: client cannot delete a news post directly', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(deleteDoc(doc(alice, 'news/p1')));
  });

  // Regression: getNewsPostsByOrganizer ("mis artículos") was denied because the
  // read rule only allowed creator / village-member / approved — not organizers.
  // A named organizer who is NOT the creator and NOT a village member must be able
  // to read & list their pending co-organized posts.
  it('9: a named organizer (not creator, not member) can read a pending post', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice', { organizerUserIds: ['alice', 'carol'] });
    const carol = asUser(getEnv(), 'carol');
    await assertSucceeds(getDoc(doc(carol, 'news/p1')));
  });

  it('9b: organizer can list pending posts via organizerUserIds array-contains', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice', { organizerUserIds: ['alice', 'carol'] });
    const carol = asUser(getEnv(), 'carol');
    await assertSucceeds(
      getDocs(query(collection(carol, 'news'), where('organizerUserIds', 'array-contains', 'carol'))),
    );
  });

  // T6-A: create denied when uid not in organizerUserIds
  it('T6-A: create denied when uid not in organizerUserIds', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'news/p1'), {
        municipalityId: 'm1',
        organizerUserIds: ['someoneelse'],
        organizerOrgIds: [],
        title: 'Test',
        body: 'Body',
        category: 'otro',
        images: [],
        content: [],
        coverImage: null,
        status: 'pending',
        rejectionReason: null,
        submittedAt: new Date(),
        publishedAt: null,
        createdBy: 'alice',
        updatedAt: new Date(),
        reactionCounts: { like: 0, heart: 0 },
        commentCount: 0,
      })
    );
  });

  // T6-B: update allowed for user in organizerUserIds
  it('T6-B: user in organizerUserIds can update own post', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      updateDoc(doc(alice, 'news/p1'), { title: 'Updated', updatedAt: new Date() })
    );
  });

  // T6-C: update denied for a random village member not in organizerUserIds
  it('T6-C: village member not in organizerUserIds cannot update', async () => {
    await seedMember('m1', 'alice');
    await seedMember('m1', 'bob');
    await seedPost('p1', 'm1', 'alice');
    const bob = asUser(getEnv(), 'bob');
    await assertFails(
      updateDoc(doc(bob, 'news/p1'), { title: 'Hacked', updatedAt: new Date() })
    );
  });

  // T6-D: update denied when it tries to change createdBy
  it('T6-D: update denied when changing createdBy', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, 'news/p1'), { createdBy: 'hacker' })
    );
  });

  // T6-E: update denied when it tries to change municipalityId
  it('T6-E: update denied when changing municipalityId', async () => {
    await seedMember('m1', 'alice');
    await seedMember('m2', 'alice');
    await seedPost('p1', 'm1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, 'news/p1'), { municipalityId: 'm2' })
    );
  });

  // T6-F: org member (not in organizerUserIds) is denied update
  it('T6-F: org member not in organizerUserIds cannot update', async () => {
    await seedMember('m1', 'alice');
    await seedMember('m1', 'carol');
    // carol is not in organizerUserIds — seeded post only has alice
    await seedPost('p1', 'm1', 'alice', { organizerOrgIds: ['org1'] });
    const carol = asUser(getEnv(), 'carol');
    await assertFails(
      updateDoc(doc(carol, 'news/p1'), { title: 'Org hacked', updatedAt: new Date() })
    );
  });
});

// ── news read rules (cross-village Explora feed) ──────────────────────────────
// Regression: the Explora "all villages" feed (getAllVillagesFeed) lists every
// approved news post regardless of municipality. The read rule must therefore
// admit approved posts to non-members; pending posts stay members-only.
describe('firestore.rules — /news read', () => {
  it('R1: approved post is readable by a non-member (cross-village feed)', async () => {
    await seedPost('p1', 'm1', 'alice', { status: 'approved', publishedAt: new Date() });
    // bob is not a member of m1 — mirrors a user browsing another village.
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(getDoc(doc(bob, 'news/p1')));
  });

  it('R2: cross-village approved list query succeeds for a non-member', async () => {
    await seedPost('p1', 'm1', 'alice', { status: 'approved', publishedAt: new Date() });
    await seedPost('p2', 'm2', 'carol', { status: 'approved', publishedAt: new Date() });
    const bob = asUser(getEnv(), 'bob');
    await assertSucceeds(
      getDocs(query(collection(bob, 'news'), where('status', '==', 'approved'))),
    );
  });

  it('R3: pending post stays hidden from non-members', async () => {
    await seedPost('p1', 'm1', 'alice', { status: 'pending' });
    const bob = asUser(getEnv(), 'bob');
    await assertFails(getDoc(doc(bob, 'news/p1')));
  });

  it('R4: member can still read a pending post in their own village', async () => {
    await seedMember('m1', 'alice');
    await seedPost('p1', 'm1', 'alice', { status: 'pending' });
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(getDoc(doc(alice, 'news/p1')));
  });

  it('R5: author can read own pending post even without village membership', async () => {
    // Powers the profile-screen news count (getNewsCountByCreator), which lists
    // the author's own posts regardless of status/membership.
    await seedPost('p1', 'm1', 'alice', { status: 'pending' });
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(getDoc(doc(alice, 'news/p1')));
  });
});

// ── newsComments rules ────────────────────────────────────────────────────────

describe('firestore.rules — /newsComments/{commentId}', () => {
  // 9. member adds a comment with hidden=false → ALLOW
  it('9: member can create a visible comment', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'newsComments/c1'), {
        postId: 'p1',
        municipalityId: 'm1',
        authorUserId: 'alice',
        body: 'Great post!',
        createdAt: new Date(),
        hidden: false,
      })
    );
  });

  // 10. member tries to set hidden=true on a new comment → DENY
  it('10: member cannot create a hidden comment', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'newsComments/c1'), {
        postId: 'p1',
        municipalityId: 'm1',
        authorUserId: 'alice',
        body: 'Sneaky',
        createdAt: new Date(),
        hidden: true,
      })
    );
  });

  // 11. member tries to update an existing comment → DENY
  it('11: member cannot update a comment', async () => {
    await seedMember('m1', 'alice');
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'newsComments/c1'), {
        postId: 'p1',
        municipalityId: 'm1',
        authorUserId: 'alice',
        body: 'Original',
        createdAt: new Date(),
        hidden: false,
      });
    });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'newsComments/c1'), { body: 'Edited' }));
  });

  // 12. comment author deletes their own comment → ALLOW
  it('12: comment author can delete their own comment', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'newsComments/c1'), {
        postId: 'p1',
        municipalityId: 'm1',
        authorUserId: 'alice',
        body: 'Delete me',
        createdAt: new Date(),
        hidden: false,
      });
    });
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, 'newsComments/c1')));
  });
});

// ── newsReactions rules ───────────────────────────────────────────────────────

describe('firestore.rules — /newsReactions/{reactionId}', () => {
  // 13. member creates a reaction at id `${postId}_${myUid}` → ALLOW
  it('13: member can create own reaction with correct doc id', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'newsReactions/p1_alice'), {
        postId: 'p1',
        municipalityId: 'm1',
        userId: 'alice',
        kind: 'like',
        createdAt: new Date(),
      })
    );
  });

  // 14. member tries to create a reaction at id `${postId}_${otherUid}` → DENY
  it('14: member cannot create a reaction spoofing another user', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, 'newsReactions/p1_bob'), {
        postId: 'p1',
        municipalityId: 'm1',
        userId: 'bob',
        kind: 'like',
        createdAt: new Date(),
      })
    );
  });
});

// ── newsReports rules ─────────────────────────────────────────────────────────

describe('firestore.rules — /newsReports/{reportId}', () => {
  // 15. member submits a report with status='open' and reporterUserId=myUid → ALLOW
  it('15: member can create a report about themselves with status open', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(
      setDoc(doc(alice, 'newsReports/r1'), {
        targetType: 'comment',
        targetId: 'c1',
        postId: 'p1',
        municipalityId: 'm1',
        reporterUserId: 'alice',
        reason: 'spam',
        createdAt: new Date(),
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
      })
    );
  });

  // 16. client tries to update a report directly → DENY
  it('16: client cannot update a report directly', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'newsReports/r1'), {
        targetType: 'comment',
        targetId: 'c1',
        postId: 'p1',
        municipalityId: 'm1',
        reporterUserId: 'alice',
        reason: 'spam',
        createdAt: new Date(),
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
      });
    });
    await seedMember('m1', 'alice', { role: 'admin' });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, 'newsReports/r1'), { status: 'dismissed' }));
  });
});

// ── members trustedNewsAuthor tightening ──────────────────────────────────────

describe('firestore.rules — members trustedNewsAuthor lock', () => {
  // 17. client tries to write trustedNewsAuthor=true on their own member doc → DENY
  it('17: member cannot set trustedNewsAuthor on their own member doc', async () => {
    await seedMember('m1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, 'municipalities/m1/members/alice'), {
        trustedNewsAuthor: true,
      })
    );
  });
});
