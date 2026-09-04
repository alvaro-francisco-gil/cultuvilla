/**
 * The three things that happen to an iOS build after `eas submit` uploads it:
 * it gets attached to a version and submitted for review, the version gets a
 * phased-release plan, and the approved version gets released.
 *
 * Every function here takes an injected `request` so the whole pipeline is
 * exercised by tests against a fake ASC. See lib/appstore.mjs for the client.
 */
import {
  classifyReleasability,
  classifyVersionState,
  isBuildReady,
  pickEditableVersion,
  PENDING_RELEASE_STATE,
} from './appstore.mjs';

/** Poll until the uploaded build finishes Apple-side processing. */
export async function waitForBuild(
  request,
  { ascAppId, buildNumber, attempts = 30, delayMs = 20000, sleep, log = () => {} },
) {
  const doSleep = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let lastState = null;
  for (let i = 0; i < attempts; i++) {
    // The top-level /builds endpoint with filter[app]; the /apps/{id}/builds
    // relationship endpoint rejects filter[version] with a 400 PARAMETER_ERROR.
    const data = await request(
      'GET',
      `/builds?filter[app]=${encodeURIComponent(ascAppId)}&filter[version]=${encodeURIComponent(buildNumber)}&limit=1`,
    );
    const status = isBuildReady(data.data, buildNumber);
    if (status.ready) return status.id;
    if (status.state !== lastState) {
      lastState = status.state;
      log(`  build ${buildNumber}: ${status.found ? status.state : 'not visible yet'}`);
    }
    if (i < attempts - 1) await doSleep(delayMs);
  }
  throw new Error(
    `waitForBuild: build ${buildNumber} for app ${ascAppId} never reached processingState=VALID ` +
      `after ${attempts} attempts (last: ${lastState ?? 'not found'}).`,
  );
}

export async function findOrCreateVersion(request, { ascAppId, versionString, releaseType }) {
  const data = await request(
    'GET',
    `/apps/${ascAppId}/appStoreVersions?filter[platform]=IOS&limit=20`,
  );
  const existing = pickEditableVersion(data.data, versionString);
  if (existing) return { id: existing.id, created: false };

  const sameVersion = (data.data || []).find(
    (v) => v?.attributes?.versionString === versionString,
  );
  if (sameVersion) {
    const verdict = classifyVersionState(sameVersion.attributes.appStoreState);
    if (verdict === 'noop') {
      return { id: sameVersion.id, created: false, alreadyInFlight: true };
    }
    throw new Error(
      `findOrCreateVersion: version ${versionString} exists in unexpected state ` +
        `'${sameVersion.attributes.appStoreState}' — refusing to submit.`,
    );
  }

  const created = await request('POST', '/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString, releaseType },
      relationships: { app: { data: { type: 'apps', id: ascAppId } } },
    },
  });
  return { id: created.data.id, created: true };
}

export async function setReleaseNotes(request, { versionId, locale, notes }) {
  const data = await request(
    'GET',
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
  );
  const loc = (data.data || []).find((l) => l?.attributes?.locale === locale);
  if (loc) {
    await request('PATCH', `/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: notes } },
    });
    return { locale, updated: true };
  }
  await request('POST', '/appStoreVersionLocalizations', {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: { locale, whatsNew: notes },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
    },
  });
  return { locale, updated: false };
}

export async function attachBuild(request, { versionId, buildId }) {
  await request('PATCH', `/appStoreVersions/${versionId}/relationships/build`, {
    data: { type: 'builds', id: buildId },
  });
}

/**
 * Roll the update out to existing users over 7 days instead of all at once.
 *
 * This is the safety valve that makes `releaseType: AFTER_APPROVAL` a
 * responsible default: nobody presses a button, but a bad build reaches a
 * fraction of users and can be paused rather than needing an expedited review.
 *
 * It governs only *automatic updates for existing users* — a new download always
 * gets the newest version — so it does nothing for 1.0.0 and starts mattering at
 * the first update. Created INACTIVE: Apple starts the clock at release.
 */
export async function enablePhasedRelease(request, { versionId }) {
  const existing = await request('GET', `/appStoreVersions/${versionId}/appStoreVersionPhasedRelease`);
  if (existing?.data?.id) {
    return { id: existing.data.id, created: false, state: existing.data.attributes?.phasedReleaseState };
  }
  const created = await request('POST', '/appStoreVersionPhasedReleases', {
    data: {
      type: 'appStoreVersionPhasedReleases',
      attributes: { phasedReleaseState: 'INACTIVE' },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
    },
  });
  return { id: created.data.id, created: true, state: 'INACTIVE' };
}

/** Pause, resume, or jump a phased rollout to everyone. */
export async function setPhasedReleaseState(request, { phasedReleaseId, state }) {
  await request('PATCH', `/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
    data: {
      type: 'appStoreVersionPhasedReleases',
      id: phasedReleaseId,
      attributes: { phasedReleaseState: state },
    },
  });
  return state;
}

