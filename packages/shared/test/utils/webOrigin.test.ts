import { describe, it, expect } from 'vitest';
import { webOriginForProject } from '../../src/utils/webOrigin';
import { eventWebUrl } from '../../src/email/registrationEmailTemplate';

describe('webOriginForProject', () => {
  // Prod answers on two hosts. Every URL the server emits must name the brand
  // one, or cultuvilla.es and cultuvilla-prod.web.app compete in the index.
  it('names the brand domain on prod, never the web.app alias', () => {
    expect(webOriginForProject('cultuvilla-prod')).toBe('https://cultuvilla.es');
  });

  it('falls back to the project web.app host everywhere else', () => {
    expect(webOriginForProject('villa-events')).toBe('https://villa-events.web.app');
    expect(webOriginForProject('cultuvilla-beta')).toBe('https://cultuvilla-beta.web.app');
  });

  it('defaults to dev when the project is unknown', () => {
    expect(webOriginForProject(undefined)).toBe('https://villa-events.web.app');
    expect(webOriginForProject('')).toBe('https://villa-events.web.app');
  });
});

describe('eventWebUrl', () => {
  const event = { id: 'e1', title: 'Fiesta de San Roque', villageSlug: 'matabuena' };

  it('sends prod email recipients to the brand domain, on the village-first path', () => {
    expect(eventWebUrl(event, 'cultuvilla-prod')).toBe(
      'https://cultuvilla.es/matabuena/evento/fiesta-de-san-roque_e1',
    );
  });

  it('uses the project web.app host everywhere else', () => {
    expect(eventWebUrl(event, 'villa-events')).toBe(
      'https://villa-events.web.app/matabuena/evento/fiesta-de-san-roque_e1',
    );
  });
});
