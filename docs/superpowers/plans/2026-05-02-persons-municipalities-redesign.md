# Persons & Municipalities Data Layer Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `users/{userId}/personas` with a top-level `persons/{personId}` collection, add `municipalities/barrios/cemeteries` reference data, `occupations/occupationProposals` for the occupation picker, and update registrations so `personId` is always required.

**Architecture:** Three new top-level domains — `persons` (canonical people registry, linked to Firebase Auth users or standalone for family tree / non-account members), `municipalities` (predefined Spanish ayuntamientos with barrios/cemeteries subcollections), and `occupations` (superadmin-managed multi-select list with user proposal flow). `UserData` gains a `personId` field. Registrations drop the nullable `personaId` and always use a required `personId`.

**Tech Stack:** Firebase Firestore, TypeScript, Vitest (pnpm shared:test), Next.js 15, Tailwind CSS

---

## File Map

### Create
- `packages/shared/src/models/person/PersonDataModel.ts`
- `packages/shared/src/models/person/index.ts`
- `packages/shared/src/models/municipality/MunicipalityDataModel.ts`
- `packages/shared/src/models/municipality/index.ts`
- `packages/shared/src/models/occupation/OccupationDataModel.ts`
- `packages/shared/src/models/occupation/index.ts`
- `packages/shared/src/services/personService.ts`
- `packages/shared/src/services/municipalityService.ts`
- `packages/shared/src/services/occupationService.ts`
- `packages/shared/test/models/PersonDataModel.test.ts`
- `packages/shared/test/models/MunicipalityDataModel.test.ts`
- `packages/shared/test/models/OccupationDataModel.test.ts`
- `apps/web/components/profile/PersonCard.tsx`
- `apps/web/components/profile/PersonForm.tsx`
- `apps/web/hooks/usePersons.ts`
- `apps/web/app/profile/persons/page.tsx`

### Modify
- `packages/shared/src/models/index.ts` — add person, municipality, occupation exports
- `packages/shared/src/services/index.ts` — add new services, remove personaService
- `packages/shared/src/services/imageService.ts` — update persona → person storage path
- `packages/shared/src/models/event/RegistrationDataModel.ts` — personId required, drop personaId
- `packages/shared/src/models/user/UserDataModel.ts` — add personId field
- `packages/shared/src/services/registrationService.ts` — rename personaId → personId throughout
- `packages/shared/test/models/RegistrationDataModel.test.ts` — update for new model
- `packages/shared/test/models/UserDataModel.test.ts` — add personId test
- `firestore.rules` — add persons/municipalities/occupations rules, remove personas rules
- `functions/src/acceptInvite.ts` — create person record + link personId on signup
- `apps/web/app/profile/page.tsx` — update /profile/personas link to /profile/persons

### Delete
- `packages/shared/src/models/user/PersonaDataModel.ts`
- `packages/shared/src/services/personaService.ts`
- `apps/web/hooks/usePersonas.ts`
- `apps/web/components/profile/PersonaForm.tsx`
- `apps/web/components/profile/PersonaCard.tsx`
- `apps/web/app/profile/personas/` (directory)

---

## Task 1: PersonData model

**Files:**
- Create: `packages/shared/src/models/person/PersonDataModel.ts`
- Create: `packages/shared/src/models/person/index.ts`
- Test: `packages/shared/test/models/PersonDataModel.test.ts`

- [ ] **Step 1: Create the model file**

```typescript
// packages/shared/src/models/person/PersonDataModel.ts

export type Sex = 'male' | 'female' | 'other'

export interface PartialDate {
  year: number | null
  month: number | null  // 1–12
  day: number | null    // 1–31
}

export interface MunicipalityLink {
  municipalityId: string
  barrioId: string | null
}

export interface BurialPlace {
  municipalityId: string
  cemeteryId: string
}

export interface PersonData {
  // Name
  givenName: string
  middleNames: string[]
  firstSurname: string | null
  secondSurname: string | null
  nickname: string | null
  sex: Sex | null

  // Dates
  birthday: PartialDate | null
  deathDate: PartialDate | null

  // Places
  birthPlace: MunicipalityLink | null
  burialPlace: BurialPlace | null
  municipalityLinks: MunicipalityLink[]

  // Work — multi-select
  occupationIds: string[]        // approved occupation IDs
  pendingOccupations: string[]   // free text while proposals are pending

  // Bio
  biography: string | null
  photoURL: string | null

  // Auth link
  userId: string | null          // Firebase Auth uid if this person has an account

  // Meta
  createdBy: string
  createdAt: Date
}

export interface PersonDataInput {
  givenName: string
  middleNames?: string[]
  firstSurname?: string | null
  secondSurname?: string | null
  nickname?: string | null
  sex?: Sex | null
  birthday?: PartialDate | null
  deathDate?: PartialDate | null
  birthPlace?: MunicipalityLink | null
  burialPlace?: BurialPlace | null
  municipalityLinks?: MunicipalityLink[]
  occupationIds?: string[]
  pendingOccupations?: string[]
  biography?: string | null
  photoURL?: string | null
  userId?: string | null
  createdBy: string
}

export function buildPersonData(input: PersonDataInput): PersonData {
  return {
    givenName: input.givenName,
    middleNames: input.middleNames ?? [],
    firstSurname: input.firstSurname ?? null,
    secondSurname: input.secondSurname ?? null,
    nickname: input.nickname ?? null,
    sex: input.sex ?? null,
    birthday: input.birthday ?? null,
    deathDate: input.deathDate ?? null,
    birthPlace: input.birthPlace ?? null,
    burialPlace: input.burialPlace ?? null,
    municipalityLinks: input.municipalityLinks ?? [],
    occupationIds: input.occupationIds ?? [],
    pendingOccupations: input.pendingOccupations ?? [],
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    userId: input.userId ?? null,
    createdBy: input.createdBy,
    createdAt: new Date(),
  }
}

/** Full display name: "Juan Carlos García López" */
export function buildDisplayName(
  person: Pick<PersonData, 'givenName' | 'middleNames' | 'firstSurname' | 'secondSurname'>
): string {
  return [person.givenName, ...person.middleNames, person.firstSurname, person.secondSurname]
    .filter(Boolean)
    .join(' ')
}

/** Short name for tight spaces: nickname if set, otherwise "Juan García" */
export function buildShortName(
  person: Pick<PersonData, 'givenName' | 'nickname' | 'firstSurname'>
): string {
  return person.nickname ?? [person.givenName, person.firstSurname].filter(Boolean).join(' ')
}
```

- [ ] **Step 2: Create the barrel**

```typescript
// packages/shared/src/models/person/index.ts
export * from './PersonDataModel'
```

- [ ] **Step 3: Write the failing tests**

