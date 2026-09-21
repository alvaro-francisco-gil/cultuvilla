import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LETTERING_SVG,
  hexToRgba,
  normalizeMattes,
  offsetContent,
  parseLetteringSvg,
  INTRO_BACKGROUND,
  prepareIntro,
  recolorWhite,
  svgPathToLottieShapes,
} from '../prepare-intro-lottie.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SHIPPED = join(ROOT, 'apps/mobile/assets/intro/cultuvilla-intro.json');

test('a straight-edged glyph lands in SVG space with the y axis flipped', () => {
  const [shape] = svgPathToLottieShapes('M0 0L10 0L10 20L0 20Z', 100, 700);
  assert.deepEqual(shape.ks.k.v, [
    [100, 700],
    [110, 700],
    [110, 680],
    [100, 680],
  ]);
  assert.ok(shape.ks.k.i.every(([x, y]) => x === 0 && y === 0));
});

test('a quadratic segment becomes the equivalent cubic tangents', () => {
  const [shape] = svgPathToLottieShapes('M0 0Q30 30 60 0Z', 0, 0);
  // Cubic control points of Q(0,0)→(60,0) via (30,30) are (20,20) and (40,20);
  // flipped by scale(1 -1) they sit below the baseline.
  assert.deepEqual(shape.ks.k.o[0], [20, -20]);
  assert.deepEqual(shape.ks.k.i[1], [-20, -20]);
});

test('the brand lettering parses into its three colour groups', () => {
  const groups = parseLetteringSvg(readFileSync(LETTERING_SVG, 'utf8'));
  assert.deepEqual(
    groups.map((g) => g.fill),
    ['#496345', '#79845f', '#bb5d3a'],
  );
  assert.ok(groups.every((g) => g.shapes.length > 0));
});

test('an any-layer matte moves directly above its target and loses tp', () => {
  const layers = [
    { ind: 1, nm: 'matte', td: 1 },
    { ind: 2, nm: 'other' },
    { ind: 3, nm: 'target', tt: 1, tp: 1 },
  ];
  assert.deepEqual(
    normalizeMattes(layers).map((l) => l.nm),
    ['other', 'matte', 'target'],
  );
  assert.equal(layers[2].tp, undefined);
});

test('a matte nothing uses is dropped; a classic matte is kept', () => {
  const layers = [
    { ind: 1, nm: 'orphan', td: 1 },
    { ind: 2, nm: 'shape' },
    { ind: 3, nm: 'classic matte', td: 1 },
    { ind: 4, nm: 'classic target', tt: 1 },
  ];
  assert.deepEqual(
    normalizeMattes(layers).map((l) => l.nm),
    ['shape', 'classic matte', 'classic target'],
  );
});

