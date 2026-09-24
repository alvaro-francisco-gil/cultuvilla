// Deliberately loose: the OTP email is the real proof of ownership. This only
// catches shapes that can never receive mail, so the user hears about a typo
// before a round trip instead of after it. Client and callables share it so the
// two can never disagree about what "valid" means.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}
