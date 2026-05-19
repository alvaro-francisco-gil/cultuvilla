import { describe, it, expect } from 'vitest';
import { EventFormSchema } from '../../src/models/event/EventFormSchema';

describe('EventFormSchema', () => {
  const validBase = {
    title: 'Fiesta del pueblo',
    description: 'Una gran fiesta',
    startDate: '2026-08-15T20:00',
    endDate: '',
    locationText: '',
    price: '',
    maxAttendees: '',
    telephoneRequired: false,
  };

  it('parses a minimal valid input', () => {
    const result = EventFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe('Fiesta del pueblo');
    expect(result.data.startDate).toBeInstanceOf(Date);
    expect(result.data.endDate).toBeNull();
    expect(result.data.locationText).toBeNull();
    expect(result.data.price).toBeNull();
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

  it('coerces price string to number', () => {
    const result = EventFormSchema.safeParse({ ...validBase, price: '15.50' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.price).toBe(15.5);
  });

  it('rejects a negative price', () => {
    const result = EventFormSchema.safeParse({ ...validBase, price: '-5' });
    expect(result.success).toBe(false);
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

  it('trims and nulls empty locationText', () => {
    const trimmed = EventFormSchema.safeParse({ ...validBase, locationText: '  Plaza Mayor  ' });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) expect(trimmed.data.locationText).toBe('Plaza Mayor');

    const empty = EventFormSchema.safeParse({ ...validBase, locationText: '   ' });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.locationText).toBeNull();
  });

  it('parses endDate when provided', () => {
    const result = EventFormSchema.safeParse({
      ...validBase,
      endDate: '2026-08-15T23:00',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.endDate).toBeInstanceOf(Date);
  });
});
