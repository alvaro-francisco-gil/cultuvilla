import { describe, expect, it } from 'vitest';
import { isValidEmail } from '../../src/utils/email';

describe('isValidEmail', () => {
  it.each(['ana@correo.com', 'ana.lopez+fiestas@pueblo.es', '  ana@correo.com  '])(
    'accepts %s',
    (email) => { expect(isValidEmail(email)).toBe(true); },
  );

  it.each(['', '   ', 'ana', 'ana@', 'ana@correo', '@correo.com', 'ana @correo.com', 'ana@@correo.com'])(
    'rejects %j',
    (email) => { expect(isValidEmail(email)).toBe(false); },
  );
});
