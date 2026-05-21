import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

/**
 * Opens the device image library and returns the selected image as an
 * UploadableImage (blob + filename + contentType) compatible with
 * imageService.uploadPersonImage / uploadMunicipalityImage.
 *
 * Returns null if the user cancels or no asset is available.
 */
export async function pickImageAsBlob(): Promise<UploadableImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  const filename = asset.fileName ?? `upload-${Date.now()}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';
  return { blob, filename, contentType };
}
