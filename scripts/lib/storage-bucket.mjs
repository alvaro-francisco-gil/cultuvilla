/**
 * Resolves the default Cloud Storage bucket for a Firebase project.
 *
 * `initAdminForEnv` initialises the app without a `storageBucket`, and the
 * bucket's name is not derivable from the project id alone: projects created
 * before ~2024 default to `{projectId}.appspot.com`, newer ones to
 * `{projectId}.firebasestorage.app`. Probe rather than guess — a wrong guess
 * surfaces as a confusing "bucket does not exist" halfway through a migration.
 */
export async function resolveDefaultBucket(admin, projectId) {
  const candidates = [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`];
  for (const name of candidates) {
    const bucket = admin.storage().bucket(name);
    const [exists] = await bucket.exists();
    if (exists) return bucket;
  }
  throw new Error(
    `No default storage bucket found for ${projectId} (tried ${candidates.join(', ')})`,
  );
}
