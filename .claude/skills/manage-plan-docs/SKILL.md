---
name: manage-plan-docs
description: Procedure for creating, updating, promoting, or archiving plan and spec docs under cultuvilla's `docs/`. Use whenever drafting a new plan or spec, changing a doc's status, finishing work a doc covers, or asking "where does this doc go?". Encodes the three-state lifecycle (superpowers drafts → canonical plans → archive) and the Status frontmatter so sessions stay aligned.
---

# Manage plan docs

The `docs/` tree has a deliberate lifecycle. Plans and specs move through three states — drafted in `superpowers/`, promoted to `plans/` when blessed, archived when shipped. Status is tracked inline so a single `grep` answers "what's active right now."

## Folder map

```
docs/
├── plans/             canonical: active + backlog + blocked + speculative + reference
├── superpowers/       drafts (this is where new content starts)
│   ├── plans/
│   └── specs/
├── architecture/      living reference (already exists — keep)
├── ENVIRONMENTS.md    living reference doc
├── testing.md         living reference doc
└── archive/           terminal (work shipped or killed)
    ├── plans/
    ├── specs/
    └── audits/
```

- **`superpowers/`** is the workspace. Brainstorming and writing-plans skills write here. Content here is not yet canonical — the user hasn't blessed it.
- **`plans/`** is canonical. Anything here is real work being tracked.
- **`archive/`** is terminal. Files arrive here only when the work they describe is shipped (or formally killed).
- **`architecture/`**, `ENVIRONMENTS.md`, `testing.md` are living reference — separate from the plan lifecycle.

Create `plans/` and `archive/` (with `plans/`, `specs/`, `audits/` subfolders) on first use; they don't exist by default.

## Status taxonomy

Every file in `docs/plans/` must have a Status block right after the H1:

```markdown
# <Title>

**Status:** <value> — <optional one-line reason>
**Last reviewed:** YYYY-MM-DD

…rest of doc…
```

Allowed values:

| Status | Meaning |
|---|---|
| `active` | being worked on now (open commits, partial implementation in main) |
| `backlog` | queued, ready to start, nothing blocking |
| `blocked` | waiting on a dependency, decision, or calm window (note what in the reason) |
| `speculative` | maybe never — idea preserved for future reference |
| `reference` | living convention/audit/precedent — informs ongoing decisions, doesn't describe pending work |

When work ships, do NOT change the status to `done` in place — `git mv` to `archive/plans/` instead. The folder location is the terminal-state signal.

## Decision tree — where does my new doc go?

```
Is this a draft I'm just starting, before the user has blessed the shape?
  → docs/superpowers/plans/  (or specs/ for design content)

Is this a blessed plan describing pending implementation work?
  → docs/plans/  with Status: backlog (or active/blocked)

Is this a permanent reference doc (conventions, audit methodology, precedent)?
  → docs/plans/  with Status: reference

Is this an idea I want to preserve but probably won't execute?
  → docs/plans/  with Status: speculative

Is the work this doc describes already shipped?
  → docs/archive/<type>/  (no further status changes)
```

## Lifecycle transitions

### 1. Draft (you wrote something new)

Land it in `docs/superpowers/plans/` or `docs/superpowers/specs/`. Drafts use a dated filename `YYYY-MM-DD-<kebab-slug>.md` — the date sorts drafts chronologically while many proposals coexist. No Status frontmatter required yet — the folder is the signal.

### 2. Promote (the user has blessed it)

When the user signs off and the doc should become canonical:

1. Add the Status frontmatter block (pick from the taxonomy above).
2. **Drop the date prefix** when renaming. Canonical filenames in `docs/plans/` are slug-only (`claude-skills-and-conventions.md`, not `2026-05-19-claude-skills-and-conventions.md`).
3. `git mv docs/superpowers/<plans|specs>/YYYY-MM-DD-<slug>.md docs/plans/<slug>.md`.
4. Update any cross-links to the file. Other plans may reference it by path.

A spec paired with an active plan can either be inlined into the plan or live alongside it in `docs/plans/` with the `-design.md` suffix and `Status: reference`. Prefer inlining for short designs; keep separate for >300 lines.

### 3. Archive (work is shipped)

When a plan ships:

1. Verify the doc captures the final state. The archived file is the historical record.
2. `git mv docs/plans/<file>.md docs/archive/plans/<file>.md`.
3. For a plan that had a paired spec in `superpowers/specs/`, archive the spec at the same time to `docs/archive/specs/`.
4. Do **not** change the Status line on archival. Folder location signals "done."

### Status changes within `docs/plans/`

When work moves between `backlog → active`, `active → blocked`, etc., **edit the Status line in place**. Do not move the file. Only the alive↔archive transition involves a `git mv`.

Always bump `**Last reviewed:**` to today when you update a Status.

## Filename convention

| Folder | Format | Example |
|---|---|---|
| `docs/superpowers/plans/` and `specs/` | `YYYY-MM-DD-<slug>.md` | `2026-05-19-claude-skills-and-conventions.md` |
| `docs/plans/` | `<slug>.md` (slug-only, no date) | `claude-skills-and-conventions.md` |
| `docs/archive/<type>/` | preserve whatever name the file had at archival | `claude-skills-and-conventions.md` |

Strip the date prefix at promotion time, not at archive time. Once a file is in a canonical folder, its slug is its identity for cross-links — preserve it through archival.

## When linking between docs

Use repo-relative paths. Common patterns:

- Plan → architecture: `[../architecture/<file>.md](../architecture/<file>.md)`
- Plan → archived doc: `[../archive/plans/<file>.md](../archive/plans/<file>.md)`
- Plan → reference doc (same folder): `[./<file>.md](./<file>.md)`
- Archived doc back to a plan: `[../../plans/<file>.md](../../plans/<file>.md)`

When you archive a file, grep for inbound links to it and update the paths. Otherwise links break silently.

## What this skill does NOT do

- It does not decide *what* the plan should contain — that's `superpowers:writing-plans` / `superpowers:brainstorming`.
- It does not run `git commit`. Doc moves are working-tree changes; the user controls commits in this repo (the rest of the workflow is direct-to-main per `feedback_push_main`, but the user decides when each move lands).

## Common mistakes to avoid

- **Writing a new plan directly into `docs/plans/`** — bypasses the draft-review step. Start in `superpowers/`, get the user to bless it, then promote.
- **Renaming a file when promoting in a way that breaks git's rename detection** — `git mv` preserves blame and rename detection; raw `mv + add + rm` does not.
- **Changing Status to `done`** — there is no `done` status. Shipped work moves to `archive/`. The status taxonomy describes alive states only.
- **Leaving a stale `Last reviewed:` date** — if you edited the doc or changed the Status, bump it.
- **Creating a `docs/specs/` folder at the top level** — design content goes in `docs/superpowers/specs/` (draft), `docs/plans/` with `Status: reference` (promoted), or `docs/archive/specs/` (shipped).

## Companion skills

- `superpowers:brainstorming`, `superpowers:writing-plans` — produce the drafts this skill manages.
