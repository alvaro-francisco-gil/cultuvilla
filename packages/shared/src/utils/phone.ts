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

// Every country/territory the picker offers, minus España (pinned first below).
// Worldwide coverage — foreign residents and visitors of any nationality sign
// up. Dial codes are NOT unique here (the +1 North-American bloc and +7
// Russia/Kazakhstan repeat); the ISO code is the stable key. Names are in
// Spanish (the app locale). Order is irrelevant here — the list is sorted by
// name where PHONE_COUNTRIES is assembled.
const OTHER_PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'AF', dialCode: '+93', name: 'Afganistán' },
  { code: 'AL', dialCode: '+355', name: 'Albania' },
  { code: 'DE', dialCode: '+49', name: 'Alemania' },
  { code: 'AD', dialCode: '+376', name: 'Andorra' },
  { code: 'AO', dialCode: '+244', name: 'Angola' },
  { code: 'AI', dialCode: '+1', name: 'Anguila' },
  { code: 'AG', dialCode: '+1', name: 'Antigua y Barbuda' },
  { code: 'SA', dialCode: '+966', name: 'Arabia Saudí' },
  { code: 'DZ', dialCode: '+213', name: 'Argelia' },
  { code: 'AR', dialCode: '+54', name: 'Argentina' },
  { code: 'AM', dialCode: '+374', name: 'Armenia' },
  { code: 'AW', dialCode: '+297', name: 'Aruba' },
  { code: 'AU', dialCode: '+61', name: 'Australia' },
  { code: 'AT', dialCode: '+43', name: 'Austria' },
  { code: 'AZ', dialCode: '+994', name: 'Azerbaiyán' },
  { code: 'BS', dialCode: '+1', name: 'Bahamas' },
  { code: 'BD', dialCode: '+880', name: 'Bangladés' },
  { code: 'BB', dialCode: '+1', name: 'Barbados' },
  { code: 'BH', dialCode: '+973', name: 'Baréin' },
  { code: 'BE', dialCode: '+32', name: 'Bélgica' },
  { code: 'BZ', dialCode: '+501', name: 'Belice' },
  { code: 'BJ', dialCode: '+229', name: 'Benín' },
  { code: 'BM', dialCode: '+1', name: 'Bermudas' },
  { code: 'BY', dialCode: '+375', name: 'Bielorrusia' },
  { code: 'BO', dialCode: '+591', name: 'Bolivia' },
  { code: 'BA', dialCode: '+387', name: 'Bosnia y Herzegovina' },
  { code: 'BW', dialCode: '+267', name: 'Botsuana' },
  { code: 'BR', dialCode: '+55', name: 'Brasil' },
  { code: 'BN', dialCode: '+673', name: 'Brunéi' },
  { code: 'BG', dialCode: '+359', name: 'Bulgaria' },
  { code: 'BF', dialCode: '+226', name: 'Burkina Faso' },
  { code: 'BI', dialCode: '+257', name: 'Burundi' },
  { code: 'BT', dialCode: '+975', name: 'Bután' },
  { code: 'CV', dialCode: '+238', name: 'Cabo Verde' },
  { code: 'KH', dialCode: '+855', name: 'Camboya' },
  { code: 'CM', dialCode: '+237', name: 'Camerún' },
  { code: 'CA', dialCode: '+1', name: 'Canadá' },
  { code: 'QA', dialCode: '+974', name: 'Catar' },
  { code: 'TD', dialCode: '+235', name: 'Chad' },
  { code: 'CL', dialCode: '+56', name: 'Chile' },
  { code: 'CN', dialCode: '+86', name: 'China' },
  { code: 'CY', dialCode: '+357', name: 'Chipre' },
  { code: 'VA', dialCode: '+379', name: 'Ciudad del Vaticano' },
  { code: 'CO', dialCode: '+57', name: 'Colombia' },
  { code: 'KM', dialCode: '+269', name: 'Comoras' },
  { code: 'CG', dialCode: '+242', name: 'Congo' },
  { code: 'CD', dialCode: '+243', name: 'Congo (Rep. Dem.)' },
  { code: 'KP', dialCode: '+850', name: 'Corea del Norte' },
  { code: 'KR', dialCode: '+82', name: 'Corea del Sur' },
  { code: 'CI', dialCode: '+225', name: 'Costa de Marfil' },
  { code: 'CR', dialCode: '+506', name: 'Costa Rica' },
  { code: 'HR', dialCode: '+385', name: 'Croacia' },
  { code: 'CU', dialCode: '+53', name: 'Cuba' },
  { code: 'CW', dialCode: '+599', name: 'Curazao' },
  { code: 'DK', dialCode: '+45', name: 'Dinamarca' },
  { code: 'DM', dialCode: '+1', name: 'Dominica' },
  { code: 'EC', dialCode: '+593', name: 'Ecuador' },
  { code: 'EG', dialCode: '+20', name: 'Egipto' },
  { code: 'SV', dialCode: '+503', name: 'El Salvador' },
  { code: 'AE', dialCode: '+971', name: 'Emiratos Árabes Unidos' },
  { code: 'ER', dialCode: '+291', name: 'Eritrea' },
  { code: 'SK', dialCode: '+421', name: 'Eslovaquia' },
  { code: 'SI', dialCode: '+386', name: 'Eslovenia' },
  { code: 'US', dialCode: '+1', name: 'Estados Unidos' },
  { code: 'EE', dialCode: '+372', name: 'Estonia' },
  { code: 'SZ', dialCode: '+268', name: 'Esuatini' },
  { code: 'ET', dialCode: '+251', name: 'Etiopía' },
  { code: 'PH', dialCode: '+63', name: 'Filipinas' },
  { code: 'FI', dialCode: '+358', name: 'Finlandia' },
  { code: 'FJ', dialCode: '+679', name: 'Fiyi' },
  { code: 'FR', dialCode: '+33', name: 'Francia' },
  { code: 'GA', dialCode: '+241', name: 'Gabón' },
  { code: 'GM', dialCode: '+220', name: 'Gambia' },
  { code: 'GE', dialCode: '+995', name: 'Georgia' },
  { code: 'GH', dialCode: '+233', name: 'Ghana' },
  { code: 'GI', dialCode: '+350', name: 'Gibraltar' },
  { code: 'GD', dialCode: '+1', name: 'Granada' },
  { code: 'GR', dialCode: '+30', name: 'Grecia' },
  { code: 'GL', dialCode: '+299', name: 'Groenlandia' },
  { code: 'GP', dialCode: '+590', name: 'Guadalupe' },
  { code: 'GU', dialCode: '+1', name: 'Guam' },
  { code: 'GT', dialCode: '+502', name: 'Guatemala' },
  { code: 'GF', dialCode: '+594', name: 'Guayana Francesa' },
  { code: 'GN', dialCode: '+224', name: 'Guinea' },
  { code: 'GQ', dialCode: '+240', name: 'Guinea Ecuatorial' },
  { code: 'GW', dialCode: '+245', name: 'Guinea-Bisáu' },
  { code: 'GY', dialCode: '+592', name: 'Guyana' },
  { code: 'HT', dialCode: '+509', name: 'Haití' },
  { code: 'HN', dialCode: '+504', name: 'Honduras' },
  { code: 'HK', dialCode: '+852', name: 'Hong Kong' },
  { code: 'HU', dialCode: '+36', name: 'Hungría' },
  { code: 'IN', dialCode: '+91', name: 'India' },
  { code: 'ID', dialCode: '+62', name: 'Indonesia' },
  { code: 'IQ', dialCode: '+964', name: 'Irak' },
  { code: 'IR', dialCode: '+98', name: 'Irán' },
  { code: 'IE', dialCode: '+353', name: 'Irlanda' },
  { code: 'IM', dialCode: '+44', name: 'Isla de Man' },
  { code: 'IS', dialCode: '+354', name: 'Islandia' },
  { code: 'KY', dialCode: '+1', name: 'Islas Caimán' },
  { code: 'CK', dialCode: '+682', name: 'Islas Cook' },
  { code: 'FO', dialCode: '+298', name: 'Islas Feroe' },
  { code: 'MH', dialCode: '+692', name: 'Islas Marshall' },
  { code: 'SB', dialCode: '+677', name: 'Islas Salomón' },
  { code: 'TC', dialCode: '+1', name: 'Islas Turcas y Caicos' },
  { code: 'VG', dialCode: '+1', name: 'Islas Vírgenes Británicas' },
  { code: 'VI', dialCode: '+1', name: 'Islas Vírgenes de EE. UU.' },
  { code: 'IL', dialCode: '+972', name: 'Israel' },
  { code: 'IT', dialCode: '+39', name: 'Italia' },
  { code: 'JM', dialCode: '+1', name: 'Jamaica' },
  { code: 'JP', dialCode: '+81', name: 'Japón' },
  { code: 'JE', dialCode: '+44', name: 'Jersey' },
  { code: 'JO', dialCode: '+962', name: 'Jordania' },
  { code: 'KZ', dialCode: '+7', name: 'Kazajistán' },
  { code: 'KE', dialCode: '+254', name: 'Kenia' },
  { code: 'KG', dialCode: '+996', name: 'Kirguistán' },
  { code: 'KI', dialCode: '+686', name: 'Kiribati' },
  { code: 'XK', dialCode: '+383', name: 'Kosovo' },
  { code: 'KW', dialCode: '+965', name: 'Kuwait' },
  { code: 'LA', dialCode: '+856', name: 'Laos' },
  { code: 'LS', dialCode: '+266', name: 'Lesoto' },
  { code: 'LV', dialCode: '+371', name: 'Letonia' },
  { code: 'LB', dialCode: '+961', name: 'Líbano' },
  { code: 'LR', dialCode: '+231', name: 'Liberia' },
  { code: 'LY', dialCode: '+218', name: 'Libia' },
  { code: 'LI', dialCode: '+423', name: 'Liechtenstein' },
  { code: 'LT', dialCode: '+370', name: 'Lituania' },
  { code: 'LU', dialCode: '+352', name: 'Luxemburgo' },
  { code: 'MO', dialCode: '+853', name: 'Macao' },
  { code: 'MK', dialCode: '+389', name: 'Macedonia del Norte' },
  { code: 'MG', dialCode: '+261', name: 'Madagascar' },
  { code: 'MY', dialCode: '+60', name: 'Malasia' },
  { code: 'MW', dialCode: '+265', name: 'Malaui' },
  { code: 'MV', dialCode: '+960', name: 'Maldivas' },
  { code: 'ML', dialCode: '+223', name: 'Malí' },
  { code: 'MT', dialCode: '+356', name: 'Malta' },
  { code: 'MA', dialCode: '+212', name: 'Marruecos' },
  { code: 'MQ', dialCode: '+596', name: 'Martinica' },
  { code: 'MU', dialCode: '+230', name: 'Mauricio' },
  { code: 'MR', dialCode: '+222', name: 'Mauritania' },
  { code: 'YT', dialCode: '+262', name: 'Mayotte' },
  { code: 'MX', dialCode: '+52', name: 'México' },
  { code: 'FM', dialCode: '+691', name: 'Micronesia' },
  { code: 'MD', dialCode: '+373', name: 'Moldavia' },
  { code: 'MC', dialCode: '+377', name: 'Mónaco' },
  { code: 'MN', dialCode: '+976', name: 'Mongolia' },
  { code: 'ME', dialCode: '+382', name: 'Montenegro' },
  { code: 'MS', dialCode: '+1', name: 'Montserrat' },
  { code: 'MZ', dialCode: '+258', name: 'Mozambique' },
  { code: 'MM', dialCode: '+95', name: 'Myanmar (Birmania)' },
  { code: 'NA', dialCode: '+264', name: 'Namibia' },
  { code: 'NR', dialCode: '+674', name: 'Nauru' },
  { code: 'NP', dialCode: '+977', name: 'Nepal' },
  { code: 'NI', dialCode: '+505', name: 'Nicaragua' },
  { code: 'NE', dialCode: '+227', name: 'Níger' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria' },
  { code: 'NU', dialCode: '+683', name: 'Niue' },
  { code: 'NO', dialCode: '+47', name: 'Noruega' },
  { code: 'NC', dialCode: '+687', name: 'Nueva Caledonia' },
  { code: 'NZ', dialCode: '+64', name: 'Nueva Zelanda' },
  { code: 'OM', dialCode: '+968', name: 'Omán' },
  { code: 'NL', dialCode: '+31', name: 'Países Bajos' },
  { code: 'PK', dialCode: '+92', name: 'Pakistán' },
  { code: 'PW', dialCode: '+680', name: 'Palaos' },
  { code: 'PS', dialCode: '+970', name: 'Palestina' },
  { code: 'PA', dialCode: '+507', name: 'Panamá' },
  { code: 'PG', dialCode: '+675', name: 'Papúa Nueva Guinea' },
  { code: 'PY', dialCode: '+595', name: 'Paraguay' },
  { code: 'PE', dialCode: '+51', name: 'Perú' },
  { code: 'PF', dialCode: '+689', name: 'Polinesia Francesa' },
  { code: 'PL', dialCode: '+48', name: 'Polonia' },
  { code: 'PT', dialCode: '+351', name: 'Portugal' },
  { code: 'PR', dialCode: '+1', name: 'Puerto Rico' },
  { code: 'GB', dialCode: '+44', name: 'Reino Unido' },
  { code: 'CF', dialCode: '+236', name: 'República Centroafricana' },
  { code: 'CZ', dialCode: '+420', name: 'República Checa' },
  { code: 'DO', dialCode: '+1', name: 'República Dominicana' },
  { code: 'RE', dialCode: '+262', name: 'Reunión' },
  { code: 'RW', dialCode: '+250', name: 'Ruanda' },
  { code: 'RO', dialCode: '+40', name: 'Rumanía' },
  { code: 'RU', dialCode: '+7', name: 'Rusia' },
  { code: 'EH', dialCode: '+212', name: 'Sáhara Occidental' },
  { code: 'WS', dialCode: '+685', name: 'Samoa' },
  { code: 'AS', dialCode: '+1', name: 'Samoa Americana' },
  { code: 'KN', dialCode: '+1', name: 'San Cristóbal y Nieves' },
  { code: 'SM', dialCode: '+378', name: 'San Marino' },
  { code: 'MF', dialCode: '+590', name: 'San Martín' },
  { code: 'PM', dialCode: '+508', name: 'San Pedro y Miquelón' },
  { code: 'VC', dialCode: '+1', name: 'San Vicente y las Granadinas' },
  { code: 'SH', dialCode: '+290', name: 'Santa Elena' },
  { code: 'LC', dialCode: '+1', name: 'Santa Lucía' },
  { code: 'ST', dialCode: '+239', name: 'Santo Tomé y Príncipe' },
  { code: 'SN', dialCode: '+221', name: 'Senegal' },
  { code: 'RS', dialCode: '+381', name: 'Serbia' },
  { code: 'SC', dialCode: '+248', name: 'Seychelles' },
  { code: 'SL', dialCode: '+232', name: 'Sierra Leona' },
  { code: 'SG', dialCode: '+65', name: 'Singapur' },
  { code: 'SX', dialCode: '+1', name: 'Sint Maarten' },
  { code: 'SY', dialCode: '+963', name: 'Siria' },
  { code: 'SO', dialCode: '+252', name: 'Somalia' },
  { code: 'LK', dialCode: '+94', name: 'Sri Lanka' },
  { code: 'ZA', dialCode: '+27', name: 'Sudáfrica' },
  { code: 'SD', dialCode: '+249', name: 'Sudán' },
  { code: 'SS', dialCode: '+211', name: 'Sudán del Sur' },
  { code: 'SE', dialCode: '+46', name: 'Suecia' },
  { code: 'CH', dialCode: '+41', name: 'Suiza' },
  { code: 'SR', dialCode: '+597', name: 'Surinam' },
  { code: 'TH', dialCode: '+66', name: 'Tailandia' },
  { code: 'TW', dialCode: '+886', name: 'Taiwán' },
  { code: 'TZ', dialCode: '+255', name: 'Tanzania' },
  { code: 'TJ', dialCode: '+992', name: 'Tayikistán' },
  { code: 'TL', dialCode: '+670', name: 'Timor Oriental' },
  { code: 'TG', dialCode: '+228', name: 'Togo' },
  { code: 'TK', dialCode: '+690', name: 'Tokelau' },
  { code: 'TO', dialCode: '+676', name: 'Tonga' },
  { code: 'TT', dialCode: '+1', name: 'Trinidad y Tobago' },
  { code: 'TN', dialCode: '+216', name: 'Túnez' },
  { code: 'TM', dialCode: '+993', name: 'Turkmenistán' },
  { code: 'TR', dialCode: '+90', name: 'Turquía' },
  { code: 'TV', dialCode: '+688', name: 'Tuvalu' },
  { code: 'UA', dialCode: '+380', name: 'Ucrania' },
  { code: 'UG', dialCode: '+256', name: 'Uganda' },
  { code: 'UY', dialCode: '+598', name: 'Uruguay' },
  { code: 'UZ', dialCode: '+998', name: 'Uzbekistán' },
  { code: 'VU', dialCode: '+678', name: 'Vanuatu' },
  { code: 'VE', dialCode: '+58', name: 'Venezuela' },
  { code: 'VN', dialCode: '+84', name: 'Vietnam' },
  { code: 'WF', dialCode: '+681', name: 'Wallis y Futuna' },
  { code: 'YE', dialCode: '+967', name: 'Yemen' },
  { code: 'DJ', dialCode: '+253', name: 'Yibuti' },
  { code: 'ZM', dialCode: '+260', name: 'Zambia' },
  { code: 'ZW', dialCode: '+263', name: 'Zimbabue' },
];

