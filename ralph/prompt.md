# Ralph — Cultuvilla AFK loop

You are running one iteration of the Ralph loop in the Cultuvilla repo. You work on **AFK** slices only — never HITL. The user is asleep; act accordingly.

## Context you already have

- `AGENTS.md` at repo root — non-negotiable rules (service-layer ownership, top-level collections scoped by `municipalityId`, denormalized read models, strict TS, structured logger in functions, no `--no-verify`, no amend, never start dev servers, never deploy).
- The skills under `.claude/skills/` — load `superpowers:test-driven-development` for feature slices and `fix-bug` for bug slices.
- Domain skills — load when the slice paths touch them: `touch-service`, `guardrail-enforcement`, `denormalized-read-model`, `cloud-function-logging`, `add-firestore-collection`, `i18n-add-string`, `mobile-web-compat`.
- The last 5 commits (passed in the invocation context).
- The current queue of slice files under `implementation-queue/**/*.md` (excluding `done/` subdirectories).

## Step 1 — Read the queue

**Plan filter:** if the invocation context contains a line starting with `PLAN FILTER:` followed by a slug, restrict your scan to `implementation-queue/<slug>/` only. If the line says `PLAN FILTER: none`, scan every plan directory.

Enumerate every slice file under the (possibly filtered) `implementation-queue/` tree, excluding any `done/` subdirectories. For each, parse its YAML frontmatter:

- `type` (AFK or HITL)
- `plan` (slug)
- `blocked_by` (list of slice IDs that must be completed first — completed = file is in the matching `done/` directory)
- `allowed_paths`, `forbidden_paths` (AFK only)
- `feedback_loop` (commands to run pre-commit)
- `budget_iterations` (soft cap — count failed iterations on this slice)

**Ignore every HITL slice.** They exist for the human, not you.

If no AFK slice has all its `blocked_by` satisfied **within the filtered scope**, output exactly:

```
<promise>NO MORE TASKS</promise>
```

and stop. (If a `PLAN FILTER` was set and only that plan is exhausted, this still means "stop now" — the user knows other plans may have pending work.)

## Step 2 — Pick one slice

Priority order:
1. Critical bugfixes (slice title or notes mention a regression / production incident / data loss risk)
2. Development infrastructure (tests, types, dev scripts, harness fixes) — infrastructure unblocks everything else
3. Tracer bullets for new features — thin end-to-end paths
4. Polish and quick wins
5. Refactors

Within the same priority, prefer slices with more downstream `blocked_by` dependents — unblocking more is higher leverage.

**Work on one slice. Only one.**

## Step 3 — Verify safety before touching code

For the chosen slice, before any file write:

1. The `allowed_paths` glob list MUST cover every file you intend to modify. If a needed change falls outside, **stop**: don't widen the allow-list, escalate (see Step 7).
2. None of your intended changes may match `forbidden_paths`. Defense in depth — even if not in the slice's own list, refuse to touch any of:
   - `firestore.rules`, `firestore.indexes.json`
   - `functions/**`
   - `apps/mobile/app.config.ts`, `apps/mobile/app.json`, `apps/mobile/eas.json`
   - `AGENTS.md`, `CHANGELOG.md`
   - `.github/workflows/**`
   - `scripts/deploy*.js`, `scripts/admin-*.js`, `scripts/seed*.{js,mjs,ts}`
3. You will not run any of: `pnpm deploy:*`, `firebase deploy …`, `eas …`, `gcloud … prod`, `gh pr merge`, `git push --force`, `git reset --hard`, `git push` to `main` directly. You MAY run `git push -u origin feat/<plan-slug>` (the plan branch only).
4. You will NEVER start a dev server, Metro bundler, or Firebase emulators (`pnpm web:dev`, `pnpm app:dev`, `expo start`, `firebase emulators:start`, `pnpm test:integration`, `pnpm test:rules`, `pnpm test:functions`, `pnpm test:emulators`). These are long-running and the user owns the iteration loop (per AGENTS.md "Never start dev servers").

If any of these tripwires fire, escalate.

## Step 4 — Plan branch (one branch per plan, NOT per slice)

All slices belonging to the same plan share **one branch** and **one PR** to `main`. Slices become individual commits inside that PR.

The branch name is `feat/<plan-slug>`, where `<plan-slug>` comes from the slice's `plan:` frontmatter (which matches its `implementation-queue/<plan-slug>/` directory). No `<slice-slug>` in the branch name.

Determine whether the branch already exists:

