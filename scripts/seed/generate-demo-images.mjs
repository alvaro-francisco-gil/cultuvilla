#!/usr/bin/env node
/**
 * Draw the `demo_1` imagery instead of downloading random photographs.
 *
 * WHY THIS REPLACED LOREM PICSUM. `images.manifest.mjs` pulled every image from
 * picsum.photos, which returns an arbitrary photo per seed. The result was
 * actively misleading rather than merely generic: "Casa Consistorial" was a
 * person in a beanie, "Ayuntamiento de Aranjuez" was a camera, and the Jardines
 * del Príncipe were a Himalayan range. Those images are what the Play Store
 * screenshots are built from, so the listing showed a village app illustrated
 * with stock photos of somewhere else entirely.
 *
 * The honest fix is not "better stock photos" — we cannot license real photos of
 * Aranjuez — but imagery that is obviously ILLUSTRATIVE. Each asset is a flat
 * brand-coloured card carrying a glyph for what it actually depicts, so a church
 * looks like a church, a cemetery like a cemetery, and nothing pretends to be a
 * photograph of a place it is not.
 *
 * Deterministic: the palette is chosen from a hash of the filename, so
 * regenerating produces byte-identical output and re-runs make no diff.
 *
 *   node scripts/seed/generate-demo-images.mjs            # dry run, lists work
 *   node scripts/seed/generate-demo-images.mjs --apply
 *   DATASET=demo_1 node scripts/seed/generate-demo-images.mjs --apply
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATASET = process.env['DATASET'] ?? 'demo_1';
const OUT = resolve(HERE, '../data/seed-fixtures', DATASET, 'images');
const APPLY = process.argv.includes('--apply');

// packages/shared/src/design-system/tokens/colors.ts — kept in sync by hand;
// these are the raw palette values, not semantic tokens, because this draws
// artwork rather than UI.
const palette = {
  terracotta: '#bb5d3a',
  cream: '#f9f0e8',
  olive: '#566047',
  clay: '#d08f70',
  peach: '#dcab93',
  sage: '#a6a897',
  rust: '#be6b47',
};

/** Ground/ink pairs that keep the glyph legible at thumbnail size. */
const SCHEMES = [
  { bg: palette.cream, ink: palette.terracotta },
  { bg: palette.peach, ink: palette.olive },
  { bg: palette.sage, ink: palette.cream },
  { bg: palette.clay, ink: palette.cream },
  { bg: palette.olive, ink: palette.cream },
  { bg: palette.terracotta, ink: palette.cream },
];

/** Stable per-file scheme so re-running never churns the committed bytes. */
function schemeFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCHEMES[h % SCHEMES.length];
}

// Glyphs are authored on a 0 0 100 100 viewBox so one scale factor fits every
// canvas size. Deliberately simple silhouettes: they must read at the ~180px
// wide card the village home renders them in.
const GLYPHS = {
  person: '<circle cx="50" cy="36" r="16"/><path d="M18 88c0-18 14-30 32-30s32 12 32 30z"/>',
  village:
    '<path d="M6 76h88v10H6z"/><path d="M20 76V50l14-12 14 12v26z"/><path d="M52 76V58l12-10 12 10v18z"/><path d="M31 62h6v8h-6z"/><path d="M61 66h6v6h-6z"/>',
  event:
    '<rect x="16" y="24" width="68" height="60" rx="6"/><rect x="16" y="24" width="68" height="14" rx="6" opacity="0.55"/><rect x="30" y="14" width="7" height="16" rx="3"/><rect x="63" y="14" width="7" height="16" rx="3"/><circle cx="36" cy="54" r="5"/><circle cx="50" cy="54" r="5"/><circle cx="64" cy="54" r="5"/><circle cx="36" cy="68" r="5"/><circle cx="50" cy="68" r="5"/>',
  news:
    '<rect x="12" y="22" width="76" height="58" rx="5"/><rect x="20" y="32" width="34" height="24" rx="2" opacity="0.5"/><rect x="60" y="32" width="20" height="5" rx="2" opacity="0.5"/><rect x="60" y="42" width="20" height="5" rx="2" opacity="0.5"/><rect x="60" y="52" width="20" height="5" rx="2" opacity="0.5"/><rect x="20" y="64" width="60" height="5" rx="2" opacity="0.5"/>',
  barrio:
    '<path d="M10 82h80v8H10z"/><path d="M18 82V56l12-11 12 11v26z"/><path d="M46 82V46l14-13 14 13v36z"/><path d="M26 64h5v7h-5z"/><path d="M56 58h6v8h-6z"/><path d="M66 58h6v8h-6z"/>',
  church:
    '<path d="M46 8h8v14h10v8H54v52h-8V30H36v-8h10z" /><path d="M24 88V44l26-18 26 18v44z" opacity="0.85"/><path d="M44 88V68a6 6 0 0 1 12 0v20z" opacity="0.45"/>',
  hermitage:
    '<path d="M46 10h8v10h8v7h-8v9h-8v-9h-8v-7h8z"/><path d="M22 88V50l28-16 28 16v38z" opacity="0.85"/><path d="M42 88V70a8 8 0 0 1 16 0v18z" opacity="0.45"/>',
  cemetery:
    '<path d="M40 40a10 10 0 0 1 20 0v48H40z"/><path d="M44 12h12v10h10v8H56v14H44V30H34v-8h10z"/><path d="M8 88h84v6H8z" opacity="0.6"/>',
  plaza:
    '<circle cx="50" cy="50" r="12"/><path d="M8 84h84v8H8z" opacity="0.6"/><path d="M22 84V62h8v22z" opacity="0.75"/><path d="M70 84V62h8v22z" opacity="0.75"/><path d="M50 20l6 10H44z"/>',
  town_hall:
    '<path d="M50 12l38 20H12z"/><path d="M18 38h64v40H18z" opacity="0.85"/><path d="M28 46h8v24h-8zM46 46h8v24h-8zM64 46h8v24h-8z" opacity="0.5"/><path d="M8 82h84v8H8z"/>',
  organization:
    '<circle cx="32" cy="34" r="11"/><circle cx="68" cy="34" r="11"/><circle cx="50" cy="28" r="13"/><path d="M10 84c0-14 10-24 22-24s22 10 22 24z" opacity="0.8"/><path d="M46 84c0-14 10-24 22-24s22 10 22 24z" opacity="0.8"/>',
};

