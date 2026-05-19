import { describe, it, expect } from 'vitest'
import { buildOccupationData, buildOccupationProposalData } from '../../src/models/occupation/OccupationDataModel'

describe('buildOccupationData', () => {
  it('builds with required fields', () => {
    const result = buildOccupationData({ name: 'Agricultor', createdBy: 'admin1' })
    expect(result.name).toBe('Agricultor')
    expect(result.createdBy).toBe('admin1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildOccupationProposalData', () => {
  it('defaults to pending with no reviewer', () => {
    const result = buildOccupationProposalData({ name: 'Molinero', proposedBy: 'user1' })
    expect(result.name).toBe('Molinero')
    expect(result.proposedBy).toBe('user1')
    expect(result.status).toBe('pending')
    expect(result.reviewedBy).toBeNull()
    expect(result.reviewedAt).toBeNull()
    expect(result.approvedOccupationId).toBeNull()
    expect(result.proposedAt).toBeInstanceOf(Date)
  })
})
