# Village people directory

**Goal:** Show every persona linked to a municipality in the village roster, ordered alphabetically, without granting non-account personas membership authority.

## Status

- **Updated:** 2026-07-22
- **Stage:** Verification
- **Branch:** cultuvilla `feat/village-people-directory`
- **Done:** Added the function-owned `municipalityPeople` directory model, service, trigger, rules/index, dev backfill, UI directory query, alphabetical count, profile navigation, and targeted mobile tests. Shared/functions/i18n/mobile typechecks, shared/functions lint, and mobile web-compat check pass.
- **Next:** Get the emulator harness to finish its first Firestore-runtime download, run the new function/rules tests, then commit/push/open the PR.
- **Blockers:** The ephemeral emulator harness terminates during the Firestore emulator JAR download without returning a test result; its tests have not yet executed.
- **Handoff:** Membership docs remain user-only and continue to own roles/census state. The directory must be deployed before running `pnpm backfill:municipality-people:dev`; then run `pnpm check:dev-conformance` before and after. The no-raw-ref check needs an escalated run because its internal read-only `git ls-files` subprocess is blocked by the sandbox.

## Design

`persons/{personId}.municipalityLinks` is the canonical, multi-village affiliation
for account holders and dependents. A new top-level
`municipalityPersonDirectory/{municipalityId}_{personId}` read model will contain
the municipality ID, person ID, display fields needed by the list, account-link
state, and a normalized alphabetical `sortName`. A Firestore trigger on person
writes will add, update, and remove entries by diffing municipality links.

The roster remains members-only to view. It will query the directory by
`municipalityId`, ordered by `sortName`, so the ordering is database-backed and
stable. Admin role management stays in a separate member-management view; it is
not meaningful for dependent personas.

## File structure

- Add the directory model, typed Firestore refs, service, Cloud Function trigger,
  rules, index, service/rule/function tests, and dev backfill script.
- Modify the village people route/list and its tests; move member-role controls out
  of this people-directory surface if needed.
- Update the service map, denormalized-read-model architecture documentation, and
  CHANGELOG.

## Tasks

### Read model

- [x] Define the directory model and typed refs/service query.
- [x] Add client read rules, index, and rules coverage.
- [x] Add the person-write trigger and function coverage.
- [x] Add an idempotent dev-only backfill script.

### Mobile roster

- [x] Render the directory query in alphabetical order.
- [x] Preserve member-only access and separate role-management behaviour.
- [x] Add Spanish message strings and UI tests.

### Verification and handoff

- [ ] Run targeted lint, typechecks, and tests.
- [ ] Run dev conformance before and after the dev backfill.
- [ ] Commit, push, open the `develop` PR, and report its CI status for review.
