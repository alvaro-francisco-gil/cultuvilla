import { describe, it, expect } from 'vitest';
import { EventFormSchema } from '../../src/models/event/EventFormSchema';

describe('EventFormSchema', () => {
  const validBase = {
    title: 'Fiesta del pueblo',
    description: 'Una gran fiesta',
    startDate: '2026-08-15T20:00',
    locationName: 'Plaza Mayor',
    maxAttendees: '',
    telephoneRequired: false,
  };

  it('parses a minimal valid input', () => {
    const result = EventFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe('Fiesta del pueblo');
    expect(result.data.startDate).toBeInstanceOf(Date);
    expect(result.data.locationName).toBe('Plaza Mayor');
    expect(result.data.maxAttendees).toBeNull();
    expect(result.data.telephoneRequired).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = EventFormSchema.safeParse({ ...validBase, title: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const titleErr = result.error.issues.find((i) => i.path[0] === 'title');
    expect(titleErr?.message).toBe('El título es obligatorio');
  });

  it('rejects a missing startDate', () => {
    const result = EventFormSchema.safeParse({ ...validBase, startDate: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'startDate');
    expect(err).toBeDefined();
  });

  it('rejects an empty locationName', () => {
    const result = EventFormSchema.safeParse({ ...validBase, locationName: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'locationName');
    expect(err?.message).toBe('El nombre del lugar es obligatorio');
  });

  it('rejects a missing locationName', () => {
    const { locationName: _omit, ...withoutLocation } = validBase;
    const result = EventFormSchema.safeParse(withoutLocation);
    expect(result.success).toBe(false);
  });

  it('trims locationName whitespace', () => {
    const result = EventFormSchema.safeParse({ ...validBase, locationName: '  Plaza  ' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.locationName).toBe('Plaza');
  });

  it('coerces maxAttendees string to integer', () => {
    const result = EventFormSchema.safeParse({ ...validBase, maxAttendees: '50' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.maxAttendees).toBe(50);
  });

  it('rejects maxAttendees below 1', () => {
    const result = EventFormSchema.safeParse({ ...validBase, maxAttendees: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects fractional maxAttendees', () => {
    const result = EventFormSchema.safeParse({ ...validBase, maxAttendees: '3.5' });
    expect(result.success).toBe(false);
  });

  it('defaults endDate to null when omitted (single-day event)', () => {
    const result = EventFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.endDate).toBeNull();
  });

  it('coerces an empty endDate string to null', () => {
    const result = EventFormSchema.safeParse({ ...validBase, endDate: '' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.endDate).toBeNull();
  });

  it('accepts an endDate on or after startDate', () => {
    const result = EventFormSchema.safeParse({ ...validBase, endDate: '2026-08-17T20:00' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.endDate).toBeInstanceOf(Date);
  });

  it('rejects an endDate before startDate', () => {
    const result = EventFormSchema.safeParse({ ...validBase, endDate: '2026-08-14T20:00' });
    expect(result.success).toBe(false);
  });
});
