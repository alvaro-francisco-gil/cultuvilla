# Village fiestas windows + post-fiestas Wrapped

## Goal

Let a village declare **when its fiestas are** (more than one block per year), and use those windows to generate a shareable post-fiestas **Wrapped** — a village-level summary of what happened, with a personal cut layered on top. Once a block ends, its Wrapped is computed and offered to the village admins, and publishes itself after a grace period if they don't act.

## Context

Cultuvilla knows a great deal about what happened during a village's fiestas and currently says none of it back. Matabuena's 2026 season (prod, read-only survey) is the worked example this spec is calibrated against:

| Block | Dates | Live events | Sign-ups | Comments |
|---|---|---|---|---|
| Santiago | Jul 24–26 | 6 | 18 | 9 |
| Fiestas de agosto | Aug 14–28 | 14 (3 cancelled) | 240 | 6 |
| **2026 total** | — | **21** (4 cancelled) | **258** | **15** |

Village context: 173 members, 272 people in the censo, 73 carteles, 48 comments, 3 news posts.

Two things make this the right shape:

1. **The season is genuinely disjoint.** Santiago (fixed saint's day, late July) and the fiestas de agosto are separate blocks with ordinary weeks between them. A single range cannot describe the year. One event (a taller on Jul 18) falls outside both — the windows have to actually exclude things, which is what makes them meaningful rather than decorative.
2. **`docs/decisions/carteles-de-fiestas.md` predicted this.** Its *Revisit when* names "fiestas legitimately span multiple disjoint blocks" as the trigger to revisit the single-range poster model. This is that trigger arriving. The fiestas window is nonetheless **new data, not a promotion of the cartel's dates** — 73 posters are mostly `datePrecision: 'year'`, so their dates are absent or unreliable, and "we have a poster for 2019" is a different claim from "the fiestas ran Aug 23–28".

### Findings that constrain the design

These came out of surveying prod and are load-bearing — they are the reason several choices below are not the obvious ones.

- **There is no duplicate-event problem.** Three Matabuena events looked duplicated (a full one and a near-empty twin). Every twin is `status: 'cancelled'` — the organizer created them on Aug 12, cancelled them, and recreated them on Aug 16. So the correct event count is 21, not 25, and the fix is a `status !== 'cancelled'` filter, not a data cleanup. `EventStatus` is `published | cancelled | completed`.
- **`checkedInAt` is null everywhere.** Zero check-ins across the two largest events (105 registrations combined). The Wrapped therefore describes **sign-ups**, and every string must say *apuntados* — never *asistieron*. This is a copy constraint, not a preference.
- **Registrations need dedup, and the unit matters.** Those same two events hold 105 registrations covering **71 unique personas** across **46 unique accounts** — families sign up several personas each. Summing `confirmedCount` inflates "how many people took part" by ~50%. The Wrapped counts **unique personas** (`personId`), since a persona is a person who did something; accounts are a household, not a participant.
- **`registrations` cannot be read as a collection group for one village.** Registration docs carry no `municipalityId`, so the aggregation must read each in-window event's subcollection — ~14–21 reads per village-year. Fine for a callable, wrong for a client.
- **`status: 'waitlisted'` is real signal.** 9 of those 105 registrations were waitlisted. "Se quedaron X en lista de espera" is a genuine popularity metric, and it means every count must state confirmed vs waitlisted explicitly rather than saying "sign-ups".
- **`members.joinedAt` exists**, so "people who joined the village during the fiestas" is computable.

## Design

Three phases, shippable in order. Phase 1 is tooling that makes Phases 2–3 verifiable against real data.

### Phase 1 — prod → local mirror harness

`scripts/mirror-prod-village.mjs --municipality=<id|name> [--anonymize]`

Reads one municipality's data from prod **read-only** and writes it into the local Firestore emulator: the municipality doc, `members`, `events` + each event's `registrations` / `registrationPrivate`, `festivalPosters`, `news`, `comments`, `municipalityPeople`. The app then runs against emulators as usual.

Deliberately general, not Wrapped-specific — it is the missing piece of local tooling for any feature that needs realistic shapes and distributions. Not a registered backfill (it writes to the emulator, never to a real env), so it stays off the backfill harness.

`--anonymize` scrambles display names, emails and photo URLs on the way in, preserving counts and distributions. **Default off**, per the decision on 2026-09-09. The tradeoff accepted with that default: 272 real residents' names land in a local emulator and in any screenshot taken from it. The flag exists so the safer mode is one word away.

### Phase 2 — fiestas windows on the village

A `fiestas` array on the `community` overlay inside `municipalities/{id}`:

```ts
FiestaBlock = {
  id: string,                                        // stable; survives renames
  name: string,                                      // "Santiago", "Fiestas de agosto"
  anchor: { month: 1..12, day: 1..31, days: number }, // recurring approximation
  years: Record<number, { start: Date, end: Date }>,  // exact, authoritative
}
```

**The anchor and the overrides are not two ways to say the same thing, and this split is the crux of the design.** They answer different questions and have different accuracy requirements:

- The **anchor** answers *"when are the fiestas, roughly?"* ahead of time, for any year, with no admin action. It is exact for fixed saints' days (Santiago is always Jul 25) and approximate for movable blocks (Matabuena's August fiestas track a weekend, so a fixed month/day drifts by up to a few days).
- The **per-year override** is the authoritative window for a year that has happened or been scheduled.

