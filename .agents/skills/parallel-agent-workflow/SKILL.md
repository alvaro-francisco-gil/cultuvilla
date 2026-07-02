---
name: parallel-agent-workflow
description: STUB — inactive until `apps/mobile/` exists and per-slot Metro/emulator infrastructure is wired up. Future skill for parallel agents running Metro, Firebase emulators, and Android emulators concurrently inside `.claude/worktrees/`. The current cultuvilla worktree workflow (web + backend tasks only, no Metro, no AVD) does NOT need this skill.
---

# Parallel agent workflow

> **STATUS: STUB.** Cultuvilla's current parallel-agent setup is worktrees-only — no per-slot Metro, no isolated Firebase emulators, no Android emulator orchestration. The repo's existing `.claude/worktrees/` workflow (documented in [AGENTS.md](../../../AGENTS.md) "Development workflow" step 1) is sufficient for web + backend work. This skill activates when the mobile app lands and per-slot infrastructure is built.

## When this will apply (once mobile + per-slot infra land)

When an agent works inside `.claude/worktrees/<branch>/` AND needs to start long-running services (Metro, Firebase emulators, Android emulator) without colliding with the user's main checkout or other parallel agents.

## Pipeline shape (template — fill in once infra exists)

```
cd into worktree
pnpm agent:slot-up . [--with-device]    ← env + Metro + emulators (+ device)
# … make code changes, tests, open commit …
# (user runs `pnpm agent:slot-down <N> [--with-worktree] [--with-avd]` after review)
```

## TODO — fill in before activating

- [ ] Decide on a port-slot scheme — typically: slot N gets `5000 + N*100` for emulators, `8081 + N*10` for Metro, etc.
- [ ] Add `scripts/agent-env.sh` (or equivalent) that exports `$CULTUVILLA_AGENT_SLOT`, port env vars, and a tmux session name.
- [ ] Add a `firebase.agent.json` config that swaps emulator ports per slot.
- [ ] Add `pnpm agent:slot-up` / `pnpm agent:slot-down` / `pnpm agent:status` scripts.
- [ ] Document the tmux session naming convention: `cultuvilla-slot-<N>` with `metro`, `emulators`, `device` windows.
- [ ] (Mobile-specific) Add Android emulator orchestration: AVD cloning, port forwarding for WSL → Windows host if relevant, RAM-budget guard.
- [ ] Document the "decide: device or no device?" decision table — backend-only tasks skip the device.
- [ ] Document the review-handoff block to paste in commit/PR bodies.
- [ ] Remove the **STUB STATUS** banner.

## Hard rules (template — adapt to cultuvilla)

Once active, the rules should mirror ordago's:

1. **Source `scripts/agent-env.sh` first.** Confirm slot variable is non-zero.
2. **Use `firebase.agent.json` for emulators.** Never the default `firebase.json` from a worktree.
3. **Run services inside the slot's tmux session.**
4. **In the commit body, include the review-handoff block.**
5. **Do NOT tear down yourself** — leaves state alive for user review. User runs `pnpm agent:slot-down`.

## When this skill applies

When `apps/mobile/` exists, per-slot scripts are in place, and the agent needs to run Metro or emulators in parallel. For web + backend work, the current worktree workflow is sufficient — do NOT invoke this skill.

## Reference

Template adapted from `ordago-apps/.claude/skills/parallel-agent-workflow/SKILL.md`. The ordago version is mature; cultuvilla's variant will need port slot numbers, RAM budgets, and tmux session names tuned to this machine.
