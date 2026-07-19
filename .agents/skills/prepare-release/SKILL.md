---
name: prepare-release
description: Procedure for cutting a new beta/production release of the Cultuvilla mobile app. Bumps `apps/mobile/app.config.ts` `version` (+ mirrors `apps/mobile/package.json`), stamps the `[Unreleased]` CHANGELOG section into a dated `## vX.Y.Z` heading, and reminds you to update `config/appVersion.latest`. Never commits, tags, or pushes — hands the diff to the user. Use whenever the user says "cut a beta", "prepare release", "bump the version for beta", or wants the next version's CHANGELOG entry.
---

# Prepare a release

The version is set on the `develop → beta` promotion (beta = release candidate) and rides unchanged into `main`. This skill does the version bump + CHANGELOG stamp on `develop` (or in a worktree) so it's ready for that promotion PR. It STOPS before committing — the version is a product call.

Read the **"Versioning & releases"** section of `AGENTS.md` first; it is the source of truth for the policy this skill executes.

## 1. Ground yourself

- `git tag | tail -10` — recent version tags (tags live on `main` merges).
- `git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --oneline` — commits since the last tag.
- `git diff $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --stat` — what areas changed.
- Read `apps/mobile/app.config.ts` → current `version`.
- Read the top ~30 lines of `CHANGELOG.md` (its `[Unreleased]` section is what you'll stamp).

## 2. Decide the version

**Pre-release (now): stay on `0.x`.** Default to a **MINOR** bump each beta cut (`0.1.0 → 0.2.0`), regardless of commit types — the minor is a running counter, not strict semver, until launch. The `1.0.0` bump happens once, at the first real store release (and takes both iOS and Android to `1.x` together — that's also what lets the App Store accept it, since it rejects `0.x` marketing versions).

If the user named a version, use it. Otherwise propose the next minor and **confirm before proceeding** — the version is a product call.

## 3. Bump the version

- `apps/mobile/app.config.ts`: change **only** the top-level `version` string.
- `apps/mobile/package.json`: set `version` to the same value (it mirrors app.config.ts per AGENTS.md).

**Do NOT touch:**
- `ios.buildNumber` / `android.versionCode` — EAS owns these remotely (`appVersionSource: "remote"` in `eas.json`).
- Root `package.json` `version` — not a release artifact.

## 4. Stamp the CHANGELOG

`CHANGELOG.md` uses dated sections. Promote the existing `## [Unreleased]` block into a released, versioned heading and open a fresh empty `[Unreleased]`:

```markdown
## [Unreleased]

## vX.Y.Z — YYYY-MM-DD

### Added
- …(whatever was under [Unreleased])

### Changed
- …
```

Keep the entries that were already accumulated under `[Unreleased]`; just move them under the new `vX.Y.Z` heading and re-open an empty `[Unreleased]` above it. Do not invent entries — if `[Unreleased]` is empty, say so and ask the user what the release note should be.

> Store release notes (Play/App Store "what's new") are **not needed pre-release**. When the app is actually submitted, add a machine-extractable, ≤500-char es-ES store-notes block here and wire an extractor — track that as its own task; it's out of scope while unreleased.

## 5. Keep the gate's `latest` in step

The force-update gate reads `config/appVersion.latest`. After bumping to `vX.Y.Z`, update the target env's doc so `latest` matches (min stays `0.0.0` pre-release):

```bash
# dev (autonomous):
node scripts/seed-app-version-config.mjs --env=dev --latest=X.Y.Z
# beta/prod (explicit, needs that project's credentials):
node scripts/seed-app-version-config.mjs --env=beta --latest=X.Y.Z --confirm
```

Pre-release this is optional (an out-of-date `latest` only means no "update available" nudge — the gate still fails open). Do it when you want the nudge to reflect the new build.

## 6. STOP

Do **not** commit, tag, or push. Print a summary:
- New version
- CHANGELOG heading line
- Files touched

Hand control to the user. When they commit, the message is the **bare version string** — commitlint has an `ignores` rule (`commitlint.config.cjs`) that exempts exactly a `X.Y.Z` header:

```bash
git add apps/mobile/app.config.ts apps/mobile/package.json CHANGELOG.md
git commit -m "X.Y.Z"
```

The version rides `develop → beta → main` via the normal promotion PRs. **Tag `vX.Y.Z` on the `main` merge commit** (per AGENTS.md) — not here.
