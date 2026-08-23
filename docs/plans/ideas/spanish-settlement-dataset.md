# Completar el nomenclátor de pueblos españoles — Idea Exploration

> **Status:** Pre-spec exploration, derived from a user bug report (2026-08-23):
> a resident of Villarino de Manzanas could not find their village. PRs #259 and
> #260 fixed the *search*; this plan is about the *data* those PRs search, and
> about the modelling question #260 deliberately left open. Not yet a formal
> design — the open questions at the bottom must be answered before this moves
> to `ready/`.

---

## Goal

Every inhabited place in Spain that a person would call "mi pueblo" should be
findable in Cultuvilla, and should resolve to something the product can actually
do — join, follow, post to. Today only the 8,167 INE *municipios* are
first-class, and Wikidata's coverage of everything below them is partial and
worst exactly where it matters most.

## Context — what already shipped

[#259](https://github.com/alvaro-francisco-gil/cultuvilla/pull/259) made
`municipalities.searchPrefixes` a per-word prefix index (plus co-official-name
aliases). [#260](https://github.com/alvaro-francisco-gil/cultuvilla/pull/260)
folded `localityNames` — the *entidades singulares* inside each municipality —
into that same index, so searching a pedanía returns its municipio, labelled
"Incluye Villarino de Manzanas".

Both were built on the premise that **a locality is an alias, not an entity**:
you cannot join a pedanía, post to one, or administer one, so it exists only to
lead you to its municipio. That premise is what this plan should re-examine.

## The coverage problem

`scripts/fetch-localities.mjs` sources localities from Wikidata. Result:
**2,728 of 8,167 municipalities carry at least one locality; 10,537 localities
total.**

INE's Nomenclátor lists on the order of 35,000 *entidades singulares* (and
~61,000 *unidades poblacionales* once núcleos and diseminados are counted), so
we hold roughly a third of the level we care about. **Both figures are from
memory and unverified** — nobody has managed to download the authoritative file
yet, which is itself the point of this plan. Confirming the real denominator is
step one, because "we have 30%" and "we have 17%" argue for different answers.

Worse, the gaps are not random. Coverage by province, worst first:

| Provincia | Municipios | Con localidades | Localidades | Cobertura |
|---|---:|---:|---:|---:|
| Lugo | 67 | 2 | 2 | 3% |
| A Coruña | 95 | 4 | 5 | 4% |
| Pontevedra | 62 | 3 | 3 | 5% |
| Ourense | 93 | 5 | 9 | 5% |
| Sevilla | 106 | 6 | 8 | 6% |
| Málaga | 103 | 6 | 7 | 6% |
| Valencia | 267 | 22 | 40 | 8% |
| … | | | | |
| Islas Baleares | 67 | 55 | 287 | 82% |
| Asturias | 78 | 69 | 779 | 88% |
| Girona | 221 | 196 | 974 | 89% |

**Galicia is the headline failure.** It has by far the densest settlement
structure in Spain — tens of thousands of *lugares* grouped into *parroquias* —
and it is the region where "mi pueblo" is least likely to be a municipio. It is
covered at 3–5%. A Galician user is almost guaranteed to hit the empty state.

The Wikidata query is not obviously wrong; Galician *lugares* are simply thin on
Wikidata, and many are typed as `parroquia` rather than as an
`entidad singular de población` subclass. Widening the class list is worth a
pass, but it will not close a 6× gap on its own.

## Why the authoritative sources were not used (yet)

Attempted on 2026-08-23, both dead ends for an automated fetch:

- **IGN NGMEP** (Nomenclátor Geográfico de Municipios y Entidades de Población)
  — the historic direct archive
  (`centrodedescargas.cnig.es/CentroDescargas/equipamiento/BD_Municipios-Entidades.zip`)
  returns 404, and the Centro de Descargas is a JS session portal. Distribution
  formats are `.mdb` / `.odb`.
- **INE Nomenclátor** — `ine.es/nomen2/` is an undocumented JSP form; a scripted
  POST to `tabla.do` returns the page shell, not results. No CSV/bulk endpoint
  found under `daco42`.

The reason this mattered: a dataset that can only be fetched by hand gets
committed once and then **rots silently**, with no test that can detect it. That
is why Wikidata won on "cleanest long term" despite losing on completeness —
`fetch-localities.mjs` re-runs on demand and improves.

**This plan's job is to find a source that is both complete and re-fetchable**,
or to decide deliberately that a hand-fetched snapshot is acceptable *provided*
it carries a freshness marker and a staleness test.

## The modelling question: pedanía vs. barrio

**They are not the same thing, and the codebase currently has no place for the
difference.** This is the substantive design question in this plan.

In Spanish administrative reality:

| Nivel | Qué es | ¿En Cultuvilla? |
|---|---|---|
| **Municipio** | Unidad con ayuntamiento. 8.131 en España. | ✅ `municipalities/` — first-class |
| **Entidad colectiva** | Agrupación intermedia (*parroquia* en Galicia y Asturias) | ❌ no existe |
| **Entidad singular** | Núcleo habitado con nombre propio y separado — *pedanía*, *aldea*, *lugar*, *anejo* | ⚠️ sólo como alias de búsqueda (`localityNames`) |
| **Núcleo / diseminado** | Subdivisión de una entidad singular (compacto vs. disperso) | ❌ no existe |
| **Entidad local menor / EATIM** | Entidad singular **con gobierno propio** (junta vecinal, alcalde pedáneo) | ❌ no existe |
| **Barrio** | Vecindario *dentro* de un núcleo. No es un nivel INE. | ✅ `municipalities/{id}/barrios/` — first-class entity |

So, precisely:

- A **pedanía** is a *separate settlement*, often kilometres from the municipal
  seat, with its own name, its own fiestas, frequently its own junta vecinal.
  Villarino de Manzanas is one, ~10 km from Figueruela de Arriba.
- A **barrio** is a *neighbourhood within* a settlement.

**The current model conflates them by omission.** `barrio` is the only
subdivision a village has: it is user-created (`proposedBy`), it is an entity
with a hero screen, comments and `readCount`, and it is what a person's
residence points at (`persons.municipalityLinks` → `syncBarrioResidentCount`).
So a village whose municipio contains pedanías has nowhere else to put them —
the natural move is to create one barrio per pedanía, which then means "barrio"
means two different things in two different villages.

That conflation is tolerable today because barrios are hand-created and few —
dev holds 8 — but it is **already happening**: one of those 8 is *Villares de
Matabuena*, an anejo several km outside Matabuena, not a neighbourhood of it
(see open question 5). It stops being tolerable the moment we import a real
nomenclátor: tens of thousands of entidades singulares poured into a collection
whose semantics are "neighbourhood" would be a mess to unwind.

### Three candidate shapes

1. **Keep localities as pure search aliases** (status quo after #260). Cheapest,
   already shipped. A pedanía is findable but has no page, no members, no
   fiestas. Fails the Galician user, for whom the pedanía *is* the community.
2. **Promote entidad singular to a first-class entity**, sibling to barrio,
   living at `municipalities/{id}/localities/{id}` or top-level with
   `municipalityId`. Seeded read-only from the nomenclátor, then adoptable by
   residents. Barrios keep their current meaning (neighbourhood-within).
   Honest to reality; the most work.
3. **Redefine `barrio` as "subdivisión del municipio"** and let it cover both,
   with a `kind` discriminator (`pedania | barrio | parroquia`). Reuses the
   entity, the screens, the residence link and `residentCount` wholesale. Cheaper
   than (2), but rewrites the meaning of an existing user-visible word and needs
   a migration of existing barrios.

Option (3) is the current front-runner on effort-vs-honesty, but it hinges on
whether a pedanía should be able to hold things a barrio cannot — its own
events, its own admins, its own censo. If yes, (2) is the real answer.

### Galicia forces the *parroquia* question

Galicia's hierarchy is municipio → **parroquia** → lugar. A Galician saying "soy
de Baio" may mean a parroquia, not a municipio or a lugar. Whatever shape wins,
it has to answer whether `entidad colectiva` is a level we model, flatten, or
ignore — and Galicia is precisely where coverage is worst, so this is not a tail
case.

## Open questions

1. **Is there a complete, re-fetchable source?** Candidates not yet exhausted:
   the IGN's WFS/ATOM services and its `Nomenclátor Geográfico Básico` (NGBE),
   `datos.gob.es` distributions, regional open-data portals (Galicia's
   [abertos](https://abertos.xunta.gal) is the highest-value single target),
   OpenStreetMap `place=village|hamlet` with `addr:*` relations, and widening
   the Wikidata class list to include `parroquia`.
2. **Can a hand-fetched snapshot be made safe?** If the only complete source is
   a manual `.mdb` download, does a committed `fetchedAt` + a test that fails
   when the file is older than N months make it acceptable?
3. **Pedanía: alias, sibling entity, or barrio with a `kind`?** (the three
   shapes above) — this is the load-bearing decision.
4. **Do we model *parroquia* / entidad colectiva at all?**
5. **What happens to the existing hand-created barrios** under option (3)?
   ~~Are they all genuinely neighbourhoods?~~ **No — already answered, and the
   answer is the argument for this plan.** Dev holds 8 barrios: *Casco
   Histórico*, *El Foso*, *Plaza Mayor*, *El Arrabal*, *Nuevo Aranjuez* and *El
   Pueblo* are genuine neighbourhoods, but ***Villares de Matabuena*** is a
   separate settlement — an anejo of Matabuena, several km out — and *Mira* is
   ambiguous. So the conflation is not hypothetical: with only 8 rows in
   existence, at least one is already a pedanía wearing the word "barrio". Any
   option that keeps one collection needs a migration that classifies these by
   hand. (Dev is seed data; confirm against prod before acting.)
6. **Does a pedanía need its own escudo, fiestas and admins**, or does it inherit
   the municipio's? This is the question that decides (2) vs. (3).
7. **How does joining work?** Today a user joins a municipio and optionally picks
   a barrio. If pedanías become entities, is the pedanía the join target, with
   the municipio implied?

## Out of scope for now

- Núcleo / diseminado. Nobody says "soy del diseminado de X".
- Historical or disappeared settlements.
- Anything outside Spain.

## Related

- `scripts/fetch-localities.mjs` — current Wikidata locality fetch
- `scripts/enrich-municipality-aliases.mjs` — co-official-name aliases
- `scripts/backfill-municipality-search-prefixes.mjs` — the backfill both feed
- [docs/architecture/municipality-vs-village.md](../../architecture/municipality-vs-village.md)
  — the existing municipality/village distinction this plan adds a third layer to
