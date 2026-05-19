# Cultuvilla Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first village community event platform with public browsing, village-scoped organizations, event sign-ups with waitlist, and persona management.

**Architecture:** pnpm monorepo following ordago-apps patterns — shared package (`@cultuvilla/shared`) with domain models (interfaces + builders), stateless services, and pure utils. Next.js 15 web app with feature-based components, custom hooks, and React contexts. Firebase backend (Auth, Firestore, Storage, Cloud Functions). Designed for future React Native app reuse.

**Tech Stack:** TypeScript, Next.js 15, React 19, Tailwind CSS 4, Firebase 11, next-intl, Vitest, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-04-05-cultuvilla-design.md`

---

## File Structure

### Shared Package (`packages/shared/src/`)

```
packages/shared/
├── src/
│   ├── index.ts                              # Barrel export
│   ├── firebase/
│   │   ├── firebaseApp.ts                    # Firebase init (app, auth, db, storage)
│   │   └── index.ts
│   ├── models/
│   │   ├── index.ts                          # Barrel export all models
│   │   ├── core/
│   │   │   ├── LocationDataModel.ts          # Shared location type (coords or text)
│   │   │   └── index.ts
│   │   ├── user/
│   │   │   ├── UserDataModel.ts              # UserData interface + builder
│   │   │   ├── PersonaDataModel.ts           # PersonaData interface + builder
│   │   │   └── index.ts
│   │   ├── village/
│   │   │   ├── VillageDataModel.ts           # VillageData interface + builder
│   │   │   ├── VillageMemberDataModel.ts     # VillageMember interface + builder
│   │   │   ├── InviteTokenDataModel.ts       # InviteToken interface + builder
│   │   │   └── index.ts
│   │   ├── organization/
│   │   │   ├── OrganizationDataModel.ts      # Organization interface + builder
│   │   │   ├── OrgMemberDataModel.ts         # OrgMember interface + builder
│   │   │   └── index.ts
│   │   ├── event/
│   │   │   ├── EventDataModel.ts             # Event interface + builder
│   │   │   ├── RegistrationDataModel.ts      # Registration interface + builder
│   │   │   └── index.ts
│   │   └── notification/
│   │       ├── NotificationDataModel.ts      # Notification interface + builder
│   │       └── index.ts
│   ├── services/
│   │   ├── index.ts                          # Barrel export all services
│   │   ├── userService.ts                    # User CRUD
│   │   ├── personaService.ts                 # Persona CRUD (subcollection of user)
│   │   ├── adminService.ts                   # App-wide admin checks
│   │   ├── villageService.ts                 # Village CRUD
│   │   ├── villageMemberService.ts           # Village membership management
│   │   ├── inviteTokenService.ts             # Invite token generation/validation
│   │   ├── organizationService.ts            # Org CRUD + approval flow
│   │   ├── orgMemberService.ts               # Org membership management
│   │   ├── eventService.ts                   # Event CRUD + lifecycle
│   │   ├── registrationService.ts            # Registration + waitlist logic
│   │   └── notificationService.ts            # Notification CRUD + marking read
│   └── utils/
│       ├── index.ts
│       └── dateUtils.ts                      # Date formatting helpers
├── test/
│   ├── models/
│   │   ├── UserDataModel.test.ts
│   │   ├── EventDataModel.test.ts
│   │   └── RegistrationDataModel.test.ts
│   ├── services/
│   │   ├── registrationService.test.ts
│   │   └── eventService.test.ts
│   └── mocks/
│       └── firebaseFirestoreMock.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Web App (`apps/web/`)

```
apps/web/
├── app/
│   ├── globals.css
│   ├── layout.tsx                             # Root layout (AuthProvider, i18n)
│   ├── page.tsx                               # Landing — village discovery
│   ├── login/
│   │   └── page.tsx                           # Sign in / Sign up
│   ├── invite/[token]/
│   │   └── page.tsx                           # Invite link sign-up
│   ├── village/[id]/
│   │   ├── layout.tsx                         # Village layout (VillageProvider)
│   │   ├── page.tsx                           # Village home — events list
│   │   ├── event/[eventId]/
│   │   │   └── page.tsx                       # Event detail + sign-up
│   │   ├── org/[orgId]/
│   │   │   ├── page.tsx                       # Org page — org events
│   │   │   └── events/
│   │   │       ├── new/page.tsx               # Create event
│   │   │       └── [eventId]/edit/page.tsx    # Edit event
│   │   └── admin/
│   │       └── page.tsx                       # Village admin panel
│   ├── profile/
│   │   ├── page.tsx                           # User profile
│   │   └── personas/
│   │       └── page.tsx                       # Manage personas
│   ├── my-signups/
│   │   └── page.tsx                           # My registrations across villages
│   ├── notifications/
│   │   └── page.tsx                           # Notification inbox
│   └── admin/
│       └── page.tsx                           # App-wide admin
├── components/
│   ├── common/
│   │   ├── BottomNav.tsx                      # Bottom tab bar
│   │   ├── TopBar.tsx                         # Top bar with village name
│   │   └── SkeletonLoader.tsx                 # Loading skeletons
│   ├── event/
│   │   ├── EventCard.tsx                      # Event list card
│   │   ├── EventForm.tsx                      # Create/edit event form
│   │   ├── SignUpModal.tsx                    # Sign-up modal (self + personas)
│   │   └── AttendeeList.tsx                   # Attendee list component
│   ├── village/
│   │   ├── VillageCard.tsx                    # Village discovery card
│   │   └── VillageInfo.tsx                    # Village detail info
│   ├── organization/
│   │   ├── OrgCard.tsx                        # Org list card
│   │   └── OrgRequestForm.tsx                 # Request new org form
│   ├── profile/
│   │   ├── PersonaCard.tsx                    # Persona display card
│   │   └── PersonaForm.tsx                    # Create/edit persona form
│   └── notification/
│       └── NotificationItem.tsx               # Notification list item
├── hooks/
│   ├── useAuth.ts                             # Re-export from context
│   ├── useVillage.ts                          # Village data + membership
│   ├── useEvents.ts                           # Event list fetching
│   ├── useRegistrations.ts                    # Registration state
│   ├── useNotifications.ts                    # Notification count + list
│   └── usePersonas.ts                         # Persona list fetching
├── contexts/
│   ├── AuthContext.tsx                         # Auth state + methods
│   └── VillageContext.tsx                      # Current village state
├── i18n/
│   ├── config.ts                              # next-intl configuration
│   └── messages/
│       └── es.json                            # Spanish translations
├── middleware.ts                               # next-intl middleware
├── package.json
├── tsconfig.json
└── next.config.ts
```

### Cloud Functions (`functions/`)

```
functions/
├── src/
│   ├── index.ts                               # Export all functions
│   ├── waitlistPromotion.ts                   # Firestore trigger on registration changes
│   ├── eventCompletion.ts                     # Scheduled function for event completion
│   └── notificationTriggers.ts                # Create notifications on event changes
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Phase 1: Shared Package — Models

### Task 1: Project cleanup and shared package setup

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update shared package.json with test config**

```json
{
  "name": "@cultuvilla/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "firebase": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "vitest": "^4.0.15"
  }
}
```

- [ ] **Step 2: Create vitest config**

Create `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Clear old models and reset barrel export**

Replace `packages/shared/src/index.ts`:

```typescript
export * from './models';
export * from './services';
export * from './firebase';
export * from './utils';
```

- [ ] **Step 4: Run build to verify setup**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared build`
Expected: Build succeeds (may have warnings about missing exports, that's fine for now)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts packages/shared/src/index.ts
git commit -m "chore: update shared package setup with vitest and clean barrel exports"
```

---

### Task 2: Core location model

**Files:**
- Create: `packages/shared/src/models/core/LocationDataModel.ts`
- Create: `packages/shared/src/models/core/index.ts`

- [ ] **Step 1: Create LocationDataModel**

Create `packages/shared/src/models/core/LocationDataModel.ts`:

```typescript
import { GeoPoint } from 'firebase/firestore';

export type LocationType = 'coordinates' | 'text';

export interface LocationData {
  type: LocationType;
  coordinates: GeoPoint | null;
  text: string | null;
}

export interface LocationDataInput {
  type?: LocationType;
  coordinates?: GeoPoint | null;
  text?: string | null;
}

export function buildLocationData(input: LocationDataInput = {}): LocationData {
  const type = input.type ?? 'text';
  return {
    type,
    coordinates: type === 'coordinates' ? (input.coordinates ?? null) : null,
    text: type === 'text' ? (input.text ?? null) : null,
  };
}
```

- [ ] **Step 2: Create barrel export**

Create `packages/shared/src/models/core/index.ts`:

```typescript
export * from './LocationDataModel';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/models/core/
git commit -m "feat: add core LocationDataModel with coordinates/text support"
```

---

### Task 3: User and persona models

**Files:**
- Create: `packages/shared/src/models/user/UserDataModel.ts`
- Create: `packages/shared/src/models/user/PersonaDataModel.ts`
- Create: `packages/shared/src/models/user/index.ts`
- Create: `packages/shared/test/models/UserDataModel.test.ts`

- [ ] **Step 1: Write failing test for UserData builder**

Create `packages/shared/test/models/UserDataModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUserData } from '../../src/models/user/UserDataModel';

describe('buildUserData', () => {
  it('builds a user with required fields', () => {
    const user = buildUserData({
      displayName: 'Juan García',
      email: 'juan@example.com',
      birthday: new Date('1990-05-15'),
    });

    expect(user.displayName).toBe('Juan García');
    expect(user.email).toBe('juan@example.com');
    expect(user.birthday).toEqual(new Date('1990-05-15'));
    expect(user.biography).toBeNull();
    expect(user.telephone).toBeNull();
    expect(user.photoURL).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('builds a user with all optional fields', () => {
    const user = buildUserData({
      displayName: 'María López',
      email: 'maria@example.com',
      birthday: new Date('1985-03-20'),
      biography: 'Vecina del pueblo',
      telephone: '+34612345678',
      photoURL: 'https://example.com/photo.jpg',
    });

    expect(user.biography).toBe('Vecina del pueblo');
    expect(user.telephone).toBe('+34612345678');
    expect(user.photoURL).toBe('https://example.com/photo.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/models/UserDataModel.test.ts`
Expected: FAIL — cannot resolve module

- [ ] **Step 3: Implement UserDataModel**

Create `packages/shared/src/models/user/UserDataModel.ts`:

```typescript
export interface UserData {
  displayName: string;
  email: string;
  birthday: Date;
  biography: string | null;
  telephone: string | null;
  photoURL: string | null;
  createdAt: Date;
}

export interface UserDataInput {
  displayName: string;
  email: string;
  birthday: Date;
  biography?: string | null;
  telephone?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    birthday: input.birthday,
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 4: Implement PersonaDataModel**

Create `packages/shared/src/models/user/PersonaDataModel.ts`:

```typescript
export const MAX_PERSONAS_PER_USER = 50;

export interface PersonaData {
  name: string;
  birthday: Date;
  biography: string | null;
  photoURL: string | null;
  createdAt: Date;
}

