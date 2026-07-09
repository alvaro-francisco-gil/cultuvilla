import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../components/primitives/Text';
import { EntityDetailScaffold } from '../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../lib/entities/registry';
import { useT } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth/useAuth';
import { useRegisterGate } from '../../../lib/auth/RegisterGateContext';
import { useOrgCapabilities } from '../../../lib/auth/useOrgCapabilities';
import { useShareDeepLink } from '../../../lib/deeplink/useShareDeepLink';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { isOrgMember, addOrgMember, getOrgMembers } from '@cultuvilla/shared/services/orgMemberService';
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

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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

  const actions: EntityDetailAction[] = org
    ? [
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/o/${org.id}/edit` as never),
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getOrgViewLink(org.id), org.name),
        },
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !org}
      imageUri={org?.imageURL ?? null}
      fallbackIcon={ENTITY_FALLBACK_ICON.organization}
      actions={actions}
      title={org?.name}
      scrollContentClassName="pb-28"
      fab={
        org && !isMember ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24, alignItems: 'center', zIndex: 20 }}
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
        ) : null
      }
    >
      {org ? (
        <>
          {org.description ? <Text>{org.description}</Text> : null}
          <Text tone="muted">{t('organization.membersCount', { count: membersCount ?? 0 })}</Text>
          {arrivedViaInvite && !isMember ? (
            <Text tone="muted" variant="bodySm">
              {t('organization.invitedBanner')}
            </Text>
          ) : null}
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
