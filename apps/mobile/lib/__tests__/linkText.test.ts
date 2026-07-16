import { describe, expect, it } from '@jest/globals';
import { isSafeHttpUrl, detectPastedUrl, applyCustomTextLink, buildLinkRuns, addLinkSpan } from '../linkText';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

describe('isSafeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isSafeHttpUrl('http://x.com')).toBe(true);
    expect(isSafeHttpUrl('https://x.com')).toBe(true);
  });
  it('rejects other schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('ftp://x.com')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
  });
});

describe('detectPastedUrl', () => {
  it('detects a URL inserted as a multi-char chunk', () => {
    const out = detectPastedUrl('ver aquí ', 'ver aquí https://entradas.example.com');
    expect(out).toEqual({ url: 'https://entradas.example.com', offset: 9, length: 28 });
  });
  it('strips trailing punctuation from the detected URL', () => {
    const out = detectPastedUrl('', 'https://x.com.');
    expect(out).toEqual({ url: 'https://x.com', offset: 0, length: 13 });
  });
  it('returns null for a single typed character', () => {
    expect(detectPastedUrl('https://x.co', 'https://x.com')).toBeNull();
  });
  it('returns null when the inserted chunk has no URL', () => {
    expect(detectPastedUrl('hola', 'hola mundo')).toBeNull();
  });
  it('detects a URL pasted over a selection without truncating it', () => {
    // "ver SELECTED tail" with "SELECTED" (offset 4, len 8) replaced by the pasted URL
    const out = detectPastedUrl('ver SELECTED tail', 'ver https://x.com/foo tail');
    expect(out).toEqual({ url: 'https://x.com/foo', offset: 4, length: 17 });
  });
});

describe('applyCustomTextLink', () => {
  it('replaces the URL with display text and records the link span', () => {
    const res = applyCustomTextLink('ver https://x.com ya', [], [],
      { url: 'https://x.com', offset: 4, length: 13 }, 'aquí');
    expect(res.text).toBe('ver aquí ya');
    expect(res.links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
  it('shifts a later mention span by the length delta', () => {
    const mention: NewsMention = { entityType: 'place', entityId: 'p', label: 'Plaza', offset: 18, length: 5 };
    const res = applyCustomTextLink('ver https://x.com en Plaza', [mention], [],
      { url: 'https://x.com', offset: 4, length: 13 }, 'aquí');
    // "https://x.com" (13) -> "aquí" (4): delta -9
    expect(res.mentions[0]!.offset).toBe(9);
  });
});

describe('addLinkSpan', () => {
  it('records a link span over a selection without touching the text', () => {
    const links = addLinkSpan([], 4, 8, 'https://x.com');
    expect(links).toEqual([{ url: 'https://x.com', offset: 4, length: 4 }]);
  });
  it('keeps spans sorted by offset', () => {
    const links = addLinkSpan([{ url: 'https://b.com', offset: 10, length: 2 }], 0, 3, 'https://a.com');
    expect(links.map((l) => l.offset)).toEqual([0, 10]);
  });
  it('is a no-op for a collapsed range', () => {
    expect(addLinkSpan([], 5, 5, 'https://x.com')).toEqual([]);
  });
});

describe('buildLinkRuns', () => {
  it('autolinks a bare URL in plain text', () => {
    const runs = buildLinkRuns('ir a https://x.com hoy', [], []);
    expect(runs).toEqual([
      { text: 'ir a ' },
      { text: 'https://x.com', autoUrl: 'https://x.com' },
      { text: ' hoy' },
    ]);
  });
  it('renders a stored custom-text link run', () => {
    const link = { url: 'https://x.com', offset: 3, length: 4 };
    const runs = buildLinkRuns('ir aquí', [], [link]);
    expect(runs).toEqual([{ text: 'ir ' }, { text: 'aquí', link }]);
  });
  it('does not autolink a URL already inside a stored span', () => {
    const link = { url: 'https://real.com', offset: 0, length: 13 };
    const runs = buildLinkRuns('https://x.com', [], [link]);
    expect(runs).toEqual([{ text: 'https://x.com', link }]);
  });

  it('splits a plain run at mark boundaries', () => {
    const runs = buildLinkRuns('hola mundo', [], [], [{ type: 'bold', offset: 5, length: 5 }]);
    expect(runs).toEqual([
      { text: 'hola ' },
      { text: 'mundo', marks: ['bold'] },
    ]);
  });

  it('tags a link run with a mark when the span covers it', () => {
    const link = { url: 'https://x.com', offset: 3, length: 4 };
    const runs = buildLinkRuns('ir aquí', [], [link], [{ type: 'italic', offset: 3, length: 4 }]);
    expect(runs).toEqual([
      { text: 'ir ' },
      { text: 'aquí', link, marks: ['italic'] },
    ]);
  });

  it('subdivides a mention run when a mark covers only part of it', () => {
    const mention = { entityType: 'place' as const, entityId: 'p', label: 'Plaza Mayor', offset: 0, length: 11 };
    const runs = buildLinkRuns('Plaza Mayor', [mention], [], [{ type: 'bold', offset: 0, length: 5 }]);
    expect(runs).toEqual([
      { text: 'Plaza', mention, marks: ['bold'] },
      { text: ' Mayor', mention },
    ]);
  });

  it('carries multiple overlapping mark types on one run', () => {
    const runs = buildLinkRuns('hola', [], [], [
      { type: 'bold', offset: 0, length: 4 },
      { type: 'underline', offset: 0, length: 4 },
    ]);
    expect(runs).toEqual([{ text: 'hola', marks: ['bold', 'underline'] }]);
  });
});