export interface PersonaDataInput {
  name: string;
  birthday: Date;
  biography?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

export function buildPersonaData(input: PersonaDataInput): PersonaData {
  return {
    name: input.name,
    birthday: input.birthday,
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 5: Create barrel export**

Create `packages/shared/src/models/user/index.ts`:

```typescript
export * from './UserDataModel';
export * from './PersonaDataModel';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/models/UserDataModel.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/models/user/ packages/shared/test/models/UserDataModel.test.ts
git commit -m "feat: add UserDataModel and PersonaDataModel with builders and tests"
```

---

### Task 4: Village models

**Files:**
- Create: `packages/shared/src/models/village/VillageDataModel.ts`
- Create: `packages/shared/src/models/village/VillageMemberDataModel.ts`
- Create: `packages/shared/src/models/village/InviteTokenDataModel.ts`
- Create: `packages/shared/src/models/village/index.ts`

- [ ] **Step 1: Implement VillageDataModel**

Create `packages/shared/src/models/village/VillageDataModel.ts`:

```typescript
import { GeoPoint } from 'firebase/firestore';

export interface VillageData {
  name: string;
  description: string;
  coordinates: GeoPoint;
  comunidadAutonoma: string;
  provincia: string;
  images: string[];
  adminUserId: string;
  createdAt: Date;
}

export interface VillageDataInput {
  name: string;
  description: string;
  coordinates: GeoPoint;
  comunidadAutonoma: string;
  provincia: string;
  images?: string[];
  adminUserId: string;
  createdAt?: Date;
}

export function buildVillageData(input: VillageDataInput): VillageData {
  return {
    name: input.name,
    description: input.description,
    coordinates: input.coordinates,
    comunidadAutonoma: input.comunidadAutonoma,
    provincia: input.provincia,
    images: input.images ?? [],
    adminUserId: input.adminUserId,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 2: Implement VillageMemberDataModel**

Create `packages/shared/src/models/village/VillageMemberDataModel.ts`:

```typescript
export type VillageMemberRole = 'admin' | 'user';

export interface VillageMemberData {
  role: VillageMemberRole;
  joinedAt: Date;
}

export interface VillageMemberDataInput {
  role?: VillageMemberRole;
  joinedAt?: Date;
}

export function buildVillageMemberData(input: VillageMemberDataInput = {}): VillageMemberData {
  return {
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
  };
}
```

- [ ] **Step 3: Implement InviteTokenDataModel**

Create `packages/shared/src/models/village/InviteTokenDataModel.ts`:

```typescript
export interface InviteTokenData {
  createdAt: Date;
  expiresAt: Date | null;
  usageCount: number;
}

export interface InviteTokenDataInput {
  createdAt?: Date;
  expiresAt?: Date | null;
  usageCount?: number;
}

export function buildInviteTokenData(input: InviteTokenDataInput = {}): InviteTokenData {
  return {
    createdAt: input.createdAt ?? new Date(),
    expiresAt: input.expiresAt ?? null,
    usageCount: input.usageCount ?? 0,
  };
}

export function isTokenExpired(token: InviteTokenData): boolean {
  if (!token.expiresAt) return false;
  return new Date() > token.expiresAt;
}
```

- [ ] **Step 4: Create barrel export**

Create `packages/shared/src/models/village/index.ts`:

```typescript
export * from './VillageDataModel';
export * from './VillageMemberDataModel';
export * from './InviteTokenDataModel';
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/village/
git commit -m "feat: add Village, VillageMember, and InviteToken models"
```

---

### Task 5: Organization models

**Files:**
- Create: `packages/shared/src/models/organization/OrganizationDataModel.ts`
- Create: `packages/shared/src/models/organization/OrgMemberDataModel.ts`
- Create: `packages/shared/src/models/organization/index.ts`

- [ ] **Step 1: Implement OrganizationDataModel**

Create `packages/shared/src/models/organization/OrganizationDataModel.ts`:

```typescript
export type OrganizationType = 'ayuntamiento' | 'peña' | 'asociación';
export type OrganizationStatus = 'pending' | 'approved' | 'rejected';

export interface OrganizationData {
  name: string;
  description: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  requestedBy: string;
  createdAt: Date;
}

export interface OrganizationDataInput {
  name: string;
  description?: string | null;
  type: OrganizationType;
  status?: OrganizationStatus;
  requestedBy: string;
  createdAt?: Date;
}

export function buildOrganizationData(input: OrganizationDataInput): OrganizationData {
  return {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: input.status ?? 'pending',
    requestedBy: input.requestedBy,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 2: Implement OrgMemberDataModel**

Create `packages/shared/src/models/organization/OrgMemberDataModel.ts`:

```typescript
export interface OrgMemberData {
  joinedAt: Date;
}

export interface OrgMemberDataInput {
  joinedAt?: Date;
}

export function buildOrgMemberData(input: OrgMemberDataInput = {}): OrgMemberData {
  return {
    joinedAt: input.joinedAt ?? new Date(),
  };
}
```

- [ ] **Step 3: Create barrel export**

Create `packages/shared/src/models/organization/index.ts`:

```typescript
export * from './OrganizationDataModel';
export * from './OrgMemberDataModel';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/organization/
git commit -m "feat: add Organization and OrgMember models with type support"
```

---

### Task 6: Event and registration models

**Files:**
- Create: `packages/shared/src/models/event/EventDataModel.ts`
- Create: `packages/shared/src/models/event/RegistrationDataModel.ts`
- Create: `packages/shared/src/models/event/index.ts`
- Create: `packages/shared/test/models/EventDataModel.test.ts`
- Create: `packages/shared/test/models/RegistrationDataModel.test.ts`

- [ ] **Step 1: Write failing tests for EventData builder**

Create `packages/shared/test/models/EventDataModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildEventData } from '../../src/models/event/EventDataModel';

describe('buildEventData', () => {
  it('builds an event with required fields', () => {
    const event = buildEventData({
      title: 'Fiesta del pueblo',
      description: 'Gran fiesta anual',
      startDate: new Date('2026-08-15T20:00:00'),
      location: { type: 'text', coordinates: null, text: 'Plaza Mayor' },
      organizationId: 'org-1',
      organizationName: 'Ayuntamiento',
      createdBy: 'user-1',
    });

    expect(event.title).toBe('Fiesta del pueblo');
    expect(event.status).toBe('draft');
    expect(event.endDate).toBeNull();
    expect(event.imageURL).toBeNull();
    expect(event.price).toBeNull();
    expect(event.maxAttendees).toBeNull();
    expect(event.telephoneRequired).toBe(false);
  });

  it('builds an event with max attendees and telephone required', () => {
    const event = buildEventData({
      title: 'Cena solidaria',
      description: 'Cena para 50 personas',
      startDate: new Date('2026-09-01T21:00:00'),
      location: { type: 'text', coordinates: null, text: 'Casa de cultura' },
      organizationId: 'org-1',
      organizationName: 'Asociación vecinos',
      createdBy: 'user-2',
      maxAttendees: 50,
      telephoneRequired: true,
      price: 15,
    });

    expect(event.maxAttendees).toBe(50);
    expect(event.telephoneRequired).toBe(true);
    expect(event.price).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/models/EventDataModel.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement EventDataModel**

Create `packages/shared/src/models/event/EventDataModel.ts`:

```typescript
import { LocationData } from '../core/LocationDataModel';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface EventData {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location: LocationData;
  imageURL: string | null;
  price: number | null;
  maxAttendees: number | null;
  telephoneRequired: boolean;
  status: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date | null;
  location: LocationData;
  imageURL?: string | null;
  price?: number | null;
  maxAttendees?: number | null;
  telephoneRequired?: boolean;
  status?: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function buildEventData(input: EventDataInput): EventData {
  const now = new Date();
  return {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(event: EventData): boolean {
  return event.status === 'published';
}
```

- [ ] **Step 4: Write failing test for RegistrationData**

Create `packages/shared/test/models/RegistrationDataModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildRegistrationData } from '../../src/models/event/RegistrationDataModel';

describe('buildRegistrationData', () => {
  it('builds a confirmed registration for the user themselves', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      name: 'Juan García',
      status: 'confirmed',
      position: 1,
    });

    expect(reg.userId).toBe('user-1');
    expect(reg.personaId).toBeNull();
    expect(reg.name).toBe('Juan García');
    expect(reg.status).toBe('confirmed');
    expect(reg.position).toBe(1);
  });

  it('builds a waitlisted registration for a persona', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personaId: 'persona-1',
      name: 'Abuela María',
      status: 'waitlisted',
      position: 51,
    });

    expect(reg.personaId).toBe('persona-1');
    expect(reg.status).toBe('waitlisted');
    expect(reg.position).toBe(51);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/models/RegistrationDataModel.test.ts`
Expected: FAIL

- [ ] **Step 6: Implement RegistrationDataModel**

Create `packages/shared/src/models/event/RegistrationDataModel.ts`:

```typescript
export type RegistrationStatus = 'confirmed' | 'waitlisted';

export interface RegistrationData {
  userId: string;
  personaId: string | null;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt: Date;
}

export interface RegistrationDataInput {
  userId: string;
  personaId?: string | null;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt?: Date;
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return {
    userId: input.userId,
    personaId: input.personaId ?? null,
    name: input.name,
    status: input.status,
    position: input.position,
    registeredAt: input.registeredAt ?? new Date(),
  };
}
```

- [ ] **Step 7: Create barrel export**

Create `packages/shared/src/models/event/index.ts`:

```typescript
export * from './EventDataModel';
export * from './RegistrationDataModel';
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/models/event/ packages/shared/test/models/EventDataModel.test.ts packages/shared/test/models/RegistrationDataModel.test.ts
git commit -m "feat: add Event and Registration models with builders, helpers, and tests"
```

---

### Task 7: Notification model and models barrel export

**Files:**
- Create: `packages/shared/src/models/notification/NotificationDataModel.ts`
- Create: `packages/shared/src/models/notification/index.ts`
- Create: `packages/shared/src/models/index.ts`

- [ ] **Step 1: Implement NotificationDataModel**

Create `packages/shared/src/models/notification/NotificationDataModel.ts`:

```typescript
export type NotificationType =
  | 'waitlist_promoted'
  | 'event_cancelled'
  | 'event_updated'
  | 'org_approved'
  | 'org_rejected';

export interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  eventId: string | null;
  villageId: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationDataInput {
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string | null;
  villageId?: string | null;
  read?: boolean;
  createdAt?: Date;
}

export function buildNotificationData(input: NotificationDataInput): NotificationData {
  return {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    villageId: input.villageId ?? null,
    read: input.read ?? false,
    createdAt: input.createdAt ?? new Date(),
  };
}
```

- [ ] **Step 2: Create notification barrel export**

Create `packages/shared/src/models/notification/index.ts`:

```typescript
export * from './NotificationDataModel';
```

- [ ] **Step 3: Create models barrel export**

Create `packages/shared/src/models/index.ts`:

```typescript
export * from './core';
export * from './user';
export * from './village';
export * from './organization';
export * from './event';
export * from './notification';
```

- [ ] **Step 4: Run build to verify all exports resolve**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/
git commit -m "feat: add Notification model and wire up all model barrel exports"
```

---

## Phase 2: Shared Package — Services

### Task 8: Firebase config update

**Files:**
- Modify: `packages/shared/src/firebase/firebaseApp.ts`
- Modify: `packages/shared/src/firebase/index.ts`

- [ ] **Step 1: Update firebaseApp.ts — keep existing pattern**

Replace `packages/shared/src/firebase/firebaseApp.ts`:

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
```

- [ ] **Step 2: Verify firebase index export**

Ensure `packages/shared/src/firebase/index.ts` contains:

```typescript
export { app, auth, db, storage } from './firebaseApp';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/firebase/
git commit -m "chore: clean up Firebase config exports"
```

---

### Task 9: User and persona services

**Files:**
- Create: `packages/shared/src/services/userService.ts`
- Create: `packages/shared/src/services/personaService.ts`
- Create: `packages/shared/src/services/adminService.ts`

- [ ] **Step 1: Implement userService**

Create `packages/shared/src/services/userService.ts`:

```typescript
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

export async function getUserProfile(userId: string): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    displayName: data.displayName,
    email: data.email,
    birthday: data.birthday.toDate(),
    biography: data.biography ?? null,
    telephone: data.telephone ?? null,
    photoURL: data.photoURL ?? null,
    createdAt: data.createdAt.toDate(),
  };
}

export async function createUserProfile(
  userId: string,
  input: UserDataInput,
): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    displayName: input.displayName,
    email: input.email,
    birthday: input.birthday,
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<UserData, 'displayName' | 'biography' | 'telephone' | 'photoURL'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), data);
}
```

- [ ] **Step 2: Implement personaService**

Create `packages/shared/src/services/personaService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PersonaData, PersonaDataInput } from '../models/user/PersonaDataModel';
import { MAX_PERSONAS_PER_USER } from '../models/user/PersonaDataModel';

function personasCollection(userId: string) {
  return collection(db, 'users', userId, 'personas');
}

function personaDoc(userId: string, personaId: string) {
  return doc(db, 'users', userId, 'personas', personaId);
}

export async function getPersonas(userId: string): Promise<(PersonaData & { id: string })[]> {
  const q = query(personasCollection(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      birthday: data.birthday.toDate(),
      biography: data.biography ?? null,
      photoURL: data.photoURL ?? null,
      createdAt: data.createdAt.toDate(),
    };
  });
}

