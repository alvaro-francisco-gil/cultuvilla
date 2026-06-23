import { createI18n } from '../i18n';

describe('createI18n', () => {
  it('returns a value for a known key', () => {
    const messages = { es: { feed: { title: 'Eventos' } } };
    const i18n = createI18n(messages, 'es');
    expect(i18n.t('feed.title')).toBe('Eventos');
  });

  it('returns the key itself when missing', () => {
    const i18n = createI18n({ es: {} }, 'es');
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('falls back to default locale when active locale is missing', () => {
    const messages = { es: { a: 'A' }, en: {} };
    const i18n = createI18n(messages, 'en', 'es');
    expect(i18n.t('a')).toBe('A');
  });

  it('interpolates {placeholders}', () => {
    const messages = { es: { greet: 'Hola {name}' } };
    const i18n = createI18n(messages, 'es');
    expect(i18n.t('greet', { name: 'Alvaro' })).toBe('Hola Alvaro');
  });

  it('selects the "one" ICU plural form and substitutes #', () => {
    const messages = { es: { n: '{count, plural, one {# opción} other {# opciones}}' } };
    const i18n = createI18n(messages, 'es');
    expect(i18n.t('n', { count: 1 })).toBe('1 opción');
  });

  it('selects the "other" ICU plural form for n != 1', () => {
    const messages = { es: { n: '{count, plural, one {# opción} other {# opciones}}' } };
    const i18n = createI18n(messages, 'es');
    expect(i18n.t('n', { count: 3 })).toBe('3 opciones');
    expect(i18n.t('n', { count: 0 })).toBe('0 opciones');
  });

  it('handles an ICU plural block followed by trailing text', () => {
    const messages = {
      es: { b: '{count, plural, one {# vecino ha respondido} other {# vecinos han respondido}} esta pregunta.' },
    };
    const i18n = createI18n(messages, 'es');
    expect(i18n.t('b', { count: 1 })).toBe('1 vecino ha respondido esta pregunta.');
    expect(i18n.t('b', { count: 2 })).toBe('2 vecinos han respondido esta pregunta.');
  });
});
