import { describe, it, expect } from 'vitest';
import type { BusinessCard } from '@cultuvilla/shared/models';
import { isArchived, splitArchived } from './archive';
import { destinationUrl, sourceUrl } from './links';

const TODAY = '2026-09-29';

const card = (over: Partial<BusinessCard> = {}): BusinessCard => ({
  path: 'project/convocatorias/x.md',
  holes: 0,
  id: 'x',
  kind: 'convocatoria',
  titulo: 'X',
  ...over,
});

describe('isArchived', () => {
  it('archives an open convocatoria once its deadline has passed', () => {
    expect(isArchived(card({ status: 'watching', deadline: '2026-09-28' }), TODAY)).toBe(true);
  });

  it('keeps a deadline that is today or later', () => {
    expect(isArchived(card({ status: 'watching', deadline: TODAY }), TODAY)).toBe(false);
    expect(isArchived(card({ status: 'candidate', deadline: '2026-10-15' }), TODAY)).toBe(false);
  });

  it('keeps an undated open record — there is nothing to have passed', () => {
    expect(isArchived(card({ status: 'watching' }), TODAY)).toBe(false);
  });

  it('archives a closed record regardless of its date', () => {
    expect(isArchived(card({ status: 'expired', deadline: '2026-12-01' }), TODAY)).toBe(true);
    expect(isArchived(card({ status: 'lost' }), TODAY)).toBe(true);
  });

  it('keeps a submitted or won record past its deadline — the outcome still matters', () => {
    expect(isArchived(card({ status: 'submitted', deadline: '2026-09-01' }), TODAY)).toBe(false);
    expect(isArchived(card({ status: 'won', deadline: '2026-09-01' }), TODAY)).toBe(false);
  });

  it('treats encuentros the same way', () => {
    const evento = (over: Partial<BusinessCard>) => card({ kind: 'evento', ...over });
    expect(isArchived(evento({ status: 'candidate', deadline: '2026-09-27' }), TODAY)).toBe(true);
    expect(isArchived(evento({ status: 'registered', deadline: '2026-09-27' }), TODAY)).toBe(false);
  });

  it('never archives entidades, búsquedas or propuestas', () => {
    expect(isArchived(card({ kind: 'entidad', relacion: 'descartado' }), TODAY)).toBe(false);
    expect(isArchived(card({ kind: 'busqueda', revisar: '2026-01-01' }), TODAY)).toBe(false);
    expect(isArchived(card({ kind: 'propuesta', status: 'retirada', deadline: '2026-01-01' }), TODAY)).toBe(false);
  });
});

describe('splitArchived', () => {
  it('partitions without losing or reordering records', () => {
    const a = card({ id: 'a', status: 'watching', deadline: '2026-10-10' });
    const b = card({ id: 'b', status: 'expired' });
    const c = card({ id: 'c', status: 'candidate' });
    const { active, archived } = splitArchived([a, b, c], TODAY);
    expect(active.map((x) => x.id)).toEqual(['a', 'c']);
    expect(archived.map((x) => x.id)).toEqual(['b']);
  });
});

describe('destinationUrl', () => {
  it("opens the initiative's own page when it has one", () => {
    const url = 'https://www.europeanheritageawards.eu/apply/';
    expect(destinationUrl(card({ url }))).toBe(url);
  });

  it('falls back to the Markdown record for a placeholder or missing url', () => {
    const placeholder = card({ url: '[[confirmar: enlace de la convocatoria]]' });
    expect(destinationUrl(placeholder)).toBe(sourceUrl(placeholder));
    expect(destinationUrl(card())).toBe(sourceUrl(card()));
  });
});
