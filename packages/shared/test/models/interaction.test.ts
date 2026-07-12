import { describe, it, expect } from 'vitest';
import { buildCommentData } from '../../src/models/interaction/CommentDataModel';

describe('CommentData', () => {
  it('builds a comment carrying its entity coordinates', () => {
    const now = new Date();
    const c = buildCommentData({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
    expect(c).toEqual({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1', authorUserId: 'u1', body: 'Hola', createdAt: now });
  });
});
