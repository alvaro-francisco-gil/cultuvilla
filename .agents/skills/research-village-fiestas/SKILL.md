---
name: research-village-fiestas
description: Use when researching when the pueblos around a village celebrate their fiestas, widening a search to a bigger radius or a new comarca, refreshing the declared dates after a provincial bulletin publishes, or resolving [[confirmar]] markers in project/mercado/. Owns the dataset under project/mercado/; the mercado-scout agent executes it.
---

# Researching village fiestas

Keeps the pueblo datasets in [project/mercado/](../../../project/mercado/) current:
who is nearby, and when they celebrate. **Read
[project/AGENTS.md](../../../project/AGENTS.md) first** — schema, public-repo
rules, `[[confirmar]]`. This file is the procedure.

Cultuvilla grows pueblo by pueblo, and a pueblo is reachable in the weeks
*before* its fiestas and persuadable in the weeks *after*. That is the whole
reason this dataset exists.

## The one thing to get right

**A municipality's two declared *fiestas locales* are not its semana de fiestas.**

The provincial bulletin lists two days per municipality. Those are the liturgical
anchor of the main núcleo, agreed by the Pleno for labour-calendar purposes.
The week the pueblo actually celebrates is frequently a different month.

Matabuena declares **16 and 25 July** and holds **four** fiesta windows — Cañicosa
2–3 Jul, Matabuena 22–25 Jul, Matamala 15–21 Aug, Matabuena 22–28 Aug. The
biggest appears in no official register.

So: `tipo: 'declarada'` for a bulletin date, `tipo: 'verificada'` only with a
dated public source in `fuente`. Never promote one to the other by reasoning.

## Hard limits

- **Never contact anyone.** Not an ayuntamiento, not an asociación, not a bandomóvil.
- **Never invent** a date, a rule or a population. `[[confirmar: …]]` instead.
- **Never delete a `[[confirmar]]`** except by replacing it with a sourced fact.
- **Never narrow `cobertura.radioKm`.** It only ever grows; a sweep is additive.
- This repo is **public** — no personal contact details, ever.

## Procedure

### 1. Load current state

```bash
pnpm fiestas:verify                        # rebuilds the shared package first
grep -rn '\[\[confirmar' project/mercado/
```

Read both before searching. The `[[confirmar]]` list *is* the worklist, and it is
cheaper and higher-yield than any new search. A dataset at 22 % verified does not
need more pueblos; it needs the ones it has confirmed.

### 2. Decide the sweep, and record it

**Coverage is data.** A 20 km sweep and a 300 km sweep produce identical-looking
files, and without `cobertura` nobody can tell a *gap* from *out of scope*. So
before searching, decide the radius, and afterwards append a `barrido`:

```json
{ "fecha": "2027-10-02", "radioKm": 50, "provincias": ["Segovia", "Madrid"],
  "anioBop": 2027, "pueblosHallados": 96, "nota": "Ampliación de 20 a 50 km." }
```

Inside the **widest radius ever swept**, a missing municipality is a bug. Outside
it, it was never in scope. That invariant is the dataset's whole value, so:
**when you widen the radius, you must add every municipality inside the new
radius**, even those with nothing but two declared dates.

Distance is great-circle between municipal centroids (Wikidata `P625`). Keep the
method identical across sweeps or the rings stop being comparable.

### 3. Declared dates — the bulletin

Published in **about September of the preceding year**, one resolution per
province, listing every municipality:

- **Segovia** — *Resolución de la Oficina Territorial de Trabajo*, BOP. The 2026
  list: resolved 16-09-2025, published 19-09-2025.
- **Madrid** — *Resolución de la D. G. de Trabajo*, BOCM, mid-December.

These are PDFs covering the whole province, so one fetch yields every
municipality at once. Parse rather than transcribe.

### 4. Fixed or moveable — the trap

The bulletin prints both kinds of date identically, and getting this wrong makes
the calendar quietly wrong a year later.

- **San Miguel, 29 September** is fixed. `recurrencia: 'fija'`.
- **"Virgen del Rosario, 5 October 2026"** is the *first Sunday of October,
  observed on the Monday*. `recurrencia: 'movil'` with
  `regla: { n: 1, weekday: 7, month: 10 }` — and `n` may be negative (`-1` last,
  `-2` "penúltimo").
- **Corpus and Carnaval** are Easter-derived. Moveable, no rule expressible here.

**If you cannot prove which it is, mark it moveable with no rule and leave a
`[[confirmar]]`.** A date that resolves to the stored anchor is honest; a date
frozen from one year's observance is a lie with a long fuse.

### 5. Verified weeks — the valuable part

Per pueblo, in descending order of yield:

1. **`https://www.<municipio>.es/fiestas`** — the Diputación hosts most Segovia
   ayuntamientos. Many are empty shells; some carry exact date ranges.
2. **Spanish Wikipedia, §Fiestas** — thin for tiny pueblos, precise when present.
3. **Local press** — eladelantado.com, segoviaudaz.es, segoviaaldia.es,
   eventosdesegovia.com, and the Diputación's weekend round-ups.
4. **Comarca sites** — segoviasur.com, parquesierraguadarrama.com.

Record `fuente` as a URL or a citation precise enough to reopen, plus
`verificadoEl`. A `verificada` with no retraceable source is worse than a
`declarada`, because it claims an authority it does not have.

**Searched and found nothing is a result.** Say so in the `[[confirmar]]` text,
with the date. Otherwise the next run repeats your search.

### 6. Report

The PR leads with **what changed in the calendar**, not how many pueblos were
touched. A new verified week for a pueblo in anillo 1 outranks forty new
declared dates in anillo 3.

Then regenerate and check:

```bash
pnpm business:snapshot     # the panel reads the dataset through this
pnpm fiestas:verify        # coverage, verified %, open markers
```

## Cadence

Not periodic — **event-driven**, because there is genuinely nothing to find in
March:

| When | What |
|---|---|
| **Late September** | Segovia BOP publishes next year's list → bump `anioBop`, refresh declared dates |
| **Mid-December** | Madrid BOCM does the same |
| **Any time** | Resolve `[[confirmar]]` markers; widen the radius; add a comarca |

`.github/workflows/fiestas-freshness.yml` runs `pnpm fiestas:verify --strict`
monthly and opens an issue when `anioBop` falls behind. That is the reminder —
no one has to remember.
