import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { LiveOwnerChip } from './LiveOwnerChip';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { useT } from '../../lib/i18n';

interface VillagerOption {
  userId: string;
  displayName: string;
}

export interface OrganizerPickerProps {
  municipalityId: string;
  selectedUserIds: string[];
  selectedOrgIds: string[];
  /** Creator — shown as a chip, cannot be removed. */
  lockedUserId?: string;
  onChangeUsers: (ids: string[]) => void;
  onChangeOrgs: (ids: string[]) => void;
}

/**
 * Controlled picker for event/news co-organizers.
 *
 * - User section: locked creator chip + "Add person" button that opens a modal
 *   with a scrollable list of village members. The locked user stays selected
 *   regardless of what the user does.
 * - Org section: ChoiceList (mode="multi") with approved orgs in the village.
 *   Selecting an org calls onChangeOrgs; orgs are display-only (no control).
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSelected, setSheetSelected] = useState<Set<string>>(new Set());

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

  // ---- Org ChoiceList -------------------------------------------------------
  const orgOptions = orgs.map((o) => ({ value: o.id, label: o.name }));

  // ---- Villager sheet -------------------------------------------------------
  function openSheet() {
    setSheetSelected(new Set(selectedUserIds));
    setSheetOpen(true);
  }

  function toggleVillager(userId: string) {
    if (userId === lockedUserId) return; // locked — cannot remove
    setSheetSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function confirmSheet() {
    // Ensure locked user is always included
    const ids = [...sheetSelected];
    if (lockedUserId && !ids.includes(lockedUserId)) {
      ids.unshift(lockedUserId);
    }
    onChangeUsers(ids);
    setSheetOpen(false);
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <VStack gap={3}>
      {/* Selected users — locked creator always shown */}
      <HStack gap={2} className="flex-wrap">
        {selectedUserIds.map((uid) => (
          <LiveOwnerChip key={uid} ownerId={uid} ownerType="user" />
        ))}
      </HStack>

      <Button variant="ghost" onPress={openSheet} testID="add-user-btn">
        {t('event.organizer.addUser')}
      </Button>

      {/* Org picker — wraps ChoiceList but each Pressable gets a testID via the
          outer HStack so the test can target individual org options */}
      {orgOptions.length > 0 ? (
        <HStack gap={2} className="flex-wrap">
          {orgOptions.map((o) => {
            const isSelected = selectedOrgIds.includes(o.value);
            return (
              <RNPressable
                key={o.value}
                testID={`org-option-${o.value}`}
                onPress={() => {
                  const next = isSelected
                    ? selectedOrgIds.filter((id) => id !== o.value)
                    : [...selectedOrgIds, o.value];
                  onChangeOrgs(next);
                }}
                className={[
                  'px-3 py-2 rounded-full border',
                  isSelected ? 'bg-accent border-accent' : 'border-subtle bg-surface',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <Text className={isSelected ? 'text-on-accent' : 'text-primary'}>{o.label}</Text>
              </RNPressable>
            );
          })}
        </HStack>
      ) : null}

      {/* Villager selection sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <RNPressable
          onPress={() => setSheetOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          className="justify-end"
        >
          <RNPressable
            onPress={() => {}}
            className="rounded-t-2xl bg-surface-elevated p-5 border-t border-subtle"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <VStack gap={3}>
              <Text variant="h3">{t('event.organizer.selectUsers')}</Text>

              <ScrollView style={{ maxHeight: 320 }}>
                <VStack gap={2}>
                  {villagers.map((v) => {
                    const isSelected = sheetSelected.has(v.userId);
                    const isLocked = v.userId === lockedUserId;
                    return (
                      <RNPressable
                        key={v.userId}
                        testID={`villager-row-${v.userId}`}
                        onPress={() => toggleVillager(v.userId)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        disabled={isLocked}
                        className={[
                          'flex-row items-center justify-between rounded-lg border p-3',
                          isSelected ? 'border-accent bg-surface' : 'border-subtle',
                          isLocked ? 'opacity-70' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <Text className="flex-1">{v.displayName}</Text>
                        {isLocked ? (
                          <Text variant="caption" tone="muted">
                            {t('event.organizer.locked')}
                          </Text>
                        ) : null}
                      </RNPressable>
                    );
                  })}
                </VStack>
              </ScrollView>

              <Button onPress={confirmSheet} fullWidth testID="villager-confirm">
                {t('event.organizer.confirm')}
              </Button>
            </VStack>
          </RNPressable>
        </RNPressable>
      </Modal>
    </VStack>
  );
}
