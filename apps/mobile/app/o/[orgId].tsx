import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { Avatar } from '../../components/primitives/Avatar';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import {
  isOrgMember,
  addOrgMember,
  getOrgMembers,
} from '@cultuvilla/shared/services/orgMemberService';
import {
  getOrgViewLink,
  getOrgInviteLink,
} from '@cultuvilla/shared/services/deepLinkService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function OrgDetailStub() {
  const { orgId, intent } = useLocalSearchParams<{ orgId: string; intent?: string }>();
  const arrivedViaInvite = intent === 'join';
  const { t } = useT();
  const { user } = useAuth();
  const share = useShareDeepLink();
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

  const headerSlot = (
    <HStack gap={2}>
      <Pressable
        onPress={() => org && void share(getOrgViewLink(org.id), org.name)}
        accessibilityLabel={t('deeplink.shareViewLabel')}
        className="p-1"
      >
        <Ionicons name="share-outline" size={22} color="#0f172a" />
      </Pressable>
      <Pressable
        onPress={() => org && void share(getOrgInviteLink(org.id), org.name)}
        accessibilityLabel={t('deeplink.shareInviteLabel')}
        className="p-1"
      >
        <Ionicons name="person-add-outline" size={22} color="#0f172a" />
      </Pressable>
    </HStack>
  );

  return (
    <Screen>
      <AppHeader centerLabel={org?.name ?? t('organization.title')} extraRightSlot={headerSlot} />
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
              <VStack gap={1}>
                {arrivedViaInvite ? (
                  <Text tone="muted" variant="bodySm" className="text-center">
                    {t('organization.invitedBanner')}
                  </Text>
                ) : null}
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
              </VStack>
            ) : null}
          </>
        ) : null}
      </VStack>
    </Screen>
  );
}
