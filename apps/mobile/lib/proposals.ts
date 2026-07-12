import type { ReviewStatus } from '@cultuvilla/shared/models/core/ReviewableDataModel';

/**
 * Which propose-pending items show in a list. Rule (organizations — the only
 * remaining approve/reject flow; barrios/places/festivalPosters/news moved to
 * the optimistic-visibility hide/unhide model and no longer need this filter,
 * since their list services already return active-only rows): approved items
 * are visible to everyone; pending items are visible only to an organizer (who
 * reviews them) and to their own proposer (who tracks them). Rejected items
 * are hidden from the lists. This is UI filtering only — the data isn't
 * sensitive (rules allow public reads) — its purpose is to avoid flooding the
 * community with unreviewed content.
 */
export function isProposalVisible(
  status: ReviewStatus,
  ownerId: string | null | undefined,
  caps: { canManage: boolean; uid: string | null },
): boolean {
  if (status === 'approved') return true;
  if (caps.canManage) return true;
  if (status === 'pending' && caps.uid != null && ownerId === caps.uid) return true;
  return false;
}
