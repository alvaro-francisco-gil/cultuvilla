import { useCallback, useEffect, useState } from 'react';
import { getUserOrgIds } from '@cultuvilla/shared/services/orgMemberService';
import { withFirestoreErrorLog } from '../firestoreErrorLog';
import { useAuth } from '../auth/useAuth';

export interface MyOrgIds {
  /** Organizations the signed-in user belongs to. Empty while loading, and for guests. */
  orgIds: string[];
  /** False once the lookup has settled — successfully or not. */
  loading: boolean;
  refresh: () => void;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * The viewer's organizations, which is what every private-event query needs
 * before it can run: asking for events of an org you don't belong to fails the
 * whole list with permission-denied rather than returning fewer rows.
 *
 * A failure degrades to "no orgs" — a feed missing its private half is a worse
 * feed, an exploding feed is no feed at all.
 */
// A stable identity for "no orgs", so a guest and a failed lookup both hand
// back the very same array. Callers put `orgIds` in effect dependency lists —
// see useVillageHome — and a fresh `[]` per render would refetch the world.
const NO_ORGS: string[] = [];

export function useMyOrgIds(): MyOrgIds {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [orgIds, setOrgIds] = useState<string[]>(NO_ORGS);
  const [loading, setLoading] = useState(uid !== null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (uid === null) {
      setOrgIds(NO_ORGS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void withFirestoreErrorLog('orgs:getUserOrgIds', () => getUserOrgIds(uid))
      .then((ids) => {
        // Same ids => same array, so a refresh that changes nothing does not
        // invalidate every effect keyed off this value.
        if (!cancelled) setOrgIds((prev) => (sameIds(prev, ids) ? prev : ids));
      })
      .catch(() => {
        if (!cancelled) setOrgIds(NO_ORGS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, nonce]);

  return { orgIds, loading, refresh };
}