/** A shield with the village initial — the app's own escudo fallback shape. */
function escudoSvg(initial, { bg, ink }, size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${bg}"/>
  <path d="M50 10 L84 20 V50 C84 70 68 84 50 92 C32 84 16 70 16 50 V20 Z" fill="${ink}"/>
  <text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="38"
        font-weight="700" fill="${bg}">${initial}</text>
</svg>`);
}

function cardSvg(glyphKey, { bg, ink }, w, h) {
  const glyph = GLYPHS[glyphKey] ?? GLYPHS.village;
  // Scale the 100x100 glyph to ~46% of the shorter side and centre it.
  const s = (Math.min(w, h) * 0.46) / 100;
  const tx = (w - 100 * s) / 2;
  const ty = (h - 100 * s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <circle cx="${w * 0.5}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.36}" fill="${ink}" opacity="0.10"/>
  <g transform="translate(${tx} ${ty}) scale(${s})" fill="${ink}">${glyph}</g>
</svg>`);
}

const COVER = [1200, 800];
const AVATAR = [400, 400];
const ESCUDO = 512;

/** file -> what it actually depicts. Mirrors demo_1/fixtures.mjs. */
const ASSETS = [
  ['admin-avatar.jpg', 'person', AVATAR],
  ['vecino-avatar.jpg', 'person', AVATAR],

  ['aranjuez-cover-1.jpg', 'village', COVER],
  ['aranjuez-cover-2.jpg', 'village', COVER],
  ['chinchon-cover-1.jpg', 'village', COVER],
  ['chinchon-cover-2.jpg', 'village', COVER],

  ['aranjuez-verbena.jpg', 'event', COVER],
  ['aranjuez-mercado.jpg', 'event', COVER],
  ['chinchon-fiestas.jpg', 'event', COVER],
  ['chinchon-teatro.jpg', 'event', COVER],

  ['aranjuez-news-jardines.jpg', 'news', COVER],
  ['aranjuez-news-gastro.jpg', 'news', COVER],
  ['chinchon-news-anis.jpg', 'news', COVER],
  ['chinchon-news-plaza.jpg', 'news', COVER],

  ['aranjuez-barrio-centro.jpg', 'barrio', COVER],
  ['aranjuez-barrio-foso.jpg', 'barrio', COVER],
  ['aranjuez-barrio-nuevo-aranjuez.jpg', 'barrio', COVER],
  ['chinchon-barrio-plaza-mayor.jpg', 'barrio', COVER],
  ['chinchon-barrio-arrabal.jpg', 'barrio', COVER],

  ['aranjuez-place-cementerio.jpg', 'cemetery', COVER],
  ['aranjuez-place-iglesia.jpg', 'church', COVER],
  ['aranjuez-place-ermita.jpg', 'hermitage', COVER],
  ['aranjuez-place-plaza.jpg', 'plaza', COVER],
  ['aranjuez-place-ayuntamiento.jpg', 'town_hall', COVER],
  ['chinchon-place-cementerio.jpg', 'cemetery', COVER],
  ['chinchon-place-iglesia.jpg', 'church', COVER],
  ['chinchon-place-plaza-mayor.jpg', 'plaza', COVER],
  ['chinchon-place-ayuntamiento.jpg', 'town_hall', COVER],

  ['aranjuez-org-ayto.jpg', 'town_hall', AVATAR],
  ['aranjuez-org-asoc-jardines.jpg', 'organization', AVATAR],
  ['chinchon-org-ayto.jpg', 'town_hall', AVATAR],
  ['chinchon-org-pena-teatro.jpg', 'organization', AVATAR],
];

/** Escudos did not exist at all — the village home rendered a grey initial. */
const ESCUDOS = [
  ['aranjuez-escudo.jpg', 'A'],
  ['chinchon-escudo.jpg', 'C'],
];

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  let n = 0;

  for (const [file, glyph, [w, h]] of ASSETS) {
    const scheme = schemeFor(file);
    if (!APPLY) {
      console.log(`  would draw ${file} (${glyph}, ${w}x${h}, bg ${scheme.bg})`);
      n++;
      continue;
    }
    const png = await sharp(cardSvg(glyph, scheme, w, h))
      .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
      .toBuffer();
    writeFileSync(resolve(OUT, file), png);
    console.log(`  drew ${file} (${glyph})`);
    n++;
  }

  for (const [file, initial] of ESCUDOS) {
    const scheme = schemeFor(file);
    if (!APPLY) {
      console.log(`  would draw ${file} (escudo "${initial}")`);
      n++;
      continue;
    }
    const png = await sharp(escudoSvg(initial, scheme, ESCUDO))
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer();
    writeFileSync(resolve(OUT, file), png);
    console.log(`  drew ${file} (escudo)`);
    n++;
  }

  console.log(`\n${APPLY ? 'wrote' : 'would write'} ${n} images into ${OUT}`);
  if (!APPLY) console.log('Re-run with --apply to write them.');
}

await main();
