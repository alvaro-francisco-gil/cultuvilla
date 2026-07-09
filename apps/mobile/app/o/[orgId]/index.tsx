import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { VStack } from '../../../components/primitives/VStack';
import { DetailHeroImage } from '../../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../../components/feature/FloatingShareButton';
import { FloatingEditButton } from '../../../components/feature/FloatingEditButton';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useRegisterGate } from '../../../lib/auth/RegisterGateContext';
import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';
import { useShareDeepLink } from '../../../lib/deeplink/useShareDeepLink';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import {
  isOrgMember,
  addOrgMember,
  getOrgMembers,
} from '@cultuvilla/shared/services/orgMemberService';
import { getOrgViewLink } from '@cultuvilla/shared/services/deepLinkService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function OrgDetailScreen() {
  const { orgId, intent } = useLocalSearchParams<{ orgId: string; intent?: string }>();
  const arrivedViaInvite = intent === 'join';
  const { t } = useT();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const share = useShareDeepLink();
  const insets = useSafeAreaInsets();
  const [org, setOrg] = useState<Org | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { canManage } = useOrgCapabilities(orgId as string, org?.municipalityId);

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
      <ScrollView contentContainerClassName="pb-28">
        <DetailHeroImage imageUri={org.imageURL} fallbackIcon="people-outline" />
        <FloatingBackButton />
        <FloatingShareButton onPress={() => void share(getOrgViewLink(org.id), org.name)} />
        {canManage ? (
          <FloatingEditButton onPress={() => router.push(`/o/${org.id}/edit` as never)} />
        ) : null}
        <VStack gap={3} className="p-4">
          <Text variant="h1">{org.name}</Text>
          {org.description ? <Text>{org.description}</Text> : null}
          <Text tone="muted">
            {t('organization.membersCount', { count: membersCount ?? 0 })}
          </Text>
          {arrivedViaInvite && !isMember ? (
            <Text tone="muted" variant="bodySm">
              {t('organization.invitedBanner')}
            </Text>
          ) : null}
        </VStack>
      </ScrollView>

      {/* Ordago-style floating join pill, mirroring the event detail FAB. Styles
          live on `style` (never `className`) so the pill renders on RN-Web. */}
      {!isMember ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 24,
            alignItems: 'center',
            zIndex: 20,
          }}
        >
          <Pressable
            onPress={onJoin}
            disabled={joining}
            testID="join-org-fab"
            accessibilityRole="button"
            accessibilityState={{ disabled: joining }}
            accessibilityLabel={user ? t('organization.join') : t('organization.signInToJoin')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              paddingHorizontal: 22,
              borderRadius: 999,
              backgroundColor: '#bb5d3a',
              opacity: joining ? 0.7 : 1,
              elevation: 6,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            {joining ? (
              <ActivityIndicator color="#f9f0e8" style={{ marginRight: 8 }} />
            ) : (
              <RNText style={{ color: '#f9f0e8', fontSize: 18, lineHeight: 22, marginRight: 8 }}>+</RNText>
            )}
            <RNText style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>
              {user ? t('organization.join') : t('organization.signInToJoin')}
            </RNText>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
