# Missing screens after `apps/web` deletion

**Status:** active backlog
**Created:** 2026-05-24
**Context:** original platform design — retired (recover via `git log -- docs/superpowers/specs/2026-04-05-cultuvilla-design.md`)

On 2026-05-24 the Next.js web app at `apps/web/` was deleted. Cultuvilla is now app-first: a single Expo + React Native codebase (`apps/mobile/`) renders to iOS, Android, and the web (via React Native Web + `expo export --platform web`).

`packages/shared/` (business logic, types, services), `functions/` (Cloud Functions), and Firestore rules/indexes are untouched. Only UI was removed.

The mobile app already covers most screens. The list below is what the deleted web app had that the mobile app does **not** yet have. Each must be rebuilt in `apps/mobile/app/` as a React Native screen.

## Missing screens to rebuild

| Old web route | Purpose | Used by | Priority |
|---|---|---|---|
| `/notifications` | Notifications list (event reminders, invites, organizer approvals, etc.) | Any authenticated user | High |
| `/my-signups` | List of events the current user has signed up for (self + personas) | Authenticated user | High |
| `/invite/[token]` | Accept a village invite via deep link | Anyone with a link | High — invite links break without this |
| `/profile/persons` | Manage personas (proxy profiles for family members) | Authenticated user | Medium |
| `/org/[orgId]/events/new` | Create a new event under an organization | Org member | Medium |
| `/org/[orgId]/events/[eventId]/edit` | Edit / cancel an existing event | Org member | Medium |
| `/org/[orgId]` | Organization profile / dashboard | Org member, village member | Medium |
| `/village/[id]/admin` | Village admin dashboard (invites, org requests, info) | Village admin | Medium |
| `/village/[id]/admin/censo` | Edit village censo schema | Village admin | Low |
| `/village/[id]/censo` | Resident-facing censo display (the **admin/edit** form is above; the read view lives at the village page in mobile, so this may already be covered — verify) | Village member | Low |
| `/admin` (superadmin home) | Superadmin landing | Superadmin | Low |
| `/admin/municipalities` + `/admin/municipalities/[id]` | Manage municipalities (create, edit, barrios, cemeteries) | Superadmin | Low |
| `/admin/occupations` | Manage occupation taxonomy | Superadmin | Low |
| `/admin/organizer-requests` | Approve/reject org creation requests | Superadmin | Low |
| `/complete-profile` (web variant) | Profile completion step | New users | **Already covered** by `app/(onboarding)/complete-profile.tsx` — keep an eye on parity if any field drifts |
| `/event/[eventId]` (web variant) | Event detail page | Anyone | **Already covered** by `app/event/[eventId].tsx` — parity check only |

## Notes for rebuilding

- **Source the old UI from git history.** `git log --all -- apps/web/app/notifications/page.tsx` finds the deleted file; `git show <sha>:apps/web/app/notifications/page.tsx` prints it. Reference the markup/flow, but rewrite for React Native primitives (no `<div>`, use `View`/`Text`/`Pressable`).
- **All business logic already exists** in `packages/shared/src/services/`. Look there first — every web screen used the same hooks via context wrappers. Mobile screens reuse the same services directly.
- **The `useT()` adapter in mobile** consumes the same `packages/i18n` catalogs that web's `next-intl` did. Strings can be reused; only the call site changes.
- Follow the [`touch-service`](../../.claude/skills/touch-service/SKILL.md), [`add-firestore-collection`](../../.claude/skills/add-firestore-collection/SKILL.md), and [`guardrail-enforcement`](../../.claude/skills/guardrail-enforcement/SKILL.md) skills when the rebuild touches services, new collections, or auth-sensitive writes.

## Superadmin-flow caveat

The `/admin/*` superadmin pages (municipalities, occupations, organizer-requests) were designed for desktop forms. On a small phone screen these are awkward. Two reasonable paths:

1. **Build them anyway in RN** — they'll display fine in a browser via RN-Web and acceptably (if cramped) on a phone.
2. **Keep a tiny separate admin web app later** — e.g. a small Next.js or Vite SPA under `apps/admin/` purely for superadmin tasks. Reuse `@cultuvilla/shared` services. Defer until the first superadmin task actually hurts to do in RN.

Pick (2) only when (1) becomes annoying in practice. Don't pre-build a separate app.
