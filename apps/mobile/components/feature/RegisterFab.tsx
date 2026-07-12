import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable as RNPressable, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { showAlert, showConfirm } from '../../lib/dialogs';
import { AttendeeSheet, type AttendeeOption } from './AttendeeSheet';
import { computeRegistrationDiff, type AttendeeDiff, type AttendeeRegistration } from './attendeeDiff';
import {
  cancelRegistration,
  getUserRegistrations,
  registerToEvent,
} from '@cultuvilla/shared/services/registrationService';
import { getPersonsByCreator } from '@cultuvilla/shared/services/personService';
import { buildShortName, type PersonData } from '@cultuvilla/shared/models/person';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';

export interface RegisterFabProps {
  eventId: string;
  /** Firebase Auth uid — every registration the user makes is stamped with it. */
  userId: string;
  /** The caller's own persona id. */
  personId: string;
  /** The caller's own display name. */
  name: string;
  /** When true, adding new attendees first requires a shared phone. */
  telephoneRequired: boolean;
  /** The event's municipality — threaded into signup observability events. */
  villageId?: string;
}

type PersonDoc = PersonData & { id: string };

/**
 * Ordago-style floating sign-up button for the event detail screen. Tapping it
 * opens an {@link AttendeeSheet} where the caller signs up themselves and any
 * personas a cargo (or creates a new dependent). The pill reflects how many of
 * the caller's personas are currently registered, turning amber if any are
 * waitlisted.
 *
 * Styles live on `style` (never `className`) so the pill renders on RN-Web.
 */
