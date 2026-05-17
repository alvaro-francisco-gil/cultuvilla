import { describe, it, expect } from 'vitest';
import { GeoPoint } from 'firebase/firestore';
import { buildVillageData } from '../../src/models/village/VillageDataModel';

describe('buildVillageData', () => {
  it('defaults barrios and images to empty arrays and sets createdAt', () => {
    const v = buildVillageData({
      name: 'Becerril',
      description: 'Un pueblo bonito',
      country: 'ES',
      comunidadAutonoma: 'Madrid',
      provincia: 'Madrid',
      coordinates: new GeoPoint(40.7, -4.0),
      adminUserId: 'admin1',
    });
    expect(v.name).toBe('Becerril');
    expect(v.barrios).toEqual([]);
    expect(v.images).toEqual([]);
    expect(v.createdAt).toBeInstanceOf(Date);
    expect(v.profileForm).toBeUndefined();
  });

  it('preserves provided barrios, images, and createdAt', () => {
    const t = new Date('2026-01-01');
    const v = buildVillageData({
      name: 'X',
      description: '',
      country: 'ES',
      comunidadAutonoma: 'Madrid',
      provincia: 'Madrid',
      coordinates: new GeoPoint(0, 0),
      adminUserId: 'a',
      barrios: ['Centro', 'La Estación'],
      images: ['https://x/y.jpg'],
      createdAt: t,
    });
    expect(v.barrios).toEqual(['Centro', 'La Estación']);
    expect(v.images).toEqual(['https://x/y.jpg']);
    expect(v.createdAt).toEqual(t);
  });
});
