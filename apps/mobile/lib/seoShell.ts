/**
 * Native no-ops. On iOS/Android there is no server-rendered shell to dismiss —
 * `ogRenderer` only ever serves the web build. The seam exists on both targets
 * so screens and the root layout can call it unconditionally.
 *
 * See `seoShell.web.ts` for the real implementation and the reasoning.
 */
export function dismissSeoShell(): void {}

export function useSeoShellFailsafe(): void {}
