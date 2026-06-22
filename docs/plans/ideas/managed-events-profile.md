# Managed Events on Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Eventos gestionados" section to the user profile — a horizontal scroll of every event the person created, with an "En curso" badge on events happening now.

**Architecture:** A pure `isEventOngoing` helper in the shared event model is the single source of truth for "ongoing". `FeedCard`/`EventCard` gain an optional badge overlay. A new `ManagedEventsScroll` profile component partitions events (ongoing first) and renders `EventCard`s, badging the ongoing ones. `profile.tsx` loads the events and renders the section.

**Tech Stack:** Expo / React Native, NativeWind, expo-router, `@testing-library/react-native` + Jest (mobile), Vitest (`packages/shared`), `@cultuvilla/shared`.

## Global Constraints

- Shared tests run with Vitest: `pnpm --filter @cultuvilla/shared test -- <pattern>`.
- Mobile tests run with Jest: `pnpm --filter cultuvilla-mobile test -- <pattern>`.
- Only one locale catalog: `packages/i18n/messages/es.json`. Keys are untyped strings; no codegen.
- "Ongoing" is derived, never stored: `status === 'published' && startDate <= now && (endDate == null || endDate >= now)`.
- "Managed" events = `getEventsByCreator(uid)` (`where('createdBy','==',uid)`, `orderBy('createdAt','desc')`). Do not change the query or its index.
- Only ongoing events get a badge; all other statuses render as plain event cards. Tapping any card → `/event/{id}`.
- Accent color for the badge: `#bb5d3a` (palette accent, same value `VillageSections.ACCENT` uses). Define it locally in `FeedCard`; do not import from `VillageSections`.
- `EventData` lives in `packages/shared/src/models/event/EventDataModel.ts`; `getEventsByCreator` in `packages/shared/src/services/eventService.ts`.

---

