import { useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '@cultuvilla/shared/design-system';
import { geocodeSearch, staticMapUrl, MAP_ZOOM_DEFAULT } from '@cultuvilla/shared/services/mapsService';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { VStack, Text, Button, Pressable, FieldLabel } from '../primitives';
import { useT } from '../../lib/i18n';
import { showAlert } from '../../lib/dialogs';
import { initialLocationState, locationReducer, coordLabel } from './locationPickerState';

const ACCENT = colors.light.fg.accent;
const MAP_ZOOM = MAP_ZOOM_DEFAULT ?? 15;

/** Best-effort reverse geocode via the device geocoder (native only). */
async function reverseGeocode(coords: LatLng): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    if (a) {
      const line = [a.street ?? a.name, a.city ?? a.subregion].filter(Boolean).join(', ');
      if (line) return line;
    }
  } catch {
    /* unsupported (e.g. web) or no match — fall through */
  }
  return coordLabel(coords);
}

/**
 * Trigger + full-screen modal for choosing an event's location. The modal
 * replicates the ordago-apps LocationPicker layout — a search field up top, a
 * map preview of the selection, a "use my location" action, and a bottom
 * confirmation panel — but stays on the cultuvilla web-safe stack: the
 * server-side `geocodeSearch` proxy + a `staticMap` image (no client Google key
 * and no interactive `react-native-maps`, which doesn't run on the villa-events
 * web build). GPS picks are reverse-geocoded to a human address rather than raw
 * coordinates. Colors follow the app accent.
 */
export function EventLocationField({
  value,
  displayName,
  onChange,
  label,
}: {
  value: LatLng | null;
  displayName: string;
  /** Fired on confirm with the chosen coordinates and its address label. */
  onChange: (coords: LatLng, address: string) => void;
  label?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(locationReducer, value, initialLocationState);
  const [locating, setLocating] = useState(false);

  // Debounced geocoding while the user types a (non-committed) query.
  useEffect(() => {
    if (!open) return;
    const q = state.query.trim();
    if (q === '' || state.selected) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const results = await geocodeSearch(q);
        if (!cancelled) dispatch({ type: 'resultsLoaded', results });
      } catch {
        if (!cancelled) dispatch({ type: 'searchFailed' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, state.query, state.selected]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('village.admin.community.locationPermissionDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      dispatch({ type: 'gpsResult', coords });
      const label = await reverseGeocode(coords);
      dispatch({ type: 'resolvedAddress', label });
    } catch {
      showAlert(t('village.admin.community.locationGpsFailed'));
    } finally {
      setLocating(false);
    }
  }

  function confirm() {
    if (!state.coords) return;
    onChange(state.coords, state.query.trim());
    setOpen(false);
  }

  const triggerText = displayName || t('event.selectLocation');

  return (
    <View>
      <FieldLabel>{label ?? t('event.location')}</FieldLabel>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={styles.trigger}>
        <View style={styles.triggerInner}>
          <Ionicons name="location-outline" size={18} color={ACCENT} />
          <Text numberOfLines={1} tone={displayName ? 'primary' : 'muted'} style={styles.triggerText}>
            {triggerText}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748b" />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          {/* Header + search */}
          <View style={styles.header}>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.back')} hitSlop={8} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#334155" />
            </Pressable>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color="#94a3b8" />
              <TextInput
                value={state.query}
                onChangeText={(query) => dispatch({ type: 'setQuery', query })}
                placeholder={t('event.searchLocationPlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                autoCapitalize="none"
                autoFocus
              />
              {state.query !== '' ? (
                <Pressable onPress={() => dispatch({ type: 'clear' })} accessibilityLabel={t('village.admin.community.removeLocation')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={ACCENT} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Results while searching, otherwise the map preview of the pick */}
          {state.results.length > 0 || state.status !== 'idle' ? (
            <View style={styles.results}>
              {state.status === 'searching' ? <ActivityIndicator color={ACCENT} style={{ marginTop: 12 }} /> : null}
              {state.status === 'error' ? (
                <Text tone="muted" style={styles.pad}>{t('village.admin.community.locationSearchFailed')}</Text>
              ) : null}
              <FlatList
                data={state.results}
                keyExtractor={(p) => `${p.lat},${p.lng}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable onPress={() => dispatch({ type: 'pickResult', place: item })} style={styles.resultRow}>
                    <Ionicons name="location-outline" size={18} color={ACCENT} />
                    <Text style={styles.resultText}>{item.label}</Text>
                  </Pressable>
                )}
              />
            </View>
          ) : (
            <View style={styles.mapArea}>
              {state.coords ? (
                <View style={styles.mapWrap}>
                  <Image
                    source={{ uri: staticMapUrl(state.coords.lat, state.coords.lng, { zoom: MAP_ZOOM, w: 640, h: 640 }) }}
                    style={styles.mapImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                  {/* Center pin marking the selected coordinate. */}
                  <View style={styles.mapPin} pointerEvents="none">
                    <Ionicons name="location" size={40} color={ACCENT} />
                  </View>
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={40} color="#cbd5e1" />
                  <Text tone="muted">{t('event.noLocationYet')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Bottom panel */}
          <View style={styles.bottomPanel}>
            <Button variant="secondary" onPress={useMyLocation} loading={locating}>
              {t('event.useMyLocation')}
            </Button>
            <VStack gap={1} className="mt-1">
              <Text variant="caption" tone="muted" style={styles.panelLabel}>{t('event.selectedLocation')}</Text>
              <Text numberOfLines={2} style={styles.panelAddress}>
                {state.coords ? (state.query || t('event.selectedLocation')) : t('event.noLocationYet')}
              </Text>
            </VStack>
            <Button onPress={confirm} disabled={!state.coords} fullWidth>
              {t('event.confirmLocation')}
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: '#ffffff',
  },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  triggerText: { flexShrink: 1 },
  modal: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  results: { flex: 1, paddingHorizontal: 16 },
  pad: { paddingVertical: 12 },
  mapArea: { flex: 1, padding: 16 },
  mapWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef2f7' },
  mapImage: { width: '100%', height: '100%' },
  mapPin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // The pin's tip sits at the visual center; nudge up by half its height.
    paddingBottom: 40,
  },
  mapPlaceholder: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  resultText: { flex: 1 },
  bottomPanel: {
    gap: 10,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  panelLabel: { textTransform: 'uppercase' },
  panelAddress: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
});
