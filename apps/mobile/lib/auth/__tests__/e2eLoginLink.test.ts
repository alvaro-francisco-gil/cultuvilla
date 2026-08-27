import {
  E2E_EMULATOR_HOSTS,
  isE2EEmulatorHost,
  parseE2ELoginLink,
} from '../e2eLoginLink';

describe('isE2EEmulatorHost', () => {
  it.each(E2E_EMULATOR_HOSTS)('admits the emulator host %s', (host) => {
    expect(isE2EEmulatorHost(host)).toBe(true);
  });

  // The physics guard: a build talking to real Firebase has no emulatorConfig at
  // all, and one somehow pointed at a routable host must never arm the seam.
  it.each([undefined, null, '', 'firebaseapp.com', '192.168.1.10', '10.0.2.3', '8.8.8.8'])(
    'refuses %p',
    (host) => {
      expect(isE2EEmulatorHost(host)).toBe(false);
    },
  );
});

describe('parseE2ELoginLink', () => {
  it('extracts credentials from the native login link', () => {
    expect(
      parseE2ELoginLink('cultuvilla://?e2eLogin=e2e-user%40cultuvilla.test%7Ce2e-pw'),
    ).toEqual({ email: 'e2e-user@cultuvilla.test', password: 'e2e-pw' });
  });

  // The one-parameter, pipe-separated shape exists because `adb shell am start`
  // eats an unescaped `&`. A regression to two params would arrive here as an
  // email with no password, so pin the shape.
  it('keeps a password containing a URL-significant character intact', () => {
    expect(parseE2ELoginLink('cultuvilla://?e2eLogin=a%40b.test%7Cp%26w%3Dx')).toEqual({
      email: 'a@b.test',
      password: 'p&w=x',
    });
  });

  it('treats a missing separator as an email with no password', () => {
    expect(parseE2ELoginLink('cultuvilla://?e2eLogin=a%40b.test')).toEqual({
      email: 'a@b.test',
      password: '',
    });
  });

  // An empty value is the sign-out link — a *present* param, so it must parse
  // rather than fall through as "not an e2e link".
  it('treats an empty value as a present (sign-out) link', () => {
    expect(parseE2ELoginLink('cultuvilla://?e2eLogin=')).toEqual({
      email: '',
      password: '',
    });
  });

  // Ordinary deep links must fall through untouched — the seam listens on the
  // same URL stream the app's real routing uses.
  it.each([
    'cultuvilla://event/e2e-event-fiesta',
    'cultuvilla://?foo=bar',
    'https://cultuvilla.es/village/x',
    '',
  ])('returns null for the non-e2e link %p', (url) => {
    expect(parseE2ELoginLink(url)).toBeNull();
  });
});
