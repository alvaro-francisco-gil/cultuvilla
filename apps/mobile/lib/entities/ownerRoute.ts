import type { OwnerType } from '../useOwnerSummary';

/**
 * Where a credited owner reference opens. Every surface that prints a name from
 * an id — event organizers, contributor chips, news bylines — routes through
 * here so the same chip doesn't lead somewhere different depending on the
 * screen that rendered it.
 *
 * `person` has no dedicated owner surface of its own here: a persona is opened
 * through `/person/{id}` by the roster screens that know whether the viewer may
 * read it, so callers that render personas pass their own handler.
 */
export function ownerRoute(ownerType: OwnerType, ownerId: string): string {
  switch (ownerType) {
    case 'organization':
      return `/o/${ownerId}`;
    case 'person':
      return `/person/${ownerId}`;
    case 'user':
      return `/user/${ownerId}`;
  }
}