So: **the Wrapped refuses to compute from an anchor.** It requires `years[year]`, and if the block has none it prompts the admin to confirm the dates first. That single rule makes the anchor's approximation harmless — an approximate window can never silently clip or over-include events in a published summary. It also removes any need for weekday-based recurrence rules (*"last weekend of August"*), which would be the natural next request and is real complexity for no gain once overrides exist.

One helper, `resolveFiestaWindow(block, year, { exactOnly })`, is the only way anything reads a window. Consumers: the Wrapped (`exactOnly: true`), a future "próximas fiestas" surface, and event-form date hints.

Stored on the overlay rather than in a top-level collection: a handful of rows per village, already loaded on every village-home read, never queried across villages. A collection would buy indexes nobody needs.

Written by village admins from the existing village-edit surface; `firestore.rules` gates `community.fiestas` exactly as it gates the rest of `community`.

### Phase 3 — the Wrapped

**Compute.** A `buildVillageWrapped({ municipalityId, year, blockId })` callable does the per-event subcollection reads and persona dedup, then writes one cached doc per village + year + block, id `{municipalityId}_{year}_{blockId}`. That deterministic id is what makes the whole lifecycle below idempotent — a rerun overwrites rather than duplicating. Clients read a single document. Past years replay for free.

**Publication lifecycle — notify first, publish anyway.** The Wrapped is not admin-triggered and not silently automatic; it is *offered* to the village admins and then publishes itself if nobody acts. Decided 2026-09-09.

```
block window ends (exact per-year end, Europe/Madrid)
        v
  compute -> status: 'draft', autoPublishAt = now + GRACE
        v
  notify village admins ("tu pueblo tiene un Wrapped listo")
        v
  admin publishes ---> 'published'
  admin discards  ---> 'discarded'  (terminal; scheduler skips it forever)
  admin does nothing for GRACE days ---> 'published' automatically
```

Three things make this work as specified:

- **Only villages with declared fiestas windows participate.** The scheduler's candidate query is villages whose `community.fiestas` block has an exact `years[year]` window that has just ended. A village that never declared its dates is never computed, never notified, and never auto-publishes — which is precisely the intended gate, and it also gives Phase 2 a reason to exist beyond the Wrapped.
- **`autoPublishAt` is a stored timestamp, not elapsed-time arithmetic.** The scheduler's second query is `status == 'draft' AND autoPublishAt <= now`, which is indexable, testable by writing a past timestamp, and immune to a missed run — a scheduler outage delays publication rather than skipping it. `GRACE` is a named constant, proposed at **3 days**.
- **The block boundary is Europe/Madrid, not UTC.** A block ending Aug 28 ends at 23:59:59 local; a naive UTC boundary fires the job while the last night of the fiestas is still going on.

**Why auto-publish is safe here, and where it isn't.** Every figure is derived from data members can already see, so publishing without review leaks nothing. The real risk is not privacy but *tone* — auto-publishing a thin Wrapped (one event, two sign-ups) makes the village look dead on its own noticeboard. So auto-publish carries a **quality floor**: below a threshold (proposed: fewer than 3 live events, or zero sign-ups) the doc is computed and the admin is still notified, but it will **never publish on the timer** — only an explicit admin publish releases it. This is also the answer to "should a zero-event block produce a Wrapped at all": it produces a draft nobody sees unless an admin decides it is worth showing.

