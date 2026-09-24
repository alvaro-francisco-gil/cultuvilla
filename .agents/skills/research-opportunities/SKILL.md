---
name: research-opportunities
description: Use when researching or filing business opportunities for Cultuvilla — public funding calls (subvenciones, premios, convocatorias, LEADER), meetups/encuentros worth attending, or potential collaborators — and whenever the recurring opportunity sweep runs. Owns the procedure for the registry under project/; the opportunity-scout agent executes it.
---

# Researching business opportunities

Keeps [project/](../../../project/) current: funding Cultuvilla could win, rooms
it should be in, people worth knowing. **Read
[project/AGENTS.md](../../../project/AGENTS.md) first** — it holds the schema, the
two lifecycles, the public-repo rules and the hard limits. This file is the
procedure.

## Hard limits (repeated because they are the ones that matter)

- **Never contact anyone.** Not an email, not a DM, not a registration form.
- **Never submit** an application or commit Cultuvilla to anything.
- **Never invent** a deadline, amount or eligibility rule. `[[confirmar]]` instead.
- **≤5 new records per run.** Filing 40 marginal calls destroys the tree's value.

The human decides what to apply for and who to talk to. You file and score.

## Procedure

### 1. Load current state — including what the last sweep already ruled out

```bash
pnpm opportunities:list
pnpm opportunities:list --kind=busqueda   # what has been searched, and when
```

Read both before searching. Half of what you would "discover" is already filed,
and a duplicate record is worse than a missing one.

**Then read the most recent `busquedas/` record end to end**, especially its
`sinHallazgos` and its *"Lo que este barrido NO cubrió"* section. Those two are the
difference between this run being cheaper than the last one and being identical to
it. The registry's records are only what previous searches *found*; the sweep
record is the only evidence of what they found nothing in.

Concretely: do not re-search a source listed in `sinHallazgos` unless its stated
reason has changed. "ENISA — persona física no elegible" stops being true the day
the asociación exists, and not before. Say in your report which of those you
re-opened and why.

### 2. Sweep the existing tree first

Cheaper and higher-yield than any web search:

- **Lapsed deadlines** — `list` prints them under *DEADLINE LAPSED*. Advance the
  status or set `expired`. Never delete; a `lost` record is the only evidence of
  what was tried.
- **Due within 30 days** — printed under *DEADLINE IN THE NEXT 30 DAYS*. These
  lead the report, always. They are the only part with a cost to being late.
- **`[[confirmar]]` markers** — `grep -rn '\[\[confirmar' project/`. Try to
  resolve them from public sources. Resolve or leave; never guess.
- **Proposals mid-flight** — `pnpm opportunities:list --kind=propuesta` prints
  each candidacy's state and its unresolved hole count, with the deadline
  inherited from the record it targets. A `borrador` whose deadline is close is
  the most actionable thing the registry can surface; a proposal marked `lista`
  that still has holes is flagged separately. Never fill a hole by guessing — the
  holes are personal data and logistics only the humans know.

### 3. Search

What Cultuvilla is, for eligibility purposes: a **mobile app for the villages of
the *España vaciada*** — asociaciones and comisiones de festejos publish events,
residents (resident and emigrated) take part, local heritage gets documented
before it is lost. Pilot: **Matabuena, Segovia**. Today it is a **persona física**;
an asociación is being considered
([entidad jurídica](../../../docs/plans/ideas/entidad-juridica.md)).

Search across, roughly in order of hit rate:

1. **Comarcal / LEADER** — grupos de acción local covering Segovia. Smallest
   pools, least competition, best alignment. See
   [adefoincovillas](../../../project/entidades/adefoincovillas.md).
2. **Castilla y León** — Junta, Diputación de Segovia: despoblación, cultura,
   patrimonio, digitalización rural, juventud.
3. **National** — Ministerio de Cultura (patrimonio inmaterial, memoria oral),
   Ministerio para la Transformación Digital, Red.es, ENISA, reto demográfico.
4. **Foundations and prizes** — Carasso, Máshumano, la Caixa, Telefónica, Google
   for Startups, social-innovation awards.
5. **Encuentros and meetups** — rural-development gatherings, *pueblos*
   networks, civic-tech events. An event that puts Cultuvilla in a room with
   **many different pueblos** outranks a bigger, more prestigious one that does
   not: the second pilot village is the constraint, not visibility.

**Known recurring sources — check these by name every run**, because they are
annual and the registry already knows what they are worth:

