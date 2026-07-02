---
name: cloud-function-logging
description: Use whenever adding or modifying log statements in `functions/src/**` — encodes the `console.* -> logger.info(msg, { handler, ...fields })` rule from AGENTS.md, the `handler` convention, severity levels, and why the no-console test fails the build when this rule is violated.
---

# Cloud Function logging

Cloud Functions write to Cloud Logging. **Never use `console.*` in `functions/src/`** — `console.log("foo " + bar)` produces an unstructured `textPayload` that Cloud Logging filters and dashboards can't query. Use the v2 logger from `firebase-functions/v2` with a structured second argument.

## The shape

```ts
import { logger } from 'firebase-functions/v2';

logger.info('Migrated persons', {
  handler: 'onOccupationProposalApproved',
  proposalId,
  pendingOccupation: name,
  migratedCount: snap.size,
});
```

The second argument becomes searchable `jsonPayload` fields in Cloud Logging. Cluster-wide filters work off these — `jsonPayload.handler="onOccupationProposalApproved"` is how you find every invocation in the log explorer.

## Required field: `handler`

Every log call inside a Cloud Function MUST include `handler` in the structured second arg, set to the function name. Without it, filters in the log explorer can't isolate one Cloud Function from another.

Helper handlers that aren't exported as their own Cloud Function still set `handler` to the **caller** they were invoked from (or the most-specific scope an operator would search for). When in doubt, set `handler` to the file's exported function name.

## Severity levels

- **`logger.info`** — the function did something noteworthy that succeeded. Default.
- **`logger.warn`** — recoverable anomaly. The function continued but skipped or worked around something. Example: "registration was already cancelled, skipped notification fan-out."
- **`logger.error`** — the function bailed out unsuccessfully. Use this only when the caller will see an error or the operation did not complete. Don't `logger.error` and then continue — that signal becomes meaningless.
- **`logger.debug`** — verbose detail for development. Off by default in production.

## Enforcement

`functions/src/__tests__/helpers/no-console.test.ts` greps for `console.*` calls under `functions/src/` (excluding `__tests__/`). Any match fails the test. If you add a `console.log` for one-shot debugging and `pnpm test:functions` fails with "console call found", that's the test telling you to swap it for `logger.*` before committing.

The test does NOT scrub log calls for the `handler` field — the convention is enforced by reviewer + this skill, not by the test runner.

## Common mistakes

- **String concatenation in the message.** `logger.info('user ' + uid + ' joined')` defeats the point — `uid` should be a field, not part of the message. Write `logger.info('User joined village', { handler, uid, villageId })`.
- **`JSON.stringify` in the message.** Same issue — dump the object as a field, not as a string.
- **Missing `handler`.** The log lands in Cloud Logging but you can't filter by function. Always include it.
- **Logging an error object directly as the message.** `logger.error(err)` works but loses context. Prefer `logger.error('createEvent failed', { handler, err: err.message, stack: err.stack, eventId })`.
- **Logging PII at `info` or above.** Phone numbers, emails, full names: log the IDs, not the values. If you need the value for debugging, use `logger.debug` and ensure the function isn't in production at the time.

## When this skill applies

- Adding a new Cloud Function under `functions/src/`.
- Modifying log statements in an existing Cloud Function.
- A `pnpm test:functions` failure mentioning `no-console.test.ts`.
- Reviewing logs in Cloud Logging and finding that filters don't pick up what you expected.

## Don't

- Don't disable the no-console test to ship a debug log. If you genuinely need temporary observability, use `logger.debug` and remove it before merging.
- Don't add a separate logging wrapper "for convenience." The v2 logger is the convention; wrappers diverge and obscure the field structure.