/** Submit for review via the modern reviewSubmissions API. */
export async function submitForReview(request, { ascAppId, versionId }) {
  // The legacy /appStoreVersionSubmissions resource is CREATE-disabled for apps
  // on the newer review flow: Apple answers 403 "does not allow 'CREATE'.
  // Allowed operation is: DELETE".
  //
  // At most one open (READY_FOR_REVIEW) reviewSubmission exists per app, so
  // reuse it — otherwise a retry after a partial failure 409s on a duplicate.
  const open = await request(
    'GET',
    `/apps/${ascAppId}/reviewSubmissions?filter[platform]=IOS&filter[state]=READY_FOR_REVIEW&limit=1`,
  );
  let submissionId = open?.data?.[0]?.id || null;
  if (!submissionId) {
    const created = await request('POST', '/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: ascAppId } } },
      },
    });
    submissionId = created?.data?.id || null;
    if (!submissionId) throw new Error('submitForReview: POST /reviewSubmissions returned no id');
  }

  const items = await request('GET', `/reviewSubmissions/${submissionId}/items?limit=50`);
  const present = (items?.data || []).some(
    (it) => it?.relationships?.appStoreVersion?.data?.id === versionId,
  );
  if (!present) {
    await request('POST', '/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    });
  }

  await request('PATCH', `/reviewSubmissions/${submissionId}`, {
    data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
  });
  return submissionId;
}

/** The whole post-upload flow, in order. */
export async function submitIosForReview({
  request,
  ascAppId,
  versionString,
  buildNumber,
  notes,
  locale = 'es-ES',
  releaseType = 'AFTER_APPROVAL',
  phased = true,
  log = () => {},
  waitOpts = {},
}) {
  if (!request) throw new Error('submitIosForReview: request function required');
  if (!ascAppId) throw new Error('submitIosForReview: ascAppId required');
  if (!versionString) throw new Error('submitIosForReview: versionString required');
  if (buildNumber == null || buildNumber === '') {
    throw new Error('submitIosForReview: buildNumber required');
  }
  if (!notes || !notes.trim()) throw new Error('submitIosForReview: notes required');

  log(`waiting for build ${buildNumber} to finish processing…`);
  const buildId = await waitForBuild(request, { ascAppId, buildNumber, log, ...waitOpts });
  log(`build ready: ${buildId}`);

  const version = await findOrCreateVersion(request, { ascAppId, versionString, releaseType });
  log(`version ${versionString}: ${version.created ? 'created' : 'reused'} (${version.id})`);
  if (version.alreadyInFlight) {
    log(`version ${versionString} is already submitted or live — nothing to do.`);
    return { status: 'noop', versionId: version.id, buildId };
  }

  const notesResult = await setReleaseNotes(request, { versionId: version.id, locale, notes });
  log(`release notes ${notesResult.updated ? 'updated' : 'created'} for ${locale}`);

  await attachBuild(request, { versionId: version.id, buildId });
  log(`build ${buildId} attached`);

  let phasedResult = null;
  if (phased) {
    phasedResult = await enablePhasedRelease(request, { versionId: version.id });
    log(`phased release ${phasedResult.created ? 'enabled' : 'already set'} (${phasedResult.state})`);
  }

  const submissionId = await submitForReview(request, { ascAppId, versionId: version.id });
  log(`submitted for review (submission ${submissionId})`);
  log(
    releaseType === 'AFTER_APPROVAL'
      ? 'releaseType=AFTER_APPROVAL — approval releases it with no further action.'
      : `releaseType=${releaseType} — approval will NOT release it on its own.`,
  );

  return {
    status: 'submitted',
    versionId: version.id,
    buildId,
    submissionId,
    phasedReleaseId: phasedResult?.id ?? null,
  };
}

/** Every iOS version ASC knows about, newest first, with its build number. */
export async function listVersions(request, { ascAppId, limit = 10 }) {
  const data = await request(
    'GET',
    `/apps/${ascAppId}/appStoreVersions?filter[platform]=IOS&include=build&limit=${limit}`,
  );
  const buildById = new Map(
    (data.included || [])
      .filter((i) => i.type === 'builds')
      .map((b) => [b.id, b.attributes?.version]),
  );
  return (data.data || []).map((v) => {
    const ref = v.relationships?.build?.data;
    return {
      id: v.id,
      versionString: v.attributes?.versionString ?? null,
      appStoreState: v.attributes?.appStoreState ?? v.attributes?.state ?? null,
      releaseType: v.attributes?.releaseType ?? null,
      buildNumber: ref ? (buildById.get(ref.id) ?? null) : null,
    };
  });
}

/**
 * Release an approved version that is waiting on the button.
 *
 * Needed only for versions created before `releaseType: AFTER_APPROVAL` became
 * the default — after that, approval releases on its own and this is a recovery
 * path. Idempotent: a version already out is reported, not re-released.
 */
export async function releaseVersion(request, { ascAppId, versionString, apply, log = () => {} }) {
  const versions = await listVersions(request, { ascAppId });
  const target = versionString
    ? versions.find((v) => v.versionString === versionString)
    : versions.find((v) => v.appStoreState === PENDING_RELEASE_STATE);

  if (!target) {
    const what = versionString ? `version ${versionString}` : `any version in ${PENDING_RELEASE_STATE}`;
    return { status: 'not-found', message: `no ${what} found`, versions };
  }

  const { releasable, reason } = classifyReleasability(target.appStoreState);
  if (!releasable) {
    return { status: 'skipped', message: `${target.versionString}: ${reason}`, target };
  }

  if (!apply) {
    return {
      status: 'dry-run',
      message: `would release ${target.versionString} (build ${target.buildNumber})`,
      target,
    };
  }

  await request('POST', '/appStoreVersionReleaseRequests', {
    data: {
      type: 'appStoreVersionReleaseRequests',
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: target.id } } },
    },
  });
  log(`released ${target.versionString} (build ${target.buildNumber})`);
  return { status: 'released', target };
}

/** Flip an existing version to auto-release, so approval needs no button. */
export async function setReleaseType(request, { versionId, releaseType }) {
  await request('PATCH', `/appStoreVersions/${versionId}`, {
    data: { type: 'appStoreVersions', id: versionId, attributes: { releaseType } },
  });
  return releaseType;
}
