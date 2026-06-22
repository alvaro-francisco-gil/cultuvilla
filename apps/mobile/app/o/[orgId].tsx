import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { Button } from '../../components/primitives/Button';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
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

export default function OrgDetailScreen() {
  const { orgId, intent } = useLocalSearchParams<{ orgId: string; intent?: string }>();
  const arrivedViaInvite = intent === 'join';
  const { t } = useT();
  const { user } = useAuth();
  const gate = useRegisterGate();
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
    if (!user) {
      gate.requireAuth(`/o/${orgId}`, t('guest.org'));
      return;
    }
    if (!orgId) return;
    setJoining(true);
    try {
      await addOrgMember(orgId as string, user.uid);
      await refresh();
    } finally {
      setJoining(false);
    }
  }, [user, orgId, refresh, gate, t]);

  if (loading || !org) {
    return (
      <Screen padded={false} topInset={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          {loading ? <ActivityIndicator /> : <Text>{t('common.notFound')}</Text>}
        </View>
        <FloatingBackButton />
      </Screen>
    );
  }

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      <ScrollView contentContainerClassName="pb-10">
        <DetailHeroImage imageUri={org.imageURL} fallbackIcon="people-outline" />
        <FloatingBackButton />
        <FloatingShareButton onPress={() => void share(getOrgViewLink(org.id), org.name)} />
        <VStack gap={3} className="p-4">
          <Text variant="h1">{org.name}</Text>
          {org.description ? <Text>{org.description}</Text> : null}
          <Text tone="muted">
            {t('organization.membersCount', { count: membersCount ?? 0 })}
          </Text>
          <Button
            variant="secondary"
            fullWidth
            onPress={() => void share(getOrgInviteLink(org.id), org.name)}
          >
            {t('deeplink.shareInviteLabel')}
          </Button>
          {!isMember ? (
            <VStack gap={1}>
              {arrivedViaInvite ? (
                <Text tone="muted" variant="bodySm" className="text-center">
                  {t('organization.invitedBanner')}
                </Text>
              ) : null}
              <Button variant="primary" fullWidth loading={joining} onPress={onJoin}>
                {user ? t('organization.join') : t('organization.signInToJoin')}
              </Button>
            </VStack>
          ) : null}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
