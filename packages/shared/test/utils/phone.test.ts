import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  flagEmoji,
  formatPhoneE164,
  isValidPhoneNumber,
} from '../../src/utils/phone';

describe('isValidPhoneNumber (Spain, +34)', () => {
  it('accepts 9-digit numbers starting 6/7/8/9', () => {
    expect(isValidPhoneNumber('600123456', '+34')).toBe(true);
    expect(isValidPhoneNumber('712345678', '+34')).toBe(true);
    expect(isValidPhoneNumber('812345678', '+34')).toBe(true);
    expect(isValidPhoneNumber('912345678', '+34')).toBe(true);
  });

  it('ignores spaces and separators', () => {
    expect(isValidPhoneNumber('600 123 456', '+34')).toBe(true);
    expect(isValidPhoneNumber('600-123-456', '+34')).toBe(true);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(isValidPhoneNumber('60012345', '+34')).toBe(false); // 8 digits
    expect(isValidPhoneNumber('6001234567', '+34')).toBe(false); // 10 digits
  });

  it('rejects numbers starting with an invalid leading digit', () => {
    expect(isValidPhoneNumber('123456789', '+34')).toBe(false);
    expect(isValidPhoneNumber('512345678', '+34')).toBe(false);
  });

  it('rejects empty / non-numeric input', () => {
    expect(isValidPhoneNumber('', '+34')).toBe(false);
    expect(isValidPhoneNumber('abcdefghi', '+34')).toBe(false);
  });
});

describe('isValidPhoneNumber (other dial codes)', () => {
  it('accepts 4–14 digit numbers', () => {
    expect(isValidPhoneNumber('1234', '+33')).toBe(true);
    expect(isValidPhoneNumber('12345678901234', '+44')).toBe(true);
  });

  it('rejects too-short and too-long numbers', () => {
    expect(isValidPhoneNumber('123', '+33')).toBe(false);
    expect(isValidPhoneNumber('123456789012345', '+44')).toBe(false);
  });

  it('does not apply the Spanish leading-digit rule', () => {
    expect(isValidPhoneNumber('123456789', '+33')).toBe(true);
  });
});

describe('formatPhoneE164', () => {
  it('prefixes the dial code and strips separators', () => {
    expect(formatPhoneE164('600 123 456', '+34')).toBe('+34600123456');
    expect(formatPhoneE164('123-456', '+33')).toBe('+33123456');
  });
});

describe('country table', () => {
  it('defaults to Spain', () => {
    expect(DEFAULT_PHONE_COUNTRY.code).toBe('ES');
    expect(DEFAULT_PHONE_COUNTRY.dialCode).toBe('+34');
    expect(PHONE_COUNTRIES[0]).toBe(DEFAULT_PHONE_COUNTRY);
  });

  it('has unique dial codes and iso codes', () => {
    expect(new Set(PHONE_COUNTRIES.map((c) => c.code)).size).toBe(PHONE_COUNTRIES.length);
    expect(new Set(PHONE_COUNTRIES.map((c) => c.dialCode)).size).toBe(PHONE_COUNTRIES.length);
  });

  it('derives a flag emoji from the iso code', () => {
    expect(flagEmoji('ES')).toBe('🇪🇸');
    expect(flagEmoji('gb')).toBe('🇬🇧');
  });
});
