# Organization member roster with privacy toggle

## Goal

Show a roster of a group's (organization's) members on the org detail screen — avatar + name rows in the same style as the event sign-up list — gated by a per-group privacy toggle set at creation (default on).

## Context

Events show who signed up via [`EventAttendees`](../../../apps/mobile/components/feature/EventAttendees.tsx) (avatar + name rows from `getEventRegistrations`). Organizations have members at `organizations/{orgId}/members/{uid}` but the detail screen ([`o/[orgId]/index.tsx`](../../../apps/mobile/app/o/[orgId]/index.tsx)) today renders **only a member count** — never the members themselves. We want a matching roster for groups, plus a privacy switch so a group can choose whether that roster is shown publicly.

Unlike event registrations (which denormalize `name`), org member docs store only `userId`, `role`, `joinedAt`. A roster must therefore resolve each member's display name + photo from their `userId`.

## Design / approach

### Visibility semantics (decided)

A boolean `membersPublic` on the organization (default `true`):

- `true` → roster visible to **everyone** (members, non-members, visitors).
- `false` → roster visible **only to joined members** (admins are members, so they always see it). Non-member visitors see just the count, as today.

Expressed as a pure predicate `canViewOrgRoster({ membersPublic, isMember }) = membersPublic || isMember`.

### Enforcement level (decided): display gate only

`membersPublic` is a **UI display preference**, not a hard security boundary. The roster component renders only when `canViewOrgRoster(...)` is true; nothing changes in Firestore rules or the count path. This is deliberate and sufficient: member identities (names via world-readable `users/{uid}`, photos via world-readable `persons/{personId}`) are already publicly readable, so rules-enforcing only the members subcollection would be a false sense of security while buying meaningful extra machinery (a denormalized `memberCount` + Cloud Function trigger to replace the now-unreadable aggregate count). Rules-level enforcement is explicitly **out of scope** — see below.

### Member name + photo resolution

For each member `uid`, resolve in one hop via `getPersonByUserId(uid)` (returns name parts + `photoURL`). Fallback when no linked person exists: `getUserProfile(uid).displayName` + initials avatar. Mirrors how `EventAttendees` resolves attendee photos per-row.

### Data model

[`OrganizationDataModel.ts`](../../../packages/shared/src/models/organization/OrganizationDataModel.ts):
- Add `membersPublic: boolean` to `OrganizationDataSchema` and `OrganizationDataInput`.
- `buildOrganizationData` defaults it to `true`.

The strict Zod converter throws on docs missing a newly-added field, so existing dev orgs must be backfilled in the same change (idempotent `scripts/backfill-org-members-public.mjs` setting `membersPublic: true` on orgs missing it), and org seed fixtures updated. Verify with `pnpm check:dev-conformance` before/after.

### Creation form

[`OrganizationsManager.tsx`](../../../apps/mobile/components/feature/proposable/OrganizationsManager.tsx): add a toggle row (label "show group members", default ON) alongside the `ProposableForm`, threading `membersPublic` into the `requestOrganization` input. [`organizationService.ts`](../../../packages/shared/src/services/organizationService.ts) `requestOrganization` writes `membersPublic` into the doc.

### Edit form

[`o/[orgId]/edit.tsx`](../../../apps/mobile/app/o/[orgId]/edit.tsx): the same toggle, persisted via `updateOrganization`.

### Roster component

New `OrgMembersList` component (mirrors `EventAttendees` style): `getOrgMembers(orgId)` → per member resolve name + photo as above → render `Avatar` + name + a small admin badge when `role === 'admin'`. Read-only, admins-first then by name, with loading + empty states.

### Detail screen

[`o/[orgId]/index.tsx`](../../../apps/mobile/app/o/[orgId]/index.tsx): keep the existing count line; render `<OrgMembersList>` beneath it only when `canViewOrgRoster({ membersPublic: org.membersPublic, isMember })`.

### i18n

Add strings to `packages/i18n/messages/es.json`: toggle label + helper text, roster heading, admin badge, empty state.

### Tests (vitest, `packages/shared/test/`)

- `buildOrganizationData` defaults `membersPublic: true`.
- `OrganizationDataSchema` parse round-trip including `membersPublic`.
- `canViewOrgRoster` truth table.

## Out of scope

