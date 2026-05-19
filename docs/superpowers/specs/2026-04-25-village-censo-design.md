# Cultuvilla — Village Censo Design

## Overview

Each village (pueblo) has a **censo**: a profile form defined by the village coordinador. Members fill it once per village. Required censo fields gate event registration for that village.

The censo replaces the current generic signup with a per-pueblo profile that captures information the coordinador needs (barrio, residency type, household composition, etc.) without forcing it at account creation.

## Key concepts

- **Censo**: the village's profile form schema. One per village. Defined and managed only by the village coordinador.
- **Predefined field**: a field from a shared registry (stable key, default label, type). Coordinador picks which to enable.
- **Custom field**: a coordinador-defined field (label, key, type, required). Lives only on that village's censo.
- **Censo answers**: a user's responses to a village's censo, stored on their membership doc.
- **Lazy fill**: the censo is not required at signup. It can be filled any time from the user's profile, and is force-prompted on first event registration if any required fields are unanswered.

## Data model

### Village doc — added field

`villages/{villageId}` gains:

```ts
interface VillageProfileForm {
  fields: ProfileFormField[]   // ordered, append-only after first answer
  updatedAt: Timestamp
}

type ProfileFormField =
  | {
      source: "predefined"
      key: PredefinedFieldKey       // from registry
      label?: string                 // optional override of registry default
      required: boolean
    }
  | {
      source: "custom"
      key: string                    // auto-slugged from label, unique within village
      label: string
      type: FieldType
      options?: string[]             // for select / multiselect
      required: boolean
    }

type FieldType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "number" | "date"
```

The `profileForm` field is optional on the village doc — if absent, the village has no censo and event registration has no gate.

### Membership doc — added fields

`villages/{villageId}/members/{userId}` gains:

```ts
profileAnswers: Record<string, string | number | boolean | string[]>
profileCompletedAt: Timestamp | null   // set when all required fields are filled
```

Keys in `profileAnswers` correspond to either predefined keys (`barrio`, `residencyType`, …) or custom field keys. Predefined keys are stable across villages, enabling future cross-village queries on those fields.

### Predefined field registry (v1)

Lives in code at `packages/shared/src/models/village/profileFieldRegistry.ts`. Not stored in Firestore.

| Key | Type | Default label (es) | Notes |
|---|---|---|---|
| `barrio` | text | Barrio | Free text. UI offers autocomplete from prior answers in the same village. |
| `residencyType` | select | Tipo de residencia | Options: `permanente`, `veraneante`, `visitante` |
| `householdSize` | number | Personas en el hogar | Integer ≥ 1 |
| `hasMinors` | boolean | ¿Hay menores en el hogar? | |
| `arrivalYear` | number | Año de llegada al pueblo | |
| `originVillage` | text | Pueblo de origen | |

The registry is easy to extend: adding an entry makes it available to all villages.

## Flows

### 1. Coordinador defines the censo

UI at `/admin/village/[id]/censo` (a tab inside the existing village admin page).

- View the current censo as an ordered list of fields.
- **Add field** → modal with two tabs:
  - **From palette**: checkbox list of predefined fields not yet on this village's censo.
  - **Custom**: label, type, options (for select / multiselect), required toggle.
- **Edit field**: change label freely; toggle required; append (not remove) options on selects. Type and key are immutable.
- **Reorder** with up/down controls.
- **Remove field**: allowed only if zero members have answered it. Otherwise the row shows a 🔒 lock icon and the remove action is disabled with a tooltip ("No se puede eliminar — hay miembros que ya han respondido").

When the coordinador toggles a field to `required` and the village already has members, a confirmation warns: "X miembros tendrán que completar este campo antes de su próxima inscripción a un evento."

### 2. User joins a village (invite link)

The existing invite flow at `/invite/[token]`:

1. Validate token.
2. Sign in with Google (if not signed in).
3. Complete profile (`/complete-profile`) if new user. Existing flow, unchanged.
4. **Create the membership doc** at `villages/{vid}/members/{uid}` with `role: "user"`, `profileAnswers: {}`, `profileCompletedAt: null`, `joinedAt: now`.
5. Increment `inviteToken.usageCount`.
6. Redirect to the village page.

The censo is **not** prompted here. Lazy fill.

### 3. User fills the censo from their profile

`/profile` shows a section per village the user belongs to: "Tu perfil en [Pueblo]". The form renders dynamically from the village's `profileForm.fields`.

- Each field labeled with the field's `label` (override or registry default).
- Empty answers shown as "Sin responder" with an inline edit affordance.
- User can save partial answers — required fields can be left empty here.
- On save, `profileAnswers` is updated. If all required fields are filled, `profileCompletedAt` is set.

### 4. Event registration with censo gate

When a user clicks "Apuntarse" on an event in village V:

- **Client check**: read `village.profileForm` and the user's `member.profileAnswers`. If any field with `required: true` is unanswered (missing key or empty value), instead of registering, route to `/village/[id]/censo?return=event/[eventId]` with a banner: "Completa el censo de [Pueblo] antes de apuntarte." After saving the censo, the user is returned to the event and registration proceeds.
- **Server check** (Cloud Function on registration creation): re-validate. If required fields are still unanswered, reject the registration with a clear error code. This is the source of truth.

Villages with no `profileForm` (or `profileForm.fields` empty, or no required fields) have no gate — registration proceeds directly.

### 5. Editing answers

Users edit their own answers any time from `/profile`. No side effects, no re-prompting. If they clear a required field, they will be re-gated on the next event registration (correct behavior, same code path as initial fill).

### 6. Schema evolution

Append-only after first answer:

- **Add field**: always allowed. Existing members are not retroactively forced to fill it unless `required` is toggled on (in which case they will be gated on next event registration).
- **Remove field**: only allowed if zero answers exist for that key in the village's `members` collection. Once any member has answered, the field is permanent.
- **Edit field**:
  - Label: always editable.
  - `required`: toggleable in both directions. Toggling on warns about retro-gating.
  - Options (select / multiselect): can append new options; cannot remove an option that any member has selected.
  - Type and key: immutable once defined.

These rules are enforced in three places:

1. The admin form-builder UI (disable / warn).
2. A Cloud Function `validateCensoUpdate` triggered on writes to `village.profileForm`, which compares the previous and new schema and rejects illegal transitions.
3. Best-effort security rules: ensure `profileForm.fields` only grows or modifies allowed properties (label, required, options append). The Cloud Function is the authoritative validator.

## Security rules (summary)

```
villages/{vid}/members/{uid}
  read:   request.auth != null AND (
            request.auth.uid == uid                                       // self
            OR exists(/members/$(request.auth.uid))                       // co-member
            OR village.adminUserId == request.auth.uid                    // admin
          )
  create: invite-flow path only (existing rule, unchanged)
  update: self may update profileAnswers / profileCompletedAt;
          admin may update role
  delete: self or admin

villages/{vid}.profileForm
  read:  same as the parent village doc (publicly readable). The schema is
         not sensitive — only members' answers are gated.
  write: only village admin; structural changes validated by Cloud Function
```

The "censo is filled" check for event registration is enforced by Cloud Function, not rules.

## File map

### New

```
packages/shared/src/models/village/profileFieldRegistry.ts
packages/shared/src/models/village/CensoTypes.ts
packages/shared/src/services/censoService.ts
packages/shared/src/services/membershipProfileService.ts

apps/web/app/admin/village/[id]/censo/page.tsx
apps/web/components/admin/CensoFieldEditor.tsx
apps/web/components/admin/CensoFieldList.tsx
apps/web/components/admin/AddCensoFieldDialog.tsx
apps/web/components/profile/CensoFormRenderer.tsx
apps/web/components/profile/VillageCensoSection.tsx

functions/src/censoValidation.ts            # schema-evolution guardrail
functions/src/registrationCensoGate.ts      # registration gate (or extend existing registration trigger)
```

### Modified

```
packages/shared/src/models/village/VillageDataModel.ts            # add profileForm
packages/shared/src/models/village/VillageMemberDataModel.ts      # add profileAnswers, profileCompletedAt
apps/web/app/profile/page.tsx                                     # render VillageCensoSection per village
apps/web/app/invite/[token]/page.tsx                              # no censo prompt; just create membership
apps/web/components/event/<registration-button>                    # client-side gate + redirect to censo
firestore.rules                                                   # rules for profileForm + profileAnswers
firestore.indexes.json                                            # if any new queries need indexing
```

## Testing approach

- **Unit (shared package)**:
  - `profileFieldRegistry`: registry shape, key uniqueness.
  - `censoService.validateSchemaTransition(prev, next, answersByField)`: legal vs illegal mutations.
  - `membershipProfileService.isCensoComplete(form, answers)`: required-fields-filled check.
- **Cloud Functions**:
  - `validateCensoUpdate`: rejects field type changes, key changes, removal of answered fields, removal of selected options.
  - Registration trigger: rejects registration when required fields unanswered; allows when complete or when village has no censo.
- **End-to-end (manual or Playwright)**:
  - Coordinador creates censo with predefined + custom fields.
  - User joins via invite, no censo prompt.
  - User attempts event registration → redirected to censo → fills required fields → registration proceeds.
  - User edits answers from profile.
  - Coordinador adds a required field; existing member is re-gated on next registration.
  - Coordinador attempts to remove an answered field → blocked.

## Out of scope (deferred)

- **Per-event extra fields**: events asking for information beyond the village censo. Separate spec.
- **Per-user visibility opt-out**: a member hiding their own answers from other villagers. Not added unless requested.
- **Public visibility for non-members**: censo answers are visible only to authenticated villagers in the same pueblo. Public browsing of villages does not include member profiles.
- **Cross-village reporting** on predefined fields: technically supported by stable keys, but no admin UI ships in v1.
- **i18n of custom field labels**: custom labels are stored as a single string. Predefined registry labels are Spanish-only for now (matches the project's Spanish-only direction).
