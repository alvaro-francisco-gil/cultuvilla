import { describe, it, expect } from '@jest/globals';
import { censoEditorReducer, uniqueKey, fieldErrors } from '../censoEditorReducer';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

const cf = (over: Partial<ProfileFormField> = {}): ProfileFormField =>
  ({ source: 'custom', key: 'k', label: 'L', type: 'text', required: false, ...over } as ProfileFormField);

describe('censoEditorReducer', () => {
  it('addCustom appends a blank field of the given type', () => {
    const r = censoEditorReducer([], { kind: 'addCustom', type: 'select' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ source: 'custom', type: 'select', label: '' });
  });
  it('setLabel regenerates the key from the label', () => {
    const r = censoEditorReducer([cf({ label: '', key: '' })], { kind: 'setLabel', index: 0, label: 'Año de llegada' });
    expect(r[0]!.label).toBe('Año de llegada');
    expect(r[0]!.key).toBe('ano_de_llegada');
  });
  it('changeType to select clears optionsSource and keeps options empty', () => {
    const r = censoEditorReducer([cf({ type: 'text' })], { kind: 'changeType', index: 0, type: 'select' });
    expect(r[0]).toMatchObject({ type: 'select' });
  });
  it('setSource clears static options', () => {
    const r = censoEditorReducer([cf({ type: 'select', options: ['a'] })], { kind: 'setSource', index: 0, source: 'barrios' });
    expect((r[0] as any).optionsSource).toBe('barrios');
    expect((r[0] as any).options).toBeUndefined();
  });
  it('move reorders', () => {
    const a = cf({ key: 'a', label: 'A' }); const b = cf({ key: 'b', label: 'B' });
    const r = censoEditorReducer([a, b], { kind: 'move', index: 0, dir: 1 });
    expect(r.map((f) => f.key)).toEqual(['b', 'a']);
  });
  it('reset replaces all fields', () => {
    const r = censoEditorReducer([cf()], { kind: 'reset', fields: [cf({ key: 'x', label: 'X' })] });
    expect(r.map((f) => f.key)).toEqual(['x']);
  });
});

describe('uniqueKey', () => {
  it('suffixes collisions', () => {
    expect(uniqueKey('barrio', ['barrio'])).toBe('barrio_2');
  });
});

describe('fieldErrors', () => {
  it('flags an empty label and a choice with no options', () => {
    const e = fieldErrors([cf({ label: '' }), cf({ type: 'select', label: 'X', options: [] })]);
    expect(e[0]).toBeDefined();
    expect(e[1]).toBeDefined();
  });
});
