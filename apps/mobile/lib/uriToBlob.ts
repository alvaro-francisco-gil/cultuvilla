import { Platform } from 'react-native';

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
export async function uriToBlob(uri: string): Promise<Blob> {
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
