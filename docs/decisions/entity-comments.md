# Generic entity comments (and the retired news-only backend)

## Context

A complete comments + reactions + reports backend existed for `news` only
(`newsComments` / `newsReactions` / `newsReports`), but was never wired into any
UI, and its read rules gated to village members — stricter than the entities it
attached to (all six entity docs are publicly readable). There was no real
comment data to migrate.

## Decision

- **Two generic top-level collections**, `comments` and `reactions`, each
  carrying `(entityKind, entityId, municipalityId)` rather than one collection
  per entity type. One `commentsService` in `@cultuvilla/shared` serves all six
  entities (event, festival-poster, place, barrio, organization, news).
- **One entityKind-routing Cloud Function trigger** denormalizes
  `commentCount` (and, at the time, `reactionCounts`) onto each entity doc,
  instead of one trigger per entity type.
- **Public read, authenticated create, owner/village-admin/app-admin delete**
  for comments — matching the public-read posture of the entities themselves,
  not the stricter village-member gate the old news-only backend had.
- **The news-only backend was deleted outright** (delete > deprecate) and
  folded into the generic system rather than kept alongside it.
- One shared `<EntityComments>` component drops into
  `EntityDetailScaffold` children on all six detail screens — no per-entity
  comment UI.

## What this binds

- A new entity kind that wants comments plugs into the existing
  `entityKind` routing rather than growing a parallel collection.
- Do not reintroduce entity-specific comment/reaction collections.

## Note

Reactions (like/heart) shipped with this feature were later removed entirely;
see [[entity-reactions-removed-read-count]] for that follow-up decision.
