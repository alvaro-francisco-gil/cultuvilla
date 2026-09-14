// Handler test for ogRenderer. Seeds Firestore via the admin SDK against the
// Firestore emulator, mocks the SPA-shell module so the renderer doesn't try
// to reach Firebase Hosting, and invokes the v2 onRequest export directly
// with a minimal req/res shim.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { resetEmulators } from '../../helpers/firestoreEmulator';
import { webOriginForProject } from '@cultuvilla/shared/utils';

// Canonical URLs name the project's public origin, never the request host.
const ORIGIN = webOriginForProject(process.env['GCLOUD_PROJECT']);

const SHELL =
  '<!doctype html><html lang="en"><head>' +
  '<meta charset="utf-8"/>' +
  '<title data-rh="true">old</title>' +
  '<meta property="og:title" content="stale"/>' +
  '</head><body><div id="root"></div></body></html>';

// Mock the SPA shell module so we don't fetch over the network. Scoped to
// this file so other handler tests are unaffected. vi.mock is hoisted above
// the import below, so the renderer picks up the mocked spaShell.
vi.mock('../../../og/spaShell', () => ({
  getSpaShell: vi.fn(() => Promise.resolve(SHELL)),
  _resetSpaShellCache: vi.fn(),
}));

import { ogRenderer } from '../../../og/render';

import { EventEmitter } from 'node:events';

interface ResShim extends EventEmitter {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  status(code: number): ResShim;
  set(key: string, value: string): ResShim;
  send(body: string): ResShim;
}

function shim(pathname: string): { req: unknown; res: ResShim } {
  const req = Object.assign(new EventEmitter(), {
    get(name: string): string | undefined {
      const lower = name.toLowerCase();
      if (lower === 'host') return 'example.com';
      if (lower === 'x-forwarded-proto') return 'https';
      return undefined;
    },
    originalUrl: pathname,
  });
  const res = Object.assign(new EventEmitter(), {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    status(code: number) {
      (res as ResShim).statusCode = code;
      return res as ResShim;
    },
    set(key: string, value: string) {
      (res as ResShim).headers[key] = value;
      return res as ResShim;
    },
    send(b: string) {
      (res as ResShim).body = b;
      return res as ResShim;
    },
  }) as ResShim;
  return { req, res };
}

async function invoke(pathname: string): Promise<ResShim> {
  const { req, res } = shim(pathname);
  // v2 onRequest returns a function callable as an Express handler.
  await (ogRenderer as unknown as (req: unknown, res: ResShim) => Promise<void>)(req, res);
  return res;
}

beforeEach(async () => {
  await resetEmulators();
});

