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
});
