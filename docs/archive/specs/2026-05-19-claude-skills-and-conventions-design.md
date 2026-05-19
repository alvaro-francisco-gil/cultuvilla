---
status: draft
type: spec
---

# Claude skills + AGENTS.md conventions for cultuvilla

**Date:** 2026-05-19
**Author:** Alvaro (with Claude)

Port the agent-facing conventions and procedural skills from `ordago-apps` to `cultuvilla`, adapted to a Next.js web app with a Firebase backend, a shared TypeScript package, and a Cloud Functions workspace. Forward-stub the mobile-specific skills so they're ready when `apps/mobile/` lands.

## Problem

Cultuvilla's [AGENTS.md](../../../AGENTS.md) already encodes the major architectural invariants (service-layer ownership, models in `packages/shared/src/models/`, data nested under `villages/{villageId}/`, denormalized read models, strict TS, structured Cloud Functions logging). What's missing is **procedural memory** — the step-by-step "how do I do X without breaking the rules" knowledge that `ordago-apps/.claude/skills/` has accumulated over months.

Without these skills, every Claude Code session re-derives the same procedures from scratch:

- "How do I safely deploy Firestore rules to dev (and refuse beta/prod)?"
- "I'm adding a new sub-collection — which files do I need to touch in the same change?"
- "This write touches another user's document — does it belong in a callable?"
- "Where does this design doc go? `docs/plans/`? `docs/superpowers/`? `docs/archive/`?"
- "I need to log from a Cloud Function — why does `console.log` fail the build?"

Skills encode the answer once, with the project-specific details baked in.

## Scope

In: write 13 skills under `.claude/skills/<name>/SKILL.md`, plus 5 targeted additions to `AGENTS.md`. Each skill is a single `SKILL.md` file with YAML frontmatter (`name`, `description`) and a procedure body. Skills are not loaded eagerly; they activate when their description matches the task.

