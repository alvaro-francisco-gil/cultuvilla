import { Image, Linking, View } from 'react-native';
import { Text } from '../primitives/Text';
import { Pressable } from '../primitives/Pressable';
import { staticMapUrl, MAP_ZOOM_DEFAULT } from '@cultuvilla/shared/services/mapsService';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { useT } from '../../lib/i18n';
import { showConfirm } from '../../lib/dialogs';

/**
 * Read-only location slot: the static-map rectangle for a coordinate, its
 * saved name underneath, and a tap that offers to hand the coordinate to
 * Google Maps for directions. Shared by the village home and the place detail
 * screen so "where is this?" looks and behaves the same everywhere.
 *
 * Renders nothing when there is no coordinate — the caller doesn't need to
 * guard, and an unpinned entity simply has no location slot.
 */
export function LocationMap({
  coordinates,
  label,
  zoom = MAP_ZOOM_DEFAULT,
  testID,
}: {
  coordinates: LatLng | null;
  /** Saved name of the coordinate. Hidden when empty — never fall back to
   *  rendering the raw lat/lng at the user. */
  label?: string | null;
  zoom?: number;
  testID?: string;
}) {
  const { t } = useT();
  if (!coordinates) return null;

  const openDirections = () => {
    showConfirm(
      t('village.location.openMapsTitle'),
      '',
      () => {
        void Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`,
        ).catch(() => {
          /* best-effort */
        });
      },
      { confirmText: t('village.location.open') },
    );
  };

  return (
    <View>
      <Pressable
        onPress={openDirections}
        accessibilityLabel={t('village.location.openMapsTitle')}
        testID={testID}
      >
        <Image
          source={{
            uri: staticMapUrl(coordinates.lat, coordinates.lng, { zoom, w: 640, h: 256 }),
          }}
          style={{ width: '100%', aspectRatio: 2.5, borderRadius: 16 }}
          resizeMode="cover"
        />
        {label ? (
          <Text variant="bodySm" tone="muted" className="mt-1 text-right">
            {label}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
