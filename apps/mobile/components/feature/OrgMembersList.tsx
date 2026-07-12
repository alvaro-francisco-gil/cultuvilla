import { useCallback, useEffect, useState } from 'react';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Avatar } from '../primitives/Avatar';
import { DetailSectionHeading } from './DetailSectionHeading';
import { getOrgMembers } from '@cultuvilla/shared/services/orgMemberService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import type { OrgMemberData } from '@cultuvilla/shared/models/organization/OrgMemberDataModel';
import { useT } from '../../lib/i18n';

type Row = OrgMemberData & { id: string; name: string; photoURL: string | null };

/**
 * Read-only org member roster: circular profile photo (from the member's
 * person, initials fallback) + display name + an admin badge. Self-fetches,
 * mirroring EventAttendees. The caller decides whether to render this at all
 * (canViewOrgRoster) — this component does no access control.
 */
export function OrgMembersList({ orgId }: { orgId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const members = await getOrgMembers(orgId);
    const resolved = await Promise.all(
      members.map(async (m): Promise<Row> => {
        // One hop per member: the person carries both photo and name parts.
        const person = await getPersonByUserId(m.userId).catch(() => null);
        if (person) {
          const name =
            person.nickname?.trim() ||
            [person.givenName, person.firstSurname].filter(Boolean).join(' ').trim();
          return { ...m, name: name || m.userId, photoURL: person.photoURL ?? null };
        }
        const user = await getUserProfile(m.userId).catch(() => null);
        return { ...m, name: user?.displayName || m.userId, photoURL: null };
      }),
    );
    // Admins first, then alphabetical.
    resolved.sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1,
    );
    setRows(resolved);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{t('organization.members')}</DetailSectionHeading>
      {rows && rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('organization.membersEmpty')}
        </Text>
      ) : (
        (rows ?? []).map((r) => (
          <HStack key={r.id} gap={3} align="center" className="py-2">
            <Avatar uri={r.photoURL} size={36} initials={r.name.slice(0, 1).toUpperCase()} />
            <Text numberOfLines={1} className="flex-1">
              {r.name}
            </Text>
            {r.role === 'admin' ? (
              <Text tone="muted" variant="bodySm">
                {t('organization.adminBadge')}
              </Text>
            ) : null}
          </HStack>
        ))
      )}
    </VStack>
  );
}
