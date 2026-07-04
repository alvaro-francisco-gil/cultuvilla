import ImageCropPicker from 'react-native-image-crop-picker';
import { getMessages } from '@cultuvilla/i18n';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { uriToBlob } from './uriToBlob';

/** Cropped output edge in px. Matches the web cropper's cap so both platforms
 * upload a ~1024px square avatar regardless of source resolution. */
const OUTPUT_SIZE = 1024;

// The native cropper's Android toolbar title. pickAndCropSquare runs imperatively
// (not inside a component) so it can't call useT(); read the one string straight
// from the es catalog. Deliberately NOT via lib/i18n — that module is mocked
// wholesale in component tests, so importing it here would break them on load.
function cropperToolbarTitle(): string | undefined {
  const messages = getMessages('es') as { imageCrop?: { title?: string } };
  return messages.imageCrop?.title;
}

function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'E_PICKER_CANCELLED'
  );
}

/**
 * Native square pick + crop. react-native-image-crop-picker opens the library and
 * hands straight to its cropper (uCrop on Android, TOCropViewController on iOS),
 * both of which allow pinch-zoom + pan inside a locked 1:1 frame — so the user can
 * trim any sub-section, even of an already-square source (which the OS editor
 * behind expo-image-picker's `allowsEditing` cannot do on Android). Returns null
 * when the user backs out of either the picker or the crop step.
 */
export async function pickAndCropSquare(): Promise<UploadableImage | null> {
  try {
    const image = await ImageCropPicker.openPicker({
      mediaType: 'photo',
      cropping: true,
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      compressImageQuality: 0.8,
      forceJpg: true,
      cropperCircleOverlay: false,
      cropperToolbarTitle: cropperToolbarTitle(),
    });
    const blob = await uriToBlob(image.path);
    return {
      blob,
      filename: image.filename ?? `upload-${Date.now()}.jpg`,
      contentType: image.mime ?? 'image/jpeg',
      previewUri: image.path,
    };
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
}

/** Web-only crop overlay host. Native provides the crop UI from the native module
 * itself, so there is nothing to mount here — a no-op keeps the root layout able
 * to render <CropperHost /> unconditionally across platforms. */
export function CropperHost(): null {
  return null;
}
