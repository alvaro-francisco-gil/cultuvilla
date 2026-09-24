/**
 * Maps a record's fields onto chip styles.
 *
 * Grouped by what a label *means*, not by which field produced it: `submitted`
 * on a convocatoria and `enviada` on a propuesta are the same kind of fact, so
 * they get the same colour. A reader then learns five colours instead of twenty
 * words.
 */
import type { BusinessCard } from '@cultuvilla/shared/models';
import type { ChipStyle } from './theme';

const ESTADO: Record<string, { label: string; style: ChipStyle }> = {
  // Nothing has happened yet.
  watching: { label: 'vigilando', style: 'neutral' },
  'sin-contacto': { label: 'sin contacto', style: 'neutral' },
  // We are working on it.
  candidate: { label: 'candidata', style: 'activo' },
  preparing: { label: 'preparando', style: 'activo' },
  borrador: { label: 'borrador', style: 'activo' },
  contactado: { label: 'contactado', style: 'activo' },
  conversando: { label: 'conversando', style: 'activo' },
  lista: { label: 'lista', style: 'activo' },
  // Handed over; out of our hands now.
  submitted: { label: 'presentada', style: 'comprometido' },
  enviada: { label: 'enviada', style: 'comprometido' },
  registered: { label: 'inscritos', style: 'comprometido' },
  // It worked.
  won: { label: 'ganada', style: 'logrado' },
  attended: { label: 'asistimos', style: 'logrado' },
  colaborando: { label: 'colaborando', style: 'logrado' },
  // Over, one way or another.
  lost: { label: 'perdida', style: 'cerrado' },
  expired: { label: 'caducada', style: 'cerrado' },
  skipped: { label: 'descartado', style: 'cerrado' },
  descartado: { label: 'descartado', style: 'cerrado' },
  retirada: { label: 'retirada', style: 'cerrado' },
};

const FIT: Record<string, { label: string; style: ChipStyle }> = {
  high: { label: 'encaje alto', style: 'fitAlto' },
  medium: { label: 'encaje medio', style: 'fitMedio' },
  low: { label: 'encaje bajo', style: 'fitBajo' },
};

export type Chip = { label: string; style: ChipStyle };

/** Urgency by days remaining. Colour, not just a number, so it reads at a glance. */
export function urgencyChip(dias: number): Chip {
  if (dias < 0) return { label: `vencido hace ${String(-dias)} d`, style: 'cerrado' };
  if (dias === 0) return { label: 'hoy', style: 'urgente' };
  if (dias <= 2) return { label: `${String(dias)} días`, style: 'urgente' };
  if (dias <= 7) return { label: `${String(dias)} días`, style: 'aviso' };
  return { label: `${String(dias)} días`, style: 'neutral' };
}

/**
 * A sweep's own vocabulary. Deliberately not `urgencyChip`: a deadline passing
 * means an opportunity is gone, while a review date passing just means the search
 * is due again — "vencido hace 3 d" on a búsqueda would read as a loss.
 */
export function sweepChips(card: BusinessCard, dias: number | null): Chip[] {
  const chips: Chip[] = [];
  if (dias !== null) {
    chips.push(
      dias <= 0
        ? { label: 'toca volver a barrer', style: 'aviso' }
        : { label: `revisión en ${String(dias)} días`, style: 'neutral' },
    );
  }
  if (card.ejecutada) chips.push({ label: `barrida el ${card.ejecutada}`, style: 'neutral' });
  return chips;
}

/** Every chip a card should show, in reading order. */
export function chipsFor(card: BusinessCard, dias: number | null): Chip[] {
  if (card.kind === 'busqueda') return sweepChips(card, dias);

  const chips: Chip[] = [];
  if (dias !== null) chips.push(urgencyChip(dias));

  const estado = card.status ?? card.relacion;
  // An unmapped value still renders — better a grey chip with the raw word than
  // a silently missing one when the registry grows a new state.
  if (estado) chips.push(ESTADO[estado] ?? { label: estado, style: 'neutral' });

  if (card.fit) chips.push(FIT[card.fit] ?? { label: card.fit, style: 'fitBajo' });

  if (card.kind === 'propuesta') {
    chips.push(
      card.holes === 0
        ? { label: 'sin huecos', style: 'logrado' }
        : { label: `${String(card.holes)} huecos`, style: 'aviso' },
    );
  }
  return chips;
}

/** True when the record is finished, so the card can be visually de-emphasised. */
export function isClosed(card: BusinessCard): boolean {
  const estado = card.status ?? card.relacion;
  return estado !== undefined && ESTADO[estado]?.style === 'cerrado';
}