```typescript
// packages/shared/test/models/PersonDataModel.test.ts
import { describe, it, expect } from 'vitest'
import { buildPersonData, buildDisplayName, buildShortName } from '../../src/models/person/PersonDataModel'

describe('buildPersonData', () => {
  it('sets defaults for all optional fields', () => {
    const result = buildPersonData({ givenName: 'Juan', createdBy: 'user1' })
    expect(result.givenName).toBe('Juan')
    expect(result.middleNames).toEqual([])
    expect(result.firstSurname).toBeNull()
    expect(result.secondSurname).toBeNull()
    expect(result.nickname).toBeNull()
    expect(result.sex).toBeNull()
    expect(result.birthday).toBeNull()
    expect(result.deathDate).toBeNull()
    expect(result.birthPlace).toBeNull()
    expect(result.burialPlace).toBeNull()
    expect(result.municipalityLinks).toEqual([])
    expect(result.occupationIds).toEqual([])
    expect(result.pendingOccupations).toEqual([])
    expect(result.biography).toBeNull()
    expect(result.photoURL).toBeNull()
    expect(result.userId).toBeNull()
    expect(result.createdBy).toBe('user1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('preserves all provided fields', () => {
    const result = buildPersonData({
      givenName: 'María',
      middleNames: ['Carmen'],
      firstSurname: 'García',
      secondSurname: 'López',
      nickname: 'Paca',
      sex: 'female',
      birthday: { year: 1943, month: 6, day: 15 },
      deathDate: { year: 2020, month: null, day: null },
      birthPlace: { municipalityId: 'mun1', barrioId: 'barrio1' },
      burialPlace: { municipalityId: 'mun1', cemeteryId: 'cem1' },
      municipalityLinks: [{ municipalityId: 'mun1', barrioId: null }],
      occupationIds: ['occ1', 'occ2'],
      pendingOccupations: ['Molinera'],
      biography: 'Fue agricultora',
      photoURL: 'https://example.com/photo.jpg',
      userId: 'user1',
      createdBy: 'user1',
    })
    expect(result.middleNames).toEqual(['Carmen'])
    expect(result.firstSurname).toBe('García')
    expect(result.sex).toBe('female')
    expect(result.birthday).toEqual({ year: 1943, month: 6, day: 15 })
    expect(result.deathDate).toEqual({ year: 2020, month: null, day: null })
    expect(result.burialPlace).toEqual({ municipalityId: 'mun1', cemeteryId: 'cem1' })
    expect(result.occupationIds).toEqual(['occ1', 'occ2'])
    expect(result.pendingOccupations).toEqual(['Molinera'])
  })

  it('accepts year-only birthday', () => {
    const result = buildPersonData({ givenName: 'Ana', createdBy: 'u1', birthday: { year: 1900, month: null, day: null } })
    expect(result.birthday).toEqual({ year: 1900, month: null, day: null })
  })

  it('accepts fully-unknown birthday', () => {
    const result = buildPersonData({ givenName: 'Ana', createdBy: 'u1', birthday: { year: null, month: null, day: null } })
    expect(result.birthday).toEqual({ year: null, month: null, day: null })
  })
})

describe('buildDisplayName', () => {
  it('joins all name parts', () => {
    expect(buildDisplayName({ givenName: 'Juan', middleNames: ['Carlos'], firstSurname: 'García', secondSurname: 'López' }))
      .toBe('Juan Carlos García López')
  })

  it('skips null surnames', () => {
    expect(buildDisplayName({ givenName: 'Ana', middleNames: [], firstSurname: 'Martínez', secondSurname: null }))
      .toBe('Ana Martínez')
  })

  it('works with no surnames', () => {
    expect(buildDisplayName({ givenName: 'Paco', middleNames: [], firstSurname: null, secondSurname: null }))
      .toBe('Paco')
  })
})

describe('buildShortName', () => {
  it('returns nickname if set', () => {
    expect(buildShortName({ givenName: 'Juan', nickname: 'Juanito', firstSurname: 'García' }))
      .toBe('Juanito')
  })

  it('returns givenName + firstSurname if no nickname', () => {
    expect(buildShortName({ givenName: 'Juan', nickname: null, firstSurname: 'García' }))
      .toBe('Juan García')
  })
})
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/shared && pnpm test --run
```

