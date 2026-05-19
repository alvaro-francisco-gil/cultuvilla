import { describe, it, expect } from 'vitest'
import { GeoPoint } from 'firebase/firestore'
import {
  buildMunicipalityData,
  buildBarrioData,
  buildCemeteryData,
  buildVillageCommunity,
} from '../../src/models/municipality/MunicipalityDataModel'

describe('buildMunicipalityData', () => {
  it('sets all fields, defaults coordinates to null and community inactive', () => {
    const result = buildMunicipalityData({
      name: 'Jódar',
      province: 'Jaén',
      comunidadAutonoma: 'Andalucía',
      codigoINE: '23050',
    })
    expect(result.name).toBe('Jódar')
    expect(result.province).toBe('Jaén')
    expect(result.comunidadAutonoma).toBe('Andalucía')
    expect(result.codigoINE).toBe('23050')
    expect(result.coordinates).toBeNull()
    expect(result.community).toBeNull()
    expect(result.communityActive).toBe(false)
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('preserves provided coordinates', () => {
    const coords = new GeoPoint(37.85, -3.35)
    const m = buildMunicipalityData({
      name: 'X', province: 'P', comunidadAutonoma: 'C', codigoINE: '00000',
      coordinates: coords,
    })
    expect(m.coordinates).toBe(coords)
  })
})

describe('buildVillageCommunity', () => {
  it('defaults coverImages to [] and profileForm to null', () => {
    const c = buildVillageCommunity({
      description: 'Un pueblo bonito',
      adminUserId: 'admin1',
    })
    expect(c.description).toBe('Un pueblo bonito')
    expect(c.coverImages).toEqual([])
    expect(c.profileForm).toBeNull()
    expect(c.adminUserId).toBe('admin1')
    expect(c.activatedAt).toBeInstanceOf(Date)
  })

  it('preserves cover images', () => {
    const c = buildVillageCommunity({
      description: '',
      adminUserId: 'a',
      coverImages: ['https://x/y.jpg', 'https://x/z.jpg'],
    })
    expect(c.coverImages).toEqual(['https://x/y.jpg', 'https://x/z.jpg'])
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
    const result = buildCemeteryData({
      name: 'Cementerio Municipal',
      municipalityId: 'mun1',
      description: 'El cementerio del pueblo',
    })
    expect(result.description).toBe('El cementerio del pueblo')
  })
})
