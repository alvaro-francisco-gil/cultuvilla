import { z } from 'zod';

/**
 * Digitization credit: who brought a piece of the village's memory into the
 * app — the people who photographed a festival poster, recorded a place, or
 * wrote down a word — and the groups that took part.
 *
 * Credit, never authority. Being named here grants no edit rights; each
 * collection's own creator field (`proposedBy` / `createdBy`) and the village
 * admins remain the only editors. That is what lets an author credit
 * generously without handing anyone the keys.
 *
 * Spread into a schema: `z.object({ ...domainFields, ...contributorFields })`.
 */
export const contributorFields = {
  contributorUserIds: z.array(z.string()),
  contributorOrgIds: z.array(z.string()),
};

/**
 * The credited users with the author first and every id once.
 *
 * The author is always credited — the picker renders them as a locked row, and
 * for vocabulary `firestore.rules` rejects a credit list that leaves them out.
 * Normalizing here, in the builder, means every write path produces the same
 * shape instead of each form remembering to prepend the author itself.
 */
export function creditedUserIds(authorId: string, selected: readonly string[] = []): string[] {
  return [authorId, ...selected.filter((id) => id !== authorId)].filter(
    (id, index, all) => all.indexOf(id) === index,
  );
}
