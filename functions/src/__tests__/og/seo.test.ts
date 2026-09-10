import { describe, it, expect } from 'vitest';
import { injectMeta, injectSeoBody } from '../../og/html';
import { buildJsonLd } from '../../og/jsonLd';
import { buildSeoBody } from '../../og/seoBody';
import type { OgMeta } from '../../og/fetchers';
import { buildSitemapXml, toLastmod } from '../../seo/urls';

/** Narrow `string | null` for the assertions that follow, failing loudly if null. */
function present(value: string | null): string {
  if (value === null) throw new Error('expected a JSON-LD script, got null');
  return value;
}

/** The slice of a schema.org node these assertions read. */
interface LdNode {
  '@type'?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  location?: { '@type'?: string; name?: string };
  address?: { addressRegion?: string };
  geo?: { latitude?: number; longitude?: number };
}

function parseLd(script: string | null): LdNode {
  return JSON.parse(present(script).replace(/^<script[^>]*>|<\/script>$/g, '')) as LdNode;
}

const SHELL =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"/></head>' +
  '<body><div id="root"></div></body></html>';

const EVENT: OgMeta = {
  title: 'Fiestas de Santiago',
  description: 'Tres días de fiesta',
  imageUrl: 'https://cdn.example/f.jpg',
  detail: {
    kind: 'event',
    startDate: '2026-07-25T10:00:00.000Z',
    endDate: '2026-07-27T22:00:00.000Z',
    locationName: 'Plaza Mayor',
    villageName: 'Matabuena',
    municipalityId: 'm1',
    cancelled: false,
  },
};

describe('canonical + robots meta', () => {
  it('always emits a canonical link', () => {
    const html = injectMeta(SHELL, EVENT, 'https://cultuvilla.es/event/abc');
    expect(html).toContain('<link rel="canonical" href="https://cultuvilla.es/event/abc"/>');
  });

  it('emits noindex only when the doc asks for it', () => {
    expect(injectMeta(SHELL, EVENT, 'https://x.es/e/1')).not.toContain('name="robots"');
    const priv = injectMeta(SHELL, { ...EVENT, noindex: true }, 'https://x.es/e/1');
    expect(priv).toContain('<meta name="robots" content="noindex,follow"/>');
  });

  it('strips a stale canonical/robots/ld+json so crawlers see exactly one', () => {
    const stale =
      '<!doctype html><html><head>' +
      '<link rel="canonical" href="https://old.example/"/>' +
      '<meta name="robots" content="noindex"/>' +
      '<script type="application/ld+json">{"@type":"Thing"}</script>' +
      '</head><body><div id="root"></div></body></html>';
    const html = injectMeta(stale, EVENT, 'https://cultuvilla.es/event/abc');
    expect(html).not.toContain('https://old.example/');
    expect(html).not.toContain('"@type":"Thing"');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).not.toContain('name="robots"');
  });
});

