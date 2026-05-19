// Test data builders for municipalities (the entity that hosts a village
// community). Pure factory: returns a MunicipalityData object; persisting it
// to the emulator is the test's responsibility.

import { GeoPoint } from 'firebase/firestore';
import {
  buildMunicipalityData,
  buildVillageCommunity,
  type MunicipalityData,
} from '../../src/models/municipality/MunicipalityDataModel';

let counter = 0;
const nextId = () => ++counter;

export function makeMunicipality(
  overrides: Partial<MunicipalityData> = {},
): MunicipalityData {
  const n = nextId();
  const base = buildMunicipalityData({
    name: `Test Municipality ${n}`,
    province: 'Salamanca',
    comunidadAutonoma: 'Castilla y León',
    codigoINE: `99${String(n).padStart(3, '0')}`,
    coordinates: new GeoPoint(40.9, -5.7),
  });
  return { ...base, ...overrides };
}

export function makeActiveCommunity(
  overrides: Partial<MunicipalityData> = {},
): MunicipalityData {
  const base = makeMunicipality();
  return {
    ...base,
    community: buildVillageCommunity({
      description: 'Test community',
      adminUserId: 'test-admin',
    }),
    communityActive: true,
    ...overrides,
  };
}
