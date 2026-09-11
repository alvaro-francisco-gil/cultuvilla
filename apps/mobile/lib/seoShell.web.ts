import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { parseAppPath } from '@cultuvilla/shared/utils';

/**
 * Remove the server-rendered content block that `ogRenderer` injects before
 * `#root` on share-link routes (`/<pueblo>` and its evento/noticia/entidad pages).
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

/**
 * Routes whose screens dismiss the block themselves once loaded — the entity
 * detail scaffold and the village home. The village tab counts too: a cold
 * `/<pueblo>` link lands there after its redirect (route groups are stripped
 * from the pathname).
 */
function isSelfDismissing(pathname: string): boolean {
  if (pathname.startsWith('/mi-pueblo')) return true;
  const route = parseAppPath(pathname);
  return route?.type === 'village' || route?.type === 'entity';
}

/** Past this, the block goes regardless: a stuck overlay is worse than a spinner. */
export const SEO_SHELL_FAILSAFE_MS = 8000;

/**
 * The safety net for the hand-over, mounted once in the root layout.
 *
 * The block is a full-viewport overlay, so if nothing removes it the visitor
 * cannot use the app at all. The screens above remove it when their data
 * lands, but the root layout can route a visitor somewhere else first — an auth
 * or onboarding redirect, a resumed intent — and none of those screens know the
 * block exists. So: dismiss the moment the route leaves the self-dismissing
 * set, and unconditionally after a timeout.
 */
export function useSeoShellFailsafe(): void {
  const pathname = usePathname();

  useEffect(() => {
    const timer = setTimeout(dismissSeoShell, SEO_SHELL_FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSelfDismissing(pathname)) dismissSeoShell();
  }, [pathname]);
}
