// Handler test for ogRenderer. Seeds Firestore via the admin SDK against the
// Firestore emulator, mocks the SPA-shell module so the renderer doesn't try
// to reach Firebase Hosting, and invokes the v2 onRequest export directly
// with a minimal req/res shim.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { resetEmulators } from '../../helpers/firestoreEmulator';

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
      endDate: null,
      location: { type: 'text', coordinates: null, text: 'plaza' },
      imageURL: 'https://cdn.example/event-e1.jpg',
      maxAttendees: null,
      telephoneRequired: false,
      status: 'published',
      organizationId: 'org-1',
      organizationName: 'Org 1',
      createdBy: 'creator-1',
      createdAt: now,
      updatedAt: now,
      municipalityId: 'mun-1',
      municipalityName: 'Villarriba',
      municipalityCoverImage: null,
      municipalityCoordinates: null,
    });

    const res = await invoke('/event/e1');

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
  });

  it('village: uses community cover image when present', async () => {
    await admin.firestore().doc('municipalities/mun-1').set({
      name: 'Villarriba',
      nameLower: 'villarriba',
      province: 'Valladolid',
      provinceLower: 'valladolid',
      comunidadAutonoma: 'Castilla y León',
      comunidadAutonomaLower: 'castilla y leon',
      codigoINE: '47001',
      coordinates: null,
      escudoUrl: 'https://cdn.example/escudo.png',
      escudoThumbUrl: null,
      escudoManualUrl: null,
      community: {
        description: 'Comunidad pequeña pero apañada',
        coverImages: ['https://cdn.example/village-mun1.jpg'],
        adminUserId: 'admin-1',
        createdAt: new Date(),
      },
      communityActive: true,
    });

    const res = await invoke('/village/mun-1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Villarriba</title>');
    expect(res.body).toContain('property="og:description" content="Comunidad pequeña pero apañada"');
    expect(res.body).toContain('property="og:image" content="https://cdn.example/village-mun1.jpg"');
  });

  it('village invite variant uses the same og as the view URL', async () => {
    await admin.firestore().doc('municipalities/mun-2').set({
      name: 'Villabajo',
      nameLower: 'villabajo',
      province: 'Valladolid',
      provinceLower: 'valladolid',
      comunidadAutonoma: 'Castilla y León',
      comunidadAutonomaLower: 'castilla y leon',
      codigoINE: '47002',
      coordinates: null,
      escudoUrl: null,
      escudoThumbUrl: null,
      escudoManualUrl: null,
      community: {
        description: 'Pueblo bonito',
        coverImages: [],
        adminUserId: 'admin-2',
        createdAt: new Date(),
      },
      communityActive: true,
    });

    const view = await invoke('/village/mun-2');
    const invite = await invoke('/village/mun-2/join');

    expect(view.body).toContain('<title>Villabajo</title>');
    expect(invite.body).toContain('<title>Villabajo</title>');
    expect(invite.body).toContain('property="og:description" content="Pueblo bonito"');
    expect(invite.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=3600');
  });

  it('organization: injects org name + description + image', async () => {
    await admin.firestore().doc('organizations/org-1').set({
      name: 'Peña Los Sauces',
      description: 'Una peña activa',
      imageURL: 'https://cdn.example/org-1.jpg',
      municipalityId: 'mun-1',
      type: 'pena',
      status: 'approved',
      createdBy: 'creator',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const view = await invoke('/o/org-1');
    const invite = await invoke('/o/org-1/join');

    expect(view.body).toContain('<title>Peña Los Sauces</title>');
    expect(view.body).toContain('property="og:image" content="https://cdn.example/org-1.jpg"');
    expect(invite.body).toContain('<title>Peña Los Sauces</title>');
  });

  it('news: title + description present, og:image omitted gracefully when signing fails', async () => {
    await admin.firestore().doc('news/n1').set({
      title: 'Anuncio del ayuntamiento',
      body: 'Se aprueba el presupuesto para la fiesta mayor.',
      category: 'fiesta',
      authorUserId: 'admin-1',
      authorOrgId: null,
      images: [],
      municipalityId: 'mun-1',
      municipalityName: 'Villarriba',
      submittedAt: new Date(),
      publishedAt: new Date(),
      status: 'approved',
      reactionCounts: { like: 0, heart: 0 },
      commentCount: 0,
      reportCount: 0,
    });

    const res = await invoke('/news/n1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Anuncio del ayuntamiento</title>');
    expect(res.body).toContain('Se aprueba el presupuesto para la fiesta mayor.');
    // No images on the doc, so no og:image tag.
    expect(res.body).not.toContain('property="og:image"');
  });

  it('missing doc: returns 200 with default og tags', async () => {
    const res = await invoke('/event/does-not-exist');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Cultuvilla</title>');
    expect(res.body).toContain('property="og:title" content="Cultuvilla"');
  });

  it('unmatched URL pattern: returns 200 with default og tags', async () => {
    const res = await invoke('/event/nested/deeper/path');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('property="og:title" content="Cultuvilla"');
  });

  it('description trimmed to ~200 chars with ellipsis', async () => {
    const longBody = 'a'.repeat(500);
    await admin.firestore().doc('news/n-long').set({
      title: 'Long',
      body: longBody,
      category: 'otro',
      authorUserId: 'u',
      authorOrgId: null,
      images: [],
      municipalityId: 'mun-1',
      municipalityName: 'V',
      submittedAt: new Date(),
      publishedAt: new Date(),
      status: 'approved',
      reactionCounts: { like: 0, heart: 0 },
      commentCount: 0,
      reportCount: 0,
    });

    const res = await invoke('/news/n-long');
    const match = /property="og:description" content="(a+…)"/.exec(res.body);
    expect(match).not.toBeNull();
    const description = match?.[1] ?? '';
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description.endsWith('…')).toBe(true);
  });
});
