---
name: research-mercado
description: Use when researching where Cultuvilla grows — which pueblos surround a reference village, when their fiestas actually are, who organises them, comarcal demographics — and whenever the annual fiestas-locales refresh comes due. Owns the procedure for project/mercado/ and the sweep records in project/busquedas/; the mercado-scout agent executes it.
---

# Researching the market around a pueblo

Keeps [project/mercado/](../../../project/mercado/) current: which pueblos are
reachable from a reference village, when they actually celebrate, and what that
implies for the order in which to approach them.

**Read [project/AGENTS.md](../../../project/AGENTS.md) first** — schema, the
`[[confirmar]]` rule, the public-repo rules and the hard limits. This file is the
procedure.

## The one thing that makes this worth automating

**Every sweep writes a `busquedas/` record.** Not as paperwork — as the mechanism
that makes the next sweep cheaper than this one. The record carries:

- **the radius** (`radioKm`), because a 20 km sweep and a 100 km sweep produce the
  same table with completely different meaning;
- **the sources**, so a claim can be reopened;
- **what returned nothing**, so nobody searches it again;
- **`revisar`**, a date, which is what turns "we should look again sometime" into
  something the tool reports.

Without that record a recurring agent just re-runs the same search annually and
rediscovers what it already knew. With it, widening the radius is a *delta*.

## Hard limits

- **Never contact anyone.** Not an ayuntamiento, not an asociación, not a DM.
- **Never invent a date, a population or a fiesta.** `[[confirmar]]` instead.
- **Never turn a `movil` fiesta into `fija`** to make the panel look tidier. That
  projects a wrong date into next year with nothing to catch it.
- **Never mark a pueblo `buscadoEl` you did not actually search.** That field's
  whole value is that it is true.

## Procedure

### 1. Load what is already known

```bash
pnpm opportunities:list --kind=busqueda   # what has been swept, how wide, when it is due
pnpm fiestas:verify                       # freshness + coverage of the dataset
grep -rn '\[\[confirmar' project/mercado/  # the open questions, including inside the JSON
```

Read all three before searching. `fiestas:verify` prints the registered radius and
the counts; the `[[confirmar]]` sweep is the actual worklist.

### 2. Decide which of the three jobs this run is

They are different work and produce different diffs. Do one.

| Job | Trigger | What changes |
|---|---|---|
| **Refresco anual del boletín** | `fiestas:verify` warns or fails | `bop[]` + every `anio` on a `bop` fiesta |
| **Rellenar huecos** | pueblos with `pendiente` and no `buscadoEl` | `verificada` entries, `buscadoEl` |
| **Ampliar el radio** | somebody asks for a wider ring | a NEW `busquedas/` record + new pueblos |

### 3a. The annual boletín refresh

This is the fixed event the whole check exists for.

- **Segovia** publishes the next year's *fiestas locales* around **mid-September**
  (the 2026 list: Resolución de 16-sep-2025, BOP de 19-sep-2025).
- **Madrid** publishes around **mid-December** (2026: Resolución de 2-dic-2025,
  BOCM nº 296 de 12-12-2025).

Both resolutions list **every municipality in the province**, so this method
extends to any comarca with no extra work.

Update, in this order:
1. the `bop[]` entry for that province (`anio`, `resolucion`, `boletin`, `url`);
2. every `bop` fiesta of every pueblo in that province (`md` and `anio`).

`FiestasDatasetSchema` refuses a half-updated dataset — a fiesta whose `anio`
disagrees with its province's cited resolution is an error, not a warning. That is
deliberate: the realistic failure is updating one province and forgetting the other.

### 3b. Filling a coverage hole

A pueblo's **two fiestas locales are not its semana de fiestas**. They are the
liturgical anchor of the main núcleo; the week the pueblo actually celebrates is
often in a different month. Matabuena declares 16 and 25 July and holds four
fiesta windows, the biggest 22–28 August.

So the BOP is for **discovering and prioritising, never for publishing**.

Where to look, in order of hit rate:

1. **The ayuntamiento's own site**, usually on the Diputación portal
   (`<municipio>.es/fiestas`). **Save the deep link, not the domain** — the first
   sweep recorded domains and that is the weakest part of the dataset.
2. **Wikipedia**, section «Fiestas». Often carries the *rule* ("penúltimo fin de
   semana de agosto"), which is worth more than one year's dates.
3. **Local press and tourism sites** — segoviaudaz.es, segoviaturismo.es,
   festivalesdeespana.com, the comarca's own portals.

Then record it honestly:

- `recurrencia: 'fija'` only when the window opens on a fixed feast or the source
  states recurring calendar dates.
- `recurrencia: 'movil'` + `regla` when the source gives a weekday rule.
- `recurrencia: 'movil'` + `regla: '[[confirmar: … en 2026 fue …]]'` when you have
  **one year's dates and no rule**. This is the common case. Do not upgrade it.
- `anioFuente` when the source is one year's programme rather than a standing rule.
- **`buscadoEl` even when you find nothing.** Searched-and-empty is a result.

### 3c. Widening the radius

A **new** `busquedas/` record, not an edit of the old one. The old one remains
true: it really did cover 21 km. Say in the new record's body what the wider ring
adds and what changes about the argument — at 50 km from Matabuena the ring picks
up Sepúlveda, Riaza, Turégano and Segovia capital, which are a different kind of
municipality and a different conversation.

### 4. Verify

```bash
pnpm fiestas:verify          # freshness, coverage, the sweep pointer
pnpm opportunities:verify    # the busquedas record itself
pnpm business:snapshot       # regenerate what the panel reads (commit the result)
```

`fiestas:verify` **fails** on a BOP year already in the past and **warns** about
everything else. Coverage gaps are not a build failure — they are the worklist.

### 5. Write the sweep record, then report

`project/busquedas/<YYYY-MM>-<slug>.md`. Required frontmatter: `id`, `kind`,
`titulo`, `dominio: mercado`, `ejecutada`, `revisar`, `fuentes`, plus `radioKm`
(enforced). The body says, in this order:

1. **Alcance** — the radius and why that number.
2. **Qué se encontró** — counts, not prose.
3. **Lo que NO cubrió** — the most valuable section. Be specific.
4. **Calidad de las fuentes** — where the citations are weak, said plainly.

Then a PR (`chore/mercado-sweep-YYYY-MM-DD`) whose body leads with what changed in
the dataset and what is still open. **Nothing found is a good report** — say it in
one line and stop.

## Cadence: event-driven, not periodic

Deliberately **not** weekly like `research-opportunities`. There is genuinely
nothing to find in March, and a weekly sweep that finds nothing fifty times teaches
everyone to ignore it — which is how a registry dies.

Two fixed dates a year, plus on demand:

```
/schedule on 2026-10-01 and yearly — run the research-mercado skill for
Cultuvilla: the Segovia fiestas-locales resolution for the next year should be
published; refresh project/mercado and open a PR. Never contact anyone.

/schedule on 2026-12-15 and yearly — same, for the Madrid BOCM resolution.
```

Everything else is on demand: a new comarca, a wider radius, a specific pueblo.
`pnpm opportunities:list --kind=busqueda` and `pnpm fiestas:verify` are what tell
you a run is due, so a missed schedule is visible rather than silent.
