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

`mercado/` is **not part of the registry**: `opportunities-cli.mjs` only walks
the three directories in `KIND_BY_DIR`, so records here need no frontmatter and
no `kind`. They are long-form research about *where* Cultuvilla grows, which has
no lifecycle to track — a pueblo does not expire. The `[[confirmar]]` rule and
the "this repo is public" rules below still apply in full.

A `mercado/` record may carry a sibling `.json` holding the same research as
structured data — `pueblos-vecinos-matabuena.json` next to its `.md`. That is
the frontmatter/body split again, one level up: **the JSON is the machine
surface the panel reads, the Markdown is the reasoning a human reads.** The JSON
is validated against `FiestasDatasetSchema` by `pnpm business:snapshot`, so a
malformed dataset fails the build instead of blanking a panel tab. Change one
and change the other — nothing checks that the prose still matches the data.

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

## Hard limits on what an agent may do here

- **Never contact anyone.** No email, no DM, no form submission, no registration.
- **Never submit an application** or commit Cultuvilla to anything.
- **Never invent** a deadline, an amount, an eligibility rule or an organization's
  description. `[[confirmar]]` exists for precisely this.
- **Cap new records at 5 per research run.** A tree nobody reads is worse than no
  tree; every record must pass eligibility before it is filed.

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

The `research-opportunities` skill owns the procedure; the `opportunity-scout`
agent runs it. Weekly is the intended cadence — see the skill. They live at
[.agents/skills/research-opportunities/](../.agents/skills/research-opportunities/SKILL.md)
and [.claude/agents/opportunity-scout.md](../.claude/agents/opportunity-scout.md)
— `.claude/skills` is a symlink to `.agents/skills`, so edit the `.agents/` path.
