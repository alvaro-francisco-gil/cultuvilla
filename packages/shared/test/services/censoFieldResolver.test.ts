import { describe, it, expect } from 'vitest';
import { resolveFieldDisplay } from '../../src/services/censoFieldResolver';

describe('resolveFieldDisplay', () => {
  it('resolves a custom field directly', () => {
    const r = resolveFieldDisplay({
      source: 'custom', key: 'pet', label: 'Mascota', type: 'text', required: true,
    });
    expect(r).toMatchObject({ key: 'pet', label: 'Mascota', type: 'text', required: true });
  });
  it('resolves a custom entity-backed select', () => {
    const r = resolveFieldDisplay({
      source: 'custom', key: 'lugar', label: 'Lugar favorito', type: 'select',
      optionsSource: 'places', required: false,
    });
    expect(r.optionsSource).toBe('places');
    expect(r.type).toBe('select');
  });
  it('resolves a predefined field from the registry (barrio -> barrios source)', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'barrio', required: true });
    expect(r.type).toBe('select');
    expect(r.optionsSource).toBe('barrios');
    expect(r.label).toBe('Barrio');
  });
  it('resolves a predefined select with static registry options', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'residencyType', required: false });
    expect(r.type).toBe('select');
    expect(r.options).toEqual(['permanente', 'veraneante', 'visitante']);
  });
  it('predefined label override wins over registry default', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'barrio', label: 'Tu barrio', required: true });
    expect(r.label).toBe('Tu barrio');
  });
});