export async function getPersona(
  userId: string,
  personaId: string,
): Promise<(PersonaData & { id: string }) | null> {
  const snap = await getDoc(personaDoc(userId, personaId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    birthday: data.birthday.toDate(),
    biography: data.biography ?? null,
    photoURL: data.photoURL ?? null,
    createdAt: data.createdAt.toDate(),
  };
}

export async function createPersona(
  userId: string,
  input: PersonaDataInput,
): Promise<string> {
  const existing = await getDocs(personasCollection(userId));
  if (existing.size >= MAX_PERSONAS_PER_USER) {
    throw new Error(`Maximum ${MAX_PERSONAS_PER_USER} personas allowed per user`);
  }

  const ref = doc(personasCollection(userId));
  await setDoc(ref, {
    name: input.name,
    birthday: input.birthday,
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePersona(
  userId: string,
  personaId: string,
  data: Partial<Pick<PersonaData, 'name' | 'birthday' | 'biography' | 'photoURL'>>,
): Promise<void> {
  await updateDoc(personaDoc(userId, personaId), data);
}

export async function deletePersona(userId: string, personaId: string): Promise<void> {
  await deleteDoc(personaDoc(userId, personaId));
}
```

- [ ] **Step 3: Implement adminService**

Create `packages/shared/src/services/adminService.ts`:

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function isAppAdmin(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', userId));
  return snap.exists();
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/userService.ts packages/shared/src/services/personaService.ts packages/shared/src/services/adminService.ts
git commit -m "feat: add user, persona, and admin services"
```

---

### Task 10: Village and membership services

**Files:**
- Create: `packages/shared/src/services/villageService.ts`
- Create: `packages/shared/src/services/villageMemberService.ts`
- Create: `packages/shared/src/services/inviteTokenService.ts`

- [ ] **Step 1: Implement villageService**

Create `packages/shared/src/services/villageService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VillageData, VillageDataInput } from '../models/village/VillageDataModel';

const villagesCollection = collection(db, 'villages');

export async function getVillage(villageId: string): Promise<(VillageData & { id: string }) | null> {
  const snap = await getDoc(doc(db, 'villages', villageId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    description: data.description,
    coordinates: data.coordinates,
    comunidadAutonoma: data.comunidadAutonoma,
    provincia: data.provincia,
    images: data.images ?? [],
    adminUserId: data.adminUserId,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getVillages(): Promise<(VillageData & { id: string })[]> {
  const q = query(villagesCollection, orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.description,
      coordinates: data.coordinates,
      comunidadAutonoma: data.comunidadAutonoma,
      provincia: data.provincia,
      images: data.images ?? [],
      adminUserId: data.adminUserId,
      createdAt: data.createdAt.toDate(),
    };
  });
}

export async function createVillage(input: VillageDataInput): Promise<string> {
  const ref = doc(villagesCollection);
  await setDoc(ref, {
    name: input.name,
    description: input.description,
    coordinates: input.coordinates,
    comunidadAutonoma: input.comunidadAutonoma,
    provincia: input.provincia,
    images: input.images ?? [],
    adminUserId: input.adminUserId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVillage(
  villageId: string,
  data: Partial<Pick<VillageData, 'name' | 'description' | 'coordinates' | 'comunidadAutonoma' | 'provincia' | 'images'>>,
): Promise<void> {
  await updateDoc(doc(db, 'villages', villageId), data);
}

export async function deleteVillage(villageId: string): Promise<void> {
  await deleteDoc(doc(db, 'villages', villageId));
}
```

- [ ] **Step 2: Implement villageMemberService**

Create `packages/shared/src/services/villageMemberService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VillageMemberData, VillageMemberRole } from '../models/village/VillageMemberDataModel';

function membersCollection(villageId: string) {
  return collection(db, 'villages', villageId, 'members');
}

function memberDoc(villageId: string, userId: string) {
  return doc(db, 'villages', villageId, 'members', userId);
}

export async function getVillageMember(
  villageId: string,
  userId: string,
): Promise<(VillageMemberData & { id: string }) | null> {
  const snap = await getDoc(memberDoc(villageId, userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    role: data.role,
    joinedAt: data.joinedAt.toDate(),
  };
}

export async function getVillageMembers(
  villageId: string,
): Promise<(VillageMemberData & { id: string })[]> {
  const snap = await getDocs(membersCollection(villageId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      joinedAt: data.joinedAt.toDate(),
    };
  });
}

export async function addVillageMember(
  villageId: string,
  userId: string,
  role: VillageMemberRole = 'user',
): Promise<void> {
  await setDoc(memberDoc(villageId, userId), {
    role,
    joinedAt: serverTimestamp(),
  });
}

export async function removeVillageMember(
  villageId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(memberDoc(villageId, userId));
}

export async function isVillageMember(
  villageId: string,
  userId: string,
): Promise<boolean> {
  const snap = await getDoc(memberDoc(villageId, userId));
  return snap.exists();
}

export async function isVillageAdmin(
  villageId: string,
  userId: string,
): Promise<boolean> {
  const member = await getVillageMember(villageId, userId);
  return member?.role === 'admin';
}

export async function getUserVillages(
  userId: string,
): Promise<string[]> {
  const q = query(collectionGroup(db, 'members'), where('__name__', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.ref.parent.parent!.id);
}
```

- [ ] **Step 3: Implement inviteTokenService**

Create `packages/shared/src/services/inviteTokenService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { InviteTokenData } from '../models/village/InviteTokenDataModel';
import { isTokenExpired } from '../models/village/InviteTokenDataModel';

function tokensCollection(villageId: string) {
  return collection(db, 'villages', villageId, 'inviteTokens');
}

function tokenDoc(villageId: string, tokenId: string) {
  return doc(db, 'villages', villageId, 'inviteTokens', tokenId);
}

export async function createInviteToken(
  villageId: string,
  expiresAt?: Date | null,
): Promise<string> {
  const ref = doc(tokensCollection(villageId));
  await setDoc(ref, {
    createdAt: serverTimestamp(),
    expiresAt: expiresAt ?? null,
    usageCount: 0,
  });
  return ref.id;
}

export async function validateInviteToken(
  villageId: string,
  tokenId: string,
): Promise<boolean> {
  const snap = await getDoc(tokenDoc(villageId, tokenId));
  if (!snap.exists()) return false;
  const data = snap.data();
  const token: InviteTokenData = {
    createdAt: data.createdAt.toDate(),
    expiresAt: data.expiresAt?.toDate() ?? null,
    usageCount: data.usageCount,
  };
  return !isTokenExpired(token);
}

export async function consumeInviteToken(
  villageId: string,
  tokenId: string,
): Promise<void> {
  await updateDoc(tokenDoc(villageId, tokenId), {
    usageCount: increment(1),
  });
}

export async function getInviteTokens(
  villageId: string,
): Promise<(InviteTokenData & { id: string })[]> {
  const snap = await getDocs(tokensCollection(villageId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      createdAt: data.createdAt.toDate(),
      expiresAt: data.expiresAt?.toDate() ?? null,
      usageCount: data.usageCount,
    };
  });
}

export async function deleteInviteToken(
  villageId: string,
  tokenId: string,
): Promise<void> {
  await deleteDoc(tokenDoc(villageId, tokenId));
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/villageService.ts packages/shared/src/services/villageMemberService.ts packages/shared/src/services/inviteTokenService.ts
git commit -m "feat: add village, village member, and invite token services"
```

---

### Task 11: Organization and membership services

**Files:**
- Create: `packages/shared/src/services/organizationService.ts`
- Create: `packages/shared/src/services/orgMemberService.ts`

- [ ] **Step 1: Implement organizationService**

Create `packages/shared/src/services/organizationService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { OrganizationData, OrganizationDataInput, OrganizationStatus } from '../models/organization/OrganizationDataModel';

function orgsCollection(villageId: string) {
  return collection(db, 'villages', villageId, 'organizations');
}

function orgDoc(villageId: string, orgId: string) {
  return doc(db, 'villages', villageId, 'organizations', orgId);
}

export async function getOrganization(
  villageId: string,
  orgId: string,
): Promise<(OrganizationData & { id: string }) | null> {
  const snap = await getDoc(orgDoc(villageId, orgId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    description: data.description ?? null,
    type: data.type,
    status: data.status,
    requestedBy: data.requestedBy,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getOrganizations(
  villageId: string,
  status?: OrganizationStatus,
): Promise<(OrganizationData & { id: string })[]> {
  let q;
  if (status) {
    q = query(orgsCollection(villageId), where('status', '==', status), orderBy('name', 'asc'));
  } else {
    q = query(orgsCollection(villageId), orderBy('name', 'asc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      status: data.status,
      requestedBy: data.requestedBy,
      createdAt: data.createdAt.toDate(),
    };
  });
}

export async function requestOrganization(
  villageId: string,
  input: OrganizationDataInput,
): Promise<string> {
  const ref = doc(orgsCollection(villageId));
  await setDoc(ref, {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    status: 'pending',
    requestedBy: input.requestedBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function approveOrganization(
  villageId: string,
  orgId: string,
): Promise<void> {
  await updateDoc(orgDoc(villageId, orgId), { status: 'approved' });
}

export async function rejectOrganization(
  villageId: string,
  orgId: string,
): Promise<void> {
  await updateDoc(orgDoc(villageId, orgId), { status: 'rejected' });
}

export async function updateOrganization(
  villageId: string,
  orgId: string,
  data: Partial<Pick<OrganizationData, 'name' | 'description'>>,
): Promise<void> {
  await updateDoc(orgDoc(villageId, orgId), data);
}

export async function deleteOrganization(
  villageId: string,
  orgId: string,
): Promise<void> {
  await deleteDoc(orgDoc(villageId, orgId));
}
```

- [ ] **Step 2: Implement orgMemberService**

Create `packages/shared/src/services/orgMemberService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { OrgMemberData } from '../models/organization/OrgMemberDataModel';

function orgMembersCollection(villageId: string, orgId: string) {
  return collection(db, 'villages', villageId, 'organizations', orgId, 'members');
}

function orgMemberDoc(villageId: string, orgId: string, userId: string) {
  return doc(db, 'villages', villageId, 'organizations', orgId, 'members', userId);
}

export async function getOrgMembers(
  villageId: string,
  orgId: string,
): Promise<(OrgMemberData & { id: string })[]> {
  const snap = await getDocs(orgMembersCollection(villageId, orgId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      joinedAt: data.joinedAt.toDate(),
    };
  });
}

export async function addOrgMember(
  villageId: string,
  orgId: string,
  userId: string,
): Promise<void> {
  await setDoc(orgMemberDoc(villageId, orgId, userId), {
    joinedAt: serverTimestamp(),
  });
}

export async function removeOrgMember(
  villageId: string,
  orgId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(orgMemberDoc(villageId, orgId, userId));
}

export async function isOrgMember(
  villageId: string,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const snap = await getDoc(orgMemberDoc(villageId, orgId, userId));
  return snap.exists();
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/organizationService.ts packages/shared/src/services/orgMemberService.ts
git commit -m "feat: add organization and org member services"
```

---

### Task 12: Event service

**Files:**
- Create: `packages/shared/src/services/eventService.ts`

- [ ] **Step 1: Implement eventService**

Create `packages/shared/src/services/eventService.ts`:

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EventData, EventDataInput, EventStatus } from '../models/event/EventDataModel';

function eventsCollection(villageId: string) {
  return collection(db, 'villages', villageId, 'events');
}

function eventDoc(villageId: string, eventId: string) {
  return doc(db, 'villages', villageId, 'events', eventId);
}

function mapEventDoc(d: { id: string; data: () => Record<string, any> }): EventData & { id: string } {
  const data = d.data();
  return {
    id: d.id,
    title: data.title,
    description: data.description,
    startDate: data.startDate.toDate(),
    endDate: data.endDate?.toDate() ?? null,
    location: data.location,
    imageURL: data.imageURL ?? null,
    price: data.price ?? null,
    maxAttendees: data.maxAttendees ?? null,
    telephoneRequired: data.telephoneRequired ?? false,
    status: data.status,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    createdBy: data.createdBy,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  };
}

export async function getEvent(
  villageId: string,
  eventId: string,
): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(eventDoc(villageId, eventId));
  if (!snap.exists()) return null;
  return mapEventDoc(snap);
}

export async function getEvents(
  villageId: string,
  status?: EventStatus,
): Promise<(EventData & { id: string })[]> {
  let q;
  if (status) {
    q = query(
      eventsCollection(villageId),
      where('status', '==', status),
      orderBy('startDate', 'asc'),
    );
  } else {
    q = query(eventsCollection(villageId), orderBy('startDate', 'asc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(mapEventDoc);
}

export async function getOrgEvents(
  villageId: string,
  orgId: string,
): Promise<(EventData & { id: string })[]> {
  const q = query(
    eventsCollection(villageId),
    where('organizationId', '==', orgId),
    orderBy('startDate', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapEventDoc);
}

export async function createEvent(
  villageId: string,
  input: EventDataInput,
): Promise<string> {
  const ref = doc(eventsCollection(villageId));
  const now = serverTimestamp();
  await setDoc(ref, {
    title: input.title,
    description: input.description,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateEvent(
  villageId: string,
  eventId: string,
  data: Partial<Omit<EventDataInput, 'organizationId' | 'organizationName' | 'createdBy' | 'createdAt'>>,
): Promise<void> {
  const updateData: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  if (data.startDate) updateData.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) updateData.endDate = Timestamp.fromDate(data.endDate);
  if (data.endDate === null) updateData.endDate = null;
  await updateDoc(eventDoc(villageId, eventId), updateData);
}

export async function updateEventStatus(
  villageId: string,
  eventId: string,
  status: EventStatus,
): Promise<void> {
  await updateDoc(eventDoc(villageId, eventId), { status, updatedAt: serverTimestamp() });
}

export async function deleteEvent(
  villageId: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(eventDoc(villageId, eventId));
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/services/eventService.ts
git commit -m "feat: add event service with CRUD and status management"
```

---

### Task 13: Registration service with waitlist logic

**Files:**
- Create: `packages/shared/src/services/registrationService.ts`
- Create: `packages/shared/test/services/registrationService.test.ts`

- [ ] **Step 1: Write failing test for registration logic**

Create `packages/shared/test/services/registrationService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { determineRegistrationStatus } from '../../src/services/registrationService';

describe('determineRegistrationStatus', () => {
  it('returns confirmed when event has no max attendees', () => {
    expect(determineRegistrationStatus(null, 100)).toBe('confirmed');
  });

  it('returns confirmed when below max attendees', () => {
    expect(determineRegistrationStatus(50, 30)).toBe('confirmed');
  });

  it('returns waitlisted when at max attendees', () => {
    expect(determineRegistrationStatus(50, 50)).toBe('waitlisted');
  });

  it('returns waitlisted when above max attendees', () => {
    expect(determineRegistrationStatus(50, 55)).toBe('waitlisted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/services/registrationService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement registrationService**

Create `packages/shared/src/services/registrationService.ts`:

```typescript
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  collectionGroup,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { RegistrationData, RegistrationStatus } from '../models/event/RegistrationDataModel';

function registrationsCollection(villageId: string, eventId: string) {
  return collection(db, 'villages', villageId, 'events', eventId, 'registrations');
}

function registrationDoc(villageId: string, eventId: string, regId: string) {
  return doc(db, 'villages', villageId, 'events', eventId, 'registrations', regId);
}

export function determineRegistrationStatus(
  maxAttendees: number | null,
  currentConfirmedCount: number,
): RegistrationStatus {
  if (maxAttendees === null) return 'confirmed';
  return currentConfirmedCount < maxAttendees ? 'confirmed' : 'waitlisted';
}

function mapRegistrationDoc(d: { id: string; data: () => Record<string, any> }): RegistrationData & { id: string } {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId,
    personaId: data.personaId ?? null,
    name: data.name,
    status: data.status,
    position: data.position,
    registeredAt: data.registeredAt.toDate(),
  };
}

export async function getEventRegistrations(
  villageId: string,
  eventId: string,
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(
    registrationsCollection(villageId, eventId),
    orderBy('position', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapRegistrationDoc);
}

export async function getConfirmedCount(
  villageId: string,
  eventId: string,
): Promise<number> {
  const q = query(
    registrationsCollection(villageId, eventId),
    where('status', '==', 'confirmed'),
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function getTotalCount(
  villageId: string,
  eventId: string,
): Promise<number> {
  const snap = await getCountFromServer(registrationsCollection(villageId, eventId));
  return snap.data().count;
}

export async function getUserRegistrations(
  villageId: string,
  eventId: string,
  userId: string,
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(
    registrationsCollection(villageId, eventId),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapRegistrationDoc);
}

export interface RegisterInput {
  userId: string;
  personaId: string | null;
  name: string;
}

export async function registerToEvent(
  villageId: string,
  eventId: string,
  inputs: RegisterInput[],
  maxAttendees: number | null,
): Promise<string[]> {
  const confirmedCount = await getConfirmedCount(villageId, eventId);
  const totalCount = await getTotalCount(villageId, eventId);

  const batch = writeBatch(db);
  const ids: string[] = [];

  inputs.forEach((input, i) => {
    const position = totalCount + i + 1;
    const status = determineRegistrationStatus(maxAttendees, confirmedCount + i);
    const adjustedStatus: RegistrationStatus =
      status === 'confirmed' && i > 0
        ? determineRegistrationStatus(maxAttendees, confirmedCount + i)
        : status;

    const ref = doc(registrationsCollection(villageId, eventId));
    batch.set(ref, {
      userId: input.userId,
      personaId: input.personaId,
      name: input.name,
      status: adjustedStatus,
      position,
      registeredAt: serverTimestamp(),
    });
    ids.push(ref.id);
  });

  await batch.commit();
  return ids;
}

export async function cancelRegistration(
  villageId: string,
  eventId: string,
  regId: string,
): Promise<void> {
  await deleteDoc(registrationDoc(villageId, eventId, regId));
}

export async function getUserRegistrationsAcrossVillages(
  userId: string,
): Promise<(RegistrationData & { id: string; eventPath: string })[]> {
  const q = query(
    collectionGroup(db, 'registrations'),
    where('userId', '==', userId),
    orderBy('registeredAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      eventPath: d.ref.parent.parent!.path,
      userId: data.userId,
      personaId: data.personaId ?? null,
      name: data.name,
      status: data.status,
      position: data.position,
      registeredAt: data.registeredAt.toDate(),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test -- test/services/registrationService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/registrationService.ts packages/shared/test/services/registrationService.test.ts
git commit -m "feat: add registration service with waitlist logic, batch sign-ups, and cross-village queries"
```

---

### Task 14: Notification service and services barrel export

**Files:**
- Create: `packages/shared/src/services/notificationService.ts`
- Modify: `packages/shared/src/services/index.ts`

- [ ] **Step 1: Implement notificationService**

Create `packages/shared/src/services/notificationService.ts`:

```typescript
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { NotificationData, NotificationDataInput } from '../models/notification/NotificationDataModel';

function notificationsCollection(userId: string) {
  return collection(db, 'users', userId, 'notifications');
}

function notificationDoc(userId: string, notifId: string) {
  return doc(db, 'users', userId, 'notifications', notifId);
}

export async function getNotifications(
  userId: string,
  maxResults: number = 50,
): Promise<(NotificationData & { id: string })[]> {
  const q = query(
    notificationsCollection(userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      title: data.title,
      body: data.body,
      eventId: data.eventId ?? null,
      villageId: data.villageId ?? null,
      read: data.read ?? false,
      createdAt: data.createdAt.toDate(),
    };
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    notificationsCollection(userId),
    where('read', '==', false),
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function createNotification(
  userId: string,
  input: NotificationDataInput,
): Promise<string> {
  const ref = doc(notificationsCollection(userId));
  await setDoc(ref, {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    villageId: input.villageId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await updateDoc(notificationDoc(userId, notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    notificationsCollection(userId),
    where('read', '==', false),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}
```

- [ ] **Step 2: Create services barrel export**

Replace `packages/shared/src/services/index.ts`:

```typescript
export * from './userService';
export * from './personaService';
export * from './adminService';
export * from './villageService';
export * from './villageMemberService';
export * from './inviteTokenService';
export * from './organizationService';
export * from './orgMemberService';
export * from './eventService';
export * from './registrationService';
export * from './notificationService';
```

- [ ] **Step 3: Create utils barrel export**

Replace `packages/shared/src/utils/index.ts`:

```typescript
// Utils will be added as needed
```

- [ ] **Step 4: Run full test suite and build**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test && pnpm --filter @cultuvilla/shared build`
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/ packages/shared/src/utils/
git commit -m "feat: add notification service and wire up all service barrel exports"
```

---

## Phase 3: Firestore Security Rules

### Task 15: Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Write complete Firestore security rules**

Replace `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ===== Helper functions =====

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAppAdmin() {
      return isAuthenticated() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    function isVillageAdmin(villageId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/villages/$(villageId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    function isVillageMember(villageId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/villages/$(villageId)/members/$(request.auth.uid));
    }

    function isOrgMember(villageId, orgId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/villages/$(villageId)/organizations/$(orgId)/members/$(request.auth.uid));
    }

    // ===== App-wide admins =====

    match /admins/{userId} {
      allow read: if isAppAdmin();
      allow write: if false; // Managed manually in Firebase console
    }

    // ===== Users =====

    match /users/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false;

      match /personas/{personaId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId);
        allow update: if isOwner(userId);
        allow delete: if isOwner(userId);
      }

      match /notifications/{notifId} {
        allow read: if isOwner(userId);
        allow update: if isOwner(userId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
        allow create: if false; // Created by Cloud Functions only
        allow delete: if false;
      }
    }

    // ===== Villages =====

    match /villages/{villageId} {
      allow read: if true;
      allow create: if isAppAdmin();
      allow update: if isVillageAdmin(villageId) || isAppAdmin();
      allow delete: if isAppAdmin();

      // Village members
      match /members/{userId} {
        allow read: if true;
        allow create: if isVillageAdmin(villageId) || isAppAdmin();
        allow update: if isVillageAdmin(villageId);
        allow delete: if isVillageAdmin(villageId) || isOwner(userId);
      }

      // Invite tokens
      match /inviteTokens/{tokenId} {
        allow read: if true; // Needed for token validation on sign-up
        allow create: if isVillageAdmin(villageId);
        allow update: if isAuthenticated(); // For incrementing usage count
        allow delete: if isVillageAdmin(villageId);
      }

      // Organizations
      match /organizations/{orgId} {
        allow read: if isVillageMember(villageId) || isAppAdmin();
        allow create: if isVillageMember(villageId);
        allow update: if isVillageAdmin(villageId);
        allow delete: if isVillageAdmin(villageId);

        // Org members
        match /members/{memberId} {
          allow read: if isVillageMember(villageId);
          allow create: if isOrgMember(villageId, orgId) || isVillageAdmin(villageId);
          allow delete: if isOrgMember(villageId, orgId) || isVillageAdmin(villageId) || isOwner(memberId);
        }
      }

      // Events
      match /events/{eventId} {
        allow read: if true;
        allow create: if isOrgMember(villageId, request.resource.data.organizationId);
        allow update: if isOrgMember(villageId, resource.data.organizationId) || isVillageAdmin(villageId);
        allow delete: if isOrgMember(villageId, resource.data.organizationId) || isVillageAdmin(villageId);

        // Registrations
        match /registrations/{regId} {
          allow read: if true;
          allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
          allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
          allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: rewrite Firestore security rules for village-scoped data model"
```

---

### Task 16: Storage rules

**Files:**
- Modify: `storage.rules`

- [ ] **Step 1: Update storage rules**

Replace `storage.rules`:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Village images
    match /villages/{villageId}/images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Event images
    match /villages/{villageId}/events/{eventId}/image/{imageId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // User profile photos
    match /users/{userId}/photo/{imageId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Persona photos
    match /users/{userId}/personas/{personaId}/photo/{imageId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add storage.rules
git commit -m "feat: update storage rules for village-scoped paths and user photos"
```

---

## Phase 4: Web App — Foundation

### Task 17: Install dependencies and configure i18n

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/i18n/config.ts`
- Create: `apps/web/i18n/messages/es.json`
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Install next-intl**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter cultuvilla-web add next-intl`

- [ ] **Step 2: Create i18n config**

Create `apps/web/i18n/config.ts`:

```typescript
export const locales = ['es'] as const;
export const defaultLocale = 'es';
export type Locale = (typeof locales)[number];
```

- [ ] **Step 3: Create Spanish messages file**

Create `apps/web/i18n/messages/es.json`:

```json
{
  "common": {
    "loading": "Cargando...",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "create": "Crear",
    "confirm": "Confirmar",
    "back": "Volver",
    "search": "Buscar",
    "noResults": "Sin resultados"
  },
  "auth": {
    "signIn": "Iniciar sesión",
    "signUp": "Registrarse",
    "signOut": "Cerrar sesión",
    "signInWithGoogle": "Continuar con Google",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "displayName": "Nombre",
    "birthday": "Fecha de nacimiento",
    "alreadyHaveAccount": "¿Ya tienes cuenta?",
    "noAccount": "¿No tienes cuenta?"
  },
  "nav": {
    "home": "Inicio",
    "mySignups": "Mis inscripciones",
    "notifications": "Notificaciones",
    "profile": "Perfil"
  },
  "village": {
    "title": "Pueblos",
    "events": "Eventos",
    "organizations": "Organizaciones",
    "members": "Miembros",
    "admin": "Administración",
    "joinVillage": "Unirse al pueblo",
    "inviteLink": "Enlace de invitación",
    "generateInvite": "Generar invitación"
  },
  "event": {
    "title": "Título",
    "description": "Descripción",
    "startDate": "Fecha de inicio",
    "endDate": "Fecha de fin",
    "location": "Ubicación",
    "price": "Precio",
    "free": "Gratis",
    "maxAttendees": "Máximo de asistentes",
    "unlimited": "Sin límite",
    "telephoneRequired": "Teléfono requerido",
    "signUp": "Inscribirse",
    "cancelSignUp": "Cancelar inscripción",
    "spotsLeft": "{count} plazas disponibles",
    "full": "Completo",
    "waitlist": "Lista de espera",
    "confirmed": "Confirmado",
    "waitlisted": "En lista de espera",
    "attendees": "Asistentes",
    "draft": "Borrador",
    "published": "Publicado",
    "cancelled": "Cancelado",
    "completed": "Completado",
    "publish": "Publicar",
    "createEvent": "Crear evento",
    "editEvent": "Editar evento"
  },
  "organization": {
    "name": "Nombre",
    "type": "Tipo",
    "ayuntamiento": "Ayuntamiento",
    "peña": "Peña",
    "asociación": "Asociación",
    "requestOrg": "Solicitar organización",
    "pending": "Pendiente",
    "approved": "Aprobada",
    "rejected": "Rechazada",
    "approve": "Aprobar",
    "reject": "Rechazar"
  },
  "profile": {
    "myProfile": "Mi perfil",
    "personas": "Personas a cargo",
    "addPersona": "Añadir persona",
    "editPersona": "Editar persona",
    "biography": "Biografía",
    "telephone": "Teléfono",
    "photo": "Foto"
  },
  "notifications": {
    "title": "Notificaciones",
    "markAllRead": "Marcar todo como leído",
    "noNotifications": "No tienes notificaciones",
    "waitlistPromoted": "¡Te han confirmado la plaza!",
    "eventCancelled": "Evento cancelado",
    "eventUpdated": "Evento actualizado",
    "orgApproved": "Organización aprobada",
    "orgRejected": "Organización rechazada"
  }
}
```

- [ ] **Step 4: Create i18n middleware**

Create `apps/web/middleware.ts`:

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 5: Update next.config.ts**

Replace `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/config.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  images: {
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/i18n/ apps/web/middleware.ts apps/web/next.config.ts pnpm-lock.yaml
git commit -m "feat: add next-intl with Spanish translations and middleware"
```

---

### Task 18: Auth context rewrite

**Files:**
- Modify: `apps/web/contexts/AuthContext.tsx` (move from `lib/auth-context.tsx`)

- [ ] **Step 1: Create contexts directory and rewrite AuthContext**

Create `apps/web/contexts/AuthContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '@cultuvilla/shared/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Create useAuth hook re-export**

Create `apps/web/hooks/useAuth.ts`:

```typescript
export { useAuth } from '../contexts/AuthContext';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/contexts/AuthContext.tsx apps/web/hooks/useAuth.ts
git commit -m "feat: rewrite AuthContext with separated sign-in/sign-up and hooks pattern"
```

---

### Task 19: Village context

**Files:**
- Create: `apps/web/contexts/VillageContext.tsx`
- Create: `apps/web/hooks/useVillage.ts`

- [ ] **Step 1: Create VillageContext**

Create `apps/web/contexts/VillageContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getVillage } from '@cultuvilla/shared/services/villageService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from './AuthContext';
import type { VillageData } from '@cultuvilla/shared/models/village';
import type { VillageMemberData } from '@cultuvilla/shared/models/village';

interface VillageContextValue {
  village: (VillageData & { id: string }) | null;
  membership: (VillageMemberData & { id: string }) | null;
  isMember: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const VillageContext = createContext<VillageContextValue | null>(null);

interface VillageProviderProps {
  villageId: string;
  children: ReactNode;
}

export function VillageProvider({ villageId, children }: VillageProviderProps) {
  const { user } = useAuth();
  const [village, setVillage] = useState<(VillageData & { id: string }) | null>(null);
  const [membership, setMembership] = useState<(VillageMemberData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [v, m] = await Promise.all([
        getVillage(villageId),
        user ? getVillageMember(villageId, user.uid) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setVillage(v);
        setMembership(m);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [villageId, user]);

  return (
    <VillageContext.Provider
      value={{
        village,
        membership,
        isMember: membership !== null,
        isAdmin: membership?.role === 'admin',
        loading,
      }}
    >
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage(): VillageContextValue {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error('useVillage must be used within VillageProvider');
  return ctx;
}
```

- [ ] **Step 2: Create useVillage hook re-export**

Create `apps/web/hooks/useVillage.ts`:

```typescript
export { useVillage } from '../contexts/VillageContext';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/contexts/VillageContext.tsx apps/web/hooks/useVillage.ts
git commit -m "feat: add VillageContext with membership and admin detection"
```

---

### Task 20: Common UI components

**Files:**
- Create: `apps/web/components/common/BottomNav.tsx`
- Create: `apps/web/components/common/TopBar.tsx`
- Create: `apps/web/components/common/SkeletonLoader.tsx`

- [ ] **Step 1: Create BottomNav**

Create `apps/web/components/common/BottomNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, Bell, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getUnreadCount } from '@cultuvilla/shared/services/notificationService';

interface NavItem {
  href: string;
  icon: typeof Home;
  label: string;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Inicio' },
  { href: '/my-signups', icon: CalendarCheck, label: 'Inscripciones', requiresAuth: true },
  { href: '/notifications', icon: Bell, label: 'Notificaciones', requiresAuth: true },
  { href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.uid).then(setUnreadCount);
  }, [user]);

  const visibleItems = navItems.filter(
    (item) => !item.requiresAuth || user,
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={user ? item.href : '/login'}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                <Icon size={22} />
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create TopBar**

Create `apps/web/components/common/TopBar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';

interface TopBarProps {
  title: string;
  showMenu?: boolean;
  onMenuClick?: () => void;
}

export function TopBar({ title, showMenu, onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-40">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <Link href="/" className="text-lg font-bold text-blue-600">
          {title}
        </Link>
        {showMenu && (
          <button onClick={onMenuClick} className="p-2">
            <Menu size={22} />
          </button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create SkeletonLoader**

Create `apps/web/components/common/SkeletonLoader.tsx`:

```typescript
export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
      <SkeletonLoader className="h-5 w-3/4" />
      <SkeletonLoader className="h-4 w-1/2" />
      <SkeletonLoader className="h-4 w-1/3" />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/common/
git commit -m "feat: add BottomNav, TopBar, and SkeletonLoader common components"
```

---

### Task 21: Root layout rewrite

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Rewrite root layout**

Replace `apps/web/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/common/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cultuvilla',
  description: 'Eventos de tu pueblo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <main className="pb-20 max-w-lg mx-auto min-h-screen">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Simplify globals.css**

Replace `apps/web/app/globals.css`:

```css
@import 'tailwindcss';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat: rewrite root layout with mobile-first structure and bottom nav"
```

---

## Phase 5: Web App — Pages

### Task 22: Landing page (village discovery)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/village/VillageCard.tsx`

- [ ] **Step 1: Create VillageCard**

Create `apps/web/components/village/VillageCard.tsx`:

```typescript
import Link from 'next/link';
import type { VillageData } from '@cultuvilla/shared/models/village';

interface VillageCardProps {
  village: VillageData & { id: string };
}

export function VillageCard({ village }: VillageCardProps) {
  return (
    <Link
      href={`/village/${village.id}`}
      className="block bg-white rounded-lg shadow-sm overflow-hidden"
    >
      {village.images.length > 0 && (
        <img
          src={village.images[0]}
          alt={village.name}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="p-4">
        <h2 className="font-bold text-lg">{village.name}</h2>
        <p className="text-sm text-gray-500">
          {village.provincia}, {village.comunidadAutonoma}
        </p>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {village.description}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Rewrite landing page**

Replace `apps/web/app/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getVillages } from '@cultuvilla/shared/services/villageService';
import { TopBar } from '@/components/common/TopBar';
import { VillageCard } from '@/components/village/VillageCard';
import { EventCardSkeleton } from '@/components/common/SkeletonLoader';
import type { VillageData } from '@cultuvilla/shared/models/village';

export default function HomePage() {
  const [villages, setVillages] = useState<(VillageData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVillages().then((v) => {
      setVillages(v);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <TopBar title="Cultuvilla" />
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Pueblos</h1>
        {loading ? (
          <div className="space-y-4">
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        ) : villages.length === 0 ? (
          <p className="text-gray-500">No hay pueblos disponibles</p>
        ) : (
          <div className="space-y-4">
            {villages.map((village) => (
              <VillageCard key={village.id} village={village} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/village/VillageCard.tsx
git commit -m "feat: rewrite landing page with village discovery"
```

---

### Task 23: Village home page with events list

**Files:**
- Create: `apps/web/app/village/[id]/layout.tsx`
- Create: `apps/web/app/village/[id]/page.tsx`
- Create: `apps/web/components/event/EventCard.tsx`

- [ ] **Step 1: Create village layout with VillageProvider**

Create `apps/web/app/village/[id]/layout.tsx`:

```typescript
'use client';

import { use } from 'react';
import { VillageProvider } from '@/contexts/VillageContext';

export default function VillageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <VillageProvider villageId={id}>{children}</VillageProvider>;
}
```

- [ ] **Step 2: Create EventCard**

Create `apps/web/components/event/EventCard.tsx`:

```typescript
import Link from 'next/link';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { EventData } from '@cultuvilla/shared/models/event';

interface EventCardProps {
  event: EventData & { id: string };
  villageId: string;
  confirmedCount?: number;
}

export function EventCard({ event, villageId, confirmedCount }: EventCardProps) {
  const dateStr = event.startDate.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const locationStr = event.location.type === 'text'
    ? event.location.text
    : 'Ver ubicación';

  const spotsInfo = event.maxAttendees
    ? `${confirmedCount ?? 0}/${event.maxAttendees}`
    : `${confirmedCount ?? 0}`;

  const statusBadge = event.status !== 'published' ? (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      event.status === 'cancelled' ? 'bg-red-100 text-red-700' :
      event.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
      'bg-gray-100 text-gray-700'
    }`}>
      {event.status === 'draft' ? 'Borrador' :
       event.status === 'cancelled' ? 'Cancelado' : 'Completado'}
    </span>
  ) : null;

  return (
    <Link
      href={`/village/${villageId}/event/${event.id}`}
      className="block bg-white rounded-lg shadow-sm overflow-hidden"
    >
      {event.imageURL && (
        <img
          src={event.imageURL}
          alt={event.title}
          className="w-full h-36 object-cover"
        />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base">{event.title}</h3>
          {statusBadge}
        </div>
        <p className="text-xs text-gray-500">{event.organizationName}</p>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Calendar size={14} /> {dateStr}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <MapPin size={14} /> {locationStr}
          </span>
          <span className="flex items-center gap-1">
            <Users size={14} /> {spotsInfo}
          </span>
        </div>
        {event.price != null && event.price > 0 && (
          <p className="text-sm font-medium text-green-700">{event.price}€</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create village home page**

Create `apps/web/app/village/[id]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useVillage } from '@/hooks/useVillage';
import { getEvents } from '@cultuvilla/shared/services/eventService';
import { TopBar } from '@/components/common/TopBar';
import { EventCard } from '@/components/event/EventCard';
import { EventCardSkeleton } from '@/components/common/SkeletonLoader';
import type { EventData } from '@cultuvilla/shared/models/event';

export default function VillageHomePage() {
  const { village, loading: villageLoading } = useVillage();
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!village) return;
    getEvents(village.id, 'published').then((e) => {
      setEvents(e);
      setLoading(false);
    });
  }, [village]);

  if (villageLoading) {
    return (
      <>
        <TopBar title="Cargando..." />
        <div className="p-4 space-y-4">
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      </>
    );
  }

  if (!village) {
    return (
      <>
        <TopBar title="Cultuvilla" />
        <div className="p-4">
          <p className="text-gray-500">Pueblo no encontrado</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={village.name} />
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Próximos eventos</h1>
        {loading ? (
          <div className="space-y-4">
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        ) : events.length === 0 ? (
          <p className="text-gray-500">No hay eventos próximos</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} villageId={village.id} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/village/ apps/web/components/event/EventCard.tsx
git commit -m "feat: add village home page with events list and EventCard component"
```

---

### Task 24: Event detail page with sign-up

**Files:**
- Create: `apps/web/app/village/[id]/event/[eventId]/page.tsx`
- Create: `apps/web/components/event/SignUpModal.tsx`
- Create: `apps/web/components/event/AttendeeList.tsx`
- Create: `apps/web/hooks/usePersonas.ts`
- Create: `apps/web/hooks/useRegistrations.ts`

- [ ] **Step 1: Create usePersonas hook**

Create `apps/web/hooks/usePersonas.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getPersonas } from '@cultuvilla/shared/services/personaService';
import { useAuth } from './useAuth';
import type { PersonaData } from '@cultuvilla/shared/models/user';

export function usePersonas() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<(PersonaData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPersonas([]);
      setLoading(false);
      return;
    }
    getPersonas(user.uid).then((p) => {
      setPersonas(p);
      setLoading(false);
    });
  }, [user]);

  return { personas, loading, refresh: () => {
    if (user) getPersonas(user.uid).then(setPersonas);
  }};
}
```

- [ ] **Step 2: Create useRegistrations hook**

Create `apps/web/hooks/useRegistrations.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  getEventRegistrations,
  getUserRegistrations,
  getConfirmedCount,
} from '@cultuvilla/shared/services/registrationService';
import { useAuth } from './useAuth';
import type { RegistrationData } from '@cultuvilla/shared/models/event';

export function useRegistrations(villageId: string, eventId: string) {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [allRegs, confirmed] = await Promise.all([
      getEventRegistrations(villageId, eventId),
      getConfirmedCount(villageId, eventId),
    ]);
    setRegistrations(allRegs);
    setConfirmedCount(confirmed);

    if (user) {
      const mine = await getUserRegistrations(villageId, eventId, user.uid);
      setMyRegistrations(mine);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [villageId, eventId, user]);

  return { registrations, myRegistrations, confirmedCount, loading, refresh: load };
}
```

- [ ] **Step 3: Create SignUpModal**

Create `apps/web/components/event/SignUpModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePersonas } from '@/hooks/usePersonas';
import { registerToEvent, type RegisterInput } from '@cultuvilla/shared/services/registrationService';
import { getUserProfile } from '@cultuvilla/shared/services/userService';

interface SignUpModalProps {
  villageId: string;
  eventId: string;
  maxAttendees: number | null;
  telephoneRequired: boolean;
  alreadySignedUpIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignUpModal({
  villageId,
  eventId,
  maxAttendees,
  telephoneRequired,
  alreadySignedUpIds,
  onClose,
  onSuccess,
}: SignUpModalProps) {
  const { user } = useAuth();
  const { personas } = usePersonas();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selfKey = 'self';
  const isSelfSignedUp = alreadySignedUpIds.has('self');

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    if (!user || selected.size === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      if (telephoneRequired) {
        const profile = await getUserProfile(user.uid);
        if (!profile?.telephone) {
          setError('Debes añadir tu teléfono en tu perfil para inscribirte a este evento');
          setSubmitting(false);
          return;
        }
      }

      const inputs: RegisterInput[] = [];
      if (selected.has(selfKey)) {
        const profile = await getUserProfile(user.uid);
        inputs.push({
          userId: user.uid,
          personaId: null,
          name: profile?.displayName ?? user.displayName ?? 'Usuario',
        });
      }

      for (const persona of personas) {
        if (selected.has(persona.id)) {
          inputs.push({
            userId: user.uid,
            personaId: persona.id,
            name: persona.name,
          });
        }
      }

      await registerToEvent(villageId, eventId, inputs, maxAttendees);
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? 'Error al inscribirse');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Inscribirse al evento</h2>

        <div className="space-y-2">
          {!isSelfSignedUp && (
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(selfKey)}
                onChange={() => toggle(selfKey)}
                className="w-5 h-5"
              />
              <span className="font-medium">Yo mismo</span>
            </label>
          )}

          {personas.map((persona) => {
            if (alreadySignedUpIds.has(persona.id)) return null;
            return (
              <label
                key={persona.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(persona.id)}
                  onChange={() => toggle(persona.id)}
                  className="w-5 h-5"
                />
                <span>{persona.name}</span>
              </label>
            );
          })}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            className="flex-1 py-3 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Inscribiendo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create AttendeeList**

Create `apps/web/components/event/AttendeeList.tsx`:

```typescript
import type { RegistrationData } from '@cultuvilla/shared/models/event';

interface AttendeeListProps {
  registrations: (RegistrationData & { id: string })[];
  isMember: boolean;
  totalCount: number;
}

export function AttendeeList({ registrations, isMember, totalCount }: AttendeeListProps) {
  if (!isMember) {
    return (
      <div className="text-sm text-gray-500">
        {totalCount} {totalCount === 1 ? 'persona inscrita' : 'personas inscritas'}
      </div>
    );
  }

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const waitlisted = registrations.filter((r) => r.status === 'waitlisted');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm text-gray-700 mb-2">
          Confirmados ({confirmed.length})
        </h3>
        {confirmed.length === 0 ? (
          <p className="text-sm text-gray-400">Nadie inscrito todavía</p>
        ) : (
          <ul className="space-y-1">
            {confirmed.map((reg) => (
              <li key={reg.id} className="text-sm py-1 px-2 bg-green-50 rounded">
                {reg.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {waitlisted.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-gray-700 mb-2">
            Lista de espera ({waitlisted.length})
          </h3>
          <ul className="space-y-1">
            {waitlisted.map((reg) => (
              <li key={reg.id} className="text-sm py-1 px-2 bg-yellow-50 rounded">
                {reg.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create event detail page**

Create `apps/web/app/village/[id]/event/[eventId]/page.tsx`:

```typescript
'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useVillage } from '@/hooks/useVillage';
import { useRegistrations } from '@/hooks/useRegistrations';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import { cancelRegistration } from '@cultuvilla/shared/services/registrationService';
import { TopBar } from '@/components/common/TopBar';
import { SignUpModal } from '@/components/event/SignUpModal';
import { AttendeeList } from '@/components/event/AttendeeList';
import { EventCardSkeleton } from '@/components/common/SkeletonLoader';
import { Calendar, MapPin, Users, Phone, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { EventData } from '@cultuvilla/shared/models/event';

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id: villageId, eventId } = use(params);
  const { user } = useAuth();
  const { village, isMember } = useVillage();
  const { registrations, myRegistrations, confirmedCount, loading: regsLoading, refresh } = useRegistrations(villageId, eventId);
  const [event, setEvent] = useState<(EventData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    getEvent(villageId, eventId).then((e) => {
      setEvent(e);
      setLoading(false);
    });
  }, [villageId, eventId]);

  if (loading) {
    return (
      <>
        <TopBar title="Cargando..." />
        <div className="p-4"><EventCardSkeleton /></div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <TopBar title="Cultuvilla" />
        <div className="p-4"><p className="text-gray-500">Evento no encontrado</p></div>
      </>
    );
  }

  const alreadySignedUpIds = new Set(
    myRegistrations.map((r) => r.personaId ?? 'self'),
  );

  const spotsLeft = event.maxAttendees ? event.maxAttendees - confirmedCount : null;
  const canSignUp = event.status === 'published' && user;

  async function handleCancelRegistration(regId: string) {
    if (!confirm('¿Cancelar esta inscripción?')) return;
    await cancelRegistration(villageId, eventId, regId);
    refresh();
  }

  return (
    <>
      <TopBar title={village?.name ?? 'Evento'} />
      <div className="p-4 space-y-4">
        <Link href={`/village/${villageId}`} className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver
        </Link>

        {event.imageURL && (
          <img src={event.imageURL} alt={event.title} className="w-full h-48 object-cover rounded-lg" />
        )}

        <h1 className="text-xl font-bold">{event.title}</h1>
        <p className="text-xs text-gray-500">{event.organizationName}</p>

        <div className="space-y-2 text-sm text-gray-600">
          <p className="flex items-center gap-2">
            <Calendar size={16} />
            {event.startDate.toLocaleDateString('es-ES', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
            {event.endDate && ` — ${event.endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={16} />
            {event.location.type === 'text' ? event.location.text : 'Ver en mapa'}
          </p>
          <p className="flex items-center gap-2">
            <Users size={16} />
            {confirmedCount} inscritos
            {spotsLeft !== null && ` · ${spotsLeft > 0 ? `${spotsLeft} plazas` : 'Completo'}`}
          </p>
          {event.telephoneRequired && (
            <p className="flex items-center gap-2 text-amber-600">
              <Phone size={16} /> Teléfono requerido
            </p>
          )}
        </div>

        {event.price != null && event.price > 0 && (
          <p className="text-lg font-bold text-green-700">{event.price}€</p>
        )}

        <div className="text-sm text-gray-700 whitespace-pre-wrap">
          {event.description}
        </div>

        {/* Sign-up button */}
        {canSignUp && (
          <button
            onClick={() => setShowSignUp(true)}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium"
          >
            Inscribirse
          </button>
        )}

        {!user && event.status === 'published' && (
          <Link
            href="/login"
            className="block w-full py-3 text-center rounded-lg bg-blue-600 text-white font-medium"
          >
            Inicia sesión para inscribirte
          </Link>
        )}

        {/* My registrations */}
        {myRegistrations.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-sm">Mis inscripciones</h2>
            {myRegistrations.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{reg.name}</p>
                  <p className={`text-xs ${reg.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                    {reg.status === 'confirmed' ? 'Confirmado' : 'En lista de espera'}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelRegistration(reg.id)}
                  className="text-xs text-red-600 px-3 py-1 border border-red-200 rounded"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Attendee list */}
        <div>
          <h2 className="font-semibold text-sm mb-2">Asistentes</h2>
          <AttendeeList
            registrations={registrations}
            isMember={isMember}
            totalCount={registrations.length}
          />
        </div>
      </div>

      {showSignUp && (
        <SignUpModal
          villageId={villageId}
          eventId={eventId}
          maxAttendees={event.maxAttendees}
          telephoneRequired={event.telephoneRequired}
          alreadySignedUpIds={alreadySignedUpIds}
          onClose={() => setShowSignUp(false)}
          onSuccess={() => {
            setShowSignUp(false);
            refresh();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/village/[id]/event/ apps/web/components/event/ apps/web/hooks/usePersonas.ts apps/web/hooks/useRegistrations.ts
git commit -m "feat: add event detail page with sign-up modal, attendee list, and cancellation"
```

---

### Task 25: Login page rewrite

**Files:**
- Modify: `apps/web/app/login/page.tsx`

- [ ] **Step 1: Rewrite login page**

Replace `apps/web/app/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createUserProfile } from '@cultuvilla/shared/services/userService';
import { TopBar } from '@/components/common/TopBar';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    router.push('/');
    return null;
  }

  async function handleGoogleSignIn() {
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        // Create user profile after sign-up
        const { getAuth } = await import('firebase/auth');
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          await createUserProfile(currentUser.uid, {
            displayName,
            email,
            birthday: new Date(birthday),
          });
        }
      } else {
        await signInWithEmail(email, password);
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar title="Cultuvilla" />
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">
          {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
        </h1>

        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 border border-gray-300 rounded-lg font-medium flex items-center justify-center gap-2"
        >
          Continuar con Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-50 px-2 text-gray-500">o</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Nombre"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="date"
                placeholder="Fecha de nacimiento"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-blue-600 font-medium"
          >
            {isSignUp ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/login/page.tsx
git commit -m "feat: rewrite login page with sign-up flow including name and birthday"
```

---

### Task 26: Invite link page

**Files:**
- Create: `apps/web/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create invite page**

Create `apps/web/app/invite/[token]/page.tsx`:

```typescript
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { validateInviteToken, consumeInviteToken } from '@cultuvilla/shared/services/inviteTokenService';
import { addVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { getVillage } from '@cultuvilla/shared/services/villageService';
import { TopBar } from '@/components/common/TopBar';
import type { VillageData } from '@cultuvilla/shared/models/village';

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const villageId = searchParams.get('v');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [village, setVillage] = useState<(VillageData & { id: string }) | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'joined' | 'error'>('loading');

  useEffect(() => {
    if (!villageId) {
      setStatus('invalid');
      return;
    }

    async function check() {
      const [v, valid] = await Promise.all([
        getVillage(villageId!),
        validateInviteToken(villageId!, token),
      ]);
      setVillage(v);
      setStatus(valid && v ? 'valid' : 'invalid');
    }

    check();
  }, [villageId, token]);

  useEffect(() => {
    if (status !== 'valid' || !user || !villageId || authLoading) return;

    async function join() {
      try {
        await addVillageMember(villageId!, user!.uid);
        await consumeInviteToken(villageId!, token);
        setStatus('joined');
        setTimeout(() => router.push(`/village/${villageId}`), 2000);
      } catch {
        setStatus('error');
      }
    }

    join();
  }, [status, user, villageId, authLoading]);

  return (
    <>
      <TopBar title="Cultuvilla" />
      <div className="p-6 text-center space-y-4">
        {status === 'loading' && <p className="text-gray-500">Verificando invitación...</p>}
        {status === 'invalid' && <p className="text-red-600">Invitación no válida o expirada</p>}
        {status === 'error' && <p className="text-red-600">Error al unirse al pueblo</p>}
        {status === 'joined' && (
          <div>
            <p className="text-green-600 font-bold text-lg">¡Te has unido a {village?.name}!</p>
            <p className="text-gray-500">Redirigiendo...</p>
          </div>
        )}
        {status === 'valid' && !user && (
          <div className="space-y-4">
            <p className="text-lg font-bold">Invitación para unirse a {village?.name}</p>
            <p className="text-gray-600">Inicia sesión o crea una cuenta para unirte</p>
            <a
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
            >
              Iniciar sesión
            </a>
          </div>
        )}
        {status === 'valid' && user && (
          <p className="text-gray-500">Uniéndose a {village?.name}...</p>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/invite/
git commit -m "feat: add invite link page with token validation and auto-join"
```

---

### Task 27: Profile and personas pages

**Files:**
- Modify: `apps/web/app/profile/page.tsx`
- Create: `apps/web/app/profile/personas/page.tsx`
- Create: `apps/web/components/profile/PersonaCard.tsx`
- Create: `apps/web/components/profile/PersonaForm.tsx`

- [ ] **Step 1: Create PersonaCard**

Create `apps/web/components/profile/PersonaCard.tsx`:

```typescript
import { Pencil, Trash2 } from 'lucide-react';
import type { PersonaData } from '@cultuvilla/shared/models/user';

interface PersonaCardProps {
  persona: PersonaData & { id: string };
  onEdit: () => void;
  onDelete: () => void;
}

export function PersonaCard({ persona, onEdit, onDelete }: PersonaCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3">
      {persona.photoURL ? (
        <img src={persona.photoURL} alt={persona.name} className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
          {persona.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <p className="font-medium">{persona.name}</p>
        <p className="text-xs text-gray-500">
          {persona.birthday.toLocaleDateString('es-ES')}
        </p>
        {persona.biography && <p className="text-xs text-gray-400 mt-1">{persona.biography}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit} className="p-2 text-gray-400">
          <Pencil size={16} />
        </button>
        <button onClick={onDelete} className="p-2 text-red-400">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PersonaForm**

Create `apps/web/components/profile/PersonaForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { PersonaData } from '@cultuvilla/shared/models/user';

interface PersonaFormProps {
  initialData?: PersonaData;
  onSubmit: (data: { name: string; birthday: Date; biography: string | null }) => Promise<void>;
  onCancel: () => void;
}

export function PersonaForm({ initialData, onSubmit, onCancel }: PersonaFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [birthday, setBirthday] = useState(
    initialData?.birthday ? initialData.birthday.toISOString().split('T')[0] : '',
  );
  const [biography, setBiography] = useState(initialData?.biography ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      name,
      birthday: new Date(birthday),
      biography: biography || null,
    });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <input
        type="date"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <textarea
        placeholder="Biografía (opcional)"
        value={biography}
        onChange={(e) => setBiography(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-lg border border-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Rewrite profile page**

Replace `apps/web/app/profile/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserProfile, updateUserProfile } from '@cultuvilla/shared/services/userService';
import { TopBar } from '@/components/common/TopBar';
import Link from 'next/link';
import type { UserData } from '@cultuvilla/shared/models/user';

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<(UserData & { id: string }) | null>(null);
  const [editing, setEditing] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [biography, setBiography] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) {
      getUserProfile(user.uid).then((p) => {
        setProfile(p);
        setTelephone(p?.telephone ?? '');
        setBiography(p?.biography ?? '');
      });
    }
  }, [user, authLoading]);

  async function handleSave() {
    if (!user) return;
    await updateUserProfile(user.uid, {
      telephone: telephone || null,
      biography: biography || null,
    });
    setProfile((prev) => prev ? { ...prev, telephone: telephone || null, biography: biography || null } : prev);
    setEditing(false);
  }

  if (authLoading || !profile) {
    return (
      <>
        <TopBar title="Perfil" />
        <div className="p-4 text-gray-500">Cargando...</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Perfil" />
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-4">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">{profile.displayName}</h1>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <input
              type="tel"
              placeholder="Teléfono"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Biografía"
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-lg border border-gray-300">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-lg bg-blue-600 text-white">
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Cumpleaños:</span> {profile.birthday.toLocaleDateString('es-ES')}</p>
            <p><span className="text-gray-500">Teléfono:</span> {profile.telephone ?? 'No añadido'}</p>
            <p><span className="text-gray-500">Biografía:</span> {profile.biography ?? 'Sin biografía'}</p>
            <button onClick={() => setEditing(true)} className="text-blue-600 font-medium">
              Editar perfil
            </button>
          </div>
        )}

        <Link
          href="/profile/personas"
          className="block w-full py-3 text-center rounded-lg border border-gray-300 font-medium"
        >
          Personas a cargo
        </Link>

        <button
          onClick={async () => { await signOut(); router.push('/'); }}
          className="w-full py-3 rounded-lg border border-red-300 text-red-600 font-medium"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create personas management page**

Create `apps/web/app/profile/personas/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePersonas } from '@/hooks/usePersonas';
import { createPersona, updatePersona, deletePersona } from '@cultuvilla/shared/services/personaService';
import { TopBar } from '@/components/common/TopBar';
import { PersonaCard } from '@/components/profile/PersonaCard';
import { PersonaForm } from '@/components/profile/PersonaForm';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import type { PersonaData } from '@cultuvilla/shared/models/user';

export default function PersonasPage() {
  const { user } = useAuth();
  const { personas, loading, refresh } = usePersonas();
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<(PersonaData & { id: string }) | null>(null);

  async function handleCreate(data: { name: string; birthday: Date; biography: string | null }) {
    if (!user) return;
    await createPersona(user.uid, data);
    setShowForm(false);
    refresh();
  }

  async function handleUpdate(data: { name: string; birthday: Date; biography: string | null }) {
    if (!user || !editingPersona) return;
    await updatePersona(user.uid, editingPersona.id, data);
    setEditingPersona(null);
    refresh();
  }

  async function handleDelete(personaId: string) {
    if (!user || !confirm('¿Eliminar esta persona?')) return;
    await deletePersona(user.uid, personaId);
    refresh();
  }

  return (
    <>
      <TopBar title="Personas a cargo" />
      <div className="p-4 space-y-4">
        <Link href="/profile" className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver al perfil
        </Link>

        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : (
          <>
            {personas.map((persona) =>
              editingPersona?.id === persona.id ? (
                <PersonaForm
                  key={persona.id}
                  initialData={persona}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingPersona(null)}
                />
              ) : (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onEdit={() => setEditingPersona(persona)}
                  onDelete={() => handleDelete(persona.id)}
                />
              ),
            )}

            {showForm ? (
              <PersonaForm
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Añadir persona
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/profile/ apps/web/components/profile/
git commit -m "feat: add profile page with editing and personas management"
```

---

### Task 28: Notifications page

**Files:**
- Create: `apps/web/app/notifications/page.tsx`
- Create: `apps/web/components/notification/NotificationItem.tsx`
- Create: `apps/web/hooks/useNotifications.ts`

- [ ] **Step 1: Create useNotifications hook**

Create `apps/web/hooks/useNotifications.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getNotifications, getUnreadCount } from '@cultuvilla/shared/services/notificationService';
import { useAuth } from './useAuth';
import type { NotificationData } from '@cultuvilla/shared/models/notification';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<(NotificationData & { id: string })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const [notifs, count] = await Promise.all([
      getNotifications(user.uid),
      getUnreadCount(user.uid),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  return { notifications, unreadCount, loading, refresh: load };
}
```

- [ ] **Step 2: Create NotificationItem**

Create `apps/web/components/notification/NotificationItem.tsx`:

```typescript
import type { NotificationData } from '@cultuvilla/shared/models/notification';

interface NotificationItemProps {
  notification: NotificationData & { id: string };
  onTap: () => void;
}

export function NotificationItem({ notification, onTap }: NotificationItemProps) {
  return (
    <button
      onClick={onTap}
      className={`w-full text-left p-4 rounded-lg ${
        notification.read ? 'bg-white' : 'bg-blue-50'
      }`}
    >
      <p className="font-medium text-sm">{notification.title}</p>
      <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
      <p className="text-xs text-gray-400 mt-1">
        {notification.createdAt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </button>
  );
}
```

- [ ] **Step 3: Create notifications page**

Create `apps/web/app/notifications/page.tsx`:

```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { markAsRead, markAllAsRead } from '@cultuvilla/shared/services/notificationService';
import { TopBar } from '@/components/common/TopBar';
import { NotificationItem } from '@/components/notification/NotificationItem';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, loading, refresh } = useNotifications();

  async function handleTap(notifId: string, read: boolean) {
    if (!user || read) return;
    await markAsRead(user.uid, notifId);
    refresh();
  }

  async function handleMarkAllRead() {
    if (!user) return;
    await markAllAsRead(user.uid);
    refresh();
  }

  return (
    <>
      <TopBar title="Notificaciones" />
      <div className="p-4 space-y-3">
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-blue-600 font-medium"
          >
            Marcar todo como leído
          </button>
        )}

        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500">No tienes notificaciones</p>
        ) : (
          notifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onTap={() => handleTap(notif.id, notif.read)}
            />
          ))
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/notifications/ apps/web/components/notification/ apps/web/hooks/useNotifications.ts
git commit -m "feat: add notifications page with read/unread management"
```

---

### Task 29: My sign-ups page

**Files:**
- Create: `apps/web/app/my-signups/page.tsx`

- [ ] **Step 1: Create my sign-ups page**

Create `apps/web/app/my-signups/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getUserRegistrationsAcrossVillages } from '@cultuvilla/shared/services/registrationService';
import { TopBar } from '@/components/common/TopBar';
import Link from 'next/link';
import type { RegistrationData } from '@cultuvilla/shared/models/event';

type RegWithPath = RegistrationData & { id: string; eventPath: string };

export default function MySignupsPage() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegWithPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserRegistrationsAcrossVillages(user.uid).then((regs) => {
      setRegistrations(regs);
      setLoading(false);
    });
  }, [user]);

  return (
    <>
      <TopBar title="Mis inscripciones" />
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : registrations.length === 0 ? (
          <p className="text-gray-500">No tienes inscripciones</p>
        ) : (
          registrations.map((reg) => {
            // eventPath is like "villages/{villageId}/events/{eventId}"
            const parts = reg.eventPath.split('/');
            const villageId = parts[1];
            const eventId = parts[3];

            return (
              <Link
                key={reg.id}
                href={`/village/${villageId}/event/${eventId}`}
                className="block bg-white rounded-lg p-4 shadow-sm"
              >
                <p className="font-medium">{reg.name}</p>
                <p className={`text-xs ${reg.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                  {reg.status === 'confirmed' ? 'Confirmado' : 'En lista de espera'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {reg.registeredAt.toLocaleDateString('es-ES')}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/my-signups/
git commit -m "feat: add my sign-ups page with cross-village collection group query"
```

---

### Task 30: Event creation and editing pages

**Files:**
- Create: `apps/web/components/event/EventForm.tsx` (rewrite)
- Create: `apps/web/app/village/[id]/org/[orgId]/events/new/page.tsx`
- Create: `apps/web/app/village/[id]/org/[orgId]/events/[eventId]/edit/page.tsx`
- Create: `apps/web/app/village/[id]/org/[orgId]/page.tsx`

- [ ] **Step 1: Rewrite EventForm**

Replace `apps/web/components/EventForm.tsx` with `apps/web/components/event/EventForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { EventData } from '@cultuvilla/shared/models/event';
import type { LocationData } from '@cultuvilla/shared/models/core';

interface EventFormProps {
  initialData?: EventData;
  onSubmit: (data: {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date | null;
    location: LocationData;
    price: number | null;
    maxAttendees: number | null;
    telephoneRequired: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export function EventForm({ initialData, onSubmit, onCancel }: EventFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [startDate, setStartDate] = useState(
    initialData?.startDate ? initialData.startDate.toISOString().slice(0, 16) : '',
  );
  const [endDate, setEndDate] = useState(
    initialData?.endDate ? initialData.endDate.toISOString().slice(0, 16) : '',
  );
  const [locationType, setLocationType] = useState<'text' | 'coordinates'>(
    initialData?.location.type ?? 'text',
  );
  const [locationText, setLocationText] = useState(initialData?.location.text ?? '');
  const [price, setPrice] = useState(initialData?.price?.toString() ?? '');
  const [maxAttendees, setMaxAttendees] = useState(initialData?.maxAttendees?.toString() ?? '');
  const [telephoneRequired, setTelephoneRequired] = useState(initialData?.telephoneRequired ?? false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      title,
      description,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location: { type: locationType, coordinates: null, text: locationType === 'text' ? locationText : null },
      price: price ? parseFloat(price) : null,
      maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      telephoneRequired,
    });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Título del evento"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <textarea
        placeholder="Descripción"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <div>
        <label className="text-sm text-gray-600">Fecha y hora de inicio</label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600">Fecha y hora de fin (opcional)</label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
        />
      </div>
      <input
        type="text"
        placeholder="Ubicación"
        value={locationText}
        onChange={(e) => setLocationText(e.target.value)}
        required={locationType === 'text'}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-600">Precio (€)</label>
          <input
            type="number"
            placeholder="Gratis"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.01"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Máx. asistentes</label>
          <input
            type="number"
            placeholder="Sin límite"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            min="1"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={telephoneRequired}
          onChange={(e) => setTelephoneRequired(e.target.checked)}
          className="w-5 h-5"
        />
        <span className="text-sm">Requerir teléfono para inscripción</span>
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-lg border border-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create org page (list of org events)**

Create `apps/web/app/village/[id]/org/[orgId]/page.tsx`:

```typescript
'use client';

import { use, useEffect, useState } from 'react';
import { useVillage } from '@/hooks/useVillage';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { getOrgEvents } from '@cultuvilla/shared/services/eventService';
import { isOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import { useAuth } from '@/hooks/useAuth';
import { TopBar } from '@/components/common/TopBar';
import { EventCard } from '@/components/event/EventCard';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { EventData } from '@cultuvilla/shared/models/event';

export default function OrgPage({
  params,
}: {
  params: Promise<{ id: string; orgId: string }>;
}) {
  const { id: villageId, orgId } = use(params);
  const { user } = useAuth();
  const { village } = useVillage();
  const [org, setOrg] = useState<(OrganizationData & { id: string }) | null>(null);
  const [events, setEvents] = useState<(EventData & { id: string })[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [o, e, member] = await Promise.all([
        getOrganization(villageId, orgId),
        getOrgEvents(villageId, orgId),
        user ? isOrgMember(villageId, orgId, user.uid) : Promise.resolve(false),
      ]);
      setOrg(o);
      setEvents(e);
      setIsMember(member);
      setLoading(false);
    }
    load();
  }, [villageId, orgId, user]);

  if (loading) return <><TopBar title="Cargando..." /><div className="p-4 text-gray-500">Cargando...</div></>;

  return (
    <>
      <TopBar title={org?.name ?? 'Organización'} />
      <div className="p-4 space-y-4">
        <Link href={`/village/${villageId}`} className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver
        </Link>

        {org && (
          <div>
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{org.type}</span>
            {org.description && <p className="text-sm text-gray-600 mt-2">{org.description}</p>}
          </div>
        )}

        {isMember && (
          <Link
            href={`/village/${villageId}/org/${orgId}/events/new`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-blue-600 text-white font-medium"
          >
            <Plus size={18} /> Crear evento
          </Link>
        )}

        <h2 className="font-bold">Eventos</h2>
        {events.length === 0 ? (
          <p className="text-gray-500">No hay eventos</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} villageId={villageId} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create event creation page**

Create `apps/web/app/village/[id]/org/[orgId]/events/new/page.tsx`:

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useVillage } from '@/hooks/useVillage';
import { createEvent } from '@cultuvilla/shared/services/eventService';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import { TopBar } from '@/components/common/TopBar';
import { EventForm } from '@/components/event/EventForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CreateEventPage({
  params,
}: {
  params: Promise<{ id: string; orgId: string }>;
}) {
  const { id: villageId, orgId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    getOrganization(villageId, orgId).then((org) => {
      if (org) setOrgName(org.name);
    });
  }, [villageId, orgId]);

  async function handleSubmit(data: Parameters<typeof createEvent>[1] extends infer T ? Omit<T, 'organizationId' | 'organizationName' | 'createdBy'> : never) {
    if (!user) return;
    await createEvent(villageId, {
      ...data,
      location: data.location,
      organizationId: orgId,
      organizationName: orgName,
      createdBy: user.uid,
    });
    router.push(`/village/${villageId}/org/${orgId}`);
  }

  return (
    <>
      <TopBar title="Crear evento" />
      <div className="p-4 space-y-4">
        <Link href={`/village/${villageId}/org/${orgId}`} className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver
        </Link>
        <EventForm
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/village/${villageId}/org/${orgId}`)}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create event edit page**

Create `apps/web/app/village/[id]/org/[orgId]/events/[eventId]/edit/page.tsx`:

```typescript
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEvent, updateEvent, updateEventStatus } from '@cultuvilla/shared/services/eventService';
import { TopBar } from '@/components/common/TopBar';
import { EventForm } from '@/components/event/EventForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { EventData } from '@cultuvilla/shared/models/event';

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string; orgId: string; eventId: string }>;
}) {
  const { id: villageId, orgId, eventId } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<(EventData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvent(villageId, eventId).then((e) => {
      setEvent(e);
      setLoading(false);
    });
  }, [villageId, eventId]);

  async function handleSubmit(data: any) {
    await updateEvent(villageId, eventId, data);
    router.push(`/village/${villageId}/event/${eventId}`);
  }

  async function handlePublish() {
    await updateEventStatus(villageId, eventId, 'published');
    router.push(`/village/${villageId}/event/${eventId}`);
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar este evento? Se notificará a todos los inscritos.')) return;
    await updateEventStatus(villageId, eventId, 'cancelled');
    router.push(`/village/${villageId}/event/${eventId}`);
  }

  if (loading) return <><TopBar title="Cargando..." /><div className="p-4 text-gray-500">Cargando...</div></>;
  if (!event) return <><TopBar title="Error" /><div className="p-4 text-red-500">Evento no encontrado</div></>;

  return (
    <>
      <TopBar title="Editar evento" />
      <div className="p-4 space-y-4">
        <Link href={`/village/${villageId}/org/${orgId}`} className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver
        </Link>

        {event.status === 'draft' && (
          <button onClick={handlePublish} className="w-full py-3 rounded-lg bg-green-600 text-white font-medium">
            Publicar evento
          </button>
        )}

        {(event.status === 'draft' || event.status === 'published') && (
          <button onClick={handleCancel} className="w-full py-3 rounded-lg border border-red-300 text-red-600 font-medium">
            Cancelar evento
          </button>
        )}

        <EventForm
          initialData={event}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/village/${villageId}/org/${orgId}`)}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 5: Delete old components and admin pages that will be replaced**

Remove the old files:
- `apps/web/components/EventForm.tsx` (replaced by `components/event/EventForm.tsx`)
- `apps/web/components/NavBar.tsx` (replaced by `BottomNav` + `TopBar`)
- `apps/web/app/admin/` (replaced by village admin and app admin)
- `apps/web/app/event/` (replaced by village-scoped events)
- `apps/web/lib/auth-context.tsx` (replaced by `contexts/AuthContext.tsx`)

Run:
```bash
rm apps/web/components/EventForm.tsx apps/web/components/NavBar.tsx apps/web/lib/auth-context.tsx
rm -rf apps/web/app/admin apps/web/app/event
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add event creation/editing, org page, and clean up old files"
```

---

### Task 31: Village admin page

**Files:**
- Create: `apps/web/app/village/[id]/admin/page.tsx`
- Create: `apps/web/components/organization/OrgCard.tsx`
- Create: `apps/web/components/organization/OrgRequestForm.tsx`

- [ ] **Step 1: Create OrgCard**

Create `apps/web/components/organization/OrgCard.tsx`:

```typescript
import Link from 'next/link';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';

interface OrgCardProps {
  org: OrganizationData & { id: string };
  villageId: string;
  showActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export function OrgCard({ org, villageId, showActions, onApprove, onReject }: OrgCardProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm space-y-2">
      <div className="flex items-start justify-between">
        <Link href={`/village/${villageId}/org/${org.id}`} className="font-semibold">
          {org.name}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[org.status]}`}>
          {org.status === 'pending' ? 'Pendiente' : org.status === 'approved' ? 'Aprobada' : 'Rechazada'}
        </span>
      </div>
      <p className="text-xs text-gray-500">{org.type}</p>
      {org.description && <p className="text-sm text-gray-600">{org.description}</p>}

      {showActions && org.status === 'pending' && (
        <div className="flex gap-2 pt-2">
          <button onClick={onApprove} className="flex-1 py-2 text-sm rounded bg-green-600 text-white">
            Aprobar
          </button>
          <button onClick={onReject} className="flex-1 py-2 text-sm rounded border border-red-300 text-red-600">
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create OrgRequestForm**

Create `apps/web/components/organization/OrgRequestForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { OrganizationType } from '@cultuvilla/shared/models/organization';

interface OrgRequestFormProps {
  onSubmit: (data: { name: string; description: string | null; type: OrganizationType }) => Promise<void>;
  onCancel: () => void;
}

const orgTypes: { value: OrganizationType; label: string }[] = [
  { value: 'ayuntamiento', label: 'Ayuntamiento' },
  { value: 'peña', label: 'Peña' },
  { value: 'asociación', label: 'Asociación' },
];

export function OrgRequestForm({ onSubmit, onCancel }: OrgRequestFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrganizationType>('asociación');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ name, description: description || null, type });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Nombre de la organización"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as OrganizationType)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      >
        {orgTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <textarea
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
      />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-lg border border-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          {submitting ? 'Enviando...' : 'Solicitar'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create village admin page**

Create `apps/web/app/village/[id]/admin/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useVillage } from '@/hooks/useVillage';
import { useAuth } from '@/hooks/useAuth';
import { getOrganizations, approveOrganization, rejectOrganization } from '@cultuvilla/shared/services/organizationService';
import { addOrgMember } from '@cultuvilla/shared/services/orgMemberService';
import { createInviteToken, getInviteTokens, deleteInviteToken } from '@cultuvilla/shared/services/inviteTokenService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { TopBar } from '@/components/common/TopBar';
import { OrgCard } from '@/components/organization/OrgCard';
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';
import type { InviteTokenData } from '@cultuvilla/shared/models/village';

export default function VillageAdminPage() {
  const { village, isAdmin } = useVillage();
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<(OrganizationData & { id: string })[]>([]);
  const [tokens, setTokens] = useState<(InviteTokenData & { id: string })[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!village) return;
    async function load() {
      const [o, t, m] = await Promise.all([
        getOrganizations(village!.id),
        getInviteTokens(village!.id),
        getVillageMembers(village!.id),
      ]);
      setOrgs(o);
      setTokens(t);
      setMemberCount(m.length);
      setLoading(false);
    }
    load();
  }, [village]);

  if (!isAdmin) {
    return (
      <>
        <TopBar title="Acceso denegado" />
        <div className="p-4 text-red-600">No tienes permisos de administrador</div>
      </>
    );
  }

  async function handleApprove(orgId: string, requestedBy: string) {
    if (!village) return;
    await approveOrganization(village.id, orgId);
    await addOrgMember(village.id, orgId, requestedBy);
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, status: 'approved' as const } : o));
  }

  async function handleReject(orgId: string) {
    if (!village) return;
    await rejectOrganization(village.id, orgId);
    setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, status: 'rejected' as const } : o));
  }

  async function handleCreateToken() {
    if (!village) return;
    const tokenId = await createInviteToken(village.id);
    const newTokens = await getInviteTokens(village.id);
    setTokens(newTokens);
  }

  function copyInviteLink(tokenId: string) {
    if (!village) return;
    const url = `${window.location.origin}/invite/${tokenId}?v=${village.id}`;
    navigator.clipboard.writeText(url);
  }

  async function handleDeleteToken(tokenId: string) {
    if (!village) return;
    await deleteInviteToken(village.id, tokenId);
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  }

  return (
    <>
      <TopBar title="Administración" />
      <div className="p-4 space-y-6">
        <Link href={`/village/${village?.id}`} className="flex items-center gap-1 text-sm text-blue-600">
          <ArrowLeft size={16} /> Volver
        </Link>

        <div className="text-sm text-gray-500">{memberCount} miembros</div>

        {/* Invite tokens */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Enlaces de invitación</h2>
            <button onClick={handleCreateToken} className="flex items-center gap-1 text-sm text-blue-600">
              <Plus size={16} /> Nuevo
            </button>
          </div>
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500">
                Usado {token.usageCount} veces · {token.createdAt.toLocaleDateString('es-ES')}
              </div>
              <div className="flex gap-2">
                <button onClick={() => copyInviteLink(token.id)} className="p-2 text-blue-600">
                  <Copy size={16} />
                </button>
                <button onClick={() => handleDeleteToken(token.id)} className="p-2 text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Organizations */}
        <section className="space-y-3">
          <h2 className="font-bold">Organizaciones</h2>
          {orgs.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay organizaciones</p>
          ) : (
            orgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                villageId={village!.id}
                showActions={true}
                onApprove={() => handleApprove(org.id, org.requestedBy)}
                onReject={() => handleReject(org.id)}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/village/[id]/admin/ apps/web/components/organization/
git commit -m "feat: add village admin page with org approval and invite link management"
```

---

## Phase 6: Cloud Functions

### Task 32: Set up Cloud Functions project

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Create: `functions/src/waitlistPromotion.ts`
- Create: `functions/src/eventCompletion.ts`
- Create: `functions/src/notificationTriggers.ts`
- Modify: `firebase.json`

- [ ] **Step 1: Create functions package.json**

Create `functions/package.json`:

```json
{
  "name": "villa-events-functions",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.3.0"
  },
  "devDependencies": {
    "typescript": "~5.8.3"
  }
}
```

- [ ] **Step 2: Create functions tsconfig.json**

Create `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "dist",
    "sourceMap": true,
    "strict": true,
    "target": "ES2020",
    "skipLibCheck": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

- [ ] **Step 3: Implement waitlist promotion**

Create `functions/src/waitlistPromotion.ts`:

```typescript
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onRegistrationDeleted = onDocumentDeleted(
  'villages/{villageId}/events/{eventId}/registrations/{regId}',
  async (event) => {
    const { villageId, eventId } = event.params;
    const deletedData = event.data?.data();

    if (!deletedData || deletedData.status !== 'confirmed') return;

    // Check if event has maxAttendees
    const eventSnap = await db.doc(`villages/${villageId}/events/${eventId}`).get();
    const eventData = eventSnap.data();
    if (!eventData?.maxAttendees) return;

    // Find next waitlisted person
    const waitlisted = await db
      .collection(`villages/${villageId}/events/${eventId}/registrations`)
      .where('status', '==', 'waitlisted')
      .orderBy('position', 'asc')
      .limit(1)
      .get();

    if (waitlisted.empty) return;

    const nextInLine = waitlisted.docs[0];
    const nextData = nextInLine.data();

    // Promote to confirmed
    await nextInLine.ref.update({ status: 'confirmed' });

    // Create notification
    await db.collection(`users/${nextData.userId}/notifications`).add({
      type: 'waitlist_promoted',
      title: '¡Plaza confirmada!',
      body: `Se ha liberado una plaza en "${eventData.title}" para ${nextData.name}`,
      eventId,
      villageId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);
```

- [ ] **Step 4: Implement event completion**

Create `functions/src/eventCompletion.ts`:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const completeExpiredEvents = onSchedule('every 1 hours', async () => {
  const now = admin.firestore.Timestamp.now();

  // Get all villages
  const villages = await db.collection('villages').get();

  for (const village of villages.docs) {
    // Find published events where endDate or startDate has passed
    const events = await db
      .collection(`villages/${village.id}/events`)
      .where('status', '==', 'published')
      .get();

    for (const event of events.docs) {
      const data = event.data();
      const compareDate = data.endDate ?? data.startDate;

      if (compareDate.toDate() < new Date()) {
        await event.ref.update({ status: 'completed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }
});
```

- [ ] **Step 5: Implement notification triggers**

Create `functions/src/notificationTriggers.ts`:

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const onEventUpdated = onDocumentUpdated(
  'villages/{villageId}/events/{eventId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { villageId, eventId } = event.params;

    if (!before || !after) return;

    // Event cancelled
    if (before.status !== 'cancelled' && after.status === 'cancelled') {
      const regs = await db
        .collection(`villages/${villageId}/events/${eventId}/registrations`)
        .get();

      const userIds = new Set(regs.docs.map((r) => r.data().userId));

      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_cancelled',
          title: 'Evento cancelado',
          body: `El evento "${after.title}" ha sido cancelado`,
          eventId,
          villageId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Event details updated (title, date, location changed while published)
    if (
      after.status === 'published' &&
      before.status === 'published' &&
      (before.title !== after.title || before.startDate !== after.startDate || JSON.stringify(before.location) !== JSON.stringify(after.location))
    ) {
      const regs = await db
        .collection(`villages/${villageId}/events/${eventId}/registrations`)
        .get();

      const userIds = new Set(regs.docs.map((r) => r.data().userId));

      const batch = db.batch();
      for (const userId of userIds) {
        const ref = db.collection(`users/${userId}/notifications`).doc();
        batch.set(ref, {
          type: 'event_updated',
          title: 'Evento actualizado',
          body: `El evento "${after.title}" ha sido actualizado`,
          eventId,
          villageId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  },
);
```

- [ ] **Step 6: Create functions entry point**

Create `functions/src/index.ts`:

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

export { onRegistrationDeleted } from './waitlistPromotion';
export { completeExpiredEvents } from './eventCompletion';
export { onEventUpdated } from './notificationTriggers';
```

- [ ] **Step 7: Update firebase.json**

Replace `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git"]
    }
  ]
}
```

- [ ] **Step 8: Install functions dependencies**

Run: `cd /home/powervaro/githubs/cultuvilla/functions && npm install`

- [ ] **Step 9: Build functions**

Run: `cd /home/powervaro/githubs/cultuvilla/functions && npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add functions/ firebase.json
git commit -m "feat: add Cloud Functions for waitlist promotion, event completion, and notifications"
```

---

## Phase 7: Clean up old code and final wiring

### Task 33: Remove old models and services, update shared package

**Files:**
- Remove: `packages/shared/src/models/event.ts` (old)
- Remove: `packages/shared/src/models/user.ts` (old)
- Remove: `packages/shared/src/services/eventService.ts` (old — replaced by new one)
- Remove: `packages/shared/src/services/registrationService.ts` (old)
- Remove: `packages/shared/src/services/userService.ts` (old)

- [ ] **Step 1: Remove old model files**

```bash
rm packages/shared/src/models/event.ts packages/shared/src/models/user.ts
```

- [ ] **Step 2: Remove old service files (they've been replaced by new ones in Phase 2)**

The new service files in Task 9-14 replace the old ones. Verify the old `index.ts` exports have been updated in Task 14.

- [ ] **Step 3: Run full build and tests**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter @cultuvilla/shared test && pnpm --filter @cultuvilla/shared build`
Expected: All tests pass, build succeeds

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old models and services, finalize shared package"
```

---

### Task 34: Verify web app builds

- [ ] **Step 1: Build the web app**

Run: `cd /home/powervaro/githubs/cultuvilla && pnpm --filter cultuvilla-web build`

If there are import errors, fix them — the most common issue will be import paths that reference old files.

- [ ] **Step 2: Fix any build errors found**

Common fixes:
- Update imports from `@cultuvilla/shared/models` to use new model paths
- Update imports from `@cultuvilla/shared/services` to use new service functions
- Ensure all barrel exports are wired correctly

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from model and service restructure"
```

---

### Task 35: Add Firestore indexes configuration

**Files:**
- Create: `firestore.indexes.json`

- [ ] **Step 1: Create indexes file**

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "position", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "registeredAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "organizations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Update firebase.json to include indexes**

Add to `firebase.json` under firestore:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git"]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json firebase.json
git commit -m "feat: add Firestore indexes for event, registration, and notification queries"
```
