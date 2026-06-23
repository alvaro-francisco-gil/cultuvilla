import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export interface PickImageOptions {
  /**
   * Force a 1:1 crop step in the native editor before returning. Use for
   * square targets (escudos, avatars) so the stored image fills a square
   * frame without letterboxing.
   */
  square?: boolean;
}

/**
 * Opens the device image library and returns the selected image as an
 * UploadableImage (blob + filename + contentType) compatible with
 * imageService.uploadPersonImage / uploadMunicipalityImage.
 *
 * With `{ square: true }` the native editor opens with a locked 1:1 aspect
 * ratio, so the user crops to a square before it's uploaded.
 *
 * Returns null if the user cancels or no asset is available.
 */
export async function pickImageAsBlob(
  options: PickImageOptions = {},
): Promise<UploadableImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: options.square ?? false,
    aspect: options.square ? [1, 1] : undefined,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  const filename = asset.fileName ?? `upload-${Date.now()}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';
  return { blob, filename, contentType, previewUri: asset.uri };
}
