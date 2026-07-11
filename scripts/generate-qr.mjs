#!/usr/bin/env node
/**
 * generate-qr.mjs
 *
 * Generate the print-forever Cultuvilla QR: encodes an https URL (default
 * https://cultuvilla.es/descarga), with the Cultuvilla logo composited into the
 * center on a white rounded pad. Error-correction level H so the logo overlay
 * stays scannable. Emits a high-res PNG (print) and an SVG (vector).
 *
 * USAGE
 *   node scripts/generate-qr.mjs [--url <url>] [--out <dir>] [--size <px>]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'https://cultuvilla.es/descarga';
const DEFAULT_OUT = join(ROOT, 'apps/mobile/assets/qr');
const LOGO = join(ROOT, 'apps/mobile/assets/logo.png');
const BASENAME = 'cultuvilla-descarga';

// Logo occupies ~18% of the QR; white rounded pad ~24% behind it.
const LOGO_FRAC = 0.18;
const PAD_FRAC = 0.24;
const PAD_RADIUS_FRAC = 0.18; // fraction of pad size

export async function generateQr({ url = DEFAULT_URL, outDir = DEFAULT_OUT, size = 2048 } = {}) {
  await mkdir(outDir, { recursive: true });
  const pngPath = join(outDir, `${BASENAME}.png`);
  const svgPath = join(outDir, `${BASENAME}.svg`);
  const qrOpts = { errorCorrectionLevel: 'H', margin: 2, width: size };

  // --- PNG: render QR, then composite a padded logo in the center. ---
  const qrPng = await QRCode.toBuffer(url, { ...qrOpts, type: 'png' });

  const logoSize = Math.round(size * LOGO_FRAC);
  const padSize = Math.round(size * PAD_FRAC);
  const radius = Math.round(padSize * PAD_RADIUS_FRAC);

  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();
  const pad = await sharp({
    create: { width: padSize, height: padSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${padSize}" height="${padSize}"><rect width="${padSize}" height="${padSize}" rx="${radius}" ry="${radius}"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const offPad = Math.round((size - padSize) / 2);
  const offLogo = Math.round((size - logoSize) / 2);
  await sharp(qrPng)
    .composite([
      { input: pad, top: offPad, left: offPad },
      { input: logo, top: offLogo, left: offLogo },
    ])
    .png()
    .toFile(pngPath);

  // --- SVG: QR as vector, logo embedded as a base64 <image> in the center. ---
  // qrcode's SVG output uses a `0 0 <moduleCount> <moduleCount>` viewBox with a
  // single <path> whose coordinates are in module units. We keep that viewBox
  // intact and place the overlay in the SAME module units (fraction * module
  // count) rather than rewriting the viewBox — rewriting it to `0 0 1 1` would
  // leave the path's module-unit coordinates pointing at the wrong scale.
  const qrSvg = await QRCode.toString(url, { ...qrOpts, type: 'svg' });
  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) \1"/);
  if (!viewBoxMatch) {
    throw new Error(`Could not parse module count from qrcode SVG viewBox: ${qrSvg.slice(0, 200)}`);
  }
  const moduleCount = Number(viewBoxMatch[1]);

  const logoB64 = (await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer()).toString(
    'base64',
  );

  const padUnits = PAD_FRAC * moduleCount;
  const logoUnits = LOGO_FRAC * moduleCount;
  const padOffset = (moduleCount - padUnits) / 2;
  const logoOffset = (moduleCount - logoUnits) / 2;
  const padRadiusUnits = padUnits * PAD_RADIUS_FRAC;

  const overlay =
    `<g transform="translate(${padOffset} ${padOffset})">` +
    `<rect width="${padUnits}" height="${padUnits}" rx="${padRadiusUnits}" fill="#fff"/></g>` +
    `<image x="${logoOffset}" y="${logoOffset}" width="${logoUnits}" height="${logoUnits}" ` +
    `href="data:image/png;base64,${logoB64}"/>`;
  const withLogo = qrSvg.replace('</svg>', `${overlay}</svg>`);
  await writeFile(svgPath, withLogo, 'utf8');

  return { pngPath, svgPath };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const { pngPath, svgPath } = await generateQr({
    url: get('--url'),
    outDir: get('--out'),
    size: get('--size') ? Number(get('--size')) : undefined,
  });
  console.log(`QR written:\n  ${pngPath}\n  ${svgPath}`);
}