export function RegisterFab({ eventId, userId, personId, name, telephoneRequired, villageId }: RegisterFabProps) {
  const { t } = useT();
  const [registrations, setRegistrations] = useState<Map<string, AttendeeRegistration>>(new Map());
  const [dependents, setDependents] = useState<PersonDoc[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoSelectIds, setAutoSelectIds] = useState<string[]>([]);
  const knownDepIds = useRef<Set<string>>(new Set());

  // Load the caller's registrations + personas a cargo. Runs on focus so a
  // dependent created via /person/new shows up on return.
  const load = useCallback(async () => {
    // The two reads are independent — the registered set and the persona list
    // come from different collections. Fetch them separately (allSettled) so a
    // failure in one (e.g. a missing index on registrations) never blanks the
    // other; coupling them in a single Promise.all previously hid every
    // dependent whenever getUserRegistrations threw.
    const [regsResult, depsResult] = await Promise.allSettled([
      withFirestoreErrorLog('event:getUserRegistrations', () => getUserRegistrations(eventId, userId)),
      withFirestoreErrorLog('event:getPersonsByCreator', () => getPersonsByCreator(userId)),
    ]);

    if (regsResult.status === 'fulfilled') {
      const map = new Map<string, AttendeeRegistration>();
      regsResult.value.forEach((r) => map.set(r.personId, { regId: r.id, status: r.status }));
      setRegistrations(map);
    }

    if (depsResult.status === 'fulfilled') {
      // Drop the caller's own persona (rendered from props) and other account holders.
      const filtered = depsResult.value.filter((d) => d.id !== personId && d.userId !== userId);
      const known = knownDepIds.current;
      const fresh = filtered.filter((d) => !known.has(d.id)).map((d) => d.id);
      if (known.size > 0 && fresh.length > 0) setAutoSelectIds(fresh);
      knownDepIds.current = new Set(filtered.map((d) => d.id));
      setDependents(filtered);
    }
  }, [eventId, userId, personId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const attendees: AttendeeOption[] = [
    { id: personId, name, status: registrations.get(personId)?.status },
    ...dependents.map((d) => ({
      id: d.id,
      name: buildShortName(d),
      status: registrations.get(d.id)?.status,
    })),
  ];
  const names = new Map(attendees.map((a) => [a.id, a.name]));

  async function applyDiff(diff: AttendeeDiff, phone?: string) {
    setBusy(true);
    let succeeded = false;
    try {
      const next = new Map(registrations);
      if (diff.toAdd.length > 0) {
        const registrants = diff.toAdd.map((a) => ({ ...a, ...(phone ? { phone } : {}) }));
        const summaries = await registerToEvent(eventId, registrants);
        succeeded = true;
        summaries.forEach((s, i) => {
          const pid = diff.toAdd[i]?.personId;
          if (pid) next.set(pid, { regId: s.id, status: s.status });
        });
        observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS, { villageId });
      }
      for (const regId of diff.toCancelRegIds) {
        await cancelRegistration(eventId, regId);
      }
      const cancelled = new Set(diff.toCancelRegIds);
      for (const [pid, reg] of next) {
        if (cancelled.has(reg.regId)) next.delete(pid);
      }
      setRegistrations(next);
      setAutoSelectIds([]);
      setSheetOpen(false);
    } catch (e) {
      if (!succeeded) observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_ERROR, { villageId });
      showAlert(e instanceof Error ? e.message : 'unknown', t('event.register.error'));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirm(selectedIds: string[], phone?: string) {
    const diff = computeRegistrationDiff(new Set(selectedIds), registrations, names);
    if (diff.toAdd.length === 0 && diff.toCancelRegIds.length === 0) {
      setSheetOpen(false);
      return;
    }
    if (diff.toCancelRegIds.length > 0) {
      // One combined confirm covers all removals.
      showConfirm(t('event.register.cancelTitle'), t('event.register.cancelManyBody'), () => void applyDiff(diff, phone), {
        confirmText: t('event.register.cancelConfirm'),
        cancelText: t('common.cancel'),
      });
    } else {
      void applyDiff(diff, phone);
    }
  }

  const count = registrations.size;
  const confirmedCount = [...registrations.values()].filter((r) => r.status === 'confirmed').length;
  const waitlistedCount = count - confirmedCount;
  // When the caller has a mix of confirmed + waitlisted personas we show two
  // pills side by side, each with its own tally, so the split is legible.
  // Otherwise a single pill: sign-up CTA, all-confirmed, or all-waitlisted.
  // The first pill always carries the `register-fab` testID so the sheet stays
  // openable via a stable handle regardless of the split.
  const pillContent: { label: string; prefix: string; bg: string }[] =
    count === 0
      ? [{ label: t('event.register.cta'), prefix: '+', bg: '#bb5d3a' }]
      : [
          ...(confirmedCount > 0
            ? [{ label: t('event.register.signedUpCount', { count: confirmedCount }), prefix: '✓', bg: '#2f7d4f' }]
            : []),
          ...(waitlistedCount > 0
            ? [{ label: t('event.register.waitlistedCount', { count: waitlistedCount }), prefix: '⏳', bg: '#b07a1e' }]
            : []),
        ];
  const pills = pillContent.map((p, i) => ({ ...p, testID: i === 0 ? 'register-fab' : 'register-fab-waitlist' }));

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 24,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 10,
          zIndex: 20,
        }}
      >
        {pills.map((pill) => (
          <RNPressable
            key={pill.testID}
            onPress={() => {
              if (!busy) setSheetOpen(true);
            }}
            disabled={busy}
            testID={pill.testID}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, selected: count > 0 }}
            accessibilityLabel={pill.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              paddingHorizontal: 22,
              borderRadius: 999,
              backgroundColor: pill.bg,
              opacity: busy ? 0.7 : 1,
              elevation: 6,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text style={{ color: '#f9f0e8', fontSize: 18, lineHeight: 22, marginRight: 8 }}>{pill.prefix}</Text>
            <Text style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>{pill.label}</Text>
          </RNPressable>
        ))}
      </Animated.View>

      <AttendeeSheet
        visible={sheetOpen}
        attendees={attendees}
        telephoneRequired={telephoneRequired}
        busy={busy}
        autoSelectIds={autoSelectIds}
        onClose={() => setSheetOpen(false)}
        onCreateNew={() => router.push('/person/new')}
        onConfirm={handleConfirm}
      />
    </>
  );
}
