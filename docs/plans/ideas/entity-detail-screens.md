# Entity detail screens — shared vocabulary + ordago-style header

## Goal

Formalize **"entity"** as the umbrella term for village things shown in horizontal scrolls with a detail screen, and redesign all six entity detail screens to share one layout: a solid static top bar (back + action icons) above a full-bleed flyer, replacing the translucent buttons that currently float over the image.

## Context

The village overview already shares its *display* layer well: every horizontal scroll goes through one [`Section`](../../../apps/mobile/components/feature/VillageSections.tsx) component, and every card is one `BigCard` (`PersonCard` / `EntityCard` are thin adapters). Detail screens also already share `DetailHeroImage` + a family of `Floating*` buttons.

What's missing:

1. **No name for the concept.** The code already leans on "entity" (`EntityCard`, `useEntityCapabilities`) but never formalizes what an entity *is*.
2. **The header treatment isn't what we want.** Today, four translucent circular discs (`FloatingBackButton` / `FloatingShareButton` / `FloatingEditButton` / `FloatingManageButton`) float over the flyer. We want ordago's `TournamentDetails` treatment instead: a **solid static top bar** carrying back + the action buttons, with the flyer immediately below it.

Reference: `ordago-apps/apps/ordago-app/screens/tournaments/home-view/TournamentDetails.js` (its `ScreenHeader` + `rightComponents` pattern).

## Definition — what an "entity" is

An **entity (entidad)** is a village-scoped domain object that (a) appears in a horizontal `Section` scroll as a `BigCard`, and (b) opens a hero-image detail screen. The family:

| Entity | Detail route | Service |
|---|---|---|
| event | `event/[eventId]` | eventService |
| festival-poster (cartel) | `village/[villageId]/festival-poster/[posterId]` | festivalPosterService |
| place (lugar) | `village/[villageId]/place/[placeId]` | municipalityService |
| barrio | `village/[villageId]/barrio/[barrioId]` | municipalityService |
| organization (peña / asociación / ayuntamiento) | `o/[orgId]` | organizationService |
| news | `news/[newsId]` | newsService |

**Not entities:** `person` and `village`. Both open into forms rather than hero-detail screens (`person/[personId]` already uses `ScreenHeader`); they keep their current chrome.

The term is formalized in a comment/doc only — **no renames**, since "entity" is already the incumbent.

## Design / approach

### Target layout (all six screens)

```
┌───────────────────────┐
│ ‹        [share][edit] │  EntityDetailHeader — solid static bar, neutral surface
├───────────────────────┤
│       FLYER            │  DetailHeroImage — full width, natural aspect ratio
│                        │
├───────────────────────┤
│ Título grande          │
│ [ info cards, if any ] │  optional DetailInfoCard row
│ Descripción…           │  DetailSection (title + separator), opportunistic
│ [ related scrolls ]    │
└───────────────────────┘
            [ FAB ]         optional (register / join)
```

Decisions taken during brainstorming:

- **Bar behavior:** static — a solid bar pinned to the top at all times; the flyer starts just below it. No scroll-driven animation (avoids the RN-Web `Animated` + `className` gotcha).
- **Bar color:** neutral surface (cream `bg-surface`), dark icons, thin bottom border — closest to ordago and keeps the flyer as the visual hero. Status bar → `dark`.
- **Buttons move off the flyer into the bar.** The four `Floating*` components are deleted (per *Delete > deprecate*).

### Components

- **`EntityDetailHeader`** (new, `components/feature/`) — thin wrapper over the existing [`ScreenHeader`](../../../apps/mobile/components/layout/ScreenHeader.tsx) that renders a `rightSlot` of small `HeaderIconButton`s (share / edit / manage), each shown per capability. Owns the safe-area top inset.
- **`HeaderIconButton`** (new, `components/feature/` or `primitives/`) — a bar-sized icon button (Ionicon + accessibility label), the neutral-bar analogue of the old floating disc.
- **`DetailHeroImage`** — keep, but drop its baked-in `FloatingBackButton` (the bar owns back now); remove the `showBack`/`onBack` props once no caller needs them.
- **`DetailInfoCard`** (new) — event's currently-private `InfoCard` promoted to a shared component (icon + label + value + tap-out action).
- **`DetailSection`** (new, optional) — ordago-style titled section (title + thin separator + content), for opportunistic use where a screen has multiple content blocks.
- **`EntityDetailScaffold`** (new) — composes `Screen` + `EntityDetailHeader` + `ScrollView` + `DetailHeroImage` + title + `{children}` + an optional bottom FAB slot. Each of the six screens becomes thin and structurally identical; loading / not-found states render the header (back only) + a centered spinner / not-found text.

### Migration

All six screens move onto `EntityDetailScaffold`. Body content (info cards, related-person scrolls, news renderer, join/register FAB) stays per-screen but flows through the scaffold's slots and uses the shared `DetailInfoCard` / `DetailSection`. Adding info cards where a screen has none today (e.g. org member count) is **opportunistic, not forced**.

Once all six are migrated, delete `FloatingBackButton`, `FloatingShareButton`, `FloatingEditButton`, `FloatingManageButton`.

### Web/testing notes

- FAB and any absolutely-positioned chrome keep styles on `style`, not `className` (RN-Web gotcha; already the pattern in `o/[orgId]/index.tsx`).
- Respect `insets.bottom` for the FAB (safe-area rule).
- Existing detail-screen tests (`event`, `place`, `barrio` `__tests__`) must keep passing; update selectors that assumed floating buttons.

## Open questions

- **`DetailInfoCard` / `DetailSection` scope:** do we retrofit info cards onto place/barrio/org/news now, or only ship the scaffold + header and leave body content as-is (opportunistic)? Leaning opportunistic to keep the change focused.
- **`EntityDetailScaffold` granularity:** news uses `NewsContentRenderer` and a category/date row rather than a plain description — confirm the scaffold's body slot is flexible enough (it is, via `{children}`) and we don't over-fit the scaffold to the event shape.
