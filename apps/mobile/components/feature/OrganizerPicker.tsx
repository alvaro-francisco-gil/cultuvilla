import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { colors } from '@cultuvilla/shared/design-system';
import { LiveOwnerChip } from './LiveOwnerChip';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { FieldLabel } from '../primitives/FieldLabel';
import { Pressable } from '../primitives/Pressable';
import { useT } from '../../lib/i18n';

const ACCENT = colors.light.fg.accent;

interface VillagerOption {
  userId: string;
  displayName: string;
}

export interface OrganizerPickerProps {
  municipalityId: string;
  selectedUserIds: string[];
  selectedOrgIds: string[];
  /** Creator — shown as a locked row, cannot be removed. */
  lockedUserId?: string;
  onChangeUsers: (ids: string[]) => void;
  onChangeOrgs: (ids: string[]) => void;
}

/**
 * Controlled picker for event/news co-organizers, in two sections:
 *
 * - "Organizadores" (people): each selected villager is a full-width row with
 *   their avatar + name (via {@link LiveOwnerChip}); the locked creator can't be
 *   removed. A dashed "Añadir persona" row opens a member-picker sheet.
 * - "Grupos involucrados" (organizations): the same row treatment, added via an
 *   "Añadir grupo" sheet listing the village's approved groups (rather than
 *   showing every group inline).
 */
export function OrganizerPicker({
  municipalityId,
  selectedUserIds,
  selectedOrgIds,
  lockedUserId,
  onChangeUsers,
  onChangeOrgs,
}: OrganizerPickerProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [villagers, setVillagers] = useState<VillagerOption[]>([]);
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [userSheetSelected, setUserSheetSelected] = useState<Set<string>>(new Set());
  const [orgSheetOpen, setOrgSheetOpen] = useState(false);
  const [orgSheetSelected, setOrgSheetSelected] = useState<Set<string>>(new Set());

  // ---- Load orgs + villagers once on mount / when municipality changes ------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [orgDocs, memberDocs] = await Promise.all([
        getOrganizationsByMunicipality(municipalityId, 'approved'),
        getVillageMembers(municipalityId),
      ]);
      if (cancelled) return;
      setOrgs(orgDocs);

      const withNames = await Promise.all(
        memberDocs.map(async (m) => {
          const profile = await getUserProfile(m.userId);
          return { userId: m.userId, displayName: profile?.displayName ?? m.userId };
        }),
      );
      if (!cancelled) setVillagers(withNames);
    })();
    return () => {
      cancelled = true;
    };
  }, [municipalityId]);

  // ---- Villager sheet -------------------------------------------------------
  function openUserSheet() {
    setUserSheetSelected(new Set(selectedUserIds));
    setUserSheetOpen(true);
  }
  function toggleVillager(userId: string) {
    if (userId === lockedUserId) return; // locked — cannot remove
    setUserSheetSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function confirmUserSheet() {
    const ids = [...userSheetSelected];
    if (lockedUserId && !ids.includes(lockedUserId)) ids.unshift(lockedUserId);
    onChangeUsers(ids);
    setUserSheetOpen(false);
  }
  function removeUser(userId: string) {
    if (userId === lockedUserId) return;
    onChangeUsers(selectedUserIds.filter((id) => id !== userId));
  }

  // ---- Org sheet ------------------------------------------------------------
  function openOrgSheet() {
    setOrgSheetSelected(new Set(selectedOrgIds));
    setOrgSheetOpen(true);
  }
  function toggleOrg(orgId: string) {
    setOrgSheetSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  }
  function confirmOrgSheet() {
    onChangeOrgs([...orgSheetSelected]);
    setOrgSheetOpen(false);
  }
  function removeOrg(orgId: string) {
    onChangeOrgs(selectedOrgIds.filter((id) => id !== orgId));
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <VStack gap={6}>
      {/* People */}
      <VStack gap={2}>
        <FieldLabel>{t('event.organizersLabel')}</FieldLabel>
        {selectedUserIds.map((uid) => {
          const locked = uid === lockedUserId;
          return (
            <HStack
              key={uid}
              gap={2}
              className="items-center justify-between rounded-lg border border-subtle p-3"
            >
              <LiveOwnerChip ownerId={uid} ownerType="user" />
              {locked ? (
                <Text variant="caption" tone="muted">{t('event.organizer.locked')}</Text>
              ) : (
                <Pressable
                  onPress={() => removeUser(uid)}
                  accessibilityLabel={t('event.organizer.remove')}
                  testID={`remove-user-${uid}`}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </Pressable>
              )}
            </HStack>
          );
        })}
        <AddRow label={t('event.organizer.addUser')} onPress={openUserSheet} testID="add-user-btn" />
      </VStack>

      {/* Groups */}
      <VStack gap={2}>
        <FieldLabel>{t('event.groupsLabel')}</FieldLabel>
        {selectedOrgIds.map((oid) => (
          <HStack
            key={oid}
            gap={2}
            className="items-center justify-between rounded-lg border border-subtle p-3"
          >
            <LiveOwnerChip ownerId={oid} ownerType="organization" />
            <Pressable
              onPress={() => removeOrg(oid)}
              accessibilityLabel={t('event.organizer.remove')}
              testID={`remove-org-${oid}`}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#94a3b8" />
            </Pressable>
          </HStack>
        ))}
        <AddRow label={t('event.organizer.addOrg')} onPress={openOrgSheet} testID="add-org-btn" />
      </VStack>

      {/* Villager selection sheet */}
      <SelectSheet
        open={userSheetOpen}
        title={t('event.organizer.selectUsers')}
        confirmLabel={t('event.organizer.confirm')}
        emptyLabel={null}
        onClose={() => setUserSheetOpen(false)}
        onConfirm={confirmUserSheet}
        confirmTestID="villager-confirm"
        bottomInset={insets.bottom}
      >
        {villagers.map((v) => {
          const isSelected = userSheetSelected.has(v.userId);
          const isLocked = v.userId === lockedUserId;
          return (
            <SheetRow
              key={v.userId}
              testID={`villager-row-${v.userId}`}
              label={v.displayName}
              selected={isSelected}
              disabled={isLocked}
              trailing={isLocked ? t('event.organizer.locked') : undefined}
              onPress={() => toggleVillager(v.userId)}
            />
          );
        })}
      </SelectSheet>

      {/* Group selection sheet */}
      <SelectSheet
        open={orgSheetOpen}
        title={t('event.organizer.selectOrgs')}
        confirmLabel={t('event.organizer.confirm')}
        emptyLabel={orgs.length === 0 ? t('event.organizer.noGroups') : null}
        onClose={() => setOrgSheetOpen(false)}
        onConfirm={confirmOrgSheet}
        confirmTestID="org-confirm"
        bottomInset={insets.bottom}
      >
        {orgs.map((o) => (
          <SheetRow
            key={o.id}
            testID={`org-row-${o.id}`}
            label={o.name}
            selected={orgSheetSelected.has(o.id)}
            onPress={() => toggleOrg(o.id)}
          />
        ))}
      </SelectSheet>
    </VStack>
  );
}

