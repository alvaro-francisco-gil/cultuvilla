/**
 * The public web origin for a Firebase project — the single place server code
 * decides which host a URL it emits should point at.
 *
 * Prod is served on two hosts, `cultuvilla.es` and `cultuvilla-prod.web.app`.
 * Anything that leaves the server as a URL — a canonical tag, a sitemap entry,
 * a link in an email — must name the brand domain. Deriving it from the
 * request's host instead makes each host declare itself canonical, so the two
 * compete in Google's index; deriving it from `${projectId}.web.app` sends
 * email recipients to a URL nobody else ever shares.
 *
 * Keep in step with `deepLinkHostPerEnv` in apps/mobile/app.config.ts, which is
 * the client-side twin (it is evaluated on the EAS build server and cannot
 * import from this package).
 */
const CUSTOM_DOMAINS: Readonly<Record<string, string>> = {
  'cultuvilla-prod': 'cultuvilla.es',
};

export function webOriginForProject(projectId: string | undefined): string {
  const id = projectId || 'villa-events';
  return `https://${CUSTOM_DOMAINS[id] ?? `${id}.web.app`}`;
}
