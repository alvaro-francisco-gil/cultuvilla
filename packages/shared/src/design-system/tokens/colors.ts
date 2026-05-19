/**
 * Semantic color tokens, keyed by mode and by Tailwind utility family
 * (`bg`, `fg`, `border`). Light mode is the only shipped mode today —
 * `dark` will be added by mapping the same semantic keys to different
 * raw values, so screens never reach for raw colors and dark mode is a
 * switch, not a sweep.
 *
 * The `bg` / `fg` / `border` split mirrors the Tailwind utility families
 * we extend in `apps/web/tailwind.config.ts`: `bg.X` is what
 * `theme.extend.backgroundColor.X` consumes (producing `bg-X` classes),
 * `fg.X` produces `text-X`, `border.X` produces `border-X`. That keeps
 * class names crisp (`bg-surface`, `text-primary`) instead of
 * doubly-namespaced (`bg-surface`).
 *
 * Naming rule: tokens describe *intent* (surface, on-accent, muted),
 * not appearance (gray-100, slate-900). Never expose raw palette names
 * outside this file. Keys use kebab-case so they survive into Tailwind
 * class generation unchanged.
 */
const light = {
  bg: {
    surface: '#ffffff',
    'surface-elevated': '#f9fafb',
    subtle: '#f3f4f6',
    accent: '#2563eb',
    danger: '#dc2626',
    'danger-subtle': '#fef2f2',
    success: '#16a34a',
    'success-subtle': '#f0fdf4',
  },
  fg: {
    primary: '#0f172a',
    muted: '#64748b',
    'on-accent': '#ffffff',
    'on-danger': '#ffffff',
    'on-success': '#ffffff',
    accent: '#2563eb',
    danger: '#dc2626',
    success: '#16a34a',
  },
  border: {
    subtle: '#e5e7eb',
    strong: '#cbd5e1',
    accent: '#2563eb',
    danger: '#dc2626',
  },
} as const;

export const colors = { light } as const;

export type ColorMode = keyof typeof colors;
