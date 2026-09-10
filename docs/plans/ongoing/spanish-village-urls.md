# Spanish, village-first URLs

**Goal:** every public URL is Spanish and carries the pueblo's name —
`cultuvilla.es/matabuena`, `cultuvilla.es/matabuena/evento/fiestas-de-san-roque_<id>`.
Readable in a WhatsApp preview, printable on a bando, and a (small) search signal.

## Status

- **Updated:** 2026-09-11
- **Stage:** implementing
- **Branch:** `feat/spanish-village-urls` (worktree `.claude/worktrees/spanish-urls`)
- **Decided (user, 2026-09-11):** village slug at the root, `/entidad/` for orgs,
  orgs nested under their home village, **no back-compat** for old URLs or
  installed native binaries (no public release yet).

## Shape

| Resource | Path |
|---|---|
| Pueblo | `/<pueblo>` |
| Evento | `/<pueblo>/evento/<titulo>_<id>` |
| Plaza (seat claim) | `/<pueblo>/evento/<titulo>_<id>/plaza/<token>` |
| Noticia | `/<pueblo>/noticia/<titulo>_<id>` |
| Entidad (org) | `/<pueblo>/entidad/<nombre>_<id>` (+ `/unirse`, `/editar`) |
| Lugar | `/<pueblo>/lugar/<nombre>_<id>` (+ `/editar`) |
| Barrio | `/<pueblo>/barrio/<nombre>_<id>` (+ `/editar`) |
| Cartel | `/<pueblo>/cartel/<titulo>_<id>` (+ `/editar`) |
| Palabra | `/<pueblo>/palabra/<slug>` (term id = `<municipalityId>__<slug>`) |
| Village lists | `/<pueblo>/{lugares,barrios,carteles,entidades,miembros,vocabulario,censo,comunidad,editar}`, `/<pueblo>/palabra/nueva` |

Top-level static routes (all reserved as pueblo slugs): `perfil`, `mi-pueblo`,
`entrar`, `completar-perfil`, `admin`, `descarga`, `descubrir`, `crear`
(`/crear/evento`, `/crear/noticia`), `buzon`, `legal`, `mis-inscripciones`,
`mis-pueblos`, `persona`, `ajustes`, `usuario`.

### Why `<titulo>_<id>`

The id is authoritative; the title part is decoration and may go stale when a
title is edited. Slugs only contain `[a-z0-9-]`, and ids may contain `-` (seed
ids do) — so `_` is the one separator that always splits unambiguously: the
**first** `_` ends the slug. Everything after it is the id.

### Why the slug is denormalized

A card has to build its href synchronously. Events, news, organizations and
festival posters carry `villageSlug`, set by their builders at creation and
never changed (slugs are permanent, like permalinks — a municipality rename does
not move its URL). Places and barrios live under `municipalities/{id}/…`, so
the village is always in hand where they are linked.

### Municipality slug

`slug` on every municipality, assigned once over the whole INE dataset
(8,167 names, 20 shared by 41 municipalities, never within one province):
`slugify(name)`, or `slugify(name)-slugify(province)` when the name is shared or
reserved. Assigned slugs never change; a new municipality takes a free one.

## Checklist

- [ ] shared: `slugify`, `assignMunicipalitySlugs`, reserved segments, path builders + `parseEntityRef`
- [ ] shared: `slug` on municipality; `villageSlug` on event/news/org/poster; builders + services
- [ ] shared: `deepLinkService` rebuilt on the new paths; `getMunicipalityBySlug`
- [ ] functions: ogRenderer patterns + 301 to canonical; sitemap; robots; emails; requestAyuntamiento
- [ ] firebase.json rewrites; AASA + intent filters
- [ ] rules: `villageSlug` in key allowlists
- [ ] backfills: `municipality-slug`, `village-slug-denorm` (dependsOn)
- [ ] seeds: municipalities + demo datasets
- [ ] mobile: move route files; `VillageRouteGate`; replace every hardcoded path
- [ ] tests; e2e (Playwright + Maestro) paths
- [ ] docs: deeplink decision, services map, denorm doc, CHANGELOG
