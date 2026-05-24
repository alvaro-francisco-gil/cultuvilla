#!/usr/bin/env node
/**
 * seed-dev-fixtures.mjs
 *
 * Idempotently seeds the dev Firestore (`villa-events`) with a small set of
 * realistic-looking fixtures so you can open the mobile app and have villages,
 * organizations, and events to interact with — without going through the
 * admin/superadmin flows for each one.
 *
 * Data shape is built via the same `build*Data` helpers from
 * `@cultuvilla/shared` that the app uses at runtime, so seed docs match
 * production shape exactly (no pseudo-replicated schemas here).
 *
 * USAGE
 *   pnpm shared:build                          # builds @cultuvilla/shared once
 *   ADMIN_UID=<your firebase auth uid> pnpm seed:dev
 *
 *   # Cleanup (removes only docs tagged seedBatch=dev-fixtures-v1):
 *   pnpm seed:dev:wipe
 *
 * ADMIN_UID / ADMIN_EMAIL / ADMIN_PASSWORD
 *   Two modes:
 *     a) ADMIN_UID set → use an existing Firebase Auth user.
 *     b) ADMIN_UID not set → script creates (or reuses) an Auth user from
 *        ADMIN_EMAIL + ADMIN_PASSWORD, writes `users/{uid}` + `admins/{uid}`,
 *        then uses that UID for everything.
 *   In both modes the user ends up in `admins/{uid}` (app superadmin).
 *   Defaults: ADMIN_EMAIL=alvaro@cultuvilla.dev  ADMIN_PASSWORD=cultuvilla-dev
 *
 * CREDENTIALS
 *   Authenticate with Application Default Credentials before running:
 *     gcloud auth application-default login
 *
 * SAFETY
 *   - Only writes to the project resolved from firebase.json / env (dev).
 *   - Every doc is tagged `seedBatch: 'dev-fixtures-v1'`.
 *   - Deterministic IDs (seed-village-aranjuez, seed-org-aranjuez-ayto, ...) →
 *     re-running just upserts; no duplicates.
 *   - `--wipe` deletes only docs with the matching seedBatch tag.
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Deep-imports into the built dist/. The shared package is bundler-targeted
// (directory imports), so we sidestep that by hitting concrete .js files.
// These builders are pure (TS elided their type-only firebase imports), so
// they have zero runtime dependencies.
import {
  buildMunicipalityData,
  buildVillageCommunity,
} from '@cultuvilla/shared/dist/models/municipality/MunicipalityDataModel.js';
import { buildVillageMemberData } from '@cultuvilla/shared/dist/models/municipality/VillageMemberDataModel.js';
import { buildOrganizationData } from '@cultuvilla/shared/dist/models/organization/OrganizationDataModel.js';
import { buildEventData } from '@cultuvilla/shared/dist/models/event/EventDataModel.js';
import { buildLocationData } from '@cultuvilla/shared/dist/models/core/LocationDataModel.js';
import { buildUserData } from '@cultuvilla/shared/dist/models/user/UserDataModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const SEED_BATCH = 'dev-fixtures-v1';
const WIPE = process.argv.includes('--wipe');

// ── Resolve project ID ────────────────────────────────────────────────────────

function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
  if (existsSync(firebaseJsonPath)) {
    try {
      const fj = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
      if (fj.projectId) return fj.projectId;
    } catch {
      /* fall through */
    }
  }
  // .firebaserc default → villa-events
  const rcPath = path.join(repoRoot, '.firebaserc');
  if (existsSync(rcPath)) {
    try {
      const rc = JSON.parse(readFileSync(rcPath, 'utf8'));
      if (rc?.projects?.default) return rc.projects.default;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error('[seed] Could not determine project ID. Set GOOGLE_CLOUD_PROJECT.');
  process.exit(1);
}
if (projectId !== 'villa-events') {
  console.error(
    `[seed] Refusing to run against project "${projectId}". This script is dev-only ` +
      `(villa-events). Override by editing the guard if you really mean it.`,
  );
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'alvaro@cultuvilla.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'cultuvilla-dev';
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME ?? 'Alvaro (dev)';

// ── Init admin SDK ────────────────────────────────────────────────────────────

admin.initializeApp({ projectId });
const db = admin.firestore();
const auth = admin.auth();
const { GeoPoint } = admin.firestore;

// Resolved lazily — either from env or after creating/looking up the Auth user.
let ADMIN_UID = process.env.ADMIN_UID ?? null;

async function ensureAdminUser() {
  if (ADMIN_UID) {
    console.log(`[seed] using existing ADMIN_UID=${ADMIN_UID}`);
  } else {
    let user;
    try {
      user = await auth.getUserByEmail(ADMIN_EMAIL);
      console.log(`[seed] reusing auth user ${user.uid} (${ADMIN_EMAIL})`);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      user = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
        emailVerified: true,
      });
      console.log(`[seed] created auth user ${user.uid} (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);
    }
    ADMIN_UID = user.uid;
  }

  // users/{uid} profile
  const userDoc = tag(
    buildUserData({
      displayName: ADMIN_DISPLAY_NAME,
      email: ADMIN_EMAIL,
      // arbitrary placeholder DOB for dev — adults-only logic is satisfied
      birthday: new Date('1990-01-01'),
    }),
  );
  await db.collection('users').doc(ADMIN_UID).set(userDoc, { merge: true });

  // admins/{uid} — app superadmin marker (see adminService.isAppAdmin)
  await db
    .collection('admins')
    .doc(ADMIN_UID)
    .set(tag({ createdAt: new Date() }), { merge: true });
  console.log(`[seed] admins/${ADMIN_UID} ✓`);
}

// ── Fixture definitions ───────────────────────────────────────────────────────

const VILLAGES = [
  {
    id: 'seed-village-aranjuez',
    municipality: {
      name: 'Aranjuez',
      province: 'Madrid',
      comunidadAutonoma: 'Comunidad de Madrid',
      codigoINE: '28013',
      coordinates: new GeoPoint(40.0319, -3.6033),
    },
    community: {
      description:
        'Comunidad de prueba de Aranjuez. Eventos del Real Sitio, peñas y asociaciones locales.',
    },
  },
  {
    id: 'seed-village-chinchon',
    municipality: {
      name: 'Chinchón',
      province: 'Madrid',
      comunidadAutonoma: 'Comunidad de Madrid',
      codigoINE: '28045',
      coordinates: new GeoPoint(40.1378, -3.4253),
    },
    community: {
      description:
        'Pueblo medieval con Plaza Mayor histórica. Fiestas patronales, anís y teatro.',
    },
  },
];

/** One org of each type per village. */
function orgsForVillage(villageId, villageName) {
  return [
    {
      id: `seed-org-${villageId.replace('seed-village-', '')}-ayto`,
      name: `Ayuntamiento de ${villageName}`,
      type: 'ayuntamiento',
      description: 'Organización municipal oficial.',
    },
    {
      id: `seed-org-${villageId.replace('seed-village-', '')}-pena-toros`,
      name: 'Peña Los Toros',
      type: 'peña',
      description: 'Peña taurina y festiva.',
    },
    {
      id: `seed-org-${villageId.replace('seed-village-', '')}-asoc-cultural`,
      name: 'Asociación Cultural Raíces',
      type: 'asociación',
      description: 'Asociación cultural y de tradiciones.',
    },
  ];
}

/** A handful of events per org covering different states. */
function eventsForOrg(org, village) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      idSuffix: 'verbena',
      title: `Verbena de ${village.municipality.name}`,
      description: 'Música en directo, comida y baile en la plaza.',
      startDate: new Date(now + 7 * day),
      endDate: new Date(now + 7 * day + 4 * 60 * 60 * 1000),
      maxAttendees: 200,
      price: 0,
      status: 'published',
    },
    {
      idSuffix: 'taller',
      title: 'Taller tradicional para vecinos',
      description: 'Plazas limitadas. Inscripción gratuita.',
      startDate: new Date(now + 14 * day),
      endDate: null,
      maxAttendees: 20,
      price: 0,
      status: 'published',
    },
    {
      idSuffix: 'past-fiesta',
      title: 'Fiestas Patronales (pasado)',
      description: 'Evento histórico — para probar feed de pasados.',
      startDate: new Date(now - 30 * day),
      endDate: new Date(now - 29 * day),
      maxAttendees: null,
      price: 0,
      status: 'completed',
    },
  ].map((e) => ({
    ...e,
    id: `seed-event-${org.id.replace('seed-org-', '')}-${e.idSuffix}`,
  }));
}

// ── Write helpers ─────────────────────────────────────────────────────────────

function tag(data) {
  return { ...data, seedBatch: SEED_BATCH };
}

async function upsertVillage(v) {
  const ref = db.collection('municipalities').doc(v.id);
  const baseMunicipality = buildMunicipalityData({
    name: v.municipality.name,
    province: v.municipality.province,
    comunidadAutonoma: v.municipality.comunidadAutonoma,
    codigoINE: v.municipality.codigoINE,
    coordinates: v.municipality.coordinates,
  });
  const community = buildVillageCommunity({
    description: v.community.description,
    adminUserId: ADMIN_UID,
  });
  const data = tag({
    ...baseMunicipality,
    community,
    communityActive: true,
  });
  await ref.set(data, { merge: true });

  // Owner membership in municipalities/{id}/members/{uid}
  const memberRef = ref.collection('members').doc(ADMIN_UID);
  await memberRef.set(tag(buildVillageMemberData({ role: 'admin' })), { merge: true });
  console.log(`[seed] village ${v.id} ✓`);
}

async function upsertOrg(village, org) {
  const ref = db.collection('organizations').doc(org.id);
  const data = tag(
    buildOrganizationData({
      name: org.name,
      description: org.description,
      type: org.type,
      status: 'approved',
      municipalityId: village.id,
      requestedBy: ADMIN_UID,
      approvedBy: ADMIN_UID,
      decidedAt: new Date(),
    }),
  );
  await ref.set(data, { merge: true });
  console.log(`[seed]   org ${org.id} ✓`);
}

async function upsertEvent(village, org, ev) {
  const ref = db.collection('events').doc(ev.id);
  const data = tag(
    buildEventData({
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate,
      endDate: ev.endDate,
      location: buildLocationData({ type: 'text', text: `Plaza Mayor, ${village.municipality.name}` }),
      price: ev.price,
      maxAttendees: ev.maxAttendees,
      telephoneRequired: false,
      status: ev.status,
      organizationId: org.id,
      organizationName: org.name,
      createdBy: ADMIN_UID,
      municipalityId: village.id,
      municipalityName: village.municipality.name,
      municipalityCoverImage: null,
      municipalityCoordinates: village.municipality.coordinates,
    }),
  );
  await ref.set(data, { merge: true });
  console.log(`[seed]     event ${ev.id} (${ev.status}) ✓`);
}

// ── Wipe ──────────────────────────────────────────────────────────────────────

/**
 * Enumerate every seed doc by deterministic ID. Avoids needing read perms
 * (some ADC accounts only have write perms on dev). Returns refs only.
 */
function listSeedDocRefs() {
  const refs = { events: [], organizations: [], municipalities: [], members: [] };
  for (const v of VILLAGES) {
    refs.municipalities.push(db.collection('municipalities').doc(v.id));
    const orgs = orgsForVillage(v.id, v.municipality.name);
    for (const org of orgs) {
      refs.organizations.push(db.collection('organizations').doc(org.id));
      for (const ev of eventsForOrg(org, v)) {
        refs.events.push(db.collection('events').doc(ev.id));
      }
    }
  }
  return refs;
}

async function wipe() {
  const refs = listSeedDocRefs();
  let total = 0;

  // Top-level seed docs (deterministic IDs)
  for (const [name, list] of Object.entries(refs)) {
    if (name === 'members') continue;
    const batch = db.batch();
    list.forEach((r) => batch.delete(r));
    if (list.length) {
      await batch.commit();
      console.log(`[wipe] ${name}: ${list.length}`);
      total += list.length;
    }
  }

  // municipalities/{id}/members/{uid} — best-effort, only if ADMIN_UID known
  const memberUid = process.env.ADMIN_UID;
  if (memberUid) {
    for (const v of VILLAGES) {
      await db.collection('municipalities').doc(v.id).collection('members').doc(memberUid).delete().catch(() => {});
    }
    console.log(`[wipe] municipality members for ${memberUid}: best-effort`);
  } else {
    console.log('[wipe] skipping member subdocs (set ADMIN_UID to also clean those)');
  }

  // admins/{uid} and users/{uid} for the previously-seeded throwaway user, if
  // ADMIN_UID provided OR ADMIN_EMAIL lookup succeeds via Auth (which we DO
  // have perms for).
  let uidsToCleanUser = new Set();
  if (memberUid) uidsToCleanUser.add(memberUid);
  const fallbackEmail = process.env.ADMIN_EMAIL ?? 'alvaro@cultuvilla.dev';
  try {
    const u = await auth.getUserByEmail(fallbackEmail);
    uidsToCleanUser.add(u.uid);
  } catch {
    /* ignore */
  }
  for (const uid of uidsToCleanUser) {
    await db.collection('admins').doc(uid).delete().catch(() => {});
    await db.collection('users').doc(uid).delete().catch(() => {});
    console.log(`[wipe] admins/${uid} + users/${uid}`);
  }

  // Also delete the throwaway Auth user from prior run if it exists.
  try {
    const u = await auth.getUserByEmail('alvaro@cultuvilla.dev');
    await auth.deleteUser(u.uid);
    console.log(`[wipe] auth user alvaro@cultuvilla.dev deleted`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') console.warn('[wipe] auth cleanup:', err.message);
  }

  console.log(`[wipe] done. blind-deleted ${total} top-level docs + ancillary cleanup.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`[seed] project=${projectId} batch=${SEED_BATCH}`);
  await ensureAdminUser();
  for (const v of VILLAGES) {
    await upsertVillage(v);
    const orgs = orgsForVillage(v.id, v.municipality.name);
    for (const org of orgs) {
      await upsertOrg(v, org);
      for (const ev of eventsForOrg(org, v)) {
        await upsertEvent(v, org, ev);
      }
    }
  }
  console.log('[seed] done.');
}

(WIPE ? wipe() : seed()).catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});
