/**
 * Phone-number helpers shared by the event sign-up form (and reusable by any
 * future phone field). Validation is dial-code aware: Spain gets the strict
 * national rule (that's our audience); other countries get a permissive
 * digit-count check so foreign visitors can still register.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2, used as the stable key and to derive the flag emoji. */
  code: string;
  /** E.164 dialling prefix, including the leading "+". */
  dialCode: string;
  /** Country name in Spanish (the app locale). */
  name: string;
}

/** The preselected country (España). */
export const DEFAULT_PHONE_COUNTRY: PhoneCountry = { code: 'ES', dialCode: '+34', name: 'España' };

/**
 * Countries offered in the prefix picker. Spain first — it's preselected and
 * the common case. The rest cover the largest foreign-resident / visitor
 * communities in Spanish villages.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  DEFAULT_PHONE_COUNTRY,
  { code: 'PT', dialCode: '+351', name: 'Portugal' },
  { code: 'FR', dialCode: '+33', name: 'Francia' },
  { code: 'GB', dialCode: '+44', name: 'Reino Unido' },
  { code: 'DE', dialCode: '+49', name: 'Alemania' },
  { code: 'IT', dialCode: '+39', name: 'Italia' },
  { code: 'RO', dialCode: '+40', name: 'Rumanía' },
  { code: 'MA', dialCode: '+212', name: 'Marruecos' },
];

/** Regional-indicator flag emoji for an ISO 3166-1 alpha-2 code, e.g. "ES" → 🇪🇸. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/**
 * True when `national` (the number typed after the prefix) is a valid phone
 * number for the given dial code.
 * - Spain (+34): exactly 9 digits starting with 6, 7, 8 or 9.
 * - Everything else: 4–14 digits (E.164 caps the subscriber part at 14 once
 *   the country code is stripped).
 *
 * Spaces and other separators are ignored so "600 123 456" validates.
 */
export function isValidPhoneNumber(national: string, dialCode: string): boolean {
  const digits = national.replace(/\D/g, '');
  if (dialCode === '+34') return /^[6789]\d{8}$/.test(digits);
  return digits.length >= 4 && digits.length <= 14;
}

/** Compose the stored E.164-style value, e.g. ("600123456", "+34") → "+34600123456". */
export function formatPhoneE164(national: string, dialCode: string): string {
  return `${dialCode}${national.replace(/\D/g, '')}`;
}
