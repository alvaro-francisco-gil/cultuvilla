#!/usr/bin/env node
/**
 * Turn the animator's Bodymovin export of the intro into the asset the app ships.
 *
 *   node scripts/prepare-intro-lottie.mjs <export.json> [out.json]
 *
 * Every step exists because the native players (lottie-ios / lottie-android)
 * render less than After Effects or lottie-web does:
 *
 * - The wordmark arrives as an embedded PNG. It is swapped for vector shapes from
 *   the brand master SVG: crisp at any size, and the PNG export had drifted the
 *   CUL green off-brand.
 * - The "tu" layer is recoloured by an AE Fill effect, which native players
 *   ignore. The colour animation is baked into the shape fill instead.
 * - Mattes set with AE's "any layer as matte" (`tp`) are rewritten as classic
 *   adjacent mattes, which every player supports. Mattes nothing uses are dropped.
 * - The audio layer is dropped: players don't play it; the app plays the MP3.
 * - The whole animation is shifted by CONTENT_OFFSET_Y so the final logo +
 *   wordmark block lands on the vertical centre of the screen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LETTERING_SVG = join(ROOT, 'packages/shared/assets/brand/cultuvilla-lettering.svg');

/**
 * Measured on the 2026-09-18 export: the final frame's logo + wordmark spans
 * y 758–1286 of 1920, so its centre sits 62 px below the comp's. Re-measure
 * (render the last frame, take the non-white bounding box) after a new export.
 */
export const CONTENT_OFFSET_Y = -62;

const round = (n) => Math.round(n * 1000) / 1000;

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
}

/**
 * Absolute M/L/H/V/Q/Z path data under `translate(tx ty) scale(1 -1)` (how the
 * lettering SVG places each glyph) → closed Lottie bezier shapes.
 */
export function svgPathToLottieShapes(d, tx, ty) {
  const toks = d.match(/[MLHVQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const place = ([x, y]) => [tx + x, ty - y];
  const shapes = [];
  let cur = null;
  let cmd = null;
  let pos = [0, 0];
  let i = 0;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/^[MLHVQZ]$/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'M') {
      pos = [num(), num()];
      cur = { v: [place(pos)], i: [[0, 0]], o: [[0, 0]] };
      shapes.push(cur);
      cmd = 'L';
    } else if (cmd === 'L' || cmd === 'H' || cmd === 'V') {
      if (cmd === 'L') pos = [num(), num()];
      else if (cmd === 'H') pos = [num(), pos[1]];
      else pos = [pos[0], num()];
      cur.v.push(place(pos));
      cur.i.push([0, 0]);
      cur.o.push([0, 0]);
    } else if (cmd === 'Q') {
      const q = [num(), num()];
      const end = [num(), num()];
      const c1 = [pos[0] + (2 / 3) * (q[0] - pos[0]), pos[1] + (2 / 3) * (q[1] - pos[1])];
      const c2 = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])];
      // Lottie tangents are relative to their vertex; y flips with scale(1 -1).
      cur.o[cur.o.length - 1] = [c1[0] - pos[0], -(c1[1] - pos[1])];
      cur.v.push(place(end));
      cur.i.push([c2[0] - end[0], -(c2[1] - end[1])]);
      cur.o.push([0, 0]);
      pos = end;
    } else if (cmd === 'Z') {
      const n = cur.v.length;
      const [a, b] = [cur.v[0], cur.v[n - 1]];
      if (n > 1 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) {
        cur.i[0] = cur.i[n - 1];
        cur.v.pop();
        cur.i.pop();
        cur.o.pop();
      }
      cmd = null;
    } else {
      throw new Error(`Unsupported SVG path token ${JSON.stringify(toks[i])}`);
    }
  }
  const r = (ps) => ps.map(([x, y]) => [round(x), round(y)]);
  return shapes.map((s) => ({
    ty: 'sh',
    ks: { a: 0, k: { c: true, v: r(s.v), i: r(s.i), o: r(s.o) } },
  }));
}

/** The lettering SVG → [{ fill: '#rrggbb', shapes: [...] }] per colour group. */
export function parseLetteringSvg(svg) {
  const groups = [];
  for (const g of svg.matchAll(/<g fill="(#[0-9a-fA-F]{6})">([\s\S]*?)<\/g>/g)) {
    const shapes = [];
    for (const p of g[2].matchAll(/<path\b[^>]*>/g)) {
      const t = p[0].match(/transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(1 -1\)"/);
      const d = p[0].match(/\sd="([^"]*)"/);
      if (!t || !d) throw new Error(`Unexpected lettering path: ${p[0].slice(0, 80)}`);
      shapes.push(...svgPathToLottieShapes(d[1], Number(t[1]), Number(t[2])));
    }
    groups.push({ fill: g[1], shapes });
  }
  if (groups.length === 0) throw new Error('No <g fill> groups found in lettering SVG');
  return groups;
}

