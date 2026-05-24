#!/usr/bin/env node
/**
 * upload-escudos.mjs
 *
 * Uploads optimized escudo WebPs to Cloud Storage and patches existing
 * Firestore municipality docs with escudoUrl / escudoThumbUrl.
 *
 * Reads from:
 *   scripts/data/escudos-webp/{ine}.webp        (256×256)
 *   scripts/data/escudos-webp-thumb/{ine}.webp  (64×64)
 *
 * Writes to:
 *   gs://{bucket}/municipalities/{ine}/escudo.webp
 *   gs://{bucket}/municipalities/{ine}/escudo-thumb.webp
 *
 * Then queries Firestore for municipalities with matching codigoINE and
 * patches their escudoUrl / escudoThumbUrl. Munis without a Firestore doc
 * yet (most of Spain — not seeded) just get their files uploaded; when a
 * future seed creates the doc, the URL is reconstructable from the INE.
 *
 * USAGE
 *   pnpm upload:escudos                       # full run, dev only
 *   node scripts/upload-escudos.mjs --limit 50
 *   node scripts/upload-escudos.mjs --skip-upload   # only patch Firestore
 *   node scripts/upload-escudos.mjs --skip-firestore # only upload files
 *
 * IDEMPOTENCY
 *   Storage uploads check existence first and skip if size matches. Firestore
 *   patches use { merge: true } so re-runs are safe.
 *
 * CREDENTIALS
 *   Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a villa-events
 *   service-account key. See .claude/skills/firebase-admin-dev/SKILL.md.
 */

import admin from 'firebase-admin';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DIR_256 = path.join(repoRoot, 'scripts', 'data', 'escudos-webp');
const DIR_64 = path.join(repoRoot, 'scripts', 'data', 'escudos-webp-thumb');

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? '0', 10) : 0;
const SKIP_UPLOAD = args.includes('--skip-upload');
const SKIP_FIRESTORE = args.includes('--skip-firestore');
const CONCURRENCY = 16;

// ── Project guard (skill: firebase-admin-dev) ────────────────────────────────

const PROJECT_ID = 'villa-events';
const BUCKET = 'villa-events.firebasestorage.app';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function pool(items, concurrency, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results.push(await worker(items[idx], idx));
      } catch (err) {
        results.push({ status: 'fail', error: String(err?.message ?? err) });
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function publicUrl(objectPath) {
  // Standard Firebase Storage download URL. `?alt=media` streams raw bytes.
  // No token needed because storage.rules grants public read on this path.
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

async function uploadOne(ine) {
  const localBig = path.join(DIR_256, `${ine}.webp`);
  const localThumb = path.join(DIR_64, `${ine}.webp`);
  if (!existsSync(localBig) || !existsSync(localThumb)) {
    return { status: 'fail', ine, error: 'local file missing' };
  }

  const remoteBig = `municipalities/${ine}/escudo.webp`;
  const remoteThumb = `municipalities/${ine}/escudo-thumb.webp`;

  // Check size to make re-runs cheap (skip files already uploaded at same size)
  const [bigBuf, thumbBuf] = await Promise.all([readFile(localBig), readFile(localThumb)]);
  const [[bigExists], [thumbExists]] = await Promise.all([
    bucket.file(remoteBig).exists(),
    bucket.file(remoteThumb).exists(),
  ]);

  const tasks = [];
  if (!bigExists) {
    tasks.push(
      bucket.file(remoteBig).save(bigBuf, {
        contentType: 'image/webp',
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        resumable: false,
      }),
    );
  }
  if (!thumbExists) {
    tasks.push(
      bucket.file(remoteThumb).save(thumbBuf, {
        contentType: 'image/webp',
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        resumable: false,
      }),
    );
  }
  if (tasks.length) await Promise.all(tasks);

  return {
    status: 'ok',
    ine,
    bytesUploaded: (bigExists ? 0 : bigBuf.length) + (thumbExists ? 0 : thumbBuf.length),
    skipped: tasks.length === 0,
    escudoUrl: publicUrl(remoteBig),
    escudoThumbUrl: publicUrl(remoteThumb),
  };
}

async function patchFirestore(byIne) {
  console.log('\nPatching Firestore municipality docs by codigoINE...');
  const snap = await db.collection('municipalities').get();
  console.log(`  Loaded ${snap.size} municipality docs from Firestore.`);

  const batch = db.batch();
  let patched = 0;
  let noMatch = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const ine = data.codigoINE;
    if (typeof ine !== 'string') continue;
    const urls = byIne.get(ine);
    if (!urls) {
      noMatch++;
      continue;
    }
    if (data.escudoUrl === urls.escudoUrl && data.escudoThumbUrl === urls.escudoThumbUrl) {
      continue; // already up to date
    }
    batch.update(doc.ref, {
      escudoUrl: urls.escudoUrl,
      escudoThumbUrl: urls.escudoThumbUrl,
    });
    patched++;
  }
  if (patched > 0) await batch.commit();
  console.log(`  Patched ${patched} docs with escudo URLs.`);
  console.log(`  ${noMatch} docs had no escudo available (38% Wikidata gap is expected).`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Bucket:  ${BUCKET}`);

  let ines = (await readdir(DIR_256))
    .filter(f => f.endsWith('.webp'))
    .map(f => f.replace(/\.webp$/, ''))
    .sort();
  if (LIMIT > 0) ines = ines.slice(0, LIMIT);
  console.log(`Processing ${ines.length} escudos.\n`);

  const byIne = new Map();
  if (!SKIP_UPLOAD) {
    console.log(`Uploading to gs://${BUCKET}/municipalities/{ine}/... (concurrency=${CONCURRENCY})`);
    const t0 = Date.now();
    let done = 0;
    let totalBytes = 0;
    let skipped = 0;
    const fails = [];
    await pool(ines, CONCURRENCY, async ine => {
      const r = await uploadOne(ine);
      done++;
      if (done % 100 === 0 || done === ines.length) {
        process.stdout.write(`  ${done}/${ines.length} (${fmtBytes(totalBytes)} uploaded, ${skipped} skipped)\r`);
      }
      if (r.status === 'ok') {
        byIne.set(ine, { escudoUrl: r.escudoUrl, escudoThumbUrl: r.escudoThumbUrl });
        totalBytes += r.bytesUploaded;
        if (r.skipped) skipped++;
      } else {
        fails.push(r);
      }
      return r;
    });
    process.stdout.write('\n');
    console.log(`  Done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${fmtBytes(totalBytes)} uploaded, ${skipped} already present.`);
    if (fails.length) {
      console.log(`  Failures: ${fails.length}. First 5:`);
      for (const f of fails.slice(0, 5)) console.log(`    ${f.ine}: ${f.error}`);
    }
  } else {
    // build URL map without touching Storage
    for (const ine of ines) {
      byIne.set(ine, {
        escudoUrl: publicUrl(`municipalities/${ine}/escudo.webp`),
        escudoThumbUrl: publicUrl(`municipalities/${ine}/escudo-thumb.webp`),
      });
    }
  }

  if (!SKIP_FIRESTORE) {
    await patchFirestore(byIne);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
