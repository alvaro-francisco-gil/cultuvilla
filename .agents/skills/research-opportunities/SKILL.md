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

### 1. Load current state

```bash
pnpm opportunities:list
```

Read it before searching. Half of what you would "discover" is already filed, and
a duplicate record is worse than a missing one.

### 2. Sweep the existing tree first

Cheaper and higher-yield than any web search:

- **Lapsed deadlines** — `list` prints them under *DEADLINE LAPSED*. Advance the
  status or set `expired`. Never delete; a `lost` record is the only evidence of
  what was tried.
- **Due within 30 days** — printed under *DEADLINE IN THE NEXT 30 DAYS*. These
  lead the report, always. They are the only part with a cost to being late.
- **`[[confirmar]]` markers** — `grep -rn '\[\[confirmar' project/`. Try to
  resolve them from public sources. Resolve or leave; never guess.

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

### 5. Verify

```bash
pnpm opportunities:verify
```

Must pass. It catches enum typos, id/filename drift and duplicate ids.

### 6. Report

Open a PR (branch `chore/opportunity-sweep-YYYY-MM-DD`) whose body is, in order:

1. **Deadlines inside 30 days** — the actionable part, first, with day counts.
2. **New records** — one line each: what, why it fits, deadline.
3. **Status changes** — what lapsed, what advanced.
4. **`[[confirmar]]` resolved** — and what could not be, with why.
5. **Nothing found** is a perfectly good report. Say it in one line and stop.
   Padding a sweep with marginal records is the failure mode to avoid.

Never merge it yourself. The human decides.

## Cadence

Weekly, Monday. Set it up with the `/schedule` skill:

```
/schedule weekly on Monday at 09:00 — run the research-opportunities skill
for Cultuvilla: sweep project/ for lapsed and upcoming deadlines, search for
new convocatorias and encuentros, file at most 5, open a PR. Never contact
anyone and never submit anything.
```

Weekly, not daily: public calls do not appear daily, and a daily agent produces
daily noise until it gets ignored — which is how a registry dies.
