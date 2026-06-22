import { isProposalVisible } from '../proposals';

const villager = { canManage: false, uid: 'alice' };
const organizer = { canManage: true, uid: 'boss' };

describe('isProposalVisible', () => {
  it('approved items are visible to everyone', () => {
    expect(isProposalVisible('approved', 'someone', villager)).toBe(true);
    expect(isProposalVisible('approved', null, { canManage: false, uid: null })).toBe(true);
  });

  it('a villager sees their OWN pending item', () => {
    expect(isProposalVisible('pending', 'alice', villager)).toBe(true);
  });

  it("a villager does NOT see someone else's pending item", () => {
    expect(isProposalVisible('pending', 'bob', villager)).toBe(false);
  });

  it('an organizer sees all pending items', () => {
    expect(isProposalVisible('pending', 'anyone', organizer)).toBe(true);
  });

  it('rejected items are hidden from everyone in the list', () => {
    expect(isProposalVisible('rejected', 'alice', villager)).toBe(false);
    // organizer still sees them (to know it was rejected) — canManage short-circuits
    expect(isProposalVisible('rejected', 'x', organizer)).toBe(true);
  });

  it('a signed-out user (uid null) sees only approved', () => {
    expect(isProposalVisible('pending', 'alice', { canManage: false, uid: null })).toBe(false);
  });
});
