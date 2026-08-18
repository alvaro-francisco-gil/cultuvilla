import { isWeb } from '../platform';

/**
 * Hand the browser a generated file. Web-only by design: the native apps are
 * not released yet (see AGENTS.md "Versioning & releases") and saving/sharing
 * on iOS/Android would need expo-file-system + expo-sharing, which we don't
 * ship. Callers gate their UI on {@link canDownloadFile} rather than relying on
 * this throwing.
 */
export const canDownloadFile = isWeb;

export function downloadFile(data: BlobPart, fileName: string, mimeType: string): void {
  if (!isWeb) throw new Error('downloadFile is only available on the web build');

  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  // Safari ignores a click on a node that isn't in the document.
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoking synchronously cancels the download in Firefox; defer a tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