describe('ogRenderer', () => {
  it('event: injects og:* from the event doc', async () => {
    const now = new Date();
    await admin.firestore().doc('events/e1').set({
      title: 'Fiesta del Pueblo',
      description: 'Una gran fiesta el sábado',
      startDate: now,
      location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'plaza' },
      imageURL: 'https://cdn.example/event-e1.jpg',
      maxAttendees: null,
      telephoneRequired: false,
      status: 'published',
      organizerUserIds: ['creator-1'],
      organizerOrgIds: [],
      createdBy: 'creator-1',
      createdAt: now,
      updatedAt: now,
      municipalityId: 'mun-1',
      villageName: 'Villarriba',
      villageSlug: 'villarriba',
      villageCoverImage: null,
      villageCoordinates: null,
    });

    const res = await invoke('/villarriba/evento/fiesta-del-pueblo_e1');

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=3600');
    expect(res.body).toContain('<title>Fiesta del Pueblo</title>');
    expect(res.body).toContain('property="og:title" content="Fiesta del Pueblo"');
    expect(res.body).toContain('property="og:description" content="Una gran fiesta el sábado"');
    expect(res.body).toContain('property="og:image" content="https://cdn.example/event-e1.jpg"');
    expect(res.body).toContain('name="twitter:card" content="summary_large_image"');
    // Stale tags from the shell are stripped.
    expect(res.body).not.toContain('content="stale"');
    // SPA shell body survives so real users still hydrate.
    expect(res.body).toContain('<div id="root">');
    // Server-rendered content lands before #root, so React's first commit
    // cannot destroy it and the crawler sees real markup, not an empty shell.
    expect(res.body).toContain('id="seo-content"');
    expect(res.body.indexOf('id="seo-content"')).toBeLessThan(res.body.indexOf('id="root"'));
    expect(res.body).toContain('Fiesta del Pueblo');
    expect(res.body).toContain('"@type":"Event"');
    expect(res.body).toContain(
      `<link rel="canonical" href="${ORIGIN}/villarriba/evento/fiesta-del-pueblo_e1"/>`,
    );
    // The request arrived on example.com; the canonical must not follow it, or
    // prod's two hosts each declare themselves canonical.
    expect(res.body).not.toContain('href="https://example.com/');
    expect(res.body).not.toContain('name="robots"');
  });

  it('event: a query string does not fork the canonical URL', async () => {
    const now = new Date();
    await admin.firestore().doc('events/e-utm').set({
      title: 'Fiesta',
      description: 'x',
      startDate: now,
      location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'plaza' },
      imageURL: null,
      maxAttendees: null,
      telephoneRequired: false,
      status: 'published',
      organizerUserIds: ['c1'],
      organizerOrgIds: [],
      createdBy: 'c1',
      createdAt: now,
      updatedAt: now,
      municipalityId: 'mun-1',
      villageName: 'Villarriba',
      villageSlug: 'villarriba',
      villageCoverImage: null,
      villageCoordinates: null,
    });

    const res = await invoke('/villarriba/evento/fiesta_e-utm?utm_source=whatsapp');

    expect(res.body).toContain(`<link rel="canonical" href="${ORIGIN}/villarriba/evento/fiesta_e-utm"/>`);
    expect(res.body).not.toContain('utm_source');
  });

  it('village: resolves the pueblo by its slug, not its doc id', async () => {
    const now = new Date();
    await admin.firestore().doc('municipalities/mun-slug').set({
      name: 'Villarriba',
      nameLower: 'villarriba',
      nameAliases: [],
      localityNames: [],
      searchPrefixes: [],
      province: 'Segovia',
      comunidadAutonoma: 'Castilla y León',
      codigoINE: '40001',
      slug: 'villarriba',
      coordinates: null,
      createdAt: now,
      communityActive: true,
      community: { description: 'Un pueblo' },
    });

    const bySlug = await invoke('/villarriba');
    expect(bySlug.statusCode).toBe(200);
    expect(bySlug.body).toContain('<title>Villarriba</title>');
    expect(bySlug.body).not.toContain('name="robots"');

    expect(bySlug.body).toContain('id="seo-content"');

    const byId = await invoke('/mun-slug');
    expect(byId.body).toContain('property="og:title" content="Cultuvilla"');
  });

  // A link preview is rendered for whoever scrolls past the URL, with no viewer
  // to authorize — so a private event's card must say nothing but that it is
  // private. This is the one place the org boundary cannot be enforced by
  // checking who is asking.
  it('event: a private event leaks no title, description or image', async () => {
    const now = new Date();
    await admin.firestore().doc('events/e-priv').set({
      title: 'Cena secreta de la peña',
      description: 'En el local, a las 21h',
      startDate: now,
      location: { coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'local' },
      imageURL: 'https://cdn.example/event-priv.jpg',
      maxAttendees: null,
      telephoneRequired: false,
      status: 'published',
      visibility: 'organization',
      visibilityOrgId: 'org-1',
      organizerUserIds: ['creator-1'],
      organizerOrgIds: ['org-1'],
      createdBy: 'creator-1',
      createdAt: now,
      updatedAt: now,
      municipalityId: 'mun-1',
      villageName: 'Villarriba',
      villageSlug: 'villarriba',
      villageCoverImage: 'https://cdn.example/village.jpg',
      villageCoordinates: null,
    });

    const res = await invoke('/villarriba/evento/evento-privado_e-priv');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Evento privado');
    expect(res.body).not.toContain('Cena secreta');
    expect(res.body).not.toContain('En el local');
    expect(res.body).not.toContain('event-priv.jpg');
    expect(res.body).not.toContain('village.jpg');
    // Withheld content must not rank either: a search result would otherwise
    // promise a reader something the page will refuse to show them.
    expect(res.body).toContain('<meta name="robots" content="noindex,follow"/>');
    expect(res.body).not.toContain('"@type":"Event"');
    expect(res.body).not.toContain('id="seo-content"');
  });

  it('event: the redirect for a private event does not spell out its title', async () => {
    const now = new Date();
    await admin.firestore().doc('events/e-priv2').set({
      title: 'Cena secreta',
      description: 'x',
      startDate: now,
      location: { coordinates: null, displayName: 'local' },
      status: 'published',
      visibility: 'organization',
      visibilityOrgId: 'org-1',
      municipalityId: 'mun-1',
      villageName: 'Villarriba',
      villageSlug: 'villarriba',
    });

    const res = await invoke('/villarriba/evento/cena-secreta_e-priv2');

    expect(res.statusCode).toBe(301);
    expect(res.headers['Location']).toBe('/villarriba/evento/evento-privado_e-priv2');
  });

  it('event: a stale title or a wrong pueblo redirects permanently to the canonical path', async () => {
    const now = new Date();
    await admin.firestore().doc('events/e-moved').set({
      title: 'Fiestas de San Roque',
      description: 'x',
      startDate: now,
      location: { coordinates: null, displayName: 'plaza' },
      status: 'published',
      municipalityId: 'mun-1',
      villageName: 'Villarriba',
      villageSlug: 'villarriba',
    });

    const stale = await invoke('/villarriba/evento/fiestas-de-san-rocke_e-moved?utm_source=whatsapp');
    expect(stale.statusCode).toBe(301);
    expect(stale.headers['Location']).toBe(
      '/villarriba/evento/fiestas-de-san-roque_e-moved?utm_source=whatsapp',
    );

    const wrongVillage = await invoke('/villabajo/evento/fiestas-de-san-roque_e-moved');
    expect(wrongVillage.headers['Location']).toBe('/villarriba/evento/fiestas-de-san-roque_e-moved');

    const canonical = await invoke('/villarriba/evento/fiestas-de-san-roque_e-moved/');
    expect(canonical.statusCode).toBe(200);
  });

  it('village: uses escudoManualUrl as og:image when present', async () => {
    await admin.firestore().doc('municipalities/mun-1').set({
      name: 'Villarriba',
      nameLower: 'villarriba',
      nameAliases: [],
      localityNames: [],
      searchPrefixes: ['v', 'vi', 'vil', 'vill', 'villa', 'villar', 'villarr', 'villarri', 'villarrib', 'villarriba'],
      province: 'Valladolid',
      provinceLower: 'valladolid',
      comunidadAutonoma: 'Castilla y León',
      comunidadAutonomaLower: 'castilla y leon',
      codigoINE: '47001',
      slug: 'villarriba',
      coordinates: null,
      escudoUrl: 'https://cdn.example/escudo.png',
      escudoThumbUrl: null,
      escudoManualUrl: 'https://x/manual.png',
      community: {
        description: 'Comunidad pequeña pero apañada',
        organizerId: 'admin-1',
        createdAt: new Date(),
        fiestas: [],
      },
      communityActive: true,
    });

    const res = await invoke('/villarriba');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Villarriba</title>');
    expect(res.body).toContain('property="og:description" content="Comunidad pequeña pero apañada"');
    expect(res.body).toContain('property="og:image" content="https://x/manual.png"');
  });

  it('village: falls back to escudoUrl when escudoManualUrl is absent', async () => {
    await admin.firestore().doc('municipalities/mun-1b').set({
      name: 'Villarriba B',
      nameLower: 'villarriba b',
      nameAliases: [],
      localityNames: [],
      searchPrefixes: ['b', 'v', 'vi', 'vil', 'vill', 'villa', 'villar', 'villarr', 'villarri', 'villarrib', 'villarriba', 'villarriba ', 'villarriba b'],
      province: 'Valladolid',
      provinceLower: 'valladolid',
      comunidadAutonoma: 'Castilla y León',
      comunidadAutonomaLower: 'castilla y leon',
      codigoINE: '47001b',
      slug: 'villarriba-b',
      coordinates: null,
      escudoUrl: 'https://cdn.example/escudo-fallback.png',
      escudoThumbUrl: null,
      escudoManualUrl: null,
      community: {
        description: 'Comunidad con escudo genérico',
        organizerId: 'admin-1',
        createdAt: new Date(),
        fiestas: [],
      },
      communityActive: true,
    });

    const res = await invoke('/villarriba-b');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('property="og:image" content="https://cdn.example/escudo-fallback.png"');
  });

  it('village: falls back to escudoThumbUrl when manual and full escudo are absent', async () => {
    await admin.firestore().doc('municipalities/mun-1c').set({
      name: 'Villarriba C',
      nameLower: 'villarriba c',
      nameAliases: [],
      localityNames: [],
      searchPrefixes: ['c', 'v', 'vi', 'vil', 'vill', 'villa', 'villar', 'villarr', 'villarri', 'villarrib', 'villarriba', 'villarriba ', 'villarriba c'],
      province: 'Valladolid',
      provinceLower: 'valladolid',
      comunidadAutonoma: 'Castilla y León',
      comunidadAutonomaLower: 'castilla y leon',
      codigoINE: '47001c',
      slug: 'villarriba-c',
      coordinates: null,
      escudoUrl: null,
      escudoThumbUrl: 'https://cdn.example/escudo-thumb.png',
      escudoManualUrl: null,
      community: {
        description: 'Comunidad con solo miniatura de escudo',
        organizerId: 'admin-1',
        createdAt: new Date(),
        fiestas: [],
      },
      communityActive: true,
    });

    const res = await invoke('/villarriba-c');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('property="og:image" content="https://cdn.example/escudo-thumb.png"');
  });

  it('organization: injects org name + description + image', async () => {
    await admin.firestore().doc('organizations/org-1').set({
      name: 'Peña Los Sauces',
      description: 'Una peña activa',
      images: ['https://cdn.example/org-1.jpg'],
      municipalityId: 'mun-1',
      villageSlug: 'villarriba',
      type: 'pena',
      status: 'approved',
      createdBy: 'creator',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const view = await invoke('/villarriba/entidad/pena-los-sauces_org-1');
    const invite = await invoke('/villarriba/entidad/pena-los-sauces_org-1/unirse');

    expect(view.body).toContain('<title>Peña Los Sauces</title>');
    expect(view.body).toContain('property="og:image" content="https://cdn.example/org-1.jpg"');
    expect(view.body).not.toContain('name="robots"');
    // An invite is reachable but never indexable — and keeps its /unirse suffix
    // rather than being redirected to the plain view.
    expect(invite.statusCode).toBe(200);
    expect(invite.body).toContain('<title>Peña Los Sauces</title>');
    expect(invite.body).toContain('<meta name="robots" content="noindex,follow"/>');
  });

  it('news: title + description present, og:image omitted gracefully when signing fails', async () => {
    await admin.firestore().doc('news/n1').set({
      title: 'Anuncio del ayuntamiento',
      body: 'Se aprueba el presupuesto para la fiesta mayor.',
      category: 'fiesta',
      createdBy: 'admin-1',
      organizerUserIds: ['admin-1'],
      organizerOrgIds: [],
      images: [],
      municipalityId: 'mun-1',
      villageSlug: 'villarriba',
      submittedAt: new Date(),
      publishedAt: new Date(),
      status: 'approved',
      readCount: 0,
      commentCount: 0,
      reportCount: 0,
    });

    const res = await invoke('/villarriba/noticia/anuncio-del-ayuntamiento_n1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Anuncio del ayuntamiento</title>');
    expect(res.body).toContain('Se aprueba el presupuesto para la fiesta mayor.');
    // No images on the doc, so no og:image tag.
    expect(res.body).not.toContain('property="og:image"');
  });

  it('missing doc: answers 404 + noindex, still serving the shell', async () => {
    const res = await invoke('/villarriba/evento/x_does-not-exist');

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('<title>Cultuvilla</title>');
    expect(res.body).toContain('property="og:title" content="Cultuvilla"');
    expect(res.body).toContain('<meta name="robots" content="noindex,follow"/>');
  });

  it('unknown pueblo: answers 404 rather than a page that calls itself canonical', async () => {
    const res = await invoke('/pueblo-que-no-existe');

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('<meta name="robots" content="noindex,follow"/>');
  });

  it('unmatched URL pattern: returns 200 with default og tags', async () => {
    const res = await invoke('/villarriba/evento/nested/deeper/path');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('property="og:title" content="Cultuvilla"');
  });

  it('invalid Firestore id: returns 200 with default og instead of 500', async () => {
    // Firestore-reserved ids (__x__) make .doc() throw INVALID_ARGUMENT. A
    // crawler hitting such a URL must still get a valid 200 default preview,
    // not a 500 Internal Server Error.
    const res = await invoke('/villarriba/evento/x___reserved__');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('property="og:title" content="Cultuvilla"');
  });

  it('description trimmed to ~200 chars with ellipsis', async () => {
    const longBody = 'a'.repeat(500);
    await admin.firestore().doc('news/n-long').set({
      title: 'Long',
      body: longBody,
      category: 'otro',
      createdBy: 'u',
      organizerUserIds: ['u'],
      organizerOrgIds: [],
      images: [],
      municipalityId: 'mun-1',
      villageSlug: 'v',
      submittedAt: new Date(),
      publishedAt: new Date(),
      status: 'approved',
      readCount: 0,
      commentCount: 0,
      reportCount: 0,
    });

    const res = await invoke('/v/noticia/long_n-long');
    const match = /property="og:description" content="(a+…)"/.exec(res.body);
    expect(match).not.toBeNull();
    const description = match?.[1] ?? '';
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith('…')).toBe(true);
  });
});
