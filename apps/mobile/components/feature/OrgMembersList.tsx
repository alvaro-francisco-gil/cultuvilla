import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Avatar } from '../primitives/Avatar';
import { Pressable } from '../primitives/Pressable';
import { DetailSectionHeading } from './DetailSectionHeading';
import {
  getOrgMembers,
  setOrgMemberRole,
  removeOrgMember,
} from '@cultuvilla/shared/services/orgMemberService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import type { OrgMemberData } from '@cultuvilla/shared/models/organization/OrgMemberDataModel';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { showConfirm, showAlert } from '../../lib/dialogs';
import { useT } from '../../lib/i18n';

type Row = OrgMemberData & { id: string; name: string; photoURL: string | null };

/**
 * Org member roster: circular profile photo (from the member's person,
 * initials fallback) + display name + an admin badge. Self-fetches, mirroring
 * EventAttendees. The caller decides whether to render this at all
 * (canViewOrgRoster) — this component does its own access control for the
 * management actions below.
 *
 * When `canManage`, an org admin can tap a member's row to promote/demote them
 * (routed through the audited `changeOrgMemberRole` callable via
 * `setOrgMemberRole`), or tap the trailing trash icon to remove them from the
 * org. Your own row is never actionable (avoids self-lockout).
 */
export function OrgMembersList({
  orgId,
  canManage = false,
  currentUserId = null,
}: {
  orgId: string;
  canManage?: boolean;
  currentUserId?: string | null;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [load, refreshKey]);

  const isActionable = (m: Row) => canManage && m.userId !== currentUserId;

  const changeRole = (m: Row) => {
    const nextRole = m.role === 'admin' ? 'member' : 'admin';
    const promoting = nextRole === 'admin';
    showConfirm(
      t(promoting ? 'organization.membersList.confirmPromoteTitle' : 'organization.membersList.confirmDemoteTitle'),
      t(promoting ? 'organization.membersList.confirmPromoteBody' : 'organization.membersList.confirmDemoteBody', {
        name: m.name,
      }),
      () => {
        setPendingUserId(m.id);
        setOrgMemberRole(orgId, m.id, nextRole)
          .then(() => setRefreshKey((k) => k + 1))
          .catch((e: unknown) => {
            showAlert(e instanceof Error && e.message ? e.message : t('organization.membersList.roleChangeError'));
          })
          .finally(() => setPendingUserId(null));
      },
      { confirmText: t(promoting ? 'organization.membersList.promote' : 'organization.membersList.demote') },
    );
  };

  const removeMember = (m: Row) => {
    showConfirm(
      t('organization.membersList.confirmRemoveTitle'),
      t('organization.membersList.confirmRemoveBody', { name: m.name }),
      () => {
        setPendingUserId(m.id);
        removeOrgMember(orgId, m.id)
          .then(() => setRefreshKey((k) => k + 1))
          .catch((e: unknown) => {
            showAlert(e instanceof Error && e.message ? e.message : t('organization.membersList.removeError'));
          })
          .finally(() => setPendingUserId(null));
      },
      { confirmText: t('organization.membersList.remove') },
    );
  };

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{t('organization.members')}</DetailSectionHeading>
      {rows && rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('organization.membersEmpty')}
        </Text>
      ) : (
        (rows ?? []).map((r) => {
          const actionable = isActionable(r);
          const pending = pendingUserId === r.id;
          return (
            <HStack key={r.id} gap={3} align="center" className="py-2">
              <Pressable
                testID={`org-member-row-${r.id}`}
                disabled={!actionable || pendingUserId != null}
                onPress={() => changeRole(r)}
                className="flex-1 flex-row items-center gap-3"
              >
                <Avatar uri={r.photoURL} size={36} initials={r.name.slice(0, 1).toUpperCase()} />
                <Text numberOfLines={1} className="flex-1">
                  {r.name}
                </Text>
                {r.role === 'admin' ? (
                  <Text tone="muted" variant="bodySm">
                    {t('organization.adminBadge')}
                  </Text>
                ) : null}
              </Pressable>
              {actionable ? (
                pending ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Pressable
                    testID={`org-member-remove-${r.id}`}
                    disabled={pendingUserId != null}
                    onPress={() => removeMember(r)}
                    accessibilityLabel={t('organization.membersList.remove')}
                  >
                    <Ionicons name="trash-outline" size={iconSizes.sm} color="#9ca3af" />
                  </Pressable>
                )
              ) : null}
            </HStack>
          );
        })
      )}
    </VStack>
  );
}
