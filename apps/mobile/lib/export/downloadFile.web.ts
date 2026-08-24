import type { ExportFileData } from './exportFileTypes';

/**
 * Hand the browser a generated file. Web half of the platform split — Metro
 * resolves this file on the web target and `downloadFile.ts` on iOS/Android,
 * which is what keeps `expo-file-system` and `expo-sharing` out of the web
 * bundle entirely (a native module reaching the web export crashes it).
 *
 * Returns a promise it never needs — the anchor click is synchronous — so that
 * both halves of the split share one signature.
 */
export function downloadFile(
  data: ExportFileData,
  fileName: string,
  mimeType: string,
): Promise<void> {
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
  return Promise.resolve();
}
