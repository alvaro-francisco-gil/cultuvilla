import satori from 'satori';
import sharp from 'sharp';
import archivoRegular from './fonts/Archivo-Regular.ttf';
import archivoSemiBold from './fonts/Archivo-SemiBold.ttf';
import archivoExtraBold from './fonts/Archivo-ExtraBold.ttf';
import type { SatoriNode } from './h';
import { CARD_HEIGHT, CARD_WIDTH } from './theme';

/**
 * Satori lays the tree out and emits SVG with the fonts EMBEDDED as glyph
 * paths — which is the whole reason for using it. Rasterising our own SVG text
 * with sharp would depend on fonts installed in the Cloud Functions container,
 * and there are none worth having: the text would silently fall back to a
 * default face. sharp then only rasterises paths, which needs no fonts at all.
 */
const fonts = [
  { name: 'Archivo', data: toArrayBuffer(archivoRegular), weight: 400 as const, style: 'normal' as const },
  { name: 'Archivo', data: toArrayBuffer(archivoSemiBold), weight: 600 as const, style: 'normal' as const },
  { name: 'Archivo', data: toArrayBuffer(archivoExtraBold), weight: 800 as const, style: 'normal' as const },
];

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function renderSvg(tree: SatoriNode): Promise<string> {
  // Satori's element type is React's; our plain `h()` objects are that shape.
  return satori(tree as unknown as Parameters<typeof satori>[0], {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  });
}

export type ImageFormat = 'png' | 'jpeg';

/**
 * Photo-heavy cards go out as JPEG, flat ones as PNG. A mosaic of flyers as
 * PNG weighs ~1.6MB, which is a real cost for someone opening it on mobile data
 * in a village with patchy coverage; JPEG is several times smaller there. PNG
 * stays for the flat cards, where JPEG would smear the edges of the type.
 */
export async function renderImage(tree: SatoriNode, format: ImageFormat): Promise<Buffer> {
  const svg = sharp(Buffer.from(await renderSvg(tree)));
  return format === 'jpeg'
    ? svg.flatten({ background: '#1f1a17' }).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
    : svg.png({ compressionLevel: 9 }).toBuffer();
}
