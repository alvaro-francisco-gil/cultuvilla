import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { uriToBlob } from './uriToBlob';
import { pickAndCropSquare } from './imageCrop';

export interface PickImageOptions {
  /**
   * Route the pick through the in-app square cropper (avatars, escudos) so the
   * user pans/zooms to a 1:1 sub-section before upload. See lib/imageCrop.* —
   * native uses react-native-image-crop-picker, web uses react-easy-crop. This
   * replaces the OS editor, which can't sub-crop an already-square image on
   * Android and is a no-op on web.
   */
  square?: boolean;
}

/**
 * Opens the device image library and returns the selected image as an
 * UploadableImage (blob + filename + contentType) compatible with
 * imageService.uploadPersonImage / uploadMunicipalityImage.
 *
 * With `{ square: true }` the pick is handed to the in-app square cropper
 * ({@link pickAndCropSquare}); otherwise the full asset is returned as-is.
 *
 * Returns null if the user cancels or no asset is available.
 */
export async function pickImageAsBlob(
  options: PickImageOptions = {},
): Promise<UploadableImage | null> {
  if (options.square) return pickAndCropSquare();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await uriToBlob(asset.uri);
  const filename = asset.fileName ?? `upload-${Date.now()}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';
  return { blob, filename, contentType, previewUri: asset.uri };
}

/** An {@link UploadableImage} that also carries the picked asset's pixel size,
 *  needed by news image blocks so they render at the right aspect ratio. */
export interface SizedUploadableImage extends UploadableImage {
  width: number;
  height: number;
}

/**
 * Like {@link pickImageAsBlob} but also returns the asset's intrinsic
 * width/height. Used by the news block editor, where each inline image persists
 * its dimensions so the reader can lay it out without a network round-trip.
 */
export async function pickImageWithSize(): Promise<SizedUploadableImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await uriToBlob(asset.uri);
  return {
    blob,
    filename: asset.fileName ?? `upload-${Date.now()}.jpg`,
    contentType: asset.mimeType ?? 'image/jpeg',
    previewUri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}
