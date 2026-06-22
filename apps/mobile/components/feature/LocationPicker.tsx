// apps/mobile/components/feature/LocationPicker.tsx
import { useEffect, useReducer } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { VStack, Text, Input, Button, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { showAlert } from '../../lib/dialogs';
import { geocodeSearch, staticMapUrl } from '@cultuvilla/shared/services/mapsService';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { initialLocationState, locationReducer } from './locationPickerState';

const ACCENT = '#bb5d3a';

export function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (c: LatLng | null) => void }) {
  const { t } = useT();
  const [state, dispatch] = useReducer(locationReducer, value, initialLocationState);

  // Push coord changes up to the parent form.
  useEffect(() => {
    onChange(state.coords);
    // onChange identity is stable enough for this controlled-ish usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.coords]);

  // Debounced geocoding whenever the query is non-empty.
  useEffect(() => {
    const q = state.query.trim();
    if (q === '') return;
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
  }, [state.query]);

  async function useMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('village.admin.community.locationPermissionDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      dispatch({ type: 'gpsResult', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
    } catch {
      showAlert(t('village.admin.community.locationGpsFailed'));
    }
  }

  return (
    <VStack gap={2}>
      <Text variant="h3">{t('village.admin.community.location')}</Text>
      <Input
        value={state.query}
        onChangeText={(query) => dispatch({ type: 'setQuery', query })}
        placeholder={t('village.admin.community.locationSearchPlaceholder')}
      />
      {state.status === 'searching' ? <ActivityIndicator color={ACCENT} /> : null}
      {state.status === 'error' ? (
        <Text tone="muted" variant="bodySm">{t('village.admin.community.locationSearchFailed')}</Text>
      ) : null}
      {state.results.map((place) => (
        <Pressable
          key={`${place.lat},${place.lng}`}
          onPress={() => dispatch({ type: 'pickResult', place })}
          className="py-2 border-b border-subtle flex-row items-center gap-2"
        >
          <Ionicons name="location-outline" size={16} color={ACCENT} />
          <Text variant="body" className="flex-1">{place.label}</Text>
        </Pressable>
      ))}
      <Button onPress={useMyLocation}>{t('village.admin.community.useMyLocation')}</Button>
      {state.coords ? (
        <View className="gap-2">
          <Image
            source={{ uri: staticMapUrl(state.coords.lat, state.coords.lng) }}
            style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 16 }}
            resizeMode="cover"
          />
          <Pressable onPress={() => dispatch({ type: 'clear' })} className="self-start flex-row items-center gap-1">
            <Ionicons name="close-circle-outline" size={16} color={ACCENT} />
            <Text style={{ color: ACCENT }} className="font-semibold">{t('village.admin.community.removeLocation')}</Text>
          </Pressable>
        </View>
      ) : null}
    </VStack>
  );
}
