import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getVillageMembers,
  setVillageMemberRole,
} from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { VStack, HStack, Text, Avatar, Pressable } from '../primitives';
import { showConfirm, showAlert } from '../../lib/dialogs';
import { useT } from '../../lib/i18n';

interface MemberRow {
  userId: string;
  role: 'admin' | 'user';
  joinedAt: Date;
  censoComplete: boolean;
  displayName: string;
  photoURL: string | null;
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Roster of a pueblo's members, reached from the village personas stat. It joins
 * each member doc with the user profile for name/photo, lists admins first, then
 * by join date, without exposing the join date in the UI.
 *
 * When `canManage`, admins/app-admins can promote a member to admin or demote
 * an admin back to member by tapping the row — routed through the audited
 * `setVillageMemberRole` callable. Two rows are never actionable: your own
 * (avoids self-lockout) and the founding organizer's demote path (the callable
 * rejects it; hiding it here just avoids a dead-end tap).
 */
export function MembersList({
  villageId,
  canManage = false,
  currentUserId = null,
}: {
  villageId: string;
  canManage?: boolean;
  currentUserId?: string | null;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [censoConfigured, setCensoConfigured] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [members, municipality] = await Promise.all([
        getVillageMembers(villageId),
        getMunicipality(villageId),
      ]);
      const profileFields = municipality?.community?.profileForm?.fields ?? [];
      const joined = await Promise.all(
        members.map(async (m) => {
          // Name comes from the (denormalized) user doc; the avatar lives on the
          // person doc — the user doc's photoURL is frequently null.
          const [profile, person] = await Promise.all([
            getUserProfile(m.userId),
            getPersonByUserId(m.userId),
          ]);
          return {
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            censoComplete: m.profileCompletedAt != null,
            displayName: profile?.displayName ?? '',
            photoURL: person?.photoURL ?? null,
          };
        }),
      );
      joined.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
      if (!cancelled) {
        setOrganizerId(municipality?.community?.organizerId ?? null);
        setCensoConfigured(profileFields.length > 0);
        setRows(joined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [villageId, refreshKey]);

  const changeRole = (m: MemberRow) => {
    const nextRole = m.role === 'admin' ? 'user' : 'admin';
    const promoting = nextRole === 'admin';
    showConfirm(
      t(promoting ? 'village.membersList.confirmPromoteTitle' : 'village.membersList.confirmDemoteTitle'),
      t(promoting ? 'village.membersList.confirmPromoteBody' : 'village.membersList.confirmDemoteBody', {
        name: m.displayName,
      }),
      () => {
        setPendingUserId(m.userId);
        setVillageMemberRole(villageId, m.userId, nextRole)
          .then(() => setRefreshKey((k) => k + 1))
          .catch((e: unknown) => {
            showAlert(e instanceof Error && e.message ? e.message : t('village.membersList.roleChangeError'));
          })
          .finally(() => setPendingUserId(null));
      },
      { confirmText: t(promoting ? 'village.membersList.promote' : 'village.membersList.demote') },
    );
  };

  // Self is never actionable (self-lockout); the founding organizer can't be
  // demoted, so their (admin) row isn't actionable either.
  const isActionable = (m: MemberRow) =>
    canManage &&
    m.userId !== currentUserId &&
    !(m.role === 'admin' && m.userId === organizerId);

  if (rows === null) {
    return (
      <VStack className="flex-1 items-center justify-center py-10">
        <ActivityIndicator />
      </VStack>
    );
  }

  if (rows.length === 0) {
    return (
      <VStack className="items-center py-10 px-4">
        <Text tone="muted">{t('village.membersList.empty')}</Text>
      </VStack>
    );
  }

  const renderRowContent = (m: MemberRow, actionable: boolean) => (
    <>
      <HStack gap={2} className="flex-1 items-center pr-2">
        <Avatar uri={m.photoURL} size={32} initials={initialsOf(m.displayName)} />
        <VStack className="flex-1">
          <Text testID="member-name" numberOfLines={1}>
            {m.displayName}
          </Text>
        </VStack>
      </HStack>
      {censoConfigured ? (
        <View
          className="w-14 items-center"
          accessibilityLabel={
            m.censoComplete
              ? t('village.membersList.censoComplete')
              : t('village.membersList.censoPending')
          }
        >
          <Ionicons
            name={m.censoComplete ? 'checkmark' : 'close'}
            size={iconSizes.sm}
            color={m.censoComplete ? '#16a34a' : '#9ca3af'}
          />
        </View>
      ) : null}
      <View testID="member-action-slot" className="w-6 items-end">
        {pendingUserId === m.userId ? (
          <ActivityIndicator size="small" />
        ) : actionable ? (
          <Ionicons name="chevron-forward" size={iconSizes.sm} color="#9ca3af" />
        ) : null}
      </View>
    </>
  );

  return (
    <ScrollView contentContainerClassName="pb-10">
      <VStack className="pt-3 px-4">
        {/* Header row */}
        <HStack gap={0} className="items-center py-2 border-b border-subtle">
          <Text variant="caption" tone="muted" numberOfLines={1} className="flex-1 font-bold">
            {t('village.membersList.colName')}
          </Text>
          {censoConfigured ? (
            <Text variant="caption" tone="muted" numberOfLines={1} className="w-14 text-center font-bold">
              {t('village.membersList.colCenso')}
            </Text>
          ) : null}
          <View className="w-6" />
        </HStack>

        {/* Member rows */}
        {rows.map((m) => {
          const actionable = isActionable(m);
          return actionable ? (
            <Pressable
              key={m.userId}
              testID={`member-row-${m.userId}`}
              disabled={pendingUserId != null}
              onPress={() => changeRole(m)}
              className="flex-row items-center py-3 border-b border-subtle"
            >
              {renderRowContent(m, actionable)}
            </Pressable>
          ) : (
            <HStack key={m.userId} gap={0} className="items-center py-3 border-b border-subtle">
              {renderRowContent(m, actionable)}
            </HStack>
          );
        })}
      </VStack>
    </ScrollView>
  );
}
