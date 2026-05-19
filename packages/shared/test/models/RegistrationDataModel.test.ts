// packages/shared/test/models/RegistrationDataModel.test.ts
import { describe, it, expect } from 'vitest'
import { buildRegistrationData } from '../../src/models/event/RegistrationDataModel'

describe('buildRegistrationData', () => {
  it('builds a confirmed registration', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personId: 'person-1',
      name: 'Juan García',
      status: 'confirmed',
      position: 1,
    })
    expect(reg.userId).toBe('user-1')
    expect(reg.personId).toBe('person-1')
    expect(reg.name).toBe('Juan García')
    expect(reg.status).toBe('confirmed')
    expect(reg.position).toBe(1)
    expect(reg.registeredAt).toBeInstanceOf(Date)
  })

  it('builds a waitlisted registration', () => {
    const reg = buildRegistrationData({
      userId: 'user-1',
      personId: 'person-1',
      name: 'Juan García',
      status: 'waitlisted',
      position: 51,
    })
    expect(reg.status).toBe('waitlisted')
    expect(reg.position).toBe(51)
  })
})
