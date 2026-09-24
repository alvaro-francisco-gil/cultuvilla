# project/ — the business side

Everything that funds Cultuvilla or connects it to other people, in a form an
agent can read without being told it exists. **No product code lives here.**

Root [AGENTS.md](../AGENTS.md) governs the codebase; this file governs this tree.
You do not need to load the root file to work here.

```
project/
  convocatorias/   subvenciones, premios, aceleradoras — money we could win
  eventos/         meetups, encuentros, congresos, ferias — rooms worth being in
  entidades/       funders, collaborators, administrations — people and orgs
  proposals/       applications actually submitted (the artifacts, not the tracking)
  mercado/         where the users are — comarcas, pueblos vecinos, expansión
```

`mercado/` is **not part of the opportunity registry**: `opportunities-cli.mjs`
only walks the three directories in `KIND_BY_DIR`, so records here need no
frontmatter and no `kind`. They are research about *where* Cultuvilla grows,
which has no lifecycle to track — a pueblo does not expire.

**`mercado/` is the record layer, and it has two halves.** A `.md` is the
reasoning a human reads; the `.json` beside it is the machine surface the panel
reads. Same split as frontmatter/body, one level up. The JSON is validated
against `FiestasDatasetSchema` by `pnpm business:snapshot` and reported on by
`pnpm fiestas:verify`, so a malformed dataset fails the build rather than
blanking a panel tab.

Three rules make the research compound instead of being redone every year:

1. **Every date carries its origin.** `fuente` is a URL or a citation precise
   enough to reopen, and `verificadoEl` says when it was last checked. `tipo`
   separates a bulletin-`declarada` date from a `verificada` week; nothing is
   promoted between them by reasoning.
2. **Coverage is data.** `cobertura.radioKm` plus one `barrido` per sweep. Inside
   the widest radius ever swept a missing municipality is a **gap**; outside it,
   it was never in scope — and without that recorded, a 20 km search and a
   300 km search produce identical-looking files. The radius only ever grows,
   and widening it means adding every municipality inside the new one.
3. **Unknowns are visible.** A pueblo with no verified week carries a
   `[[confirmar: …]]`, so `grep -rn '\[\[confirmar' project/` is the worklist.
   *Searched and found nothing* is a result worth writing down — otherwise the
   next run repeats the search.

The `[[confirmar]]` rule and the "this repo is public" rules below apply in full.

## Start here, every time

```bash
pnpm opportunities:list                 # whole registry + anything due in 30 days
pnpm opportunities:list --kind=evento   # one kind
pnpm opportunities:list --json          # frontmatter only, for programmatic use
pnpm opportunities:verify               # structural check (runs in CI)
```

`list` is the entry point on purpose: **the frontmatter is the machine surface,
the Markdown body is for humans.** Never answer a question about what we are
chasing by grepping prose — the frontmatter is the state.

## One record per file

`<kebab-id>.md`, where the id **equals the filename** and the `kind` **matches the
directory**. Both are enforced; they are what stops a record from drifting away
from where it is filed.

```yaml
---
id: epa-encuentro-galera-2026     # == filename, kebab-case, unique tree-wide
kind: evento                      # convocatoria | evento | entidad
titulo: "Encuentro EPA! rural"
status: candidate                 # convocatoria/evento only
fit: high                         # high | medium | low
deadline: 2026-10-09              # optional, ISO — drives the 30-day warning
---
```

Frontmatter is **flat scalars only** — no nested maps, no lists, no multi-line
values. That constraint is why the parser is 30 tested lines instead of a YAML
dependency in the root package. Anything richer belongs in the body.

Free-form extra keys (`lugar`, `coste`, `convocante`, `importe`, `tipo`, `url`,
`fuente`, `inicio`, `fin`) are allowed and unvalidated. `fuente` — where the
information came from and when — is not optional in practice: a record whose
origin nobody can retrace is a record nobody trusts in three months.

<!-- record:routing -->

## Where a fact goes

| Fact | Goes to |
|---|---|
| Money Cultuvilla could win — subvención, premio, aceleradora | `convocatorias/<id>.md` |
| A room worth being in — meetup, encuentro, congreso, feria | `eventos/<id>.md` |
| A funder, collaborator or administration | `entidades/<id>.md` |
| An application actually assembled | `proposals/<slug>/`, state in `propuesta.md` |
| Where the users are — comarcas, pueblos vecinos, expansión | `mercado/<slug>.md`, with its `.json` sibling where the panel reads it |
| When a pueblo celebrates — fecha, regla de recurrencia | `mercado/<slug>.json` → `pueblos[].fiestas[]` |
| How far a search actually reached | `mercado/<slug>.json` → `cobertura.barridos[]` — a 20 km sweep and a 300 km sweep look identical without it |
| Where a fact came from, and when | the record's `fuente` field — not optional in practice |
| Anything unverified | marked `[[confirmar]]` in place, never resolved by inference |
| A durable decision about the business | `../docs/decisions/<slug>.md` |
| Something that might be worth doing | `../docs/plans/ideas/<slug>.md` |
| A rule about how this tree works | this file |

Product code is not a record: a fact that would still be true if every line of
`apps/` were rewritten in another language belongs here, and nothing else does.

