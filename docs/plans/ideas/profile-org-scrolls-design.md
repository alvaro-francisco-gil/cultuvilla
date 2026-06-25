# Profile org scrolls — Asociaciones & Peñas

## Goal

On the profile tab, surface the organizations the signed-in user belongs to in
their **active village**, split into two horizontal card scrolls that copy the
village home UI:

- **Grupos** — every membership whose org `type !== 'peña'`
  (asociación + ayuntamiento + otros), so no membership ever disappears.
- **Peñas** — memberships whose org `type === 'peña'`.

This also carries an **app-wide relabel** of the existing village term
"Agrupaciones" → "Grupos" (see the i18n section).

This replaces today's single, easily-missed combined "Organizaciones" vertical
list (it only renders when the user belongs to ≥1 org, so a user with no
memberships never sees it at all).

## Why copy the village UI

The village home (`apps/mobile/components/feature/VillageHomeBody.tsx:462-500`)
already renders exactly this split using two reusable primitives:

- `Section` (`apps/mobile/components/feature/VillageSections.tsx`) — a titled
  block whose body is a horizontal `ScrollView`. When given no `onAdd`, an empty
  section renders a muted empty label (no trailing add-card).
- `EntityCard` — the image-forward "big card" (image or icon fallback, label,
  optional sub-line).

Reusing them gives pixel-identical cards/scrolls with no new components.

## Scope

### Data (`apps/mobile/app/(tabs)/profile.tsx`)

`OrgListItem` / the `orgs` state currently carries only `{ id, name }`. Extend
the items the screen holds to include the fields the cards need:

```ts
type OrgScrollItem = {
  id: string;
  name: string;
  type: OrganizationType;   // from @cultuvilla/shared/models/organization
  imageURL: string | null;
  role: string;             // membership role, already loaded
};
```

In `load()`, the existing membership filter (profile.tsx:115-137) already has
the `munOrgs` docs and the user's `memberships`. Keep `type`, `imageURL`, and
the membership `role` when mapping the member orgs into state. No new service
calls.

### Render (`apps/mobile/app/(tabs)/profile.tsx`)

Replace the current combined block (profile.tsx:289-298) with two `Section`s,
modelled on VillageHomeBody:462-500:

```tsx
const asociaciones = orgs.filter((o) => o.type !== 'peña');
const penas = orgs.filter((o) => o.type === 'peña');

<Section
  title={t('profile.gruposSection.title')}
  isEmpty={asociaciones.length === 0}
  emptyLabel={t('profile.gruposSection.empty')}
>
  {asociaciones.map((o) => (
    <EntityCard
      key={o.id}
      label={o.name}
      sub={o.role}
      icon="business-outline"
      imageUri={o.imageURL}
      onPress={() => router.push(`/o/${o.id}` as never)}
    />
  ))}
</Section>

<Section
  title={t('profile.peñasSection.title')}
  isEmpty={penas.length === 0}
  emptyLabel={t('profile.peñasSection.empty')}
>
  {penas.map((o) => (
    <EntityCard
      key={o.id}
      label={o.name}
      sub={o.role}
      icon="people-circle-outline"
      imageUri={o.imageURL}
      onPress={() => router.push(`/o/${o.id}` as never)}
    />
  ))}
</Section>
```

Notes:
- **No `onAdd`** — this is a personal "what I belong to" view, not the village
  directory, so no trailing add-card. Empty → muted empty label.
- These two `Section`s carry their own titles, so the existing
  `ProfileSectionHeader` is NOT used for them (unlike the personas/events/news
  sections above, which keep `ProfileSectionHeader`). This is intentional — it
  matches the village exactly.
- Placement: where the current org block sits (after Created News, before the
  Pueblos/Villages section).

### i18n (`packages/i18n/messages/es.json`)

**New profile-scoped keys** under `profile` (membership-flavoured empty copy, so
not reusing `village.hub.*`):

```json
"gruposSection": {
  "title": "Grupos",
  "empty": "Aún no perteneces a ningún grupo."
},
"peñasSection": {
  "title": "Peñas",
  "empty": "Aún no perteneces a ninguna peña."
}
```

**App-wide "Agrupaciones" → "Grupos" relabel.** Exactly four user-facing strings
carry the old word (the admin add-labels say "organización", so they stay):

| key | old | new |
| --- | --- | --- |
| `village.hub.organizations` | Agrupaciones | Grupos |
| `village.organizationsList.title` | Agrupaciones | Grupos |
| `village.organizationsList.empty` | Aún no hay agrupaciones | Aún no hay grupos |
| `village.community.explainer` | …lugares y agrupaciones… | …lugares y grupos… |

Optionally update the internal "agrupaciones/Agrupaciones" code comments
(VillageHomeBody, OrganizationsManager, organizations.tsx, ProposableForm,
community.tsx) to "grupos" for accuracy — non-functional.

### Cleanup

- Delete `apps/mobile/components/feature/profile/OrgList.tsx` (and its
  `OrgListItem` export) — no longer used.
- Remove the now-unused `profile.orgsSection.*` strings from
  `packages/i18n/messages/es.json`.
- Remove the `OrgList` import + `defaultRoleLabel`/`roleMember` usage from
  profile.tsx.

### Tests

Update `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`:
- Assert both section titles render ("Grupos", "Peñas").
- Given a member peña + a member asociación, assert each lands in its section
  and a card press navigates to `/o/${id}`.
- Empty case: both empty labels render when the user has no memberships.

## Out of scope

- No changes to the village org screens or the org detail route.
- No member-count sub-line (the village fetches counts; the profile shows the
  membership role instead, which is already loaded — avoids extra reads).
- No add/join flow from the profile.
