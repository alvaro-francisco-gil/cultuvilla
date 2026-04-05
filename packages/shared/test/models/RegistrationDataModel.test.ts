import { describe, it, expect } from 'vitest';
import { buildRegistrationData } from '../../src/models/event/RegistrationDataModel';

describe('buildRegistrationData', () => {
  it('builds a confirmed registration for the user themselves', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      name: 'Juan García',
      status: 'confirmed',
      position: 1,
    });
    expect(reg.userId).toBe('user-1');
    expect(reg.personaId).toBeNull();
    expect(reg.name).toBe('Juan García');
    expect(reg.status).toBe('confirmed');
    expect(reg.position).toBe(1);
  });

  it('builds a waitlisted registration for a persona', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personaId: 'persona-1',
      name: 'Abuela María',
      status: 'waitlisted',
      position: 51,
    });
    expect(reg.personaId).toBe('persona-1');
    expect(reg.status).toBe('waitlisted');
    expect(reg.position).toBe(51);
  });
});
