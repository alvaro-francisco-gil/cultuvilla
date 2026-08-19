// packages/shared/test/models/event/RegistrationDataModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  RegistrationDataSchema,
  RegistrationStatusSchema,
  buildRegistrationData,
} from '../../../src/models/event/RegistrationDataModel';

const validRegistration = {
  userId: 'u-1',
  personId: 'p-1',
  name: 'Alvaro',
  status: 'confirmed' as const,
  position: 1,
  registeredAt: new Date('2026-06-15T18:00:00Z'),
  isMember: false,
  checkedInAt: null,
};

describe('RegistrationDataSchema', () => {
  it('parses a complete valid registration', () => {
    expect(() => RegistrationDataSchema.parse(validRegistration)).not.toThrow();
  });

  it('requires isMember', () => {
    const { isMember: _isMember, ...rest } = validRegistration;
    expect(() => RegistrationDataSchema.parse(rest)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { name: _name, ...rest } = validRegistration;
    expect(() => RegistrationDataSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => RegistrationDataSchema.parse({ ...validRegistration, status: 'pending' })).toThrow();
  });

  it('defaults paidAt to null when the field is absent (converter-safe)', () => {
    const { checkedInAt: _c, ...rest } = validRegistration;
    const parsed = RegistrationDataSchema.parse({ ...rest, checkedInAt: null });
    expect(parsed.paidAt).toBeNull();
  });

  it('accepts an explicit paidAt date', () => {
    const paidAt = new Date('2026-06-16T10:00:00Z');
    const parsed = RegistrationDataSchema.parse({ ...validRegistration, paidAt });
    expect(parsed.paidAt).toEqual(paidAt);
  });
});

describe('RegistrationStatusSchema', () => {
  it('accepts confirmed and waitlisted', () => {
    expect(RegistrationStatusSchema.parse('confirmed')).toBe('confirmed');
    expect(RegistrationStatusSchema.parse('waitlisted')).toBe('waitlisted');
  });
});

describe('buildRegistrationData', () => {
  it('fills registeredAt with new Date() when omitted', () => {
    const before = Date.now();
    const built = buildRegistrationData({
      userId: 'u', personId: 'p', name: 'n', status: 'confirmed', position: 1,
    });
    const after = Date.now();
    expect(built.registeredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(built.registeredAt.getTime()).toBeLessThanOrEqual(after);
    expect(() => RegistrationDataSchema.parse(built)).not.toThrow();
  });

  it('preserves an explicit registeredAt', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const built = buildRegistrationData({
      userId: 'u', personId: 'p', name: 'n', status: 'confirmed', position: 1,
      registeredAt: d,
    });
    expect(built.registeredAt).toEqual(d);
  });

  it('defaults paidAt to null when omitted', () => {
    const built = buildRegistrationData({
      userId: 'u', personId: 'p', name: 'n', status: 'confirmed', position: 1,
    });
    expect(built.paidAt).toBeNull();
    expect(() => RegistrationDataSchema.parse(built)).not.toThrow();
  });
});

describe('roster denormalization', () => {
  it('defaults the three person fields when absent (converter-safe)', () => {
    const parsed = RegistrationDataSchema.parse(validRegistration);
    expect(parsed.photoURL).toBeNull();
    expect(parsed.personUserId).toBeNull();
    // Registrations predating the field belong to personas that were public by
    // default; the backfill sets the real value from `persons`.
    expect(parsed.isPersonPublic).toBe(true);
  });

  it('round-trips the denormalized person fields', () => {
    const parsed = RegistrationDataSchema.parse({
      ...validRegistration,
      photoURL: 'https://example.test/p.jpg',
      personUserId: 'u-9',
      isPersonPublic: false,
    });
    expect(parsed.photoURL).toBe('https://example.test/p.jpg');
    expect(parsed.personUserId).toBe('u-9');
    expect(parsed.isPersonPublic).toBe(false);
  });

  it('builds a walk-in with no person as public and unlinked', () => {
    const built = buildRegistrationData({
      userId: '',
      personId: '',
      name: 'Vecina de paso',
      status: 'confirmed',
      position: 1,
    });
    expect(built.photoURL).toBeNull();
    expect(built.personUserId).toBeNull();
    expect(built.isPersonPublic).toBe(true);
  });

  it('carries an explicit private persona through the builder', () => {
    const built = buildRegistrationData({
      userId: 'u-1',
      personId: 'p-2',
      name: 'Peque',
      status: 'confirmed',
      position: 2,
      isPersonPublic: false,
    });
    expect(built.isPersonPublic).toBe(false);
  });
});
