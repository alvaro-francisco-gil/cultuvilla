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
  it('sends prod email recipients to the brand domain', () => {
    expect(eventWebUrl('e1', 'cultuvilla-prod')).toBe('https://cultuvilla.es/event/e1');
  });

  it('encodes the event id', () => {
    expect(eventWebUrl('a/b', 'villa-events')).toBe('https://villa-events.web.app/event/a%2Fb');
  });
});
