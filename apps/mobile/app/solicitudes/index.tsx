import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Screen, VStack, HStack, Text, Button } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { useT } from '../../lib/i18n';
import { useApproverStatus } from '../../lib/auth/useApproverStatus';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getPendingOrganizerRequests,
  getMyOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService';
import {
  getPendingOrganizations,
  getOrganizationsByMunicipality,
  getMyOrganizations,
  getOrganization,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import {
  getAllPendingJoinRequests,
  getPendingJoinRequestsForOrgs,
  getMyJoinRequests,
  respondToJoinRequest,
} from '@cultuvilla/shared/services/organizationJoinRequestService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import type { OrganizerRequestData } from '@cultuvilla/shared/models/municipality/OrganizerRequestDataModel';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import type { OrganizationJoinRequestData } from '@cultuvilla/shared/models/organizationJoinRequest/OrganizationJoinRequestDataModel';

type OrganizerRow = OrganizerRequestData & { id: string };
type OrgRow = OrganizationData & { id: string };
type JoinRow = OrganizationJoinRequestData & { id: string };

export default function SolicitudesScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const { loading, isSuperAdmin, adminVillageIds, adminOrgIds, canApprove } = useApproverStatus();

  // Tab state
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');

  // Inbox state
  const [organizerRows, setOrganizerRows] = useState<OrganizerRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [joinRows, setJoinRows] = useState<JoinRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Outbox state
  const [outboxOrganizer, setOutboxOrganizer] = useState<OrganizerRow[]>([]);
  const [outboxOrgs, setOutboxOrgs] = useState<OrgRow[]>([]);
  const [outboxJoins, setOutboxJoins] = useState<JoinRow[]>([]);
  const [outboxLoading, setOutboxLoading] = useState(false);

  // Shared name maps (shared between inbox and outbox)
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({});
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  // Busy state keyed by `${type}-${id}`
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Error modal state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Inbox load ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (loading) return;
    if (!canApprove) return; // non-approver inbox is always empty

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

  // ─── Outbox load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setOutboxLoading(true);

    void (async () => {
      try {
        const [myOrganizerReqs, myOrgs, myJoins] = await Promise.all([
          getMyOrganizerRequests(user.uid),
          getMyOrganizations(user.uid),
          getMyJoinRequests(user.uid),
        ]);

        if (cancelled) return;

        setOutboxOrganizer(myOrganizerReqs);
        setOutboxOrgs(myOrgs);
        setOutboxJoins(myJoins);

        if (cancelled) return;

        // Resolve municipality names for organizer outbox rows
        const newMunicipalityIds = new Set<string>();
        myOrganizerReqs.forEach((r) => newMunicipalityIds.add(r.municipalityId));
        const municipalityFetches = [...newMunicipalityIds].map(async (mid) => {
          const m = await getMunicipality(mid);
          return [mid, m?.name ?? mid] as const;
        });
        const resolvedMunicipalities = await Promise.all(municipalityFetches);
        if (!cancelled) {
          const newNames: Record<string, string> = {};
          for (const [mid, name] of resolvedMunicipalities) {
            newNames[mid] = name;
          }
          if (Object.keys(newNames).length > 0) {
            setMunicipalityNames((prev) => ({ ...prev, ...newNames }));
          }
        }

        // Resolve org names for join outbox rows
        const newOrgIds = new Set<string>();
        myJoins.forEach((r) => newOrgIds.add(r.orgId));
        const orgFetches = [...newOrgIds].map(async (id) => {
          const org = await getOrganization(id);
          return [id, org?.name ?? id] as const;
        });
        const resolvedOrgs = await Promise.all(orgFetches);
        if (!cancelled) {
          const newOrgNames: Record<string, string> = {};
          for (const [id, name] of resolvedOrgs) {
            newOrgNames[id] = name;
          }
          if (Object.keys(newOrgNames).length > 0) {
            setOrgNames((prev) => ({ ...prev, ...newOrgNames }));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setOutboxLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ─── Inbox action handlers ─────────────────────────────────────────────────
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

  // ─── Render helpers ────────────────────────────────────────────────────────
  function renderInbox() {
    if (dataLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }

    const hasAny = organizerRows.length > 0 || orgRows.length > 0 || joinRows.length > 0;
    if (!hasAny) {
      return (
        <View className="p-4">
          <Text tone="muted">{t('solicitudes.empty')}</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Organizer requests section */}
        {isSuperAdmin && organizerRows.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('solicitudes.tab.organizer')}</Text>
            {organizerRows.map((row) => {
              const key = `organizer-${row.id}`;
              const municipalityName = municipalityNames[row.municipalityId] ?? row.municipalityId;
              return (
                <VStack
                  key={row.id}
                  gap={2}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <Text>
                    {t('solicitudes.organizerRow', {
                      user: row.userId,
                      municipality: municipalityName,
                    })}
                  </Text>
                  {row.motivation && row.motivation.trim().length > 0 && (
                    <VStack gap={0}>
                      <Text tone="muted" variant="caption">
                        {t('solicitudes.motivation')}
                      </Text>
                      <Text className="italic text-sm">"{row.motivation}"</Text>
                    </VStack>
                  )}
                  <HStack gap={2}>
                    <Button
                      onPress={() => handleOrganizerDecide(row, 'approved')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => handleOrganizerDecide(row, 'rejected')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.reject')}
                    </Button>
                  </HStack>
                </VStack>
              );
            })}
          </VStack>
        )}

        {/* Org-creation section */}
        {orgRows.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('solicitudes.tab.org')}</Text>
            {orgRows.map((row) => {
              const key = `org-${row.id}`;
              const municipalityName = municipalityNames[row.municipalityId] ?? row.municipalityId;
              return (
                <VStack
                  key={row.id}
                  gap={2}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <Text>
                    {t('solicitudes.orgRow', { org: row.name, type: row.type })}
                  </Text>
                  <Text tone="muted" variant="caption">
                    {municipalityName}
                  </Text>
                  <HStack gap={2}>
                    <Button
                      onPress={() => handleOrgDecide(row, 'approved')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => handleOrgDecide(row, 'rejected')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.reject')}
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
            <Text variant="h3">{t('solicitudes.tab.join')}</Text>
            {joinRows.map((row) => {
              const key = `join-${row.id}`;
              const orgName = orgNames[row.orgId] ?? row.orgId;
              return (
                <VStack
                  key={row.id}
                  gap={2}
                  className="bg-surface border border-subtle rounded-xl p-3"
                >
                  <Text>
                    {t('solicitudes.joinRow', { user: row.userId, org: orgName })}
                  </Text>
                  <HStack gap={2}>
                    <Button
                      onPress={() => handleJoinDecide(row, 'approved')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.approve')}
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => handleJoinDecide(row, 'rejected')}
                      loading={busyKey === key}
                    >
                      {t('solicitudes.reject')}
                    </Button>
                  </HStack>
                </VStack>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    );
  }

  function renderOutbox() {
    if (outboxLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }

    const hasAny = outboxOrganizer.length > 0 || outboxOrgs.length > 0 || outboxJoins.length > 0;
    if (!hasAny) {
      return (
        <View className="p-4">
          <Text tone="muted">{t('solicitudes.outbox.empty')}</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Outbox organizer requests */}
        {outboxOrganizer.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('solicitudes.tab.organizer')}</Text>
            {outboxOrganizer.map((r) => (
              <VStack
                key={r.id}
                gap={1}
                className="bg-surface border border-subtle rounded-xl p-3"
              >
                <Text>
                  {t('solicitudes.outbox.organizer', {
                    municipality: municipalityNames[r.municipalityId] ?? r.municipalityId,
                  })}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(`solicitudes.status.${r.status}`)}
                </Text>
              </VStack>
            ))}
          </VStack>
        )}

        {/* Outbox org-creation requests */}
        {outboxOrgs.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('solicitudes.tab.org')}</Text>
            {outboxOrgs.map((r) => (
              <VStack
                key={r.id}
                gap={1}
                className="bg-surface border border-subtle rounded-xl p-3"
              >
                <Text>
                  {t('solicitudes.outbox.org', { org: r.name })}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(`solicitudes.status.${r.status}`)}
                </Text>
              </VStack>
            ))}
          </VStack>
        )}

        {/* Outbox join requests */}
        {outboxJoins.length > 0 && (
          <VStack gap={2}>
            <Text variant="h3">{t('solicitudes.tab.join')}</Text>
            {outboxJoins.map((r) => (
              <VStack
                key={r.id}
                gap={1}
                className="bg-surface border border-subtle rounded-xl p-3"
              >
                <Text>
                  {t('solicitudes.outbox.join', { org: orgNames[r.orgId] ?? r.orgId })}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(`solicitudes.status.${r.status}`)}
                </Text>
              </VStack>
            ))}
          </VStack>
        )}
      </ScrollView>
    );
  }

  // ─── Full-screen loading (approver status loading) ─────────────────────────
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('solicitudes.title')} />

      {/* Inbox / Outbox toggle */}
      <View className="px-4 pt-3">
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          options={[
            { value: 'inbox', label: t('solicitudes.tab.inbox') },
            { value: 'outbox', label: t('solicitudes.tab.outbox') },
          ] as const}
        />
      </View>

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

      {tab === 'inbox' ? renderInbox() : renderOutbox()}
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
