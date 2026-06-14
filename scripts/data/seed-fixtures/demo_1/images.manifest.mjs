// Image manifest for the `demo_1` dataset.
//
// Consumed ONLY by `scripts/seed/prepare-images.mjs` (`pnpm seed:images`) — a
// one-time, network-using step that downloads each `url` into this dataset's
// `images/` folder, resized to width×height with sharp. The results are
// committed to the repo so the seeders themselves stay fully offline.
//
// Source = Lorem Picsum (https://picsum.photos): free, deterministic by seed,
// no attribution required. Swap any `url` for a real photo before re-running
// with `--force` if you want curated imagery.
//
//   DATASET=demo_1 pnpm seed:images
//
// `square: true` forces a 1:1 crop (used for avatars).

const COVER = { width: 1200, height: 800 };
const AVATAR = { width: 400, height: 400, square: true };
const pic = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export default [
  // ── Avatars ──────────────────────────────────────────────────────────
  { file: 'admin-avatar.jpg', url: pic('cultuvilla-admin', 400, 400), ...AVATAR },
  { file: 'vecino-avatar.jpg', url: pic('cultuvilla-vecino', 400, 400), ...AVATAR },

  // ── Village covers ───────────────────────────────────────────────────
  { file: 'aranjuez-cover-1.jpg', url: pic('aranjuez-1', 1200, 800), ...COVER },
  { file: 'aranjuez-cover-2.jpg', url: pic('aranjuez-2', 1200, 800), ...COVER },
  { file: 'chinchon-cover-1.jpg', url: pic('chinchon-1', 1200, 800), ...COVER },
  { file: 'chinchon-cover-2.jpg', url: pic('chinchon-2', 1200, 800), ...COVER },

  // ── Event images ─────────────────────────────────────────────────────
  { file: 'aranjuez-verbena.jpg', url: pic('verbena-aranjuez', 1200, 800), ...COVER },
  { file: 'aranjuez-mercado.jpg', url: pic('mercado-aranjuez', 1200, 800), ...COVER },
  { file: 'chinchon-fiestas.jpg', url: pic('fiestas-chinchon', 1200, 800), ...COVER },
  { file: 'chinchon-teatro.jpg', url: pic('teatro-chinchon', 1200, 800), ...COVER },

  // ── News images ──────────────────────────────────────────────────────
  { file: 'aranjuez-news-jardines.jpg', url: pic('jardines-aranjuez', 1200, 800), ...COVER },
  { file: 'aranjuez-news-gastro.jpg', url: pic('gastro-aranjuez', 1200, 800), ...COVER },
  { file: 'chinchon-news-anis.jpg', url: pic('anis-chinchon', 1200, 800), ...COVER },
  { file: 'chinchon-news-plaza.jpg', url: pic('plaza-chinchon', 1200, 800), ...COVER },

  // ── Organization images ──────────────────────────────────────────────
  { file: 'aranjuez-org-ayto.jpg', url: pic('org-aranjuez-ayto', 800, 800), ...AVATAR },
  { file: 'aranjuez-org-asoc-jardines.jpg', url: pic('org-aranjuez-jardines', 800, 800), ...AVATAR },
  { file: 'chinchon-org-ayto.jpg', url: pic('org-chinchon-ayto', 800, 800), ...AVATAR },
  { file: 'chinchon-org-pena-teatro.jpg', url: pic('org-chinchon-teatro', 800, 800), ...AVATAR },

  // ── Place images ─────────────────────────────────────────────────────
  { file: 'aranjuez-place-cementerio.jpg', url: pic('place-aranjuez-cementerio', 1200, 800), ...COVER },
  { file: 'aranjuez-place-iglesia.jpg', url: pic('place-aranjuez-iglesia', 1200, 800), ...COVER },
  { file: 'aranjuez-place-ermita.jpg', url: pic('place-aranjuez-ermita', 1200, 800), ...COVER },
  { file: 'aranjuez-place-plaza.jpg', url: pic('place-aranjuez-plaza', 1200, 800), ...COVER },
  { file: 'aranjuez-place-ayuntamiento.jpg', url: pic('place-aranjuez-ayto', 1200, 800), ...COVER },
  { file: 'chinchon-place-cementerio.jpg', url: pic('place-chinchon-cementerio', 1200, 800), ...COVER },
  { file: 'chinchon-place-iglesia.jpg', url: pic('place-chinchon-iglesia', 1200, 800), ...COVER },
  { file: 'chinchon-place-plaza.jpg', url: pic('place-chinchon-plaza', 1200, 800), ...COVER },
  { file: 'chinchon-place-ayuntamiento.jpg', url: pic('place-chinchon-ayto', 1200, 800), ...COVER },

  // ── Barrio images ────────────────────────────────────────────────────
  { file: 'aranjuez-barrio-centro.jpg', url: pic('barrio-aranjuez-centro', 1200, 800), ...COVER },
  { file: 'aranjuez-barrio-foso.jpg', url: pic('barrio-aranjuez-foso', 1200, 800), ...COVER },
  { file: 'aranjuez-barrio-nuevo-aranjuez.jpg', url: pic('barrio-aranjuez-nuevo', 1200, 800), ...COVER },
  { file: 'chinchon-barrio-plaza-mayor.jpg', url: pic('barrio-chinchon-plaza', 1200, 800), ...COVER },
  { file: 'chinchon-barrio-arrabal.jpg', url: pic('barrio-chinchon-arrabal', 1200, 800), ...COVER },
];
