#!/usr/bin/env node
/**
 * seed-dev-fixtures.mjs
 *
 * Loads a named dataset from `scripts/data/seed-fixtures/<dataset>/fixtures.mjs`
 * and idempotently seeds the dev Firestore (`villa-events`) with the users,
 * villages, organizations, and events it declares. Local image files in
 * `scripts/data/seed-fixtures/<dataset>/images/` are uploaded to Cloud Storage
 * and their download URLs wired into the seeded docs (village cover images,
 * event images, user `photoURL`).
 *
 * Doc shape is built via the same `build*Data` helpers from `@cultuvilla/shared`
 * that the app uses at runtime, so seed docs match production shape exactly.
 *
 * USAGE
 *   pnpm shared:build                                # one-time
 *   DATASET=real_data_1 pnpm seed:dev                # seed
 *   DATASET=real_data_1 pnpm seed:dev:wipe           # remove just that dataset
 *
 *   DATASET defaults to `random_data_1` (the legacy throwaway dev data).
 *
 * AUTHENTICATION
 *   Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a `villa-events`
 *   service-account JSON key (Storage writes use it). See firebase-admin-dev
 *   skill at .claude/skills/firebase-admin-dev/SKILL.md.
 *
 * SAFETY
 *   - Hard-coded to project `villa-events` (dev). Refuses anything else.
 *   - Doc IDs deterministic and namespaced by dataset:
 *       seed-<dataset>-village-<id>
 *       seed-<dataset>-org-<villageId>-<orgId>
 *       seed-<dataset>-event-<villageId>-<orgId>-<eventId>
 *   - Storage files prefixed `seed-` for the wipe to find them.
 *   - Tag on every doc: `seedBatch: 'dev-fixtures-<dataset>'`.
 *   - `--wipe` deletes ONLY docs/files/users from the chosen dataset.
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

import {
  buildMunicipalityData,
  buildVillageCommunity,
  buildVillageMemberData,
  buildOrganizationData,
  buildEventData,
  buildLocationData,
  buildUserData,
  buildPersonData,
} from '@cultuvilla/shared/models';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const PROJECT_ID = 'villa-events';
const BUCKET = 'villa-events.firebasestorage.app';
const WIPE = process.argv.includes('--wipe');
const DATASET = (process.env.DATASET ?? 'random_data_1').trim();
const FIXTURES_ROOT = path.join(repoRoot, 'scripts', 'data', 'seed-fixtures');
const DATASET_DIR = path.join(FIXTURES_ROOT, DATASET);
const DATASET_SLUG = DATASET.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const SEED_BATCH = `dev-fixtures-${DATASET_SLUG}`;
const IMAGE_FILE_PREFIX = 'seed-';
const CONTENT_TYPE_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// ── Guards ───────────────────────────────────────────────────────────────────

function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
  if (existsSync(firebaseJsonPath)) {
    try {
      const fj = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
      if (fj.projectId) return fj.projectId;
    } catch { /* fall through */ }
  }
  const rcPath = path.join(repoRoot, '.firebaserc');
  if (existsSync(rcPath)) {
    try {
      const rc = JSON.parse(readFileSync(rcPath, 'utf8'));
      if (rc?.projects?.default) return rc.projects.default;
    } catch { /* ignore */ }
  }
  return PROJECT_ID;
}

