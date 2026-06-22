import { describe, it, expect } from 'vitest';
import { VillageFormSchema } from '../../src/models/municipality/VillageFormSchema';

const validBase = {
  municipalityId: 'mun-1',
  description: 'Pueblo de la sierra',
  adminUserId: 'user-1',
  location: { lat: 40.7, lng: -3.9, displayName: 'Madrid' },
};

describe('VillageFormSchema', () => {
  it('parses a valid input', () => {
    const result = VillageFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.municipalityId).toBe('mun-1');
    expect(result.data.description).toBe('Pueblo de la sierra');
  });

  it('rejects an empty municipalityId', () => {
    const result = VillageFormSchema.safeParse({ ...validBase, municipalityId: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'municipalityId');
    expect(err?.message).toBe('Selecciona un municipio');
  });

  it('rejects an empty description', () => {
    const result = VillageFormSchema.safeParse({ ...validBase, description: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'description');
    expect(err?.message).toBe('La descripción es obligatoria');
  });

  it('trims the description', () => {
    const result = VillageFormSchema.safeParse({ ...validBase, description: '  Hola  ' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBe('Hola');
  });

  it('rejects an empty adminUserId', () => {
    const result = VillageFormSchema.safeParse({ ...validBase, adminUserId: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'adminUserId');
    expect(err?.message).toBe('Selecciona el coordinador');
  });

  it('accepts a null location (caller validates required-ness)', () => {
    const result = VillageFormSchema.safeParse({ ...validBase, location: null });
    expect(result.success).toBe(true);
  });

});
