import { describe, it, expect } from 'vitest';
import { faviconUrl, hostnameOf, monogram, monogramColorIndex } from './logo';

describe('hostnameOf', () => {
  it('strips www and the protocol', () => {
    expect(hostnameOf('https://www.codinse.com/leader')).toBe('codinse.com');
  });

  it('returns null for a [[confirmar]] placeholder', () => {
    // Most registry entities start life unverified; that must not become a
    // request to an icon service for the literal string "[[confirmar]]".
    expect(hostnameOf('[[confirmar]]')).toBeNull();
    expect(hostnameOf('[[confirmar: web oficial de CODINSE]]')).toBeNull();
  });

  it('returns null for undefined, empty and non-URL text', () => {
    expect(hostnameOf(undefined)).toBeNull();
    expect(hostnameOf('')).toBeNull();
    expect(hostnameOf('no es una url')).toBeNull();
  });

  it('refuses a non-http scheme', () => {
    expect(hostnameOf('javascript:alert(1)')).toBeNull();
    expect(hostnameOf('data:text/html,hi')).toBeNull();
  });
});

describe('faviconUrl', () => {
  it('builds an icon URL for a real domain', () => {
    expect(faviconUrl('https://asociacionepa.org')).toBe('https://icons.duckduckgo.com/ip3/asociacionepa.org.ico');
  });

  it('is null whenever there is no usable domain', () => {
    expect(faviconUrl('[[confirmar]]')).toBeNull();
    expect(faviconUrl(undefined)).toBeNull();
  });
});

describe('monogram', () => {
  it('takes the initials of the first two meaningful words', () => {
    expect(monogram('ADEFO Cinco Villas')).toBe('AC');
    expect(monogram('Segovia Sur')).toBe('SS');
  });

  it('skips connecting words that carry no signal', () => {
    expect(monogram('Fundación Daniel y Nina Carasso')).toBe('FD');
    expect(monogram('Ministerio de Cultura')).toBe('MC');
  });

  it('uses two letters of a single word', () => {
    expect(monogram('CODINSE')).toBe('CO');
  });

  it('ignores punctuation and handles accents', () => {
    expect(monogram('Enraíza Derechos')).toBe('ED');
    expect(monogram('¡Chispa! Galera')).toBe('CG');
    expect(monogram('EPA! (@epa.asociacion)')).toBe('EE');
  });

  it('never returns an empty string', () => {
    expect(monogram('')).toBe('·');
    expect(monogram('—')).toBe('·');
    expect(monogram('de la')).toBe('·');
  });
});

describe('monogramColorIndex', () => {
  it('is stable for the same id', () => {
    expect(monogramColorIndex('codinse', 5)).toBe(monogramColorIndex('codinse', 5));
  });

  it('stays inside the palette', () => {
    for (const id of ['epa-asociacion', 'codinse', 'segovia-sur', 'fundacion-carasso', 'a-regenerar']) {
      const index = monogramColorIndex(id, 5);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
    }
  });

  it('spreads real entity ids across more than one colour', () => {
    const ids = ['epa-asociacion', 'codinse', 'segovia-sur', 'fundacion-carasso', 'a-regenerar', 'adefoincovillas'];
    const used = new Set(ids.map((id) => monogramColorIndex(id, 5)));
    expect(used.size).toBeGreaterThan(1);
  });
});