An admin's review screen offers exactly two actions, publish and discard. It is not an editor — the numbers are the numbers, and a Wrapped an admin could rewrite would not be worth reading.

**Notifications.** A new `NotificationType` enum member, delivered to every `role: 'admin'` member of the village via `users/{uid}/notifications/`. It carries `municipalityId` and leaves `entityKind`/`entityId` null, consistent with a Wrapped not being an `EntityKind`. Widening the enum is additive — existing notification docs keep parsing.

**Village cards** (all figures below are the real Matabuena 2026 August block):

- the block, its name and its dates
- 14 events held
- 240 confirmed sign-ups, and the unique-persona count behind them
- fullest event — *Taller infantil de pintar bolsas de tela*, 60/60
- most-commented event — *Torneo de Brisca*
- people left on the waitlist, as a demand signal
- new members who joined during the window (`joinedAt` in range)
- that year's carteles as the visual spine

`readCount` is **excluded from the headline.** 382 views on a taller is a view counter, not a person; printing it beside "60 apuntados" invites it to be read as reach. It may appear as an explicitly-labelled "veces visto" card, never as a participation number.

**Personal cards**, layered second: the events you and your personas signed up to, how many, your first fiesta if `joinedAt` falls in the window, comments you left. Gated by a floor — under ~2 sign-ups it falls through to the village Wrapped rather than rendering a hollow personal one. With ~46 participating accounts against 173 members, the empty case is the common case, so the fallback is the main path, not an edge case.

**Presentation.** A new route `apps/mobile/app/village/[villageId]/wrapped/[year].tsx` — swipeable full-screen cards. Not an `EntityDetailScaffold` consumer: a Wrapped is not an entity (no hero image + title + body, no comments, no moderation). Two web-compat constraints, both already paid for elsewhere in this repo:

- **No RN `Modal`** — an absolute-positioned overlay, following the carteles full-screen viewer.
- Card transitions put styles on `style`, not `className`; NativeWind drops `className` on `Animated.View`.

Entry point is a `Section` or banner on the village home, appearing once the doc reaches `published`. A `draft` is visible only to village admins, via the notification and their review screen. Sharing reuses the existing `functions/src/og/` renderer for a share card.

## Migration & testing

The Wrapped doc is a **new collection** — follow the `add-firestore-collection` checklist (model, service, index re-export, services map, rules, composite index, tests). It needs one composite index for the scheduler's `status` + `autoPublishAt` query, declared in the same change. `community.fiestas` is a new field behind a strict Zod converter, so it needs a **registered `pre-deploy` backfill** with `autoApply: ['dev','beta','prod']` (additive, idempotent — defaults to `[]` on every existing municipality). Without it the conformance gate blocks the promotion. `community` is nullable, so only municipalities with an active community are touched.

Tests:

- `resolveFiestaWindow` — anchor materialization, override precedence, and that `exactOnly` refuses an anchor-only block (vitest, `packages/shared/test/`).
- The whole aggregation as a **pure function over a committed Matabuena-derived fixture** — so the metrics are testable without an emulator, and the cancelled-event filter, persona dedup, and confirmed/waitlisted split each get a regression test with real numbers.
- Rules test: a non-admin member cannot write `community.fiestas`, and a non-admin cannot read a `draft` Wrapped or write `status`.
- Callable handler test under the emulator harness.
- **The publication lifecycle, which is where the bugs will be.** Each transition gets a test: a block with no exact `years[year]` window is never picked up; a `draft` past `autoPublishAt` publishes; one below the quality floor does *not* publish on the timer, however long it waits; a `discarded` doc is never resurrected by a later run; and a rerun over an existing doc overwrites in place rather than duplicating. All drivable by writing `autoPublishAt` in the past — no clock manipulation and no waiting.

## Out of scope

- **Event data cleaning.** Investigated and dismissed — the apparent duplicates are cancelled-then-recreated events, correctly modelled. No cleanup needed; the Wrapped filters `cancelled`.
- **A Wrapped editor.** Admins publish or discard; they never edit the figures.
- **Weekday-based recurrence** (*"last weekend of August"*) — per-year overrides make it unnecessary. Revisit only if a village asks for accurate far-future dates.
- **Attendance metrics** — impossible until check-in is actually used.
- **Cross-village or all-time Wrapped** — one village, one year, one block.

## Open questions

None blocking. Two values want a look during implementation rather than now: the `GRACE` period (proposed 3 days) and the quality floor (proposed: 3 live events and at least one sign-up).
