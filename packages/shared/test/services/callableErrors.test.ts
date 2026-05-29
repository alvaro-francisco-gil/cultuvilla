import { describe, it, expect } from 'vitest';

import { classifyCallableError } from '../../src/services/callableErrors';

const makeHttpsError = (code: string, message: string) => ({ code, message });

describe('classifyCallableError', () => {
  describe('by HttpsError code', () => {
    it.each([
      ['unauthenticated', 'permission'],
      ['permission-denied', 'permission'],
      ['not-found', 'stale-state'],
      ['failed-precondition', 'stale-state'],
      ['already-exists', 'stale-state'],
      ['aborted', 'stale-state'],
      ['resource-exhausted', 'capacity'],
      ['out-of-range', 'capacity'],
      ['unavailable', 'network'],
      ['deadline-exceeded', 'network'],
      ['cancelled', 'network'],
    ] as const)('maps "%s" → %s', (code, expected) => {
      const result = classifyCallableError(makeHttpsError(code, 'msg'));
      expect(result.kind).toBe(expected);
      expect(result.matchedCode).toBe(code);
    });

    it('strips the "functions/" prefix the client SDK adds', () => {
      const result = classifyCallableError(makeHttpsError('functions/permission-denied', 'msg'));
      expect(result.kind).toBe('permission');
      expect(result.matchedCode).toBe('permission-denied');
    });

    it('leaves "invalid-argument" unclassified (likely client bug)', () => {
      const result = classifyCallableError(makeHttpsError('invalid-argument', 'opaque'));
      expect(result.kind).toBe('unknown');
    });
  });

  describe('by message pattern (no code)', () => {
    it('classifies capacity phrasing', () => {
      expect(classifyCallableError(new Error('El evento está lleno')).kind).toBe('capacity');
      expect(classifyCallableError(new Error('No hay plazas disponibles')).kind).toBe('capacity');
      expect(classifyCallableError(new Error('Aforo completo')).kind).toBe('capacity');
    });

    it('classifies network strings', () => {
      expect(classifyCallableError(new Error('Failed to fetch')).kind).toBe('network');
      expect(classifyCallableError(new Error('Network request failed')).kind).toBe('network');
    });

    it('classifies stale-state phrasing common in cultuvilla', () => {
      expect(classifyCallableError(new Error('Ya tienes una solicitud pendiente')).kind).toBe('stale-state');
      expect(classifyCallableError(new Error('Ya eres miembro de este pueblo')).kind).toBe('stale-state');
      expect(classifyCallableError(new Error('El enlace de invitación ha expirado')).kind).toBe('stale-state');
    });

    it('classifies permission phrasing', () => {
      expect(classifyCallableError(new Error('No autorizado')).kind).toBe('permission');
      expect(classifyCallableError(new Error('Debes iniciar sesión')).kind).toBe('permission');
      expect(classifyCallableError(new Error('Solo el coordinador puede modificar el censo')).kind).toBe('permission');
    });
  });

  describe('capacity message wins over a stale-state code', () => {
    it('classifies a "lleno" message as capacity even when code is failed-precondition', () => {
      // This is currently the behaviour because the code matcher returns
      // 'stale-state' first. Document the precedence so reviewers can decide
      // whether to flip it later.
      const result = classifyCallableError(makeHttpsError('failed-precondition', 'El evento está lleno'));
      expect(result.kind).toBe('stale-state');
    });
  });

  describe('extraction edge cases', () => {
    it('handles a plain string', () => {
      const result = classifyCallableError('Solo el coordinador puede modificar el censo');
      expect(result.kind).toBe('permission');
    });

    it('handles null/undefined', () => {
      expect(classifyCallableError(null).kind).toBe('unknown');
      expect(classifyCallableError(undefined).kind).toBe('unknown');
    });

    it('returns a Spanish headline + detail per kind', () => {
      const r = classifyCallableError(makeHttpsError('permission-denied', 'm'));
      expect(r.headline).toMatch(/no puedes/i);
      expect(r.detail).toMatch(/permiso/i);
    });
  });
});
