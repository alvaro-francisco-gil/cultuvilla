import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { generateQr } from '../generate-qr.mjs';

test('generateQr writes PNG + SVG and the PNG decodes back to the URL', async () => {
  const url = 'https://cultuvilla.es/descarga';
  const outDir = await mkdtemp(join(tmpdir(), 'qr-'));

  const { pngPath, svgPath } = await generateQr({ url, outDir, size: 1024 });

  // Both files exist and are non-empty.
  assert.ok((await stat(pngPath)).size > 0, 'PNG is non-empty');
  const svg = await readFile(svgPath, 'utf8');
  assert.ok(svg.includes('<svg'), 'SVG looks like SVG');

  // The generated QR round-trips the exact URL (proves the logo overlay didn't
  // break scannability at EC level H).
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.ok(decoded, 'QR decodes');
  assert.equal(decoded.data, url);
});