const shapeGroup = (nm, items, color) => ({
  ty: 'gr',
  nm,
  it: [
    ...items,
    { ty: 'fl', c: color, o: { a: 0, k: 100 }, r: 1 },
    {
      ty: 'tr',
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    },
  ],
});

function replaceWordmark(anim, groups) {
  const img = anim.assets.find((a) => a.w === 6085 && a.h === 729 && typeof a.p === 'string');
  if (!img) return false;
  const visit = (layers) => {
    for (const layer of layers) {
      if (layer.refId !== img.id) continue;
      const fill = (layer.ef ?? []).find((e) => e.mn === 'ADBE Fill');
      let shapes;
      if (fill) {
        const color = structuredClone(fill.ef.find((x) => x.nm === 'Color').v);
        // The first key matched the PNG's off-brand CUL green; start from the
        // brand green so TU still begins identical to CUL.
        if (color.a) color.k[0].s = hexToRgba(groups[0].fill);
        shapes = [shapeGroup('lettering', groups.flatMap((g) => g.shapes), color)];
        layer.ef = layer.ef.filter((e) => e !== fill);
        if (layer.ef.length === 0) delete layer.ef;
      } else {
        shapes = groups.map((g) => shapeGroup(`fill ${g.fill}`, g.shapes, { a: 0, k: hexToRgba(g.fill) }));
      }
      delete layer.refId;
      layer.ty = 4;
      layer.shapes = shapes;
    }
  };
  visit(anim.layers);
  for (const a of anim.assets) if (a.layers) visit(a.layers);
  anim.assets = anim.assets.filter((a) => a !== img);
  return true;
}

/**
 * Classic Lottie mattes: the matte (`td`) sits immediately before the layer it
 * cuts (`tt`). AE's "any layer as matte" instead points at it with `tp`, from
 * anywhere in the stack. Matte layers never render themselves, so moving one
 * changes no z-order.
 */
export function normalizeMattes(layers) {
  const pointedAt = new Set(layers.filter((l) => l.tt && l.tp != null).map((l) => l.tp));
  const parents = new Set(layers.map((l) => l.parent).filter((p) => p != null));
  const byInd = new Map(layers.map((l) => [l.ind, l]));
  const out = [];
  layers.forEach((layer, idx) => {
    if (layer.td) {
      if (pointedAt.has(layer.ind)) return; // re-inserted just before its target
      const next = layers[idx + 1];
      const classicMatte = next?.tt && next.tp == null;
      if (!classicMatte && !parents.has(layer.ind)) return; // matte nothing uses
    }
    if (layer.tt && layer.tp != null) {
      const matte = byInd.get(layer.tp);
      if (!matte) throw new Error(`Layer "${layer.nm}" uses missing matte layer #${layer.tp}`);
      out.push(matte);
      delete layer.tp;
    }
    out.push(layer);
  });
  return out;
}

/**
 * Move every top-level layer by `dy`, except full-frame solids (the background
 * would otherwise leave a strip uncovered). Parented layers follow their parent.
 */
export function offsetContent(anim, dy) {
  // `index` is where y lives: 1 in an [x, y, z] position, 0 in a split-out y.
  const shiftY = (prop, index) => {
    if (prop.a) {
      for (const key of prop.k) {
        if (key.s) key.s[index] += dy;
        if (key.e) key.e[index] += dy;
      }
    } else if (Array.isArray(prop.k)) {
      prop.k[index] += dy;
    } else {
      prop.k += dy;
    }
  };
  for (const layer of anim.layers) {
    if (layer.parent != null || !layer.ks?.p) continue;
    if (layer.ty === 1 && layer.sw === anim.w && layer.sh === anim.h) continue;
    const p = layer.ks.p;
    if (p.s === true) shiftY(p.y, 0);
    else shiftY(p, 1);
  }
}

export function prepareIntro(anim, letteringSvg, { offsetY = CONTENT_OFFSET_Y } = {}) {
  const out = structuredClone(anim);
  const audioIds = new Set(out.assets.filter((a) => a.t === 2).map((a) => a.id));
  const dropAudio = (layers) => layers.filter((l) => l.ty !== 6);
  out.layers = normalizeMattes(dropAudio(out.layers));
  for (const a of out.assets) if (a.layers) a.layers = normalizeMattes(dropAudio(a.layers));
  out.assets = out.assets.filter((a) => !audioIds.has(a.id));
  if (!replaceWordmark(out, parseLetteringSvg(letteringSvg))) {
    throw new Error('Wordmark image (6085×729) not found in the export');
  }
  offsetContent(out, offsetY);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [src, dest = join(ROOT, 'apps/mobile/assets/intro/cultuvilla-intro.json')] = process.argv.slice(2);
  if (!src) {
    console.error('usage: node scripts/prepare-intro-lottie.mjs <export.json> [out.json]');
    process.exit(1);
  }
  const out = prepareIntro(JSON.parse(readFileSync(src, 'utf8')), readFileSync(LETTERING_SVG, 'utf8'));
  writeFileSync(dest, JSON.stringify(out));
  console.log(`wrote ${dest}`);
}
