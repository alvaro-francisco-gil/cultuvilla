import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Avatar, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { NotificationRow } from '../../components/feature/NotificationRow';
import { useT } from '../../lib/i18n';
import { useApproverStatus } from '../../lib/auth/useApproverStatus';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getPendingOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import {
  getPendingOrganizations,
  getOrganizationsByMunicipality,
  getOrganization,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import {
  getAllPendingJoinRequests,
  getPendingJoinRequestsForOrgs,
  respondToJoinRequest,
} from '@cultuvilla/shared/services/organizationJoinRequestService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getNotifications, markAllAsRead } from '@cultuvilla/shared/services/notificationService';
import { getMyPendingRequests, buildActivityFeed } from '@cultuvilla/shared/services/inboxService';
import type { ActivityItem } from '@cultuvilla/shared/services/inboxService';
import type { OrganizerRequestData } from '@cultuvilla/shared/models/municipality/OrganizerRequestDataModel';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import type { OrganizationJoinRequestData } from '@cultuvilla/shared/models/organizationJoinRequest/OrganizationJoinRequestDataModel';

type OrganizerRow = OrganizerRequestData & { id: string };
type OrgRow = OrganizationData & { id: string };
type JoinRow = OrganizationJoinRequestData & { id: string };

export default function InboxScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const { loading, isSuperAdmin, adminVillageIds, adminOrgIds, canApprove } = useApproverStatus();

  // ─── Actionable ("Necesita tu acción") state ────────────────────────────────
  const [organizerRows, setOrganizerRows] = useState<OrganizerRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [joinRows, setJoinRows] = useState<JoinRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ─── Activity feed state ────────────────────────────────────────────────────
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Shared name maps (used by both the actionable cards and the activity feed's
  // pending-sent rows).
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({});
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [requesterByUid, setRequesterByUid] = useState<
    Record<string, { name: string; photoURL: string | null }>
  >({});

  // Busy state keyed by `${type}-${id}`
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Error modal state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Actionable load ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (loading) return;
    if (!canApprove) return; // non-approvers never have actionable items

    setDataLoading(true);
    try {
      const promises: Promise<void>[] = [];
      const newMunicipalityIds = new Set<string>();
      const newOrgIds = new Set<string>();

      let fetchedOrganizerRows: OrganizerRow[] = [];
      let fetchedOrgRows: OrgRow[] = [];
      let fetchedJoinRows: JoinRow[] = [];

      if (isSuperAdmin) {
        promises.push(
          getPendingOrganizerRequests().then((rows) => {
            fetchedOrganizerRows = rows;
            rows.forEach((r) => newMunicipalityIds.add(r.municipalityId));
          }),
        );
        promises.push(
          getPendingOrganizations().then((rows) => {
            fetchedOrgRows = rows;
            rows.forEach((r) => newMunicipalityIds.add(r.municipalityId));
          }),
        );
        promises.push(
          getAllPendingJoinRequests().then((rows) => {
            fetchedJoinRows = rows;
            rows.forEach((r) => newOrgIds.add(r.orgId));
          }),
        );
      } else {
        if (adminVillageIds.length > 0) {
          promises.push(
            Promise.all(
              adminVillageIds.map((vid) => getOrganizationsByMunicipality(vid, 'pending')),
            ).then((perVillage) => {
              fetchedOrgRows = perVillage.flat();
              fetchedOrgRows.forEach((r) => newMunicipalityIds.add(r.municipalityId));
            }),
          );
        }
        if (adminOrgIds.length > 0) {
          promises.push(
            getPendingJoinRequestsForOrgs(adminOrgIds).then((rows) => {
              fetchedJoinRows = rows;
              rows.forEach((r) => newOrgIds.add(r.orgId));
            }),
          );
        }
      }

      await Promise.all(promises);

      setOrganizerRows(fetchedOrganizerRows);
      setOrgRows(fetchedOrgRows);
      setJoinRows(fetchedJoinRows);

      // Resolve organizer-request requesters (name + photo)
      const requesterFetches = fetchedOrganizerRows.map(async (r) => {
        if (requesterByUid[r.userId]) return;
        const p = await getPersonByUserId(r.userId);
        return [
          r.userId,
          {
            name: p ? buildDisplayName(p) : r.userId,
            photoURL: p?.photoURL ?? null,
          },
        ] as const;
      });
      const resolvedRequesters = await Promise.all(requesterFetches);
      const newRequesters = resolvedRequesters.filter(
        (pair): pair is readonly [string, { name: string; photoURL: string | null }] =>
          pair !== undefined,
      );
      if (newRequesters.length > 0) {
        setRequesterByUid((prev) => {
          const next = { ...prev };
          for (const [id, v] of newRequesters) next[id] = v;
          return next;
        });
      }

      // Resolve municipality names
      const municipalityFetches = [...newMunicipalityIds].map(async (mid) => {
        if (municipalityNames[mid]) return;
        const m = await getMunicipality(mid);
        return [mid, m?.name ?? mid] as const;
      });
      const resolvedMunicipalities = await Promise.all(municipalityFetches);
      const newNames: Record<string, string> = {};
      for (const pair of resolvedMunicipalities) {
        if (pair) newNames[pair[0]] = pair[1];
      }
      if (Object.keys(newNames).length > 0) {
        setMunicipalityNames((prev) => ({ ...prev, ...newNames }));
      }

      // Resolve org names for join rows
      const knownOrgNames: Record<string, string> = {};
      for (const org of fetchedOrgRows) {
        knownOrgNames[org.id] = org.name;
      }
      const missingOrgIds = [...newOrgIds].filter((id) => !knownOrgNames[id]);
      if (missingOrgIds.length > 0) {
        const orgNameFetches = missingOrgIds.map(async (id) => {
          const org = await getOrganization(id);
          return [id, org?.name ?? id] as const;
        });
        const resolvedOrgNames = await Promise.all(orgNameFetches);
        for (const [id, name] of resolvedOrgNames) {
          knownOrgNames[id] = name;
        }
      }
      if (Object.keys(knownOrgNames).length > 0) {
        setOrgNames((prev) => ({ ...prev, ...knownOrgNames }));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setDataLoading(false);
    }
  }, [loading, canApprove, isSuperAdmin, adminVillageIds, adminOrgIds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Activity load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setActivityLoading(true);

    void (async () => {
      try {
        const [notifications, pendingSent] = await Promise.all([
          getNotifications(user.uid),
          getMyPendingRequests(user.uid),
        ]);
        if (cancelled) return;

        const feed = buildActivityFeed(notifications, pendingSent);
        setActivityItems(feed);

        // Resolve municipality/org names for pending-sent rows (organizer's
        // label is a municipalityId, join's label is an orgId; org's label is
        // already the org name — see inboxService.getMyPendingRequests).
        const newMunicipalityIds = new Set<string>();
        const newOrgIds = new Set<string>();
        for (const item of feed) {
          if (item.kind !== 'pending-sent') continue;
          if (item.requestType === 'organizer') newMunicipalityIds.add(item.label);
          if (item.requestType === 'join') newOrgIds.add(item.label);
        }

        const [resolvedMunicipalities, resolvedOrgs] = await Promise.all([
          Promise.all(
            [...newMunicipalityIds].map(async (mid) => {
              const m = await getMunicipality(mid);
              return [mid, m?.name ?? mid] as const;
            }),
          ),
          Promise.all(
            [...newOrgIds].map(async (id) => {
              const org = await getOrganization(id);
              return [id, org?.name ?? id] as const;
            }),
          ),
        ]);
        if (cancelled) return;

        if (resolvedMunicipalities.length > 0) {
          setMunicipalityNames((prev) => {
            const next = { ...prev };
            for (const [id, name] of resolvedMunicipalities) next[id] = name;
            return next;
          });
        }
        if (resolvedOrgs.length > 0) {
          setOrgNames((prev) => {
            const next = { ...prev };
            for (const [id, name] of resolvedOrgs) next[id] = name;
            return next;
          });
        }

        // v1: mark everything read as soon as the Buzón is opened.
        await markAllAsRead(user.uid);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ─── Actionable decision handlers ────────────────────────────────────────────
  async function handleOrganizerDecide(row: OrganizerRow, decision: 'approved' | 'rejected') {
    const key = `organizer-${row.id}`;
    setBusyKey(key);
    try {
      await respondToOrganizerRequest({ requestId: row.id, decision });
      setOrganizerRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleOrgDecide(row: OrgRow, decision: 'approved' | 'rejected') {
    const key = `org-${row.id}`;
    setBusyKey(key);
    try {
      if (decision === 'approved') {
        await approveOrganization(row.id);
      } else {
        await rejectOrganization(row.id);
      }
      setOrgRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleJoinDecide(row: JoinRow, decision: 'approved' | 'rejected') {
    const key = `join-${row.id}`;
    setBusyKey(key);
    try {
      await respondToJoinRequest(row.id, decision);
      setJoinRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  // ─── Render: actionable section ──────────────────────────────────────────────
  const hasActionable = organizerRows.length > 0 || orgRows.length > 0 || joinRows.length > 0;

  function renderActionable() {
    if (dataLoading) {
      return (
        <View className="items-center justify-center py-6">
          <ActivityIndicator />
        </View>
      );
    }

    if (!hasActionable) return null;

    return (
      <VStack gap={4}>
        <Text variant="h2">{t('inbox.needsAction')}</Text>

        {/* Organizer requests section */}
        {isSuperAdmin && organizerRows.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('inbox.tab.organizer')}</Text>
            {organizerRows.map((row) => {
              const key = `organizer-${row.id}`;
              const municipalityName = municipalityNames[row.municipalityId] ?? row.municipalityId;
              const requester = requesterByUid[row.userId];
              const name = requester?.name ?? row.userId;
              return (
                <Pressable
                  key={row.id}
                  onPress={() => router.push(`/user/${row.userId}` as never)}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <VStack gap={2}>
                    <HStack gap={2} className="items-center">
                      <Avatar
                        uri={requester?.photoURL ?? undefined}
                        size={40}
                        initials={name.charAt(0).toUpperCase()}
                      />
                      <VStack gap={0} className="flex-1">
                        <Text className="font-semibold">{name}</Text>
                        <HStack gap={1} className="items-center flex-wrap">
                          <Text tone="muted" variant="caption">
                            {t('inbox.wantsToAdminister')}
                          </Text>
                          {/* onStartShouldSetResponder claims the responder chain so
                              react-native-web stops the click from bubbling to the
                              outer card Pressable (RN's native responder system
                              already isolates this; the web DOM does not). */}
                          <View onStartShouldSetResponder={() => true}>
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: '/village/[villageId]',
                                  params: { villageId: row.municipalityId },
                                } as never)
                              }
                            >
                              <Text variant="caption" style={{ textDecorationLine: 'underline' }}>
                                {municipalityName}
                              </Text>
                            </Pressable>
                          </View>
                        </HStack>
                      </VStack>
                    </HStack>
                    {row.motivation && row.motivation.trim().length > 0 && (
                      <VStack gap={0}>
                        <Text tone="muted" variant="caption">
                          {t('inbox.motivation')}
                        </Text>
                        <Text className="italic text-sm">"{row.motivation}"</Text>
                      </VStack>
                    )}
                    <View onStartShouldSetResponder={() => true}>
                      <HStack gap={2}>
                        <Button
                          onPress={() => handleOrganizerDecide(row, 'approved')}
                          loading={busyKey === key}
                          testID={`approve-organizer-${row.id}`}
                        >
                          {t('inbox.approve')}
                        </Button>
                        <Button
                          variant="ghost"
                          onPress={() => handleOrganizerDecide(row, 'rejected')}
                          loading={busyKey === key}
                        >
                          {t('inbox.reject')}
                        </Button>
                      </HStack>
                    </View>
                  </VStack>
                </Pressable>
              );
            })}
          </VStack>
        )}

        {/* Org-creation section */}
        {orgRows.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('inbox.tab.org')}</Text>
            {orgRows.map((row) => {
              const key = `org-${row.id}`;
              const municipalityName = municipalityNames[row.municipalityId] ?? row.municipalityId;
              return (
                <VStack
                  key={row.id}
                  gap={2}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <Text>{t('inbox.orgRow', { org: row.name, type: row.type })}</Text>
                  <Text tone="muted" variant="caption">
                    {municipalityName}
                  </Text>
                  <HStack gap={2}>
                    <Button
                      onPress={() => handleOrgDecide(row, 'approved')}
                      loading={busyKey === key}
                      testID={`approve-org-${row.id}`}
                    >
                      {t('inbox.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => handleOrgDecide(row, 'rejected')}
                      loading={busyKey === key}
                    >
                      {t('inbox.reject')}
                    </Button>
                  </HStack>
                </VStack>
              );
            })}
          </VStack>
        )}

        {/* Join-request section */}
        {joinRows.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('inbox.tab.join')}</Text>
            {joinRows.map((row) => {
              const key = `join-${row.id}`;
              const orgName = orgNames[row.orgId] ?? row.orgId;
              return (
                <VStack
                  key={row.id}
                  gap={2}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <Text>{t('inbox.joinRow', { user: row.userId, org: orgName })}</Text>
                  <HStack gap={2}>
                    <Button
                      onPress={() => handleJoinDecide(row, 'approved')}
                      loading={busyKey === key}
                      testID={`approve-join-${row.id}`}
                    >
                      {t('inbox.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => handleJoinDecide(row, 'rejected')}
                      loading={busyKey === key}
                    >
                      {t('inbox.reject')}
                    </Button>
                  </HStack>
                </VStack>
              );
            })}
          </VStack>
        )}
      </VStack>
    );
  }

  // ─── Render: activity section ────────────────────────────────────────────────
  function pendingSentLabel(item: Extract<ActivityItem, { kind: 'pending-sent' }>): string {
    if (item.requestType === 'organizer') {
      return t('inbox.pendingSent.organizer', {
        name: municipalityNames[item.label] ?? item.label,
      });
    }
    if (item.requestType === 'join') {
      return t('inbox.pendingSent.join', { name: orgNames[item.label] ?? item.label });
    }
    return t('inbox.pendingSent.org', { name: item.label });
  }

  function renderActivity() {
    if (activityLoading) {
      return (
        <View className="items-center justify-center py-6">
          <ActivityIndicator />
        </View>
      );
    }

    if (activityItems.length === 0) return null;

    return (
      <VStack gap={2}>
        <Text variant="h2">{t('inbox.activity')}</Text>
        <VStack gap={0}>
          {activityItems.map((item) =>
            item.kind === 'notification' ? (
              <NotificationRow
                key={item.id}
                title={item.notification.title}
                body={item.notification.body}
                read={item.notification.read}
                createdAt={item.notification.createdAt}
              />
            ) : (
              <VStack key={item.id} gap={1} className="bg-surface border-b border-subtle px-4 py-3">
                <Text variant="bodySm" tone="muted">
                  {pendingSentLabel(item)}
                </Text>
                <Text variant="caption" tone="muted">
                  {t('inbox.pendingSent.waiting')}
                </Text>
              </VStack>
            ),
          )}
        </VStack>
      </VStack>
    );
  }

  // ─── Full-screen loading (approver status loading) ──────────────────────────
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  const isEmpty =
    !dataLoading &&
    !activityLoading &&
    !(canApprove && hasActionable) &&
    activityItems.length === 0;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('inbox.title')} />

      {/* Error modal — using Modal instead of native alert (no-op on RN-Web) */}
      <Modal
        visible={errorMessage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorMessage(null)}
      >
        <View style={styles.errorOverlay}>
          <View style={styles.errorBox}>
            <Text variant="body">{errorMessage ?? ''}</Text>
            <View style={styles.errorButtonRow}>
              <Button onPress={() => setErrorMessage(null)}>{t('common.close')}</Button>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        {canApprove && renderActionable()}
        {renderActivity()}
        {isEmpty && (
          <View className="p-4">
            <Text tone="muted">{t('inbox.empty')}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorBox: {
    backgroundColor: '#f9f0e8',
    borderRadius: 12,
    padding: 20,
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  errorButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
