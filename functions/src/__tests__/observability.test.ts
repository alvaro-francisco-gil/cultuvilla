import { describe, it, expect } from 'vitest';
import { hashUserId, redactPII, looksLikeToken, transformAttrs } from '../shared/observability';

describe('hashUserId', () => {
  it('is deterministic for a given salt and differs from the raw uid', () => {
    const h = hashUserId('user-123', 'salt-a');
    expect(h).toBe(hashUserId('user-123', 'salt-a'));
    expect(h).not.toBe('user-123');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes when the salt changes', () => {
    expect(hashUserId('user-123', 'salt-a')).not.toBe(hashUserId('user-123', 'salt-b'));
  });
  it('passes empty uid through untouched', () => {
    expect(hashUserId('')).toBe('');
  });
});

describe('looksLikeToken', () => {
  it('flags high-entropy alphanumeric tokens', () => {
    expect(looksLikeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);
  });
  it('does not flag a long ordinary word string', () => {
    expect(looksLikeToken('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(looksLikeToken('short1')).toBe(false);
  });
});

describe('redactPII', () => {
  it('scrubs emails, phones and tokens', () => {
    expect(redactPII('mail me at ana@example.com')).toContain('<email>');
    expect(redactPII('call +34600123456 now')).toContain('<phone>');
    expect(redactPII('token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toContain('<token>');
  });
  it('leaves clean messages untouched', () => {
    expect(redactPII('village join failed: precondition')).toBe('village join failed: precondition');
  });
});

describe('transformAttrs', () => {
  it('hashes user.id and redacts error.message', () => {
    const out = transformAttrs({ 'user.id': 'user-123', 'error.message': 'ana@example.com bad', handler: 'x' });
    expect(out?.['user.id']).toMatch(/^[0-9a-f]{64}$/);
    expect(String(out?.['error.message'])).toContain('<email>');
    expect(out?.handler).toBe('x');
  });
  it('returns undefined for undefined input', () => {
    expect(transformAttrs(undefined)).toBeUndefined();
  });
  it('redacts error.stack (its first line embeds the message)', () => {
    const out = transformAttrs({ 'error.stack': 'Error: ana@example.com not found\n  at x' });
    expect(String(out?.['error.stack'])).toContain('<email>');
    expect(String(out?.['error.stack'])).not.toContain('ana@example.com');
  });
});
