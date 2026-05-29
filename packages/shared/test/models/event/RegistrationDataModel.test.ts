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
};

describe('RegistrationDataSchema', () => {
  it('parses a complete valid registration', () => {
    expect(() => RegistrationDataSchema.parse(validRegistration)).not.toThrow();
  });

  it('accepts optional isMember', () => {
    expect(() => RegistrationDataSchema.parse({ ...validRegistration, isMember: true })).not.toThrow();
  });

  it('rejects a missing required field', () => {
    const { name, ...rest } = validRegistration;
    expect(() => RegistrationDataSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => RegistrationDataSchema.parse({ ...validRegistration, status: 'pending' })).toThrow();
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
});
