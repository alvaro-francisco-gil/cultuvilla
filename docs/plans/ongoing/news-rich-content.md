# News rich content: stepper, block editor, mentions

**Goal:** Turn news authoring into a stepped, WordPress-like block editor — interleaved paragraphs and images, a dedicated card cover, and `@`-mentions of village entities (peñas/orgs, members, events, places).

## Status

- **Updated:** 2026-07-02
- **Stage:** all phases implemented; verified
- **Branch:** landed in the **main working tree** (see Handoff), not the `worktree-news-rich-content` worktree
- **Done:** Phases 0–3 complete. Model+rules+service, block renderer + feed cover, seed migration, stepper, block editor, `@`-mentions (autocomplete + RichText deep-links). Green: shared typecheck, i18n typecheck, app typecheck, no-raw-refs, web-compat, shared unit (461), rules e2e (188), mention unit (10), news screen test (2).
- **Next:** dev-deploy `firestore.rules` (firestore-deploy skill); optionally re-seed news (`DATASET=… pnpm seed:dev:news`) to populate `content`/`coverImage`; commit.
- **Blockers:** none from this feature. Two pre-existing failing suites in the inherited tree (`EventCard`, `ProposableListItem`) are unrelated — those files aren't touched by this feature; they trace to unrelated uncommitted WIP.
- **Handoff:** the code edits landed in the **main checkout** (`/home/powervaro/githubs/cultuvilla`), NOT the worktree, because files were edited via main-checkout absolute paths in a resumed session. The worktree holds only this plan doc. Decide: keep in main (recommended — the related event/location WIP already lives here and `VillageHomeBody.tsx` is shared) or extract to a branch.

## Phase progress

| Phase | Status |
|---|---|
| 0 — places collection | ✅ (pre-existing) |
| 1 — block model + read path | ✅ |
| 1 — seed migration | ✅ |
| 2 — stepper | ✅ |
| 2 — block editor | ✅ |
| 3 — mentions | ✅ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked

## Context

Today news is flat: `title` + `body: string` + a flat `images[]` array
([NewsPostDataModel.ts](../../../packages/shared/src/models/news/NewsPostDataModel.ts)).
The detail screen renders one hero image (the first) and dumps `body` into a
single `<Text>` ([news/[newsId].tsx](../../../apps/mobile/app/news/[newsId].tsx));
creation is one long scroll ([news/new.tsx](../../../apps/mobile/app/news/new.tsx)).
Events already use the shared `Stepper`
([Stepper.tsx](../../../apps/mobile/components/feature/Stepper.tsx)); adopting it
for news is the small part.

The reframing constraint: **React Native has no `contenteditable`.** A single
`TextInput` cannot host an image between two paragraphs, so the WordPress feel is
delivered as a **block editor** (the model the WordPress mobile/Gutenberg app
uses): the body becomes an ordered list of blocks, each a paragraph or an image.
That means the real change is replacing `body: string` with `content: Block[]`;
everything else follows.

## Design / approach

### Data model

```
// NewsPost gains:
coverImage: NewsPostImage | null      // dedicated card cover, picked in its own step
content: NewsBlock[]                   // ordered blocks; replaces body as the prose spine

NewsBlock =
  | { type: 'text';  text: string; mentions: Mention[] }
  | { type: 'image'; storagePath: string; width: number; height: number; caption?: string }

Mention = {
  entityType: 'organization' | 'user' | 'event' | 'place';
  entityId: string;
  label: string;          // snapshot of the display name at insert time
  offset: number;         // position within the block's text
  length: number;
}
```

`body: string` is **kept** as a deprecated fallback. On read, if `content` is
empty, synthesize a single text block from `body` so legacy posts and seed data
keep rendering. `coverImage` supersedes `images[0]` for the feed card; `images[]`
can be retired once content covers inline images.

### Mention targets

Decided (all four): **organizations (peñas/asociaciones/ayuntamiento)**,
**members/users**, **events**, and **places**. The first three exist today;
**places do not** — there is no place entity, only `LatLng` coordinates stamped
on events. Places require a new collection (Phase 0).

### UI

- **Stepper steps:** (1) Cover & basics — cover picker, title, category;
  (2) Content — the block editor, full height; (3) Attribution — organizers.
  Per-step `validate()` gates mirror the event stepper.
- **Block editor** (the hard, novel UI): a list of text blocks (multiline inputs)
  and image blocks (picker + optional caption + remove), an "+ Text / + Image"
  affordance between blocks, and reorder. RN drag-reorder is fiddly — **v1 uses
  up/down arrows**, drag deferred.
- **Mention affordance:** inside a text block, typing `@` opens an autocomplete
  querying municipality entities; a pick inserts a `Mention` token.
- **Renderers:** detail screen maps over `content` (text-with-mentions + inline
  images), replacing `<Text>{post.body}</Text>`; a `RichText` renderer turns
  mention spans into tappable links that deep-link to each entity. Legacy `body`
  fallback preserved.

### Phasing (dependency order)

- **Phase 0 — `places` collection (new foundation).** First-class top-level
  collection scoped by `municipalityId` (`name`, `type` = plaza/iglesia/ermita/
  bar/campo/monumento/…, `location`, optional `description`/`imageURL`), with
  service + rules + composite index + vitest + rules test + a minimal
  "manage places" village UI. Fully independent of news. Gates place-mentions.
  Follows the `add-firestore-collection` skill checklist. **Biggest chunk.**
- **Phase 1 — Block model + read path.** Add `content[]`/`coverImage`; write the
  detail-screen block renderer; keep the `body` fallback; migrate seed data. No
  editor yet.
- **Phase 2 — Stepper + block editor (write path).** Convert `news/new.tsx` to
  the `Stepper`; build the block editor (text/image blocks, up/down reorder,
  cover in step 1). Plain text — mentions deferred.
- **Phase 3 — Mentions.** `@` autocomplete over orgs/users/events/places; store
  `Mention` tokens; render tappable deep-links. Depends on Phase 0 + Phase 2.

## Open questions

- **Descope places for a first cut?** Phases 1→2→3-without-places ship the
  stepper + rich body + mentions (orgs/users/events) sooner; Phase 0 + place
  mentions slot in after. `Mention.entityType` is built to take a new value
  without rework. Undecided.
- **Mention storage:** offset/length (clean, fragile to edits) vs. inline
  sentinel tokens in the text with a parallel array (robust in an editor). Lean
  token-based; finalize in Phase 3.
- **`images[]` retirement:** drop it once `content` inline images land, or keep
  for back-compat indefinitely?
- **Place `type` enum** — exact set of place categories to support.
- **Reorder UX** — up/down arrows for v1; is drag wanted later?