| Source | Cycle | Why |
|---|---|---|
| **MITECO**, despoblación / reto demográfico | pending publication, expected Sept 2026 | Best fit in the registry. Check BOE + MITECO sede electrónica weekly until it appears. |
| **Europa Nostra / European Heritage Awards** | call ~April, deadline ~September | Category 4 accepts **individuals** — one of the few open to a persona física. The 2027 edition was missed by 13 days; do not repeat it. |
| **Junta de Castilla y León · Diputación de Segovia** | rolling | Where FEDER actually reaches us. Search the organisation, never the word "FEDER". |
| **Town Twinning / CERV** | annual | Applicant is the **ayuntamiento**, not us. Needs a partner village lined up first. |
| **LEADER via the comarcal GAL** | rolling | Smallest pool, best alignment. FEADER, not FEDER — a different door. |

**The eligibility filter, applied before filing anything:**

- Does a **persona física** qualify? If not, note it — that is an argument for the
  asociación, and a `fit: medium` at best until the entity exists.
- Is the territory right (Segovia / Castilla y León / national)?
- Is the deadline in the future?
- Would we plausibly *win*? A national call for consortia of five universities is
  not a `fit: low`, it is not a record at all.

### 4. File

One file per record, per the schema in `project/AGENTS.md`. Score `fit` honestly:
`high` means *we should actually do this*. If everything is `high`, the field has
stopped carrying information.

Always set `fuente` — where it came from and the date seen.

### 5. Write the sweep record

**Every run ends with one**, at `project/busquedas/<YYYY-MM>-<slug>.md`. This is
not paperwork — it is the mechanism that makes a recurring search compound instead
of merely repeating. Required frontmatter: `id`, `kind`, `titulo`, `ejecutada`,
`revisar`, `fuentes`, `sinHallazgos`; the last one is enforced.

The body, in this order:

1. **El filtro que decidió casi todo** — usually eligibility. Say it once, up top.
2. **Fichado** — one line per new record and why it passed.
3. **Descartado, y por qué — para no volver a mirarlo.** The highest-value section.
   Name the source and the *reason*, so a later run knows when the reason expires.
4. **Lo que NO cubrió** — the tablones, territories and programme families you did
   not reach. Be specific; "no se recorrió el tablón de la Diputación de Segovia"
   is a next task, "búsqueda no exhaustiva" is noise.
5. **Por qué esa fecha de `revisar`** — tie it to something real (a call expected to
   publish, a deadline approaching), not to a generic cadence.

`revisar` is a commitment the tooling will hold you to: once it passes,
`opportunities:verify` warns and the weekly job opens an issue. Pick a date with a
reason behind it.

### 6. Verify

```bash
pnpm opportunities:verify   # structural check + overdue-sweep warning
pnpm business:snapshot      # regenerate what the panel reads (commit the result)
```

`verify` must pass. It catches enum typos, id/filename drift, duplicate ids, and a
búsqueda missing its sources or its misses.

### 7. Report

Open a PR (branch `chore/opportunity-sweep-YYYY-MM-DD`) whose body is, in order:

1. **Deadlines inside 30 days** — the actionable part, first, with day counts.
2. **New records** — one line each: what, why it fits, deadline.
3. **Status changes** — what lapsed, what advanced.
4. **`[[confirmar]]` resolved** — and what could not be, with why.
5. **Sources re-opened from a previous `sinHallazgos`** — and what changed.
6. **Nothing found** is a perfectly good report. Say it in one line and stop —
   but still write the sweep record, because *a sweep that found nothing is exactly
   the sweep whose coverage is most worth keeping.* Padding a sweep with marginal
   records is the failure mode to avoid; skipping the record because there was
   nothing to file is the second one.

Never merge it yourself. The human decides.

## Cadence

Weekly, Monday — and the repo now enforces it from the other end: once a sweep's
`revisar` passes, [busquedas-freshness.yml](../../../.github/workflows/busquedas-freshness.yml)
opens an issue. So a missed week is visible instead of silent, and the schedule
below is the thing that keeps the issue from ever opening.

Set it up with the `/schedule` skill:

```
/schedule weekly on Monday at 09:00 — run the research-opportunities skill
for Cultuvilla: sweep project/ for lapsed and upcoming deadlines, search for
new convocatorias and encuentros, file at most 5, open a PR. Never contact
anyone and never submit anything.
```

Weekly, not daily: public calls do not appear daily, and a daily agent produces
daily noise until it gets ignored — which is how a registry dies.