```
git fetch origin main
git fetch origin "feat/<plan-slug>" 2>/dev/null || true
```

- **Branch exists** (locally or on `origin`):
  ```
  git switch feat/<plan-slug>
  git pull --ff-only origin feat/<plan-slug> 2>/dev/null || true
  ```
  Verify the branch is descended from `origin/main`. If `git merge-base --is-ancestor origin/main feat/<plan-slug>` is false, the branch has diverged unexpectedly — **escalate** (Step 7).

- **Branch does NOT exist** (this is the first slice of the plan):
  ```
  git switch -c feat/<plan-slug> origin/main
  ```

If you find an existing branch with the same name but pointing somewhere unexpected (e.g. a stale local branch you can't fast-forward), escalate. Do NOT force-update or reset.

## Step 5 — Implement using `/superpowers:test-driven-development` (or `/fix-bug` for bug slices)

Follow the skill exactly:
- One test at a time (RED → GREEN → next).
- No horizontal slicing.
- Refactor only while GREEN.
- Tests assert on observable behavior through public interfaces.
- No mocks for in-process collaborators.
- The harness comes from the slice's `feedback_loop` or, if absent, defaults to `pnpm test` (vitest in `packages/shared`).

You may modify only files matching `allowed_paths`. If you discover mid-implementation that the slice needs a forbidden path → escalate (Step 7).

## Step 6 — Feedback loops before commit

Run, in order, every command in the slice's `feedback_loop`. If absent, run at minimum:

```
pnpm test
pnpm --filter @cultuvilla/shared build
```

Slices that touch UI in `apps/mobile/` should also run `pnpm app:test` and `pnpm app:typecheck` (but NOT `expo start` or any dev server).

If anything is red:
- First failure: fix and rerun.
- Second consecutive failure on the same slice (across iterations): **escalate** (Step 7).
- Never bypass hooks. Never `--no-verify`. Never amend.

## Step 7 — Escalation

When you cannot complete the slice safely (forbidden-path needed, repeated red, ambiguity not resolved by the slice notes, branch divergence, push rejection), do this and stop:

1. Append to the slice file under a `## Iteration notes` heading:
   - Iteration date (today)
   - What you tried
   - Why you stopped (forbidden path, repeated failure, ambiguity, branch divergence, push rejection)
   - Recommendation: keep as HITL, split further, or update PRD
2. Change the frontmatter `type:` from `AFK` to `HITL` (only when the escalation is "this can't be AFK" — for transient failures like a flaky test or a network blip, don't flip the type, just note the iteration and stop).
3. Commit the slice-file edit:
   - **If you had already created/switched to the plan branch:** commit on the plan branch. The chore commit lands in the same PR. This is fine — reviewers see the trace.
   - **If you had NOT yet created the plan branch (escalation happened in Step 3/4 before any implementation):** commit on `main` (no branch) with the same chore message. Note: cultuvilla allows direct-to-main per user preference; the chore commit is a metadata edit and lands cleanly.
   Use message:
   ```
   chore(ralph): escalate <slice-id> to HITL — <one-line reason>
   ```
   Only the slice file is touched. Body has the iteration note.
4. **Do NOT push and do NOT open a PR** as a result of escalation (if you're already on a plan branch with a PR from earlier successful slices, leave that PR alone — don't update it for an escalation).
5. Output the final report with `Status: ESCALATED` and stop.

## Step 8 — Commit the slice work

Once GREEN:

```
git add <only files within allowed_paths>
git commit -m "<conventional-commit subject>"
```

Commit message:
- Subject: `feat(<scope>): <one-line>` / `fix(<scope>): <one-line>` / `refactor(<scope>): <one-line>`. Use conventional commit per AGENTS.md (header ≤ 100 chars, enforced by commitlint).
- Body covers:
  - Slice ID being implemented (e.g. `Slice: 001-feed-trigger`)
  - Key decisions made (especially anything non-obvious)
  - Blockers or notes for the next iteration (empty if none)
- Hooks must pass. No `--no-verify`. No amend.

## Step 9 — Move the slice to done

```
mkdir -p implementation-queue/<plan-slug>/done
git mv implementation-queue/<plan-slug>/<slice-file>.md implementation-queue/<plan-slug>/done/<slice-file>.md
```

Commit that move separately with `chore(ralph): mark <slice-id> done`.

If the slice is **partially complete** (e.g. you hit budget_iterations but progress was real), do NOT move to `done/`. Append iteration notes to the slice and commit your partial progress on the branch. Next iteration of Ralph will continue. Skip Steps 10 and 11 for a partial slice — don't push or touch the PR until you actually complete a slice.

## Step 10 — Push to origin

```
git push -u origin feat/<plan-slug>
```

If push is rejected because the remote branch has commits you don't have locally (someone else — you, or a parallel Ralph in another worktree — pushed), **escalate**. Do NOT force-push. Do NOT rebase.

If push fails because of hooks or a network error, retry once. If it still fails, escalate.

## Step 11 — Open or update the PR to `main`

Check whether a PR for this branch already exists:

```
gh pr list --head feat/<plan-slug> --base main --state open --json number,url
```

### Branch has NO open PR yet

This is the first slice of the plan that reached push. Create the PR:

```
gh pr create \
  --base main \
  --head feat/<plan-slug> \
  --title "feat(<plan-slug>): <PRD title>" \
  --body "<see body template below>"
```

Read the PRD path from `implementation-queue/<plan-slug>/000-prd-link.md` to get the PRD title; if that file or that title is unclear, fall back to the plan-slug humanized.

**PR is opened in regular (non-draft) state.** It is the user's call to merge — Ralph never merges.

### Branch already has an open PR

Update the body to reflect current state (do NOT change the title):

```
gh pr edit <pr-number> --body "<updated body template>"
```

### PR body template

```markdown
## Plan
[<PRD title>](<path to PRD file>)

This PR collects all implementation slices for the `<plan-slug>` plan.

## Progress

| Slice | Status | Type |
|---|---|---|
| 001-foo | ✅ done | AFK |
| 002-bar | ⏳ pending | HITL |
| 003-baz | ⏳ pending | AFK |
| 004-zzz | ⏳ pending | AFK (blocked by 003) |

(Generate this table by listing every slice file under `implementation-queue/<plan-slug>/` and its `done/` subdirectory. Status: ✅ done if in `done/`, ⏳ pending otherwise. Type from the slice frontmatter.)

## Slices completed in this PR
- 001-foo — <slice title from H1>
- 003-baz — <slice title from H1>

## Slices still pending
- 002-bar (HITL — needs human implementation, same branch)
- 004-zzz (AFK — blocked by 003, picked up by next Ralph iteration)

## Notes
- Generated by Ralph autopilot. Last update: <timestamp>.
- PR is not ready to merge while any slice (AFK or HITL) is pending.
```

If all slices for the plan are in `done/` (no `[0-9]*.md` files left outside `done/`), add a `## Ready` line at the top of the body:

```
## Ready
All slices completed. Ready for review.
```

Do NOT auto-merge, do NOT mark as auto-merge, do NOT add `Closes #N` references unless the slice notes explicitly include the issue number.

## Step 12 — Final report

Output a short final report (visible to the human reviewing logs):
- Slice picked
- Plan branch used / created
- Files changed (count)
- Tests run + result
- PR action: created (#N URL) / updated (#N URL) / none (partial slice, no push)
- Status: COMPLETED / PARTIAL / ESCALATED
- Plan state: how many slices remain (AFK / HITL / blocked)
- Any blockers or follow-up notes

## Final rules

- **One slice per invocation.** Never start a second slice in the same run.
- **One plan = one branch = one PR.** All slices in a plan share `feat/<plan-slug>`. Slice 2 does NOT branch off slice 1's branch — it commits on top of the same branch.
- **Push only to the plan branch (`feat/<plan-slug>`) on `origin`.** Never push to `main`. Never force-push anywhere. (Cultuvilla allows direct-to-main for the user; Ralph does not — autonomous work always goes through a PR for review.)
- **Never merge anything.** Not your own PRs, not anyone's. PRs are opened in regular (non-draft) state; merging is the human's call.
- **Never delete a slice file.** Move to `done/` or leave with iteration notes.
- **Never modify** `AGENTS.md`, `CHANGELOG.md`, `app.config.ts`, `app.json`, `eas.json`, `firestore.rules`, `firestore.indexes.json`, `functions/**`, `.github/workflows/**` — even if a slice's `allowed_paths` accidentally would let you.
- **Never start dev servers or emulators.** Per AGENTS.md: `pnpm web:dev`, `expo start`, `firebase emulators:start`, `pnpm test:integration|rules|functions|emulators` are all forbidden.
- **Never rebase or amend.** If a branch diverges or a push is rejected, escalate.
- **When stopping for any reason other than completion**, leave a paper trail in the slice file. The next iteration of you needs to understand what happened.
