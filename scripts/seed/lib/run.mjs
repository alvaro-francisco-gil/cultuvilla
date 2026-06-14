/**
 * Self-execution helper. Each seeder calls `runAsMain(import.meta.url, run)`;
 * when the file is invoked directly (not imported by `all.mjs`), it runs and
 * exits non-zero on failure.
 */

import { pathToFileURL } from 'url';

export function runAsMain(metaUrl, run) {
  const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
  if (metaUrl !== invoked) return;
  run().then(
    () => process.exit(0),
    (err) => {
      console.error('[seed] fatal:', err);
      process.exit(1);
    },
  );
}
