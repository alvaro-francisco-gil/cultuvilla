import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, HStack, Text, Button } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useApproverStatus } from '../../lib/auth/useApproverStatus';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getPendingOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService';
import {
  getOrganizationsByMunicipality,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import {
  getAllPendingJoinRequests,
  getPendingJoinRequestsForOrgs,
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
  const { user, profile } = useAuth();
  const { loading, isSuperAdmin, isVillageAdmin, adminOrgIds, canApprove } = useApproverStatus();
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  const [organizerRows, setOrganizerRows] = useState<OrganizerRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [joinRows, setJoinRows] = useState<JoinRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  // Map municipalityId -> name for display
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({});
  // Map orgId -> org name for join rows
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  // Busy state keyed by `${type}-${id}`
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Error modal state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard: redirect if not an approver
  useEffect(() => {
    if (!loading && !canApprove) {
      router.replace('/');
    }
  }, [loading, canApprove]);

  const loadData = useCallback(async () => {
    if (loading || !canApprove) return;

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
        // Super-admin org-creation: note — this uses the per-active-village call
        // (village-scoped). A true cross-village listing would need a collectionGroup
        // query not yet exposed as a service function. See task-13-report.md.
        if (activeMunicipalityId) {
          promises.push(
            getOrganizationsByMunicipality(activeMunicipalityId, 'pending').then((rows) => {
              fetchedOrgRows = rows;
              rows.forEach((r) => newMunicipalityIds.add(r.municipalityId));
            }),
          );
        }
        promises.push(
          getAllPendingJoinRequests().then((rows) => {
            fetchedJoinRows = rows;
            rows.forEach((r) => newOrgIds.add(r.orgId));
          }),
        );
      } else {
        if (isVillageAdmin && activeMunicipalityId) {
          promises.push(
            getOrganizationsByMunicipality(activeMunicipalityId, 'pending').then((rows) => {
              fetchedOrgRows = rows;
              rows.forEach((r) => newMunicipalityIds.add(r.municipalityId));
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

      // Resolve org names for join rows (orgs are already in fetchedOrgRows or need fetch)
      const knownOrgNames: Record<string, string> = {};
      for (const org of fetchedOrgRows) {
        knownOrgNames[org.id] = org.name;
      }
      const missingOrgIds = [...newOrgIds].filter((id) => !knownOrgNames[id]);
      if (missingOrgIds.length > 0) {
        // We don't have a batch-fetch by IDs; resolve each individually via the
        // already-fetched org rows or fall back to the org ID as a placeholder.
        // In practice join rows reference approved orgs, so their names aren't
        // in fetchedOrgRows (which are pending). We use the orgId as a fallback.
        const orgNameFetches = missingOrgIds.map(async (id) => {
          // Check if orgId matches any fetched org row
          const found = fetchedOrgRows.find((o) => o.id === id);
          return [id, found?.name ?? id] as const;
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
  }, [loading, canApprove, isSuperAdmin, isVillageAdmin, adminOrgIds, activeMunicipalityId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        const approvedBy = user?.uid ?? '';
        await approveOrganization(row.id, approvedBy, row.requestedBy);
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  const hasAny = organizerRows.length > 0 || orgRows.length > 0 || joinRows.length > 0;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('solicitudes.title')} />

      {/* Error modal — no Alert.alert (no-op on RN-Web) */}
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
              <Button onPress={() => setErrorMessage(null)}>{t('common.close') || 'Cerrar'}</Button>
            </View>
          </View>
        </View>
      </Modal>

      {dataLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !hasAny ? (
        <View className="p-4">
          <Text tone="muted">{t('solicitudes.empty')}</Text>
        </View>
      ) : (
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
      )}
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
