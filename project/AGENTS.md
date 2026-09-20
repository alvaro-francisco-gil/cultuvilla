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

A funding call is won or lost; an event is attended or skipped. Collapsing them
into one generic enum would cost the only distinction worth having when you look
back over a year. An `entidad` has **no** `status` — it has a relationship, and
putting one on it is a validation error.

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

## Researching new ones

The `research-opportunities` skill owns the procedure; the `opportunity-scout`
agent runs it. Weekly is the intended cadence — see the skill. They live at
[.agents/skills/research-opportunities/](../.agents/skills/research-opportunities/SKILL.md)
and [.claude/agents/opportunity-scout.md](../.claude/agents/opportunity-scout.md)
— `.claude/skills` is a symlink to `.agents/skills`, so edit the `.agents/` path.
