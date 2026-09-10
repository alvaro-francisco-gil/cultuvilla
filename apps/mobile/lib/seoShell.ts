/**
 * Native no-op. On iOS/Android there is no server-rendered shell to dismiss —
 * `ogRenderer` only ever serves the web build. The seam exists on both targets
 * so detail screens can call it unconditionally.
 *
 * See `seoShell.web.ts` for the real implementation and the reasoning.
 */
export function dismissSeoShell(): void {}
