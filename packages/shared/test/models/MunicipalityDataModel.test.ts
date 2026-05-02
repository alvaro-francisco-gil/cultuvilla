import { describe, it, expect } from 'vitest'
import { buildMunicipalityData, buildBarrioData, buildCemeteryData } from '../../src/models/municipality/MunicipalityDataModel'

describe('buildMunicipalityData', () => {
  it('sets all fields and createdAt', () => {
    const result = buildMunicipalityData({ name: 'Jódar', province: 'Jaén', comunidadAutonoma: 'Andalucía', codigoINE: '23050' })
    expect(result.name).toBe('Jódar')
    expect(result.province).toBe('Jaén')
    expect(result.comunidadAutonoma).toBe('Andalucía')
    expect(result.codigoINE).toBe('23050')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildBarrioData', () => {
  it('sets all fields', () => {
    const result = buildBarrioData({ name: 'El Castillo', municipalityId: 'mun1' })
    expect(result.name).toBe('El Castillo')
    expect(result.municipalityId).toBe('mun1')
    expect(result.createdAt).toBeInstanceOf(Date)
  })
})

describe('buildCemeteryData', () => {
  it('defaults description to null', () => {
    const result = buildCemeteryData({ name: 'Cementerio Municipal', municipalityId: 'mun1' })
    expect(result.description).toBeNull()
  })

  it('preserves description when provided', () => {
    const result = buildCemeteryData({ name: 'Cementerio Municipal', municipalityId: 'mun1', description: 'El cementerio del pueblo' })
    expect(result.description).toBe('El cementerio del pueblo')
  })
})