- **Rules-enforced privacy (Approach B).** Locking the members-subcollection read rule + denormalizing `memberCount`. Not pursued — the underlying profile docs stay world-readable, so it adds machinery without real privacy. Not a planned follow-up.
- **Villages.** This applies to organizations only; villages are a separate membership surface.
- **Member removal / management actions** in the roster. Read-only. Role changes stay in their existing audited callables.

## Open questions

None.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `membersPublic` privacy flag to organizations (default on) and render a read-only member roster (avatar + name + admin badge) on the org detail screen, shown only when the group is public or the viewer is a member.

**Architecture:** A new required boolean on the org model, defaulted true by the builder and written through the create/seed paths, backfilled on dev. A pure `canViewOrgRoster` predicate gates a new self-fetching `OrgMembersList` component that mirrors `EventAttendees`, resolving each member's name+photo from their uid via `getPersonByUserId`. Toggle added to the org create and edit forms.

**Tech Stack:** TypeScript (strict), Zod, React Native / Expo Router, NativeWind, vitest (shared), firebase-admin (backfill).

## Global Constraints

- Strict TypeScript, no `any`, no `@ts-nocheck`. Fix at the source.
- Components/screens must not import `firebase/*` directly — go through services.
- User-facing strings via `useT()` and `packages/i18n/messages/es.json`; no hardcoded Spanish in non-admin surfaces.
- New required model field ⇒ backfill dev (`villa-events`) in the same change; verify with `pnpm check:dev-conformance`.
- Icons via `@expo/vector-icons` with `iconSizes.*`; compose primitives (`Avatar`, `HStack`, `Text`, `Toggle`) before raw `<View>`.
- Run `pnpm check` (or at least `pnpm --filter @cultuvilla/shared test` + `pnpm app:typecheck`) before pushing.

---

### Task 1: Model field, builder default, and visibility predicate

**Files:**
- Modify: `packages/shared/src/models/organization/OrganizationDataModel.ts`
- Test: `packages/shared/test/models/organization/OrganizationDataModel.test.ts`

**Interfaces:**
- Produces: `OrganizationDataSchema` gains `membersPublic: boolean`; `OrganizationDataInput.membersPublic?: boolean`; `buildOrganizationData` defaults it to `true`; new `export function canViewOrgRoster(args: { membersPublic: boolean; isMember: boolean }): boolean`.

- [ ] **Step 1: Write the failing tests** — append to `OrganizationDataModel.test.ts`:

```ts
import {
  OrganizationDataSchema,
  buildOrganizationData,
  canViewOrgRoster,
} from '../../../src/models/organization/OrganizationDataModel';

// Add membersPublic to the shared validOrg fixture at the top of the file:
//   const validOrg = { ...existing fields..., membersPublic: true };

describe('membersPublic', () => {
  it('rejects an org missing membersPublic', () => {
    const { membersPublic: _omit, ...rest } = validOrg;
    expect(() => OrganizationDataSchema.parse(rest)).toThrow();
  });

  it('buildOrganizationData defaults membersPublic to true', () => {
    const o = buildOrganizationData({
      name: 'Peña X', type: 'peña', requestedBy: 'u1', municipalityId: 'v1',
    });
    expect(o.membersPublic).toBe(true);
    expect(() => OrganizationDataSchema.parse(o)).not.toThrow();
  });

  it('buildOrganizationData honours an explicit membersPublic false', () => {
    const o = buildOrganizationData({
      name: 'Peña X', type: 'peña', requestedBy: 'u1', municipalityId: 'v1', membersPublic: false,
    });
    expect(o.membersPublic).toBe(false);
  });
});

describe('canViewOrgRoster', () => {
  it('public group: anyone sees the roster', () => {
    expect(canViewOrgRoster({ membersPublic: true, isMember: false })).toBe(true);
    expect(canViewOrgRoster({ membersPublic: true, isMember: true })).toBe(true);
  });
  it('private group: only members see the roster', () => {
    expect(canViewOrgRoster({ membersPublic: false, isMember: true })).toBe(true);
    expect(canViewOrgRoster({ membersPublic: false, isMember: false })).toBe(false);
  });
});
```

