import { describe, it, expect } from 'vitest';
import { OrgRequestFormSchema } from '../../src/models/organization/OrgRequestFormSchema';

describe('OrgRequestFormSchema', () => {
  it('parses a valid input with all three org types', () => {
    for (const type of ['ayuntamiento', 'peña', 'asociación'] as const) {
      const result = OrgRequestFormSchema.safeParse({
        name: 'Mi Org',
        type,
        description: '',
      });
      expect(result.success).toBe(true);
      if (!result.success) continue;
      expect(result.data.name).toBe('Mi Org');
      expect(result.data.type).toBe(type);
      expect(result.data.description).toBeNull();
    }
  });

  it('rejects an empty name', () => {
    const result = OrgRequestFormSchema.safeParse({
      name: '   ',
      type: 'asociación',
      description: '',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'name');
    expect(err?.message).toBe('El nombre es obligatorio');
  });

  it('rejects an unknown org type', () => {
    const result = OrgRequestFormSchema.safeParse({
      name: 'Org',
      type: 'banda',
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('trims name and description', () => {
    const result = OrgRequestFormSchema.safeParse({
      name: '  Coro del Pueblo  ',
      type: 'asociación',
      description: '  Cantamos los sábados  ',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Coro del Pueblo');
    expect(result.data.description).toBe('Cantamos los sábados');
  });
});
