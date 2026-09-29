/**
 * Which records have left the working list.
 *
 * Decided here, against today, rather than in the snapshot: the snapshot is only
 * as fresh as the last deploy, and a deadline passes every day whether or not
 * anything is redeployed.
 */
import type { BusinessCard, BusinessKind } from '@cultuvilla/shared/models';
import { estadoStyle } from './labels';

/** Only kinds with a deadline-driven lifecycle can go stale. */
const ARCHIVABLE: ReadonlySet<BusinessKind> = new Set(['convocatoria', 'evento']);

export function isArchived(card: BusinessCard, today: string): boolean {
  if (!ARCHIVABLE.has(card.kind)) return false;
  const style = estadoStyle(card);
  if (style === 'cerrado') return true;
  // Presented, registered or won: the deadline is behind us but the outcome —
  // or the trip itself — is not, so it stays in view.
  if (style === 'comprometido' || style === 'logrado') return false;
  return card.deadline !== undefined && card.deadline < today;
}

export function splitArchived(cards: BusinessCard[], today: string): { active: BusinessCard[]; archived: BusinessCard[] } {
  const active: BusinessCard[] = [];
  const archived: BusinessCard[] = [];
  for (const card of cards) (isArchived(card, today) ? archived : active).push(card);
  return { active, archived };
}