Also update the existing shared `validOrg` object (top of the file) to include `membersPublic: true`, so the pre-existing `parses a complete valid organization` test still passes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared test -- OrganizationDataModel`
Expected: FAIL — `canViewOrgRoster` is not exported; `membersPublic` unknown.

- [ ] **Step 3: Implement** — in `OrganizationDataModel.ts`:

In `OrganizationDataSchema` (after `readCount`, before `...reviewDecisionFields`):

```ts
  // When false, the member roster is shown only to joined members (admins
  // included); when true, it is shown to everyone. Display preference, not a
  // security boundary — member identities are world-readable. Default true.
  membersPublic: z.boolean(),
```

In `OrganizationDataInput`, add `membersPublic?: boolean;`.

In `buildOrganizationData`'s returned object, add `membersPublic: input.membersPublic ?? true,`.

At the bottom of the file, add:

```ts
/**
 * Whether a given viewer may see an org's member roster. Public groups are
 * visible to everyone; private groups only to joined members (admins are
 * members, so they always see it). Pure — the UI-level display gate.
 */
export function canViewOrgRoster({
  membersPublic,
  isMember,
}: {
  membersPublic: boolean;
  isMember: boolean;
}): boolean {
  return membersPublic || isMember;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- OrganizationDataModel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/organization/OrganizationDataModel.ts \
        packages/shared/test/models/organization/OrganizationDataModel.test.ts
git commit -m "feat(shared): add membersPublic flag and canViewOrgRoster predicate to org model"
```

---

### Task 1b: Allow `membersPublic` in the org create rule + shape contract

> Added during execution: `isValidOrganizationCreate` in `firestore.rules` pins the exact create-payload key set (mirrored by the pure `rulesShapeContract` test and the emulator `shapeRules` test). Without this, the Task 2 client write of `membersPublic` is rejected by the security rule. The org **update** rule uses no strict key allowlist (only blocks `commentCount`/`readCount`/`status` changes), so the edit-form write needs no rule change.

**Files:**
- Modify: `firestore.rules` (`isValidOrganizationCreate`, ~lines 224-247)
- Modify: `packages/shared/test/validation/rulesShapeContract.test.ts` (organizations `ruleKeys`, ~line 38)
- Modify: `packages/shared/test/e2e/shapeRules.test.ts` (`validOrg` fixture, ~line 193)

- [ ] **Step 1: Update the rule** — in `firestore.rules` `isValidOrganizationCreate`, add `'membersPublic'` to BOTH the `hasOnly([...])` and `hasAll([...])` key lists, and add a type check. The list becomes:

```
              'name', 'description', 'imageURL', 'type', 'status', 'municipalityId',
              'requestedBy', 'reviewedBy', 'createdAt', 'reviewedAt',
              'commentCount', 'readCount', 'membersPublic',
```

and add, alongside the other field checks (e.g. after `&& d.readCount == 0`):

```
          && d.membersPublic is bool
```

- [ ] **Step 2: Update the pure shape contract** — in `rulesShapeContract.test.ts`, add `'membersPublic'` to the `organizations — isValidOrganizationCreate` entry's `ruleKeys` array.

- [ ] **Step 3: Update the emulator fixture** — in `shapeRules.test.ts`, add `membersPublic: true,` to the `validOrg` object (after `readCount: 0,`), so the "valid create succeeds" assertion still passes.

- [ ] **Step 4: Verify (pure)**

Run: `pnpm --filter @cultuvilla/shared test -- rulesShapeContract`
Expected: PASS (organizations builder keys now match ruleKeys).

- [ ] **Step 5: Verify (emulator rules)**

Run: `pnpm test:rules`
Expected: PASS — the org create/shape rules tests are green. If any other e2e org-create payload asserted to succeed is missing `membersPublic`, add `membersPublic: true` to it (search `packages/shared/test/e2e/` for org docs written with `assertSucceeds`).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules packages/shared/test/validation/rulesShapeContract.test.ts \
        packages/shared/test/e2e/shapeRules.test.ts
git commit -m "feat(rules): allow membersPublic in org create validator + shape contract"
```

> **Deploy note (for Task 9):** the dev app cannot create orgs with `membersPublic` until these rules are deployed to `villa-events`. Deploy rules via the `firestore-deploy` skill as part of Task 9.

---

### Task 2: Write `membersPublic` through the create + seed paths

**Files:**
- Modify: `packages/shared/src/services/organizationService.ts:82-121` (`requestOrganization`)
- Modify: `scripts/seed/orgs.mjs:31-45` (builder call)
- Test: `packages/shared/test/services/organizationService.test.ts`

**Interfaces:**
- Consumes: `OrganizationDataInput.membersPublic` (Task 1).
- Produces: `requestOrganization` persists `membersPublic` (defaulting `true` when the input omits it); the org seeder forwards `org.membersPublic`.

- [ ] **Step 1: Write the failing test** — append to `organizationService.test.ts`. First extend the `firebase/firestore` mock at the top of the file to include `setDoc`:

```ts
// In the vi.mock('firebase/firestore', ...) factory, add:
//   setDoc: vi.fn(),
```

Then add:

```ts
import { doc, setDoc } from 'firebase/firestore';
import { requestOrganization } from '../../src/services/organizationService';

describe('requestOrganization membersPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue({ id: 'o1' } as ReturnType<typeof doc>);
  });

  it('defaults membersPublic to true when omitted', async () => {
    await requestOrganization({
      id: 'o1', name: 'Peña', type: 'peña', municipalityId: 'm1', requestedBy: 'u1',
    });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ membersPublic: true }),
    );
  });

  it('persists membersPublic false when provided', async () => {
    await requestOrganization({
      id: 'o1', name: 'Peña', type: 'peña', municipalityId: 'm1', requestedBy: 'u1',
      membersPublic: false,
    });
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ membersPublic: false }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- organizationService`
Expected: FAIL — persisted object lacks `membersPublic`.

- [ ] **Step 3: Implement** — in `requestOrganization`, add to the `data` object literal (after `readCount: 0,`):

```ts
    membersPublic: input.membersPublic ?? true,
```

In `scripts/seed/orgs.mjs`, add to the `buildOrganizationData({ ... })` call (after `reviewedAt: new Date(),`):

```js
            membersPublic: org.membersPublic ?? true,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- organizationService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/organizationService.ts \
        packages/shared/test/services/organizationService.test.ts scripts/seed/orgs.mjs
git commit -m "feat(shared): persist membersPublic in requestOrganization and org seeder"
```

---

### Task 3: Backfill `membersPublic` on existing dev orgs

**Files:**
- Create: `scripts/backfill-org-members-public.mjs`

- [ ] **Step 1: Write the script** (mirror `scripts/backfill-org-member-roles.mjs`):

```js
#!/usr/bin/env node
/**
 * backfill-org-members-public.mjs
 *
 * One-off: `OrganizationDataSchema.membersPublic` was added after some org docs
 * already existed. The strict converter throws on docs missing it. This sets the
 * builder default (`true`) on every org doc that lacks the field.
 *
 * USAGE
 *   node scripts/backfill-org-members-public.mjs          (dry run — no writes)
 *   node scripts/backfill-org-members-public.mjs --apply  (writes to Firestore)
 *
 * Idempotent: skips any org doc that already has `membersPublic` set.
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const orgs = await db.collection('organizations').get();
  console.log(`Loaded ${orgs.size} organization docs.`);

  let patched = 0;
  let alreadySet = 0;

  for (const org of orgs.docs) {
    if (org.get('membersPublic') !== undefined) {
      alreadySet++;
      continue; // idempotent skip
    }
    patched++;
    if (APPLY) await org.ref.set({ membersPublic: true }, { merge: true });
  }

  console.log(`\n${APPLY ? 'WROTE' : 'DRY-RUN'}: ${patched} orgs set membersPublic=true`);
  console.log(`  Already set (skipped): ${alreadySet}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run**

Run (with dev creds — see `firebase-admin-dev` skill):
`GOOGLE_APPLICATION_CREDENTIALS=<dev-key> node scripts/backfill-org-members-public.mjs`
Expected: prints a `DRY-RUN: N orgs set membersPublic=true` count, no writes.

- [ ] **Step 3: Apply**

Run: `GOOGLE_APPLICATION_CREDENTIALS=<dev-key> node scripts/backfill-org-members-public.mjs --apply`
Expected: `WROTE: N orgs …`.

- [ ] **Step 4: Verify conformance**

Run: `pnpm check:dev-conformance`
Expected: no nonconforming `organizations` docs reported.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-org-members-public.mjs
git commit -m "chore(scripts): backfill membersPublic on dev org docs"
```

---

### Task 4: i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `"organization"` object, lines ~587-609)

- [ ] **Step 1: Add keys** — inside the `"organization"` object add:

```json
    "members": "Miembros",
    "membersPublicLabel": "Mostrar los miembros del grupo",
    "membersPublicHelp": "Si se desactiva, solo los miembros del grupo verán quién forma parte.",
    "membersEmpty": "Este grupo aún no tiene miembros.",
    "adminBadge": "Admin",
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "feat(i18n): add org member roster strings"
```

---

### Task 5: `OrgMembersList` roster component

**Files:**
- Create: `apps/mobile/components/feature/OrgMembersList.tsx`

**Interfaces:**
- Consumes: `getOrgMembers` (orgMemberService), `getPersonByUserId` (personService), `getUserProfile` (userService), `Avatar`/`HStack`/`Text`/`VStack` primitives, `DetailSectionHeading`, `useT`.
- Produces: `export function OrgMembersList({ orgId }: { orgId: string })` — self-fetching read-only roster.

- [ ] **Step 1: Implement** (mirrors `EventAttendees` structure; no phone/remove actions):

```tsx
import { useCallback, useEffect, useState } from 'react';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
import { Avatar } from '../primitives/Avatar';
import { DetailSectionHeading } from './DetailSectionHeading';
import { getOrgMembers } from '@cultuvilla/shared/services/orgMemberService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';
import type { OrgMemberData } from '@cultuvilla/shared/models/organization/OrgMemberDataModel';
import { useT } from '../../lib/i18n';

type Row = OrgMemberData & { id: string; name: string; photoURL: string | null };

/**
 * Read-only org member roster: circular profile photo (from the member's
 * person, initials fallback) + display name + an admin badge. Self-fetches,
 * mirroring EventAttendees. The caller decides whether to render this at all
 * (canViewOrgRoster) — this component does no access control.
 */
export function OrgMembersList({ orgId }: { orgId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const members = await getOrgMembers(orgId);
    const resolved = await Promise.all(
      members.map(async (m): Promise<Row> => {
        // One hop per member: the person carries both photo and name parts.
        const person = await getPersonByUserId(m.userId).catch(() => null);
        if (person) {
          const name =
            person.nickname?.trim() ||
            [person.givenName, person.firstSurname].filter(Boolean).join(' ').trim();
          return { ...m, name: name || m.userId, photoURL: person.photoURL ?? null };
        }
        const user = await getUserProfile(m.userId).catch(() => null);
        return { ...m, name: user?.displayName || m.userId, photoURL: null };
      }),
    );
    // Admins first, then alphabetical.
    resolved.sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1,
    );
    setRows(resolved);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <VStack gap={2}>
      <DetailSectionHeading>{t('organization.members')}</DetailSectionHeading>
      {rows && rows.length === 0 ? (
        <Text tone="muted" variant="bodySm">
          {t('organization.membersEmpty')}
        </Text>
      ) : (
        (rows ?? []).map((r) => (
          <HStack key={r.id} gap={3} align="center" className="py-2">
            <Avatar uri={r.photoURL} size={36} initials={r.name.slice(0, 1).toUpperCase()} />
            <Text numberOfLines={1} className="flex-1">
              {r.name}
            </Text>
            {r.role === 'admin' ? (
              <Text tone="muted" variant="bodySm">
                {t('organization.adminBadge')}
              </Text>
            ) : null}
          </HStack>
        ))
      )}
    </VStack>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS. (UI-only component — no unit test; verified by typecheck + the manual test plan below, per AGENTS "genuinely untestable UI".)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/OrgMembersList.tsx
git commit -m "feat(mobile): add OrgMembersList read-only roster component"
```

---

### Task 6: Privacy toggle in the org create form

**Files:**
- Modify: `apps/mobile/components/feature/proposable/OrganizationsManager.tsx`

- [ ] **Step 1: Implement** — add state, a toggle, and thread it into the request:

Add import: `import { Toggle } from '../../primitives/Toggle';` and `import { Text } from '../../primitives/Text';` (if not already imported via `../../primitives`).

Add state near the others: `const [membersPublic, setMembersPublic] = useState(true);`

In `requestOrganization({ ... })`, add `membersPublic,` to the payload.

Reset it in the success block: `setMembersPublic(true);`

Render the toggle inside the `<VStack>`, above `<ProposableForm>`:

```tsx
      <VStack gap={1}>
        <Toggle
          value={membersPublic}
          onValueChange={setMembersPublic}
          label={t('organization.membersPublicLabel')}
          testID="org-members-public-toggle"
        />
        <Text tone="muted" variant="bodySm">
          {t('organization.membersPublicHelp')}
        </Text>
      </VStack>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/proposable/OrganizationsManager.tsx
git commit -m "feat(mobile): add members-public toggle to org create form"
```

---

### Task 7: Privacy toggle in the org edit form

**Files:**
- Modify: `apps/mobile/app/o/[orgId]/edit.tsx`

- [ ] **Step 1: Implement** — load, edit, and persist `membersPublic`:

Add imports: `import { Toggle } from '../../../components/primitives/Toggle';` (and reuse the existing `Text` import).

Add state: `const [membersPublic, setMembersPublic] = useState(true);`

In the load effect (`if (o) { ... }`), add: `setMembersPublic(o.membersPublic);`

In `submit()`'s `updateOrganization(orgId, { ... })`, add `membersPublic,` to the patch.

Render the toggle inside the `<ScrollView>`, above `<ProposableForm>` (wrap both if needed):

```tsx
        <VStack gap={1} className="mb-4">
          <Toggle
            value={membersPublic}
            onValueChange={setMembersPublic}
            label={t('organization.membersPublicLabel')}
            testID="org-edit-members-public-toggle"
          />
          <Text tone="muted" variant="bodySm">
            {t('organization.membersPublicHelp')}
          </Text>
        </VStack>
```

Add `import { VStack } from '../../../components/primitives/VStack';` if not present.

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/o/[orgId]/edit.tsx
git commit -m "feat(mobile): edit members-public toggle on org edit screen"
```

---

### Task 8: Render the roster on the org detail screen

**Files:**
- Modify: `apps/mobile/app/o/[orgId]/index.tsx`

- [ ] **Step 1: Implement** — gate the roster behind `canViewOrgRoster`:

Add imports:

```tsx
import { OrgMembersList } from '../../../components/feature/OrgMembersList';
import { canViewOrgRoster } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
```

In the body, after the `membersCount` `<Text>` line, add:

```tsx
          {canViewOrgRoster({ membersPublic: org.membersPublic, isMember }) ? (
            <OrgMembersList orgId={org.id} />
          ) : null}
```

(Keep the existing count line and `getOrgMembers`-based `membersCount` as-is — the count stays visible to everyone; only the roster is gated.)

- [ ] **Step 2: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/o/[orgId]/index.tsx
git commit -m "feat(mobile): show member roster on org detail, gated by privacy flag"
```

---

### Task 9: Full gate + manual verification

- [ ] **Step 1: Run the full check**

Run: `pnpm check`
Expected: lint + typecheck + tests + build all pass.

- [ ] **Step 2: Manual test plan** (dev app, seeded data)

- Create a group with the toggle ON → open its detail as a non-member → roster of members is visible (avatars + names, admin badged).
- Create a group with the toggle OFF → open its detail as a non-member → only the member count shows, no roster. Join it → roster now appears.
- Edit an existing group, flip the toggle, save → detail reflects the new visibility.
- Confirm the seeded/backfilled orgs render without converter crashes.

## Self-review notes

- **Spec coverage:** model field + default (T1), predicate (T1), create write (T2), seeder (T2), backfill (T3), i18n (T4), roster component (T5), create toggle (T6), edit toggle (T7), detail gate (T8). All spec sections mapped.
- **Type consistency:** `canViewOrgRoster({ membersPublic, isMember })` signature identical across T1/T8; `membersPublic` boolean everywhere; `OrgMembersList({ orgId })` matches its consumer in T8.
- **UI test gap:** Tasks 5–8 are UI-only, verified by typecheck + the manual plan, per the spec's testing note and AGENTS' untestable-UI carve-out. The testable logic (`canViewOrgRoster`, model shape, service write) is unit-covered in T1–T2.