/** Dashed full-width "add another" affordance, matching the pueblo tab. */
function AddRow({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-2 rounded-lg border border-dashed border-subtle p-3"
    >
      <Ionicons name="add" size={22} color={ACCENT} />
      <Text tone="muted" className="flex-1">{label}</Text>
    </Pressable>
  );
}

function SheetRow({
  label,
  selected,
  disabled,
  trailing,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  trailing?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <RNPressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      disabled={disabled}
      className={[
        'flex-row items-center justify-between rounded-lg border p-3',
        selected ? 'border-accent bg-surface' : 'border-subtle',
        disabled ? 'opacity-70' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="flex-1">{label}</Text>
      {trailing ? (
        <Text variant="caption" tone="muted">{trailing}</Text>
      ) : selected ? (
        <Ionicons name="checkmark" size={20} color={ACCENT} />
      ) : null}
    </RNPressable>
  );
}

function SelectSheet({
  open,
  title,
  confirmLabel,
  emptyLabel,
  onClose,
  onConfirm,
  confirmTestID,
  bottomInset,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  emptyLabel: string | null;
  onClose: () => void;
  onConfirm: () => void;
  confirmTestID: string;
  bottomInset: number;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <RNPressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} className="justify-end">
        <RNPressable
          onPress={() => {}}
          className="rounded-t-2xl bg-surface-elevated p-5 border-t border-subtle"
          style={{ paddingBottom: bottomInset + 20 }}
        >
          <VStack gap={3}>
            <Text variant="h3">{title}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <VStack gap={2}>
                {emptyLabel ? <Text tone="muted">{emptyLabel}</Text> : children}
              </VStack>
            </ScrollView>
            <Button onPress={onConfirm} fullWidth testID={confirmTestID}>{confirmLabel}</Button>
          </VStack>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
