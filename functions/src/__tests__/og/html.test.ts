import { describe, it, expect } from 'vitest';
import { injectMeta } from '../../og/html';

const SHELL =
  '<!doctype html><html lang="en"><head>' +
  '<meta charset="utf-8"/>' +
  '<title data-rh="true">stale</title>' +
  '<meta name="description" content="stale-desc"/>' +
  '<meta property="og:title" content="stale-og"/>' +
  '<meta name="twitter:card" content="summary"/>' +
  '</head><body><div id="root"></div></body></html>';

describe('injectMeta', () => {
  it('injects title, description, og:* and twitter:* tags', () => {
    const html = injectMeta(
      SHELL,
      {
        title: 'Fiesta',
        description: 'Una fiesta en el pueblo',
        imageUrl: 'https://cdn.example/img.jpg',
      },
      'https://cultuvilla.app/event/abc',
    );

    expect(html).toContain('<title>Fiesta</title>');
    expect(html).toContain('<meta name="description" content="Una fiesta en el pueblo"/>');
    expect(html).toContain('<meta property="og:title" content="Fiesta"/>');
    expect(html).toContain('<meta property="og:description" content="Una fiesta en el pueblo"/>');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example/img.jpg"/>');
    expect(html).toContain('<meta property="og:url" content="https://cultuvilla.app/event/abc"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toContain('<meta name="twitter:image" content="https://cdn.example/img.jpg"/>');
  });

  it('strips existing title/og/twitter/description tags from the shell', () => {
    const html = injectMeta(
      SHELL,
      { title: 'New', description: 'New desc', imageUrl: null },
      'https://cultuvilla.app/x',
    );
    expect(html).not.toContain('stale-og');
    expect(html).not.toContain('stale-desc');
    expect(html).not.toContain('>stale<');
    expect(html).not.toContain('content="summary"');
    // SPA's <div id="root"> survives.
    expect(html).toContain('<div id="root">');
  });

  it('omits og:image and twitter:image when imageUrl is null', () => {
    const html = injectMeta(
      SHELL,
      { title: 'T', description: 'D', imageUrl: null },
      'https://cultuvilla.app/x',
    );
    expect(html).not.toContain('property="og:image"');
    expect(html).not.toContain('name="twitter:image"');
  });

  it('falls back to defaults when og is null', () => {
    const html = injectMeta(SHELL, null, 'https://cultuvilla.app/x');
    expect(html).toContain('<title>Cultuvilla</title>');
    expect(html).toContain('property="og:title" content="Cultuvilla"');
  });

  it('escapes HTML-special characters in title and description', () => {
    const html = injectMeta(
      SHELL,
      {
        title: 'Fiesta & <amigos>',
        description: 'Texto con "comillas" & ampersands',
        imageUrl: null,
      },
      'https://cultuvilla.app/x',
    );
    expect(html).toContain('content="Fiesta &amp; &lt;amigos&gt;"');
    expect(html).toContain('content="Texto con &quot;comillas&quot; &amp; ampersands"');
    // The escaped title appears in <title> too.
    expect(html).toContain('<title>Fiesta &amp; &lt;amigos&gt;</title>');
  });

  it('returns a minimal HTML skeleton when the shell has no </head>', () => {
    const broken = '<html><body>nope</body></html>';
    const html = injectMeta(
      broken,
      { title: 'T', description: 'D', imageUrl: null },
      'https://cultuvilla.app/x',
    );
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>T</title>');
    expect(html).toContain('property="og:title" content="T"');
  });
});
