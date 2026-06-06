# "Pueblo no registrado" state in the village tab — design

Status: Draft
Date: 2026-06-06

## Problem

A user's active pueblo (`activeMunicipalityId` on their `users` profile) can point at a
municipality whose community has not been activated (`communityActive: false`,
`community: null`). The `VillagePicker` on the register / complete-profile screen searches the
full INE municipality catalog via `searchMunicipalities()` with no `communityActive` filter, so
this is an expected, allowed state — not a bug.

The gap is in the village tab. When `activeMunicipalityId` resolves to an inactive municipality,
`apps/mobile/app/(tabs)/village.tsx` still renders the full hub grid (Eventos / Organizaciones /
Censo / Anuncios), pointing at content that does not exist. Instead the tab should explain that
the pueblo is not on the platform yet and invite the user to become its administrator.

## Scope

One screen change plus new i18n strings. **No new backend.** The flow reuses existing pieces:

- Cloud Function `requestOrganizeVillage` (`functions/src/village/requestOrganizeVillage.ts`) —
  validates the municipality is not already active, rejects duplicate pending requests, creates an
  `organizerRequests` doc, notifies admins.
- Screen `/discover/request-organizer/[municipalityId]`
  (`apps/mobile/app/discover/request-organizer/[municipalityId].tsx`) — motivation input + submit.
- Service `getMyOrganizerRequests(userId)` (`packages/shared/src/services/organizerRequestService.ts`)
  — returns the user's organizer requests; we filter to the active municipality + `status === 'pending'`.

Out of scope: the register-screen picker still allows selecting any municipality (confirmed
intentional). Birth-place (`birthPlace`) behavior is unchanged — it is biographical data only.

## Change 1 — `village.tsx`

### Data loading
Extend the existing `loadVillage` callback so it also fetches the user's pending organizer request
for the active municipality, in the same `Promise.all` as `getMunicipality` / `isVillageAdmin`:

- When `user` is present, call `getMyOrganizerRequests(user.uid)` and derive a boolean
  `pendingOrganizerRequest = requests.some(r => r.municipalityId === activeMunicipalityId && r.status === 'pending')`.
- Store it in new state `pendingOrganizerRequest: boolean`, reset to `false` when there is no
  `activeMunicipalityId`, and refreshed on focus like the rest of `loadVillage`.
- Wrap the call in `withFirestoreErrorLog('village:getMyOrganizerRequests', ...)` to match the
  existing instrumentation.

### Rendering
After `village` has loaded (the existing `if (!village)` spinner guard), add a branch:

```
if (!village.communityActive) {
  // render the "not registered" state
}
```

The not-registered state is a centered layout (no hub `FlatList`, no admin settings slot) with:

- `AppHeader` with `centerLabel={village.name}` (consistent with the active hub header).
- Escudo + name + province header block (same treatment as the active hub's `ListHeaderComponent`).
- Body text: `t('village.notRegistered.body')`.
- CTA line: `t('village.notRegistered.cta')` ("¿Te gustaría serlo?").
- If `pendingOrganizerRequest` is `false`: a primary `Button` labelled
  `t('village.notRegistered.button')` that calls
  `router.push('/discover/request-organizer/[municipalityId]')` with
  `params: { municipalityId: village.id }`.
- If `pendingOrganizerRequest` is `true`: replace the button with muted text
  `t('village.notRegistered.pending')` ("Tu solicitud está pendiente de revisión"). No button.

The active-community path (hub grid, admin settings slot) is unchanged and only runs when
`village.communityActive === true`.

## Change 2 — i18n strings

Add a `notRegistered` block under the existing `village` namespace in
`packages/i18n/messages/es.json` (single-locale project — `es.json` only):

```json
"notRegistered": {
  "body": "Este pueblo aún no está registrado en Cultuvilla. Para que forme parte necesitamos un administrador que active la comunidad y gestione sus eventos, organizaciones y vecinos.",
  "cta": "¿Te gustaría serlo?",
  "button": "Quiero ser administrador",
  "pending": "Tu solicitud está pendiente de revisión"
}
```

## Testing

Add `apps/mobile/app/(tabs)/__tests__/village.test.tsx` (none exists today). Mock `useAuth`,
`useT`, `useIsAppAdmin`, and the shared services (`getMunicipality`, `isVillageAdmin`,
`getMyOrganizerRequests`). Assert three cases:

1. Active community (`communityActive: true`) → hub actions render (e.g. "Eventos").
2. Inactive community + no pending request → body text + "Quiero ser administrador" button render;
   hub actions do not.
3. Inactive community + pending organizer request → "Tu solicitud está pendiente de revisión"
   renders; the button does not.

## Files touched

- `apps/mobile/app/(tabs)/village.tsx` — branch + pending-request fetch.
- `packages/i18n/messages/es.json` — `village.notRegistered.*` strings.
- `apps/mobile/app/(tabs)/__tests__/village.test.tsx` — new test file.