Out:
- Rewriting AGENTS.md (it's already strong — only targeted additions).
- Creating sub-directory AGENTS.md files (`functions/AGENTS.md`, etc.) — mentioned as a pattern, deferred until those directories grow conventions worth splitting.
- A web-equivalent of `prepare-release` — different release cadence (Vercel + Firebase, no Expo/EAS); revisit when the release flow is formalized.
- The mobile app itself — these skills are scaffolding for the future, not the app.

## Skills

### A. Six adapted from `ordago-apps`

Each is a port: same procedure shape, examples swapped to cultuvilla's domain (villages, events, persons, organizations), commands swapped to cultuvilla's `pnpm` scripts.

#### 1. `guardrail-enforcement`

**The headline skill** — answers "where should this business-rule guardrail live?" with a three-layer model:

1. **UI** — UX only, trivially bypassed.
2. **Shared service** — consistency between clients, NOT a trust boundary (runs in the browser).
3. **Server (Firestore rules + Cloud Function callables)** — the only trust boundary.

Encodes the decision table from ordago (which gates go to rules vs. callables vs. service) and the **admin-callable recipe**: lock down direct writes in rules → callable derives identity from `context.auth.uid` (never trust client-supplied IDs) → shared service calls the callable → layer-2 mirror in the service for friendly errors.

Adaptations for cultuvilla:

- Examples swap from `casual_matches` / `tournaments` to `villages/{villageId}/events`, `villages/{villageId}/persons`, `villages/{villageId}/orgMembers`, etc.
- Cross-user examples: organization admin approving a member, an event organizer inviting personas across users, occupation proposal approvals (already a callable: `functions/src/onOccupationProposalApproved.ts`).
- Trust-sensitive examples: village admin role grants, organization approval state.

#### 2. `guardrail-audit`

Companion to `guardrail-enforcement`. Procedure for **sweeping a feature area** (or a PR) for UI-only gates that aren't re-validated server-side. Three passes:

- Pass 1: grep UI for `disabled=`, `canX`, `isOwner`, status guards.
- Pass 2: verify each gate also runs in the matching service + rule + callable.
- Pass 3: triage into `GAP` / `RULE-BACKED` / `DEAD` / `TO VERIFY`, with HIGH/MED/LOW severity for gaps.

Adaptations:

- Sensitive collections become `villages/`, `events/`, `persons/`, `orgMembers/`, `organizations/`, `invites/`.
- "Red flag" patterns updated for cultuvilla's actual function signatures.

#### 3. `touch-service`

Procedure for adding/changing/removing exports in [packages/shared/src/services/](../../../packages/shared/src/services/). Encodes:

- Grep all call sites before changing.
- Read [`_services-map.md`](../../../packages/shared/src/services/_services-map.md) first.
- **Models first** — input/return shapes come from `packages/shared/src/models/`. Don't widen a service signature with an inline shape.
- Stay in domain — match → `eventService`; person → `personService`; etc.
- **No silent fallbacks.** Throw or return `null` intentionally.
- Strict types on every export.
- Update `_services-map.md` in the same change for new cross-service interactions.
- Vitest under `packages/shared/test/services/<service>.test.ts`.

Adaptations:

- `_services-map.md` already exists at the cultuvilla path — link directly.
- Test paths use cultuvilla's vitest setup (no jest, no Maestro).

#### 4. `firestore-deploy`

Safe deploy with hard refusals for beta/prod. Cultuvilla has three Firebase projects:

| Profile | Project ID | Script alias |
|---|---|---|
| dev | `villa-events` | `pnpm deploy:*:dev` |
| beta | `cultuvilla-beta` | `pnpm deploy:*:beta` |
| prod | `cultuvilla-prod` | `pnpm deploy:*:prod` |

The skill:

- Defaults to dev. Refuses `:beta`, `:prod`, and `deploy:all:*` unless the user explicitly insists.
- Confirms active alias via `firebase use` before deploy.
- Shows `git diff` of the file(s) being deployed so unrelated changes don't ship silently.
- Routes intent → narrowest script:
  - rules → `pnpm deploy:rules:dev`
  - indexes → `pnpm deploy:indexes:dev`
  - both → `pnpm deploy:firestore:dev`
  - functions → `pnpm deploy:functions:dev`
- Post-deploy notes: indexes build async, rules propagate in ~60s, functions cold-start.

#### 5. `fix-bug`

Red/green discipline. The regression test is written **before** the fix and ships in the same commit.

Adaptations — slim ordago's harness table to cultuvilla's only:

| Bug surface | Test home | Library | Command |
|---|---|---|---|
| Service / model / utils | `packages/shared/test/<area>/<name>.test.ts` | vitest | `pnpm shared:test` |
| Firestore rule | `packages/shared/test/e2e/<name>Rules.test.ts` | `@firebase/rules-unit-testing` | `pnpm test:rules` |
| Service ↔ Firestore (integration) | `packages/shared/test/integration/<name>.test.ts` | vitest + emulator harness | `pnpm test:integration` |
| Cloud Function (callable / trigger) | `functions/__tests__/<name>.test.ts` | vitest + emulator | `pnpm test:functions` |
| Web component / page / hook | `apps/web/<area>/__tests__/<Name>.test.tsx` | _(deferred — no jest/RTL config yet)_ | TODO |

Until web test config lands, the web row is `TODO` — for now, web-only bugs document a manual repro in the PR.

Routes to companion skills: `touch-service`, `guardrail-enforcement`, `firestore-deploy`, `cloud-function-logging`.

#### 6. `manage-plan-docs`

Lifecycle for design docs and plans:

```
docs/
├── superpowers/       drafts (this is where new content starts)
│   ├── plans/
│   └── specs/
├── plans/             canonical: active + backlog + blocked + reference
├── architecture/      reference docs (already exists, kept)
└── archive/           terminal (work shipped or killed)
    ├── plans/
    ├── specs/
    └── audits/
```

Status taxonomy + filename convention (date prefix in drafts, slug-only when promoted to canonical, preserve on archive). Cultuvilla already uses `docs/superpowers/specs/` and `docs/architecture/` — the skill formalizes the rest.

### B. Four new skills (cultuvilla-specific patterns)

These encode patterns that exist only in cultuvilla — no ordago analog.

#### 7. `denormalized-read-model`

The pattern in [docs/architecture/denormalized-read-models.md](../../architecture/denormalized-read-models.md) and [functions/src/syncVillageDenormalization.ts](../../../functions/src/syncVillageDenormalization.ts). Adding or extending a denorm field, step by step:

1. Identify the source-of-truth doc and the consumers that need fan-out reads.
2. Define the read-model shape under `packages/shared/src/models/`.
3. Add a Cloud Function trigger to keep the read model in sync.
4. Update the relevant rules so clients can read the denorm but cannot write it directly.
5. Write a backfill script under `scripts/` for existing data.
6. Add an integration test that mutates the source and asserts the read model updates.
7. Update [docs/architecture/denormalized-read-models.md](../../architecture/denormalized-read-models.md) with the new field.

#### 8. `add-firestore-collection`

Adding a new sub-collection under `villages/{villageId}/` is a multi-file change that's easy to do incompletely. The skill enforces the full set in one commit:

1. Model in `packages/shared/src/models/<entity>.ts`.
2. Service in `packages/shared/src/services/<entity>Service.ts` (banner-style, strict types, no silent fallbacks).
3. Re-export from `packages/shared/src/services/index.ts`.
4. Update [`_services-map.md`](../../../packages/shared/src/services/_services-map.md) in the same change.
5. Rules block in [firestore.rules](../../../firestore.rules) — `villages/{villageId}/<collection>/{docId}`.
6. **Collection-group index in [firestore.indexes.json](../../../firestore.indexes.json) in the same change** (AGENTS.md rule §3).
7. Vitest for the service.
8. Rules test in `packages/shared/test/e2e/` (e.g. `<collection>Rules.test.ts`) covering happy path + at least one rejected write.

#### 9. `cloud-function-logging`

Encodes the `console.*` → `logger.info(msg, { handler, ...fields })` rule from AGENTS.md. Why:

- `console.log("foo " + bar)` produces an unstructured `textPayload` that Cloud Logging filters and dashboards can't query.
- v2 logger's second arg becomes searchable `jsonPayload` fields.
- Always include a `handler` field so log explorer can filter by function.
- Use `logger.warn` for recoverable anomalies, `logger.error` only when the function bails out unsuccessfully.

Enforced by [functions/src/__tests__/helpers/no-console.test.ts](../../../functions/src/__tests__/helpers/no-console.test.ts) — `console.*` calls outside `__tests__/` fail the build. The skill cross-references this enforcement so agents understand the test failure when they hit it.

#### 10. `i18n-add-string`

Adding a user-facing string in the web app:

1. Pick a key namespace under [apps/web/i18n/messages/](../../../apps/web/i18n/messages/) — group by feature area, not by component.
2. Add the string to `es.json` (default locale).
3. Use `useTranslations('namespace')` and render the key with `t('key')`.
4. Don't hardcode Spanish in component source — except in admin/debug surfaces (the AGENTS.md carve-out).
5. If parameterized, use `next-intl` ICU syntax.

The skill includes the "is this surface user-facing or admin/debug?" decision flag.

### C. Three future-stubs (mobile app)

When `apps/mobile/` lands (planned but not built yet), these skills activate. Until then, they exist as **stubs with explicit `TODO` blocks** so future-Claude knows where to start instead of re-deriving from ordago.

#### 11. `expo-native-rebuild` (stub)

Frontmatter sets the description so it does NOT activate today (no `app.config.js`, no `apps/mobile/`). Body is the ordago procedure inline with a `TODO` block listing what needs filling in once the app exists:

- Path to `app.config.js`.
- Local Expo plugins under `apps/mobile/plugins/`.
- Build profile env var name and dev-client suffix.
- Expected Gradle/Pods injections to verify.

#### 12. `parallel-agent-workflow` (stub)

Same shape: ordago's procedure inline as a template, plus a `TODO` block for cultuvilla-specific port slots, tmux session names, AVD source image, RAM budget on the actual dev machine, and the per-slot `firebase.agent.json` config.

Note: cultuvilla **already uses worktrees** ([.claude/worktrees/](../../../.claude/worktrees/)), but without Metro/emulator orchestration. The stub clarifies that the current worktree workflow is enough for web/backend tasks; this skill activates only when running Metro or Android emulators in parallel.

#### 13. `gcloud-cultuvilla` (partial — applicable today + TODO sections)

Splits into two parts:

**Active today** (applicable now, since the projects exist):

- gcloud account + named gcloud configuration.
- Project map: `villa-events` (dev, active) / `cultuvilla-beta` / `cultuvilla-prod`.
- **Dev-default, beta/prod explicit `--project=` on every command** — defensive even against own shell history.
- Cloud Logging access pattern for the deployed functions.

**TODO sections** (write when introduced):

- Secret Manager (no secrets in cultuvilla yet).
- Observability salt rotation (no observability event pipeline yet).
- IAM grants for service accounts (not relevant pre-mobile).

## AGENTS.md additions

Five targeted insertions. Each is small, low-risk, and aligned with how ordago's AGENTS.md evolved. Not a rewrite.

1. **"Never start dev servers"** — explicit list: `pnpm web:dev`, `pnpm test:integration`, `pnpm test:rules`, `pnpm test:functions`, `firebase emulators:start`. The user runs these; agents don't. Same reason as ordago: the user owns the iteration loop.

2. **"No retrocompat shims unless asked"** — when changing a data shape, surface the migration. Don't leave dual-read code or shim re-exports without explicit user direction. Pairs with the existing "Delete > deprecate" rule.

3. **"Be proactive"** — one-line suggestion at the end of responses when you notice:
   - Repeated manual ops → script in `scripts/`.
   - Encodable workflow → skill under `.claude/skills/`.
   - Convention in 3+ places → addition to AGENTS.md (root or sub-directory).
   - Single-source-of-truth violations → consolidate.
   - Docs contradicting code → fix or delete.
   - Service touched without tests → propose adding coverage.

4. **Sub-directory `AGENTS.md` pattern** — note (not a commitment): when `functions/`, `packages/shared/`, or `apps/web/` accumulate conventions that don't apply to the rest of the repo, drop a local `AGENTS.md` so agents working there don't load the whole root file.

5. **Cross-references to the new skills** — in the relevant Architecture-invariants sub-sections, link to the skill that encodes the procedure:
   - §1 Service-layer ownership → `touch-service`
   - §3 Data nested under `villages/{villageId}/` → `add-firestore-collection`
   - §4 Denormalized read models → `denormalized-read-model`
   - Cloud Functions logging → `cloud-function-logging`
   - Cross-user writes paragraph (under §1 or new §6 "Backend boundaries") → `guardrail-enforcement`

## File layout

```
.claude/
└── skills/
    ├── guardrail-enforcement/SKILL.md
    ├── guardrail-audit/SKILL.md
    ├── touch-service/SKILL.md
    ├── firestore-deploy/SKILL.md
    ├── fix-bug/SKILL.md
    ├── manage-plan-docs/SKILL.md
    ├── denormalized-read-model/SKILL.md
    ├── add-firestore-collection/SKILL.md
    ├── cloud-function-logging/SKILL.md
    ├── i18n-add-string/SKILL.md
    ├── expo-native-rebuild/SKILL.md       (stub)
    ├── parallel-agent-workflow/SKILL.md   (stub)
    └── gcloud-cultuvilla/SKILL.md          (partial)

AGENTS.md                                   (5 targeted additions)
docs/superpowers/specs/2026-05-19-claude-skills-and-conventions-design.md
                                            (this file — will be promoted on completion)
```

## Implementation order

The order matters — write the skills that encode load-bearing rules first (so future sessions benefit immediately), AGENTS.md tweaks before the cross-references they introduce, stubs last.

1. AGENTS.md additions (5 small insertions).
2. New cultuvilla-specific skills first (they encode patterns that exist only here):
   - `cloud-function-logging` (smallest, validates the format)
   - `add-firestore-collection`
   - `denormalized-read-model`
   - `i18n-add-string`
3. Adapted ordago skills (heaviest content lift):
   - `guardrail-enforcement` (the user's headline ask)
   - `guardrail-audit`
   - `touch-service`
   - `firestore-deploy`
   - `fix-bug`
   - `manage-plan-docs`
4. Forward-stubs:
   - `gcloud-cultuvilla` (partial — applicable + TODO)
   - `expo-native-rebuild` (stub)
   - `parallel-agent-workflow` (stub)

Each skill is its own commit, conventional-commit prefix `docs(skills): add <name> skill`. AGENTS.md additions go in one commit: `docs(agents): cross-link skills and add proactive-suggestion rule`.

## Validation

Each adapted/new skill is validated against three checks:

- **The procedure runs end-to-end on a real file.** For `add-firestore-collection`, walk through the steps against a hypothetical collection and verify every file path and command resolves. Same for `denormalized-read-model` against the existing `syncVillageDenormalization.ts`.
- **The frontmatter description triggers on realistic prompts.** "deploy firestore rules", "scan eventService for missing checks", "add a new sub-collection under villages" — the descriptions are written so the Skill tool surfaces them.
- **No stale paths.** Every file path in a skill is checked against the current repo state at write time.

Stubs are validated only for the TODO block (it lists every variable the future skill needs filled in).

## Risks and trade-offs

- **Skills can rot.** Paths change, scripts get renamed, conventions evolve. Same risk as docs — mitigated by keeping skills slim, cross-linking AGENTS.md as the source of rules, and pointing to live files instead of duplicating their content.
- **Over-skilling early.** 13 skills is a lot to add at once. Mitigated by: 6 are direct ports (low friction), 3 are stubs (very low friction), 4 are new but small and bounded.
- **The mobile-app stubs may need rewriting.** When `apps/mobile/` lands, port slots / emulator config / build profiles will be different from ordago's. The stubs make the rewriting cheaper, not free.

## Out of scope (deferred)

- A web-side `prepare-release` skill (revisit when release flow is formalized — likely tied to Vercel previews + CHANGELOG conventions).
- Sub-directory `AGENTS.md` files. Pattern mentioned in root AGENTS.md; actual files added only when a directory's conventions diverge enough to warrant a split.
- Auto-discovery of skills (no plugin system; relies on Claude Code's built-in `.claude/skills/` loader).
- A `gcloud-cultuvilla` Secret Manager section (added when secrets land — likely with the mobile app or with first-party observability).