Expected: `PersonDataModel.test.ts` passes (11 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/person/ packages/shared/test/models/PersonDataModel.test.ts
git commit -m "feat: add PersonData model with sex, partial dates, multi-select occupations"
```

---

## Task 2: Municipality, Barrio, and Cemetery models

**Files:**
- Create: `packages/shared/src/models/municipality/MunicipalityDataModel.ts`
- Create: `packages/shared/src/models/municipality/index.ts`
- Test: `packages/shared/test/models/MunicipalityDataModel.test.ts`

- [ ] **Step 1: Create the model file**

```typescript
// packages/shared/src/models/municipality/MunicipalityDataModel.ts

export interface MunicipalityData {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
  createdAt: Date
}

export interface MunicipalityDataInput {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
}

export function buildMunicipalityData(input: MunicipalityDataInput): MunicipalityData {
  return { ...input, createdAt: new Date() }
}

export interface BarrioData {
  name: string
  municipalityId: string
  createdAt: Date
}

export interface BarrioDataInput {
  name: string
  municipalityId: string
}

export function buildBarrioData(input: BarrioDataInput): BarrioData {
  return { ...input, createdAt: new Date() }
}

export interface CemeteryData {
  name: string
  description: string | null
  municipalityId: string
  createdAt: Date
}

export interface CemeteryDataInput {
  name: string
  municipalityId: string
  description?: string | null
}

export function buildCemeteryData(input: CemeteryDataInput): CemeteryData {
  return {
    name: input.name,
    municipalityId: input.municipalityId,
    description: input.description ?? null,
    createdAt: new Date(),
  }
}
```

- [ ] **Step 2: Create the barrel**

```typescript
// packages/shared/src/models/municipality/index.ts
export * from './MunicipalityDataModel'
```

- [ ] **Step 3: Write the failing tests**

```typescript
// packages/shared/test/models/MunicipalityDataModel.test.ts
import { describe, it, expect } from 'vitest'
import { buildMunicipalityData, buildBarrioData, buildCemeteryData } from '../../src/models/municipality/MunicipalityDataModel'

describe('buildMunicipalityData', () => {
  it('sets all fields and createdAt', () => {
    const result = buildMunicipalityData({ name: 'Jódar', province: 'Jaén', comunidadAutonoma: 'Andalucía', codigoINE: '23050' })
    expect(result.name).toBe('Jódar')
    expect(result.province).toBe('Jaén')
    expect(result.comunidadAutonoma).toBe('Andalucía')
    expect(result.codigoINE).toBe('23050')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildBarrioData', () => {
  it('sets all fields', () => {
    const result = buildBarrioData({ name: 'El Castillo', municipalityId: 'mun1' })
    expect(result.name).toBe('El Castillo')
    expect(result.municipalityId).toBe('mun1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildCemeteryData', () => {
  it('defaults description to null', () => {
    const result = buildCemeteryData({ name: 'Cementerio Municipal', municipalityId: 'mun1' })
    expect(result.description).toBeNull()
  })

  it('preserves description when provided', () => {
    const result = buildCemeteryData({ name: 'Cementerio Municipal', municipalityId: 'mun1', description: 'El cementerio del pueblo' })
    expect(result.description).toBe('El cementerio del pueblo')
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd packages/shared && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/municipality/ packages/shared/test/models/MunicipalityDataModel.test.ts
git commit -m "feat: add Municipality, Barrio, and Cemetery models"
```

---

## Task 3: Occupation and OccupationProposal models

**Files:**
- Create: `packages/shared/src/models/occupation/OccupationDataModel.ts`
- Create: `packages/shared/src/models/occupation/index.ts`
- Test: `packages/shared/test/models/OccupationDataModel.test.ts`

- [ ] **Step 1: Create the model file**

```typescript
// packages/shared/src/models/occupation/OccupationDataModel.ts

export interface OccupationData {
  name: string
  createdBy: string
  createdAt: Date
}

export interface OccupationDataInput {
  name: string
  createdBy: string
}

export function buildOccupationData(input: OccupationDataInput): OccupationData {
  return { ...input, createdAt: new Date() }
}

export type OccupationProposalStatus = 'pending' | 'approved' | 'rejected'

export interface OccupationProposalData {
  name: string
  proposedBy: string
  proposedAt: Date
  status: OccupationProposalStatus
  reviewedBy: string | null
  reviewedAt: Date | null
}

export interface OccupationProposalDataInput {
  name: string
  proposedBy: string
}

export function buildOccupationProposalData(input: OccupationProposalDataInput): OccupationProposalData {
  return {
    name: input.name,
    proposedBy: input.proposedBy,
    proposedAt: new Date(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
  }
}
```

- [ ] **Step 2: Create the barrel**

```typescript
// packages/shared/src/models/occupation/index.ts
export * from './OccupationDataModel'
```

- [ ] **Step 3: Write the failing tests**

```typescript
// packages/shared/test/models/OccupationDataModel.test.ts
import { describe, it, expect } from 'vitest'
import { buildOccupationData, buildOccupationProposalData } from '../../src/models/occupation/OccupationDataModel'

describe('buildOccupationData', () => {
  it('builds with required fields', () => {
    const result = buildOccupationData({ name: 'Agricultor', createdBy: 'admin1' })
    expect(result.name).toBe('Agricultor')
    expect(result.createdBy).toBe('admin1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildOccupationProposalData', () => {
  it('defaults to pending with no reviewer', () => {
    const result = buildOccupationProposalData({ name: 'Molinero', proposedBy: 'user1' })
    expect(result.name).toBe('Molinero')
    expect(result.proposedBy).toBe('user1')
    expect(result.status).toBe('pending')
    expect(result.reviewedBy).toBeNull()
    expect(result.reviewedAt).toBeNull()
    expect(result.proposedAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd packages/shared && pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/occupation/ packages/shared/test/models/OccupationDataModel.test.ts
git commit -m "feat: add Occupation and OccupationProposal models"
```

---

## Task 4: personService

**Files:**
- Create: `packages/shared/src/services/personService.ts`

- [ ] **Step 1: Create the service**

```typescript
// packages/shared/src/services/personService.ts
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { PersonData, PersonDataInput, PartialDate, MunicipalityLink, BurialPlace } from '../models/person'

function personsCol() {
  return collection(db, 'persons')
}

function toPartialDate(val: unknown): PartialDate | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  return {
    year: typeof v.year === 'number' ? v.year : null,
    month: typeof v.month === 'number' ? v.month : null,
    day: typeof v.day === 'number' ? v.day : null,
  }
}

function toMunicipalityLink(val: unknown): MunicipalityLink | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  if (typeof v.municipalityId !== 'string') return null
  return {
    municipalityId: v.municipalityId,
    barrioId: typeof v.barrioId === 'string' ? v.barrioId : null,
  }
}

function toBurialPlace(val: unknown): BurialPlace | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  if (typeof v.municipalityId !== 'string' || typeof v.cemeteryId !== 'string') return null
  return { municipalityId: v.municipalityId, cemeteryId: v.cemeteryId }
}

function fromDoc(id: string, data: Record<string, unknown>): PersonData & { id: string } {
  return {
    id,
    givenName: data.givenName as string,
    middleNames: Array.isArray(data.middleNames) ? (data.middleNames as string[]) : [],
    firstSurname: (data.firstSurname as string | null) ?? null,
    secondSurname: (data.secondSurname as string | null) ?? null,
    nickname: (data.nickname as string | null) ?? null,
    sex: (data.sex as PersonData['sex']) ?? null,
    birthday: toPartialDate(data.birthday),
    deathDate: toPartialDate(data.deathDate),
    birthPlace: toMunicipalityLink(data.birthPlace),
    burialPlace: toBurialPlace(data.burialPlace),
    municipalityLinks: Array.isArray(data.municipalityLinks)
      ? (data.municipalityLinks as unknown[]).map(toMunicipalityLink).filter((v): v is MunicipalityLink => v !== null)
      : [],
    occupationIds: Array.isArray(data.occupationIds) ? (data.occupationIds as string[]) : [],
    pendingOccupations: Array.isArray(data.pendingOccupations) ? (data.pendingOccupations as string[]) : [],
    biography: (data.biography as string | null) ?? null,
    photoURL: (data.photoURL as string | null) ?? null,
    userId: (data.userId as string | null) ?? null,
    createdBy: data.createdBy as string,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  }
}

export async function getPerson(personId: string): Promise<(PersonData & { id: string }) | null> {
  const snap = await getDoc(doc(personsCol(), personId))
  if (!snap.exists()) return null
  return fromDoc(snap.id, snap.data() as Record<string, unknown>)
}

export async function getPersonsByCreator(userId: string): Promise<(PersonData & { id: string })[]> {
  const q = query(personsCol(), where('createdBy', '==', userId), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>))
}

export async function getPersonByUserId(userId: string): Promise<(PersonData & { id: string }) | null> {
  const q = query(personsCol(), where('userId', '==', userId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return fromDoc(d.id, d.data() as Record<string, unknown>)
}

export async function createPerson(input: PersonDataInput): Promise<string> {
  const ref = await addDoc(personsCol(), {
    givenName: input.givenName,
    middleNames: input.middleNames ?? [],
    firstSurname: input.firstSurname ?? null,
    secondSurname: input.secondSurname ?? null,
    nickname: input.nickname ?? null,
    sex: input.sex ?? null,
    birthday: input.birthday ?? null,
    deathDate: input.deathDate ?? null,
    birthPlace: input.birthPlace ?? null,
    burialPlace: input.burialPlace ?? null,
    municipalityLinks: input.municipalityLinks ?? [],
    occupationIds: input.occupationIds ?? [],
    pendingOccupations: input.pendingOccupations ?? [],
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    userId: input.userId ?? null,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePerson(
  personId: string,
  data: Partial<Omit<PersonData, 'createdBy' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(personsCol(), personId), data as Record<string, unknown>)
}

export async function deletePerson(personId: string): Promise<void> {
  await deleteDoc(doc(personsCol(), personId))
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/services/personService.ts
git commit -m "feat: add personService for top-level persons collection"
```

---

## Task 5: municipalityService

**Files:**
- Create: `packages/shared/src/services/municipalityService.ts`

- [ ] **Step 1: Create the service**

```typescript
// packages/shared/src/services/municipalityService.ts
import {
  collection, doc, getDoc, getDocs, addDoc, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { MunicipalityData, MunicipalityDataInput, BarrioData, BarrioDataInput, CemeteryData, CemeteryDataInput } from '../models/municipality'

function municipalitiesCol() {
  return collection(db, 'municipalities')
}
function barriosCol(municipalityId: string) {
  return collection(db, 'municipalities', municipalityId, 'barrios')
}
function cemeteriesCol(municipalityId: string) {
  return collection(db, 'municipalities', municipalityId, 'cemeteries')
}

export async function getMunicipality(id: string): Promise<(MunicipalityData & { id: string }) | null> {
  const snap = await getDoc(doc(municipalitiesCol(), id))
  if (!snap.exists()) return null
  const d = snap.data() as Record<string, unknown>
  return {
    id: snap.id,
    name: d.name as string,
    province: d.province as string,
    comunidadAutonoma: d.comunidadAutonoma as string,
    codigoINE: d.codigoINE as string,
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(),
  }
}

export async function getMunicipalities(): Promise<(MunicipalityData & { id: string })[]> {
  const q = query(municipalitiesCol(), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      province: data.province as string,
      comunidadAutonoma: data.comunidadAutonoma as string,
      codigoINE: data.codigoINE as string,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createMunicipality(input: MunicipalityDataInput): Promise<string> {
  const ref = await addDoc(municipalitiesCol(), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function getBarrios(municipalityId: string): Promise<(BarrioData & { id: string })[]> {
  const q = query(barriosCol(municipalityId), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      municipalityId,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createBarrio(municipalityId: string, input: BarrioDataInput): Promise<string> {
  const ref = await addDoc(barriosCol(municipalityId), {
    name: input.name,
    municipalityId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getCemeteries(municipalityId: string): Promise<(CemeteryData & { id: string })[]> {
  const q = query(cemeteriesCol(municipalityId), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      description: (data.description as string | null) ?? null,
      municipalityId,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createCemetery(municipalityId: string, input: CemeteryDataInput): Promise<string> {
  const ref = await addDoc(cemeteriesCol(municipalityId), {
    name: input.name,
    description: input.description ?? null,
    municipalityId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/services/municipalityService.ts
git commit -m "feat: add municipalityService with barrios and cemeteries"
```

---

## Task 6: occupationService

**Files:**
- Create: `packages/shared/src/services/occupationService.ts`

- [ ] **Step 1: Create the service**

```typescript
// packages/shared/src/services/occupationService.ts
import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { OccupationData, OccupationDataInput, OccupationProposalData, OccupationProposalStatus } from '../models/occupation'

function occupationsCol() {
  return collection(db, 'occupations')
}
function proposalsCol() {
  return collection(db, 'occupationProposals')
}

export async function getOccupations(): Promise<(OccupationData & { id: string })[]> {
  const q = query(occupationsCol(), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    }
  })
}

export async function createOccupation(input: OccupationDataInput): Promise<string> {
  const ref = await addDoc(occupationsCol(), { ...input, createdAt: serverTimestamp() })
  return ref.id
}

export async function proposeOccupation(name: string, proposedBy: string): Promise<string> {
  const ref = await addDoc(proposalsCol(), {
    name,
    proposedBy,
    proposedAt: serverTimestamp(),
    status: 'pending' as OccupationProposalStatus,
    reviewedBy: null,
    reviewedAt: null,
  })
  return ref.id
}

export async function getPendingProposals(): Promise<(OccupationProposalData & { id: string })[]> {
  const q = query(proposalsCol(), where('status', '==', 'pending'), orderBy('proposedAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: data.name as string,
      proposedBy: data.proposedBy as string,
      proposedAt: data.proposedAt instanceof Timestamp ? data.proposedAt.toDate() : new Date(),
      status: data.status as OccupationProposalStatus,
      reviewedBy: (data.reviewedBy as string | null) ?? null,
      reviewedAt: data.reviewedAt instanceof Timestamp ? data.reviewedAt.toDate() : null,
    }
  })
}

export async function reviewProposal(
  proposalId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<void> {
  await updateDoc(doc(proposalsCol(), proposalId), {
    status,
    reviewedBy,
    reviewedAt: serverTimestamp(),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/services/occupationService.ts
git commit -m "feat: add occupationService with proposal flow"
```

---

## Task 7: Update models/index.ts and services/index.ts

**Files:**
- Modify: `packages/shared/src/models/index.ts`
- Modify: `packages/shared/src/services/index.ts`

- [ ] **Step 1: Update models barrel**

Replace the full content of `packages/shared/src/models/index.ts` with:

```typescript
export * from './core'
export * from './user'
export * from './village'
export * from './organization'
export * from './event'
export * from './notification'
export * from './person'
export * from './municipality'
export * from './occupation'
```

- [ ] **Step 2: Update services barrel**

Replace the full content of `packages/shared/src/services/index.ts` with:

```typescript
export * from './userService'
export * from './adminService'
export * from './villageService'
export * from './villageMemberService'
export * from './inviteTokenService'
export * from './organizationService'
export * from './orgMemberService'
export * from './eventService'
export * from './registrationService'
export * from './notificationService'
export * from './imageService'
export * from './censoService'
export * from './membershipProfileService'
export * from './feedService'
export * from './personService'
export * from './municipalityService'
export * from './occupationService'
```

Note: `personaService` is intentionally omitted — it will be deleted in Task 12.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors on the new exports (existing personaService errors surface in Task 12).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/index.ts packages/shared/src/services/index.ts
git commit -m "feat: export person, municipality, occupation from shared barrels"
```

---

## Task 8: Update RegistrationDataModel — personId always required

**Files:**
- Modify: `packages/shared/src/models/event/RegistrationDataModel.ts`
- Modify: `packages/shared/test/models/RegistrationDataModel.test.ts`

- [ ] **Step 1: Replace RegistrationDataModel.ts**

```typescript
// packages/shared/src/models/event/RegistrationDataModel.ts
export type RegistrationStatus = 'confirmed' | 'waitlisted'

export interface RegistrationData {
  userId: string        // who owns this registration (for permissions/queries)
  personId: string      // the person being registered — always required
  name: string          // denormalized display name
  status: RegistrationStatus
  position: number
  registeredAt: Date
}

export interface RegistrationDataInput {
  userId: string
  personId: string
  name: string
  status: RegistrationStatus
  position: number
  registeredAt?: Date
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return { ...input, registeredAt: input.registeredAt ?? new Date() }
}
```

- [ ] **Step 2: Replace RegistrationDataModel.test.ts**

```typescript
// packages/shared/test/models/RegistrationDataModel.test.ts
import { describe, it, expect } from 'vitest'
import { buildRegistrationData } from '../../src/models/event/RegistrationDataModel'

describe('buildRegistrationData', () => {
  it('builds a confirmed registration', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personId: 'person-1',
      name: 'Juan García',
      status: 'confirmed',
      position: 1,
    })
    expect(reg.userId).toBe('user-1')
    expect(reg.personId).toBe('person-1')
    expect(reg.name).toBe('Juan García')
    expect(reg.status).toBe('confirmed')
    expect(reg.position).toBe(1)
    expect(reg.registeredAt).toBeInstanceOf(Date)
  })

  it('builds a waitlisted registration', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personId: 'person-1',
      name: 'Juan García',
      status: 'waitlisted',
      position: 51,
    })
    expect(reg.status).toBe('waitlisted')
    expect(reg.position).toBe(51)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd packages/shared && pnpm test --run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/event/RegistrationDataModel.ts packages/shared/test/models/RegistrationDataModel.test.ts
git commit -m "feat: personId always required on RegistrationData, remove nullable personaId"
```

---

## Task 9: Update imageService — person photo path

**Files:**
- Modify: `packages/shared/src/services/imageService.ts`

- [ ] **Step 1: Replace `uploadPersonaImage` with `uploadPersonImage`**

Read `packages/shared/src/services/imageService.ts`. Replace the `uploadPersonaImage` function with:

```typescript
export async function uploadPersonImage(personId: string, file: File): Promise<string> {
  assertImage(file)
  const imageId = generateImageId(file.name)
  const storageRef = ref(storage, `persons/${personId}/photos/${imageId}`)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}
```

Remove the old `uploadPersonaImage` function entirely.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/services/imageService.ts
git commit -m "feat: update person photo storage path to persons/{personId}/photos"
```

---

## Task 10: Add personId to UserDataModel

**Files:**
- Modify: `packages/shared/src/models/user/UserDataModel.ts`
- Modify: `packages/shared/test/models/UserDataModel.test.ts`

- [ ] **Step 1: Add personId to UserData**

In `packages/shared/src/models/user/UserDataModel.ts`, add `personId: string | null` to `UserData`, `personId?: string | null` to `UserDataInput`, and `personId: input.personId ?? null` to `buildUserData`. The updated file:

```typescript
export interface UserData {
  displayName: string
  email: string
  birthday: Date
  biography: string | null
  telephone: string | null
  photoURL: string | null
  activeVillageId: string | null
  personId: string | null
  createdAt: Date
}

export interface UserDataInput {
  displayName: string
  email: string
  birthday: Date
  biography?: string | null
  telephone?: string | null
  photoURL?: string | null
  activeVillageId?: string | null
  personId?: string | null
  createdAt?: Date
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    birthday: input.birthday,
    biography: input.biography ?? null,
    telephone: input.telephone ?? null,
    photoURL: input.photoURL ?? null,
    activeVillageId: input.activeVillageId ?? null,
    personId: input.personId ?? null,
    createdAt: input.createdAt ?? new Date(),
  }
}
```

- [ ] **Step 2: Add test case to UserDataModel.test.ts**

Append one test to the existing `describe('buildUserData')` block:

```typescript
it('defaults personId to null', () => {
  const user = buildUserData({
    displayName: 'Ana',
    email: 'ana@test.com',
    birthday: new Date('1990-01-01'),
  })
  expect(user.personId).toBeNull()
})
```

- [ ] **Step 3: Run tests**

```bash
cd packages/shared && pnpm test --run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/user/UserDataModel.ts packages/shared/test/models/UserDataModel.test.ts
git commit -m "feat: add personId to UserData linking to persons collection"
```

---

## Task 11: Update Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Read the current file**

```bash
cat firestore.rules
```

- [ ] **Step 2: Remove the personas subcollection rule**

Find and remove the block:

```
match /personas/{personaId} { ... }
```

inside `match /users/{userId}`.

- [ ] **Step 3: Add new collection rules**

Append inside the root `match /databases/{database}/documents` block:

```javascript
// persons — canonical people registry
match /persons/{personId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated()
    && request.resource.data.createdBy == request.auth.uid;
  allow update: if isAuthenticated()
    && (
      resource.data.userId == request.auth.uid
      || (resource.data.createdBy == request.auth.uid && resource.data.userId == null)
      || isAppAdmin()
    );
  allow delete: if isAuthenticated()
    && (
      (resource.data.createdBy == request.auth.uid && resource.data.userId == null)
      || isAppAdmin()
    );
}

// municipalities — predefined reference data, superadmin managed
match /municipalities/{municipalityId} {
  allow read: if true;
  allow write: if isAppAdmin();

  match /barrios/{barrioId} {
    allow read: if true;
    allow write: if isAppAdmin();
  }

  match /cemeteries/{cemeteryId} {
    allow read: if true;
    allow write: if isAppAdmin();
  }
}

// occupations — superadmin managed list
match /occupations/{occupationId} {
  allow read: if true;
  allow write: if isAppAdmin();
}

// occupationProposals — users propose, superadmin reviews
match /occupationProposals/{proposalId} {
  allow read: if isOwner(resource.data.proposedBy) || isAppAdmin();
  allow create: if isAuthenticated()
    && request.resource.data.proposedBy == request.auth.uid
    && request.resource.data.status == 'pending';
  allow update: if isAppAdmin();
  allow delete: if isOwner(resource.data.proposedBy) || isAppAdmin();
}
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for persons, municipalities, occupations; remove personas rules"
```

---

## Task 12: Update registrationService for new personId field

**Files:**
- Modify: `packages/shared/src/services/registrationService.ts`

- [ ] **Step 1: Update RegisterInput and all personaId references**

Replace the `RegisterInput` interface and all `personaId` → `personId` references. The updated file:

```typescript
import {
  collection, doc, getDocs, deleteDoc, query, orderBy, where,
  writeBatch, serverTimestamp, Timestamp, collectionGroup, getCountFromServer,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { RegistrationData, RegistrationStatus } from '../models/event/RegistrationDataModel'

export interface RegisterInput {
  userId: string
  personId: string
  name: string
}

function regsCol(eventId: string) {
  return collection(db, 'events', eventId, 'registrations')
}

function mapRegDoc(d: { id: string; data: () => Record<string, unknown> }): RegistrationData & { id: string } {
  const data = d.data()
  return {
    id: d.id,
    userId: data['userId'] as string,
    personId: data['personId'] as string,
    name: data['name'] as string,
    status: data['status'] as RegistrationStatus,
    position: data['position'] as number,
    registeredAt: (data['registeredAt'] as Timestamp).toDate(),
  }
}

export function determineRegistrationStatus(
  maxAttendees: number | null,
  currentConfirmedCount: number
): RegistrationStatus {
  if (maxAttendees === null) return 'confirmed'
  return currentConfirmedCount < maxAttendees ? 'confirmed' : 'waitlisted'
}

export async function getEventRegistrations(eventId: string): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), orderBy('position', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]))
}

export async function getConfirmedCount(eventId: string): Promise<number> {
  const q = query(regsCol(eventId), where('status', '==', 'confirmed'))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

export async function getTotalCount(eventId: string): Promise<number> {
  const snap = await getCountFromServer(regsCol(eventId))
  return snap.data().count
}

export async function getUserRegistrations(eventId: string, userId: string): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]))
}

export async function registerToEvent(
  eventId: string,
  inputs: RegisterInput[],
  maxAttendees: number | null
): Promise<void> {
  const confirmedCount = await getConfirmedCount(eventId)
  const totalCount = await getTotalCount(eventId)
  const batch = writeBatch(db)
  inputs.forEach((input, i) => {
    const newRef = doc(regsCol(eventId))
    const position = totalCount + i + 1
    const status = determineRegistrationStatus(maxAttendees, confirmedCount + i)
    batch.set(newRef, {
      userId: input.userId,
      personId: input.personId,
      name: input.name,
      status,
      position,
      registeredAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export async function cancelRegistration(eventId: string, regId: string): Promise<void> {
  await deleteDoc(doc(regsCol(eventId), regId))
}

export async function getUserRegistrationsAcrossEvents(
  userId: string
): Promise<(RegistrationData & { id: string; eventPath: string })[]> {
  const q = query(
    collectionGroup(db, 'registrations'),
    where('userId', '==', userId),
    orderBy('registeredAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    const pathSegments = d.ref.path.split('/')
    const eventPath = pathSegments.slice(0, 2).join('/')
    return {
      id: d.id,
      userId: data['userId'] as string,
      personId: data['personId'] as string,
      name: data['name'] as string,
      status: data['status'] as RegistrationStatus,
      position: data['position'] as number,
      registeredAt: (data['registeredAt'] as Timestamp).toDate(),
      eventPath,
    }
  })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/services/registrationService.ts
git commit -m "feat: update registrationService to use personId (never null)"
```

---

## Task 13: Delete old persona files

**Files:**
- Delete: `packages/shared/src/models/user/PersonaDataModel.ts`
- Delete: `packages/shared/src/services/personaService.ts`
- Modify: `packages/shared/src/models/user/index.ts` — remove PersonaDataModel export

- [ ] **Step 1: Read the user model barrel**

```bash
cat packages/shared/src/models/user/index.ts
```

- [ ] **Step 2: Remove PersonaDataModel export from user barrel**

Edit `packages/shared/src/models/user/index.ts` and remove the line `export * from './PersonaDataModel'`.

- [ ] **Step 3: Delete the files**

```bash
rm packages/shared/src/models/user/PersonaDataModel.ts
rm packages/shared/src/services/personaService.ts
```

- [ ] **Step 4: Type-check — fix any remaining references**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -50
```

If errors appear referencing `PersonaData`, `createPersona`, `updatePersona`, `deletePersona`, `getPersonas`, or `usePersonas`, fix them (they come from components updated in Tasks 14–16 — complete those tasks first, then return here if needed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove PersonaDataModel and personaService (replaced by persons collection)"
```

---

## Task 14: PersonCard component

**Files:**
- Create: `apps/web/components/profile/PersonCard.tsx`
- Delete: `apps/web/components/profile/PersonaCard.tsx`

- [ ] **Step 1: Create PersonCard**

```tsx
// apps/web/components/profile/PersonCard.tsx
'use client'

import { Pencil, Trash2, User } from 'lucide-react'
import type { PersonData } from '@cultuvilla/shared/models/person'
import { buildDisplayName } from '@cultuvilla/shared/models/person'

interface PersonCardProps {
  person: PersonData & { id: string }
  onEdit: () => void
  onDelete: () => void
}

function formatPartialDate(pd: PersonData['birthday']): string | null {
  if (!pd) return null
  if (pd.day && pd.month && pd.year) {
    return new Date(pd.year, pd.month - 1, pd.day).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }
  if (pd.month && pd.year) return `${pd.month}/${pd.year}`
  if (pd.year) return String(pd.year)
  return null
}

export function PersonCard({ person, onEdit, onDelete }: PersonCardProps) {
  const displayName = buildDisplayName(person)
  const birthdayStr = formatPartialDate(person.birthday)
  const deathDateStr = formatPartialDate(person.deathDate)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
      {person.photoURL ? (
        <img src={person.photoURL} alt={displayName} className="w-12 h-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <User size={22} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900">{displayName}</h3>
        {person.nickname && (
          <p className="text-xs text-blue-600 font-medium">"{person.nickname}"</p>
        )}
        {birthdayStr && (
          <p className="text-xs text-gray-500 mt-0.5">
            {birthdayStr}{deathDateStr ? ` – ${deathDateStr}` : ''}
          </p>
        )}
        {person.biography && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{person.biography}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete old card**

```bash
git rm apps/web/components/profile/PersonaCard.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/profile/PersonCard.tsx
git commit -m "feat: add PersonCard with nickname, partial date range, replace PersonaCard"
```

---

## Task 15: PersonForm component

**Files:**
- Create: `apps/web/components/profile/PersonForm.tsx`
- Delete: `apps/web/components/profile/PersonaForm.tsx`

Note: Municipality/barrio pickers and occupation multi-select require fetching reference data — those are wired up as follow-up tasks. This form covers all identity fields (name, sex, dates, bio, photo).

- [ ] **Step 1: Create PersonForm**

```tsx
// apps/web/components/profile/PersonForm.tsx
'use client'

import { useRef, useState } from 'react'
import { Camera, User } from 'lucide-react'
import type { PersonData, PartialDate } from '@cultuvilla/shared/models/person'

type Sex = 'male' | 'female' | 'other'

interface PersonFormProps {
  initial?: Partial<Pick<PersonData,
    'givenName' | 'middleNames' | 'firstSurname' | 'secondSurname' |
    'nickname' | 'sex' | 'birthday' | 'deathDate' | 'biography' | 'photoURL'
  >>
  onSubmit: (data: {
    givenName: string
    middleNames: string[]
    firstSurname: string | null
    secondSurname: string | null
    nickname: string | null
    sex: Sex | null
    birthday: PartialDate | null
    deathDate: PartialDate | null
    biography: string | null
    photoFile: File | null
  }) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

function pdToInputs(pd: PartialDate | null | undefined) {
  return {
    year: pd?.year != null ? String(pd.year) : '',
    month: pd?.month != null ? String(pd.month) : '',
    day: pd?.day != null ? String(pd.day) : '',
  }
}

function inputsToPd(year: string, month: string, day: string): PartialDate | null {
  if (!year && !month && !day) return null
  return {
    year: year ? parseInt(year, 10) : null,
    month: month ? parseInt(month, 10) : null,
    day: day ? parseInt(day, 10) : null,
  }
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
  { value: 'other', label: 'Otro' },
]

export function PersonForm({ initial, onSubmit, onCancel, submitLabel = 'Guardar' }: PersonFormProps) {
  const [givenName, setGivenName] = useState(initial?.givenName ?? '')
  const [middleNames, setMiddleNames] = useState((initial?.middleNames ?? []).join(', '))
  const [firstSurname, setFirstSurname] = useState(initial?.firstSurname ?? '')
  const [secondSurname, setSecondSurname] = useState(initial?.secondSurname ?? '')
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [sex, setSex] = useState<Sex | ''>(initial?.sex ?? '')

  const bInit = pdToInputs(initial?.birthday)
  const [birthYear, setBirthYear] = useState(bInit.year)
  const [birthMonth, setBirthMonth] = useState(bInit.month)
  const [birthDay, setBirthDay] = useState(bInit.day)

  const dInit = pdToInputs(initial?.deathDate)
  const [deathYear, setDeathYear] = useState(dInit.year)
  const [deathMonth, setDeathMonth] = useState(dInit.month)
  const [deathDay, setDeathDay] = useState(dInit.day)

  const [biography, setBiography] = useState(initial?.biography ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoURL ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('El archivo no es una imagen'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen supera 5 MB'); return }
    setError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!givenName.trim()) { setError('El nombre es obligatorio'); return }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        givenName: givenName.trim(),
        middleNames: middleNames.split(',').map(s => s.trim()).filter(Boolean),
        firstSurname: firstSurname.trim() || null,
        secondSurname: secondSurname.trim() || null,
        nickname: nickname.trim() || null,
        sex: (sex as Sex) || null,
        birthday: inputsToPd(birthYear, birthMonth, birthDay),
        deathDate: inputsToPd(deathYear, deathMonth, deathDay),
        biography: biography.trim() || null,
        photoFile,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const numCls = 'border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Photo */}
      <div className="flex justify-center mb-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {photoPreview
            ? <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
            : <User size={32} className="text-gray-400" />}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <Camera size={20} className="text-white" />
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Nombre *" value={givenName} onChange={e => setGivenName(e.target.value)} required className={inputCls} />
        <input type="text" placeholder="Segundos nombres (sep. comas)" value={middleNames} onChange={e => setMiddleNames(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Primer apellido" value={firstSurname} onChange={e => setFirstSurname(e.target.value)} className={inputCls} />
        <input type="text" placeholder="Segundo apellido" value={secondSurname} onChange={e => setSecondSurname(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Mote (apodo)" value={nickname} onChange={e => setNickname(e.target.value)} className={inputCls} />
        <select value={sex} onChange={e => setSex(e.target.value as Sex | '')} className={inputCls}>
          <option value="">Sexo (opcional)</option>
          {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Birthday */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 ml-1">Fecha de nacimiento (año, mes y día son opcionales)</label>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" placeholder="Año" value={birthYear} onChange={e => setBirthYear(e.target.value)} className={numCls} />
          <input type="number" placeholder="Mes" min={1} max={12} value={birthMonth} onChange={e => setBirthMonth(e.target.value)} className={numCls} />
          <input type="number" placeholder="Día" min={1} max={31} value={birthDay} onChange={e => setBirthDay(e.target.value)} className={numCls} />
        </div>
      </div>

      {/* Death date */}
      <div>
        <label className="block text-xs text-gray-500 mb-1 ml-1">Fecha de defunción (opcional)</label>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" placeholder="Año" value={deathYear} onChange={e => setDeathYear(e.target.value)} className={numCls} />
          <input type="number" placeholder="Mes" min={1} max={12} value={deathMonth} onChange={e => setDeathMonth(e.target.value)} className={numCls} />
          <input type="number" placeholder="Día" min={1} max={31} value={deathDay} onChange={e => setDeathDay(e.target.value)} className={numCls} />
        </div>
      </div>

      <textarea
        placeholder="Biografía (opcional)" value={biography}
        onChange={e => setBiography(e.target.value)} rows={3}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {submitting ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Delete old form**

```bash
git rm apps/web/components/profile/PersonaForm.tsx
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/profile/PersonForm.tsx
git commit -m "feat: add PersonForm with full name, sex, partial dates, bio, photo"
```

---

## Task 16: usePersons hook and persons page

**Files:**
- Create: `apps/web/hooks/usePersons.ts`
- Create: `apps/web/app/profile/persons/page.tsx`
- Delete: `apps/web/hooks/usePersonas.ts`
- Delete: `apps/web/app/profile/personas/` (directory)
- Modify: `apps/web/app/profile/page.tsx` — update link

- [ ] **Step 1: Create usePersons hook**

```typescript
// apps/web/hooks/usePersons.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPersonsByCreator } from '@cultuvilla/shared/services/personService'
import type { PersonData } from '@cultuvilla/shared/models/person'
import { useAuth } from './useAuth'

export function usePersons() {
  const { user } = useAuth()
  const [persons, setPersons] = useState<(PersonData & { id: string })[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setPersons([]); setLoading(false); return }
    setLoading(true)
    try {
      setPersons(await getPersonsByCreator(user.uid))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  return { persons, loading, reload: load }
}
```

- [ ] **Step 2: Create the persons page**

```tsx
// apps/web/app/profile/persons/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePersons } from '@/hooks/usePersons'
import { createPerson, updatePerson, deletePerson } from '@cultuvilla/shared/services/personService'
import { uploadPersonImage } from '@cultuvilla/shared/services/imageService'
import type { PersonData, PartialDate } from '@cultuvilla/shared/models/person'
import type { Sex } from '@cultuvilla/shared/models/person'
import { PersonCard } from '@/components/profile/PersonCard'
import { PersonForm } from '@/components/profile/PersonForm'
import { SkeletonLoader } from '@/components/common/SkeletonLoader'

type FormData = {
  givenName: string
  middleNames: string[]
  firstSurname: string | null
  secondSurname: string | null
  nickname: string | null
  sex: Sex | null
  birthday: PartialDate | null
  deathDate: PartialDate | null
  biography: string | null
  photoFile: File | null
}

export default function PersonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { persons, loading, reload } = usePersons()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-48" />
        {[1, 2].map(i => <SkeletonLoader key={i} className="h-20 rounded-xl" />)}
      </div>
    )
  }

  if (!user) return null

  const handleAdd = async (data: FormData) => {
    const personId = await createPerson({ ...data, createdBy: user.uid })
    if (data.photoFile) {
      const photoURL = await uploadPersonImage(personId, data.photoFile)
      await updatePerson(personId, { photoURL })
    }
    setShowAddForm(false)
    reload()
  }

  const handleEdit = async (personId: string, data: FormData) => {
    let photoURL: string | undefined
    if (data.photoFile) {
      photoURL = await uploadPersonImage(personId, data.photoFile)
    }
    await updatePerson(personId, {
      givenName: data.givenName,
      middleNames: data.middleNames,
      firstSurname: data.firstSurname,
      secondSurname: data.secondSurname,
      nickname: data.nickname,
      sex: data.sex,
      birthday: data.birthday,
      deathDate: data.deathDate,
      biography: data.biography,
      ...(photoURL !== undefined && { photoURL }),
    })
    setEditingId(null)
    reload()
  }

  const handleDelete = async (personId: string) => {
    if (!confirm('¿Eliminar esta persona?')) return
    await deletePerson(personId)
    reload()
  }

  return (
    <div className="px-4 py-6">
      <Link href="/profile" className="flex items-center gap-1 text-blue-600 text-sm mb-4">
        <ArrowLeft size={16} /> Mi perfil
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Añadir
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Nueva persona</h2>
          <PersonForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Añadir"
          />
        </div>
      )}

      {persons.length === 0 && !showAddForm ? (
        <p className="text-gray-500 text-center py-12 text-sm">No has añadido ninguna persona todavía.</p>
      ) : (
        <div className="space-y-3">
          {persons.map(person =>
            editingId === person.id ? (
              <div key={person.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Editar</h2>
                <PersonForm
                  initial={person}
                  onSubmit={data => handleEdit(person.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <PersonCard
                key={person.id}
                person={person}
                onEdit={() => setEditingId(person.id)}
                onDelete={() => handleDelete(person.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update profile page link**

In `apps/web/app/profile/page.tsx`, find the link to `/profile/personas` and update it to `/profile/persons`.

- [ ] **Step 4: Delete old hook and page**

```bash
git rm apps/web/hooks/usePersonas.ts
git rm -r apps/web/app/profile/personas/
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/usePersons.ts apps/web/app/profile/persons/ apps/web/app/profile/page.tsx
git commit -m "feat: add persons page and usePersons hook, replace personas UI"
```

---

## Task 17: Update acceptInvite Cloud Function to create person record

**Files:**
- Modify: `functions/src/acceptInvite.ts`

- [ ] **Step 1: Read the current file**

```bash
cat functions/src/acceptInvite.ts
```

- [ ] **Step 2: Import FieldValue if not already imported**

At the top of the file, ensure this import exists:

```typescript
import { FieldValue } from 'firebase-admin/firestore'
```

- [ ] **Step 3: After creating the user doc, create the person record**

Find the block that calls `await db.collection('users').doc(userId).set(userDoc)` (inside the new-user-profile branch). Immediately after it, add:

```typescript
const personRef = db.collection('persons').doc()
await personRef.set({
  givenName: (profileData.displayName as string).split(' ')[0],
  middleNames: [],
  firstSurname: null,
  secondSurname: null,
  nickname: null,
  sex: null,
  birthday: null,
  deathDate: null,
  birthPlace: null,
  burialPlace: null,
  municipalityLinks: [],
  occupationIds: [],
  pendingOccupations: [],
  biography: null,
  photoURL: profileData.photoURL ?? null,
  userId: userId,
  createdBy: userId,
  createdAt: FieldValue.serverTimestamp(),
})
await db.collection('users').doc(userId).update({ personId: personRef.id })
```

- [ ] **Step 4: Build functions**

```bash
cd functions && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add functions/src/acceptInvite.ts
git commit -m "feat: create person record in acceptInvite and link personId on UserData"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| `persons` top-level collection | Task 1, 4 |
| `givenName`, `middleNames`, `firstSurname`, `secondSurname`, `nickname` | Task 1 |
| `sex: 'male' \| 'female' \| 'other' \| null` | Task 1, 15 |
| `birthday` / `deathDate` as partial dates (all parts nullable) | Task 1, 15 |
| `birthPlace`, `municipalityLinks`, `burialPlace` | Task 1, 4 |
| `occupationIds: string[]` (multi-select) | Task 1, 4 |
| `pendingOccupations: string[]` (free text while proposals pending) | Task 1, 4 |
| `userId: string \| null` (auth link) | Task 1, 10, 17 |
| `municipalities` with `codigoINE`, `province`, `comunidadAutonoma` | Task 2, 5 |
| `barrios` as subcollection of municipality | Task 2, 5 |
| `cemeteries` as subcollection of municipality | Task 2, 5 |
| `occupations` list, superadmin-managed | Task 3, 6 |
| `occupationProposals` with pending/approved/rejected + review flow | Task 3, 6 |
| Firestore rules for all new collections | Task 11 |
| `personId` always required on registrations | Task 8, 12 |
| `UserData.personId` linking to person record | Task 10, 17 |
| Photo upload to `persons/{personId}/photos/` path | Task 9 |
| PersonForm: full name fields + sex + partial dates + photo | Task 15 |
| PersonCard: nickname, partial date display, death date | Task 14 |
| Remove old `PersonaDataModel` and `personaService` | Task 13 |

### Not in this plan (follow-up)
- Municipality/barrio pickers in PersonForm (requires loading reference data)
- Occupation multi-select with proposal flow in PersonForm
- SignUpModal update to pass `personId` (requires user to have their own person record first)
- Superadmin UI for municipalities, cemeteries, occupations, proposals
- Family tree data model and UI (separate plan)
- Firestore composite index for `persons` queried by `createdBy` + `createdAt`
