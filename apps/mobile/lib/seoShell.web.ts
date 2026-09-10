/**
 * Remove the server-rendered content block that `ogRenderer` injects before
 * `#root` on share-link routes (`/event/*`, `/news/*`, `/village/*`, `/o/*`).
 *
 * Why the app owns the removal rather than React clearing it: the block sits
 * *outside* `#root` precisely so React's first commit cannot destroy it. If it
 * disappeared when the app mounted, the visitor would see content → spinner →
 * content, which is worse than the blank-then-content they get today. Calling
 * this only once a screen actually has its data gives content → content, and
 * makes the server render a genuine first paint rather than a crawler trick.
 *
 * Idempotent and safe to call from any screen: a route the renderer never
 * touched simply has no block to remove.
 */
export function dismissSeoShell(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('seo-content')?.remove();
}