This tree follows the `system-of-record` convention, installed from the
[agent-record](https://github.com/alvaro-francisco-gil/agent-record) marketplace. The two
`<!-- record:* -->` comments are anchors the checker finds by exact string; leave them
where they are. `pnpm opportunities:markers` runs it over this tree.

## Two lifecycles, deliberately not one

| kind | field | vocabulary |
|---|---|---|
| `convocatoria` | `status` | `watching → candidate → preparing → submitted → won \| lost \| expired` |
| `evento` | `status` | `watching → candidate → registered → attended \| skipped \| expired` |
| `entidad` | `relacion` | `sin-contacto → contactado → conversando → colaborando \| descartado` |
| `propuesta` | `status` | `borrador → lista → enviada \| retirada` |

A funding call is won or lost; an event is attended or skipped. Collapsing them
into one generic enum would cost the only distinction worth having when you look
back over a year. An `entidad` has **no** `status` — it has a relationship, and
putting one on it is a validation error.

A `propuesta`'s lifecycle is about **readiness, not outcome**: `won`/`lost`
belong to the convocatoria it targets, not to the document. That separation is
why a proposal can be `enviada` while its convocatoria is still `submitted`.

`watching`, `candidate` and `preparing` are the **open** statuses: the ones a
lapsed deadline strands. That is what the deadline warnings key off.

## Language: Spanish in the body, English in the machine fields

The bodies are Spanish because the source material is — *subvención*,
*convocatoria*, *grupo de acción local*, *Protectorado*, *dotación* are Spanish
regulatory vocabulary and translating them makes them worse. Enum values and
field names stay English because they are code. Same split as
[docs/plans/ideas/entidad-juridica.md](../docs/plans/ideas/entidad-juridica.md).

## `[[confirmar]]` means unverified

Borrowed from [proposals/mashumano/formulario.md](proposals/mashumano/formulario.md).
**A confidently wrong description of a potential collaborator is worse than a
blank one**, so anything unverified is marked rather than guessed — and an agent
must never quietly resolve a `[[confirmar]]` by inference. Verify it against a
real source or leave it.

**One word, two forms.** Bare `[[confirmar]]` says *this is unverified*; with a
colon, `[[confirmar: ¿…?]]`, the text **is** the question to ask. Most records
run two separate marker words for those two states. One word covering both is a
spelling choice, not a third state, and `pnpm opportunities:markers` is told so
by being passed `confirmar` as both markers. Never invent a third word — "por
verificar", "TBC", "revisar" — because a marker that does not appear in one
sweep might as well not exist.

A question may wrap across lines; it ends at the closing `]]`, and a marker left
unterminated is an error rather than a marker nobody ever sees again. When
writing *about* the marker rather than using one, put it in backticks.

## Hard limits on what an agent may do here

- **Never contact anyone.** No email, no DM, no form submission, no registration.
- **Never submit an application** or commit Cultuvilla to anything.
- **Never invent** a deadline, an amount, an eligibility rule or an organization's
  description. `[[confirmar]]` exists for precisely this.
- **Cap new records at 5 per research run.** A tree nobody reads is worse than no
  tree; every record must pass eligibility before it is filed.

<!-- record:perimeter -->

## This repo is public

Deliberately — the proposal, the legal analysis and the store listing are already
public, and the strategy is not the moat. Consequences, which are rules:

- **No third-party personal contact details.** No emails, no phone numbers.
- **No unpublished financials**, ours or anyone's.
- **No competitive assessment of named people or orgs.** `fit: high|medium|low`
  plus one factual line about why. Not a dossier.

## Proposals are folders, and their readiness is computed

`proposals/` is the one directory whose records are **folders**, because a
candidacy is a bundle: form answers, a business plan, CVs, a render script. Each
folder carries its state in `proposals/<slug>/propuesta.md`, whose `id` is the
folder name.

Two rules make the lifecycle worth having:

- **`para` names the record it targets** (a convocatoria or an evento), and the
  proposal **inherits that record's deadline**. Restating the deadline is a
  validation error — the date lives in exactly one place, so it cannot drift.
- **Readiness is counted, not claimed.** `pnpm opportunities:list` counts the
  unresolved `[[...]]` markers across every `.md` in the folder and prints them.
  A proposal marked `lista` that still has holes is **warned about**, because the
  failure this catches is not forgetting a proposal — it is *believing one is
  finished*. A `borrador` with holes is normal and silent.

So the question "what have we got pending to fill in, and what is ready to send?"
is answered by the tool from the files themselves, not from a status somebody
remembered to update.

## Researching new ones

Two skill/agent pairs, on deliberately different cadences:

| Tree | Skill | Agent | Cadence |
|---|---|---|---|
| `convocatorias/` `eventos/` `entidades/` `proposals/` | `research-opportunities` | `opportunity-scout` | weekly |
| `mercado/` | `research-village-fiestas` | `mercado-scout` | event-driven: Segovia BOP ~late Sept, Madrid BOCM ~mid-Dec |

Fiestas research is **not** weekly on purpose: the bulletins publish once a year
and there is genuinely nothing to find in March, so a sweep that finds nothing
fifty times teaches everyone to ignore it.
[fiestas-freshness.yml](../.github/workflows/fiestas-freshness.yml) opens an
issue when the dataset falls behind, so nobody has to remember. They live at
[.agents/skills/research-opportunities/](../.agents/skills/research-opportunities/SKILL.md)
and [.claude/agents/opportunity-scout.md](../.claude/agents/opportunity-scout.md)
— `.claude/skills` is a symlink to `.agents/skills`, so edit the `.agents/` path.
