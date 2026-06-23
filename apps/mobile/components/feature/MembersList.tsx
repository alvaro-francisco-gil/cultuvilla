import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { formatDate } from '@cultuvilla/shared/utils';
import { VStack, HStack, Text, Avatar } from '../primitives';
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
 * Read-only roster of a pueblo's members, mounted as the "Miembros" tab of the
 * community ("Editar pueblo") screen. Joins each member doc with the user
 * profile for name/photo, lists admins first, then by join date. No mutations
 * yet — admin removal is a later addition (removeVillageMember already exists).
 */
export function MembersList({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<MemberRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const members = await getVillageMembers(villageId);
      const joined = await Promise.all(
        members.map(async (m) => {
          const profile = await getUserProfile(m.userId);
          return {
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            censoComplete: m.profileCompletedAt != null,
            displayName: profile?.displayName ?? '',
            photoURL: profile?.photoURL ?? null,
          };
        }),
      );
      joined.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
      if (!cancelled) setRows(joined);
    })();
    return () => {
      cancelled = true;
    };
  }, [villageId]);

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

  return (
    <ScrollView contentContainerClassName="pb-10">
      <VStack gap={2} className="pt-3 px-4">
        {rows.map((m) => (
          <HStack key={m.userId} gap={3} className="items-center">
            <Avatar uri={m.photoURL} size={44} initials={initialsOf(m.displayName)} />
            <VStack gap={1} className="flex-1">
              <Text testID="member-name" className="font-bold">
                {m.displayName}
              </Text>
              <HStack gap={2} className="flex-wrap items-center">
                <Text tone="muted" variant="caption">
                  {m.role === 'admin'
                    ? t('village.membersList.roleAdmin')
                    : t('village.membersList.roleUser')}
                </Text>
                <Text tone="muted" variant="caption">
                  ·
                </Text>
                <Text tone="muted" variant="caption">
                  {m.censoComplete
                    ? t('village.membersList.censoComplete')
                    : t('village.membersList.censoPending')}
                </Text>
                <Text tone="muted" variant="caption">
                  ·
                </Text>
                <Text tone="muted" variant="caption">
                  {formatDate(m.joinedAt, 'short')}
                </Text>
              </HStack>
            </VStack>
          </HStack>
        ))}
      </VStack>
    </ScrollView>
  );
}
