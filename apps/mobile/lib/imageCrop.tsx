import * as ImagePicker from 'expo-image-picker';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { uriToBlob } from './uriToBlob';

/**
 * Native square pick + crop (the default impl; web overrides it in
 * imageCrop.web.tsx). Uses expo-image-picker's built-in OS crop editor
 * (`allowsEditing` + a locked 1:1 aspect) — the same approach as the sibling
 * ordago-apps repo. The native editor lets the user pinch/pan to a square before
 * returning. Returns null when the user cancels the picker or the crop step.
 *
 * (Web can't use `allowsEditing` — it's a no-op there — so it gets its own
 * react-easy-crop overlay in imageCrop.web.tsx.)
 */
export async function pickAndCropSquare(): Promise<UploadableImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await uriToBlob(asset.uri);
  return {
    blob,
    filename: asset.fileName ?? `upload-${Date.now()}.jpg`,
    contentType: asset.mimeType ?? 'image/jpeg',
    previewUri: asset.uri,
  };
}

/** Web-only crop overlay host. Native uses the OS crop editor above, so there is
 * nothing to mount here — a no-op keeps the root layout able to render
 * <CropperHost /> unconditionally across platforms. */
export function CropperHost(): null {
  return null;
}