test('a matte pointing at a layer missing from the export fails loudly', () => {
  assert.throws(() => normalizeMattes([{ ind: 1, nm: 'cut', tt: 1, tp: 8 }]), /missing matte layer #8/);
});

test('offsetContent moves static, animated and split positions but not the full-frame background', () => {
  const anim = {
    w: 1080,
    h: 1920,
    layers: [
      { ty: 4, ks: { p: { a: 0, k: [540, 960, 0] } } },
      { ty: 4, ks: { p: { a: 1, k: [{ s: [540, 1000, 0] }, { s: [540, 900, 0] }] } } },
      { ty: 4, ks: { p: { s: true, x: { a: 0, k: 540 }, y: { a: 0, k: 960 } } } },
      { ty: 4, parent: 1, ks: { p: { a: 0, k: [0, 0, 0] } } },
      { ty: 1, sw: 1080, sh: 1920, ks: { p: { a: 0, k: [540, 960, 0] } } },
    ],
  };
  offsetContent(anim, -62);
  const [stat, animated, split, child, bg] = anim.layers;
  assert.deepEqual(stat.ks.p.k, [540, 898, 0]);
  assert.deepEqual(
    animated.ks.p.k.map((key) => key.s[1]),
    [938, 838],
  );
  assert.equal(split.ks.p.y.k, 898);
  assert.deepEqual(child.ks.p.k, [0, 0, 0]);
  assert.deepEqual(bg.ks.p.k, [540, 960, 0]);
});

test('recolorWhite turns the white solid and white shapes into the background colour, and nothing else', () => {
  const white = { a: 0, k: [1, 1, 1, 1] };
  const anim = {
    assets: [{ id: 'comp_0', layers: [{ ty: 4, shapes: [{ ty: 'gr', it: [{ ty: 'fl', c: structuredClone(white) }] }] }] }],
    layers: [
      { ty: 1, sc: '#ffffff' },
      { ty: 4, shapes: [{ ty: 'st', c: structuredClone(white) }, { ty: 'fl', c: { a: 0, k: [0.8, 0.39, 0.22, 1] } }] },
      { ty: 4, shapes: [{ ty: 'fl', c: { a: 1, k: [{ t: 0, s: [1, 1, 1, 1] }] } }] },
    ],
  };
  recolorWhite(anim, '#f9f0e8');
  const cream = hexToRgba('#f9f0e8');
  assert.equal(anim.layers[0].sc, '#f9f0e8');
  assert.deepEqual(anim.layers[1].shapes[0].c.k, cream);
  assert.deepEqual(anim.layers[1].shapes[1].c.k, [0.8, 0.39, 0.22, 1]);
  assert.deepEqual(anim.layers[2].shapes[0].c.k[0].s, [1, 1, 1, 1], 'animated colours are left alone');
  assert.deepEqual(anim.assets[0].layers[0].shapes[0].it[0].c.k, cream);
});

test('prepareIntro swaps the wordmark image for vectors and bakes the Fill effect', () => {
  const colorKeys = [
    { t: 86, s: [0.337, 0.376, 0.278, 1] },
    { t: 93, s: [0.475, 0.518, 0.373, 1] },
  ];
  const exported = {
    w: 1080,
    h: 1920,
    assets: [
      { id: 'image_0', w: 6085, h: 729, e: 1, p: 'data:image/png;base64,AAAA' },
      { id: 'audio_0', t: 2, e: 1, p: 'data:audio/mp3;base64,AAAA' },
    ],
    layers: [
      { ind: 1, ty: 2, nm: 'Cul', refId: 'image_0', ks: { p: { a: 0, k: [300, 1300, 0] } } },
      {
        ind: 2,
        ty: 2,
        nm: 'tu',
        refId: 'image_0',
        ks: { p: { a: 0, k: [480, 1300, 0] } },
        ef: [{ mn: 'ADBE Fill', ef: [{ nm: 'Color', v: { a: 1, k: colorKeys } }] }],
      },
      { ind: 3, ty: 6, nm: 'sound', refId: 'audio_0', ks: {} },
    ],
  };

  const out = prepareIntro(exported, readFileSync(LETTERING_SVG, 'utf8'), { offsetY: 0 });

  assert.deepEqual(out.assets, []);
  assert.deepEqual(
    out.layers.map((l) => [l.nm, l.ty, l.refId]),
    [
      ['Cul', 4, undefined],
      ['tu', 4, undefined],
    ],
  );
  const tu = out.layers[1];
  assert.equal(tu.ef, undefined);
  const fill = tu.shapes[0].it.find((it) => it.ty === 'fl');
  assert.deepEqual(fill.c.k[0].s, hexToRgba('#496345'));
  assert.deepEqual(fill.c.k[1].s, colorKeys[1].s);
  assert.equal(exported.layers.length, 3, 'the input is not mutated');
});

test('the shipped intro only uses features every Lottie player renders', () => {
  const anim = JSON.parse(readFileSync(SHIPPED, 'utf8'));
  const problems = [];
  const walkLayers = (layers, where) => {
    for (const l of layers) {
      if (l.ef?.length) problems.push(`${where}/${l.nm}: After Effects effect ${l.ef.map((e) => e.nm)}`);
      if (l.tp != null) problems.push(`${where}/${l.nm}: any-layer matte (tp)`);
      if (l.ty === 2) problems.push(`${where}/${l.nm}: image layer`);
      if (l.ty === 6) problems.push(`${where}/${l.nm}: audio layer`);
    }
  };
  walkLayers(anim.layers, 'root');
  for (const a of anim.assets) {
    if (a.layers) walkLayers(a.layers, a.id);
    else problems.push(`asset ${a.id}: embedded file`);
  }
  assert.deepEqual(problems, []);
});

test('the shipped intro is painted on the app background, with no white left', () => {
  const anim = JSON.parse(readFileSync(SHIPPED, 'utf8'));
  const solids = anim.layers.filter((l) => l.ty === 1).map((l) => l.sc);
  assert.deepEqual(solids, [INTRO_BACKGROUND]);
  assert.ok(!JSON.stringify(anim).includes('"k":[1,1,1,1]'), 'a pure-white static colour remains');
});