### Task 1: `isEventOngoing` helper (shared)

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts` (add the function near `isEventSignupOpen`, ~line 80)
- Test: `packages/shared/test/models/event/EventDataModel.test.ts` (append cases)

**Interfaces:**
- Produces:

```ts
export function isEventOngoing(
  event: Pick<EventData, 'status' | 'startDate' | 'endDate'>,
  now: Date,
): boolean
```

- [ ] **Step 1: Write the failing tests**

Append to `packages/shared/test/models/event/EventDataModel.test.ts` (the file already imports from `../../../src/models/event/EventDataModel`; add `isEventOngoing` to that import). Add this block at the end of the file:

```ts
describe('isEventOngoing', () => {
  const now = new Date('2026-06-15T19:00:00Z');

  it('is true for a published event started, with a future end', () => {
    expect(
      isEventOngoing(
        { status: 'published', startDate: new Date('2026-06-15T18:00:00Z'), endDate: new Date('2026-06-15T22:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('is true for a published event started, with no end date', () => {
    expect(
      isEventOngoing(
        { status: 'published', startDate: new Date('2026-06-15T18:00:00Z'), endDate: null },
        now,
      ),
    ).toBe(true);
  });

  it('is false before the start date', () => {
    expect(
      isEventOngoing(
        { status: 'published', startDate: new Date('2026-06-15T20:00:00Z'), endDate: null },
        now,
      ),
    ).toBe(false);
  });

  it('is false after the end date', () => {
    expect(
      isEventOngoing(
        { status: 'published', startDate: new Date('2026-06-15T10:00:00Z'), endDate: new Date('2026-06-15T12:00:00Z') },
        now,
      ),
    ).toBe(false);
  });

  it('is false for a non-published event inside its window', () => {
    expect(
      isEventOngoing(
        { status: 'draft', startDate: new Date('2026-06-15T18:00:00Z'), endDate: null },
        now,
      ),
    ).toBe(false);
  });
});
```

Update the import at the top of the file from:

```ts
import {
  EventDataSchema,
  buildEventData,
  isEventFull,
  isEventSignupOpen,
} from '../../../src/models/event/EventDataModel';
```

to add `isEventOngoing`:

```ts
import {
  EventDataSchema,
  buildEventData,
  isEventFull,
  isEventSignupOpen,
  isEventOngoing,
} from '../../../src/models/event/EventDataModel';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: FAIL — `isEventOngoing is not a function` / import has no matching export.

- [ ] **Step 3: Implement the helper**

In `packages/shared/src/models/event/EventDataModel.ts`, after the existing `isEventSignupOpen` function, add:

```ts
/**
 * "Ongoing" / en curso is derived, never stored: a published event whose start
 * has passed and whose end (if any) has not. `now` is passed in so callers
 * compute it once and tests stay deterministic.
 */
export function isEventOngoing(
  event: Pick<EventData, 'status' | 'startDate' | 'endDate'>,
  now: Date,
): boolean {
  if (event.status !== 'published') return false;
  if (event.startDate > now) return false;
  if (event.endDate !== null && event.endDate < now) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: PASS (existing cases + 5 new `isEventOngoing` cases).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts packages/shared/test/models/event/EventDataModel.test.ts
git commit -m "feat(shared): add isEventOngoing event-model helper"
```

---

### Task 2: i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `profile` object)

**Interfaces:**
- Produces keys: `profile.managedEventsSection.title`, `.empty`, `.ongoing`.

- [ ] **Step 1: Add the keys**

In `packages/i18n/messages/es.json`, inside the `"profile"` object, the
`villagesSection` block currently reads:

```json
    "villagesSection": {
      "join": "Unirse a otro pueblo"
    },
```

Add a `managedEventsSection` block immediately after it:

```json
    "villagesSection": {
      "join": "Unirse a otro pueblo"
    },
    "managedEventsSection": {
      "title": "Eventos gestionados",
      "empty": "Aún no gestionas ningún evento",
      "ongoing": "En curso"
    },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "const m=require('./packages/i18n/messages/es.json'); console.log(m.profile.managedEventsSection.title, '|', m.profile.managedEventsSection.ongoing)"`
Expected: prints `Eventos gestionados | En curso`

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(mobile): add profile.managedEventsSection strings"
```

---

### Task 3: Badge overlay on `FeedCard` / `EventCard`

**Files:**
- Modify: `apps/mobile/components/feature/FeedCard.tsx`
- Modify: `apps/mobile/components/feature/EventCard.tsx`
- Test: `apps/mobile/components/feature/__tests__/EventCard.test.tsx` (append cases)

**Interfaces:**
- Produces: `FeedCardProps` and `EventCardProps` each gain `badge?: string | null`. When set, a pill with that text renders over the top-left of the image.

- [ ] **Step 1: Write the failing tests**

Append two cases to `apps/mobile/components/feature/__tests__/EventCard.test.tsx`, inside the existing `describe('<EventCard>', ...)` block:

```ts
  it('renders a badge when provided', () => {
    const { getByText } = render(
      <EventCard event={fixture} onPress={() => {}} badge="En curso" />,
    );
    expect(getByText('En curso')).toBeTruthy();
  });

  it('renders no badge when none is provided', () => {
    const { queryByText } = render(<EventCard event={fixture} onPress={() => {}} />);
    expect(queryByText('En curso')).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter cultuvilla-mobile test -- EventCard`
Expected: FAIL — badge text not found (and a TS error on the unknown `badge` prop).

- [ ] **Step 3: Add `badge` to `FeedCard`**

In `apps/mobile/components/feature/FeedCard.tsx`:

Add a badge color constant next to `PLACEHOLDER_BG` (line 17):

```ts
const PLACEHOLDER_BG = '#dcab93'; // palette.peach
const BADGE_BG = '#bb5d3a'; // palette.accent
```

Add `badge` to the props type (after `fallbackIcon` in `FeedCardProps`):

```ts
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  /** Optional pill shown over the top-left of the image (e.g. "En curso"). */
  badge?: string | null;
  onPress: () => void;
  testID?: string;
```

Destructure it in the function signature (after `fallbackIcon`):

```ts
  fallbackIcon,
  badge = null,
  onPress,
  testID,
```

Render the pill inside the image container, immediately after the scrim `View` closes (after line 95's `</View>` that ends the scrim, still inside the `aspectRatio` container `View`):

```tsx
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 9999,
                backgroundColor: BADGE_BG,
              }}
            >
              <Text variant="bodySm" style={{ color: '#ffffff' }} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ) : null}
```

- [ ] **Step 4: Thread `badge` through `EventCard`**

In `apps/mobile/components/feature/EventCard.tsx`, add `badge` to `EventCardProps`:

```ts
export type EventCardProps = {
  event: EventLike;
  onPress: (id: string) => void;
  badge?: string | null;
  testID?: string;
};
```

Destructure and forward it:

```tsx
export function EventCard({ event, onPress, badge, testID }: EventCardProps) {
  return (
    <FeedCard
      imageUri={event.imageURL ?? null}
      fallbackImageUri={event.municipalityCoverImage ?? null}
      title={event.title}
      metaLeft={event.organizationName}
      metaRight={formatDate(event.startDate, 'short')}
      fallbackIcon="calendar-outline"
      badge={badge}
      onPress={() => onPress(event.id)}
      testID={testID}
    />
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter cultuvilla-mobile test -- EventCard`
Expected: PASS (existing 2 + new 2 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/FeedCard.tsx apps/mobile/components/feature/EventCard.tsx apps/mobile/components/feature/__tests__/EventCard.test.tsx
git commit -m "feat(mobile): optional badge overlay on FeedCard/EventCard"
```

---

### Task 4: `ManagedEventsScroll` component

**Files:**
- Create: `apps/mobile/components/feature/profile/ManagedEventsScroll.tsx`
- Test: `apps/mobile/components/feature/profile/__tests__/ManagedEventsScroll.test.tsx`

**Interfaces:**
- Consumes: `EventCard` from `../EventCard`; `isEventOngoing` from `@cultuvilla/shared/models/event/EventDataModel`; `EventData` from `@cultuvilla/shared/models/event/EventDataModel`.
- Produces:

```ts
export type ManagedEvent = EventData & { id: string };

export interface ManagedEventsScrollProps {
  events: ManagedEvent[];
  now: Date;
  ongoingLabel: string;
  emptyLabel: string;
  onPressEvent: (id: string) => void;
}

export function ManagedEventsScroll(props: ManagedEventsScrollProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/feature/profile/__tests__/ManagedEventsScroll.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ManagedEventsScroll, type ManagedEvent } from '../ManagedEventsScroll';

const NOW = new Date('2026-06-15T19:00:00Z');

function makeEvent(over: Partial<ManagedEvent> & { id: string }): ManagedEvent {
  return {
    id: over.id,
    title: over.title ?? over.id,
    description: '',
    startDate: over.startDate ?? new Date('2026-07-01T18:00:00Z'),
    endDate: over.endDate ?? null,
    location: { type: 'text', coordinates: null, text: 'Plaza' },
    imageURL: null,
    maxAttendees: null,
    telephoneRequired: false,
    status: over.status ?? 'published',
    organizationId: 'org-1',
    organizationName: 'Org',
    createdBy: 'uid-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    municipalityId: 'm-1',
    municipalityName: 'Villa',
    municipalityCoverImage: null,
    municipalityCoordinates: null,
  } as ManagedEvent;
}

// A future (not-ongoing) event listed first, an ongoing one second.
const FUTURE = makeEvent({ id: 'future', title: 'Futuro', startDate: new Date('2026-07-01T18:00:00Z') });
const ONGOING = makeEvent({
  id: 'ongoing',
  title: 'En marcha',
  startDate: new Date('2026-06-15T18:00:00Z'),
  endDate: new Date('2026-06-15T22:00:00Z'),
});

describe('ManagedEventsScroll', () => {
  it('renders a card per event', () => {
    const { getByText } = render(
      <ManagedEventsScroll
        events={[FUTURE, ONGOING]}
        now={NOW}
        ongoingLabel="En curso"
        emptyLabel="Aún no gestionas ningún evento"
        onPressEvent={() => {}}
      />,
    );
    expect(getByText('Futuro')).toBeTruthy();
    expect(getByText('En marcha')).toBeTruthy();
  });

  it('badges the ongoing event with the ongoing label', () => {
    const { getByText } = render(
      <ManagedEventsScroll
        events={[FUTURE, ONGOING]}
        now={NOW}
        ongoingLabel="En curso"
        emptyLabel="vacío"
        onPressEvent={() => {}}
      />,
    );
    expect(getByText('En curso')).toBeTruthy();
  });

  it('hoists ongoing events before non-ongoing ones', () => {
    const { getAllByText } = render(
      <ManagedEventsScroll
        events={[FUTURE, ONGOING]}
        now={NOW}
        ongoingLabel="En curso"
        emptyLabel="vacío"
        onPressEvent={() => {}}
      />,
    );
    // Titles render in document order; the ongoing one must appear before the future one.
    const titles = getAllByText(/Futuro|En marcha/).map((n) => n.props.children);
    expect(titles.indexOf('En marcha')).toBeLessThan(titles.indexOf('Futuro'));
  });

  it('shows the empty label when there are no events', () => {
    const { getByText } = render(
      <ManagedEventsScroll
        events={[]}
        now={NOW}
        ongoingLabel="En curso"
        emptyLabel="Aún no gestionas ningún evento"
        onPressEvent={() => {}}
      />,
    );
    expect(getByText('Aún no gestionas ningún evento')).toBeTruthy();
  });

  it('calls onPressEvent with the id when a card is pressed', () => {
    const onPressEvent = jest.fn();
    const { getByText } = render(
      <ManagedEventsScroll
        events={[ONGOING]}
        now={NOW}
        ongoingLabel="En curso"
        emptyLabel="vacío"
        onPressEvent={onPressEvent}
      />,
    );
    fireEvent.press(getByText('En marcha'));
    expect(onPressEvent).toHaveBeenCalledWith('ongoing');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test -- ManagedEventsScroll`
Expected: FAIL — cannot find module `../ManagedEventsScroll`.

- [ ] **Step 3: Create the component**

Create `apps/mobile/components/feature/profile/ManagedEventsScroll.tsx`:

```tsx
import { FlatList, View } from 'react-native';
import { Text } from '../../primitives';
import { EventCard } from '../EventCard';
import {
  isEventOngoing,
  type EventData,
} from '@cultuvilla/shared/models/event/EventDataModel';

export type ManagedEvent = EventData & { id: string };

export interface ManagedEventsScrollProps {
  events: ManagedEvent[];
  now: Date;
  ongoingLabel: string;
  emptyLabel: string;
  onPressEvent: (id: string) => void;
}

export function ManagedEventsScroll({
  events,
  now,
  ongoingLabel,
  emptyLabel,
  onPressEvent,
}: ManagedEventsScrollProps) {
  if (events.length === 0) {
    return (
      <View className="px-4">
        <Text tone="muted">{emptyLabel}</Text>
      </View>
    );
  }

  // Ongoing first (soonest-started first), then the rest in their incoming
  // (createdAt-desc) order.
  const ongoing = events
    .filter((e) => isEventOngoing(e, now))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const rest = events.filter((e) => !isEventOngoing(e, now));
  const ordered = [...ongoing, ...rest];
  const ongoingIds = new Set(ongoing.map((e) => e.id));

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={ordered}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      renderItem={({ item }) => (
        <View style={{ width: 280 }}>
          <EventCard
            event={item}
            badge={ongoingIds.has(item.id) ? ongoingLabel : null}
            onPress={onPressEvent}
          />
        </View>
      )}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test -- ManagedEventsScroll`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/profile/ManagedEventsScroll.tsx apps/mobile/components/feature/profile/__tests__/ManagedEventsScroll.test.tsx
git commit -m "feat(mobile): ManagedEventsScroll for profile (ongoing-first, badged)"
```

---

### Task 5: Wire the section into the profile screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`

**Interfaces:**
- Consumes: `ManagedEventsScroll` / `ManagedEvent` from `../../components/feature/profile/ManagedEventsScroll`; `getEventsByCreator` from `@cultuvilla/shared/services/eventService`.

- [ ] **Step 1: Update the profile test (failing)**

In `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`:

Replace the existing `eventService` mock:

```tsx
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventCountByCreator: jest.fn().mockResolvedValue(0),
}));
```

with:

```tsx
jest.mock('@cultuvilla/shared/services/eventService', () => ({
  getEventsByCreator: jest.fn().mockResolvedValue([]),
}));
```

Add a component mock alongside the others (after the `VillagesScroll` mock):

```tsx
jest.mock('../../../components/feature/profile/ManagedEventsScroll', () => ({
  ManagedEventsScroll: () => null,
}));
```

Add a regression test at the end of the file:

```tsx
describe('ProfileScreen — eventos gestionados', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the events created by the user on mount', async () => {
    const personService = require('@cultuvilla/shared/services/personService');
    const eventService = require('@cultuvilla/shared/services/eventService');
    (personService.getPersonByUserId as jest.Mock).mockResolvedValue(null);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(eventService.getEventsByCreator).toHaveBeenCalledWith('uid-1');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile test -- profile.test`
Expected: FAIL — `getEventsByCreator` never called (and the old `getEventCountByCreator` mock is gone, so the screen's current call is now undefined).

- [ ] **Step 3: Update imports in `profile.tsx`**

In `apps/mobile/app/(tabs)/profile.tsx`, replace the event-count import:

```tsx
import { getEventCountByCreator } from '@cultuvilla/shared/services/eventService';
```

with:

```tsx
import { getEventsByCreator } from '@cultuvilla/shared/services/eventService';
```

And add, near the other component imports:

```tsx
import {
  ManagedEventsScroll,
  type ManagedEvent,
} from '../../components/feature/profile/ManagedEventsScroll';
```

- [ ] **Step 4: Add state and loading**

Add state next to the other hooks (after the `eventsCreated` state):

```tsx
  const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>([]);
```

In `load()`, the current block fetches a count:

```tsx
      const [count, regs] = await Promise.all([
        withFirestoreErrorLog('profile:getEventCountByCreator', () =>
          getEventCountByCreator(user.uid),
        ),
        withFirestoreErrorLog('profile:getUserRegistrationsAcrossEvents', () =>
          getUserRegistrationsAcrossEvents(user.uid),
        ),
      ]);
      setEventsCreated(count);
```

Replace it with a list fetch that also feeds the count:

```tsx
      const [mine, regs] = await Promise.all([
        withFirestoreErrorLog('profile:getEventsByCreator', () =>
          getEventsByCreator(user.uid),
        ),
        withFirestoreErrorLog('profile:getUserRegistrationsAcrossEvents', () =>
          getUserRegistrationsAcrossEvents(user.uid),
        ),
      ]);
      setManagedEvents(mine);
      setEventsCreated(mine.length);
```

- [ ] **Step 5: Render the section**

In the JSX, immediately after the Personas section block (the
`<ProfileSectionHeader title={t('profile.personasSection.title')} />` + its
`PersonaScroll`/loading branch), add:

```tsx
        <ProfileSectionHeader title={t('profile.managedEventsSection.title')} />
        <ManagedEventsScroll
          events={managedEvents}
          now={new Date()}
          ongoingLabel={t('profile.managedEventsSection.ongoing')}
          emptyLabel={t('profile.managedEventsSection.empty')}
          onPressEvent={(id) => router.push(`/event/${id}` as never)}
        />
```

- [ ] **Step 6: Run the profile test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile test -- profile.test`
Expected: PASS (existing change-photo test, the villages membership test, and the new events-load test).

- [ ] **Step 7: Typecheck the mobile app**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`
Expected: no errors. (`getEventCountByCreator` is no longer imported anywhere in this file; confirm no other reference to it remains in `profile.tsx`.)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/app/\(tabs\)/__tests__/profile.test.tsx
git commit -m "feat(mobile): eventos gestionados section on profile screen"
```

---

## Self-Review

**Spec coverage:**
- `isEventOngoing` helper + vitest → Task 1 ✓
- Badge support on FeedCard/EventCard → Task 3 ✓
- `ManagedEventsScroll` (ongoing-first partition, badge, empty state, tap) → Task 4 ✓
- Profile wiring (load events, render section after Personas, derive count from list) → Task 5 ✓
- i18n keys (title/empty/ongoing) → Task 2, consumed in Task 5 ✓
- Tap → `/event/{id}`; only ongoing badged → Tasks 4 + 5 ✓
- Tests: isEventOngoing (Task 1), ManagedEventsScroll (Task 4), profile load (Task 5) ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code.

**Type consistency:** `ManagedEvent = EventData & { id }` defined in Task 4, imported in Task 5. `isEventOngoing(event, now)` signature identical in Task 1 (definition) and Task 4 (use). `badge?: string | null` consistent across `FeedCardProps` (Task 3), `EventCardProps` (Task 3), and the `ManagedEventsScroll` call site (Task 4). `getEventsByCreator` returns `(EventData & { id })[]` (verified in eventService) — matches `ManagedEvent[]`. `EventCard`'s `EventLike` fields (`id`, `title`, `startDate`, `organizationName`, `imageURL`, `municipalityCoverImage`) are all present on `EventData`, so passing a `ManagedEvent` is assignable.
