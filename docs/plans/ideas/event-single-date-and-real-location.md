# Event: single date + real location

## Goal

Simplify the event model to a single `startDate` (drop `endDate`) and replace the
free-text/coordinates location union with a required, village-style coordinate + label.

## Context

Today an event carries two dates (`startDate` + nullable `endDate`) and a location
that is a discriminated union allowing *either* free text *or* coordinates
(`LocationDataModel.ts`: `{ type: 'coordinates' | 'text', coordinates, text }`).

The organizer found two dates confusing — most village events happen on a single day —
and wants the location to be a real place (pin on a map), not a typed string. The
village/municipality model already stores coordinates this way, so we reuse that shape.

## Design / approach

### Part 1 — Drop `endDate`, run events to end of their start day

Without an end date we still need to know when an event is "over". Decision:
**an event is ongoing from `startDate` until local midnight of its start day**, then
auto-completes. This gives a natural "happening today" window with no extra organizer input.

- **`packages/shared/src/models/event/EventDataModel.ts`**
  - Remove `endDate` from `EventDataSchema` and `EventDataInput`.
  - Add an `endOfDay(date): Date` helper (local midnight following `startDate`) and
    export it so the Cloud Function reuses the same rule.
  - Rewrite `isEventOngoing()`: ongoing ⇔ `status === 'published' && startDate <= now && now < endOfDay(startDate)`.
- **`functions/src/events/eventCompletion.ts`** — replace `endDate ?? startDate` with
  `endOfDay(startDate)` (import the shared helper). Event completes at midnight after start.
- **`packages/shared/src/models/event/EventFormSchema.ts`** — remove `endDate`.
- **`packages/shared/src/services/eventService.ts`** — remove `endDate` from create/update
  and its Timestamp conversion.
- **UI** — remove the end-date picker from the event form and the end-date display from
  the event detail screen and `EventCard`.

### Part 2 — Location becomes a required coordinate + label

Replace the union in **`packages/shared/src/models/core/LocationDataModel.ts`**:

```ts
export const LocationDataSchema = z.object({
  coordinates: LatLngSchema,   // { lat, lng } → GeoPoint via existing walker converter
  displayName: z.string(),     // e.g. "Plaza Mayor"
});
```

Coordinates stay **nested** under `coordinates` so the existing `{lat,lng}→GeoPoint`
walker converter (`firebase/converters/walkers.ts`) keeps working untouched. The free-text
variant and `LocationTypeSchema` are removed.

- **`EventFormSchema.ts`** — location is required; validate `coordinates` + non-empty `displayName`.
- **Event create form** — swap the text input for the existing `LocationPicker` component
  (the one used by village activation), **pre-filled with the event's village coordinates**.
  Organizer can drag the pin and edit the label.
- **Event detail screen** — render a map pin + label (and "get directions") instead of plain text.
- **i18n** — add/adjust message keys for the location picker label on the event form
  (per `i18n-add-string` conventions).

### Region (comunidad autónoma / provincia)

**Not stored on the event.** It is derivable from the event's village/municipality, which
already carries `comunidadAutonoma` + `province`. If cross-village regional feed filtering
becomes a real feature later, add it then via the denormalized-read-model pattern.

### Existing data — one-off dev backfill

Both changes are breaking schema changes; existing dev events have `endDate` and the old
location union. A one-off admin script (`firebase-admin-dev` pattern) will:
- delete `endDate` from every event doc;
- convert old locations: `type: 'coordinates'` events keep their pin (move into the new
  nested shape with `displayName` from any existing text, falling back to the village name);
  `type: 'text'` events get the village's coordinates as a fallback with the old text as `displayName`.

## Out of scope

- Storing region on the event (derive from village; revisit only if regional filtering ships).
- Recurring / multi-day events (single `startDate` is the explicit simplification).
- Registration windows (unchanged — gated by `published` status, not dates).

## Open questions

None — resolved during brainstorming:
- End semantics → end of start day.
- Location shape → nested `coordinates` + `displayName`.
- Region → inherit from village.
- Existing data → one-off dev backfill (not re-seed).
- Picker default → pre-fill village coordinates.
