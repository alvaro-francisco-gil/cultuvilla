import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

/**
 * Reads a picked-asset URI into a Blob suitable for Firebase `uploadBytes`.
 *
 * On native we MUST use XMLHttpRequest, not `fetch`. Expo SDK 56 overrides the
 * global `fetch` with its winter polyfill, whose `.blob()` reads the body as an
 * ArrayBuffer and then tries to construct a RN Blob from it — and RN's
 * BlobManager throws "Creating blobs from 'ArrayBuffer' ... are not supported".
 * XHR with `responseType: 'blob'` yields a native-backed Blob that uploadBytes
 * accepts. On web the real browser `fetch().blob()` works, so we keep it there.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.blob();
  }
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

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
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: options.square ?? false,
    aspect: options.square ? [1, 1] : undefined,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await uriToBlob(asset.uri);
  const filename = asset.fileName ?? `upload-${Date.now()}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';
  return { blob, filename, contentType, previewUri: asset.uri };
}