describe('buildJsonLd', () => {
  it('describes an event with dates and a place', () => {
    const json = parseLd(buildJsonLd(EVENT, 'https://cultuvilla.es/event/abc'));
    expect(json['@type']).toBe('Event');
    expect(json.startDate).toBe('2026-07-25T10:00:00.000Z');
    expect(json.endDate).toBe('2026-07-27T22:00:00.000Z');
    expect(json.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(json.location).toMatchObject({ '@type': 'Place', name: 'Plaza Mayor' });
  });

  it('marks a cancelled event as cancelled rather than dropping it', () => {
    const detail = { ...EVENT.detail } as Extract<
      NonNullable<OgMeta['detail']>,
      { kind: 'event' }
    >;
    const script = buildJsonLd({ ...EVENT, detail: { ...detail, cancelled: true } }, 'https://x/1');
    expect(script).toContain('EventCancelled');
  });

  it('emits nothing rather than an Event with no startDate', () => {
    const detail = { ...EVENT.detail } as Extract<
      NonNullable<OgMeta['detail']>,
      { kind: 'event' }
    >;
    expect(
      buildJsonLd({ ...EVENT, detail: { ...detail, startDate: null } }, 'https://x/1'),
    ).toBeNull();
  });

  it('emits nothing when the doc carried no structured detail', () => {
    expect(buildJsonLd({ title: 'x', description: '', imageUrl: null }, 'https://x/1')).toBeNull();
  });

  it('escapes < so the payload cannot close its own script tag', () => {
    const script = buildJsonLd(
      { ...EVENT, title: '</script><img src=x onerror=alert(1)>' },
      'https://x/1',
    );
    expect(script).not.toContain('</script><img');
    expect(present(script).match(/<\/script>/g)).toHaveLength(1);
  });

  it('describes a village as a City with its province', () => {
    const json = parseLd(
      buildJsonLd(
        {
          title: 'Matabuena',
          description: '',
          imageUrl: null,
          detail: {
            kind: 'village',
            municipalityId: 'm1',
            province: 'Segovia',
            comunidadAutonoma: 'Castilla y León',
            lat: 41.1,
            lng: -3.7,
          },
        },
        'https://cultuvilla.es/village/m1',
      ),
    );
    expect(json['@type']).toBe('City');
    expect(json.address?.addressRegion).toBe('Segovia');
    expect(json.geo).toMatchObject({ latitude: 41.1, longitude: -3.7 });
  });
});

describe('buildSeoBody / injectSeoBody', () => {
  it('renders the title, image and description as real HTML', () => {
    const block = buildSeoBody(EVENT);
    expect(block).toContain('<h1');
    expect(block).toContain('Fiestas de Santiago');
    expect(block).toContain('Tres días de fiesta');
    expect(block).toContain('https://cdn.example/f.jpg');
  });

  it('formats the event date in Spanish and names the place', () => {
    expect(buildSeoBody(EVENT)).toContain('25 de julio de 2026');
    expect(buildSeoBody(EVENT)).toContain('Plaza Mayor · Matabuena');
  });

  it('escapes markup coming from user content', () => {
    const block = buildSeoBody({ ...EVENT, title: '<script>alert(1)</script>' });
    expect(block).not.toContain('<script>');
    expect(block).toContain('&lt;script&gt;');
  });

  // Expo's shell sets body{overflow:hidden} and #root{height:100%}. A block in
  // the flow pushes the app down and the overflow clips its bottom (tab bar
  // included); an overlay lets the app load underneath and be revealed whole.
  it('covers the viewport instead of pushing the app down', () => {
    const block = buildSeoBody(EVENT);
    expect(block).toMatch(/id="seo-content"[^>]*style="position:fixed;inset:0;/);
  });

  it('inserts the block BEFORE #root so React cannot destroy it on mount', () => {
    const html = injectSeoBody(SHELL, EVENT);
    expect(html.indexOf('id="seo-content"')).toBeLessThan(html.indexOf('id="root"'));
  });

  it('leaves the shell untouched when there is no doc or no #root', () => {
    expect(injectSeoBody(SHELL, null)).toBe(SHELL);
    const noRoot = '<!doctype html><html><head></head><body></body></html>';
    expect(injectSeoBody(noRoot, EVENT)).toBe(noRoot);
  });

  it('still renders the head contract alongside the body block', () => {
    const html = injectSeoBody(injectMeta(SHELL, EVENT, 'https://cultuvilla.es/event/abc'), EVENT);
    expect(html).toContain('<title>Fiestas de Santiago</title>');
    expect(html).toContain('og:image');
    expect(html).toContain('id="seo-content"');
    expect(html).toContain('id="root"');
  });
});

describe('buildSitemapXml', () => {
  it('renders a valid urlset', () => {
    const xml = buildSitemapXml([
      { loc: 'https://cultuvilla.es/', changefreq: 'daily', priority: '1.0' },
      { loc: 'https://cultuvilla.es/village/m1', lastmod: '2026-09-01' },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://cultuvilla.es/village/m1</loc>');
    expect(xml).toContain('<lastmod>2026-09-01</lastmod>');
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  it('escapes ampersands so a query string cannot break the document', () => {
    expect(buildSitemapXml([{ loc: 'https://x.es/a?b=1&c=2' }])).toContain('b=1&amp;c=2');
  });

  it('reads Firestore Timestamps and Dates, and rejects anything else', () => {
    expect(toLastmod(new Date('2026-09-01T10:00:00Z'))).toBe('2026-09-01');
    expect(toLastmod({ toDate: () => new Date('2026-09-02T10:00:00Z') })).toBe('2026-09-02');
    expect(toLastmod('2026-09-03')).toBeNull();
    expect(toLastmod(null)).toBeNull();
  });
});
