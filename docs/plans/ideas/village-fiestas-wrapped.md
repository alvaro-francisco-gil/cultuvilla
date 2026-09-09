# Village fiestas windows + post-fiestas Wrapped

## Goal

Let a village declare **when its fiestas are** (more than one block per year), and use those windows to generate a shareable post-fiestas **Wrapped** — a village-level summary of what happened, with a personal cut layered on top.

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

**Compute.** A `buildVillageWrapped({ municipalityId, year, blockId })` callable does the per-event subcollection reads and persona dedup, then writes one cached doc per village + year + block. Clients read a single document. Admin-triggered while the metrics are being iterated on; an `onSchedule` job that fires after a block ends is a later and near-trivial addition — deliberately not in v1, because the metrics need to settle before they start publishing themselves. Past years replay for free.

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

Entry point is a `Section` or banner on the village home, appearing once a block has ended and its doc exists. Sharing reuses the existing `functions/src/og/` renderer for a share card.

## Migration & testing

`community.fiestas` is a new field behind a strict Zod converter, so it needs a **registered `pre-deploy` backfill** with `autoApply: ['dev','beta','prod']` (additive, idempotent — defaults to `[]` on every existing municipality). Without it the conformance gate blocks the promotion. `community` is nullable, so only municipalities with an active community are touched.

Tests:

- `resolveFiestaWindow` — anchor materialization, override precedence, and that `exactOnly` refuses an anchor-only block (vitest, `packages/shared/test/`).
- The whole aggregation as a **pure function over a committed Matabuena-derived fixture** — so the metrics are testable without an emulator, and the cancelled-event filter, persona dedup, and confirmed/waitlisted split each get a regression test with real numbers.
- Rules test: a non-admin member cannot write `community.fiestas`.
- Callable handler test under the emulator harness.

## Out of scope

- **Event data cleaning.** Investigated and dismissed — the apparent duplicates are cancelled-then-recreated events, correctly modelled. No cleanup needed; the Wrapped filters `cancelled`.
- **Weekday-based recurrence** (*"last weekend of August"*) — per-year overrides make it unnecessary. Revisit only if a village asks for accurate far-future dates.
- **Scheduled auto-publish** — added once the metrics stop changing.
- **Attendance metrics** — impossible until check-in is actually used.
- **Cross-village or all-time Wrapped** — one village, one year, one block.

## Open questions

- Does a Wrapped need village-admin **approval before members can see it**, or does it publish as soon as it is computed? Leaning publish-on-compute, since every figure is derived from data members can already see.
- Should a block with **zero events** produce a Wrapped at all, or stay silent? Leaning silent.