/**
 * Countries offered in the prefix picker. Spain is pinned first (preselected,
 * common case); the rest follow alphabetically by Spanish name so the picker
 * reads like a familiar A–Z list.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  DEFAULT_PHONE_COUNTRY,
  ...[...OTHER_PHONE_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
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

/**
 * Inverse of `formatPhoneE164`: split a stored number into the country it
 * belongs to and the national part, so a `PhoneField` can be prefilled.
 *
 * - `"+34600123456"` → `{ country: España, national: "600123456" }`
 *   (longest matching dial-code prefix wins; ties resolve to the first country
 *   with that code — dial codes aren't unique, e.g. the +1 bloc).
 * - A raw number with no `+` (legacy data written before E.164 storage) →
 *   `{ country: DEFAULT_PHONE_COUNTRY, national: <digits> }`.
 */
export function parsePhoneE164(stored: string): { country: PhoneCountry; national: string } {
  const trimmed = stored.trim();
  if (trimmed.startsWith('+')) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    let match: PhoneCountry | undefined;
    for (const c of PHONE_COUNTRIES) {
      if (normalized.startsWith(c.dialCode) && (!match || c.dialCode.length > match.dialCode.length)) {
        match = c;
      }
    }
    if (match) return { country: match, national: normalized.slice(match.dialCode.length) };
  }
  return { country: DEFAULT_PHONE_COUNTRY, national: trimmed.replace(/\D/g, '') };
}
