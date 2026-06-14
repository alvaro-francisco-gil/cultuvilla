// Image manifest for the `real_villages_1` dataset (Matabuena content).
//
// Consumed only by `DATASET=real_villages_1 pnpm seed:images` — a one-time,
// network step that downloads each `url` into this dataset's `images/` folder,
// resized with sharp. Commit the results so seeding stays offline. Source =
// Lorem Picsum (deterministic by seed); swap a url for a real photo + rerun
// with --force for curated imagery.

const COVER = { width: 1200, height: 800 };
const AVATAR = { width: 800, height: 800, square: true };
const pic = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export default [
  // Covers + event/news images
  { file: 'matabuena-cover-1.jpg', url: pic('matabuena-sierra-1', 1200, 800), ...COVER },
  { file: 'matabuena-cover-2.jpg', url: pic('matabuena-sierra-2', 1200, 800), ...COVER },
  { file: 'matabuena-verbena.jpg', url: pic('matabuena-verbena', 1200, 800), ...COVER },
  { file: 'matabuena-ruta.jpg', url: pic('matabuena-pinares', 1200, 800), ...COVER },
  { file: 'matabuena-pena-pinar-caldereta.jpg', url: pic('matabuena-caldereta', 1200, 800), ...COVER },
  { file: 'matabuena-pena-quintos-hoguera.jpg', url: pic('matabuena-hoguera', 1200, 800), ...COVER },
  { file: 'matabuena-news-setas.jpg', url: pic('matabuena-setas', 1200, 800), ...COVER },
  { file: 'matabuena-news-fiestas.jpg', url: pic('matabuena-fiestas', 1200, 800), ...COVER },

  // Organization images (incl. peñas)
  { file: 'matabuena-org-ayto.jpg', url: pic('matabuena-org-ayto', 800, 800), ...AVATAR },
  { file: 'matabuena-org-asoc-sierra.jpg', url: pic('matabuena-org-sierra', 800, 800), ...AVATAR },
  { file: 'matabuena-org-pena-pinar.jpg', url: pic('matabuena-org-pinar', 800, 800), ...AVATAR },
  { file: 'matabuena-org-pena-quintos.jpg', url: pic('matabuena-org-quintos', 800, 800), ...AVATAR },
  { file: 'matabuena-org-pena-hoz.jpg', url: pic('matabuena-org-hoz', 800, 800), ...AVATAR },

  // Place images
  { file: 'matabuena-place-cementerio.jpg', url: pic('matabuena-place-cementerio', 1200, 800), ...COVER },
  { file: 'matabuena-place-iglesia.jpg', url: pic('matabuena-place-iglesia', 1200, 800), ...COVER },
  { file: 'matabuena-place-ermita.jpg', url: pic('matabuena-place-ermita', 1200, 800), ...COVER },
  { file: 'matabuena-place-plaza.jpg', url: pic('matabuena-place-plaza', 1200, 800), ...COVER },
  { file: 'matabuena-place-ayuntamiento.jpg', url: pic('matabuena-place-ayto', 1200, 800), ...COVER },

  // Barrio images
  { file: 'matabuena-barrio-pueblo.jpg', url: pic('matabuena-barrio-pueblo', 1200, 800), ...COVER },
  { file: 'matabuena-barrio-villares.jpg', url: pic('matabuena-barrio-villares', 1200, 800), ...COVER },
];