const projectId = resolveProjectId();
if (projectId !== PROJECT_ID) {
  console.error(`[seed] Refusing to run against project "${projectId}". Dev-only (${PROJECT_ID}).`);
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    '[seed] GOOGLE_APPLICATION_CREDENTIALS not set. Required for Storage uploads.\n' +
      '       See .claude/skills/firebase-admin-dev/SKILL.md for how to set it.',
  );
  process.exit(1);
}
if (!existsSync(path.join(DATASET_DIR, 'fixtures.mjs'))) {
  const available = existsSync(FIXTURES_ROOT)
    ? readdirSync(FIXTURES_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  console.error(
    `[seed] Dataset "${DATASET}" not found at scripts/data/seed-fixtures/${DATASET}/fixtures.mjs\n` +
      `       Available: ${available.join(', ') || '(none)'}`,
  );
  process.exit(1);
}

// ── Init admin SDK ───────────────────────────────────────────────────────────

admin.initializeApp({ projectId, storageBucket: BUCKET });
const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();
const { GeoPoint } = admin.firestore;

// ── Helpers ──────────────────────────────────────────────────────────────────

function tag(data) {
  return { ...data, seedBatch: SEED_BATCH };
}

function publicUrl(objectPath) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

function contentTypeFor(filename) {
  return CONTENT_TYPE_BY_EXT[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve a fixture image reference to an absolute path on disk.
 * - Bare filename ("verbena.jpg") → scripts/data/seed-fixtures/<dataset>/images/<filename>
 * - Anything containing "/" ("packages/shared/assets/icons/logo.png") → repo-relative
 */
function resolveImage(ref) {
  return ref.includes('/') ? path.join(repoRoot, ref) : path.join(DATASET_DIR, 'images', ref);
}

async function uploadImage(ref, remoteFolder) {
  const localAbs = resolveImage(ref);
  if (!existsSync(localAbs)) {
    throw new Error(`Image not found: ${path.relative(repoRoot, localAbs)} (referenced as "${ref}")`);
  }
  const buf = await readFile(localAbs);
  const remotePath = `${remoteFolder}/${IMAGE_FILE_PREFIX}${path.basename(ref)}`;
  const file = bucket.file(remotePath);
  const [exists] = await file.exists();
  if (exists) {
    const [meta] = await file.getMetadata();
    if (Number(meta.size) === buf.length) return publicUrl(remotePath);
  }
  await file.save(buf, {
    contentType: contentTypeFor(ref),
    metadata: {
      cacheControl: 'public, max-age=86400',
      metadata: { seedBatch: SEED_BATCH },
    },
    resumable: false,
  });
  return publicUrl(remotePath);
}

const villageDocId = (vid) => `seed-${DATASET_SLUG}-village-${vid}`;
const orgDocId = (vid, oid) => `seed-${DATASET_SLUG}-org-${vid}-${oid}`;
const eventDocId = (vid, oid, eid) => `seed-${DATASET_SLUG}-event-${vid}-${oid}-${eid}`;
const personDocId = (userRef) => `seed-${DATASET_SLUG}-person-${userRef}`;

async function loadDataset() {
  const url = pathToFileURL(path.join(DATASET_DIR, 'fixtures.mjs')).href;
  const mod = await import(url);
  const data = mod.default ?? mod;
  if (!data || !Array.isArray(data.users)) {
    throw new Error(`Dataset "${DATASET}" must export users[] (and optionally villages[])`);
  }
  data.villages ??= [];
  return data;
}

// ── Users / admins ───────────────────────────────────────────────────────────

async function ensureUsers(users) {
  const refToUid = new Map();
  for (const u of users) {
    let authUser;
    try {
      authUser = await auth.getUserByEmail(u.email);
      console.log(`[seed] user ${u.email} reused (${authUser.uid})`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      authUser = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
        emailVerified: true,
      });
      console.log(`[seed] user ${u.email} created (${authUser.uid})`);
    }

    if (u.photo) {
      const url = await uploadImage(u.photo, `users/${authUser.uid}/photo`);
      if (authUser.photoURL !== url) {
        await auth.updateUser(authUser.uid, { photoURL: url });
        console.log(`[seed]   photoURL set for ${u.email}`);
      }
    }

    // Create persona first when present so the syncPersonDenormalization
    // trigger (deployed in dev) has a person to project from. We also write
    // users.personId explicitly below so the app links them without waiting
    // on the trigger.
    let personId = null;
    if (u.person) {
      personId = personDocId(u.ref);
      const personDoc = tag(
        buildPersonData({
          givenName: u.person.givenName,
          middleNames: u.person.middleNames ?? [],
          firstSurname: u.person.firstSurname ?? null,
          secondSurname: u.person.secondSurname ?? null,
          nickname: u.person.nickname ?? null,
          sex: u.person.sex ?? null,
          birthday: u.person.birthday ?? null,
          deathDate: u.person.deathDate ?? null,
          birthPlace: u.person.birthPlace ?? null,
          burialPlace: u.person.burialPlace ?? null,
          municipalityLinks: u.person.municipalityLinks ?? [],
          occupationIds: u.person.occupationIds ?? [],
          pendingOccupations: u.person.pendingOccupations ?? [],
          biography: u.person.biography ?? null,
          photoURL: u.person.photoURL ?? null,
          userId: authUser.uid,
          createdBy: authUser.uid,
        }),
      );
      await db.collection('persons').doc(personId).set(personDoc, { merge: true });
      console.log(`[seed]   persons/${personId} ✓`);
    }

    await db.collection('users').doc(authUser.uid).set(
      tag(
        buildUserData({
          displayName: u.displayName,
          email: u.email,
          personId,
        }),
      ),
      { merge: true },
    );

    if (u.isAppAdmin) {
      await db.collection('admins').doc(authUser.uid).set(tag({ createdAt: new Date() }), { merge: true });
      console.log(`[seed]   admins/${authUser.uid} ✓`);
    }

    refToUid.set(u.ref, authUser.uid);
  }
  return refToUid;
}

// ── Villages / orgs / events ─────────────────────────────────────────────────

async function upsertVillage(v, refToUid) {
  const docId = villageDocId(v.id);
  const adminUid = refToUid.get(v.adminUserRef);
  if (!adminUid) {
    throw new Error(`Village "${v.id}" adminUserRef "${v.adminUserRef}" not in users[]`);
  }

  const coverUrls = [];
  for (const file of v.coverImages ?? []) {
    coverUrls.push(await uploadImage(file, `villages/${docId}/images`));
  }

  const coords = new GeoPoint(v.coordinates.lat, v.coordinates.lng);
  const baseMunicipality = buildMunicipalityData({
    name: v.name,
    province: v.province,
    comunidadAutonoma: v.comunidadAutonoma,
    codigoINE: v.codigoINE,
    coordinates: coords,
  });
  const community = buildVillageCommunity({
    description: v.description,
    adminUserId: adminUid,
    coverImages: coverUrls,
  });
  await db.collection('municipalities').doc(docId).set(
    tag({ ...baseMunicipality, community, communityActive: true }),
    { merge: true },
  );
  await db.collection('municipalities').doc(docId).collection('members').doc(adminUid).set(
    tag(buildVillageMemberData({ userId: adminUid, role: 'admin' })),
    { merge: true },
  );
  console.log(`[seed] village ${docId} ✓ (${coverUrls.length} cover image(s))`);

  for (const org of v.organizations ?? []) {
    await upsertOrg(v, org, adminUid, coords, coverUrls[0] ?? null);
  }
}

async function upsertOrg(v, org, adminUid, coords, villageCover) {
  const vDocId = villageDocId(v.id);
  const oDocId = orgDocId(v.id, org.id);
  await db.collection('organizations').doc(oDocId).set(
    tag(
      buildOrganizationData({
        name: org.name,
        description: org.description,
        type: org.type,
        status: 'approved',
        municipalityId: vDocId,
        requestedBy: adminUid,
        approvedBy: adminUid,
        decidedAt: new Date(),
      }),
    ),
    { merge: true },
  );
  console.log(`[seed]   org ${oDocId} ✓`);

  for (const ev of org.events ?? []) {
    await upsertEvent(v, org, ev, adminUid, coords, villageCover);
  }
}

async function upsertEvent(v, org, ev, adminUid, coords, villageCover) {
  const vDocId = villageDocId(v.id);
  const oDocId = orgDocId(v.id, org.id);
  const eDocId = eventDocId(v.id, org.id, ev.id);

  const day = 24 * 60 * 60 * 1000;
  const startDate = new Date(Date.now() + ev.startOffsetDays * day);
  const endDate = ev.durationHours == null
    ? null
    : new Date(startDate.getTime() + ev.durationHours * 60 * 60 * 1000);

  let imageURL = null;
  if (ev.image) {
    imageURL = await uploadImage(ev.image, `villages/${vDocId}/events/${eDocId}/image`);
  }

  await db.collection('events').doc(eDocId).set(
    tag(
      buildEventData({
        title: ev.title,
        description: ev.description,
        startDate,
        endDate,
        location: buildLocationData({ type: 'text', text: `Plaza Mayor, ${v.name}` }),
        maxAttendees: ev.maxAttendees ?? null,
        telephoneRequired: false,
        status: ev.status ?? 'published',
        organizationId: oDocId,
        organizationName: org.name,
        createdBy: adminUid,
        municipalityId: vDocId,
        municipalityName: v.name,
        municipalityCoverImage: villageCover,
        municipalityCoordinates: coords,
        imageURL,
      }),
    ),
    { merge: true },
  );
  console.log(`[seed]     event ${eDocId} (${ev.status ?? 'published'})${imageURL ? ' + image' : ''} ✓`);
}

// ── Wipe ─────────────────────────────────────────────────────────────────────

async function wipeStorageFolder(prefix) {
  try {
    const [files] = await bucket.getFiles({ prefix });
    if (!files.length) return 0;
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
    return files.length;
  } catch (err) {
    console.warn(`[wipe] storage prefix ${prefix}: ${err.message}`);
    return 0;
  }
}

async function wipe(dataset) {
  console.log(`[wipe] dataset=${DATASET}`);
  let docs = 0;
  let storage = 0;

  for (const v of dataset.villages ?? []) {
    const vDocId = villageDocId(v.id);
    for (const org of v.organizations ?? []) {
      for (const ev of org.events ?? []) {
        await db.collection('events').doc(eventDocId(v.id, org.id, ev.id)).delete();
        docs++;
      }
      await db.collection('organizations').doc(orgDocId(v.id, org.id)).delete();
      docs++;
    }
    storage += await wipeStorageFolder(`villages/${vDocId}/`);
    const membersSnap = await db
      .collection('municipalities')
      .doc(vDocId)
      .collection('members')
      .listDocuments();
    await Promise.all(membersSnap.map((d) => d.delete().catch(() => {})));
    await db.collection('municipalities').doc(vDocId).delete();
    docs += 1 + membersSnap.length;
  }

  for (const u of dataset.users ?? []) {
    // Person doc is wiped by deterministic ID, independent of whether the
    // Auth user still exists (rules out stragglers after manual cleanup).
    if (u.person) {
      await db.collection('persons').doc(personDocId(u.ref)).delete().catch(() => {});
      docs++;
    }
    try {
      const authUser = await auth.getUserByEmail(u.email);
      storage += await wipeStorageFolder(`users/${authUser.uid}/photo/`);
      await db.collection('admins').doc(authUser.uid).delete().catch(() => {});
      await db.collection('users').doc(authUser.uid).delete().catch(() => {});
      await auth.deleteUser(authUser.uid).catch(() => {});
      docs += 2;
      console.log(`[wipe] user ${u.email} (${authUser.uid}) ✓`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        console.warn(`[wipe] user ${u.email}: ${err.message}`);
      }
    }
  }

  console.log(`[wipe] done. ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed(dataset) {
  console.log(`[seed] project=${projectId} dataset=${DATASET} batch=${SEED_BATCH}`);
  const refToUid = await ensureUsers(dataset.users);
  for (const v of dataset.villages) {
    await upsertVillage(v, refToUid);
  }
  console.log('[seed] done.');
}

(async () => {
  const dataset = await loadDataset();
  if (WIPE) await wipe(dataset);
  else await seed(dataset);
})().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});
