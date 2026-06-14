import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { Avatar } from '../../components/primitives/Avatar';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import {
  isOrgMember,
  addOrgMember,
  getOrgMembers,
} from '@cultuvilla/shared/services/orgMemberService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function OrgDetailStub() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const o = await getOrganization(orgId as string);
    setOrg(o);
    const members = await getOrgMembers(orgId as string);
    setMembersCount(members.length);
    if (user) setIsMember(await isOrgMember(orgId as string, user.uid));
    setLoading(false);
  }, [orgId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onJoin = useCallback(async () => {
    if (!user || !orgId) {
      router.push('/(auth)/login' as never);
      return;
    }
    setJoining(true);
    try {
      await addOrgMember(orgId as string, user.uid);
      await refresh();
    } finally {
      setJoining(false);
    }
  }, [user, orgId, refresh]);

  return (
    <Screen>
      <AppHeader centerLabel={org?.name ?? t('organization.title')} />
      <VStack className="p-4 gap-3">
        {loading ? <ActivityIndicator /> : null}
        {!loading && !org ? <Text>{t('common.notFound')}</Text> : null}
        {org ? (
          <>
            {org.imageURL ? (
              <VStack className="items-center pb-1">
                <Avatar uri={org.imageURL} size={96} />
              </VStack>
            ) : null}
            {org.description ? <Text>{org.description}</Text> : null}
            <Text tone="muted">
              {t('organization.membersCount', { count: membersCount ?? 0 })}
            </Text>
            {!isMember ? (
              <Pressable
                onPress={onJoin}
                disabled={joining}
                className="bg-primary rounded-lg p-3 items-center"
                accessibilityLabel={t('organization.join')}
              >
                <Text tone="onAccent">
                  {user ? t('organization.join') : t('organization.signInToJoin')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </VStack>
    </Screen>
  );
}
