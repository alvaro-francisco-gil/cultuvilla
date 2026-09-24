import { describe, it, expect } from 'vitest';
import type { BusinessCard } from '@cultuvilla/shared/models';
import { chipsFor, isClosed, urgencyChip } from './labels';

const card = (over: Partial<BusinessCard> = {}): BusinessCard => ({
  path: 'project/convocatorias/x.md',
  holes: 0,
  id: 'x',
  kind: 'convocatoria',
  titulo: 'X',
  ...over,
});

describe('urgencyChip', () => {
  it('escalates colour as the deadline approaches', () => {
    expect(urgencyChip(20).style).toBe('neutral');
    expect(urgencyChip(7).style).toBe('aviso');
    expect(urgencyChip(2).style).toBe('urgente');
    expect(urgencyChip(0).style).toBe('urgente');
  });

  it('says "hoy" rather than "0 días"', () => {
    expect(urgencyChip(0).label).toBe('hoy');
  });

  it('marks a lapsed deadline as closed, not urgent — nothing can be done', () => {
    const chip = urgencyChip(-14);
    expect(chip.style).toBe('cerrado');
    expect(chip.label).toContain('14');
  });

  it('puts the 3-to-7 day band in its own colour', () => {
    expect(urgencyChip(3).style).toBe('aviso');
    expect(urgencyChip(8).style).toBe('neutral');
  });
});

describe('chipsFor', () => {
  it('leads with urgency when there is a deadline', () => {
    const chips = chipsFor(card({ status: 'watching', fit: 'high' }), 2);
    expect(chips[0]?.style).toBe('urgente');
  });

  it('omits the urgency chip when there is no deadline', () => {
    const chips = chipsFor(card({ status: 'watching' }), null);
    expect(chips.every((c) => c.style !== 'urgente')).toBe(true);
  });

  it('gives the same colour to states that mean the same thing', () => {
    const submitted = chipsFor(card({ status: 'submitted' }), null)[0];
    const enviada = chipsFor(card({ kind: 'propuesta', status: 'enviada' }), null)[0];
    expect(submitted?.style).toBe(enviada?.style);
    expect(submitted?.style).toBe('comprometido');
  });

  it('separates "working on it" from "handed over" from "won"', () => {
    const styles = (['preparing', 'submitted', 'won'] as const).map(
      (status) => chipsFor(card({ status }), null)[0]?.style,
    );
    expect(new Set(styles).size).toBe(3);
  });

  it('renders an unmapped state as a grey chip rather than dropping it', () => {
    const chips = chipsFor(card({ status: 'un-estado-nuevo' }), null);
    expect(chips[0]).toEqual({ label: 'un-estado-nuevo', style: 'neutral' });
  });

  it('shows hole count only for proposals, and greens a complete one', () => {
    expect(chipsFor(card({ kind: 'propuesta', holes: 0 }), null).some((c) => c.label === 'sin huecos')).toBe(true);
    expect(chipsFor(card({ kind: 'propuesta', holes: 7 }), null).some((c) => c.label === '7 huecos')).toBe(true);
    expect(chipsFor(card({ kind: 'entidad', holes: 7 }), null).some((c) => c.label.includes('huecos'))).toBe(false);
  });

  it('grades fit as a scale, so the three are visually ordered', () => {
    const styles = (['high', 'medium', 'low'] as const).map(
      (fit) => chipsFor(card({ fit }), null)[0]?.style,
    );
    expect(styles).toEqual(['fitAlto', 'fitMedio', 'fitBajo']);
  });
});

describe('isClosed', () => {
  it('is true for finished records of either vocabulary', () => {
    expect(isClosed(card({ status: 'lost' }))).toBe(true);
    expect(isClosed(card({ status: 'expired' }))).toBe(true);
    expect(isClosed(card({ kind: 'entidad', relacion: 'descartado' }))).toBe(true);
  });

  it('is false for live records and for one with no state at all', () => {
    expect(isClosed(card({ status: 'watching' }))).toBe(false);
    expect(isClosed(card({ status: 'won' }))).toBe(false);
    expect(isClosed(card())).toBe(false);
  });
});
