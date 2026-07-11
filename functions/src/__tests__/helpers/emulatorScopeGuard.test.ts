import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The functions handler tests wrap their targets IN-PROCESS via `ft.wrap`;
// they never call a deployed function over HTTP. When the runner also boots
// the FUNCTIONS emulator, the deployed background `onDocument*` triggers fire
// asynchronously on the admin-SDK seed/cleanup writes each test makes, and
// two of them (waitlistPromotion → confirmedCount/totalCount,
// syncMemberBarrioToResidence → municipalityLinks) write the exact fields the
// handler tests assert on. With fixed doc IDs and no quiescence barrier, a
// trigger from one test lands during the next, producing spurious flakiness
// (e.g. "expected 1 to be 2"). The fix is to run the handler suite WITHOUT the
// functions emulator (`ONLY=auth,firestore,storage`). This test fails the
// build if any root script re-arms the functions emulator around that suite.

const ROOT_PACKAGE_JSON = resolve(__dirname, '../../../../package.json');
const RUNNER = 'run-tests-with-emulators.mjs';
const HANDLER_SUITE = /--prefix functions run test:(all|integration)/;

function scripts(): Record<string, string> {
  const parsed = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
}

/** `&&`-separated commands within a single npm script string. */
function commands(script: string): string[] {
  return script.split('&&').map((c) => c.trim());
}

/** The `ONLY=<csv>` env prefix on a command, or null if it relies on the default. */
function onlyList(command: string): string[] | null {
  const match = /(?:^|\s)ONLY=(\S+)/.exec(command);
  return match ? match[1].split(',').map((s) => s.trim()) : null;
}

describe('functions handler suite emulator scope', () => {
  const handlerCommands = Object.entries(scripts())
    .flatMap(([name, script]) => commands(script).map((command) => ({ name, command })))
    .filter(({ command }) => command.includes(RUNNER) && HANDLER_SUITE.test(command));

  it('has at least one root script that runs the functions handler suite (guard is live)', () => {
    // If this fails, the scripts were renamed and the guard below is now inert —
    // re-point RUNNER / HANDLER_SUITE at the new invocation.
    expect(handlerCommands.length).toBeGreaterThan(0);
  });

  it('never boots the functions emulator around the functions handler suite', () => {
    const offenders = handlerCommands.filter(({ command }) => {
      const only = onlyList(command);
      // No ONLY= override => the runner default includes `functions`.
      return only === null || only.includes('functions');
    });
    expect(offenders.map((o) => `${o.name}: ${o.command}`)).toEqual([]);
  });
});
