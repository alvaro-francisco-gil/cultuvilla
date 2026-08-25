/**
 * List shaping for the organizer picker sheets — pure so the filter/order rules
 * are unit-testable without mounting a Modal.
 *
 * Matabuena (prod) has 165 members. The sheet used to render them in Firestore
 * doc-id order, which is UID order and therefore arbitrary: everyone was listed
 * and nobody could be found. Ordering by name and filtering by a search box is
 * what makes the list usable at that size.
 */

/** A row the picker sheets can list. */
export interface PickerOption {
  id: string;
  label: string;
  /** Optional pre-normalized sort key (e.g. `municipalityPeople.sortName`). */
  sortKey?: string;
}

/**
 * Fold a name (or a search term) down to its comparable form: NFD-decompose,
 * strip combining marks, lowercase, collapse whitespace. So `Martín` matches
 * `martin` — Spanish surnames are accented and nobody types the accent into a
 * search box.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Substring match anywhere in the label, not prefix-only: villagers are listed
 * "Nombre Apellido1 Apellido2" and people search by whichever part they
 * remember. A blank term matches everything.
 */
export function filterOptions<T extends PickerOption>(options: T[], search: string): T[] {
  const term = normalizeSearchText(search);
  if (!term) return options;
  return options.filter((o) => normalizeSearchText(o.label).includes(term));
}

/**
 * Alphabetical by name, with the rows that were *already* selected when the
 * sheet opened pinned to the top — so the current choices are visible and
 * un-tickable without scrolling past 165 neighbours.
 *
 * `pinned` is deliberately the selection captured at open, never the live one:
 * ordering off the live set would make a row jump to the top the instant you
 * ticked it, moving the list under the finger that just tapped it.
 */
export function orderOptions<T extends PickerOption>(options: T[], pinned: Set<string>): T[] {
  return [...options].sort((a, b) => {
    const aPinned = pinned.has(a.id);
    const bPinned = pinned.has(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return normalizeSearchText(a.sortKey ?? a.label).localeCompare(
      normalizeSearchText(b.sortKey ?? b.label),
      'es',
    );
  });
}
