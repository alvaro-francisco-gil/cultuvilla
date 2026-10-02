/**
 * The web build reads a Wrapped; it does not share its images. Sharing a card
 * as a file is an app action (docs/decisions/web-is-a-read-site.md) — this half
 * exists only so `expo-file-system` never reaches the web bundle.
 */
export const canShareCardImage = false;

export function shareCardImage(): Promise<void> {
  return Promise.reject(new Error('Sharing a card image is app-only'));
}
