import { useState, type ReactNode } from 'react';
import { Pressable as RNPressable, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../../lib/i18n';
import { ImageLightbox } from './ImageLightbox';

/**
 * Makes any rendered image open full screen, zoomable, when tapped.
 *
 * Wraps the image the screen already renders rather than replacing it, so the
 * layout, cropping and variant choice of the surrounding surface are untouched
 * — this only adds the tap target and the viewer. `uri` is the image to show in
 * the viewer, which is normally the same source the child renders.
 *
 * Pinch is deliberately NOT wired in place: a two-finger gesture inside a
 * scrolling detail screen fights the ScrollView. Zoom lives in the viewer.
 */
export type ZoomableImageProps = {
  /** Image to open in the viewer. `null` renders the child with no tap target. */
  uri: string | null;
  children: ReactNode;
  /** Describes the picture, e.g. the event's title. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
};

export function ZoomableImage({
  uri,
  children,
  accessibilityLabel,
  style,
  className,
  testID,
}: ZoomableImageProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  if (!uri) return <>{children}</>;

  return (
    <>
      <RNPressable
        onPress={() => { setOpen(true); }}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel ?? t('common.imageViewer.open')}
        accessibilityHint={t('common.imageViewer.hint')}
        style={style}
        className={className}
        testID={testID ?? 'zoomable-image'}
      >
        {children}
      </RNPressable>
      {/* Mounted only while open: a screen can hold dozens of these wrappers,
          and each idle viewer would otherwise carry a Modal and four animated
          values for a picture nobody has tapped. */}
      {open ? (
        <ImageLightbox
          uri={uri}
          visible
          onClose={() => { setOpen(false); }}
          closeLabel={t('common.imageViewer.close')}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </>
  );
}
